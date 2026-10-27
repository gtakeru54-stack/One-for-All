
/* =========================================================
   ONE FOR ALL — COSMOS
   js/ui.js
   画面操作・各機能の接続・表示更新
   機能別の処理は既存のJSファイルに分散
   ========================================================= */

"use strict";

import { store } from "./store.js";
import { study } from "./study.js";
import { calendar } from "./calendar.js";
import { statistics } from "./statistics.js";
import { goals } from "./goals.js";
import { countdown } from "./countdown.js";
import { economy } from "./economy.js";
import { rocket } from "./rocket.js";
import {
  getSettings,
  saveSettings
} from "./settings.js";

(() => {
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const LEGACY_KEY = "ofa-cosmos-data-v1";

  const DEFAULTS = {
    settings: {
      dailyGoal: 120,
      weeklyGoal: 840,
      minimumAction: 5,
      animations: true,
      theme: "cosmos",
      shortcuts: [
        "home",
        "study",
        "calendar",
        "statistics",
        "goals"
      ]
    },
    subjects: [
      { id: "math", name: "数学", color: "#69a7ff" },
      { id: "english", name: "英語", color: "#b69aff" },
      { id: "japanese", name: "国語", color: "#ff8fc7" },
      { id: "science", name: "理科", color: "#76e3b0" },
      { id: "social", name: "社会", color: "#ffd780" }
    ],
    studyItems: [],
    studyRecords: [],
    events: [],
    tasks: [],
    goals: [],
    goalNodes: [],
    habits: [],
    countdowns: [],
    timetable: [],
    notifications: [],
    economy: {
      balance: 0,
      transactions: [],
      loans: []
    },
    rocket: {
      name: "COSMOS",
      level: 1,
      exp: 0,
      parts: [],
      missions: [],
      explorations: []
    }
  };

  let data = loadLegacyData();
  let currentView = "home";
  let selectedDate = dateKey(new Date());
  let calendarMonth = new Date();
  let dialogResolve = null;
  let timerInterval = null;
  let timerStartedAt = 0;
  let timerAccumulated = 0;
  let timerRunning = false;

  /* =======================================================
     共通処理
     ======================================================= */

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix = "item") {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36).slice(2, 8)}`;
  }

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function parseDate(value) {
    if (!value) return new Date();
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatMinutes(value) {
    const minutes = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;

    if (hours && remainder) return `${hours}時間${remainder}分`;
    if (hours) return `${hours}時間`;
    return `${remainder}分`;
  }

  function formatClock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor(total / 60) % 60).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = String(value ?? "");
  }

  function setValue(selector, value) {
    const element = $(selector);
    if (element) element.value = value ?? "";
  }

  function setChecked(selector, value) {
    const element = $(selector);
    if (element) element.checked = Boolean(value);
  }

  function setWidth(selector, value) {
    const element = $(selector);
    if (!element) return;

    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    element.style.width = `${percent}%`;
    element.setAttribute("aria-valuenow", String(Math.round(percent)));
  }

  function showMessage(message) {
    const element = $("#cosmos-message");

    if (!element) {
      console.info(message);
      return;
    }

    element.textContent = message;
    element.hidden = false;
    element.classList.add("is-visible");

    clearTimeout(showMessage.timeout);

    showMessage.timeout = setTimeout(() => {
      element.classList.remove("is-visible");
      element.hidden = true;
    }, 2800);
  }

  function safeCall(object, method, ...args) {
    if (object && typeof object[method] === "function") {
      try {
        return object[method](...args);
      } catch (error) {
        console.error(`${method} の実行に失敗しました:`, error);
        showMessage("処理に失敗しました。コンソールを確認してください。");
      }
    }

    return undefined;
  }

  /* =======================================================
     旧データの読み込み
     古いキーを勝手に削除しない
     ======================================================= */

  function loadLegacyData() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return clone(DEFAULTS);

      const parsed = JSON.parse(raw);

      return {
        ...clone(DEFAULTS),
        ...parsed,
        settings: {
          ...clone(DEFAULTS.settings),
          ...(parsed.settings || {})
        },
        economy: {
          ...clone(DEFAULTS.economy),
          ...(parsed.economy || {})
        },
        rocket: {
          ...clone(DEFAULTS.rocket),
          ...(parsed.rocket || {})
        },
        subjects: Array.isArray(parsed.subjects)
          ? parsed.subjects
          : clone(DEFAULTS.subjects),
        studyRecords: Array.isArray(parsed.studyRecords)
          ? parsed.studyRecords
          : [],
        studyItems: Array.isArray(parsed.studyItems)
          ? parsed.studyItems
          : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        goalNodes: Array.isArray(parsed.goalNodes) ? parsed.goalNodes : [],
        habits: Array.isArray(parsed.habits) ? parsed.habits : [],
        countdowns: Array.isArray(parsed.countdowns)
          ? parsed.countdowns
          : [],
        timetable: Array.isArray(parsed.timetable)
          ? parsed.timetable
          : [],
        notifications: Array.isArray(parsed.notifications)
          ? parsed.notifications
          : []
      };
    } catch (error) {
      console.error("旧データを読み込めませんでした:", error);
      return clone(DEFAULTS);
    }
  }

  function saveLegacyData() {
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("旧データを保存できませんでした:", error);
      showMessage("保存できませんでした。空き容量を確認してください。");
      return false;
    }
  }

  function totalMinutes(records) {
    return records.reduce(
      (sum, record) => sum + Math.max(0, Number(record.minutes) || 0),
      0
    );
  }

  function recordsForDate(date) {
    return data.studyRecords.filter(record => record.date === date);
  }

  function totalForDate(date) {
    return totalMinutes(recordsForDate(date));
  }

  /* =======================================================
     画面切り替え
     ======================================================= */

  function openMenu() {
    const menu = $("#side-menu");
    const backdrop = $("#menu-backdrop");

    if (menu) {
      menu.hidden = false;
      menu.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
    }

    if (backdrop) {
      backdrop.hidden = false;
      backdrop.classList.add("is-visible");
    }

    $("#menu-open")?.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    const menu = $("#side-menu");
    const backdrop = $("#menu-backdrop");

    menu?.classList.remove("is-open");
    menu?.setAttribute("aria-hidden", "true");
    backdrop?.classList.remove("is-visible");
    $("#menu-open")?.setAttribute("aria-expanded", "false");

    if (menu) menu.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }

  function showView(name) {
    const target = $(`#view-${CSS.escape(name)}`);

    if (!target) {
      showMessage("この画面はまだ用意されていません。");
      return;
    }

    currentView = name;

    $$(".page-section").forEach(section => {
      const active = section === target;
      section.hidden = !active;
      section.classList.toggle("active", active);
      section.setAttribute("aria-hidden", String(!active));
    });

    $$("[data-view]").forEach(button => {
      const active = button.dataset.view === name;
      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    closeMenu();
    renderCurrentView();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCurrentView() {
    const renderers = {
      home: renderHome,
      study: renderStudy,
      calendar: renderCalendar,
      statistics: renderStatistics,
      goals: renderGoals,
      rocket: renderRocket,
      economy: renderEconomy,
      countdown: renderCountdown,
      notifications: renderNotifications,
      settings: renderSettings
    };

    renderers[currentView]?.();
  }

  /* =======================================================
     ダイアログ
     ======================================================= */

  function dialog(title, content, confirmText = "保存") {
    const element = $("#cosmos-dialog");
    const titleElement = $("#cosmos-dialog-title");
    const contentElement = $("#cosmos-dialog-content");
    const confirmButton = $("#cosmos-dialog-confirm");

    if (!element || !contentElement || !confirmButton) {
      showMessage("ダイアログのHTMLが見つかりません。");
      return Promise.resolve(null);
    }

    if (dialogResolve) closeDialog(null);

    if (titleElement) titleElement.textContent = title;
    contentElement.innerHTML = content;
    confirmButton.textContent = confirmText;
    confirmButton.disabled = false;

    if (typeof element.showModal === "function") {
      element.showModal();
    } else {
      element.setAttribute("open", "");
    }

    return new Promise(resolve => {
      dialogResolve = resolve;
    });
  }

  function closeDialog(result = null) {
    const element = $("#cosmos-dialog");

    if (element) {
      if (typeof element.close === "function" && element.open) {
        element.close();
      } else {
        element.removeAttribute("open");
      }
    }

    if (dialogResolve) {
      const resolve = dialogResolve;
      dialogResolve = null;
      resolve(result);
    }
  }

  function readDialogFields() {
    const result = {};
    const fields = $$("#cosmos-dialog-content input, #cosmos-dialog-content select, #cosmos-dialog-content textarea");

    for (const field of fields) {
      if (!field.reportValidity()) return null;
      if (!field.name) continue;

      result[field.name] = field.type === "checkbox"
        ? field.checked
        : field.value.trim();
    }

    return result;
  }

  /* =======================================================
     学習記録
     ======================================================= */

  function addStudyRecord(record) {
    const minutes = Math.floor(Number(record.minutes));
    const subject = String(record.subject || "").trim();
    const item = String(record.item || "").trim();

    if (!Number.isFinite(minutes) || minutes < 1) {
      showMessage("学習時間は1分以上にしてください。");
      return false;
    }

    if (!subject) {
      showMessage("教科を入力してください。");
      return false;
    }

    const date = record.date || todayKey();

    data.studyRecords.push({
      id: uid("study"),
      date,
      subject,
      item,
      minutes,
      note: String(record.note || "").trim(),
      createdAt: new Date().toISOString()
    });

    if (!data.subjects.some(entry => entry.name === subject)) {
      data.subjects.push({
        id: uid("subject"),
        name: subject,
        color: colorForIndex(data.subjects.length)
      });
    }

    if (item && !data.studyItems.some(entry =>
      entry.subject === subject && entry.name === item
    )) {
      data.studyItems.push({
        id: uid("study-item"),
        subject,
        name: item
      });
    }

    saveLegacyData();

    /*
     * 機能別モジュールにも記録を渡す。
     * モジュールの公開APIに該当するメソッドがある場合に実行する。
     */
    safeCall(study, "addManualRecord", {
      subject,
      item,
      minutes,
      date,
      note: record.note || ""
    });

    safeCall(study, "addStudyRecord", {
      subject,
      item,
      minutes,
      date,
      note: record.note || ""
    });

    renderAll();
    showMessage("学習記録を保存しました。");
    return true;
  }

  function colorForIndex(index) {
    const colors = [
      "#69a7ff", "#b69aff", "#ff8fc7",
      "#76e3b0", "#ffd780", "#66e0e8", "#ff8295"
    ];

    return colors[index % colors.length];
  }

  function renderSubjects() {
    const list = $("#study-subject-list");
    if (!list) return;

    list.innerHTML = data.subjects.map(subject => {
      const minutes = totalMinutes(data.studyRecords.filter(
        record => record.subject === subject.name
      ));

      return `
        <article class="subject-card">
          <span class="subject-color"
            style="background:${escapeHTML(subject.color)}"></span>
          <div class="subject-card-info">
            <strong>${escapeHTML(subject.name)}</strong>
            <small>累計 ${formatMinutes(minutes)}</small>
          </div>
          <button type="button"
            data-remove-subject="${escapeHTML(subject.id)}">削除</button>
        </article>
      `;
    }).join("") || "<p>教科を追加してください。</p>";
  }

  function renderStudyRecords() {
    const list = $("#study-record-list");
    if (!list) return;

    const records = [...data.studyRecords].sort((a, b) =>
      `${b.date}${b.createdAt || ""}`.localeCompare(
        `${a.date}${a.createdAt || ""}`
      )
    );

    list.innerHTML = records.slice(0, 100).map(record => `
      <article class="record-card">
        <div>
          <strong>${escapeHTML(record.subject)}</strong>
          ${record.item ? `<span>${escapeHTML(record.item)}</span>` : ""}
          <small>${escapeHTML(record.date)}</small>
          ${record.note ? `<p>${escapeHTML(record.note)}</p>` : ""}
        </div>
        <strong>${formatMinutes(record.minutes)}</strong>
        <button type="button"
          data-delete-record="${escapeHTML(record.id)}">削除</button>
      </article>
    `).join("") || "<p>まだ学習記録がありません。</p>";
  }

  function renderStudy() {
    renderSubjects();
    renderStudyRecords();
    updateTimerDisplay();
    updateTimerButtons();

    const dateField = $("#manual-study-date");
    if (dateField && !dateField.value) dateField.value = todayKey();
  }

  async function addSubject() {
    const result = await dialog("教科を追加", `
      <label>教科名
        <input name="name" required maxlength="60" placeholder="例：情報">
      </label>
    `);

    if (!result?.name) return;

    if (data.subjects.some(subject => subject.name === result.name)) {
      showMessage("その教科はすでに登録されています。");
      return;
    }

    data.subjects.push({
      id: uid("subject"),
      name: result.name,
      color: colorForIndex(data.subjects.length)
    });

    saveLegacyData();
    renderStudy();
    showMessage("教科を追加しました。");
  }

  async function addStudyItem() {
    const result = await dialog("学習項目を追加", `
      <label>教科
        <input name="subject" required maxlength="60" placeholder="例：英語">
      </label>
      <label>学習項目
        <input name="name" required maxlength="120" placeholder="例：英単語">
      </label>
    `);

    if (!result?.subject || !result?.name) return;

    if (!data.subjects.some(subject => subject.name === result.subject)) {
      data.subjects.push({
        id: uid("subject"),
        name: result.subject,
        color: colorForIndex(data.subjects.length)
      });
    }

    if (!data.studyItems.some(entry =>
      entry.subject === result.subject && entry.name === result.name
    )) {
      data.studyItems.push({
        id: uid("study-item"),
        subject: result.subject,
        name: result.name
      });
    }

    saveLegacyData();
    renderStudy();
    showMessage("学習項目を追加しました。");
  }

  /* =======================================================
     タイマー
     ======================================================= */

  function elapsedMilliseconds() {
    return timerAccumulated +
      (timerRunning ? Date.now() - timerStartedAt : 0);
  }

  function startTimer() {
    if (timerRunning) return;

    timerRunning = true;
    timerStartedAt = Date.now();

    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 250);

    setText("#study-timer-status", "学習中");
    updateTimerButtons();
    updateTimerDisplay();
  }

  function pauseTimer() {
    if (!timerRunning) return;

    timerAccumulated += Date.now() - timerStartedAt;
    timerRunning = false;

    clearInterval(timerInterval);
    timerInterval = null;

    setText("#study-timer-status", "一時停止中");
    updateTimerButtons();
    updateTimerDisplay();
  }

  function resetTimer() {
    clearInterval(timerInterval);

    timerInterval = null;
    timerStartedAt = 0;
    timerAccumulated = 0;
    timerRunning = false;

    updateTimerDisplay();
    updateTimerButtons();
    setText("#study-timer-status", "待機中");
  }

  function updateTimerDisplay() {
    setText(
      "#study-timer-display",
      formatClock(elapsedMilliseconds() / 1000)
    );
    updateTimerButtons();
  }

  function updateTimerButtons() {
    const start = $('[data-action="timer-start"]');
    const pause = $('[data-action="timer-pause"]');
    const finish = $('[data-action="timer-finish"]');

    if (start) start.disabled = timerRunning;
    if (pause) pause.disabled = !timerRunning;
    if (finish) finish.disabled = elapsedMilliseconds() < 1000;
  }

  async function finishTimer() {
    if (timerRunning) pauseTimer();

    const minutes = Math.floor(elapsedMilliseconds() / 60000);

    if (minutes < 1) {
      showMessage("1分以上計測してから記録してください。");
      return;
    }

    const result = await dialog("学習を記録", `
      <label>教科
        <input name="subject" required maxlength="60" placeholder="例：数学">
      </label>
      <label>学習した内容
        <input name="item" maxlength="120" placeholder="例：二次関数">
      </label>
      <label>記録時間（分）
        <input name="minutes" type="number" min="1"
          max="${minutes}" value="${minutes}" required>
      </label>
      <label>メモ
        <textarea name="note" maxlength="500"></textarea>
      </label>
      <p>計測時間：${formatMinutes(minutes)}</p>
    `, "記録する");

    if (!result) return;

    const success = addStudyRecord({
      subject: result.subject,
      item: result.item,
      minutes: result.minutes,
      note: result.note,
      date: todayKey()
    });

    if (success) resetTimer();
  }

  /* =======================================================
     ホーム
     ======================================================= */

  function renderHome() {
    const minutes = totalForDate(todayKey());
    const goal = Math.max(1, Number(data.settings.dailyGoal) || 120);
    const percent = Math.min(100, Math.round(minutes / goal * 100));

    setText("#home-today-time", formatMinutes(minutes));
    setText("#home-goal-percent", `${percent}%`);
    setText("#home-goal-message",
      minutes >= goal
        ? "今日の目標達成！"
        : `目標まであと ${formatMinutes(goal - minutes)}`
    );
    setWidth("#home-goal-progress", percent);

    const rocketData = safeCall(rocket, "getRocket");
    const rocketName = rocketData?.name || data.rocket.name || "COSMOS";
    const rocketLevel = rocketData?.level || data.rocket.level || 1;
    const rocketExp = rocketData?.exp ?? data.rocket.exp ?? 0;

    setText("#home-rocket-level", `Lv.${rocketLevel}`);
    setText("#home-rocket-exp", `${rocketExp} EXP`);
    setWidth("#home-rocket-progress", rocketExp % 100);
    setText("#home-next-mission",
      data.studyItems[0]
        ? `${data.studyItems[0].subject}：${data.studyItems[0].name}`
        : "学習項目を登録しよう"
    );

    renderHomeSchedule();
    renderHomeCountdown();
  }

  function renderHomeSchedule() {
    const list = $("#home-schedule-list");
    if (!list) return;

    const events = data.events
      .filter(event => event.date === todayKey())
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    const rows = [
      ...events.map(event => ({
        time: event.time || "",
        title: event.title,
        type: "予定"
      })),
      ...recordsForDate(todayKey()).map(record => ({
        time: "",
        title: `${record.subject}${record.item ? `：${record.item}` : ""}（${formatMinutes(record.minutes)}）`,
        type: "実績"
      }))
    ].sort((a, b) => a.time.localeCompare(b.time));

    list.innerHTML = rows.map(row => `
      <article class="schedule-row">
        <span>${escapeHTML(row.time || "—")}</span>
        <span class="schedule-type">${row.type}</span>
        <span>${escapeHTML(row.title)}</span>
      </article>
    `).join("") || "<p>今日の予定・実績はありません。</p>";
  }

  function renderHomeCountdown() {
    const list = $("#home-countdown-list");
    if (!list) return;

    const today = parseDate(todayKey());

    list.innerHTML = [...data.countdowns]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .map(item => {
        const days = Math.round(
          (parseDate(item.date) - today) / 86400000
        );

        return `
          <article class="countdown-row">
            <strong>${escapeHTML(item.title)}</strong>
            <span>${days < 0 ? `${Math.abs(days)}日超過` : `あと ${days} 日`}</span>
          </article>
        `;
      }).join("") || "<p>カウントダウンはありません。</p>";
  }

  /* =======================================================
     カレンダー
     ======================================================= */

  function renderCalendar() {
    setText("#calendar-month-label",
      `${calendarMonth.getFullYear()}年${calendarMonth.getMonth() + 1}月`);
    setText("#calendar-selected-date-label", selectedDate);

    const grid = $("#calendar-grid");

    if (grid) {
      const year = calendarMonth.getFullYear();
      const month = calendarMonth.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const headers = ["日", "月", "火", "水", "木", "金", "土"];

      let html = headers.map(day =>
        `<div class="calendar-weekday">${day}</div>`
      ).join("");

      for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-empty"></div>';
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const key = dateKey(new Date(year, month, day));
        const hasEvent = data.events.some(event => event.date === key);
        const hasStudy = data.studyRecords.some(record => record.date === key);

        html += `
          <button type="button"
            class="calendar-day${key === selectedDate ? " selected" : ""}${key === todayKey() ? " today" : ""}"
            data-calendar-date="${key}">
            <span>${day}</span>
            ${hasEvent ? '<i class="calendar-dot event-dot"></i>' : ""}
            ${hasStudy ? '<i class="calendar-dot study-dot"></i>' : ""}
          </button>
        `;
      }

      grid.innerHTML = html;
    }

    renderSelectedDay();
    renderTimetable();
    renderTasks();
  }

  function renderSelectedDay() {
    const list = $("#calendar-event-list");
    if (!list) return;

    const events = data.events
      .filter(event => event.date === selectedDate)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    const records = recordsForDate(selectedDate);

    const entries = [
      ...events.map(event => ({
        id: event.id,
        type: "予定",
        time: event.time || "",
        title: event.title,
        detail: event.note || ""
      })),
      ...records.map(record => ({
        id: record.id,
        type: "実績",
        time: "",
        title: `${record.subject}${record.item ? `：${record.item}` : ""}`,
        detail: formatMinutes(record.minutes)
      }))
    ].sort((a, b) => a.time.localeCompare(b.time));

    list.innerHTML = entries.map(entry => `
      <article class="day-entry">
        <span class="entry-type">${entry.type}</span>
        <strong>${escapeHTML(entry.title)}</strong>
        <span>${escapeHTML(entry.time || entry.detail)}</span>
        ${entry.type === "予定"
          ? `<button type="button" data-delete-event="${escapeHTML(entry.id)}">削除</button>`
          : ""}
      </article>
    `).join("") || "<p>この日の予定・実績はありません。</p>";
  }

  async function addEvent() {
    const result = await dialog("予定を追加", `
      <label>予定名
        <input name="title" required maxlength="120">
      </label>
      <label>日付
        <input name="date" type="date" required value="${selectedDate}">
      </label>
      <label>開始時刻
        <input name="time" type="time">
      </label>
      <label>メモ
        <textarea name="note" maxlength="500"></textarea>
      </label>
    `);

    if (!result?.title || !result?.date) return;

    const event = {
      id: uid("event"),
      title: result.title,
      date: result.date,
      time: result.time || "",
      note: result.note || ""
    };

    data.events.push(event);
    safeCall(calendar, "addEvent", event);

    selectedDate = result.date;
    calendarMonth = parseDate(result.date);

    saveLegacyData();
    renderAll();
    showMessage("予定を追加しました。");
  }

  function renderTimetable() {
    const body = $("#timetable-body");
    if (!body) return;

    const days = ["月", "火", "水", "木", "金", "土", "日"];
    const hours = Array.from({ length: 20 }, (_, index) => (index + 6) % 24);

    body.innerHTML = hours.map(hour => `
      <tr>
        <th>${String(hour).padStart(2, "0")}:00</th>
        ${days.map((day, index) => {
          const entries = data.timetable.filter(item =>
            Number(item.day) === index && Number(item.hour) === hour
          );

          return `<td>${entries.map(item =>
            `<div class="timetable-entry">${escapeHTML(item.title)}</div>`
          ).join("")}</td>`;
        }).join("")}
      </tr>
    `).join("");
  }

  async function editTimetable() {
    const result = await dialog("時間割に追加", `
      <label>曜日
        <select name="day">
          <option value="0">月曜日</option>
          <option value="1">火曜日</option>
          <option value="2">水曜日</option>
          <option value="3">木曜日</option>
          <option value="4">金曜日</option>
          <option value="5">土曜日</option>
          <option value="6">日曜日</option>
        </select>
      </label>
      <label>時刻
        <select name="hour">
          ${Array.from({ length: 20 }, (_, i) => {
            const hour = (i + 6) % 24;
            return `<option value="${hour}">${String(hour).padStart(2, "0")}:00</option>`;
          }).join("")}
        </select>
      </label>
      <label>授業・予定名
        <input name="title" required maxlength="100">
      </label>
    `);

    if (!result?.title) return;

    data.timetable.push({
      id: uid("timetable"),
      day: Number(result.day),
      hour: Number(result.hour),
      title: result.title
    });

    saveLegacyData();
    renderTimetable();
    showMessage("時間割を保存しました。");
  }

  async function addTask() {
    const result = await dialog("タスクを追加", `
      <label>タスク名
        <input name="title" required maxlength="120">
      </label>
      <label>期限
        <input name="date" type="date" value="${todayKey()}">
      </label>
    `);

    if (!result?.title) return;

    data.tasks.push({
      id: uid("task"),
      title: result.title,
      date: result.date || todayKey(),
      done: false
    });

    saveLegacyData();
    renderTasks();
    renderHome();
    showMessage("タスクを追加しました。");
  }

  function renderTasks() {
    const list = $("#task-list");
    if (!list) return;

    list.innerHTML = data.tasks.map(task => `
      <article class="task-row${task.done ? " completed" : ""}">
        <label>
          <input type="checkbox" data-task-done="${escapeHTML(task.id)}"
            ${task.done ? "checked" : ""}>
          <span>${escapeHTML(task.title)}</span>
        </label>
        <small>${escapeHTML(task.date || "")}</small>
        <button type="button" data-delete-task="${escapeHTML(task.id)}">削除</button>
      </article>
    `).join("") || "<p>タスクはありません。</p>";
  }

  /* =======================================================
     統計・グラフ
     ======================================================= */

  function renderStatistics() {
    const today = totalForDate(todayKey());
    const goal = Number(data.settings.dailyGoal) || 120;

    setText("#stats-today-time", formatMinutes(today));
    setText("#stats-today-goal", formatMinutes(goal));
    setText("#stats-today-progress",
      `${Math.min(100, Math.round(today / Math.max(1, goal) * 100))}%`);

    safeCall(statistics, "getDashboard");
    drawSubjectChart();
    drawBarChart("#daily-bar-chart", 7);
    drawBarChart("#weekly-bar-chart", 7, true);
    drawBarChart("#monthly-bar-chart", 30);
  }

  function drawSubjectChart() {
    const canvas = $("#subject-doughnut-chart");
    const legend = $("#subject-chart-legend");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.38;
    const innerRadius = radius * 0.58;

    const values = data.subjects.map(subject => ({
      ...subject,
      minutes: totalMinutes(data.studyRecords.filter(
        record => record.subject === subject.name
      ))
    })).filter(subject => subject.minutes > 0);

    const total = values.reduce((sum, item) => sum + item.minutes, 0);

    ctx.clearRect(0, 0, width, height);

    if (!total) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#24324f";
      ctx.lineWidth = radius - innerRadius;
      ctx.stroke();
    } else {
      let angle = -Math.PI / 2;

      values.forEach(item => {
        const next = angle + item.minutes / total * Math.PI * 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, angle, next);
        ctx.strokeStyle = item.color || "#69a7ff";
        ctx.lineWidth = radius - innerRadius;
        ctx.stroke();

        angle = next;
      });
    }

    ctx.fillStyle = "#f2f5ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(formatMinutes(total), centerX, centerY);

    if (legend) {
      legend.innerHTML = values.map(item => `
        <div class="chart-legend-item">
          <span style="background:${escapeHTML(item.color)}"></span>
          ${escapeHTML(item.name)}：${formatMinutes(item.minutes)}
        </div>
      `).join("") || "<p>学習記録を追加するとグラフが表示されます。</p>";
    }
  }

  function drawBarChart(selector, count, weekly = false) {
    const canvas = $(selector);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const padding = 24;
    const today = parseDate(todayKey());
    const values = [];

    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      values.push({
        date,
        value: totalForDate(dateKey(date))
      });
    }

    const max = Math.max(60, ...values.map(item => item.value));
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;
    const slot = chartWidth / values.length;
    const barWidth = Math.max(3, slot * 0.56);

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(170,193,255,.15)";
    ctx.lineWidth = 1;

    for (let i = 0; i < 4; i++) {
      const y = padding + chartHeight * i / 3;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    values.forEach((item, index) => {
      const barHeight = item.value / max * chartHeight;
      const x = padding + slot * index + (slot - barWidth) / 2;
      const y = height - padding - barHeight;

      ctx.fillStyle = "#69a7ff";
      ctx.beginPath();

      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, barWidth, Math.max(2, barHeight), 4);
      } else {
        ctx.rect(x, y, barWidth, Math.max(2, barHeight));
      }

      ctx.fill();

      ctx.fillStyle = "#aab7d2";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `${item.date.getMonth() + 1}/${item.date.getDate()}`,
        x + barWidth / 2,
        height - 7
      );
    });
  }

  /* =======================================================
     目標マップ・習慣
     ======================================================= */

  function renderGoals() {
    const list = $("#goal-list");
    if (!list) return;

    const completed = data.goals.filter(goal => goal.done).length;

    setText("#goal-map-completion", `${completed}/${data.goals.length}`);
    setWidth("#goal-map-progress",
      data.goals.length ? completed / data.goals.length * 100 : 0);

    list.innerHTML = data.goals.map(goal => `
      <article class="goal-card${goal.done ? " completed" : ""}">
        <label>
          <input type="checkbox" data-goal-done="${escapeHTML(goal.id)}"
            ${goal.done ? "checked" : ""}>
          <strong>${escapeHTML(goal.title)}</strong>
        </label>
        ${goal.date ? `<small>${escapeHTML(goal.date)}</small>` : ""}
        <button type="button" data-delete-goal="${escapeHTML(goal.id)}">削除</button>
      </article>
    `).join("") || "<p>目標を登録して、達成への道筋を作りましょう。</p>";

    renderGoalTree();
    renderHabits();
  }

  function renderGoalTree() {
    const canvas = $("#goal-map-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(rect.width, 280);

    const moduleMap = safeCall(goals, "getMapData");
    const moduleNodes = Array.isArray(moduleMap)
      ? moduleMap
      : moduleMap?.nodes;

    const nodes = data.goalNodes.length
      ? data.goalNodes
      : Array.isArray(moduleNodes) && moduleNodes.length
        ? moduleNodes
        : [{
            id: "root",
            title: "月を目指す",
            parentId: null,
            done: false
          }];

    const height = Math.max(400, Math.ceil(nodes.length / 3) * 110 + 100);

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const positions = new Map();
    const centerX = width / 2;

    nodes.forEach((node, index) => {
      positions.set(node.id, {
        x: centerX + ((index % 3) - 1) * Math.min(90, width * 0.24),
        y: 55 + Math.floor(index / 3) * 100
      });
    });

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(105,167,255,.6)";

    nodes.forEach(node => {
      if (!node.parentId || !positions.has(node.parentId)) return;

      const from = positions.get(node.parentId);
      const to = positions.get(node.id);

      ctx.beginPath();
      ctx.moveTo(from.x, from.y + 22);
      ctx.lineTo(to.x, to.y - 22);
      ctx.stroke();
    });

    nodes.forEach(node => {
      const point = positions.get(node.id);
      if (!point) return;

      ctx.beginPath();
      ctx.arc(point.x, point.y, node.id === "root" ? 27 : 22, 0, Math.PI * 2);
      ctx.fillStyle = node.done ? "#246e69" :
        node.id === "root" ? "#594b9c" : "#172c4d";
      ctx.fill();

      ctx.strokeStyle = node.done ? "#76e3b0" : "#69a7ff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#f2f5ff";
      ctx.textAlign = "center";
      ctx.font = "11px sans-serif";
      ctx.fillText(String(node.title || "").slice(0, 12), point.x, point.y + 38);
    });
  }

  async function addGoal() {
    const result = await dialog("目標を追加", `
      <label>目標
        <input name="title" required maxlength="120">
      </label>
      <label>期限
        <input name="date" type="date">
      </label>
    `);

    if (!result?.title) return;

    const goal = {
      id: uid("goal"),
      title: result.title,
      date: result.date || "",
      done: false
    };

    data.goals.push(goal);
    safeCall(goals, "addGoal", goal);

    saveLegacyData();
    renderGoals();
    showMessage("目標を追加しました。");
  }

  async function addGoalNode() {
    const options = data.goalNodes.map(node =>
      `<option value="${escapeHTML(node.id)}">${escapeHTML(node.title)}</option>`
    ).join("");

    const result = await dialog("スキルツリーに追加", `
      <label>ノード名
        <input name="title" required maxlength="80">
      </label>
      <label>接続先
        <select name="parentId">
          <option value="">月への最初の目標</option>
          ${options}
        </select>
      </label>
    `);

    if (!result?.title) return;

    data.goalNodes.push({
      id: uid("node"),
      title: result.title,
      parentId: result.parentId || null,
      done: false
    });

    saveLegacyData();
    renderGoals();
    showMessage("スキルツリーにノードを追加しました。");
  }

  async function addHabit() {
    const result = await dialog("習慣を追加", `
      <label>習慣名
        <input name="title" required maxlength="100">
      </label>
    `);

    if (!result?.title) return;

    data.habits.push({
      id: uid("habit"),
      title: result.title,
      dates: []
    });

    saveLegacyData();
    renderHabits();
    showMessage("習慣を追加しました。");
  }

  function renderHabits() {
    const list = $("#habit-list");
    if (!list) return;

    list.innerHTML = data.habits.map(habit => {
      const dates = Array.isArray(habit.dates) ? habit.dates : [];
      const doneToday = dates.includes(todayKey());

      return `
        <article class="habit-row">
          <label>
            <input type="checkbox" data-habit="${escapeHTML(habit.id)}"
              ${doneToday ? "checked" : ""}>
            ${escapeHTML(habit.title)}
          </label>
          <small>達成 ${dates.length}日</small>
        </article>
      `;
    }).join("") || "<p>習慣を登録しましょう。</p>";
  }

  /* =======================================================
     ロケット
     ======================================================= */

  function renderRocket() {
    const moduleRocket = safeCall(rocket, "getRocket") || {};

    const name = moduleRocket.name || data.rocket.name || "COSMOS";
    const level = Number(moduleRocket.level || data.rocket.level || 1);
    const exp = Number(moduleRocket.exp ?? data.rocket.exp ?? 0);

    setText("#rocket-name", name);
    setText("#rocket-level", `Lv.${level}`);
    setText("#rocket-exp-label", `${exp}/100 EXP`);
    setWidth("#rocket-exp-progress", exp);

    const missionList = $("#mission-list");
    if (missionList) {
      missionList.innerHTML = (data.rocket.missions || []).map(item =>
        `<article>${escapeHTML(item.title)}</article>`
      ).join("") || "<p>ミッションは今後追加できます。</p>";
    }

    const partsList = $("#rocket-parts-list");
    if (partsList) {
      partsList.innerHTML = (data.rocket.parts || []).map(item =>
        `<article>${escapeHTML(item.title)}</article>`
      ).join("") || "<p>パーツはまだありません。</p>";
    }

    const explorationList = $("#space-exploration-list");
    if (explorationList) {
      explorationList.innerHTML = (data.rocket.explorations || []).map(item =>
        `<article>${escapeHTML(item.title)}</article>`
      ).join("") || "<p>学習を積み重ねて宇宙を目指しましょう。</p>";
    }
  }

  /* =======================================================
     経済
     ======================================================= */

  function renderEconomy() {
    const moduleSummary = safeCall(economy, "getSummary");

    const balance = Number(
      moduleSummary?.balance ?? data.economy.balance ?? 0
    );

    setText("#economy-balance", `${balance.toLocaleString()} コスモ`);
    setText("#economy-net-worth", `${balance.toLocaleString()} コスモ`);

    const loans = $("#economy-loan-list");
    if (loans) {
      loans.innerHTML = (data.economy.loans || []).map(loan => `
        <article>
          <strong>${escapeHTML(loan.title || "借入")}</strong>
          <span>${Number(loan.amount || 0).toLocaleString()} コスモ</span>
        </article>
      `).join("") || "<p>借入はありません。</p>";
    }

    const transactions = $("#economy-transaction-list");
    if (transactions) {
      transactions.innerHTML = [...(data.economy.transactions || [])]
        .reverse().slice(0, 50).map(item => `
          <article>
            <span>${escapeHTML(item.date || "")}</span>
            <span>${escapeHTML(item.title || "")}</span>
            <strong>${Number(item.amount) >= 0 ? "+" : ""}${Number(item.amount || 0).toLocaleString()}</strong>
          </article>
        `).join("") || "<p>取引履歴はありません。</p>";
    }
  }

  async function economyTransaction(type) {
    const labels = {
      deposit: "預け入れ",
      withdraw: "引き出し",
      borrow: "借入"
    };

    const result = await dialog(`${labels[type]}する`, `
      <label>金額
        <input name="amount" type="number" min="1" step="1" required>
      </label>
      <label>内容
        <input name="title" maxlength="100" placeholder="${labels[type]}">
      </label>
    `);

    if (!result) return;

    const amount = Math.floor(Number(result.amount));

    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage("正しい金額を入力してください。");
      return;
    }

    if (type === "withdraw" && amount > data.economy.balance) {
      showMessage("残高が不足しています。");
      return;
    }

    /*
     * 経済モジュールの公開メソッドが確認できる場合はそちらを優先。
     * ここでは旧画面データも更新して表示との互換性を保つ。
     */
    const methodMap = {
      deposit: "deposit",
      withdraw: "withdraw",
      borrow: "borrow"
    };

    const resultFromModule = safeCall(
      economy,
      methodMap[type],
      amount,
      result.title || labels[type]
    );

    if (resultFromModule !== undefined) {
      renderEconomy();
      showMessage("経済処理を実行しました。");
      return;
    }

    if (type === "deposit") data.economy.balance += amount;
    if (type === "withdraw") data.economy.balance -= amount;

    if (type === "borrow") {
      data.economy.loans.push({
        id: uid("loan"),
        title: result.title || "借入",
        amount,
        date: todayKey()
      });
      data.economy.balance += amount;
    }

    data.economy.transactions.push({
      id: uid("transaction"),
      date: todayKey(),
      title: result.title || labels[type],
      amount: type === "withdraw" ? -amount : amount,
      type
    });

    saveLegacyData();
    renderEconomy();
    showMessage("取引を保存しました。");
  }

  /* =======================================================
     カウントダウン
     ======================================================= */

  async function addCountdown() {
    const result = await dialog("カウントダウンを追加", `
      <label>イベント名
        <input name="title" required maxlength="100">
      </label>
      <label>日付
        <input name="date" type="date" required>
      </label>
    `);

    if (!result?.title || !result?.date) return;

    const item = {
      id: uid("countdown"),
      title: result.title,
      date: result.date
    };

    data.countdowns.push(item);
    safeCall(countdown, "add", item);
    safeCall(countdown, "addCountdown", item);

    saveLegacyData();
    renderCountdown();
    renderHomeCountdown();
    showMessage("カウントダウンを追加しました。");
  }

  function renderCountdown() {
    const list = $("#countdown-list");
    if (!list) return;

    const today = parseDate(todayKey());

    list.innerHTML = [...data.countdowns]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => {
        const days = Math.round(
          (parseDate(item.date) - today) / 86400000
        );

        return `
          <article class="countdown-card">
            <div>
              <strong>${escapeHTML(item.title)}</strong>
              <small>${escapeHTML(item.date)}</small>
            </div>
            <strong>${days < 0 ? `${Math.abs(days)}日超過` : `あと${days}日`}</strong>
            <button type="button"
              data-delete-countdown="${escapeHTML(item.id)}">削除</button>
          </article>
        `;
      }).join("") || "<p>イベントを追加してください。</p>";
  }

  /* =======================================================
     通知
     ======================================================= */

  function renderNotifications() {
    const list = $("#notification-list");
    if (!list) return;

    list.innerHTML = data.notifications.map(item => `
      <article>
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.message || "")}</p>
      </article>
    `).join("") || "<p>通知はありません。</p>";
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      showMessage("この環境では通知に対応していません。");
      return;
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        new Notification("One for All COSMOS", {
          body: "通知を有効にしました。"
        });
        showMessage("通知を有効にしました。");
      } else {
        showMessage("通知は許可されませんでした。");
      }
    } catch (error) {
      console.error(error);
      showMessage("通知を有効にできませんでした。");
    }
  }

  /* =======================================================
     設定
     ======================================================= */

  function renderSettings() {
    let settings;

    try {
      settings = getSettings();
    } catch (error) {
      console.error("設定を取得できませんでした:", error);
      settings = data.settings;
    }

    if (!settings || typeof settings !== "object") {
      settings = data.settings;
    }

    setValue("#setting-daily-goal",
      settings.dailyGoalMinutes ?? settings.dailyGoal ?? data.settings.dailyGoal);

    setValue("#setting-weekly-goal",
      settings.weeklyGoalMinutes ?? settings.weeklyGoal ?? data.settings.weeklyGoal);

    setValue("#setting-minimum-action",
      settings.minimumActionMinutes ?? settings.minimumAction ?? data.settings.minimumAction);

    setChecked("#setting-animations",
      settings.animations ?? data.settings.animations);

    setValue("#setting-theme", settings.theme || data.settings.theme);

    $$('input[name="bottomShortcut"]').forEach(input => {
      input.checked = (settings.shortcuts || data.settings.shortcuts)
        .includes(input.value);
    });

    renderBottomNavigation();
  }

  function saveSettingsFromForm(event) {
    event?.preventDefault();

    const dailyGoal = Math.max(
      1,
      Number($("#setting-daily-goal")?.value) || 120
    );

    const weeklyGoal = Math.max(
      1,
      Number($("#setting-weekly-goal")?.value) || 840
    );

    const minimumAction = Math.max(
      1,
      Number($("#setting-minimum-action")?.value) || 5
    );

    const animations = $("#setting-animations")?.checked ?? true;
    const theme = $("#setting-theme")?.value || "cosmos";
    const shortcuts = $$('input[name="bottomShortcut"]:checked')
      .map(input => input.value);

    data.settings = {
      ...data.settings,
      dailyGoal,
      weeklyGoal,
      minimumAction,
      animations,
      theme,
      shortcuts
    };

    try {
      saveSettings({
        dailyGoalMinutes: dailyGoal,
        weeklyGoalMinutes: weeklyGoal,
        minimumActionMinutes: minimumAction,
        animations,
        theme,
        shortcuts,
        shareStudyRecords: false
      });
    } catch (error) {
      console.error("設定モジュールへの保存に失敗しました:", error);
    }

    document.body.classList.toggle("animations-disabled", !animations);
    document.documentElement.dataset.theme = theme;

    saveLegacyData();
    renderBottomNavigation();
    renderHome();
    showMessage("設定を保存しました。");
  }

  function renderBottomNavigation() {
    const nav = $("#bottom-navigation");
    if (!nav) return;

    const shortcuts = data.settings.shortcuts || [];

    $$("[data-shortcut]", nav).forEach(button => {
      button.hidden = !shortcuts.includes(button.dataset.shortcut);
    });

    nav.hidden = shortcuts.length === 0;
  }

  /* =======================================================
     全画面更新
     ======================================================= */

  function renderAll() {
    renderHome();
    renderStudy();
    renderCalendar();
    renderStatistics();
    renderGoals();
    renderRocket();
    renderEconomy();
    renderCountdown();
    renderNotifications();
    renderSettings();
    renderBottomNavigation();
  }

  /* =======================================================
     イベント登録
     ======================================================= */

  function bindEvents() {
    $("#menu-open")?.addEventListener("click", openMenu);
    $("#menu-close")?.addEventListener("click", closeMenu);
    $("#menu-backdrop")?.addEventListener("click", closeMenu);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    });

    document.addEventListener("click", event => {
      const viewButton = event.target.closest("[data-view]");

      if (viewButton) {
        showView(viewButton.dataset.view);
        return;
      }

      const actionButton = event.target.closest("[data-action]");

      if (actionButton) {
        const action = actionButton.dataset.action;

        if (action === "start-study") {
          showView("study");
          startTimer();
        }

        if (action === "timer-start") startTimer();
        if (action === "timer-pause") pauseTimer();
        if (action === "timer-finish") finishTimer();

        return;
      }

      const button = event.target.closest("button");
      if (!button) return;

      if (button.dataset.deleteRecord) {
        if (!confirm("この学習記録を削除しますか？")) return;

        data.studyRecords = data.studyRecords.filter(record =>
          record.id !== button.dataset.deleteRecord
        );

        saveLegacyData();
        renderAll();
        showMessage("学習記録を削除しました。");
      }

      if (button.dataset.removeSubject) {
        const subject = data.subjects.find(item =>
          item.id === button.dataset.removeSubject
        );

        if (!subject || !confirm(
          `教科「${subject.name}」を削除しますか？過去の記録は残ります。`
        )) return;

        data.subjects = data.subjects.filter(item =>
          item.id !== subject.id
        );

        saveLegacyData();
        renderStudy();
      }

      if (button.dataset.deleteEvent) {
        data.events = data.events.filter(item =>
          item.id !== button.dataset.deleteEvent
        );

        saveLegacyData();
        renderCalendar();
        renderHome();
      }

      if (button.dataset.deleteTask) {
        data.tasks = data.tasks.filter(item =>
          item.id !== button.dataset.deleteTask
        );

        saveLegacyData();
        renderTasks();
        renderHome();
      }

      if (button.dataset.deleteGoal) {
        data.goals = data.goals.filter(item =>
          item.id !== button.dataset.deleteGoal
        );

        saveLegacyData();
        renderGoals();
      }

      if (button.dataset.deleteCountdown) {
        data.countdowns = data.countdowns.filter(item =>
          item.id !== button.dataset.deleteCountdown
        );

        saveLegacyData();
        renderCountdown();
        renderHomeCountdown();
      }

      if (button.id === "add-subject") addSubject();
      if (button.id === "add-study-item") addStudyItem();
      if (button.id === "add-event") addEvent();
      if (button.id === "edit-timetable") editTimetable();
      if (button.id === "add-task") addTask();
      if (button.id === "add-goal") addGoal();
      if (button.id === "add-goal-map-node") addGoalNode();
      if (button.id === "add-habit") addHabit();
      if (button.id === "add-countdown") addCountdown();
      if (button.id === "enable-notifications") enableNotifications();

      if (button.id === "calendar-prev") {
        calendarMonth = new Date(
          calendarMonth.getFullYear(),
          calendarMonth.getMonth() - 1,
          1
        );
        renderCalendar();
      }

      if (button.id === "calendar-next") {
        calendarMonth = new Date(
          calendarMonth.getFullYear(),
          calendarMonth.getMonth() + 1,
          1
        );
        renderCalendar();
      }

      if (button.id === "economy-deposit") economyTransaction("deposit");
      if (button.id === "economy-withdraw") economyTransaction("withdraw");
      if (button.id === "economy-borrow") economyTransaction("borrow");
    });

    $("#manual-study-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const success = addStudyRecord({
        subject: $("#manual-study-subject")?.value,
        item: $("#manual-study-item")?.value,
        date: $("#manual-study-date")?.value || todayKey(),
        minutes: $("#manual-study-minutes")?.value,
        note: $("#manual-study-note")?.value
      });

      if (success) {
        event.target.reset();
        setValue("#manual-study-date", todayKey());
      }
    });

    $("#settings-study-form")?.addEventListener(
      "submit",
      saveSettingsFromForm
    );

    $("#calendar-grid")?.addEventListener("click", event => {
      const button = event.target.closest("[data-calendar-date]");
      if (!button) return;

      selectedDate = button.dataset.calendarDate;
      renderCalendar();
    });

    $("#cosmos-dialog-confirm")?.addEventListener("click", event => {
      event.preventDefault();

      const result = readDialogFields();
      if (!result) return;

      closeDialog(result);
    });

    $("#cosmos-dialog")?.addEventListener("click", event => {
      if (event.target === $("#cosmos-dialog")) closeDialog(null);
    });

    $("#cosmos-dialog")?.addEventListener("cancel", event => {
      event.preventDefault();
      closeDialog(null);
    });

    document.addEventListener("change", event => {
      const input = event.target;

      if (input.matches("[data-task-done]")) {
        const task = data.tasks.find(item =>
          item.id === input.dataset.taskDone
        );

        if (task) task.done = input.checked;
        saveLegacyData();
        renderTasks();
      }

      if (input.matches("[data-goal-done]")) {
        const goal = data.goals.find(item =>
          item.id === input.dataset.goalDone
        );

        if (goal) goal.done = input.checked;
        saveLegacyData();
        renderGoals();
      }

      if (input.matches("[data-habit]")) {
        const habit = data.habits.find(item =>
          item.id === input.dataset.habit
        );

        if (!habit) return;

        habit.dates = (habit.dates || []).filter(
          date => date !== todayKey()
        );

        if (input.checked) habit.dates.push(todayKey());

        saveLegacyData();
        renderHabits();
      }
    });

    window.addEventListener("resize", () => {
      if (currentView === "statistics") renderStatistics();
      if (currentView === "goals") renderGoalTree();
    });
  }

  /* =======================================================
     初期化
     ======================================================= */

  function init() {
    $$(".page-section").forEach(section => {
      const active = section.id === "view-home";
      section.hidden = !active;
      section.classList.toggle("active", active);
      section.setAttribute("aria-hidden", String(!active));
    });

    const dialogElement = $("#cosmos-dialog");

    if (dialogElement && !dialogElement.open) {
      dialogElement.removeAttribute("open");
    }

    bindEvents();

    document.body.classList.toggle(
      "animations-disabled",
      !data.settings.animations
    );

    document.documentElement.dataset.theme =
      data.settings.theme || "cosmos";

    renderAll();
    showView("home");

    console.info("One for All COSMOS: ui.js initialized");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
