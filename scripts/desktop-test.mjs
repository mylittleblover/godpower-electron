import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  electron = require("electron");
const temp = await mkdtemp(path.join(os.tmpdir(), "gp-desktop-test-"));
const artifact = path.resolve(
  process.env.DESKTOP_ARTIFACTS || "artifacts/electron-020",
);
await mkdir(artifact, { recursive: true });
const result = path.join(artifact, "results.json");
const args = [
  ".",
  `--desktop-test=${result}`,
  `--user-data-dir=${path.join(temp, "profile")}`,
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--force-device-scale-factor=1",
  "--ozone-override-screen-size=1920,1080",
];
const scenario = process.env.DESKTOP_SCENARIO || null;
if (scenario && !["hand","picker","effects","battle","ai","startup","research"].includes(scenario))
  throw Error("Unsupported desktop scenario: " + scenario);
if (scenario) args.push("--desktop-scenario=" + scenario);
if (
  process.platform === "linux" &&
  !process.env.DISPLAY &&
  !process.env.WAYLAND_DISPLAY
)
  args.push("--headless=new", "--ozone-platform=headless");
if (process.env.GP_TEST_INJECT_SETUP_FAILURE === "1")
  args.push("--desktop-test-inject-setup-failure");
const child = spawn(electron, args, { stdio: "inherit" });
const timer = setTimeout(() => child.kill("SIGKILL"), 180000);
try {
  const outcome = await new Promise((r, j) => {
    child.once("error", j);
    child.once("exit", (code, signal) => r({ code, signal }));
  });
  assert.equal(outcome.code, 0, JSON.stringify(outcome));
  const report = JSON.parse(await readFile(result, "utf8"));
  console.log(JSON.stringify(report, null, 2));
  assert.equal(report.status, "PASS");
  const expectedCount=scenario==='picker'?3:['hand','effects','battle','ai','startup','research'].includes(scenario)?1:26;
  assert.equal(report.results.length,expectedCount,'all requested scenarios must execute');
  if(scenario==='effects')assert.equal(report.results[0].name,'effect settings duration and native pointer skip');
  if (scenario==='picker')assert.deepEqual(report.results.map(r=>r.name),['individual','group','two_tier'].map(mode=>mode+' authoritative draw, continuous reel, overlay and score'));
  if(scenario==='ai')assert.equal(report.results[0].name,'OpenCode AI approval uses one classroom command and a private main-process broker');
  if (scenario==='hand')
    assert.equal(
      report.results[0].name,
      "the launcher offers picker or hand and the hand panel runs one classroom command",
    );
  assert.equal(
    new Set(report.results.map((row) => row.name)).size,
    expectedCount,
    "scenario results must be unique",
  );
} finally {
  clearTimeout(timer);
  if (child.exitCode === null) child.kill();
  await rm(temp, { recursive: true, force: true });
}
