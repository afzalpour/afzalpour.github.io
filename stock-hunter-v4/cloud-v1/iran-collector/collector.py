#!/usr/bin/env python3
"""Stock Hunter Iran Feed Collector v1.

Production responsibility: collect point-in-time market facts from an Iranian
egress network and push signed, compressed payloads to the cloud ingest gateway.

This module MUST NOT implement Hunt scoring.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import ssl
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

PROTOCOL = "stock-hunter-iran-ingest-v1"
DEFAULT_BASE = "https://old.tsetmc.com/tsev2/data/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 StockHunterCollector/1"
TRANS = str.maketrans("يك", "یک")
TEHRAN = ZoneInfo("Asia/Tehran")


def number(value, default=0.0):
    try:
        return float(str(value).replace(",", ""))
    except Exception:
        return default


def compact_number(value):
    n = number(value)
    return int(n) if n.is_integer() else n


def sha256_hex(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def canonical_bytes(
    collector_id: str,
    stream_id: str,
    sequence: int,
    timestamp: int,
    nonce: str,
    body: bytes,
) -> bytes:
    return (
        f"v1\n{collector_id}\n{stream_id}\n{sequence}\n{timestamp}\n"
        f"{nonce}\n{sha256_hex(body)}"
    ).encode("utf-8")


def signature_hex(
    secret: str,
    collector_id: str,
    stream_id: str,
    sequence: int,
    timestamp: int,
    nonce: str,
    body: bytes,
) -> str:
    message = canonical_bytes(
        collector_id, stream_id, sequence, timestamp, nonce, body
    )
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


class PersistentState:
    def __init__(self, root: Path):
        self.root = root
        self.spool = root / "spool"
        self.root.mkdir(parents=True, exist_ok=True)
        self.spool.mkdir(parents=True, exist_ok=True)
        self.stream_path = root / "stream-id.txt"
        self.sequence_path = root / "sequence.txt"

    def stream_id(self) -> str:
        if self.stream_path.exists():
            value = self.stream_path.read_text("utf-8").strip()
            if value:
                return value
        value = str(uuid.uuid4())
        self.stream_path.write_text(value + "\n", encoding="utf-8")
        return value

    def next_sequence(self) -> int:
        current = 0
        if self.sequence_path.exists():
            try:
                current = int(self.sequence_path.read_text("utf-8").strip() or "0")
            except Exception:
                current = 0
        value = current + 1
        tmp = self.sequence_path.with_suffix(".tmp")
        tmp.write_text(str(value) + "\n", encoding="utf-8")
        os.replace(tmp, self.sequence_path)
        return value

    def spool_path(self, sequence: int) -> Path:
        return self.spool / f"{sequence:020d}.json.gz"

    def put_spool(self, sequence: int, body: bytes) -> Path:
        path = self.spool_path(sequence)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(body)
        os.replace(tmp, path)
        return path

    def spool_files(self):
        return sorted(self.spool.glob("*.json.gz"))

    def enforce_spool_limits(self, max_bytes: int, max_age_seconds: int):
        files = self.spool_files()
        now = time.time()
        total = sum(p.stat().st_size for p in files if p.exists())
        evicted = []
        for path in files:
            if not path.exists():
                continue
            too_old = now - path.stat().st_mtime > max_age_seconds
            too_large = total > max_bytes
            if not (too_old or too_large):
                continue
            size = path.stat().st_size
            path.unlink(missing_ok=True)
            total -= size
            evicted.append((path.name, size, "age" if too_old else "bytes"))
        if evicted:
            print(
                json.dumps(
                    {
                        "level": "ERROR",
                        "event": "SPOOL_DATA_LOSS",
                        "evicted": evicted,
                        "remaining_bytes": total,
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )


class TsetmcFeed:
    def __init__(self, base: str):
        self.base = base.rstrip("/") + "/"
        self.headers = {
            "User-Agent": UA,
            "Accept": "text/plain,*/*",
            "Referer": "https://www.tsetmc.com/",
        }
        self.prices = {}
        self.best = {}
        self.refid = 0
        self.market_state = ""
        self.heven = 0
        self.client_type = {}
        self.last_client_type_at = 0.0

    def get_text(self, path: str, timeout: int = 25) -> str:
        req = urllib.request.Request(self.base + path, headers=self.headers)
        with urllib.request.urlopen(
            req, timeout=timeout, context=ssl.create_default_context()
        ) as response:
            return response.read().decode("utf-8", "ignore").translate(TRANS)

    @staticmethod
    def parse_price(row: str):
        parts = row.split(",")
        if len(parts) < 23:
            return None
        parts += [""] * (26 - len(parts))
        keys = [
            "id",
            "isin",
            "symbol",
            "company_name",
            "heven",
            "pf",
            "closing_price",
            "last_price",
            "tno",
            "volume",
            "value",
            "low_price",
            "high_price",
            "yesterday_price",
            "eps",
            "base_vol",
            "visitcount",
            "flow",
            "cs",
            "max_allowed",
            "min_allowed",
            "z",
            "yval",
            "predtran",
            "buyop",
            "cgrvalcot",
        ]
        item = dict(zip(keys, parts[:26]))
        numeric = {
            "heven",
            "pf",
            "closing_price",
            "last_price",
            "tno",
            "volume",
            "value",
            "low_price",
            "high_price",
            "yesterday_price",
            "eps",
            "base_vol",
            "visitcount",
            "flow",
            "max_allowed",
            "min_allowed",
            "z",
            "predtran",
            "buyop",
        }
        for key in numeric:
            item[key] = compact_number(item.get(key))
        item["id"] = str(item["id"])
        item["symbol"] = str(item["symbol"]).strip()
        item["company_name"] = str(item["company_name"]).strip()
        return item

    @staticmethod
    def parse_best_limits(text: str):
        output = {}
        for row in text.split(";"):
            if not row:
                continue
            parts = row.split(",")
            if len(parts) < 8:
                continue
            ins, level, zord_buy, zord_sell, bid, ask, bid_qty, ask_qty = parts[:8]
            try:
                level = int(level)
            except Exception:
                continue
            if level < 1 or level > 5:
                continue
            output.setdefault(str(ins), {})[level] = {
                "level": level,
                "buy_orders": compact_number(zord_buy),
                "sell_orders": compact_number(zord_sell),
                "bid_price": compact_number(bid),
                "ask_price": compact_number(ask),
                "bid_qty": compact_number(bid_qty),
                "ask_qty": compact_number(ask_qty),
            }
        return output

    def init(self):
        text = self.get_text("MarketWatchInit.aspx?h=0&r=0", timeout=30)
        parts = text.split("@")
        if len(parts) != 5:
            raise RuntimeError("MarketWatchInit invalid response")
        _, market_state, price_rows, best_rows, refid = parts
        prices = {}
        for row in price_rows.split(";"):
            if not row:
                continue
            item = self.parse_price(row)
            if item and item["id"] and item["symbol"]:
                prices[item["id"]] = item
        self.prices = prices
        self.best = self.parse_best_limits(best_rows)
        self.refid = int(number(refid))
        self.market_state = market_state
        self.heven = max((int(number(x.get("heven"))) for x in prices.values()), default=0)
        self.refresh_client_type(force=True)

    def plus(self):
        h = 5 * (int(self.heven) // 5)
        r = 25 * (int(self.refid) // 25)
        text = self.get_text(f"MarketWatchPlus.aspx?h={h}&r={r}", timeout=25)
        parts = text.split("@")
        if len(parts) != 5:
            raise RuntimeError("MarketWatchPlus invalid response")
        _, state, instruments, best_rows, new_refid = parts
        for row in instruments.split(";"):
            if not row:
                continue
            fields = row.split(",")
            if len(fields) == 10:
                ins = fields[0]
                if ins not in self.prices:
                    continue
                keys = [
                    "id",
                    "heven",
                    "pf",
                    "closing_price",
                    "last_price",
                    "tno",
                    "volume",
                    "value",
                    "low_price",
                    "high_price",
                ]
                for key, value in zip(keys, fields):
                    self.prices[ins][key] = value if key == "id" else compact_number(value)
            elif len(fields) >= 23:
                item = self.parse_price(row)
                if item:
                    self.prices[item["id"]] = item
        changed_best = self.parse_best_limits(best_rows)
        for ins, levels in changed_best.items():
            self.best.setdefault(ins, {}).update(levels)
        self.refid = int(number(new_refid, self.refid))
        self.market_state = state
        self.heven = max(
            (int(number(x.get("heven"))) for x in self.prices.values()),
            default=self.heven,
        )
        self.refresh_client_type()

    def refresh_client_type(self, force=False):
        if not force and time.time() - self.last_client_type_at < 120:
            return
        try:
            text = self.get_text("ClientTypeAll.aspx", timeout=25)
        except Exception as exc:
            print(f"client_type_refresh_failed: {exc}", flush=True)
            return
        output = {}
        for row in text.split(";"):
            if not row:
                continue
            parts = row.split(",")
            if len(parts) < 9:
                continue
            output[str(parts[0])] = {
                "individual_buy_count": compact_number(parts[1]),
                "corporate_buy_count": compact_number(parts[2]),
                "individual_buy_volume": compact_number(parts[3]),
                "corporate_buy_volume": compact_number(parts[4]),
                "individual_sell_count": compact_number(parts[5]),
                "corporate_sell_count": compact_number(parts[6]),
                "individual_sell_volume": compact_number(parts[7]),
                "corporate_sell_volume": compact_number(parts[8]),
            }
        self.client_type = output
        self.last_client_type_at = time.time()

    def payload(self, collector_id: str, stream_id: str, sequence: int):
        observed_at = int(time.time())
        rows = []
        for ins, price in self.prices.items():
            levels = self.best.get(ins, {})
            rows.append(
                {
                    "id": price.get("id"),
                    "isin": price.get("isin"),
                    "symbol": price.get("symbol"),
                    "company_name": price.get("company_name"),
                    "heven": price.get("heven"),
                    "closing_price": price.get("closing_price"),
                    "last_price": price.get("last_price"),
                    "tno": price.get("tno"),
                    "volume": price.get("volume"),
                    "value": price.get("value"),
                    "low_price": price.get("low_price"),
                    "high_price": price.get("high_price"),
                    "yesterday_price": price.get("yesterday_price"),
                    "min_allowed": price.get("min_allowed"),
                    "max_allowed": price.get("max_allowed"),
                    "flow": price.get("flow"),
                    "cs": price.get("cs"),
                    "pf": price.get("pf"),
                    "best_limits": [levels[k] for k in sorted(levels) if 1 <= k <= 5],
                    "client_type": self.client_type.get(ins),
                }
            )
        return {
            "protocol": PROTOCOL,
            "collector_id": collector_id,
            "stream_id": stream_id,
            "sequence": sequence,
            "observed_at": observed_at,
            "source": {
                "name": "TSETMC",
                "transport": "MarketWatchInit+MarketWatchPlus+ClientTypeAll",
                "base": self.base,
                "refid": self.refid,
                "market_state": self.market_state,
                "heven": self.heven,
            },
            "rows": rows,
        }


class CloudPush:
    def __init__(self, url: str, collector_id: str, stream_id: str, secret: str):
        self.url = url
        self.collector_id = collector_id
        self.stream_id = stream_id
        self.secret = secret

    def send(self, body: bytes, sequence: int, timeout: int = 30) -> dict:
        timestamp = int(time.time())
        nonce = secrets.token_hex(16)
        signature = signature_hex(
            self.secret,
            self.collector_id,
            self.stream_id,
            sequence,
            timestamp,
            nonce,
            body,
        )
        headers = {
            "User-Agent": UA,
            "Content-Type": "application/octet-stream",
            "X-SH-Encoding": "gzip",
            "X-SH-Protocol": PROTOCOL,
            "X-SH-Collector": self.collector_id,
            "X-SH-Stream": self.stream_id,
            "X-SH-Sequence": str(sequence),
            "X-SH-Timestamp": str(timestamp),
            "X-SH-Nonce": nonce,
            "X-SH-Signature": signature,
        }
        request = urllib.request.Request(self.url, data=body, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(
                request, timeout=timeout, context=ssl.create_default_context()
            ) as response:
                raw = response.read().decode("utf-8", "replace")
                return json.loads(raw) if raw else {"ok": True}
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", "replace")
            try:
                data = json.loads(raw)
            except Exception:
                data = {"error": raw}
            if (
                exc.code == 409
                and data.get("error") == "sequence_replay"
                and int(data.get("last_sequence", -1)) >= sequence
            ):
                return {"ok": True, "deduplicated": True}
            raise RuntimeError(f"cloud HTTP {exc.code}: {data}") from exc


def encode_payload(payload: dict) -> bytes:
    raw = json.dumps(
        payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return gzip.compress(raw, compresslevel=6, mtime=0)


def decode_payload(body: bytes) -> dict:
    return json.loads(gzip.decompress(body).decode("utf-8"))


def source_probe_summary(feed: TsetmcFeed) -> dict:
    rows = len(feed.prices)
    return {
        "ok": rows > 0,
        "probe": "tsetmc_source",
        "base": feed.base,
        "rows": rows,
        "client_type_rows": len(feed.client_type),
        "refid": int(feed.refid),
        "heven": int(feed.heven),
        "market_state": str(feed.market_state or ""),
    }


def market_window_open() -> bool:
    now = datetime.now(TEHRAN)
    if now.weekday() not in {0, 1, 2, 5, 6}:  # Mon-Wed + Sat-Sun
        return False
    minute = now.hour * 60 + now.minute
    return 8 * 60 + 15 <= minute <= 17 * 60 + 10


def flush_spool(state: PersistentState, cloud: CloudPush) -> bool:
    for path in state.spool_files():
        try:
            body = path.read_bytes()
            payload = decode_payload(body)
            sequence = int(payload["sequence"])
            cloud.send(body, sequence)
            path.unlink(missing_ok=True)
            print(f"spool_flushed sequence={sequence}", flush=True)
        except Exception as exc:
            print(f"spool_flush_blocked path={path.name} error={exc}", flush=True)
            return False
    return True


def capture_once(feed: TsetmcFeed, state: PersistentState, cloud: CloudPush, collector_id: str):
    if not feed.prices:
        feed.init()
    sequence = state.next_sequence()
    payload = feed.payload(collector_id, cloud.stream_id, sequence)
    body = encode_payload(payload)

    if state.spool_files() and not flush_spool(state, cloud):
        state.put_spool(sequence, body)
        return {"spooled": True, "sequence": sequence, "rows": len(payload["rows"])}

    try:
        result = cloud.send(body, sequence)
        return {
            "spooled": False,
            "sequence": sequence,
            "rows": len(payload["rows"]),
            "cloud": result,
        }
    except Exception as exc:
        state.put_spool(sequence, body)
        print(f"cloud_push_failed sequence={sequence} error={exc}", flush=True)
        return {"spooled": True, "sequence": sequence, "rows": len(payload["rows"])}


def self_test():
    body = b'{"hello":"world"}'
    expected_sha = "93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588"
    expected_signature = "12d01c804f06f283ebcfeffc52fab1cb5118e325e7268330571b3a275b2ee44d"
    assert sha256_hex(body) == expected_sha
    actual = signature_hex(
        "test-secret",
        "collector-test",
        "stream-test",
        42,
        1790272800,
        "nonce-abc",
        body,
    )
    assert actual == expected_signature, (actual, expected_signature)
    sample = {
        "protocol": PROTOCOL,
        "collector_id": "x",
        "stream_id": "y",
        "sequence": 1,
        "observed_at": 1,
        "source": {},
        "rows": [{"id": "1"}],
    }
    assert decode_payload(encode_payload(sample)) == sample
    fake = TsetmcFeed("https://example.invalid/")
    fake.prices = {"1": {"id": "1"}}
    fake.client_type = {"1": {}}
    fake.refid = 17
    fake.heven = 101530
    fake.market_state = "OPEN"
    summary = source_probe_summary(fake)
    assert summary["ok"] is True
    assert summary["rows"] == 1
    assert summary["client_type_rows"] == 1
    assert summary["refid"] == 17
    assert summary["heven"] == 101530
    print("collector-protocol-selftest: PASS")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument(
        "--source-probe",
        action="store_true",
        help="Probe TSETMC from this host without requiring or sending cloud credentials.",
    )
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    base = os.environ.get("STOCK_HUNTER_TSETMC_BASE", DEFAULT_BASE).strip()
    if args.source_probe:
        feed = TsetmcFeed(base)
        feed.init()
        summary = source_probe_summary(feed)
        print(json.dumps(summary, ensure_ascii=False), flush=True)
        if not summary["ok"]:
            raise SystemExit(4)
        return

    ingest_url = os.environ.get("STOCK_HUNTER_INGEST_URL", "").strip()
    secret = os.environ.get("STOCK_HUNTER_COLLECTOR_SECRET", "")
    if not ingest_url or not secret:
        raise SystemExit(
            "STOCK_HUNTER_INGEST_URL and STOCK_HUNTER_COLLECTOR_SECRET are required"
        )

    collector_id = os.environ.get("STOCK_HUNTER_COLLECTOR_ID", "iran-primary").strip()
    interval = max(15, int(os.environ.get("STOCK_HUNTER_INTERVAL_SECONDS", "30")))
    state_root = Path(
        os.environ.get(
            "STOCK_HUNTER_STATE_DIR",
            str(Path.home() / ".stock-hunter-iran-collector"),
        )
    )
    spool_max_bytes = int(
        os.environ.get("STOCK_HUNTER_SPOOL_MAX_BYTES", str(100 * 1024 * 1024))
    )
    spool_max_age = int(os.environ.get("STOCK_HUNTER_SPOOL_MAX_AGE_SECONDS", "3600"))

    state = PersistentState(state_root)
    stream_id = state.stream_id()
    cloud = CloudPush(ingest_url, collector_id, stream_id, secret)
    feed = TsetmcFeed(base)

    if args.once or not args.loop:
        feed.init()
        print(json.dumps(capture_once(feed, state, cloud, collector_id), ensure_ascii=False))
        state.enforce_spool_limits(spool_max_bytes, spool_max_age)
        return

    initialized = False
    while True:
        if not market_window_open():
            initialized = False
            state.enforce_spool_limits(spool_max_bytes, spool_max_age)
            time.sleep(60)
            continue

        started = time.time()
        try:
            if not initialized:
                feed.init()
                initialized = True
            else:
                try:
                    feed.plus()
                except Exception as exc:
                    print(f"market_plus_failed_reinit: {exc}", flush=True)
                    feed.init()
            result = capture_once(feed, state, cloud, collector_id)
            print(json.dumps(result, ensure_ascii=False), flush=True)
        except Exception as exc:
            initialized = False
            print(f"collector_iteration_failed: {exc}", flush=True)

        state.enforce_spool_limits(spool_max_bytes, spool_max_age)
        elapsed = time.time() - started
        time.sleep(max(1.0, interval - elapsed))


if __name__ == "__main__":
    main()
