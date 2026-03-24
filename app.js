const storageKeys = {
  current: "pvc.currentSession",
  history: "pvc.sessionHistory",
};

const dom = {
  startBtn: document.getElementById("startSessionBtn"),
  resetBtn: document.getElementById("resetSessionBtn"),
  tapButtons: Array.from(document.querySelectorAll(".tap")),
  sessionStateLabel: document.getElementById("sessionStateLabel"),
  sessionTimer: document.getElementById("sessionTimer"),
  sessionStartedLabel: document.getElementById("sessionStartedLabel"),
  stateDot: document.getElementById("stateDot"),
  totalBeats: document.getElementById("totalBeats"),
  pvcCount: document.getElementById("pvcCount"),
  normalCount: document.getElementById("normalCount"),
  pvcPercent: document.getElementById("pvcPercent"),
  normalPercent: document.getElementById("normalPercent"),
  durationStat: document.getElementById("durationStat"),
  heroTotalBeats: document.getElementById("heroTotalBeats"),
  heroPvcShare: document.getElementById("heroPvcShare"),
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
};

const numberFormatter = new Intl.NumberFormat();
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

let currentSession = readSession();
let historyItems = readHistory();
let timerHandle = null;

init();

function init() {
  dom.startBtn.addEventListener("click", toggleSession);
  dom.resetBtn.addEventListener("click", resetSessionCounts);
  dom.tapButtons.forEach((button) => {
    button.addEventListener("click", () => recordBeat(button.dataset.action));
  });
  dom.clearHistoryBtn.addEventListener("click", clearHistory);
  render();
  if (currentSession) startTimer();
}

function toggleSession() {
  if (currentSession) {
    endSession();
  } else {
    startSession();
  }
}

function startSession() {
  currentSession = {
    id: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
    startedAt: new Date().toISOString(),
    beats: { normal: 0, pvc: 0 },
  };
  persistSession();
  startTimer();
  render();
}

function endSession() {
  if (!currentSession) return;
  const endedAt = new Date().toISOString();
  const total = totalBeats(currentSession);
  const durationMs = Date.parse(endedAt) - Date.parse(currentSession.startedAt);
  const summary = {
    ...currentSession,
    endedAt,
    durationMs,
    totalBeats: total,
  };
  historyItems = [summary, ...historyItems].slice(0, 20); // keep recent 20 sessions
  saveHistory();
  currentSession = null;
  persistSession();
  stopTimer();
  render();
}

function resetSessionCounts() {
  if (!currentSession) return;
  currentSession.beats = { normal: 0, pvc: 0 };
  persistSession();
  render();
}

function recordBeat(type) {
  if (!currentSession || !["normal", "pvc"].includes(type)) return;
  currentSession.beats[type] += 1;
  persistSession();
  updateSessionStats();
  updateHeroPanel();
}

function clearHistory() {
  if (!historyItems.length) return;
  const confirmation = window.confirm(
    "Clear all saved sessions? This cannot be undone.",
  );
  if (!confirmation) return;
  historyItems = [];
  saveHistory();
  renderHistory();
  updateHeroPanel();
}

function render() {
  updateSessionStats();
  renderHistory();
  updateHeroPanel();
}

function updateSessionStats() {
  const active = Boolean(currentSession);
  dom.stateDot.style.background = active ? "var(--normal)" : "var(--ink-muted)";
  dom.sessionStateLabel.textContent = active
    ? "Session recording"
    : "Session idle";
  dom.startBtn.textContent = active ? "End session" : "Start session";
  dom.resetBtn.disabled = !active;
  dom.tapButtons.forEach((btn) => (btn.disabled = !active));

  const total = active ? totalBeats(currentSession) : 0;
  const pvc = active ? currentSession.beats.pvc : 0;
  const normal = active ? currentSession.beats.normal : 0;

  dom.totalBeats.textContent = numberFormatter.format(total);
  dom.pvcCount.textContent = numberFormatter.format(pvc);
  dom.normalCount.textContent = numberFormatter.format(normal);
  dom.pvcPercent.textContent = formatPercent(pvc, total);
  dom.normalPercent.textContent = formatPercent(normal, total);

  if (active) {
    dom.sessionStartedLabel.textContent = `Started ${formatSessionStart(currentSession.startedAt)}`;
    updateTimerDisplay();
  } else {
    dom.sessionStartedLabel.textContent = "No active session";
    dom.sessionTimer.textContent = "00:00";
    dom.durationStat.textContent = "00:00";
  }
}

