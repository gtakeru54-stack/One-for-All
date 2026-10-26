/* =========================================================
   ONE FOR ALL — COSMOS
   js/timer.js
   学習タイマー
   ========================================================= */

"use strict";

import { formatDuration } from "./storage.js";
import { addStudyRecord } from "./study.js";

let startedAt = null;
let elapsedBeforeStart = 0;
let intervalId = null;
let timerRunning = false;

function getSelectedStudy() {
  return {
    subjectId: document.querySelector("#timer-subject")?.value || "",
    itemId: document.querySelector("#timer-item")?.value || ""
  };
}

function getDisplaySeconds() {
  if (!timerRunning || startedAt === null) {
    return elapsedBeforeStart;
  }

  return elapsedBeforeStart + Math.floor((Date.now() - startedAt) / 1000);
}

function renderTimer() {
  const seconds = getDisplaySeconds();

  const displayTargets = [
    "#timer-display",
    "#timer-time",
    "[data-timer-display]"
  ];

  displayTargets.forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = formatDuration(seconds);
  });

  const startButton = document.querySelector("#timer-start");
  const pauseButton = document.querySelector("#timer-pause");
  const stopButton = document.querySelector("#timer-stop");

  if (startButton) startButton.disabled = timerRunning;
  if (pauseButton) pauseButton.disabled = !timerRunning;
  if (stopButton) stopButton.disabled = seconds <= 0;

  document.querySelectorAll("[data-timer-status]").forEach((element) => {
    element.textContent = timerRunning ? "計測中" : "停止中";
    element.classList.toggle("is-running", timerRunning);
  });
}

function startTimer() {
  if (timerRunning) return;

  timerRunning = true;
  startedAt = Date.now();

  intervalId = window.setInterval(renderTimer, 250);
  renderTimer();
}

function pauseTimer() {
  if (!timerRunning) return;

  elapsedBeforeStart = getDisplaySeconds();
  timerRunning = false;
  startedAt = null;

  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }

  renderTimer();
}

function resetTimer() {
  pauseTimer();
  elapsedBeforeStart = 0;
  renderTimer();
}

function saveTimerRecord() {
  const seconds = getDisplaySeconds();

  if (seconds <= 0) {
    resetTimer();
    return;
  }

  const selected = getSelectedStudy();

  addStudyRecord({
    ...selected,
    seconds,
    source: "timer"
  });

  resetTimer();

  const toast = document.querySelector("#toast");
  if (toast) {
    toast.textContent = "学習時間を記録しました";
    toast.classList.add("visible");
    window.setTimeout(() => toast.classList.remove("visible"), 2200);
  }
}

export function initTimer() {
  document.querySelector("#timer-start")?.addEventListener("click", startTimer);
  document.querySelector("#timer-pause")?.addEventListener("click", pauseTimer);
  document.querySelector("#timer-stop")?.addEventListener("click", saveTimerRecord);

  document.querySelector("#timer-reset")?.addEventListener("click", resetTimer);

  window.addEventListener("cosmos:starttimer", () => {
    const panel = document.querySelector("#timer-panel");
    panel?.scrollIntoView({ behavior: "smooth", block: "center" });
    startTimer();
  });

  renderTimer();
}