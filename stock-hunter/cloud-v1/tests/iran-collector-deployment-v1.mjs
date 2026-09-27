import fs from "node:fs";
import {spawnSync} from "node:child_process";

const root="../iran-collector";
const collector=fs.readFileSync(`${root}/collector.py`,"utf8");
const installer=fs.readFileSync(`${root}/install-systemd.sh`,"utf8");
const activator=fs.readFileSync(`${root}/activate-systemd.py`,"utf8");
const docker=fs.readFileSync(`${root}/Dockerfile`,"utf8");
const compose=fs.readFileSync(`${root}/compose.example.yml`,"utf8");
const service=fs.readFileSync(`${root}/stock-hunter-collector.service.example`,"utf8");

if(!collector.includes("--source-probe"))throw new Error("source_probe_missing");
if(!collector.includes("source_probe_summary"))throw new Error("source_probe_summary_missing");
if(!installer.includes("intentionally NOT STARTED"))throw new Error("installer_fail_closed_notice_missing");
if(/systemctl\s+(?:start|restart)\s+stock-hunter-collector/.test(installer))throw new Error("installer_starts_service");
if(!activator.includes('["--source-probe"]'))throw new Error("activation_source_probe_missing");
if(!activator.includes('["--once"]'))throw new Error("activation_once_missing");
if(!activator.includes('"systemctl", "restart"'))throw new Error("activation_start_missing");
if(!docker.includes('VOLUME ["/var/lib/stock-hunter-collector"]'))throw new Error("docker_state_volume_missing");
if(!docker.includes("USER stockhunter"))throw new Error("docker_nonroot_missing");
if(!compose.includes("stock_hunter_collector_state"))throw new Error("compose_persistent_volume_missing");
if(!service.includes("NoNewPrivileges=true"))throw new Error("systemd_hardening_missing");

const bash=spawnSync("bash",["-n",`${root}/install-systemd.sh`],{encoding:"utf8"});
if(bash.status!==0)throw new Error(bash.stderr||"installer_shell_syntax_failed");
const py=spawnSync("python3",["-m","py_compile",`${root}/collector.py`,`${root}/activate-systemd.py`],{encoding:"utf8"});
if(py.status!==0)throw new Error(py.stderr||"python_compile_failed");

console.log("iran-collector-deployment-v1: PASS");
