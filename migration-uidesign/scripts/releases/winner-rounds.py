import datetime
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path("/opt/goonginga")
PROJECT = ROOT / "migration-uidesign"
SQL = PROJECT / "scripts/sql/20261102_hero_catalog.sql"
PORTRAITS = PROJECT / "frontend/HeroImages"
MIGRATIONS = ROOT / "backend-springboot/src/main/resources/db/migration"
SERVICES = ("backend", "frontend")
COMPOSE = ("docker", "compose", "-f", "compose.yaml")
PUBLIC = "https://goongingaleague.duckdns.org"
API = "http://127.0.0.1:3000"
PSQL = 'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
PG_DUMP = 'exec pg_dump -Fc --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"'


def run(args, **kwargs):
    return subprocess.run(args, cwd=PROJECT, check=True, **kwargs)


def read(args):
    return run(args, stdout=subprocess.PIPE).stdout


def db(command, **kwargs):
    return run((*COMPOSE, "exec", "-T", "database", "sh", "-c", command), **kwargs)


def versions():
    query = (
        "SELECT version FROM spring_draft.flyway_schema_history "
        "WHERE success AND version IS NOT NULL ORDER BY installed_rank;"
    )
    result = db(PSQL, input=query.encode(), stdout=subprocess.PIPE)
    return result.stdout.decode().split()


def digest(data):
    return hashlib.sha256(data).hexdigest()


TEXT_EXTENSIONS = {".ts", ".tsx", ".css", ".java", ".sql", ".json"}


def payload_hash(path, data):
    if data is None:
        return None
    if path.suffix in TEXT_EXTENSIONS:
        data = data.replace(b"\r\n", b"\n")
    return digest(data)


def file_hash(path):
    return digest(path.read_bytes()) if path.is_file() else None


def replace_file(path, data):
    if data is None:
        path.unlink(missing_ok=True)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o644
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temp = Path(stream.name)
        try:
            stream.write(data)
            stream.close()
            temp.chmod(mode)
            temp.replace(path)
        finally:
            temp.unlink(missing_ok=True)


def validate_path(name):
    relative = Path(name)
    if relative.is_absolute() or ".." in relative.parts or relative.parts[0] == ".git":
        raise RuntimeError(f"Invalid release path: {name}")
    path = ROOT / relative
    if path.resolve() != path or (path.exists() and not path.is_file()):
        raise RuntimeError(f"Unexpected file type or symlink: {name}")
    return path


def stage_payload(commit, manifest):
    payload = {}
    originals = {}
    for name, hashes in manifest["files"].items():
        path = validate_path(name)
        original = path.read_bytes() if path.is_file() else None
        actual = payload_hash(path, original)
        if actual not in (hashes["base"], hashes["new"]):
            raise RuntimeError(f"Unexpected production changes in {name}")
        new = read(("git", "show", f"{commit}:{name}")) if hashes["new"] else None
        if payload_hash(path, new) != hashes["new"]:
            raise RuntimeError(f"Release hash mismatch: {name}")
        payload[path] = new
        originals[path] = original
    return payload, originals


def container(service):
    identity = read((*COMPOSE, "ps", "-q", service)).decode().strip()
    if not identity or "\n" in identity:
        raise RuntimeError(f"Expected one running container for {service}")
    return identity


def preserve_images(stamp):
    names = {}
    tags = {}
    for service in SERVICES:
        identity = container(service)
        image, image_id = read((
            "docker", "inspect", "--format", "{{.Config.Image}} {{.Image}}", identity
        )).decode().split()
        current_tag = read(("docker", "image", "inspect", "--format", "{{.Id}}", image)).decode().strip()
        if current_tag != image_id:
            raise RuntimeError(f"Image tag for {service} has moved since the running container started")
        rollback = f"goonginga-{service}:rollback-winner-rounds-{stamp}"
        run(("docker", "tag", image, rollback))
        names[service] = rollback
        tags[service] = image
    return names, tags


def fetch(url):
    with urllib.request.urlopen(url, timeout=10) as response:
        if response.status != 200:
            raise RuntimeError(f"Expected HTTP 200 for {url}")
        return response.read()


