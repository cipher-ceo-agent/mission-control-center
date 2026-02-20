# Mission Control Center (MCC) — Local Operator Dashboard

MCC is a **fully local** control plane for OpenClaw. It runs on the same machine as Gateway and provides a responsive web app + PWA.

## Guarantees
- 100% local runtime (no CDN, no telemetry/analytics)
- Browser never gets raw Gateway token (server-side only)
- Modular plugin architecture (server + UI)
- Cross-platform target: Linux/macOS/Windows

## Repo Layout
- `server/` Fastify API + Gateway client + plugin backend
- `web/` React + Tailwind + PWA frontend

## Install
```bash
cd mission-control-center
npm install
```

## Dev (hot reload)
```bash
npm run dev
```
- API: `http://127.0.0.1:3001`
- Web: `http://127.0.0.1:5173`

## Production Build
```bash
npm run build
```

## Production Run (single command)
```bash
npm run start:prod
```
Then open `http://127.0.0.1:3001`.

## Run MCC alongside OpenClaw (one-liner)
```bash
cd mission-control-center && npm run start:prod
```
(Keep OpenClaw Gateway running on same host.)

## Security Model
- Default bind: `127.0.0.1`
- If `MCC_HOST=0.0.0.0`, auth is mandatory via `MCC_PASSWORD` + signed cookie session.

## Config
Copy `.env.example` to `.env` and adjust as needed.

## Service Setup

### Linux (systemd user service)
Create `~/.config/systemd/user/mcc.service`:

```ini
[Unit]
Description=Mission Control Center
After=default.target

[Service]
Type=simple
WorkingDirectory=/path/to/mission-control-center
Environment=MCC_HOST=127.0.0.1
Environment=MCC_PORT=3001
Environment=GATEWAY_BASE_URL=http://127.0.0.1:9471
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
```

Commands:
```bash
systemctl --user daemon-reload
systemctl --user enable --now mcc.service
systemctl --user status mcc.service
```

### macOS (launchd)
Create `~/Library/LaunchAgents/com.local.mcc.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>com.local.mcc</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>cd ~/path/to/mission-control-center && npm run start</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>EnvironmentVariables</key>
    <dict>
      <key>MCC_HOST</key><string>127.0.0.1</string>
      <key>MCC_PORT</key><string>3001</string>
      <key>GATEWAY_BASE_URL</key><string>http://127.0.0.1:9471</string>
    </dict>
  </dict>
</plist>
```

Load:
```bash
launchctl load ~/Library/LaunchAgents/com.local.mcc.plist
launchctl start com.local.mcc
```

### Windows (run at startup)
- Create a Task Scheduler task (At logon) that runs:
  - Program: `npm`
  - Arguments: `run start`
  - Start in: `C:\path\to\mission-control-center`
- Set env vars in System/User Environment Variables.

## Troubleshooting
- **Gateway Offline**: check OpenClaw service and `GATEWAY_BASE_URL`
- **Unauthorized**: verify `GATEWAY_TOKEN` on server
- **MCC Login Required unexpectedly**: check if `MCC_HOST` is set to non-loopback

## Audit Logging
Every write operation logs into SQLite (`audit_log` table):
- timestamp, action, target, outcome, detail

## Template Hygiene
No personal agents, memory stores, or skill definitions are committed to this repo. All runtime data (SQLite databases, agent state, cached skills) is generated locally and excluded via `.gitignore`. Clone the repo and it starts clean.

## MVP Status
✅ Overview plugin
✅ Calendar/Cron plugin
✅ Memory manager plugin
✅ Skills plugin (read-only listing)
✅ Placeholder plugin skeletons (tasks, activity, stats)
