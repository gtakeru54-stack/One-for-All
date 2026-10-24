
/* =========================================================
   ONE FOR ALL - LEARN
   js/app.js
   学習記録・タイマー・カレンダー・タスク
   ========================================================= */

"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const STORAGE = {
    calendar: "personal-calendar-v1",
    study: "oneforall-study-v1",
    timer: "oneforall-timer-v1"
  };

  const DEFAULT_CATEGORIES = ["講座・授業", "問題演習", "暗記・復習"];
  const CATEGORY_COLORS = ["blue", "purple", "teal", "gold", "pink", "green"];
  const DAY_MS = 24 * 60 * 60 * 1000;

  const now = new Date();
  const dateKey = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const parseDate = (value) => {
    if (!value || typeof value !== "string") return new Date();
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const makeId = () =>
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const displayDate = (key, includeWeekday = true) => {
    if (!key) return "期限なし";
    const date = parseDate(key);
    const weekday = "日月火水木金土"[date.getDay()];
    return `${date.getMonth() + 1}月${date.getDate()}日${includeWeekday ? `（${weekday}）` : ""}`;
  };

  const safeArray = (value) => Array.isArray(value) ? value : [];

  let calendarState = { events: [], tasks: [] };
  let studyState = {
    categories: [...DEFAULT_CATEGORIES],
    records: [],
    dailyGoalMinutes: 120
  };

  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let selectedDate = dateKey(now);
  let toastTimeout = null;
  let timerInterval = null;
  let timerStartedAt = null;
  let timerElapsedBeforeStart = 0;
  let timerRunning = false;
  let timerPaused = false;
  let reminded = new Set();

  let activeView = "home-view";
  let requestedCategory = "";

  /* ---------- 保存と読み込み ---------- */

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(`読み込み失敗: ${key}`, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`保存失敗: ${key}`, error);
      showToast("保存できませんでした。空き容量を確認してください。");
      return false;
    }
  }

  function loadCalendar() {
    const saved = readJSON(STORAGE.calendar, {});
    calendarState = {
      events: safeArray(saved.events).filter((item) => item && typeof item.title === "string"),
      tasks: safeArray(saved.tasks).filter((item) => item && typeof item.title === "string")
    };
  }

  function saveCalendar() {
    return writeJSON(STORAGE.calendar, calendarState);
  }

  function normalizeRecord(record) {
    if (!record || typeof record !== "object") return null;

    const minutes = Number(record.minutes);
    const seconds = Number(record.durationSeconds);

    return {
      id: String(record.id || makeId()),
      category: String(record.category || DEFAULT_CATEGORIES[0]),
      item: String(record.item || record.title || "学習"),
      date: /^\d{4}-\d{2}-\d{2}$/.test(record.date || "") ? record.date : dateKey(),
      durationSeconds: Number.isFinite(seconds) && seconds > 0
        ? Math.round(seconds)
        : Math.max(0, Number.isFinite(minutes) ? Math.round(minutes * 60) : 0),
      notes: String(record.notes || ""),
      createdAt: Number(record.createdAt) || Date.now()
    };
  }

  function loadStudy() {
    const saved = readJSON(STORAGE.study, {});
    const categories = safeArray(saved.categories)
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim());

    studyState = {
      categories: [...new Set([...DEFAULT_CATEGORIES, ...categories])],
      records: safeArray(saved.records).map(normalizeRecord).filter(Boolean),
      dailyGoalMinutes: Math.max(1, Number(saved.dailyGoalMinutes) || 120)
    };
  }

  function saveStudy() {
    return writeJSON(STORAGE.study, studyState);
  }

  function loadTimer() {
    const saved = readJSON(STORAGE.timer, null);
    if (!saved || typeof saved !== "object") return;

    timerElapsedBeforeStart = Math.max(0, Number(saved.elapsedSeconds) || 0);
    timerRunning = Boolean(saved.running && saved.startedAt);
    timerPaused = Boolean(saved.paused);
    timerStartedAt = timerRunning ? Number(saved.startedAt) : null;

    if (timerRunning && !timerPaused && !Number.isFinite(timerStartedAt)) {
      timerRunning = false;
      timerStartedAt = null;
    }

    if (timerRunning) {
      timerPaused = false;
      startTimerTicker();
    } else {
      timerPaused = timerElapsedBeforeStart > 0;
    }
  }

  function saveTimer() {
    writeJSON(STORAGE.timer, {
      elapsedSeconds: getElapsedSeconds(),
      running: timerRunning,
      paused: timerPaused,
      startedAt: timerStartedAt
    });
  }

  /* ---------- 共通UI ---------- */

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  $$(".close-dialog").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest("dialog")));
  });

  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });

  /* ---------- 画面切り替え ---------- */

  function showView(viewId) {
    const target = document.getElementById(viewId);
    if (!target || !target.classList.contains("view")) return;

    activeView = viewId;

    $$(".view").forEach((view) => {
      const isActive = view.id === viewId;
      view.classList.toggle("active", isActive);
      view.hidden = !isActive;
    });

    $$(".nav-item").forEach((button) => {
      const isActive = button.dataset.go === viewId;
      button.classList.toggle("active", isActive);
      if (isActive) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    if (viewId === "calendar-view") renderCalendarAll();
    if (viewId === "study-view") renderStudyAll();
    if (viewId === "timer-view") {
      updateTimerUI();
      renderTimerTodayRecords();
    }
    if (viewId === "home-view") renderHome();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-go]");
    if (!button) return;

    const viewId = button.dataset.go;
    if (button.dataset.category) requestedCategory = button.dataset.category;

    showView(viewId);

    if (viewId === "study-view" && requestedCategory) {
      const filter = $("#record-filter");
      if (filter && studyState.categories.includes(requestedCategory)) {
        filter.value = requestedCategory;
        renderStudyRecords();
      }
      requestedCategory = "";
    }
  });

  $("#header-date-text").textContent = displayDate(dateKey(), false);

  /* ---------- 学習時間の集計 ---------- */

  function secondsForDate(date) {
    return studyState.records
      .filter((record) => record.date === date)
      .reduce((sum, record) => sum + record.durationSeconds, 0);
  }

  function secondsForLastSevenDays() {
    const today = parseDate(dateKey());
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const startKey = dateKey(start);
    const endKey = dateKey(today);

    return studyState.records
      .filter((record) => record.date >= startKey && record.date <= endKey)
      .reduce((sum, record) => sum + record.durationSeconds, 0);
  }

  function secondsForAllTime() {
    return studyState.records.reduce((sum, record) => sum + record.durationSeconds, 0);
  }

  function formatDuration(seconds, compact = false) {
    const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (compact) {
      if (hours > 0) return `${hours}時間${minutes}分`;
      return `${minutes}分`;
    }
    return `${hours}時間 ${minutes}分`;
  }

  function formatTimer(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
  }

  function getCategoryColor(category) {
    const index = Math.max(0, studyState.categories.indexOf(category));
    return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  }

  function getCategoryClass(category) {
    return `category-${getCategoryColor(category)}`;
  }

  function getCategoryOptionsHtml(selected = "") {
    return studyState.categories.map((category) =>
      `<option value="${escapeHtml(category)}"${category === selected ? " selected" : ""}>${escapeHtml(category)}</option>`
    ).join("");
  }

  function refreshCategorySelects() {
    const timerCategory = $("#timer-category");
    const recordCategory = $("#record-category");
    const filter = $("#record-filter");

    const oldTimer = timerCategory?.value || DEFAULT_CATEGORIES[0];
    const oldRecord = recordCategory?.value || DEFAULT_CATEGORIES[0];
    const oldFilter = filter?.value || "all";

    if (timerCategory) timerCategory.innerHTML = getCategoryOptionsHtml(oldTimer);
    if (recordCategory) recordCategory.innerHTML = getCategoryOptionsHtml(oldRecord);

    if (filter) {
      filter.innerHTML = `<option value="all">すべてのカテゴリー</option>${getCategoryOptionsHtml()}`;
      filter.value = studyState.categories.includes(oldFilter) ? oldFilter : "all";
    }
  }

  function renderHomeStats() {
    const todaySeconds = secondsForDate(dateKey());
    const weekSeconds = secondsForLastSevenDays();
    const allSeconds = secondsForAllTime();
    const goalSeconds = studyState.dailyGoalMinutes * 60;
    const percent = goalSeconds > 0 ? Math.min(100, Math.round(todaySeconds / goalSeconds * 100)) : 0;

    $("#home-today-time").innerHTML =
      `${Math.floor(todaySeconds / 3600)}<span>時間</span> ${Math.floor((todaySeconds % 3600) / 60)}<span>分</span>`;

    $("#home-progress-bar").style.width = `${percent}%`;
    $("#home-progress-text").textContent = `今日の目標 ${percent}%`;
    $("#home-goal-label").textContent = `目標 ${formatDuration(goalSeconds, true)}`;

    $("#stat-today").textContent = formatDuration(todaySeconds, true);
    $("#stat-week").textContent = formatDuration(weekSeconds, true);
    $("#stat-total").textContent = formatDuration(allSeconds, true);

    $("#study-today-total").textContent = formatDuration(todaySeconds, true);
    $("#study-week-total").textContent = formatDuration(weekSeconds, true);
    $("#study-all-total").textContent = formatDuration(allSeconds, true);
  }

  /* ---------- 学習記録一覧 ---------- */

  function recordCardHtml(record, showActions = true) {
    const colorClass = getCategoryClass(record.category);
    const duration = formatDuration(record.durationSeconds, true);
    const note = record.notes ? `<p class="record-note">${escapeHtml(record.notes)}</p>` : "";

    return `
      <article class="record-card">
        <span class="record-accent ${colorClass}"></span>
        <div class="record-main">
          <div class="record-topline">
            <span class="category-pill ${colorClass}">${escapeHtml(record.category)}</span>
            <time>${escapeHtml(displayDate(record.date, false))}</time>
          </div>
          <h3>${escapeHtml(record.item)}</h3>
          <p class="record-duration">◷ ${escapeHtml(duration)}</p>
          ${note}
        </div>
        ${showActions ? `<button class="record-edit" type="button" data-edit-record="${escapeHtml(record.id)}" aria-label="${escapeHtml(record.item)}を編集">•••</button>` : ""}
      </article>
    `;
  }

  function emptyHtml(message) {
    return `<div class="empty-state"><span class="empty-star" aria-hidden="true">✧</span><p>${escapeHtml(message)}</p></div>`;
  }

  function renderHomeRecords() {
    const container = $("#home-recent-records");
    const records = [...studyState.records]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);

    container.innerHTML = records.length
      ? records.map((record) => recordCardHtml(record, false)).join("")
      : emptyHtml("学習記録はまだありません。タイマーや「記録する」から追加できます。");
  }

  function renderStudyRecords() {
    const container = $("#study-records");
    const category = $("#record-filter").value;
    const period = $("#record-period").value;
    const today = dateKey();
    const start = parseDate(today);
    start.setDate(start.getDate() - 6);
    const weekStart = dateKey(start);

    const records = [...studyState.records]
      .filter((record) => category === "all" || record.category === category)
      .filter((record) => {
        if (period === "today") return record.date === today;
        if (period === "week") return record.date >= weekStart && record.date <= today;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

    container.innerHTML = records.length
      ? records.map((record) => recordCardHtml(record)).join("")
      : emptyHtml("条件に合う学習記録はありません。");
  }

  function renderTimerTodayRecords() {
    const container = $("#timer-today-records");
    const records = studyState.records
      .filter((record) => record.date === dateKey())
      .sort((a, b) => b.createdAt - a.createdAt);

    container.innerHTML = records.length
      ? records.map((record) => recordCardHtml(record, false)).join("")
      : emptyHtml("今日の学習記録はまだありません。");
  }

  function renderCategories() {
    const container = $("#category-list");

    container.innerHTML = studyState.categories.map((category) => {
      const total = studyState.records
        .filter((record) => record.category === category)
        .reduce((sum, record) => sum + record.durationSeconds, 0);

      const count = studyState.records.filter((record) => record.category === category).length;
      const color = getCategoryColor(category);
      const isDefault = DEFAULT_CATEGORIES.includes(category);

      return `
        <article class="category-card">
          <span class="category-symbol category-${color}" aria-hidden="true">${category === "講座・授業" ? "▤" : category === "問題演習" ? "⌘" : category === "暗記・復習" ? "◇" : "✦"}</span>
          <div class="category-main">
            <strong>${escapeHtml(category)}</strong>
            <span>${count}件の記録</span>
          </div>
          <strong class="category-total">${escapeHtml(formatDuration(total, true))}</strong>
          ${isDefault ? "" : `<button type="button" class="category-remove" data-delete-category="${escapeHtml(category)}" aria-label="${escapeHtml(category)}を削除">×</button>`}
        </article>
      `;
    }).join("");
  }

  function renderStudyAll() {
    refreshCategorySelects();
    renderHomeStats();
    renderCategories();
    renderStudyRecords();
    renderHomeRecords();
    renderTimerTodayRecords();
  }

  function renderHome() {
    renderHomeStats();
    renderHomeRecords();
    renderHomePlanner();
  }

  $("#record-filter").addEventListener("change", renderStudyRecords);
  $("#record-period").addEventListener("change", renderStudyRecords);

  $("#study-records").addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-record]");
    if (!button) return;
    openRecordDialog(studyState.records.find((record) => record.id === button.dataset.editRecord));
  });

  $("#add-record-button").addEventListener("click", () => openRecordDialog());

  function openRecordDialog(record = null) {
    const form = $("#record-form");
    form.reset();

    $("#record-id").value = record?.id || "";
    $("#record-dialog-title").textContent = record ? "学習記録を編集" : "学習を記録";
    $("#record-category").innerHTML = getCategoryOptionsHtml(record?.category || $("#timer-category").value);
    $("#record-item").value = record?.item || "";
    $("#record-date").value = record?.date || dateKey();
    $("#record-minutes").value = record ? Math.max(1, Math.round(record.durationSeconds / 60)) : "";
    $("#record-notes").value = record?.notes || "";
    $("#delete-record").classList.toggle("hidden", !record);

    openDialog($("#record-dialog"));
  }

  $("#record-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const id = $("#record-id").value;
    const category = $("#record-category").value;
    const item = $("#record-item").value.trim();
    const date = $("#record-date").value;
    const minutes = Number($("#record-minutes").value);

    if (!category || !item || !date || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      showToast("カテゴリー・内容・日付・学習時間を確認してください。");
      return;
    }

    const previous = studyState.records.find((record) => record.id === id);
    const record = {
      id: id || makeId(),
      category,
      item,
      date,
      durationSeconds: Math.round(minutes * 60),
      notes: $("#record-notes").value.trim(),
      createdAt: previous?.createdAt || Date.now()
    };

    if (previous) {
      studyState.records = studyState.records.map((entry) => entry.id === id ? record : entry);
    } else {
      studyState.records.push(record);
    }

    if (!saveStudy()) return;

    closeDialog($("#record-dialog"));
    renderStudyAll();
    renderHome();
    showToast(previous ? "学習記録を更新しました。" : "学習記録を追加しました。");
  });

  $("#delete-record").addEventListener("click", () => {
    const id = $("#record-id").value;
    const record = studyState.records.find((entry) => entry.id === id);
    if (!record) return;

    if (!confirm(`「${record.item}」の記録を削除しますか？`)) return;

    studyState.records = studyState.records.filter((entry) => entry.id !== id);
    saveStudy();
    closeDialog($("#record-dialog"));
    renderStudyAll();
    renderHome();
    showToast("学習記録を削除しました。");
  });

  $("#add-category-button").addEventListener("click", () => {
    $("#category-form").reset();
    openDialog($("#category-dialog"));
  });

  $("#category-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#category-name").value.trim();
    if (!name) return;

    if (studyState.categories.some((category) => category.toLowerCase() === name.toLowerCase())) {
      showToast("同じ名前のカテゴリーがすでにあります。");
      return;
    }

    studyState.categories.push(name);
    if (!saveStudy()) return;

    closeDialog($("#category-dialog"));
    renderStudyAll();
    showToast("カテゴリーを追加しました。");
  });

  $("#category-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-category]");
    if (!button) return;

    const category = button.dataset.deleteCategory;
    const used = studyState.records.some((record) => record.category === category);

    const message = used
      ? `「${category}」を削除すると、このカテゴリーの学習記録は「${DEFAULT_CATEGORIES[0]}」に移動します。よろしいですか？`
      : `「${category}」を削除しますか？`;

    if (!confirm(message)) return;

    if (used) {
      studyState.records = studyState.records.map((record) =>
        record.category === category ? { ...record, category: DEFAULT_CATEGORIES[0] } : record
      );
    }

    studyState.categories = studyState.categories.filter((item) => item !== category);
    saveStudy();
    renderStudyAll();
    showToast("カテゴリーを削除しました。");
  });

  /* ---------- タイマー ---------- */

  function getElapsedSeconds() {
    if (timerRunning && !timerPaused && timerStartedAt) {
      return timerElapsedBeforeStart + Math.max(0, (Date.now() - timerStartedAt) / 1000);
    }
    return timerElapsedBeforeStart;
  }

  function startTimerTicker() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      updateTimerUI();
      saveTimer();
    }, 250);
  }

  function updateTimerUI() {
    $("#timer-display").textContent = formatTimer(getElapsedSeconds());

    $("#timer-start").disabled = timerRunning && !timerPaused;
    $("#timer-pause").disabled = !timerRunning || timerPaused;
    $("#timer-finish").disabled = getElapsedSeconds() < 1;

    const category = $("#timer-category").value;
    const item = $("#timer-item").value.trim();

    if (timerRunning && !timerPaused) {
      $("#timer-status").textContent = "FOCUS IN PROGRESS";
      $("#timer-subtitle").textContent = `${category || "学習"}${item ? ` · ${item}` : ""}`;
      $("#timer-start").textContent = "計測中";
    } else if (timerPaused) {
      $("#timer-status").textContent = "PAUSED";
      $("#timer-subtitle").textContent = "一時停止中です。準備ができたら再開できます。";
      $("#timer-start").textContent = "▶ 計測を再開";
    } else {
      $("#timer-status").textContent = "READY TO FOCUS";
      $("#timer-subtitle").textContent = "カテゴリーと学習内容を選んで開始";
      $("#timer-start").textContent = "▶ 学習開始";
    }
  }

  function startTimer() {
    if (timerRunning && !timerPaused) return;

    if (!$("#timer-category").value) {
      showToast("カテゴリーを選択してください。");
      return;
    }

    if (timerPaused) {
      timerStartedAt = Date.now();
      timerRunning = true;
      timerPaused = false;
    } else {
      timerStartedAt = Date.now();
      timerRunning = true;
    }

    startTimerTicker();
    saveTimer();
    updateTimerUI();
  }

  function pauseTimer() {
    if (!timerRunning || timerPaused) return;

    timerElapsedBeforeStart = getElapsedSeconds();
    timerRunning = false;
    timerPaused = true;
    timerStartedAt = null;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    saveTimer();
    updateTimerUI();
  }

  function finishTimer() {
    const seconds = Math.floor(getElapsedSeconds());
    if (seconds < 1) {
      showToast("記録できる学習時間がありません。");
      return;
    }

    const category = $("#timer-category").value || DEFAULT_CATEGORIES[0];
    const item = $("#timer-item").value.trim() || "学習";
    const record = {
      id: makeId(),
      category,
      item,
      date: dateKey(),
      durationSeconds: seconds,
      notes: "",
      createdAt: Date.now()
    };

    studyState.records.push(record);
    if (!saveStudy()) return;

    timerRunning = false;
    timerPaused = false;
    timerStartedAt = null;
    timerElapsedBeforeStart = 0;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    saveTimer();
    updateTimerUI();
    renderStudyAll();
    renderHome();
    renderTimerTodayRecords();

    $("#timer-item").value = "";
    showToast(`学習時間 ${formatDuration(seconds, true)} を記録しました。`);
  }

  $("#timer-start").addEventListener("click", startTimer);
  $("#timer-pause").addEventListener("click", pauseTimer);
  $("#timer-finish").addEventListener("click", finishTimer);

  $("#timer-category").addEventListener("change", updateTimerUI);
  $("#timer-item").addEventListener("input", updateTimerUI);

  /* ---------- カレンダー ---------- */

  function eventsOn(date) {
    return calendarState.events.filter((event) => event.date === date);
  }

  function tasksOn(date) {
    return calendarState.tasks.filter((task) => task.date === date && !task.completed);
  }

  function renderCalendar() {
    $("#month-title").textContent = `${viewYear}年${viewMonth + 1}月`;

    const grid = $("#calendar-grid");
    grid.replaceChildren();

    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(viewYear, viewMonth, 1 - first.getDay());
    const todayKey = dateKey();

    for (let index = 0; index < 42; index++) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      const key = dateKey(date);
      const events = eventsOn(key);
      const tasks = tasksOn(key);
      const button = document.createElement("button");

      button.type = "button";
      button.className = "day-cell";

      if (date.getMonth() !== viewMonth) button.classList.add("outside");
      if (key === selectedDate) button.classList.add("selected");
      if (key === todayKey) button.classList.add("today");

      button.setAttribute("aria-label", `${displayDate(key)}、予定${events.length}件、タスク${tasks.length}件`);
      button.innerHTML = `
        <span class="day-number">${date.getDate()}</span>
        <span class="day-markers">
          ${events.length ? '<i class="dot event-dot"></i>' : ""}
          ${tasks.length ? '<i class="dot task-dot"></i>' : ""}
        </span>
      `;

      button.addEventListener("click", () => {
        selectedDate = key;
        viewYear = date.getFullYear();
        viewMonth = date.getMonth();
        renderCalendarAll();
      });

      grid.append(button);
    }
  }

  function renderDayItems() {
    $("#selected-date-title").textContent = displayDate(selectedDate);

    const container = $("#day-items");
    container.replaceChildren();

    const events = eventsOn(selectedDate)
      .sort((a, b) => (a.start || "99:99").localeCompare(b.start || "99:99"));

    if (!events.length) {
      container.innerHTML = emptyHtml("この日の予定はありません。＋から追加できます。");
      return;
    }

    events.forEach((event) => {
      const card = document.createElement("article");
      card.className = "event-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${event.title}を編集`);

      const time = event.start
        ? `${event.start}${event.end ? `–${event.end}` : ""}`
        : "時刻未設定";

      const color = ["blue", "purple", "green", "orange", "pink"].includes(event.color)
        ? event.color : "blue";

      card.innerHTML = `
        <span class="event-stripe ${color}"></span>
        <div class="event-main">
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.notes || (event.reminder ? "通知設定あり" : "詳細なし"))}</p>
        </div>
        <span class="event-time">${escapeHtml(time)}</span>
      `;

      const edit = () => openEventDialog(event);
      card.addEventListener("click", edit);
      card.addEventListener("keydown", (eventKey) => {
        if (eventKey.key === "Enter" || eventKey.key === " ") {
          eventKey.preventDefault();
          edit();
        }
      });

      container.append(card);
    });
  }

  function renderTasks() {
    const container = $("#task-list");
    container.replaceChildren();

    const tasks = [...calendarState.tasks].sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
    });

    if (!tasks.length) {
      container.innerHTML = emptyHtml("タスクはまだありません。上から追加できます。");
      return;
    }

    tasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = `task-row${task.completed ? " completed" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(task.completed);
      checkbox.setAttribute("aria-label", `${task.title}を完了にする`);
      checkbox.addEventListener("change", () => {
        task.completed = checkbox.checked;
        saveCalendar();
        renderCalendarAll();
      });

      const main = document.createElement("button");
      main.type = "button";
      main.className = "task-main";
      main.innerHTML = `
        <strong>${escapeHtml(task.title)}</strong>
        <small>${task.date ? `期限：${escapeHtml(displayDate(task.date))}` : "期限なし"}${task.notes ? ` · ${escapeHtml(task.notes)}` : ""}</small>
      `;
      main.addEventListener("click", () => openTaskDialog(task));

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "task-edit";
      edit.textContent = "•••";
      edit.setAttribute("aria-label", `${task.title}を編集`);
      edit.addEventListener("click", () => openTaskDialog(task));

      row.append(checkbox, main, edit);
      container.append(row);
    });
  }

  function renderHomePlanner() {
    const container = $("#home-planner");
    const todayEvents = eventsOn(dateKey());
    const todayTasks = tasksOn(dateKey());

    const items = [
      ...todayEvents.map((event) => ({
        type: "event",
        title: event.title,
        detail: event.start || "時刻未設定"
      })),
      ...todayTasks.map((task) => ({
        type: "task",
        title: task.title,
        detail: "未完了タスク"
      }))
    ];

    container.innerHTML = items.length
      ? items.slice(0, 4).map((item) => `
          <div class="mini-planner-item">
            <span class="mini-planner-dot ${item.type === "event" ? "event-dot" : "task-dot"}"></span>
            <span>${escapeHtml(item.title)}</span>
            <small>${escapeHtml(item.detail)}</small>
          </div>
        `).join("")
      : emptyHtml("今日の予定とタスクはありません。");
  }

  function renderCalendarAll() {
    renderCalendar();
    renderDayItems();
    renderTasks();
    renderHomePlanner();
  }

  const eventDialog = $("#event-dialog");
  const taskDialog = $("#task-dialog");

  function openEventDialog(event = null) {
    $("#event-form").reset();
    $("#event-id").value = event?.id || "";
    $("#event-title").value = event?.title || "";
    $("#event-date").value = event?.date || selectedDate;
    $("#event-start").value = event?.start || "";
    $("#event-end").value = event?.end || "";
    $("#event-color").value = event?.color || "blue";
    $("#event-notes").value = event?.notes || "";
    $("#event-reminder").checked = Boolean(event?.reminder);
    $("#event-dialog-title").textContent = event ? "予定を編集" : "予定を追加";
    $("#delete-event").classList.toggle("hidden", !event);
    openDialog(eventDialog);
  }

  function openTaskDialog(task = null) {
    $("#task-form").reset();
    $("#task-id").value = task?.id || "";
    $("#task-title").value = task?.title || "";
    $("#task-date").value = task?.date || selectedDate;
    $("#task-notes").value = task?.notes || "";
    $("#task-dialog-title").textContent = task ? "タスクを編集" : "タスクを追加";
    $("#delete-task").classList.toggle("hidden", !task);
    openDialog(taskDialog);
  }

  $("#event-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("#event-id").value;
    const date = $("#event-date").value;
    const start = $("#event-start").value;
    const end = $("#event-end").value;

    if (!date) {
      showToast("日付を入力してください。");
      return;
    }
    if (start && end && end < start) {
      showToast("終了時刻は開始時刻以降にしてください。");
      return;
    }

    const record = {
      id: id || makeId(),
      title: $("#event-title").value.trim(),
      date,
      start,
      end,
      color: $("#event-color").value,
      notes: $("#event-notes").value.trim(),
      reminder: $("#event-reminder").checked
    };

    if (!record.title) {
      showToast("予定名を入力してください。");
      return;
    }

    const index = calendarState.events.findIndex((item) => item.id === id);
    if (index >= 0) calendarState.events[index] = record;
    else calendarState.events.push(record);

    selectedDate = date;
    const selected = parseDate(date);
    viewYear = selected.getFullYear();
    viewMonth = selected.getMonth();

    if (!saveCalendar()) return;

    renderCalendarAll();
    closeDialog(eventDialog);

    if (record.reminder) await requestNotificationPermission();

    showToast(index >= 0 ? "予定を更新しました。" : "予定を追加しました。");
  });

  $("#delete-event").addEventListener("click", () => {
    const id = $("#event-id").value;
    const record = calendarState.events.find((item) => item.id === id);
    if (!record || !confirm(`「${record.title}」を削除しますか？`)) return;

    calendarState.events = calendarState.events.filter((item) => item.id !== id);
    saveCalendar();
    renderCalendarAll();
    closeDialog(eventDialog);
    showToast("予定を削除しました。");
  });

  $("#task-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const id = $("#task-id").value;
    const previous = calendarState.tasks.find((item) => item.id === id);
    const task = {
      id: id || makeId(),
      title: $("#task-title").value.trim(),
      date: $("#task-date").value,
      notes: $("#task-notes").value.trim(),
      completed: Boolean(previous?.completed)
    };

    if (!task.title) {
      showToast("タスク名を入力してください。");
      return;
    }

    const index = calendarState.tasks.findIndex((item) => item.id === id);
    if (index >= 0) calendarState.tasks[index] = task;
    else calendarState.tasks.push(task);

    if (!saveCalendar()) return;

    renderCalendarAll();
    closeDialog(taskDialog);
    showToast(index >= 0 ? "タスクを更新しました。" : "タスクを追加しました。");
  });

  $("#delete-task").addEventListener("click", () => {
    const id = $("#task-id").value;
    const task = calendarState.tasks.find((item) => item.id === id);
    if (!task || !confirm(`「${task.title}」を削除しますか？`)) return;

    calendarState.tasks = calendarState.tasks.filter((item) => item.id !== id);
    saveCalendar();
    renderCalendarAll();
    closeDialog(taskDialog);
    showToast("タスクを削除しました。");
  });

  $("#quick-task-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const input = $("#quick-task-title");
    const title = input.value.trim();
    if (!title) return;

    calendarState.tasks.push({
      id: makeId(),
      title,
      date: selectedDate,
      notes: "",
      completed: false
    });

    if (!saveCalendar()) return;

    input.value = "";
    renderCalendarAll();
    showToast("タスクを追加しました。");
  });

  $("#prev-month").addEventListener("click", () => {
    const date = new Date(viewYear, viewMonth - 1, 1);
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();
    renderCalendarAll();
  });

  $("#next-month").addEventListener("click", () => {
    const date = new Date(viewYear, viewMonth + 1, 1);
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();
    renderCalendarAll();
  });

  $("#today-button").addEventListener("click", () => {
    const today = new Date();
    selectedDate = dateKey(today);
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    renderCalendarAll();
  });

  $("#add-event-day").addEventListener("click", () => openEventDialog());
  $("#add-task-button").addEventListener("click", () => openTaskDialog());

  /* ---------- 通知 ---------- */

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      showToast("このブラウザは通知に対応していません。");
      return;
    }

    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn("通知許可の取得に失敗しました", error);
      }
    }

    if (Notification.permission === "granted") {
      showToast("通知が許可されました。");
    } else {
      showToast("通知は許可されていません。");
    }
  }

  function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const current = new Date();
    const currentMinute = `${dateKey(current)} ${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;

    calendarState.events.forEach((event) => {
      if (!event.reminder || !event.start) return;

      const reminderKey = `${event.id}:${currentMinute}`;
      if (`${event.date} ${event.start}` !== currentMinute || reminded.has(reminderKey)) return;

      reminded.add(reminderKey);
      try {
        new Notification("予定の時間です", { body: event.title });
      } catch (error) {
        console.warn("通知の表示に失敗しました", error);
      }
    });
  }

  /* ---------- バックアップ ---------- */

  $("#export-button").addEventListener("click", () => {
    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      events: calendarState.events,
      tasks: calendarState.tasks,
      study: studyState
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `one-for-all-backup-${dateKey()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("バックアップを書き出しました。");
  });

  $("#import-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.events) || !Array.isArray(parsed.tasks)) {
        throw new Error("形式が違います");
      }

      if (!confirm("現在の予定とタスクを読み込んだデータで置き換えますか？")) return;

      calendarState = {
        events: parsed.events.filter((item) => item && typeof item.title === "string"),
        tasks: parsed.tasks.filter((item) => item && typeof item.title === "string")
      };

      if (parsed.study && Array.isArray(parsed.study.records)) {
        studyState = {
          categories: [...new Set([
            ...DEFAULT_CATEGORIES,
            ...safeArray(parsed.study.categories).filter((item) => typeof item === "string")
          ])],
          records: parsed.study.records.map(normalizeRecord).filter(Boolean),
          dailyGoalMinutes: Math.max(1, Number(parsed.study.dailyGoalMinutes) || 120)
        };
        saveStudy();
      }

      saveCalendar();
      renderCalendarAll();
      renderStudyAll();
      renderHome();
      showToast("データを読み込みました。");
    } catch (error) {
      console.error(error);
      showToast("読み込みに失敗しました。バックアップファイルを確認してください。");
    } finally {
      event.target.value = "";
    }
  });

  /* ---------- 起動 ---------- */

  function initialize() {
    loadCalendar();
    loadStudy();
    loadTimer();

    refreshCategorySelects();
    renderCalendarAll();
    renderStudyAll();
    renderHome();
    updateTimerUI();

    if (!timerRunning && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    setInterval(checkReminders, 15000);
  }

  initialize();
})();