def await_check(check, label, seconds=100):
    deadline = time.monotonic() + seconds
    while True:
        try:
            return check()
        except (RuntimeError, OSError, ValueError) as error:
            if time.monotonic() >= deadline:
                raise RuntimeError(f"Timed out waiting for {label}") from error
            time.sleep(2)


def health():
    if json.loads(fetch(API + "/health/db")).get("ok") is not True:
        raise RuntimeError("Database health check is not ready")


def verify_catalog(portraits):
    heroes = json.loads(fetch(API + "/hero"))
    names = {hero["name"].strip().lower(): hero for hero in heroes}
    if names.get("sombra", {}).get("role") != "SUPPORT":
        raise RuntimeError("Sombra is not Support in the served catalog")
    torbjorn = next(
        (hero for hero in heroes if hero.get("imgPath") == "/HeroImages/Icon-Torbjorn.webp"), None
    )
    if torbjorn is None:
        raise RuntimeError("The Torbjorn portrait URL did not migrate")
    for name in portraits:
        expected = file_hash(PORTRAITS / name)
        actual = digest(fetch(API + "/assets/heroes/" + urllib.parse.quote(name)))
        if actual != expected:
            raise RuntimeError(f"Unexpected bytes served for {name}")


def backup_database(backup, log):
    with (backup / "database.dump").open("xb") as dump:
        db(PG_DUMP, stdout=dump, stderr=log)
    if (backup / "database.dump").stat().st_size == 0:
        raise RuntimeError("Database dump is empty")
    with (backup / "database.dump").open("rb") as dump:
        run((*COMPOSE, "exec", "-T", "database", "pg_restore", "--list"),
            stdin=dump, stdout=subprocess.DEVNULL, stderr=log)


def install_portrait_overrides(portraits, backup, log):
    # Only replace filenames in the release. The overrides also serve the new
    # Torbjorn path if the older backend image needs to be restored.
    media = PROJECT / "media"
    command = """
        set -eu
        mkdir -p /media/heroes /backup/portraits
        test ! -L /media/heroes
        for name do
            target="/media/heroes/$name"
            test ! -L "$target"
            if test -e "$target"; then
                test -f "$target"
                cp -p -- "$target" "/backup/portraits/$name"
            fi
        done
        for name do
            temporary="$(mktemp /media/heroes/.portrait.XXXXXX)"
            cp -- "/source/$name" "$temporary"
            chmod 644 "$temporary"
            mv -f -- "$temporary" "/media/heroes/$name"
        done
        chmod a+rx /media/heroes
    """
    run((
        "docker", "run", "--rm", "--user", "0", "--network", "none", "--entrypoint", "sh",
        "-v", f"{PORTRAITS}:/source:ro", "-v", f"{media}:/media",
        "-v", f"{backup}:/backup", "postgres:18-bookworm", "-c", command, "sh", *portraits,
    ), stdout=log, stderr=subprocess.STDOUT)


