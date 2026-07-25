const { execFile } = require("child_process");
const path = require("path");

let migrationPromise = null;

function isMissingWrappedTable(error) {
  const message = String(error?.message || "");
  return error?.code === "P2021" || /table\s+`?public\.Wrapped`?\s+does not exist/i.test(message);
}

function runPrismaMigrations() {
  const backendRoot = path.resolve(__dirname, "..");
  const isWindows = process.platform === "win32";
  const command = isWindows ? "npx.cmd" : path.join(backendRoot, "node_modules", ".bin", "prisma");
  const args = isWindows ? ["prisma", "migrate", "deploy"] : ["migrate", "deploy"];

  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: backendRoot,
      env: process.env,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    }, (error, _stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message || "Prisma migration failed."));
      }
      return resolve();
    });
  });
}

async function repairWrappedSchema() {
  if (!migrationPromise) {
    migrationPromise = runPrismaMigrations().finally(() => {
      migrationPromise = null;
    });
  }
  return migrationPromise;
}

async function retryAfterWrappedMigration(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingWrappedTable(error)) throw error;
    await repairWrappedSchema();
    return operation();
  }
}

module.exports = { retryAfterWrappedMigration };