function renderHistory() {
  dom.historyList.innerHTML = "";
  if (!historyItems.length) {
    const li = document.createElement("li");
    li.className = "empty-history";
    li.textContent =
      "No sessions captured yet. Start one to see your PVC ratios stack up.";
    dom.historyList.appendChild(li);
    return;
  }

  historyItems.forEach((entry, idx) => {
    const li = document.createElement("li");
    li.className = "history-item";
    if (idx === 0) li.dataset.latest = "true";

    const header = document.createElement("div");
    header.className = "history-item__meta";
    header.textContent = `${formatSessionStart(entry.startedAt)} > ${formatSessionStart(entry.endedAt)}`;

    const beats = document.createElement("div");
    beats.className = "history-item__beats";
    beats.textContent = `${numberFormatter.format(entry.totalBeats)} beats`;

    const badges = document.createElement("div");
    badges.className = "history-item__badges";
    const normalBadge = document.createElement("span");
    normalBadge.className = "badge badge--normal";
    normalBadge.textContent = `${numberFormatter.format(entry.beats.normal)} normal`;
    const pvcBadge = document.createElement("span");
    pvcBadge.className = "badge badge--pvc";
    pvcBadge.textContent = `${formatPercent(entry.beats.pvc, entry.totalBeats)} PVC`;
    badges.append(normalBadge, pvcBadge);

    const duration = document.createElement("div");
    duration.className = "history-item__meta";
    duration.textContent = `Duration ${formatDuration(entry.durationMs)}`;

    li.append(header, beats, badges, duration);
    dom.historyList.appendChild(li);
  });
}

function updateHeroPanel() {
  const source = currentSession || historyItems[0];
  const total = source ? (source.totalBeats ?? totalBeats(source)) : 0;
  const pvc = source ? source.beats.pvc : 0;

  dom.heroTotalBeats.textContent = numberFormatter.format(total);
  dom.heroPvcShare.textContent = formatPercent(pvc, total);
}

function startTimer() {
  stopTimer();
  timerHandle = window.setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
}

function stopTimer() {
  if (timerHandle) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
}

function updateTimerDisplay() {
  if (!currentSession) return;
  const elapsed = Date.now() - Date.parse(currentSession.startedAt);
  const formatted = formatTimer(elapsed);
  dom.sessionTimer.textContent = formatted;
  dom.durationStat.textContent = formatted;
}

function totalBeats(session) {
  return session.beats.normal + session.beats.pvc;
}

function formatPercent(value, total) {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatTimer(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const withLeading = (num) => String(num).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${withLeading(minutes)}:${withLeading(seconds)}`;
  }
  return `${withLeading(minutes)}:${withLeading(seconds)}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatSessionStart(iso) {
  const date = new Date(iso);
  return `${dateFormatter.format(date)} | ${timeFormatter.format(date)}`;
}

function persistSession() {
  if (currentSession) {
    localStorage.setItem(storageKeys.current, JSON.stringify(currentSession));
  } else {
    localStorage.removeItem(storageKeys.current);
  }
}

function readSession() {
  const raw = localStorage.getItem(storageKeys.current);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Unable to parse current session, clearing stale value.");
    localStorage.removeItem(storageKeys.current);
    return null;
  }
}

function saveHistory() {
  localStorage.setItem(storageKeys.history, JSON.stringify(historyItems));
}

function readHistory() {
  const raw = localStorage.getItem(storageKeys.history);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Unable to parse session history, resetting.");
    localStorage.removeItem(storageKeys.history);
    return [];
  }
}
