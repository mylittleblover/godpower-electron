"use strict";
const { validateCommand } = require("./contracts.cjs");
/* An effect renderer may act only on the selection currently displayed by its own window. */
function validateHandCardRequest(active, request, currentContext) {
  if (!active || active.kind !== "hand" || request?.id !== active.id)
    throw Error("STALE_HAND_CARD");
  if (
    active.saveContext?.saveId !== currentContext?.saveId ||
    active.saveContext?.generation !== currentContext?.generation
  )
    throw Error("STALE_SAVE");
  if (
    !["handJudge", "handScore", "handDraw", "handUse", "handCancel"].includes(
      request.action,
    )
  )
    throw Error("INVALID_HAND_ACTION");
  if (
    typeof request.commandId !== "string" ||
    !/^[\w-]{1,120}$/.test(request.commandId) ||
    !Number.isSafeInteger(request.seq) ||
    request.seq < 1
  )
    throw Error("INVALID_REQUEST");
  const payload = validateCommand(request.action, request.payload);
  if (
    payload.groupId !== active.hand.groupId ||
    payload.selectionId !== active.hand.selectionId
  )
    throw Error("STALE_HAND_SESSION");
  return {
    action: request.action,
    payload,
    id: request.commandId,
    seq: request.seq,
  };
}
module.exports = { validateHandCardRequest };
