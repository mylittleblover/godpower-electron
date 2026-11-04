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
for (let n = 0; n < 12; n++) {
  const dot = document.createElement("i");
  dot.style.setProperty("--i", n);
  document.getElementById("particles").append(dot);
}
/* Item cinematics reuse the picker reveal surface: attacker on the left,
   defender on the right, one target per beat. The data is already sanitized. */
let itemTimer = null;
function reportSkipRegion() {
  const button = document.getElementById("skip");
  if (!id || button.hidden) return;
  const r = button.getBoundingClientRect();
  api.interactive(id, false, {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
  });
}
function presentItem(payload) {
  const item = payload.item,
    marx = payload.theme === "marx";
  document.body.classList.toggle("theme-marx", marx);
  document.body.dataset.theme = marx ? "marx" : "classic";
  stage.dataset.mode = "item";
  document.title = `${marx ? "马克思的力量" : "上帝的力量"} · 道具特效`;
  document.getElementById("mode").textContent = "ITEM CINEMATIC · 道具结算";
  document.getElementById("group").textContent = "发动方";
  const casterAvatar = document.getElementById("avatar");
  casterAvatar.removeAttribute("src");
  if (item.casterAvatarDataUrl) casterAvatar.src = item.casterAvatarDataUrl;
  document.getElementById("avatarFrame").hidden = !item.casterAvatarDataUrl;
  // The caster arrives as a {id,name} DTO from the classroom.
  const caster = item.caster;
  document.getElementById("name").textContent =
    (caster && typeof caster === "object" ? caster.name : caster) || "小组";
  document.getElementById("number").textContent =
    item.itemName || item.name || "";

  const iconWrap = document.getElementById("itemIcon");
  if (item.icon) {
    iconWrap.src = item.icon;
    iconWrap.hidden = false;
  } else iconWrap.hidden = true;

  const box = document.getElementById("itemTargets");
  box.hidden = false;
  // Every affected group is listed at once, so a wide effect reads as one wave
  // instead of a queue the teacher has to sit through.
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
  const listClass = total > 6 ? "item-targets wide" : "item-targets";
  box.className = listClass;
  // Tiles spread flat; the column count is chosen so the whole spread stays on
  // one screen instead of scrolling.
  const columns = total <= 1 ? 1 : total <= 4 ? 2 : total <= 9 ? 3 : 4;
  box.style.setProperty("--columns", columns);
  box.innerHTML =
    `<div class="item-targets-head">影响 ${total} 个小组</div>` +
    `<ul class="item-target-list">${targets
      .map(
        (target, i) =>
          `<li style="--i:${i}">${target.avatarDataUrl ? `<img class="item-target-avatar" src="${escapeHtml(target.avatarDataUrl)}" alt="小组头像">` : ""}<strong>${escapeHtml(target.name)}</strong>` +
          `<span>${escapeHtml(label(target))}</span>` +
          (target.status ? `<small>${escapeHtml(target.status)}</small>` : "") +
          `</li>`,
      )
      .join("")}</ul>`;
  stage.style.setProperty("--group", marx ? "#d6ad58" : "#71dbc1");
  stage.style.setProperty("--target-count", total);
  stage.classList.add("active", payload.effects.style);
  exitTimer = setTimeout(exit, payload.effects.duration);
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
  if (payload.kind === "hand") {
    document.body.classList.toggle("theme-marx", payload.theme === "marx");
    document.body.dataset.theme = payload.theme === "marx" ? "marx" : "classic";
    if (id && id !== payload.id) return;
    id = payload.id;
    clearTimeout(exitTimer);
    for (const selector of [".reveal", ".halo", "#particles", "#skip"])
      for (const node of document.querySelectorAll(selector))
        node.hidden = true;
    window.HandCards.render(payload, exit);
    return;
  }
  if (id) return;
  id = payload.id;
  if (payload.kind === "item") {
    presentItem(payload);
    reportSkipRegion();
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
  const personal = r.mode === "individual" || r.mode === "two_tier";
  document.getElementById("group").hidden = personal;
  const identity = document.getElementById("groupIdentity"),
    groupAvatar = document.getElementById("groupAvatar");
  identity.hidden = !personal || !r.groupName;
  document.getElementById("groupName").textContent = r.groupName || "";
  groupAvatar.hidden = !r.groupAvatarDataUrl;
  groupAvatar.removeAttribute("src");
  if (r.groupAvatarDataUrl) groupAvatar.src = r.groupAvatarDataUrl;
  groupAvatar.onerror = () => {
    groupAvatar.hidden = true;
    groupAvatar.removeAttribute("src");
  };
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
  stage.style.setProperty(
    "--group",
    marx && r.mode !== "score" ? "#d6ad58" : r.color,
  );
  stage.classList.add("active", payload.effects.style);
  exitTimer = setTimeout(exit, payload.effects.duration);
  reportSkipRegion();
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
window.addEventListener("resize", reportSkipRegion);
api.ready();
