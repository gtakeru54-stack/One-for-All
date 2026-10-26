/* =========================================================
   ONE FOR ALL — COSMOS
   js/app.js
   アプリ全体の起動・機能連携
   ========================================================= */

"use strict";

import {
  initializeStorage,
  getTodayKey,
  formatDateJP
} from "./storage.js";

import { initNavigation } from "./navigation.js";
import { initCalendar } from "./calendar.js";
import { initStudy } from "./study.js";
import { initTimer } from "./timer.js";
import { initStatistics } from "./statistics.js";
import { initGoals } from "./goals.js";
import { initRocket } from "./rocket.js";

function updateTodayChip() {
  const chip = document.querySelector("#today-chip");
  if (!chip) return;

  chip.textContent = formatDateJP(new Date());
}

function bindDailyStudyGoal() {
  const input =
    document.querySelector("#daily-study-goal") ||
    document.querySelector("#study-goal-minutes");

  if (!input) return;

  const saved = localStorage.getItem("oneforall-daily-study-goal");

  if (saved) {
    input.value = saved;
  }

  const saveGoal = () => {
    const value = Number(input.value);

    if (!Number.isFinite(value) || value < 1) return;

    localStorage.setItem(
      "oneforall-daily-study-goal",
      String(Math.round(value))
    );

    window.dispatchEvent(new Event("cosmos:datachange"));
  };

  input.addEventListener("change", saveGoal);
}

function bindToastEvents() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toast]");
    if (!button) return;

    const toast = document.querySelector("#toast");
    if (!toast) return;

    toast.textContent = button.dataset.toast || "";
    toast.classList.add("visible");

    window.setTimeout(() => {
      toast.classList.remove("visible");
    }, 2500);
  });
}

function bindHomeSummary() {
  const update = () => {
    const studyData = JSON.parse(
      localStorage.getItem("oneforall-study-v1") ||
      '{"subjects":[],"items":[],"records":[]}'
    );

    const records = Array.isArray(studyData)
      ? studyData
      : Array.isArray(studyData.records)
        ? studyData.records
        : [];

    const today = getTodayKey();

    const todaySeconds = records
      .filter((record) => record.date === today)
      .reduce((sum, record) => sum + Number(record.seconds || 0), 0);

    const minutes = Math.floor(todaySeconds / 60);

    const targets = [
      "#home-study-time",
      "#today-study-time",
      "[data-home-study-time]"
    ];

    targets.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.textContent = `${Math.floor(minutes / 60)}時間${minutes % 60}分`;
      });
    });

    const goalMinutes = Number(
      localStorage.getItem("oneforall-daily-study-goal") || 120
    );

    const percent = Math.min(
      100,
      Math.round((todaySeconds / Math.max(1, goalMinutes * 60)) * 100)
    );

    const progress = document.querySelector("#home-progress");

    if (progress) {
      progress.style.width = `${percent}%`;
    }

    const progressLabel = document.querySelector("#home-progress-label");

    if (progressLabel) {
      progressLabel.textContent = `${percent}%`;
    }
  };

  update();

  window.addEventListener("cosmos:datachange", update);
}

function bindDialogOpenButtons() {
  document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.openDialog;
      const dialog = document.getElementById(id);

      if (dialog instanceof HTMLDialogElement) {
        dialog.showModal();
      } else if (dialog) {
        dialog.hidden = false;
      }
    });
  });
}

function initializeApp() {
  try {
    initializeStorage();
  } catch (error) {
    console.error("ストレージの初期化に失敗しました:", error);
  }

  /*
   * 画面切り替え
   */
  initNavigation();

  /*
   * 学習データを先に読み込む。
   * タイマーはstudy.jsの記録関数を利用する。
   */
  initStudy();
  initTimer();

  /*
   * カレンダー・統計・目標・経済
   */
  initCalendar();
  initStatistics();
  initGoals();
  initRocket();

  /*
   * 共通UI
   */
  updateTodayChip();
  bindDailyStudyGoal();
  bindToastEvents();
  bindHomeSummary();
  bindDialogOpenButtons();

  console.info("ONE FOR ALL — COSMOS 起動完了");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, {
    once: true
  });
} else {
  initializeApp();
}