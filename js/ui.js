/* =========================================================
   ALGOL — Study Constellation
   js/ui.js
   UI CONTROL SYSTEM
   ========================================================= */

"use strict";

import * as Store from "./store.js";
import * as Study from "./study.js";
import * as Calendar from "./calendar.js";
import * as Statistics from "./statistics.js";
import * as Goals from "./goals.js";
import * as Countdown from "./countdown.js";
import * as Economy from "./economy.js";
import * as Rocket from "./rocket.js";
import * as Settings from "./settings.js";

/* =========================================================
   共通ユーティリティ
   ========================================================= */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

const state = {
  currentView: "home",
  calendarDate: new Date(),
  calendarMode: "month",
  selectedDate: new Date(),
  statisticsPeriod: "week",
  statisticsGrouping: "subject",
  timerInterval: null,
  dialogCallback: null
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function showMessage(message, type = "info") {
  const element = $("#cosmos-message");

  if (!element) {
    console.log(`[ALGOL ${type}] ${message}`);
    return;
  }

  element.textContent = message;
  element.dataset.type = type;
  element.classList.add("show");

  clearTimeout(showMessage.timer);

  showMessage.timer = setTimeout(() => {
    element.classList.remove("show");
  }, 2800);
}

function safeCall(callback, errorMessage = "処理に失敗しました。") {
  try {
    return callback();
  } catch (error) {
    console.error("[ALGOL]", error);
    showMessage(error.message || errorMessage, "error");
    return null;
  }
}

/* =========================================================
   初期化
   ========================================================= */

function initializeModules() {
  safeCall(() => Study.getAllSubjects());
  safeCall(() => Calendar.getAllCalendarEvents());
  safeCall(() => Goals.getAllGoals());
  safeCall(() => Countdown.initializeCountdown());
  safeCall(() => Economy.initializeEconomy());
  safeCall(() => Rocket.initializeRocket());
  safeCall(() => Settings.initializeSettings());
}

function initializeUI() {
  bindNavigation();
  bindGlobalActions();
  bindStudyActions();
  bindCalendarActions();
  bindGoalActions();
  bindCountdownActions();
  bindSettingsActions();

  renderCurrentView();
  startTimerDisplay();

  document.documentElement.dataset.theme =
    Settings.getTheme?.() || "cosmos";
}

/* =========================================================
   画面切り替え
   ========================================================= */

function changeView(view) {
  if (!view) return;

  state.currentView = view;

  $$("[data-view-panel]").forEach(panel => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });

  $$("[data-view]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === view
    );
  });

  renderCurrentView();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function bindNavigation() {
  $$("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      changeView(button.dataset.view);
    });
  });

  $("#menu-open")?.addEventListener("click", () => {
    $("#side-menu")?.classList.add("open");
    $("#menu-backdrop")?.classList.add("show");
  });

  $("#menu-close")?.addEventListener("click", closeMenu);
  $("#menu-backdrop")?.addEventListener("click", closeMenu);
}

function closeMenu() {
  $("#side-menu")?.classList.remove("open");
  $("#menu-backdrop")?.classList.remove("show");
}

function renderCurrentView() {
  const renderers = {
    home: renderHome,
    study: renderStudy,
    calendar: renderCalendar,
    statistics: renderStatistics,
    goals: renderGoals,
    countdown: renderCountdown,
    economy: renderEconomy,
    rocket: renderRocket,
    settings: renderSettings
  };

  renderers[state.currentView]?.();
}

/* =========================================================
   ホーム
   ========================================================= */

function renderHome() {
  const today = dateKey();

  const total = Study.getDailyStudyMinutes(today);
  const target = Settings.getDailyTarget?.() || 60;

  const percent = Math.min(
    100,
    Math.round(total / Math.max(1, target) * 100)
  );

  setText("#home-today-time", Study.formatStudyMinutes(total));
  setText("#home-goal-percent", `${percent}%`);
  setWidth("#home-goal-progress", percent);

  const rocket = Rocket.getRocketStatus?.();

  if (rocket) {
    setText("#home-rocket-level", rocket.level);
    setText("#home-rocket-exp", rocket.experience);
  }

  renderHomeSchedule();
  renderHomeTasks();
  renderHomeCountdown();
}

function renderHomeSchedule() {
  const container = $("#home-schedule-list");
  if (!container) return;

  const events = Calendar.getEventsByDate(dateKey());

  container.innerHTML = events.length
    ? events.map(event => `
        <div class="home-list-item">
          <strong>${escapeHTML(event.title)}</strong>
          <span>${escapeHTML(event.startTime || "終日")}</span>
        </div>
      `).join("")
    : `<p class="empty-state">今日の予定はありません</p>`;
}

