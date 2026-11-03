"use strict";
// Same real temporary-disk workload, old/new/ new/old to expose order effects.
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const { SaveFile: Current } = require("../desktop/save-file.cjs");
const oldModule = { exports: {} };
vm.runInNewContext(
  execFileSync("git", ["show", "c03be48:desktop/save-file.cjs"], {
    encoding: "utf8",
  }),
  { require, module: oldModule, Buffer },
);
const Baseline = oldModule.exports.SaveFile;
(async () => {
  const results = [];
  for (const variant of ["baseline", "after", "after", "baseline"]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gp-io-perf-"));
    const file = new (variant === "baseline" ? Baseline : Current)({
      root: dir,
    });
    let timer;
    try {
      await file.write({ warmup: true });
      let last = performance.now(),
        maxGap = 0,
        ticks = 0;
      timer = setInterval(() => {
        const now = performance.now();
        maxGap = Math.max(maxGap, now - last);
        last = now;
        ticks++;
      }, 1);
      const start = performance.now();
      for (let i = 0; i < 8; i++)
        assert.equal(
          (
            await file.write({
              schemaVersion: 2,
              sequence: i,
              pad: "x".repeat(1024 * 1024),
            })
          ).ok,
          true,
        );
      maxGap = Math.max(maxGap, performance.now() - last);
      results.push({
        variant,
        writes: 8,
        payloadMiB: 1,
        durationMs: performance.now() - start,
        heartbeatTicksDuringWrites: ticks,
        maxEventLoopGapMs: maxGap,
      });
      assert.equal(file.read().data.sequence, 7);
    } finally {
      clearInterval(timer);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  fs.mkdirSync("artifacts/performance-3.0.68", { recursive: true });
  fs.writeFileSync(
    "artifacts/performance-3.0.68/save-performance.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
