#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cat main.go.b64.part01 main.go.b64.part02 main.go.b64.part03 main.go.b64.part04 main.go.b64.part05 | tr -d '\r\n' | base64 -d > main.go
actual="$(sha256sum main.go | awk '{print $1}')"
expected="697bdb914741a400c8108c53111e4366114e7a7bcc8040e21fb0517c98714883"
test "$actual" = "$expected" || { echo "main.go SHA-256 mismatch: $actual" >&2; rm -f main.go; exit 1; }
echo "reconstructed main.go sha256=$actual"