function renderHomeTasks() {
  const container = $("#home-task-list");
  if (!container) return;

  const tasks = Calendar.getTodayTasks();

  container.innerHTML = tasks.length
    ? tasks.map(task => `
        <div class="home-list-item">
          ${escapeHTML(task.title)}
        </div>
      `).join("")
    : `<p class="empty-state">今日のタスクはありません</p>`;
}

function renderHomeCountdown() {
  const container = $("#home-countdown-list");
  if (!container) return;

  const events = Countdown.getUpcomingCountdownEvents({
    limit: 3
  });

  container.innerHTML = events.length
    ? events.map(event => `
        <div class="home-list-item">
          <strong>${escapeHTML(event.title)}</strong>
          <span>${escapeHTML(
            Countdown.formatRemainingDays(event.remainingDays)
          )}</span>
        </div>
      `).join("")
    : `<p class="empty-state">カウントダウンはありません</p>`;
}

/* =========================================================
   勉強
   ========================================================= */

function renderStudy() {
  renderSubjectOptions();
  renderStudySubjects();
  renderStudyRecords();
  updateTimerDisplay();
}

function renderSubjectOptions() {
  const subjects = Study.getAllSubjects();

  [
    "#study-timer-subject",
    '#manual-study-form [name="subjectId"]'
  ].forEach(selector => {
    const select = $(selector);
    if (!select) return;

    const previous = select.value;

    select.innerHTML = subjects.map(subject => `
      <option value="${escapeHTML(subject.id)}">
        ${escapeHTML(subject.name)}
      </option>
    `).join("");

    select.value = previous;
  });
}

function renderStudySubjects() {
  const container = $("#study-subject-list");
  if (!container) return;

  container.innerHTML = Study.getAllSubjects().map(subject => `
    <div class="subject-item">
      <span>${escapeHTML(subject.name)}</span>
    </div>
  `).join("");
}

function renderStudyRecords() {
  const container = $("#study-record-list");
  if (!container) return;

  const records = Study.getRecentStudyRecords(30);

  container.innerHTML = records.map(record => `
    <div class="study-record">
      <strong>${escapeHTML(record.date)}</strong>
      <span>${escapeHTML(
        Study.formatStudyMinutes(record.minutes)
      )}</span>
      <p>${escapeHTML(record.note || "")}</p>
    </div>
  `).join("");
}

function bindStudyActions() {
  $("#timer-start")?.addEventListener("click", () => {
    safeCall(() => {
      const subjectId = $("#study-timer-subject")?.value;
      const itemId = $("#study-timer-item")?.value || null;

      Study.startStudyTimer(subjectId, itemId);
      updateTimerDisplay();
      showMessage("学習タイマーを開始しました。");
    });
  });

  $("#timer-pause")?.addEventListener("click", () => {
    safeCall(() => {
      Study.pauseStudyTimer();
      updateTimerDisplay();
    });
  });

  $("#timer-finish")?.addEventListener("click", () => {
    safeCall(() => {
      Study.finishStudyTimer();
      renderStudy();
      showMessage("学習時間を保存しました。");
    });
  });

  $("#manual-study-form")?.addEventListener("submit", event => {
    event.preventDefault();

    safeCall(() => {
      const form = event.currentTarget;

      Study.addStudyRecord({
        subjectId: form.elements.subjectId.value,
        itemId: form.elements.itemId?.value || null,
        date: form.elements.date.value || dateKey(),
        minutes: Number(form.elements.minutes.value),
        note: form.elements.note.value,
        source: "manual"
      });

      form.reset();
      renderStudy();
      showMessage("学習記録を追加しました。");
    });
  });
}

function startTimerDisplay() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }

  state.timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  const timer = Study.getTimerStatus();
  const display = $("#study-timer-display");

  if (display) {
    display.textContent = Study.formatTimer(timer.elapsedSeconds || 0);
  }

  const status = $("#study-timer-status");

  if (status) {
    status.textContent = timer.isRunning
      ? "学習中"
      : timer.isPaused
        ? "一時停止中"
        : "待機中";
  }
}

/* =========================================================
   カレンダー
   ========================================================= */

function renderCalendar() {
  const container = $("#calendar-grid");
  if (!container) return;

  const calendar = Calendar.getMonthCalendar(
    state.calendarDate.getFullYear(),
    state.calendarDate.getMonth()
  );

  const events = Calendar.getAllCalendarEvents();

  container.innerHTML = calendar.map(week => `
    <div class="calendar-week">
      ${week.map(day => {
        const key = dateKey(day.date || day);
        const count = events.filter(event => event.date === key).length;

        return `
          <button class="calendar-day"
            data-date="${key}">
            <span>${new Date(key).getDate()}</span>
            ${count ? `<small>${count}</small>` : ""}
          </button>
        `;
      }).join("")}
    </div>
  `).join("");

  container.querySelectorAll("[data-date]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedDate = new Date(`${button.dataset.date}T00:00:00`);
      renderSelectedDate();
    });
  });

  setText(
    "#calendar-period-label",
    `${state.calendarDate.getFullYear()}年${state.calendarDate.getMonth() + 1}月`
  );

  renderSelectedDate();
}

