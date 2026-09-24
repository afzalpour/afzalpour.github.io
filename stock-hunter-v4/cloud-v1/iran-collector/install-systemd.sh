#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/stock-hunter
STATE_DIR=/var/lib/stock-hunter-collector
ENV_FILE=/etc/stock-hunter-collector.env
UNIT_FILE=/etc/systemd/system/stock-hunter-collector.service
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo ./install-systemd.sh" >&2
  exit 2
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 3
fi
if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd/systemctl is required" >&2
  exit 3
fi
for f in collector.py stock-hunter-collector.service.example activate-systemd.py; do
  [[ -f "$SOURCE_DIR/$f" ]] || { echo "missing $SOURCE_DIR/$f" >&2; exit 4; }
done

if ! id stockhunter >/dev/null 2>&1; then
  useradd --system --home-dir "$STATE_DIR" --shell /usr/sbin/nologin stockhunter
fi
group="$(id -gn stockhunter)"

install -d -o root -g root -m 0755 "$APP_DIR"
install -d -o stockhunter -g "$group" -m 0750 "$STATE_DIR"
install -m 0755 "$SOURCE_DIR/collector.py" "$APP_DIR/collector.py"
install -m 0755 "$SOURCE_DIR/activate-systemd.py" "$APP_DIR/activate-systemd.py"
install -m 0644 "$SOURCE_DIR/stock-hunter-collector.service.example" "$UNIT_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 0640 -o root -g "$group" "$SOURCE_DIR/collector.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE from example. Replace placeholder URL/secret before activation."
else
  chown root:"$group" "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
  echo "Preserved existing $ENV_FILE."
fi

systemctl daemon-reload
systemctl enable stock-hunter-collector.service >/dev/null
systemctl stop stock-hunter-collector.service >/dev/null 2>&1 || true

python3 "$APP_DIR/collector.py" --self-test

cat <<EOF
INSTALL PASS
Service is installed and ENABLED but intentionally NOT STARTED.
1) Set real values in $ENV_FILE
2) Run:
   sudo $APP_DIR/activate-systemd.py

Activation will source-probe TSETMC, send exactly one signed cloud snapshot,
and start the long-running service only if both checks succeed.
EOF
