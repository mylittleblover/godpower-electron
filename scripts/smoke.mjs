import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electron = require("electron");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "godpower-electron-smoke-"));
const resultPath = path.join(tempDir, "result.json");
const args = [
  ".",
  `--smoke-test=${resultPath}`,
  `--user-data-dir=${path.join(tempDir, "profile")}`,
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
];
if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
  args.push("--headless=new", "--ozone-platform=headless");
}

const child = spawn(electron, args, { stdio: "inherit" });
try {
  const exit = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Electron smoke launch timed out after 60 seconds"));
    }, 60000);
    timeout.unref();
  });
  const outcome = await Promise.race([exit, timeoutPromise]);
  clearTimeout(timeout);
  assert.equal(outcome.code, 0, `Electron exited unexpectedly: ${JSON.stringify(outcome)}`);
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.status, "PASS");
  assert.equal(result.firstLoad.localStorage, "isolated-profile");
  assert.equal(result.secondLoad.storage, "isolated-profile");
  assert.equal(result.secondLoad.indexedDB, "isolated-profile");
  assert.equal(result.firstLoad.indexedDB, true);
} finally {
  if (!child.killed && child.exitCode === null) child.kill("SIGTERM");
  await rm(tempDir, { recursive: true, force: true });
}
