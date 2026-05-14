interface WorkerMessage {
  type: "START" | "PAUSE" | "RESUME" | "STOP" | "GET_STATUS";
  payload?: { totalSeconds: number; elapsedSeconds?: number };
}

let totalSeconds = 0;
let elapsedSeconds = 0;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let startTime = 0;
let pausedAt = 0;
let totalPaused = 0;

function sendTick() {
  const elapsed = (Date.now() - startTime - totalPaused) / 1000;
  const remaining = Math.max(0, totalSeconds - elapsed);
  self.postMessage({ type: "TICK", remaining, elapsed });

  if (remaining <= 0) {
    clearInterval(timerInterval!);
    timerInterval = null;
    self.postMessage({ type: "COMPLETE" });
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data;

  switch (type) {
    case "START":
      totalSeconds = payload?.totalSeconds ?? 0;
      elapsedSeconds = payload?.elapsedSeconds ?? 0;
      totalPaused = 0;
      startTime = Date.now() - elapsedSeconds * 1000;
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(sendTick, 1000);
      sendTick();
      break;

    case "PAUSE":
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      pausedAt = Date.now();
      self.postMessage({ type: "PAUSED" });
      break;

    case "RESUME":
      if (pausedAt > 0) {
        totalPaused += Date.now() - pausedAt;
        pausedAt = 0;
      }
      if (!timerInterval) {
        timerInterval = setInterval(sendTick, 1000);
        sendTick();
      }
      break;

    case "STOP":
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      break;

    case "GET_STATUS":
      const elapsed = (Date.now() - startTime - totalPaused) / 1000;
      const remaining = Math.max(0, totalSeconds - elapsed);
      if (remaining <= 0) {
        self.postMessage({ type: "COMPLETE" });
      } else {
        self.postMessage({ type: "TICK", remaining, elapsed });
      }
      break;
  }
};
