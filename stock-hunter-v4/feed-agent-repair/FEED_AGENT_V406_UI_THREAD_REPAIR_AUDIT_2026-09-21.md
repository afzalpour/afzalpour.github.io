# Stock Hunter Feed Agent v4.0.6 — UI Thread Repair Audit

Date: 2026-09-21
Status: PREPARED / CLIENT_SMOKE_PENDING

## Symptom

The user reports `Stock_Hunter_Feed_Agent_v4.0.5.exe` repeatedly enters Windows "Not Responding" after launch/click interaction, including after a full PC reboot.

Server-side Supabase/PostgREST availability was separately recovered and verified before this repair. The local Agent heartbeat remained stale at `2026-09-19 16:26:36.56+00`.

## Binary provenance

Input artifact:
- `Stock_Hunter_Feed_Agent_v4.0.5.exe`
- SHA-256: `09ef9015c6370192b684d81a018eaac50ce49c4c16fd2ccb2a318777e8909211`
- PE32+ Windows GUI x86-64
- Go 1.23.2
- module: `stockhunteragent`

Output artifact:
- `Stock_Hunter_Feed_Agent_v4.0.6.exe`
- SHA-256: `a43ccddce0f71df02ddeea1f1d0efcd77a79727dcec0506ec8dcf30454d1c458`

## Diagnosis

Reverse engineering of the stripped Go binary recovered the Win32 UI/message-loop functions and Go runtime symbols.

Relevant functions:
- `main.wndProc`
- `main.scanLoop`
- `main.main`
- `main.refreshAutoButton`
- `runtime.LockOSThread`

The application creates and drives a native Win32 UI but `main.main` did not pin its GUI goroutine to one OS thread before the message pump. Native Win32 window/message-queue ownership is thread-affine; Go goroutine migration can therefore destabilize message processing and is consistent with the observed UI hang.

The Agent's HTTP client already has a 25-second timeout and market/network work runs from `main.scanLoop`, so an unbounded synchronous HTTP call in the click handler was not found.

## Minimal repair

To preserve the exact v4.0.5 Feed/scoring implementation, the repair changes one existing valid no-argument/no-return Go callsite in `main.main`:

- PE file offset: `0x27E925`
- original call: `main.refreshAutoButton`
- repaired call: `runtime.LockOSThread`

The sacrificed call is only the initial cosmetic refresh of the autostart button text. Later `main.refreshAutoButton` calls remain present.

The embedded version marker changes once from `4.0.5` to `4.0.6`.

Total binary differences: 4 bytes.

## Preserved contracts

Verified unchanged in the output:
- local-ingest Supabase endpoint;
- `X-Feed-Key` caller-header contract;
- accepted credential bytes and therefore its server-matching SHA-256 digest;
- market data/scoring/feed serialization code;
- Go module/build characteristics.

The raw Feed credential is intentionally not stored in this audit or patch script.

## Reproducibility

`patch-v405-ui-thread.py`:
- refuses any input whose SHA-256 differs from the canonical v4.0.5 build;
- verifies the exact original callsite bytes;
- verifies a single v4.0.5 version marker;
- patches only the callsite and version marker;
- verifies the exact expected v4.0.6 SHA-256.

Local rebuild validation produced a byte-identical v4.0.6 output.

## Limitations

This is a minimal binary repair because the exact v4.0.5 source tree is not available in the canonical repository.

The lock is introduced immediately before the scan goroutine/message-pump phase, after initial Win32 control creation. This targets the observed interaction hang while avoiding arbitrary injected Go safepoints. A full source rebuild with `runtime.LockOSThread()` before any Win32 window creation remains the preferred next step only if v4.0.6 still hangs.

## Safety

This repair does not change:
- 4.1.6 Hunt formulas, thresholds, routing or lifecycle;
- 4.1.7 traffic;
- Supabase schema/state;
- Feed credential value;
- prospective/calibration/OOS data.

Client smoke remains required: terminate v4.0.5 fully, launch v4.0.6, verify responsive UI and confirm the server heartbeat advances with `agent_version=4.0.6`.