function renderSelectedDate() {
  const key = dateKey(state.selectedDate);

  setText("#calendar-selected-date-label", key);

  const container = $("#calendar-event-list");
  if (!container) return;

  const events = Calendar.getEventsByDate(key);

  container.innerHTML = events.map(event => `
    <div class="calendar-event">
      <strong>${escapeHTML(event.title)}</strong>
      <span>${escapeHTML(event.startTime || "終日")}</span>
      <p>${escapeHTML(event.description || "")}</p>
    </div>
  `).join("");
}

function bindCalendarActions() {
  $("#calendar-prev")?.addEventListener("click", () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
    renderCalendar();
  });

  $("#calendar-next")?.addEventListener("click", () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
    renderCalendar();
  });

  $("#calendar-today")?.addEventListener("click", () => {
    state.calendarDate = new Date();
    state.selectedDate = new Date();
    renderCalendar();
  });
}

/* =========================================================
   統計
   ========================================================= */

function renderStatistics() {
  const dashboard = Statistics.getStatisticsDashboard();

  setText(
    "#remaining-study-time",
    Study.formatStudyMinutes(
      Math.max(
        0,
        (Settings.getDailyTarget?.() || 60) -
        Study.getDailyStudyMinutes()
      )
    )
  );

  setText(
    "#statistics-total-time",
    Study.formatStudyMinutes(dashboard.overall?.totalMinutes || 0)
  );
}

/* =========================================================
   目標
   ========================================================= */

function renderGoals() {
  const container = $("#goal-list");
  if (!container) return;

  const goals = Goals.getAllGoals();

  container.innerHTML = goals.map(goal => `
    <div class="goal-item">
      <strong>${escapeHTML(goal.title)}</strong>
      <span>${Goals.getGoalProgress(goal.id)}%</span>
    </div>
  `).join("");

  const summary = Goals.getGoalSummary();

  setText("#goal-map-completion", `${summary.progress || 0}%`);
}

function bindGoalActions() {
  $("#add-goal")?.addEventListener("click", () => {
    showMessage("目標追加画面は次のUI実装で接続します。");
  });
}

/* =========================================================
   カウントダウン
   ========================================================= */

function renderCountdown() {
  const container = $("#countdown-list");
  if (!container) return;

  const events = Countdown.getAllCountdownEvents();

  container.innerHTML = events.map(event => {
    const display = Countdown.getCountdownDisplay(event);

    return `
      <div class="countdown-item">
        <strong>${escapeHTML(event.title)}</strong>
        <span>${escapeHTML(display.remainingText)}</span>
      </div>
    `;
  }).join("");
}

function bindCountdownActions() {
  $("#add-countdown")?.addEventListener("click", () => {
    showMessage("追加フォームは次のUI実装で接続します。");
  });
}

/* =========================================================
   経済
   ========================================================= */

function renderEconomy() {
  setText("#economy-balance", Economy.getBalance());
}

/* =========================================================
   ロケット
   ========================================================= */

function renderRocket() {
  const status = Rocket.getRocketStatus?.();
  if (!status) return;

  setText("#rocket-level", status.level);
  setText("#rocket-name", status.name || "ALGOL Explorer");
  setText("#rocket-exp-label", status.experience);
}

/* =========================================================
   設定
   ========================================================= */

function renderSettings() {
  const settings = Settings.getSettings?.();
  if (!settings) return;

  const daily = $('[name="dailyGoalMinutes"]');
  const weekly = $('[name="weeklyGoalMinutes"]');

  if (daily) daily.value = settings.dailyTarget ?? 60;
  if (weekly) weekly.value = settings.weeklyTarget ?? 420;
}

function bindSettingsActions() {
  $("#settings-study-form")?.addEventListener("submit", event => {
    event.preventDefault();

    safeCall(() => {
      const form = event.currentTarget;

      Settings.saveSettings({
        dailyTarget: Number(form.elements.dailyGoalMinutes.value),
        weeklyTarget: Number(form.elements.weeklyGoalMinutes.value)
      });

      showMessage("設定を保存しました。");
    });
  });
}

/* =========================================================
   共通アクション
   ========================================================= */

function bindGlobalActions() {
  $$("[data-action='refresh']").forEach(button => {
    button.addEventListener("click", renderCurrentView);
  });
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value ?? "";
}

function setWidth(selector, percent) {
  const element = $(selector);
  if (element) element.style.width = `${percent}%`;
}

/* =========================================================
   起動
   ========================================================= */

function startALGOL() {
  initializeModules();
  initializeUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startALGOL, {
    once: true
  });
} else {
  startALGOL();
}