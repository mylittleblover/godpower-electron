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
/* Item cinematics reuse the picker reveal surface: attacker on the left,
   defender on the right, one target per beat. The data is already sanitized. */
let itemTimer = null;
function presentItem(payload) {
  const item = payload.item,
    marx = payload.theme === "marx";
  document.body.classList.toggle("theme-marx", marx);
  document.body.dataset.theme = marx ? "marx" : "classic";
  stage.dataset.mode = "item";
  document.title = `${marx ? "马克思的力量" : "上帝的力量"} · 道具特效`;
  document.getElementById("mode").textContent = "ITEM CINEMATIC · 道具结算";
  document.getElementById("group").textContent = "发动方";
  document.getElementById("avatarFrame").hidden = true;
  document.getElementById("name").textContent = item.caster || "小组";
  document.getElementById("number").textContent = item.itemName;

  const iconWrap = document.getElementById("itemIcon");
  if (item.icon) {
    iconWrap.src = item.icon;
    iconWrap.hidden = false;
  } else iconWrap.hidden = true;

  const box = document.getElementById("itemTargets");
  box.hidden = false;
  const targets = item.targets,
    total = targets.length;
  const label = (target) =>
    target.blocked
      ? "防御成功"
      : target.delta
        ? `${target.delta > 0 ? "+" : ""}${target.delta} 分`
        : target.effectChanged
          ? "状态已施加"
          : item.key === "item_box"
            ? "获得道具"
            : "效果已结算";
  let index = 0;
  const beat = () => {
    if (!stage.classList.contains("active")) return;
    const target = targets[index++];
    box.innerHTML = `<strong>${escapeHtml(target.name)}</strong><p>${escapeHtml(label(target))}</p><small>${escapeHtml(target.status || "")}</small><em>${index} / ${total}</em>`;
    box.classList.remove("beat");
    void box.offsetWidth;
    box.classList.add("beat");
    itemTimer = setTimeout(
      index < total ? beat : exit,
      1500,
    );
  };
  stage.style.setProperty("--group", marx ? "#d6ad58" : "#71dbc1");
  stage.classList.add("active", payload.effects.style);
  exitTimer = setTimeout(exit, payload.effects.duration + 9000);
  beat();
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
api.onReveal((payload) => {
  if (id) return;
  id = payload.id;
  if (payload.kind === "item") {
    presentItem(payload);
    return;
  }
  const r = payload.result;
  const marx = payload.theme === "marx";
  document.body.classList.toggle("theme-marx", marx);
  document.body.dataset.theme = marx ? "marx" : "classic";
  stage.dataset.mode = r.mode;
  document.title = `${marx ? "马克思的力量" : "上帝的力量"} · 全屏揭晓`;
  document.getElementById("name").textContent = r.name;
  document.getElementById("group").textContent = r.groupName;
  const avatarFrame = document.getElementById("avatarFrame");
  const avatar = document.getElementById("avatar");
  if (
    typeof r.avatarDataUrl === "string" &&
    /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(r.avatarDataUrl) &&
    r.avatarDataUrl.length <= 180_000
  ) {
    avatar.src = r.avatarDataUrl;
    avatarFrame.hidden = false;
  } else {
    avatar.removeAttribute("src");
    avatarFrame.hidden = true;
  }
  document.getElementById("number").textContent =
    r.number !== null
      ? "学号 " + r.number
      : r.mode === "score"
        ? "实际积分调整"
        : r.mode === "group"
          ? "第 " + r.groupNo + " 小组"
          : "本次课堂之星";
  document.getElementById("mode").textContent = {
    score: "CLASSROOM SCORE · 积分展示",
    individual: "CLASSROOM SPOTLIGHT · 全班学生",
    group: "LUCKY TEAM · 小组揭晓",
    two_tier: "TEAM & STUDENT · 双层揭晓",
  }[r.mode];
  stage.style.setProperty("--group", marx && r.mode !== "score" ? "#d6ad58" : r.color);
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
