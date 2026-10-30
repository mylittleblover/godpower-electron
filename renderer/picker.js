"use strict";
const api = window.godpowerDesktop,
  $ = (id) => document.getElementById(id);
let current = null,
  revision = -1,
  pending = false,
  lastSignature = "",
  lastGroups = "";
const errors = {
  BUSY: "抽选尚未完成，请稍候。",
  LOCKED: "课堂已锁定，请在主窗口解锁后赋分。",
  STALE_RESULT: "结果已变化，请重新确认目标。",
  MAIN_UNAVAILABLE: "主窗口未就绪，请打开或恢复主窗口。",
  COMMAND_TIMEOUT:
    "操作确认超时，请先检查主窗口。为避免重复赋分，不会自动重试。",
  STALE_EPOCH: "主窗口已刷新，请等待重新同步。",
  NOT_STARTED: "没有可抽选的候选人，请在主课堂检查名单。",
};
function message(text) {
  $("message").textContent = text || "";
}
async function run(action, payload = {}) {
  if (pending) return;
  pending = true;
  render(current);
  try {
    const r = await api.command(action, payload);
    message(
      r.ok
        ? r.persisted === false
          ? "更改尚未保存，请在主窗口导出备份。"
          : ""
        : errors[r.error] || r.error,
    );
    return r;
  } catch (e) {
    message(e.message);
  } finally {
    pending = false;
    render(current);
  }
}
function render(state) {
  if (!state || state.revision < revision) return;
  document.body.dataset.collapsed = String(state.shell.collapsed);
  current = state;
  revision = state.revision;
  const s = state.snapshot,
    ready = state.ready && !!s,
    busy = !ready || pending;
  const marx = s?.theme === "marx";
  document.body.dataset.theme = marx ? "marx" : "classic";
  document.body.classList.toggle("theme-marx", marx);
  $("pickerGlyph").textContent = marx ? "★" : "✦";
  $("brandGlyph").textContent = marx ? "★" : "✦";
  document.title = `课堂点名 · ${marx ? "马克思的力量" : "上帝的力量"}`;
  document.body.dataset.ready = ready;
  $("connection").textContent = ready
    ? "主课堂已连接 · 实时同步"
    : "主窗口未就绪 · 可点击恢复";
  $("pin").checked = state.shell.alwaysOnTop;
  $("effects").checked = state.shell.effectsEnabled;
  $("skip").disabled = !state.shell.effectActive;
  const displaySignature = JSON.stringify(state.shell.displays);
  if ($("display").dataset.signature !== displaySignature) {
    $("display").replaceChildren(
      ...state.shell.displays.map((d, i) => {
        const o = document.createElement("option");
        o.value = d.id;
        o.textContent = `${d.label || "显示器 " + (i + 1)} · ${d.bounds.width}×${d.bounds.height}`;
        return o;
      }),
    );
    $("display").dataset.signature = displaySignature;
  }
  $("display").value = state.shell.displayId;
  for (const b of document.querySelectorAll("[data-mode]")) {
    b.disabled =
      busy || ["rolling", "settling", "preparing"].includes(s?.phase);
    b.setAttribute("aria-pressed", String(b.dataset.mode === s?.mode));
  }
  if (!s) {
    $("lever").disabled = true;
    return;
  }
  const spinning = ["rolling", "preparing", "settling"].includes(s.phase);
  $("antiRepeat").checked = s.antiRepeat;
  $("antiRepeat").disabled = busy || spinning;
  $("resetPool").disabled = busy || spinning;
  $("remaining").textContent = s.remaining;
  $("cancel").disabled = busy || !spinning;
  $("lever").disabled = busy || ["preparing", "settling"].includes(s.phase);
  $("lever").setAttribute(
    "aria-label",
    s.phase === "rolling" ? "停止抽选" : "开始抽选",
  );
  $("phase").textContent = {
    idle: "准备就绪",
    preparing: "正在准备…",
    rolling: "抽选中 · 拉动拉杆停止",
    settling: "正在减速…",
    revealed: "抽取完成",
  }[s.phase];
  const machine = $("machine"),
    reel = $("reel"),
    changed = machine.dataset.phase !== s.phase;
  const reelName = (index) =>
    s.mode === "individual"
      ? s.preview.student || "课堂之星"
      : s.mode === "group"
        ? s.preview.group || "幸运小组"
        : (index % 2 ? s.preview.student : s.preview.group) || "课堂之星";
  if (changed && s.phase === "settling") {
    const result = s.result?.name || "揭晓中";
    [...reel.children].forEach((e, i) => {
      e.textContent = i === 4 ? result : reelName(i);
    });
  } else if (s.phase === "rolling") {
    [...reel.children].forEach((e, i) => (e.textContent = reelName(i)));
  } else if (s.phase === "idle")
    [...reel.children].forEach((e) => (e.textContent = "准备好了吗"));
  if (s.phase === "revealed")
    $("finalName").textContent = s.result?.name || "结果已失效";
  machine.dataset.phase = s.phase;
  $("resultGroup").textContent = s.result
    ? `${s.result.groupName}${s.result.number !== null ? " · 学号 " + s.result.number : ""}`
    : "让每一次回答都有闪光时刻";
  $("target").textContent = s.result
    ? s.locked
      ? `${s.result.groupName} · 课堂已锁定`
      : `${s.result.groupName} · 当前 ${s.result.score} 分`
    : "抽中后可用";
  $("unlockClassroom").hidden =
    !(s.locked && s.phase === "revealed" && !!s.result);
  const scoreDisabled = busy || s.phase !== "revealed" || !s.result || s.locked;
  if ($("slots").dataset.values !== JSON.stringify(s.slots)) {
    $("slots").replaceChildren(
      ...s.slots.map((delta) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = (delta > 0 ? "+" : "−") + Math.abs(delta);
        b.className = delta > 0 ? "positive" : "negative";
        b.addEventListener("click", () =>
          run("score", { delta, resultId: current.snapshot.result.id }),
        );
        return b;
      }),
    );
    $("slots").dataset.values = JSON.stringify(s.slots);
  }
  $("slots")
    .querySelectorAll("button")
    .forEach((b) => (b.disabled = scoreDisabled));
  $("customScore").querySelector("button").disabled = scoreDisabled;
  $("delta").disabled = scoreDisabled;
  $("preselection").hidden = s.mode !== "two_tier";
  const groupSignature = JSON.stringify([
    s.groups,
    s.preselectedGroupIds,
    spinning,
    pending,
  ]);
  if (groupSignature !== lastGroups) {
    lastGroups = groupSignature;
    $("groupChips").replaceChildren(
      ...s.groups
        .filter((g) => g.members > 0)
        .map((g) => {
          const b = document.createElement("button");
          b.textContent = g.name;
          b.setAttribute(
            "aria-pressed",
            String(s.preselectedGroupIds.includes(g.id)),
          );
          b.disabled = busy || spinning;
          b.addEventListener("click", () =>
            run("preselect", { groupId: g.id }),
          );
          return b;
        }),
    );
  }
  const signature = JSON.stringify(s.history);
  if (signature !== lastSignature) {
    lastSignature = signature;
    $("historyCount").textContent = `· ${s.history.length} 条`;
    $("history").replaceChildren(
      ...s.history
        .slice()
        .reverse()
        .map((h) => {
          const li = document.createElement("li"),
            time = document.createElement("small");
          time.textContent = new Date(h.time).toLocaleTimeString();
          li.append(time, document.createTextNode(h.text));
          return li;
        }),
    );
  }
  if (s.unsaved) message("课堂有尚未保存的更改，请在主窗口导出备份。");
}
document
  .querySelectorAll("[data-mode]")
  .forEach((b) =>
    b.addEventListener("click", () => run("mode", { mode: b.dataset.mode })),
  );
