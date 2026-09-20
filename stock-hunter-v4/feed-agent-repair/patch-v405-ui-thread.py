#!/usr/bin/env python3
"""Reproducibly patch Stock_Hunter_Feed_Agent v4.0.5 -> v4.0.6.

Scope: pin the native Win32 GUI goroutine to its OS thread by retargeting one
existing no-arg/no-return startup callsite to runtime.LockOSThread, then update
only the embedded version string. No Feed credential or endpoint bytes are
changed by this script.
"""
from __future__ import annotations

import hashlib
import pathlib
import sys

SOURCE_SHA256 = "09ef9015c6370192b684d81a018eaac50ce49c4c16fd2ccb2a318777e8909211"
OUTPUT_SHA256 = "a43ccddce0f71df02ddeea1f1d0efcd77a79727dcec0506ec8dcf30454d1c458"
CALL_OFFSET = 0x27E925
ORIGINAL_CALL = bytes.fromhex("e876f2ffff")  # call main.refreshAutoButton
PATCHED_CALL = bytes.fromhex("e8b64adcff")   # call runtime.LockOSThread
OLD_VERSION = b"4.0.5"
NEW_VERSION = b"4.0.6"

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def main() -> int:
    if len(sys.argv) not in (2, 3):
        print(f"usage: {pathlib.Path(sys.argv[0]).name} INPUT_v4.0.5.exe [OUTPUT_v4.0.6.exe]", file=sys.stderr)
        return 2

    src = pathlib.Path(sys.argv[1])
    dst = pathlib.Path(sys.argv[2]) if len(sys.argv) == 3 else src.with_name("Stock_Hunter_Feed_Agent_v4.0.6.exe")
    blob = bytearray(src.read_bytes())

    actual = sha256(blob)
    if actual != SOURCE_SHA256:
        raise SystemExit(f"refusing to patch unexpected input: sha256={actual}")

    if blob[CALL_OFFSET:CALL_OFFSET + 5] != ORIGINAL_CALL:
        raise SystemExit("refusing to patch: startup callsite bytes do not match v4.0.5")

    if blob.count(OLD_VERSION) != 1 or blob.count(NEW_VERSION) != 0:
        raise SystemExit("refusing to patch: embedded version marker is not the expected single v4.0.5 occurrence")

    blob[CALL_OFFSET:CALL_OFFSET + 5] = PATCHED_CALL
    version_offset = blob.index(OLD_VERSION)
    blob[version_offset:version_offset + len(OLD_VERSION)] = NEW_VERSION

    actual_out = sha256(blob)
    if actual_out != OUTPUT_SHA256:
        raise SystemExit(f"patched output checksum mismatch: sha256={actual_out}")

    dst.write_bytes(blob)
    print(f"wrote {dst}")
    print(f"sha256 {actual_out}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
