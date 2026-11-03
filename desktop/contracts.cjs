"use strict";
const URLS = Object.freeze({
  main: "classroom://app/index.html",
  picker: "classroom://picker/index.html",
  effect: "classroom://effect/index.html",
});
/* Ten distinct reveal presentations. The host picks one per reveal at random;
   the renderer maps each to a pure-CSS layer. */
const EFFECT_STYLES = Object.freeze([
  "aurora",
  "burst",
  "ripple",
  "starlight",
  "spotlight",
  "confetti",
  "vortex",
  "prism",
  "bloom",
  "comet",
]);
function pickEffectStyle(requested, random = Math.random) {
  if (EFFECT_STYLES.includes(requested)) return requested;
  return EFFECT_STYLES[Math.floor(random() * EFFECT_STYLES.length)];
}
const modes = ["individual", "group", "two_tier"],
  phases = ["idle", "preparing", "rolling", "settling", "revealed"];
const text = (v, max = 500) => {
  if (typeof v !== "string" || v.length > max) throw Error("INVALID_TEXT");
  return v;
};
const integer = (v) => {
  if (!Number.isSafeInteger(v)) throw Error("INVALID_INTEGER");
  return v;
};
const color = (v) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#0f766e";
function authorize(event, win, url) {
  return (
    !!win &&
    !win.isDestroyed() &&
    event.sender === win.webContents &&
    event.senderFrame === event.sender.mainFrame &&
    event.senderFrame.url === url
  );
}
function validateCommand(action, p = {}) {
  if (!p || typeof p !== "object" || Array.isArray(p))
    throw Error("INVALID_PAYLOAD");
  const fields = {
    start: [],
    stop: [],
    cancel: [],
    mode: ["mode"],
    antiRepeat: ["enabled"],
    preselect: ["groupId"],
    resetPool: [],
    score: ["delta", "resultId"],
    handSelect: ["groupId"],
    handJudge: ["groupId", "selectionId", "correct"],
    handScore: ["groupId", "selectionId", "delta"],
    handDraw: ["groupId", "selectionId"],
    handUse: ["groupId", "selectionId"],
    handCancel: ["groupId", "selectionId"],
  }[action];
  if (
    !fields ||
    Object.keys(p).some((k) => !fields.includes(k)) ||
    Object.keys(p).length !== fields.length
  )
    throw Error("INVALID_COMMAND");
  if (action === "mode" && !modes.includes(p.mode)) throw Error("INVALID_MODE");
  if (action === "antiRepeat" && typeof p.enabled !== "boolean")
    throw Error("INVALID_BOOLEAN");
  if (action === "preselect") integer(p.groupId);
  if (action === "handSelect") integer(p.groupId);
  if (
    action === "handJudge" ||
    action === "handScore" ||
    action === "handDraw" ||
    action === "handUse" ||
    action === "handCancel"
  ) {
    integer(p.groupId);
    text(p.selectionId, 120);
    if (action === "handJudge" && typeof p.correct !== "boolean")
      throw Error("INVALID_BOOLEAN");
    if (action === "handScore") {
      integer(p.delta);
      if (!p.delta) throw Error("INVALID_SCORE");
    }
  }
  if (action === "score") {
    integer(p.delta);
    if (!p.delta) throw Error("INVALID_SCORE");
    text(p.resultId, 120);
  }
  return Object.fromEntries(fields.map((k) => [k, p[k]]));
}
function avatarDataUrl(value) {
  return typeof value === "string" &&
    value.length <= 180000 &&
    /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value)
    ? value
    : "";
}
function sanitizeSnapshot(s) {
  if (
    !s ||
    s.protocolVersion !== 1 ||
    !phases.includes(s.phase) ||
    !modes.includes(s.mode) ||
    !Array.isArray(s.groups) ||
    s.groups.length > 1000 ||
    !Array.isArray(s.slots) ||
    s.slots.length !== 6 ||
    !Array.isArray(s.history) ||
    s.history.length > 30
  )
    throw Error("INVALID_SNAPSHOT");
  let saveContext = null;
  if (s.saveContext != null) {
    if (
      typeof s.saveContext.saveId !== "string" ||
      !/^save-[A-Za-z0-9_-]{1,96}$/.test(s.saveContext.saveId) ||
      !Number.isSafeInteger(s.saveContext.generation) ||
      s.saveContext.generation < 0
    )
      throw Error("INVALID_SAVE_CONTEXT");
    saveContext = {
      saveId: s.saveContext.saveId,
      generation: s.saveContext.generation,
    };
  }
  const groups = s.groups.map((g) => ({
    id: integer(g.id),
    name: text(g.name),
    color: color(g.color),
    members: integer(g.members),
    score: integer(g.score),
  }));
  let result = null;
  if (s.result) {
    const r = s.result;
    if (!groups.some((g) => g.id === r.groupId) || !modes.includes(r.mode))
      throw Error("INVALID_RESULT");
    result = {
      id: text(r.id, 120),
      mode: r.mode,
      groupId: integer(r.groupId),
      groupName: text(r.groupName),
      groupNo: integer(r.groupNo),
      color: color(r.color),
      score: integer(r.score),
      name: text(r.name),
      number: r.number == null ? null : text(String(r.number), 40),
      memberName: r.memberName == null ? null : text(r.memberName),
      avatarDataUrl:
        typeof r.avatarDataUrl === "string" &&
        r.avatarDataUrl.length <= 180_000 &&
        /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(r.avatarDataUrl)
          ? r.avatarDataUrl
          : "",
    };
  }
  const effects = s.effects || {};
  const hand = s.hand || {};
  const handGroupId =
    Number.isSafeInteger(hand.groupId) &&
    groups.some((g) => g.id === hand.groupId)
      ? hand.groupId
      : null;
  return {
    protocolVersion: 1,
    saveContext,
    theme: s.theme === "marx" ? "marx" : "classic",
    phase: s.phase,
    mode: s.mode,
    antiRepeat: !!s.antiRepeat,
    preselectedGroupIds: (Array.isArray(s.preselectedGroupIds)
      ? s.preselectedGroupIds
      : []
    ).filter((x) => Number.isSafeInteger(x) && groups.some((g) => g.id === x)),
    remaining: text(s.remaining || ""),
    preview: {
      group: text(s.preview?.group || ""),
      student: text(s.preview?.student || ""),
    },
    groups,
    result,
    hand: {
      selectionId:
        handGroupId !== null ? text(hand.selectionId || "", 120) : null,
      groupId: handGroupId,
      correct: typeof hand.correct === "boolean" ? hand.correct : null,
      phase: [
        "CLOSED",
        "SELECT_GROUP",
        "JUDGE",
        "REWARD_CHOICE",
        "SCORE",
        "DRAW",
        "USE",
      ].includes(hand.phase)
        ? hand.phase
        : handGroupId === null
          ? "CLOSED"
          : hand.correct === true
            ? "REWARD_CHOICE"
            : hand.correct === false
              ? "SELECT_GROUP"
              : "JUDGE",
      rewardComplete: hand.rewardComplete === true,
      motionEnabled: hand.motionEnabled !== false,
      avatarDataUrl:
        handGroupId !== null ? avatarDataUrl(hand.avatarDataUrl) : "",
      canScore:
        handGroupId !== null &&
        hand.correct === true &&
        hand.rewardComplete !== true &&
        hand.canScore !== false,
      itemRewarded: handGroupId !== null && hand.itemRewarded === true,
      busy: hand.busy === true,
      inventoryCount:
        handGroupId === null
          ? 0
          : Math.min(3, Math.max(0, integer(hand.inventoryCount || 0))),
      canDraw:
        handGroupId !== null &&
        hand.correct === true &&
        hand.rewardComplete !== true &&
        hand.canDraw === true,
      canUse:
        handGroupId !== null &&
        hand.correct === true &&
        hand.rewardComplete !== true &&
        hand.canUse === true,
      mainItemName:
        handGroupId !== null ? text(hand.mainItemName || "", 120) : "",
      itemName: handGroupId !== null ? text(hand.itemName || "", 120) : "",
    },
    slots: s.slots.map((n) => {
      integer(n);
      if (!n) throw Error("INVALID_SLOT");
      return n;
    }),
    history: s.history.map((x) => ({
      text: text(x.text, 2000),
      time: integer(x.time),
    })),
    locked: !!s.locked,
    unsaved: !!s.unsaved,
    effects: {
      enabled: effects.enabled === true,
      style: pickEffectStyle(effects.style),
      duration: [1200, 1800, 2600, 3600].includes(effects.duration)
        ? effects.duration
        : 1800,
    },
  };
}
/* Item cinematics cross the IPC boundary as bounded plain data. Anything not
   matched here is dropped, so a renderer cannot inject markup or remote URLs. */
function sanitizeItemFx(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = (v, max = 80) =>
    typeof v === "string" && v.length <= max ? v : "";
  const targets = Array.isArray(value.targets)
    ? value.targets.slice(0, 16)
    : [];
  if (!targets.length) return null;
  return {
    key: name(value.key, 40),
    caster: name(value.caster),
    casterAvatarDataUrl: avatarDataUrl(value.casterAvatarDataUrl),
    itemName: name(value.itemName),
    icon:
      typeof value.icon === "string" &&
      value.icon.length <= 400_000 &&
      /^data:image\/(?:png|webp|jpeg|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(
        value.icon,
      )
        ? value.icon
        : "",
    targets: targets.map((target) => ({
      name: name(target?.name),
      avatarDataUrl: avatarDataUrl(target?.avatarDataUrl),
      delta: Number.isSafeInteger(target?.delta) ? target.delta : 0,
      blocked: target?.blocked === true,
      effectChanged: target?.effectChanged === true,
      status: name(target?.status, 200),
    })),
  };
}
module.exports = {
  URLS,
  authorize,
  validateCommand,
  sanitizeSnapshot,
  sanitizeItemFx,
  EFFECT_STYLES,
  pickEffectStyle,
};
