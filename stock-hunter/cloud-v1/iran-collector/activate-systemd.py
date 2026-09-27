#!/usr/bin/env python3
"""Fail-closed Stock Hunter Iran Collector activation for systemd."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys

ENV_FILE = Path("/etc/stock-hunter-collector.env")
COLLECTOR = "/opt/stock-hunter/collector.py"
SERVICE = "stock-hunter-collector.service"
RUN_USER = "stockhunter"

ALLOWED = {
    "STOCK_HUNTER_INGEST_URL",
    "STOCK_HUNTER_COLLECTOR_ID",
    "STOCK_HUNTER_COLLECTOR_SECRET",
    "STOCK_HUNTER_INTERVAL_SECONDS",
    "STOCK_HUNTER_STATE_DIR",
    "STOCK_HUNTER_SPOOL_MAX_BYTES",
    "STOCK_HUNTER_SPOOL_MAX_AGE_SECONDS",
    "STOCK_HUNTER_TSETMC_BASE",
}


def load_env(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise SystemExit(f"missing {path}")
    result: dict[str, str] = {}
    for lineno, raw in enumerate(path.read_text("utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise SystemExit(f"invalid env line {lineno}")
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key not in ALLOWED:
            raise SystemExit(f"unsupported env key at line {lineno}: {key}")
        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]
        result[key] = value
    return result


def validate(env: dict[str, str]) -> None:
    url = env.get("STOCK_HUNTER_INGEST_URL", "")
    secret = env.get("STOCK_HUNTER_COLLECTOR_SECRET", "")
    collector_id = env.get("STOCK_HUNTER_COLLECTOR_ID", "iran-primary")
    if not url.startswith("https://") or "<worker-host>" in url:
        raise SystemExit("real HTTPS STOCK_HUNTER_INGEST_URL is required")
    if len(secret) < 32 or "replace-with" in secret:
        raise SystemExit("real collector secret with at least 32 characters is required")
    if not collector_id or len(collector_id) > 128:
        raise SystemExit("collector id is invalid")


def run_as_collector(args: list[str], env: dict[str, str]) -> None:
    runuser = shutil.which("runuser")
    if not runuser:
        raise SystemExit("runuser is required")
    child_env = os.environ.copy()
    child_env.update(env)
    cmd = [runuser, "-u", RUN_USER, "--preserve-environment", "--",
           sys.executable, COLLECTOR, *args]
    subprocess.run(cmd, env=child_env, check=True)


def main() -> None:
    if os.geteuid() != 0:
        raise SystemExit("run activation as root")
    if not Path(COLLECTOR).is_file():
        raise SystemExit(f"missing {COLLECTOR}; run install-systemd.sh first")
    env = load_env(ENV_FILE)
    validate(env)

    print("STEP 1/3 source-probe: TSETMC from this Iran-egress host", flush=True)
    run_as_collector(["--source-probe"], env)

    print("STEP 2/3 one signed cloud snapshot", flush=True)
    run_as_collector(["--once"], env)

    print("STEP 3/3 start long-running systemd collector", flush=True)
    subprocess.run(["systemctl", "restart", SERVICE], check=True)
    subprocess.run(["systemctl", "--no-pager", "--full", "status", SERVICE], check=False)
    print("ACTIVATION PASS", flush=True)


if __name__ == "__main__":
    main()
