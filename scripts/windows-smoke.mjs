import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const artifact = path.resolve("artifacts/windows-native");
await mkdir(artifact, { recursive: true });
if (process.platform !== "win32") {
  await writeFile(
    path.join(artifact, "results.json"),
    JSON.stringify(
      {
        status: "NOT TESTED",
        reason:
          "Requires a real Windows host and GODPOWER_WINDOWS_EXE pointing to the unpacked application executable.",
      },
      null,
      2,
    ),
  );
  console.log("NOT TESTED: native Windows executable test requires Windows.");
  process.exit(2);
}
const exe = process.env.GODPOWER_WINDOWS_EXE;
if (!exe)
  throw Error("Set GODPOWER_WINDOWS_EXE to the unpacked 上帝的力量.exe");
const { _electron } = await import("playwright");
const profile = await mkdtemp(path.join(os.tmpdir(), "godpower-win-020-"));
let app;
const results = [];
try {
  app = await _electron.launch({
    executablePath: path.resolve(exe),
    args: [`--user-data-dir=${profile}`],
    timeout: 30000,
  });
  const main = await app.firstWindow();
  await main.waitForFunction(() => window.GodpowerPicker);
  await main.evaluate(() => {
    document.getElementById("gpIntroSkip")?.click();
    closeWelcomeModal();
    state.isLocked = false;
    state.soundEnabled = false;
    ClassroomFeedback.setOptions({
      pickEffects: true,
      scoreEffects: false,
      duration: 1200,
    });
    state.groups = normalizeAllGroups(
      Array.from({ length: 14 }, (_, i) => ({
        id: i + 1,
        name: "Windows 测试 " + (i + 1),
        color: "#0f766e",
        score: 0,
        members: ["01 学生甲", "02 学生乙"],
      })),
    );
    renderAll();
    saveState();
  });
  const opened = app.waitForEvent("window");
  await main.evaluate(() => godpowerDesktop.openPicker());
  const picker = await opened;
  await picker.waitForFunction(() => current?.ready);
  for (const mode of ["individual", "group", "two_tier"]) {
    await picker.evaluate(
      (mode) => godpowerDesktop.command("mode", { mode }),
      mode,
    );
    await picker.getByLabel("开始抽选", { exact: true }).click();
    await picker.locator('#machine[data-phase="rolling"]').waitFor();
    const overlayEvent = app.waitForEvent("window");
    await picker.getByLabel("停止抽选", { exact: true }).click();
    const overlay = await overlayEvent;
    await overlay.waitForFunction(() =>
      document.getElementById("stage")?.classList.contains("active"),
    );
    const snap = await picker.evaluate(() => current.snapshot);
    assert.equal(
      await overlay.locator("#name").textContent(),
      snap.result.name,
    );
    await overlay.waitForTimeout(1100);
    await overlay.screenshot({
      path: path.join(artifact, `effect-${mode}.png`),
    });
    await picker.evaluate(() => godpowerDesktop.windowAction("skip"));
    const response = await picker.evaluate(
      (id) => godpowerDesktop.command("score", { resultId: id, delta: 5 }),
      snap.result.id,
    );
    assert.equal(response.ok, true);
    assert.equal(
      await main.evaluate(
        (id) => state.groups.find((g) => g.id === id).score,
        snap.result.groupId,
      ),
      snap.result.score + 5,
    );
    results.push({ mode, status: "PASS" });
  }
  await picker.screenshot({ path: path.join(artifact, "picker.png") });
  assert.equal(await picker.evaluate(() => typeof require), "undefined");
  await writeFile(
    path.join(artifact, "results.json"),
    JSON.stringify({ status: "PASS", results }, null, 2),
  );
} catch (e) {
  await writeFile(
    path.join(artifact, "results.json"),
    JSON.stringify({ status: "FAIL", results, error: e.stack }, null, 2),
  );
  throw e;
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}
