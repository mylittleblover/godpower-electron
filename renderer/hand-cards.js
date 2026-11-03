/* Native full-screen controls render bounded host snapshots; they never calculate results. */
window.HandCards = (() => {
  const root = document.getElementById("handCards");
  let current = null,
    localPhase = null,
    busy = false,
    timer = null,
    signature = "",
    exit = null;
  const E = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const paths = {
    yes: "m5 12 4 4L19 6",
    no: "m6 6 12 12M18 6 6 18",
    score: "M12 5v14M5 12h14",
    draw: "M3 8h18v12H3ZM12 8v12M3 12h18M12 8C4 8 5 1 9 4l3 4c8 0 7-7 3-4Z",
    use: "m14 3 7 7-4 4-3-3-7 10-4-4 10-7-3-3Z",
  };
  const icon = (key) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key] || paths.draw}"/></svg>`;
  function close() {
    clearTimeout(timer);
    timer = null;
    exit?.();
  }
  async function command(action, extra = {}) {
    if (busy || !current) return;
    busy = true;
    root.querySelectorAll("button,input").forEach((b) => (b.disabled = true));
    try {
      const reply = await godpowerDesktop.handAction(current.id, action, {
        groupId: current.hand.groupId,
        selectionId: current.hand.selectionId,
        ...extra,
      });
      if (!reply.ok) {
        document.getElementById("handCardStatus").textContent =
          reply.error || "操作未完成";
      }
    } catch (error) {
      document.getElementById("handCardStatus").textContent = error.message;
    } finally {
      busy = false;
      if (current) paint();
    }
  }
  function paint() {
    if (!current) return;
    const hand = current.hand,
      phase = localPhase || hand.phase;
    root.hidden = false;
    root.dataset.phase = phase;
    root.dataset.motion = hand.motionEnabled === false ? "off" : "on";
    document.body.dataset.effectKind = "hand";
    const previous = document.getElementById("handCardScore")?.value || "";
    let cards = "";
    if (phase === "JUDGE")
      cards = `<button data-hand-command="correct" class="positive">${icon("yes")}<strong>回答正确</strong><span>记录并选择奖励</span></button><button data-hand-command="wrong" class="negative">${icon("no")}<strong>回答错误</strong><span>记录勇敢参与</span></button>`;
    if (phase === "REWARD_CHOICE")
      cards = `<button data-hand-choice="score" class="positive" ${hand.canScore ? "" : "disabled"}>${icon("score")}<strong>我要加分</strong><span>预设或自由输入</span></button><button data-hand-command="draw" ${hand.canDraw ? "" : "disabled"}>${icon("draw")}<strong>我要抽道具</strong><span>${hand.canDraw ? "本次正式抽取" : "当前状态不可抽取"}</span></button><button data-hand-command="use" ${hand.canUse ? "" : "disabled"}>${icon("use")}<strong>我要用道具</strong><span>${E(hand.mainItemName || "暂无可用道具")}</span></button>`;
    if (phase === "SCORE")
      cards = current.slots
        .map(
          (n) =>
            `<button data-hand-delta="${n}" class="${n > 0 ? "positive" : "negative"}"><strong>${n > 0 ? "+" : ""}${n}</strong><span>分</span></button>`,
        )
        .join("");
    if (phase === "DRAW")
      cards = `<div class="native-hand-draw"><div class="native-hand-reel">${icon("draw")}</div><strong id="nativeHandDrawName">道具正在揭晓</strong><span>结果已经保存</span></div>`;
    root.innerHTML = `<header>${hand.avatarDataUrl ? `<img class="hand-group-avatar" src="${E(hand.avatarDataUrl)}" alt="小组头像">` : ""}<div><small>课堂举手 · ${phase === "JUDGE" ? "判定回答" : phase === "DRAW" ? "道具揭晓" : "奖励选择"}</small><h1>${E(current.group.name)}</h1></div><button data-hand-close aria-label="关闭举手卡牌">❌</button></header><div class="native-hand-cards ${phase === "SCORE" ? "six" : phase === "REWARD_CHOICE" ? "three" : ""}">${cards}</div>${phase === "SCORE" ? `<form id="nativeHandScoreForm"><label>自定义分数<input type="number" id="handCardScore" step="1" value="${E(previous)}" required></label><button type="submit" class="positive">确认赋分</button><button type="button" data-hand-choice="back">返回奖励</button></form>` : ""}<p id="handCardStatus" role="status">${phase === "REWARD_CHOICE" ? "本次回答选择一项奖励" : phase === "JUDGE" ? "判定仅记录一次，不自动增加积分" : ""}</p>`;
    if (busy)
      root.querySelectorAll("button,input").forEach((b) => (b.disabled = true));
  }
  function render(payload, onExit) {
    const nextSignature = JSON.stringify([
      payload.id,
      payload.hand,
      payload.group,
      payload.slots,
    ]);
    if (current?.id !== payload.id) {
      clearTimeout(timer);
      localPhase = null;
      busy = false;
    }
    if (current?.hand.phase !== payload.hand.phase) localPhase = null;
    current = payload;
    exit = onExit;
    if (nextSignature === signature) return;
    signature = nextSignature;
    paint();
    const stage = document.getElementById("stage");
    stage.classList.add("active");
    if (payload.hand.motionEnabled === false) {
      stage.style.animation = "none";
      stage.style.opacity = "1";
    }
    if (payload.hand.phase === "DRAW") {
      clearTimeout(timer);
      godpowerDesktop.interactive(payload.id, true);
      timer = setTimeout(
        () => {
          if (current?.id !== payload.id) return;
          document
            .querySelector(".native-hand-reel")
            ?.classList.add("revealed");
          const label = document.getElementById("nativeHandDrawName");
          if (label) label.textContent = payload.hand.itemName || "道具已入库";
          timer = setTimeout(close, 1500);
        },
        payload.hand.motionEnabled === false ? 0 : 900,
      );
    }
  }
  root.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || busy) return;
    if (b.hasAttribute("data-hand-close")) {
      void command("handCancel");
      close();
      return;
    }
    if (b.dataset.handChoice) {
      localPhase = b.dataset.handChoice === "score" ? "SCORE" : null;
      paint();
      return;
    }
    if (b.dataset.handDelta) {
      void command("handScore", { delta: Number(b.dataset.handDelta) });
      return;
    }
    if (b.dataset.handCommand) {
      const kind = b.dataset.handCommand;
      void command(
        kind === "correct" || kind === "wrong"
          ? "handJudge"
          : kind === "draw"
            ? "handDraw"
            : "handUse",
        kind === "correct" || kind === "wrong"
          ? { correct: kind === "correct" }
          : {},
      );
    }
  });
  root.addEventListener("submit", (event) => {
    event.preventDefault();
    const delta = Number(document.getElementById("handCardScore")?.value);
    if (!Number.isSafeInteger(delta) || delta === 0) {
      document.getElementById("handCardStatus").textContent =
        "请输入非零安全整数";
      return;
    }
    void command("handScore", { delta });
  });
  window.addEventListener("beforeunload", () => clearTimeout(timer));
  return { render };
})();
