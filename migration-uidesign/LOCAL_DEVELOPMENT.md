# Local development

The local environment uses the final Season 8 VPS snapshot and never writes to production.

## Services

- PostgreSQL: `127.0.0.1:55432/goonginga_dev`
- Backend: `http://localhost:3100`
- Frontend: `http://localhost:3001`

Start all services from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-dev.ps1
```

Local database files, environment overrides, logs, media, and database dumps are excluded from Git. The static Season 8 archive used by History is committed under `frontend/src/data/history` and `frontend/public/history`.
