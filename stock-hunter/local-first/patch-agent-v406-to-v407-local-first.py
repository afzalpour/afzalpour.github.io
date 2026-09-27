#!/usr/bin/env python3
from pathlib import Path
import hashlib, struct, sys

SRC_SHA = "a43ccddce0f71df02ddeea1f1d0efcd77a79727dcec0506ec8dcf30454d1c458"
OUT_SHA = "eaea31f3796c112524ba026efb48137494da488d62388a863e110e3a30abe88d"
OLD = b"https://summnepwuziwulzvpcms.supabase.co/functions/v1/stock-hunter-local-ingest-v4"
NEW = b"http://127.0.0.1:41716/ingest"
OLDVER, NEWVER = b"4.0.6", b"4.0.7"
ENDPOINT_OFF = 0x31454C
LEN_INSTR_OFF = 0x27C3CA
EXPECTED_INSTR = bytes.fromhex("41 b8 52 00 00 00")

if len(sys.argv) != 3:
    raise SystemExit("usage: patch-agent-v406-to-v407-local-first.py INPUT_v4.0.6.exe OUTPUT_v4.0.7.exe")

src, out = map(Path, sys.argv[1:])
raw = src.read_bytes()
if hashlib.sha256(raw).hexdigest() != SRC_SHA:
    raise SystemExit("refusing: input SHA-256 is not canonical v4.0.6")
b = bytearray(raw)
if b[ENDPOINT_OFF:ENDPOINT_OFF+len(OLD)] != OLD:
    raise SystemExit("refusing: endpoint bytes do not match")
if b[LEN_INSTR_OFF:LEN_INSTR_OFF+6] != EXPECTED_INSTR:
    raise SystemExit("refusing: Go string length instruction does not match")
if b.count(OLDVER) != 1:
    raise SystemExit("refusing: version marker is not unique")

b[ENDPOINT_OFF:ENDPOINT_OFF+len(NEW)] = NEW
b[LEN_INSTR_OFF+2:LEN_INSTR_OFF+6] = struct.pack("<I", len(NEW))
voff = b.find(OLDVER)
b[voff:voff+len(NEWVER)] = NEWVER
out.write_bytes(b)
actual = hashlib.sha256(out.read_bytes()).hexdigest()
if actual != OUT_SHA:
    out.unlink(missing_ok=True)
    raise SystemExit(f"output hash mismatch: {actual}")
print(actual)