$("lever").addEventListener("click", () =>
  run(current?.snapshot?.phase === "rolling" ? "stop" : "start"),
);
$("antiRepeat").addEventListener("change", (e) =>
  run("antiRepeat", { enabled: e.target.checked }),
);
$("resetPool").addEventListener("click", () => {
  if (confirm("重置防重复奖池？已有点名历史会保留。")) run("resetPool");
});
$("cancel").addEventListener("click", () => run("cancel"));
$("customScore").addEventListener("submit", (e) => {
  e.preventDefault();
  const delta = Number($("delta").value);
  if (!Number.isSafeInteger(delta) || !delta) {
    message("请输入非零安全整数。");
    return;
  }
  run("score", { delta, resultId: current.snapshot.result.id });
});
for (const [id, action] of [
  ["showMain", "showMain"],
  ["skip", "skip"],
])
  $(id).addEventListener("click", () =>
    api.windowAction(action).catch((e) => message(e.message)),
  );
for (const [id, action] of [
  ["pin", "pin"],
  ["effects", "effects"],
  ["display", "display"],
])
  $(id).addEventListener("change", async (e) => {
    const r = await api.windowAction(
      action,
      id === "display" ? Number(e.target.value) : e.target.checked,
    );
    if (!r.ok) message("窗口设置仅在本次运行中生效，写入失败。");
  });
api.onState(render);
api
  .getState()
  .then(render)
  .catch((e) => message(e.message));

$("collapse").addEventListener("click", () => api.windowAction("collapse"));
$("unlockClassroom").addEventListener("click", async () => {
  const r = await api.windowAction("unlock");
  if (!r.ok) message("无法打开课堂解锁窗口，请检查主课堂状态。");
});
let iconPointer=null, iconMoveFrame=null, iconMovePoint=null;
const pointerPoint=e=>({x:e.screenX,y:e.screenY});
$("pickerIcon").addEventListener("pointerdown",e=>{
  if(e.button!==0||e.isPrimary===false)return;
  e.preventDefault();iconPointer=e.pointerId;
  e.currentTarget.setPointerCapture(e.pointerId);
  void api.windowAction("dragStart",pointerPoint(e));
});
$("pickerIcon").addEventListener("pointermove",e=>{
  if(e.pointerId!==iconPointer)return;
  e.preventDefault();iconMovePoint=pointerPoint(e);
  if(iconMoveFrame!==null)return;
  iconMoveFrame=requestAnimationFrame(()=>{iconMoveFrame=null;void api.windowAction("dragMove",iconMovePoint)});
});
function endIconPointer(e,cancelled=false){
  if(e.pointerId!==iconPointer)return;
  if(iconMoveFrame!==null)cancelAnimationFrame(iconMoveFrame);
  iconMoveFrame=null;iconPointer=null;
  void api.windowAction(cancelled?"dragCancel":"dragEnd",pointerPoint(e));
}
$("pickerIcon").addEventListener("pointerup",e=>endIconPointer(e));
$("pickerIcon").addEventListener("pointercancel",e=>endIconPointer(e,true));
$("pickerIcon").addEventListener("lostpointercapture",e=>endIconPointer(e,true));
$("pickerIcon").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    api.windowAction("expand");
  }
});
