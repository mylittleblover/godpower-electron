"use strict";
const URLS = Object.freeze({
  main: "classroom://app/index.html",
  picker: "classroom://picker/index.html",
  effect: "classroom://effect/index.html",
});
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
  if (action === "score") {
    integer(p.delta);
    if (!p.delta) throw Error("INVALID_SCORE");
    text(p.resultId, 120);
  }
  return Object.fromEntries(fields.map((k) => [k, p[k]]));
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
    };
  }
  const effects = s.effects || {};
  return {
    protocolVersion: 1,
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
      style: effects.style === "burst" ? "burst" : "aurora",
      duration: [1200, 1800, 2600, 3600].includes(effects.duration)
        ? effects.duration
        : 1800,
    },
  };
}
module.exports = { URLS, authorize, validateCommand, sanitizeSnapshot };
