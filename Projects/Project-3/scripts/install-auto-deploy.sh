#!/usr/bin/env bash
# Installs the timer that runs scripts/deploy.sh every few minutes. Run it once, on the server, with sudo:
#
#   sudo scripts/install-auto-deploy.sh            install and start
#   sudo scripts/install-auto-deploy.sh --remove   stop and remove
#
# It runs as the user who ran sudo (the one who can use Docker and has the git checkout), not as root.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_AS="${SUDO_USER:-$(id -un)}"
UNIT_DIR=/etc/systemd/system
INTERVAL="${DEPLOY_INTERVAL:-2min}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this with sudo." >&2
  exit 1
fi

if [ "${1:-}" = "--remove" ]; then
  systemctl disable --now gridline-deploy.timer 2>/dev/null || true
  rm -f "$UNIT_DIR/gridline-deploy.service" "$UNIT_DIR/gridline-deploy.timer"
  systemctl daemon-reload
  echo "Automatic deploys removed."
  exit 0
fi

chmod +x "$PROJECT_DIR/scripts/deploy.sh"

cat > "$UNIT_DIR/gridline-deploy.service" <<UNIT
[Unit]
Description=Bring Gridline up to date with GitHub
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
User=$RUN_AS
WorkingDirectory=$PROJECT_DIR
ExecStart=$PROJECT_DIR/scripts/deploy.sh
# A build can take several minutes on a small instance.
TimeoutStartSec=30min
UNIT

cat > "$UNIT_DIR/gridline-deploy.timer" <<UNIT
[Unit]
Description=Check GitHub for a new Gridline version

[Timer]
OnBootSec=3min
OnUnitInactiveSec=$INTERVAL
AccuracySec=15s

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now gridline-deploy.timer
echo "Installed. Checking GitHub every $INTERVAL as $RUN_AS."
echo "Watch it:   journalctl -u gridline-deploy -f"
echo "Next runs:  systemctl list-timers gridline-deploy.timer"
