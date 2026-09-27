# Stock Hunter Eco Desktop v4.1.0 — Local GitHub Pages Audit

Date: 2026-09-25  
Status: BUILT / SOURCE-VERIFIED / WINDOWS LIVE SMOKE PENDING

## Decision

The required fixed-Iran-IP / persistent Iran VPS path is no longer the primary production prerequisite.

The primary day-to-day architecture is:

```text
TSETMC
  -> Stock_Hunter_Eco_Bridge_v4.0.8.exe on the owner's Windows PC
  -> loopback REST http://127.0.0.1:41716
  -> public GitHub Pages browser
  -> frozen Hunt 4.1.6
```

GitHub hosts the application UI. Live market data stays on the owner's computer and is read by that browser session through loopback. No GitHub token, static Iranian IP, Cloudflare credential, or VPS is required for this primary path.

## New controller

New launcher/supervisor:

`Stock_Hunter_Eco_Desktop_v4.1.0.exe`

Controller version: `4.1.0-local-github`.

It does not reimplement market acquisition or Hunt scoring. It supervises the already validated Eco components:

- active engine: `Stock_Hunter_Eco_Bridge_v4.0.8.exe`
  - SHA-256: `0b80d20a349ca5d92acb7c61f4f23ab6a4dd747f33b1509f2fdf3d6f40abb8b4`
- off-hours cache-only bridge: `Stock_Hunter_Eco_Passive_Bridge_v4.0.9.exe`
  - SHA-256: `12c286f9dfc4908aa495e9227594d7b4ac15a3ee34235f48010df452ebf6ebf1`

The controller refuses to start if either child hash differs.

## Resource controls

- market window: Saturday-Wednesday 08:20-17:05 Tehran;
- active Eco only inside that window;
- passive cache-only bridge outside that window;
- child `GOMAXPROCS=2`;
- Windows child priority: BelowNormal;
- local engine health check every 15 seconds;
- automatic restart after 3 consecutive health failures;
- bounded exponential restart backoff: 5 to 60 seconds;
- bounded controller and engine logs: 10 MiB with three rotations;
- older Agent/Bridge processes are terminated before mode transitions;
- GitHub Pages reachability check every 5 minutes;
- controller status endpoint: `http://127.0.0.1:41717/`.

## Package

Delivery ZIP:

`Stock_Hunter_Eco_Desktop_v4.1.0.zip`

SHA-256:

`5fb211eac296d46148edbddcf461a6e221ed63894527ea11a3bc1d0ba6b9f7dc`

Controller EXE SHA-256:

`3a9dbc52f9732a2d6aa57b61e945bceeaa6850a9f80a422ded429a50f729ac6b`

Controller source `main.go` SHA-256:

`697bdb914741a400c8108c53111e4366114e7a7bcc8040e21fb0517c98714883`

The exact source is stored as five base64 source parts in `local-first/eco-desktop-v410/`; `reconstruct-main.sh` reconstructs and hash-verifies the original `main.go` before CI.

## Verification

Completed before delivery:

- `go test ./...`: PASS;
- Linux controller `--self-test`: PASS;
- Windows amd64 cross-compile: PASS;
- package child SHA locks: PASS;
- final ZIP checksum: PASS;
- shutdown double-`Wait` race found during review and repaired before the final package hash;\n- a GitHub-only market-window test registration typo was then caught by CI, corrected, and the delivery ZIP was rebuilt with the corrected source test while preserving identical controller EXE bytes.

The Linux build environment cannot execute a Windows PE against the owner's real TSETMC/network/browser environment. The first actual Windows run is therefore an operational live smoke, not a missing implementation step.

## Frozen-model safety

Unchanged:

- production Champion: 4.1.6;
- frozen engine: `4.1.6-hunt-v2`;
- Hunt formulas and thresholds;
- Objective A/B;
- Action Now -> Radar -> Universe;
- browser freshness gate;
- lifecycle/OOS/promotion state.

Cloudflare/Iran-egress remains an optional parked architecture, not a prerequisite for normal use.