def deploy(commit, manifest, backup):
    run((*COMPOSE, "config", "--quiet"))
    previous_versions = versions()
    expected_versions = [str(version) for version in range(1, 13)]
    if previous_versions != expected_versions:
        raise RuntimeError(f"Unexpected Flyway history: {', '.join(previous_versions)}")
    source_versions = sorted(
        path.name.split("__", 1)[0][1:] for path in MIGRATIONS.glob("V*__*.sql")
    )
    if source_versions != sorted(expected_versions):
        raise RuntimeError("Production source does not contain exactly the existing V1-V12 migrations")
    mount = read(("docker", "inspect", "--format", "{{json .Mounts}}", container("backend")))
    if not any(
        item["Type"] == "bind" and item["Destination"] == "/app/uploads"
        and Path(item["Source"]).resolve() == (PROJECT / "media").resolve()
        for item in json.loads(mount)
    ):
        raise RuntimeError("Backend media mount does not match this deployment")
    portraits = manifest["portraits"]
    if len(portraits) != 50 or len(set(portraits)) != 50 or any(
        not re.fullmatch(r"[A-Za-z0-9_.-]+\.webp", name) for name in portraits
    ):
        raise RuntimeError("Invalid release portrait list")

    payload, originals = stage_payload(commit, manifest)
    if shutil.disk_usage(ROOT).free < 1024 ** 3:
        raise RuntimeError("Less than 1 GiB free for the container builds")
    if SQL not in payload or payload[SQL] is None or any(
        payload.get(PORTRAITS / name) is None for name in portraits
    ):
        raise RuntimeError("The release is missing its catalog update or portrait files")
    with tarfile.open(backup / "source.tar.gz", "x:gz") as archive:
        for path, data in originals.items():
            if data is not None:
                archive.add(path, arcname=path.relative_to(ROOT).as_posix(), recursive=False)
    (backup / "source-paths.json").write_text(json.dumps({
        path.relative_to(ROOT).as_posix(): data is not None for path, data in originals.items()
    }, indent=2))

    rollback, original_tags = preserve_images(backup.name.removeprefix("winner-rounds-"))
    override = backup / "rollback.json"
    override.write_text(json.dumps({"services": {
        service: {"image": image} for service, image in rollback.items()
    }}, indent=2))

    changed = []
    switched = False
    with (backup / "deployment.log").open("xb") as log:
        try:
            for path, data in payload.items():
                if data != originals[path]:
                    changed.append(path)
                    replace_file(path, data)
            print("Building frontend and backend. The current services stay online.", flush=True)
            for service in SERVICES:
                run((*COMPOSE, "build", service), stdout=log, stderr=subprocess.STDOUT)
            backup_database(backup, log)
            install_portrait_overrides(portraits, backup, log)
            with SQL.open("rb") as sql:
                db(PSQL, stdin=sql, stdout=log, stderr=subprocess.STDOUT)
            print("Starting the new service images and checking production.", flush=True)
            switched = True
            run((*COMPOSE, "up", "-d", "--no-deps", "--no-build", *SERVICES),
                stdout=log, stderr=subprocess.STDOUT)
            await_check(health, "backend database health")
            if versions() != previous_versions:
                raise RuntimeError("Flyway history changed unexpectedly")
            for path in ("/backend/health/db", "/overlay/wincards/1", "/overlay/map-pool-clean/1",
                         "/draft-table/999", "/casting-table/999"):
                await_check(lambda: fetch(PUBLIC + path), path)
            verify_catalog(portraits)
        except BaseException:
            try:
                for service, image in rollback.items():
                    run(("docker", "tag", image, original_tags[service]),
                        stdout=log, stderr=subprocess.STDOUT)
                if switched:
                    print("Restoring the previous frontend and backend images.", flush=True)
                    run((*COMPOSE, "-f", str(override), "up", "-d", "--no-deps", "--no-build", *SERVICES),
                        stdout=log, stderr=subprocess.STDOUT)
                    await_check(health, "restored backend database health")
            finally:
                for path in reversed(changed):
                    replace_file(path, originals[path])
            raise

    print(f"DEPLOY_OK {commit} — both services healthy, 50 portraits verified.", flush=True)
    print(f"Backup and deployment log: {backup}", flush=True)


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"[0-9a-f]{40}", sys.argv[1]):
        raise SystemExit("Usage: python3 deploy-winner-rounds.py FULL_RELEASE_COMMIT")
    os.umask(0o077)
    commit = sys.argv[1]
    manifest = json.loads(read(("git", "show", f"{commit}:migration-uidesign/scripts/releases/winner-rounds.json")))
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backups = PROJECT / "backups"
    backups.mkdir(exist_ok=True)
    with (backups / "winner-rounds.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        backup = backups / f"winner-rounds-{stamp}"
        backup.mkdir()
        try:
            deploy(commit, manifest, backup)
        except Exception as error:
            print(f"DEPLOY_FAILED {error}", file=sys.stderr)
            print(f"Details and backups: {backup}", file=sys.stderr)
            raise SystemExit(1) from None


if __name__ == "__main__":
    main()
