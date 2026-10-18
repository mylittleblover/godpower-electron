"use strict";
const api = window.godpowerDesktop,
  stage = document.getElementById("stage");
let id = null,
  exitTimer = null,
  finishTimer = null,
  leaving = false;
function exit() {
  if (!id || leaving) return;
  leaving = true;
  clearTimeout(exitTimer);
  stage.classList.add("leaving");
  finishTimer = setTimeout(() => api.finish(id), 680);
}
for (let n = 0; n < 24; n++) {
  const dot = document.createElement("i");
  dot.style.setProperty("--i", n);
  document.getElementById("particles").append(dot);
}
api.onReveal((payload) => {
  if (id) return;
  id = payload.id;
  const r = payload.result;
  document.getElementById("name").textContent = r.name;
  document.getElementById("group").textContent = r.groupName;
  document.getElementById("number").textContent =
    r.number !== null
      ? "学号 " + r.number
      : r.mode === "group"
        ? "第 " + r.groupNo + " 小组"
        : "本次课堂之星";
  document.getElementById("mode").textContent = {
    individual: "CLASSROOM SPOTLIGHT · 全班学生",
    group: "LUCKY TEAM · 小组揭晓",
    two_tier: "TEAM & STUDENT · 双层揭晓",
  }[r.mode];
  stage.style.setProperty("--group", r.color);
  stage.classList.add("active", payload.effects.style);
  exitTimer = setTimeout(exit, payload.effects.duration + 900);
});
const skip = document.getElementById("skip");
skip.addEventListener("mouseenter", () => {
  if (id) api.interactive(id, true);
});
skip.addEventListener("mouseleave", () => {
  if (id) api.interactive(id, false);
});
skip.addEventListener("click", exit);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") exit();
});
window.addEventListener("beforeunload", () => {
  clearTimeout(exitTimer);
  clearTimeout(finishTimer);
});
api.ready();
