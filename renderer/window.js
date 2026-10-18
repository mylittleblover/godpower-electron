"use strict";
const api = window.godpowerDesktop,
  mount = document.getElementById("mount");
let snapshot = null,
  lastCSS = "",
  inputSeq = 0;
let celebrationFrame = null;
function celebration(time) {
  celebrationFrame = null;
  const canvas = mount.querySelector("#confettiCanvas");
  if (!canvas || mount.inert || snapshot.motion === "off") return;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const ctx = canvas.getContext("2d");
  for (let n = 0; n < 80; n++) {
    const x = (n * 137.7 + Math.sin(time / 900 + n) * 22) % innerWidth,
      y = ((time * 0.13 + n * 79) % (innerHeight + 40)) - 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time / 900 + n);
    ctx.fillStyle = ["#49ad94", "#ef9b79", "#d4ba69", "#89b5cf"][n % 4];
    ctx.fillRect(-4, -3, 8, 6);
    ctx.restore();
  }
  celebrationFrame = requestAnimationFrame(celebration);
}
const edits = new Map(),
  passwords = new Map();
async function send(message) {
  if (!snapshot) return;
  if (["click", "keydown", "submit"].includes(message.type)) {
    const deadline = Date.now() + 2000;
    while (edits.size && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 15));
    if (edits.size) {
      document.title = "输入尚未同步，请稍后重试";
      return;
    }
  }
  try {
    const result = await api.dialogEvent({
      ...message,
      session: snapshot.session,
      version: snapshot.version,
    });
    if (result?.ok === false) document.title = "界面已更新，请再次确认操作";
  } catch {
    document.title = "连接已失效 · 请重新打开";
  }
}
function render(next) {
  if (!next) return;
  const first = !snapshot;
  snapshot = next;
  document.body.className = next.bodyClass || "";
  document.body.dataset.theme = document.body.classList.contains("theme-marx") ? "marx" : "classic";
  document.documentElement.dataset.theme = document.body.dataset.theme;
  document.body.dataset.motion = next.motion || "full";
  if (
    first &&
    next.motion !== "off" &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    mount.animate(
      [
        { opacity: 0, translate: "0 26px" },
        { opacity: 1, translate: "0 0" },
      ],
      { duration: 450, easing: "cubic-bezier(.16,1,.3,1)" },
    );
  if (next.css !== lastCSS) {
    document.getElementById("classroomStyle").textContent = next.css;
    lastCSS = next.css;
  }
  const focused = document.activeElement,
    token = focused?.dataset.remoteToken,
    selection =
      typeof focused?.selectionStart === "number"
        ? [focused.selectionStart, focused.selectionEnd]
        : null;
  const scroll = [...mount.querySelectorAll("[data-remote-token]")]
    .filter((e) => e.scrollTop || e.scrollLeft)
    .map((e) => [e.dataset.remoteToken, e.scrollTop, e.scrollLeft]);
  const doc = new DOMParser().parseFromString(next.html, "text/html");
  for (const el of doc.querySelectorAll("*")) {
    if (
      [
        "SCRIPT",
        "IFRAME",
        "OBJECT",
        "EMBED",
        "LINK",
        "META",
        "STYLE",
        "BASE",
      ].includes(el.localName.toUpperCase())
    ) {
      el.remove();
      continue;
    }
    for (const a of [...el.attributes])
      if (
        a.name.startsWith("on") ||
        a.name === "srcdoc" ||
        (["href", "src", "action", "formaction"].includes(a.name) &&
          !/^(data:image\/|blob:|#)/i.test(a.value))
      )
        el.removeAttribute(a.name);
  }
  mount.replaceChildren(...doc.body.children);
  for (const key of [...passwords.keys()])
    if (!mount.querySelector(`[data-remote-token="${key}"]`))
      passwords.delete(key);
  for (const [key, edit] of edits) {
    if (!mount.querySelector(`[data-remote-token="${key}"]`)) {
      edits.delete(key);
      continue;
    }
    if (
      next.acks?.[key]?.session === next.session &&
      next.acks[key].seq >= edit.seq
    ) {
      edits.delete(key);
      continue;
    }
    const e = mount.querySelector(`[data-remote-token="${key}"]`);
    if (e) e.value = edit.value;
  }
  for (const e of mount.querySelectorAll("input[type=password]")) {
    const key = e.dataset.remoteToken;
    if (e.dataset.passwordFilled === "true" || edits.has(key))
      e.value = passwords.get(key) || "";
    else passwords.delete(key);
  }
  for (const [key, top, left] of scroll) {
    const e = mount.querySelector(`[data-remote-token="${key}"]`);
    if (e) {
      e.scrollTop = top;
      e.scrollLeft = left;
    }
  }
  if (token) {
    const e = mount.querySelector(`[data-remote-token="${token}"]`);
    if (e) {
      e.focus({ preventScroll: true });
      if (selection)
        try {
          e.setSelectionRange(...selection);
        } catch {}
    }
  }
  document.title = next.title || "课堂工具";
  if (
    next.id === "grandModalOverlay" &&
    celebrationFrame === null &&
    next.motion !== "off"
  )
    celebrationFrame = requestAnimationFrame(celebration);
}
mount.addEventListener("click", (e) => {
  const el = e.target.closest("[data-remote-token]");
  if (!el) return;
  if (
    el.matches(
      "input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]),select,textarea,label",
    )
  )
    return;
  e.preventDefault();
  send({ type: "click", token: Number(el.dataset.remoteToken) });
});
for (const type of ["input", "change"])
  mount.addEventListener(type, async (e) => {
    const el = e.target;
    if (!el.dataset.remoteToken || el.matches("[type=checkbox],[type=radio]"))
      return;
    if (el.type === "file") {
      if (type !== "change") return;
      const files = await Promise.all(
        [...el.files].map(async (f) => ({
          name: f.name,
          type: f.type,
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      send({ type: "files", token: Number(el.dataset.remoteToken), files });
      return;
    }
    if (el.type === "password") passwords.set(el.dataset.remoteToken, el.value);
    const seq = ++inputSeq;
    edits.set(el.dataset.remoteToken, { seq, value: el.value });
    send({
      type,
      token: Number(el.dataset.remoteToken),
      value: el.value,
      inputSeq: seq,
    });
  });
mount.addEventListener("submit", (e) => {
  e.preventDefault();
  send({ type: "submit", token: Number(e.target.dataset.remoteToken) });
});
mount.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    send({ type: "close" });
  } else if (
    e.key === "Enter" &&
    e.target.dataset.remoteToken &&
    !e.target.closest("form") &&
    e.target.tagName !== "TEXTAREA" &&
    e.target.tagName !== "BUTTON"
  ) {
    e.preventDefault();
    send({
      type: "keydown",
      key: "Enter",
      token: Number(e.target.dataset.remoteToken),
    });
  }
});
api.onDialogLeave(() => {
  mount.inert = true;
  if (celebrationFrame !== null) {
    cancelAnimationFrame(celebrationFrame);
    celebrationFrame = null;
  }
  if (
    document.body.dataset.motion !== "off" &&
    !matchMedia("(prefers-reduced-motion:reduce)").matches
  )
    mount.animate(
      [
        { opacity: 1, translate: "0 0" },
        { opacity: 0, translate: "0 60px" },
      ],
      { duration: 300, easing: "cubic-bezier(.7,0,.84,0)", fill: "forwards" },
    );
});
api.onDialogState(render);
api
  .dialogReady()
  .then(render)
  .catch(() => {
    mount.textContent = "窗口已关闭，请重新打开。";
  });
