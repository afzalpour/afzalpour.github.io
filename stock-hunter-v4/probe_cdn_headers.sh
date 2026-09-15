#!/usr/bin/env bash
set -euo pipefail
URL='https://cdn.tsetmc.com/api/StaticData/GetTime'
echo 'Testing CDN with full browser headers...'
curl -4 -L --max-time 20 -sS -D /tmp/h.txt \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36' \
  -H 'Accept: application/json,text/plain,*/*' \
  -H 'Referer: https://www.tsetmc.com/' \
  -H 'Origin: https://www.tsetmc.com' \
  -H 'Connection: close' \
  "$URL" -o /tmp/b.txt || true
head -n 20 /tmp/h.txt || true
echo 'BODY:'
head -c 500 /tmp/b.txt || true
echo
