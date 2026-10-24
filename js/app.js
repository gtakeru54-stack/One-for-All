/* =========================================================
   ONE FOR ALL — COSMOS
   js/app.js
   学習記録・タイマー・目標・グラフ・カレンダー
   ========================================================= */

"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const STORAGE = {
    calendar: "personal-calendar-v1",
    tasks: "personal-tasks-v1",
    subjects: "one-for-all-subjects-v1",
    records: "one-for-all-study-records-v1",
    goals: "one-for-all-goals-v1",
    countdown: "one-for-all-countdown-v1",
    settings: "one-for-all-settings-v1",
    items: "one-for-all-study-items-v1"
  };

  const COLORS = [
    "#7c8cff", "#72dce8", "#c5a2ff", "#75e0b0",
    "#ffd77b", "#ff94b0", "#8dc5ff", "#f3a66b"
  ];

  const state = {
    view: "home",
    subjects: [],
    items: [],
    records: [],
    events: [],
    tasks: [],
    goals: [],
    countdown: null,
    settings: {
      dailyTarget: 60,
      weeklyTarget: 420
    },
    selectedSubjectId: null,
    selectedItemId: null,
    selectedDate: dateKey(new Date()),
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    chartPeriod: "week",
    breakdownMode: "subject",
    timer: {
      running: false,
      startedAt: null,
      elapsedBeforeStart: 0,
      interval: null,
      subjectId: null,
      itemId: null
    }
  };

  let toastTimeout = null;

  function makeId(prefix = "id") {
    return prefix + "-" + Date.now().toString(36) +
      "-" + Math.random().toString(36).slice(2, 8);
  }

  function dateKey(date) {
    const d = new Date(date);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function parseDate(value) {
    if (!value) return new Date();
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function addDays(date, amount) {
    const d = new Date(date);
    d.setDate(d.getDate() + amount);
    return d;
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

  function formatMinutes(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours && mins) return `${hours}時間${mins}分`;
    if (hours) return `${hours}時間`;
    return `${mins}分`;
  }

  function formatSeconds(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  }

  function formatDate(value, options = {}) {
    if (!value) return "日付未設定";
    const d = parseDate(value);
    return new Intl.DateTimeFormat("ja-JP", {
      year: options.year ? "numeric" : undefined,
      month: "numeric",
      day: "numeric",
      weekday: options.weekday ? "short" : undefined
    }).format(d);
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const result = JSON.parse(raw);
      return result ?? fallback;
    } catch (error) {
      console.warn("保存データを読み込めませんでした:", key, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("保存に失敗しました:", key, error);
      showToast("保存できませんでした。空き容量を確認してください。");
      return false;
    }
  }

  function saveAll() {
    writeJSON(STORAGE.subjects, state.subjects);
    writeJSON(STORAGE.items, state.items);
    writeJSON(STORAGE.records, state.records);
    writeJSON(STORAGE.calendar, state.events);
    writeJSON(STORAGE.tasks, state.tasks);
    writeJSON(STORAGE.goals, state.goals);
    writeJSON(STORAGE.countdown, state.countdown);
    writeJSON(STORAGE.settings, state.settings);
  }

  function normalizeSubject(subject, index) {
    if (typeof subject === "string") {
      return {
        id: makeId("subject"),
        name: subject,
        color: COLORS[index % COLORS.length]
      };
    }
    return {
      id: String(subject.id ?? subject.subjectId ?? makeId("subject")),
      name: String(subject.name ?? subject.title ?? "科目"),
      color: subject.color || COLORS[index % COLORS.length]
    };
  }

  function normalizeItem(item) {
    if (typeof item === "string") {
      return {
        id: makeId("item"),
        subjectId: state.subjects[0]?.id ?? "",
        name: item
      };
    }
    return {
      id: String(item.id ?? item.itemId ?? makeId("item")),
      subjectId: String(item.subjectId ?? item.subject_id ?? ""),
      name: String(item.name ?? item.title ?? item.label ?? "学習項目")
    };
  }

  function normalizeRecord(record) {
    const minutes = Number(
      record.minutes ??
      record.durationMinutes ??
      record.duration ??
      record.studyMinutes ??
      0
    );

    return {
      id: String(record.id ?? makeId("record")),
      subjectId: String(record.subjectId ?? record.subject_id ?? ""),
      itemId: String(record.itemId ?? record.item_id ?? ""),
      date: String(record.date ?? record.studyDate ?? record.day ?? todayKey()).slice(0, 10),
      minutes: Math.max(0, minutes),
      note: String(record.note ?? record.memo ?? ""),
      createdAt: record.createdAt ?? Date.now()
    };
  }

  function loadData() {
    const rawSubjects = readJSON(STORAGE.subjects, []);
    state.subjects = Array.isArray(rawSubjects)
      ? rawSubjects.map(normalizeSubject)
      : [];

    const rawItems = readJSON(STORAGE.items, []);
    state.items = Array.isArray(rawItems)
      ? rawItems.map(normalizeItem)
      : [];

    const rawRecords = readJSON(STORAGE.records, []);
    state.records = Array.isArray(rawRecords)
      ? rawRecords.map(normalizeRecord).filter(r => r.minutes > 0)
      : [];

    const rawEvents = readJSON(STORAGE.calendar, []);
    state.events = Array.isArray(rawEvents)
      ? rawEvents.map(event => ({
          ...event,
          id: String(event.id ?? makeId("event")),
          title: String(event.title ?? event.name ?? "予定"),
          date: String(event.date ?? event.startDate ?? todayKey()).slice(0, 10),
          time: String(event.time ?? ""),
          category: String(event.category ?? "personal"),
          note: String(event.note ?? "")
        }))
      : [];

    const rawTasks = readJSON(STORAGE.tasks, []);
    state.tasks = Array.isArray(rawTasks)
      ? rawTasks.map(task => ({
          ...task,
          id: String(task.id ?? makeId("task")),
          title: String(task.title ?? task.name ?? "タスク"),
          date: String(task.date ?? task.deadline ?? ""),
          priority: String(task.priority ?? "normal"),
          completed: Boolean(task.completed ?? task.done)
        }))
      : [];

    const rawGoals = readJSON(STORAGE.goals, []);
    state.goals = Array.isArray(rawGoals)
      ? rawGoals.map(goal => ({
          ...goal,
          id: String(goal.id ?? makeId("goal")),
          name: String(goal.name ?? goal.title ?? "目標"),
          description: String(goal.description ?? ""),
          deadline: String(goal.deadline ?? ""),
          parentId: String(goal.parentId ?? ""),
          step: String(goal.step ?? ""),
          completed: Boolean(goal.completed),
          createdAt: goal.createdAt ?? Date.now()
        }))
      : [];

    state.countdown = readJSON(STORAGE.countdown, null);
    state.settings = {
      ...state.settings,
      ...(readJSON(STORAGE.settings, {}) || {})
    };

    if (!state.subjects.length) {
      state.subjects = [
        { id: "subject-japanese", name: "国語", color: "#ff94b0" },
        { id: "subject-math", name: "数学", color: "#7c8cff" },
        { id: "subject-english", name: "英語", color: "#72dce8" },
        { id: "subject-science", name: "理科", color: "#75e0b0" },
        { id: "subject-social", name: "社会", color: "#ffd77b" }
      ];
    }

    state.items = state.items.filter(item =>
      state.subjects.some(subject => subject.id === item.subjectId)
    );

    if (!state.selectedSubjectId && state.subjects.length) {
      state.selectedSubjectId = state.subjects[0].id;
    }

    saveAll();
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function showView(viewName) {
    const view = $(`[data-view="${viewName}"]`);
    if (!view) return;

    state.view = viewName;

    $$(".view").forEach(section => {
      section.classList.toggle("active", section.dataset.view === viewName);
    });

    $$(".nav-button").forEach(button => {
      button.classList.toggle("active", button.dataset.navigate === viewName);
    });

    if (viewName === "home") renderHome();
    if (viewName === "subjects") renderSubjects();
    if (viewName === "records") renderRecords();
    if (viewName === "calendar") renderCalendar();
    if (viewName === "goals") renderGoals();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;

    if (id === "event-dialog") {
      const dateInput = $("#event-date");
      if (dateInput && !dateInput.value) {
        dateInput.value = state.selectedDate || todayKey();
      }
    }

    if (id === "task-dialog") {
      const dateInput = $("#task-date");
      if (dateInput && !dateInput.value) {
        dateInput.value = state.selectedDate || todayKey();
      }
    }

    if (id === "countdown-dialog" && state.countdown) {
      $("#countdown-name").value = state.countdown.name || "";
      $("#countdown-date").value = state.countdown.date || "";
    }

    if (id === "goal-dialog") {
      renderGoalParentOptions();
    }

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function subjectById(id) {
    return state.subjects.find(subject => subject.id === id);
  }

  function itemById(id) {
    return state.items.find(item => item.id === id);
  }

  function subjectName(id) {
    return subjectById(id)?.name || "未分類";
  }

  function itemName(id) {
    return itemById(id)?.name || "項目なし";
  }

  function getRecordsForDate(date) {
    return state.records.filter(record => record.date === date);
  }

  function totalMinutes(records = state.records) {
    return records.reduce((sum, record) => sum + (Number(record.minutes) || 0), 0);
  }

  function getTodayMinutes() {
    return totalMinutes(getRecordsForDate(todayKey()));
  }

  function getWeekStart(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function getWeekRecords() {
    const start = getWeekStart();
    const end = addDays(start, 7);
    return state.records.filter(record => {
      const date = parseDate(record.date);
      return date >= start && date < end;
    });
  }

  function renderHome() {
    const dateElement = $("#home-date");
    if (dateElement) {
      dateElement.textContent = new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
      }).format(new Date());
    }

    $("#home-today-time")?.replaceChildren(
      document.createTextNode(formatMinutes(getTodayMinutes()))
    );

    $("#home-total-time")?.replaceChildren(
      document.createTextNode(formatMinutes(totalMinutes()))
    );

    renderCountdown();
    renderHomeEvents();
  }

  function renderCountdown() {
    const container = $("#home-countdown");
    if (!container) return;

    if (!state.countdown?.date || !state.countdown?.name) {
      container.innerHTML = `
        <p>目標イベントを設定しよう</p>
        <button class="primary-button" type="button" data-open-dialog="countdown-dialog">
          イベントを追加
        </button>`;
      return;
    }

    const today = parseDate(todayKey());
    const target = parseDate(state.countdown.date);
    const days = Math.round((target - today) / 86400000);

    let remainingText;
    if (days > 0) remainingText = `あと ${days} 日`;
    else if (days === 0) remainingText = "今日は本番の日！";
    else remainingText = `${Math.abs(days)} 日経過`;

    container.innerHTML = `
      <p>${escapeHTML(state.countdown.name)}</p>
      <strong class="countdown-number">${escapeHTML(remainingText)}</strong>
      <p class="muted">${escapeHTML(formatDate(state.countdown.date, { year: true, weekday: true }))}</p>
      <button class="secondary-button" type="button" data-open-dialog="countdown-dialog">変更する</button>`;
  }

  function renderHomeEvents() {
    const container = $("#home-today-events");
    if (!container) return;

    const todayEvents = state.events
      .filter(event => event.date === todayKey())
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));

    if (!todayEvents.length) {
      container.innerHTML = '<p class="empty-state">今日の予定はありません。</p>';
      return;
    }

    container.innerHTML = todayEvents.map(event => `
      <article class="event-card" data-category="${escapeHTML(event.category)}">
        <div class="event-card-header">
          <div>
            <h3>${escapeHTML(event.title)}</h3>
            <p>${escapeHTML(event.time || "時間未設定")}</p>
          </div>
          <button class="secondary-button" type="button" data-delete-event="${escapeHTML(event.id)}">削除</button>
        </div>
      </article>`).join("");
  }

  function renderSubjects() {
    renderSubjectSelects();
    renderSubjectList();
    renderStudyItems();
    updateTimerDisplay();
  }

  function renderSubjectSelects() {
    const selects = [
      $("#manual-subject"),
      $("#item-subject")
    ].filter(Boolean);

    for (const select of selects) {
      const previous = select.value;
      const firstText = select.id === "manual-subject"
        ? "科目を選択"
        : "科目を選択";

      select.innerHTML = `<option value="">${firstText}</option>` +
        state.subjects.map(subject => `
          <option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`
        ).join("");

      if (state.subjects.some(subject => subject.id === previous)) {
        select.value = previous;
      } else if (state.selectedSubjectId) {
        select.value = state.selectedSubjectId;
      }
    }

    const manualItem = $("#manual-item");
    if (manualItem) {
      const previous = manualItem.value;
      const subjectId = $("#manual-subject")?.value || "";

      const items = state.items.filter(item =>
        !subjectId || item.subjectId === subjectId
      );

      manualItem.innerHTML = '<option value="">項目を選択（任意）</option>' +
        items.map(item => `
          <option value="${escapeHTML(item.id)}">${escapeHTML(subjectName(item.subjectId))} / ${escapeHTML(item.name)}</option>`
        ).join("");

      if (items.some(item => item.id === previous)) manualItem.value = previous;
    }
  }

  function renderSubjectList() {
    const container = $("#subject-list");
    if (!container) return;

    if (!state.subjects.length) {
      container.innerHTML = '<p class="empty-state">科目を追加してください。</p>';
      return;
    }

    container.innerHTML = state.subjects.map(subject => {
      const minutes = totalMinutes(
        state.records.filter(record => record.subjectId === subject.id)
      );
      const selected = state.selectedSubjectId === subject.id;

      return `
        <div class="subject-card ${selected ? "selected" : ""}">
          <button class="item-select" type="button" data-select-subject="${escapeHTML(subject.id)}"
            style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;border:0;background:transparent;color:inherit;text-align:left">
            <span class="subject-color-dot" style="background:${escapeHTML(subject.color)}"></span>
            <span class="subject-name">
              ${escapeHTML(subject.name)}
              <span class="subject-meta">${formatMinutes(minutes)} · ${state.items.filter(item => item.subjectId === subject.id).length}項目</span>
            </span>
          </button>
          <button class="icon-button" type="button" data-delete-subject="${escapeHTML(subject.id)}" aria-label="科目を削除">×</button>
        </div>`;
    }).join("");
  }

  function renderStudyItems() {
    const container = $("#study-item-list");
    if (!container) return;

    const subject = subjectById(state.selectedSubjectId);
    const nameElement = $("#selected-subject-name");

    if (nameElement) {
      nameElement.textContent = subject
        ? `選択中：${subject.name}`
        : "科目を選択してください。";
    }

    const items = state.items.filter(item =>
      item.subjectId === state.selectedSubjectId
    );

    if (!items.length) {
      container.innerHTML = '<p class="empty-state">学習項目がありません。「項目追加」から登録してください。</p>';
      return;
    }

    container.innerHTML = items.map(item => {
      const minutes = totalMinutes(
        state.records.filter(record => record.itemId === item.id)
      );
      const selected = state.selectedItemId === item.id;

      return `
        <div class="study-item-card ${selected ? "selected" : ""}">
          <button class="item-select" type="button" data-select-item="${escapeHTML(item.id)}">
            <span class="item-select-indicator">${selected ? "✓" : "＋"}</span>
            <span class="item-name">
              ${escapeHTML(item.name)}
              <span class="item-meta">累計 ${formatMinutes(minutes)}</span>
            </span>
          </button>
          <button class="icon-button" type="button" data-delete-item="${escapeHTML(item.id)}" aria-label="項目を削除">×</button>
        </div>`;
    }).join("");
  }

  function selectSubject(id) {
    if (!subjectById(id)) return;

    if (state.timer.running && state.timer.subjectId !== id) {
      showToast("タイマーを終了してから科目を変更してください。");
      return;
    }

    state.selectedSubjectId = id;
    state.selectedItemId = null;
    renderSubjects();
  }

  function selectItem(id) {
    const item = itemById(id);
    if (!item) return;

    if (state.timer.running &&
        (state.timer.itemId !== id || state.timer.subjectId !== item.subjectId)) {
      showToast("タイマーを終了してから学習項目を変更してください。");
      return;
    }

    state.selectedSubjectId = item.subjectId;
    state.selectedItemId = id;

    const timerName = $("#timer-item-name");
    if (timerName) timerName.textContent = item.name;

    const status = $("#timer-status");
    if (status) status.textContent = `${subjectName(item.subjectId)}を学習します。`;

    renderSubjects();
  }

  function addSubject(name, color) {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (state.subjects.some(subject =>
      subject.name.toLowerCase() === trimmed.toLowerCase()
    )) {
      showToast("同じ名前の科目がすでにあります。");
      return;
    }

    const subject = {
      id: makeId("subject"),
      name: trimmed,
      color: color || COLORS[state.subjects.length % COLORS.length]
    };

    state.subjects.push(subject);
    state.selectedSubjectId = subject.id;
    saveAll();
    renderSubjects();
    showToast("科目を追加しました。");
  }

  function deleteSubject(id) {
    const subject = subjectById(id);
    if (!subject) return;

    if (!confirm(`「${subject.name}」を削除しますか？\n関連する学習項目と記録も削除されます。`)) {
      return;
    }

    const itemIds = state.items
      .filter(item => item.subjectId === id)
      .map(item => item.id);

    state.subjects = state.subjects.filter(item => item.id !== id);
    state.items = state.items.filter(item => item.subjectId !== id);
    state.records = state.records.filter(record =>
      record.subjectId !== id && !itemIds.includes(record.itemId)
    );

    if (state.selectedSubjectId === id) {
      state.selectedSubjectId = state.subjects[0]?.id ?? null;
      state.selectedItemId = null;
    }

    saveAll();
    renderSubjects();
    renderRecords();
    renderHome();
    showToast("科目を削除しました。");
  }

  function addItem(name, subjectId) {
    const trimmed = name.trim();
    if (!trimmed || !subjectById(subjectId)) return;

    if (state.items.some(item =>
      item.subjectId === subjectId &&
      item.name.toLowerCase() === trimmed.toLowerCase()
    )) {
      showToast("同じ名前の項目がすでにあります。");
      return;
    }

    const item = {
      id: makeId("item"),
      subjectId,
      name: trimmed
    };

    state.items.push(item);
    state.selectedSubjectId = subjectId;
    state.selectedItemId = item.id;

    saveAll();
    renderSubjects();
    showToast("学習項目を追加しました。");
  }

  function deleteItem(id) {
    const item = itemById(id);
    if (!item) return;

    if (!confirm(`「${item.name}」を削除しますか？\nこの項目の学習記録も削除されます。`)) {
      return;
    }

    state.items = state.items.filter(candidate => candidate.id !== id);
    state.records = state.records.filter(record => record.itemId !== id);

    if (state.selectedItemId === id) state.selectedItemId = null;

    saveAll();
    renderSubjects();
    renderRecords();
    renderHome();
    showToast("学習項目を削除しました。");
  }

  function timerElapsedSeconds() {
    let seconds = state.timer.elapsedBeforeStart;

    if (state.timer.running && state.timer.startedAt) {
      seconds += (Date.now() - state.timer.startedAt) / 1000;
    }

    return Math.max(0, Math.floor(seconds));
  }

  function updateTimerDisplay() {
    const display = $("#timer-display");
    if (display) display.textContent = formatSeconds(timerElapsedSeconds());

    const start = $("#timer-start");
    const pause = $("#timer-pause");
    const stop = $("#timer-stop");

    if (start) start.disabled = state.timer.running;
    if (pause) pause.disabled = !state.timer.running;
    if (stop) stop.disabled =
      state.timer.elapsedBeforeStart <= 0 && !state.timer.running;

    const item = itemById(state.timer.itemId || state.selectedItemId);
    const title = $("#timer-item-name");

    if (title && !state.timer.running && item) title.textContent = item.name;
  }

  function startTimer() {
    if (state.timer.running) return;

    const subjectId = state.selectedSubjectId;
    const itemId = state.selectedItemId;

    if (!subjectById(subjectId)) {
      showToast("先に科目を選択してください。");
      return;
    }

    if (!itemById(itemId)) {
      showToast("先に学習項目を選択してください。");
      return;
    }

    state.timer.subjectId = subjectId;
    state.timer.itemId = itemId;
    state.timer.startedAt = Date.now();
    state.timer.running = true;

    const status = $("#timer-status");
    if (status) status.textContent = "学習中… 終了すると記録されます。";

    clearInterval(state.timer.interval);
    state.timer.interval = setInterval(updateTimerDisplay, 250);
    updateTimerDisplay();
  }

  function pauseTimer() {
    if (!state.timer.running) return;

    state.timer.elapsedBeforeStart +=
      (Date.now() - state.timer.startedAt) / 1000;

    state.timer.startedAt = null;
    state.timer.running = false;
    clearInterval(state.timer.interval);
    state.timer.interval = null;

    const status = $("#timer-status");
    if (status) status.textContent = "一時停止中";

    updateTimerDisplay();
  }

  function resetTimer() {
    clearInterval(state.timer.interval);

    state.timer.running = false;
    state.timer.startedAt = null;
    state.timer.elapsedBeforeStart = 0;
    state.timer.interval = null;
    state.timer.subjectId = null;
    state.timer.itemId = null;

    updateTimerDisplay();
  }

  function stopTimer() {
    const seconds = timerElapsedSeconds();
    const subjectId = state.timer.subjectId;
    const itemId = state.timer.itemId;

    if (!subjectId || !itemId || seconds < 1) {
      resetTimer();
      showToast("記録できる学習時間がありません。");
      return;
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 1) {
      if (!confirm("学習時間が1分未満です。1分として保存しますか？")) {
        resetTimer();
        return;
      }
    }

    const saved = addStudyRecord({
      subjectId,
      itemId,
      date: todayKey(),
      minutes: Math.max(1, minutes),
      note: "タイマーで記録"
    }, false);

    resetTimer();

    if (saved) {
      const status = $("#timer-status");
      if (status) status.textContent = "学習記録を保存しました。";

      renderSubjects();
      renderRecords();
      renderHome();
      showToast(`学習時間 ${formatMinutes(Math.max(1, minutes))} を保存しました。`);
    }
  }

  function addStudyRecord(record, shouldRender = true) {
    const subject = subjectById(record.subjectId);
    if (!subject) {
      showToast("科目を選択してください。");
      return false;
    }

    const minutes = Number(record.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      showToast("1分以上の学習時間を入力してください。");
      return false;
    }

    const itemId = record.itemId && itemById(record.itemId)
      ? record.itemId
      : "";

    state.records.push({
      id: makeId("record"),
      subjectId: subject.id,
      itemId,
      date: record.date || todayKey(),
      minutes: Math.round(minutes),
      note: String(record.note || "").trim(),
      createdAt: Date.now()
    });

    saveAll();

    if (shouldRender) {
      renderSubjects();
      renderRecords();
      renderHome();
    }

    return true;
  }

  function renderRecords() {
    renderChart();
    renderBreakdown();
    renderTargetProgress();
    renderRecordList();
  }

  function getChartBuckets() {
    const today = parseDate(todayKey());
    const buckets = [];

    if (state.chartPeriod === "week") {
      const start = getWeekStart(today);
      for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        const key = dateKey(date);
        buckets.push({
          key,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          minutes: totalMinutes(getRecordsForDate(key))
        });
      }
    } else if (state.chartPeriod === "month") {
      for (let i = 29; i >= 0; i--) {
        const date = addDays(today, -i);
        const key = dateKey(date);
        buckets.push({
          key,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          minutes: totalMinutes(getRecordsForDate(key))
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();

        const minutes = totalMinutes(state.records.filter(record => {
          const d = parseDate(record.date);
          return d.getFullYear() === year && d.getMonth() === month;
        }));

        buckets.push({
          key: `${year}-${String(month + 1).padStart(2, "0")}`,
          label: `${month + 1}月`,
          minutes
        });
      }
    }

    return buckets;
  }

  function renderChart() {
    const canvas = $("#bar-chart");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width || canvas.parentElement?.clientWidth || 320));
    const height = 220;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const buckets = getChartBuckets();
    const left = 38;
    const right = 10;
    const top = 15;
    const bottom = 39;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const maxValue = Math.max(60, ...buckets.map(bucket => bucket.minutes));
    const step = Math.pow(10, Math.floor(Math.log10(maxValue)));
    const gridMax = Math.ceil(maxValue / step) * step;
    const gridStep = gridMax / 4;

    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
      const y = top + plotHeight - (plotHeight * i / 4);

      ctx.strokeStyle = "rgba(147, 166, 208, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();

      ctx.fillStyle = "#9baac8";
      ctx.fillText(String(Math.round(gridStep * i)), left - 7, y);
    }

    const slot = plotWidth / Math.max(1, buckets.length);
    const barWidth = Math.max(2, Math.min(18, slot * 0.62));

    buckets.forEach((bucket, index) => {
      const x = left + index * slot + (slot - barWidth) / 2;
      const barHeight = bucket.minutes > 0
        ? Math.max(2, bucket.minutes / gridMax * plotHeight)
        : 0;
      const y = top + plotHeight - barHeight;

      const gradient = ctx.createLinearGradient(0, y, 0, top + plotHeight);
      gradient.addColorStop(0, "#78e0ed");
      gradient.addColorStop(1, "#7188ff");

      ctx.fillStyle = gradient;

      if (barHeight > 0) {
        const radius = Math.min(5, barWidth / 2, barHeight / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      const showLabel = state.chartPeriod !== "month" ||
        index % 5 === 0 ||
        index === buckets.length - 1;

      if (showLabel) {
        ctx.fillStyle = "#9baac8";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(bucket.label, x + barWidth / 2, top + plotHeight + 9);
      }
    });

    if (state.chartPeriod === "year") {
      ctx.fillStyle = "#9baac8";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("分", 5, 1);
    }
  }

  function renderBreakdown() {
    const container = $("#subject-breakdown");
    if (!container) return;

    const grouped = new Map();

    if (state.breakdownMode === "subject") {
      state.subjects.forEach(subject => {
        grouped.set(subject.id, {
          id: subject.id,
          name: subject.name,
          color: subject.color,
          minutes: 0
        });
      });

      state.records.forEach(record => {
        if (!grouped.has(record.subjectId)) {
          grouped.set(record.subjectId, {
            id: record.subjectId,
            name: "未分類",
            color: "#8998b9",
            minutes: 0
          });
        }
        grouped.get(record.subjectId).minutes += record.minutes;
      });
    } else {
      state.items.forEach(item => {
        grouped.set(item.id, {
          id: item.id,
          name: `${subjectName(item.subjectId)} / ${item.name}`,
          color: subjectById(item.subjectId)?.color || "#8998b9",
          minutes: 0
        });
      });

      state.records.forEach(record => {
        if (!record.itemId) return;

        if (!grouped.has(record.itemId)) {
          grouped.set(record.itemId, {
            id: record.itemId,
            name: "削除済み項目",
            color: "#8998b9",
            minutes: 0
          });
        }

        grouped.get(record.itemId).minutes += record.minutes;
      });
    }

    const values = [...grouped.values()].sort((a, b) => b.minutes - a.minutes);
    const max = Math.max(1, ...values.map(value => value.minutes));

    if (!values.length || values.every(value => value.minutes === 0)) {
      container.innerHTML = '<p class="empty-state">学習記録を追加すると、ここに内訳が表示されます。</p>';
      return;
    }

    container.innerHTML = values.filter(value => value.minutes > 0).map(value => `
      <div class="breakdown-row">
        <div class="breakdown-row-header">
          <strong>
            <span class="subject-color-dot" style="background:${escapeHTML(value.color)}"></span>
            ${escapeHTML(value.name)}
          </strong>
          <span class="breakdown-time">${formatMinutes(value.minutes)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${Math.min(100, value.minutes / max * 100)}%;background:${escapeHTML(value.color)}"></div>
        </div>
      </div>`).join("");
  }

  function renderTargetProgress() {
    const container = $("#target-progress");
    if (!container) return;

    const dailyTarget = Math.max(1, Number(state.settings.dailyTarget) || 60);
    const weeklyTarget = Math.max(1, Number(state.settings.weeklyTarget) || 420);

    const daily = getTodayMinutes();
    const weekly = totalMinutes(getWeekRecords());

    container.innerHTML = `
      <div>
        <strong>今日：${formatMinutes(daily)} / ${formatMinutes(dailyTarget)}</strong>
        <div class="progress-track">
          <div class="progress-fill" style="width:${Math.min(100, daily / dailyTarget * 100)}%"></div>
        </div>
      </div>
      <div>
        <strong>今週：${formatMinutes(weekly)} / ${formatMinutes(weeklyTarget)}</strong>
        <div class="progress-track">
          <div class="progress-fill" style="width:${Math.min(100, weekly / weeklyTarget * 100)}%;background:linear-gradient(90deg,#c5a2ff,#8aa2ff)"></div>
        </div>
      </div>`;
  }

  function renderRecordList() {
    const container = $("#period-records");
    if (!container) return;

    const records = [...state.records].sort((a, b) =>
      String(b.date).localeCompare(String(a.date)) ||
      Number(b.createdAt || 0) - Number(a.createdAt || 0)
    );

    if (!records.length) {
      container.innerHTML = '<p class="empty-state">まだ学習記録がありません。</p>';
      return;
    }

    container.innerHTML = records.slice(0, 100).map(record => `
      <article class="record-card">
        <div class="record-card-header">
          <div>
            <strong>${escapeHTML(subjectName(record.subjectId))}</strong>
            <small>${escapeHTML(itemName(record.itemId))} · ${escapeHTML(formatDate(record.date, { weekday: true }))}</small>
          </div>
          <div class="breakdown-time">${formatMinutes(record.minutes)}</div>
        </div>
        ${record.note ? `<p>${escapeHTML(record.note)}</p>` : ""}
        <div class="button-row">
          <button class="secondary-button" type="button" data-delete-record="${escapeHTML(record.id)}">この記録を削除</button>
        </div>
      </article>`).join("");
  }

  function deleteRecord(id) {
    const record = state.records.find(item => item.id === id);
    if (!record) return;

    if (!confirm("この学習記録を削除しますか？")) return;

    state.records = state.records.filter(item => item.id !== id);
    saveAll();
    renderRecords();
    renderSubjects();
    renderHome();
    showToast("学習記録を削除しました。");
  }

  function renderCalendar() {
    renderCalendarGrid();
    renderDayItems();
    renderTasks();
  }

  function renderCalendarGrid() {
    const container = $("#calendar-grid");
    if (!container) return;

    const month = state.calendarMonth;
    const year = month.getFullYear();
    const monthIndex = month.getMonth();

    const title = $("#calendar-month");
    if (title) title.textContent = `${year}年${monthIndex + 1}月`;

    const firstDay = new Date(year, monthIndex, 1);
    const start = new Date(year, monthIndex, 1 - firstDay.getDay());
    const today = todayKey();

    let html = "";

    for (let i = 0; i < 42; i++) {
      const date = addDays(start, i);
      const key = dateKey(date);
      const isCurrentMonth = date.getMonth() === monthIndex;
      const isToday = key === today;
      const isSelected = key === state.selectedDate;

      const hasEvents = state.events.some(event => event.date === key);
      const hasTasks = state.tasks.some(task => task.date === key);

      const classes = [
        "calendar-day",
        !isCurrentMonth ? "outside-month" : "",
        isToday ? "today" : "",
        isSelected ? "selected" : ""
      ].filter(Boolean).join(" ");

      html += `
        <button type="button" class="${classes}" data-calendar-date="${key}"
          aria-label="${escapeHTML(formatDate(key, { year: true, weekday: true }))}">
          <span class="calendar-day-number">${date.getDate()}</span>
          <span class="calendar-day-indicators">
            ${hasEvents ? '<span class="event-dot" aria-label="予定あり"></span>' : ""}
            ${hasTasks ? '<span class="task-dot" aria-label="タスクあり"></span>' : ""}
          </span>
        </button>`;
    }

    container.innerHTML = html;
  }

  function renderDayItems() {
    const container = $("#day-items");
    if (!container) return;

    const title = $("#selected-day-title");
    if (title) title.textContent = `${formatDate(state.selectedDate, { year: true, weekday: true })} の予定`;

    const events = state.events
      .filter(event => event.date === state.selectedDate)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));

    if (!events.length) {
      container.innerHTML = '<p class="empty-state">この日の予定はありません。</p>';
      return;
    }

    container.innerHTML = events.map(event => `
      <article class="event-card" data-category="${escapeHTML(event.category)}">
        <div class="event-card-header">
          <div>
            <h3>${escapeHTML(event.title)}</h3>
            <p>${escapeHTML(event.time || "時間未設定")} · ${escapeHTML(categoryName(event.category))}</p>
          </div>
          <button class="secondary-button" type="button" data-delete-event="${escapeHTML(event.id)}">削除</button>
        </div>
        ${event.note ? `<p>${escapeHTML(event.note)}</p>` : ""}
      </article>`).join("");
  }

  function categoryName(category) {
    return ({
      study: "勉強",
      school: "学校",
      club: "部活",
      personal: "その他"
    })[category] || "その他";
  }

  function renderTasks() {
    const container = $("#task-list");
    if (!container) return;

    const tasks = [...state.tasks].sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });

    if (!tasks.length) {
      container.innerHTML = '<p class="empty-state">タスクはありません。</p>';
      return;
    }

    container.innerHTML = tasks.map(task => `
      <article class="task-row ${task.completed ? "completed" : ""}">
        <input type="checkbox" data-toggle-task="${escapeHTML(task.id)}"
          ${task.completed ? "checked" : ""}
          aria-label="${escapeHTML(task.title)}を完了にする">
        <div class="task-row-content">
          <h3>${escapeHTML(task.title)}</h3>
          <small class="muted">${task.date ? `期限：${escapeHTML(formatDate(task.date))}` : "期限なし"}</small>
          <div><span class="priority-label ${escapeHTML(task.priority)}">${escapeHTML(priorityName(task.priority))}</span></div>
          <div class="button-row">
            <button class="secondary-button" type="button" data-delete-task="${escapeHTML(task.id)}">削除</button>
          </div>
        </div>
      </article>`).join("");
  }

  function priorityName(priority) {
    return ({
      high: "優先度：高",
      normal: "優先度：通常",
      low: "優先度：低"
    })[priority] || "優先度：通常";
  }

  function addEvent(formData) {
    state.events.push({
      id: makeId("event"),
      title: formData.title.trim(),
      date: formData.date,
      time: formData.time || "",
      category: formData.category || "personal",
      note: formData.note || ""
    });

    state.selectedDate = formData.date;
    state.calendarMonth = new Date(
      parseDate(formData.date).getFullYear(),
      parseDate(formData.date).getMonth(),
      1
    );

    saveAll();
    renderCalendar();
    renderHome();
    showToast("予定を追加しました。");
  }

  function deleteEvent(id) {
    const event = state.events.find(item => item.id === id);
    if (!event) return;

    if (!confirm(`「${event.title}」を削除しますか？`)) return;

    state.events = state.events.filter(item => item.id !== id);
    saveAll();
    renderCalendar();
    renderHome();
    showToast("予定を削除しました。");
  }

  function addTask(title, date, priority) {
    const trimmed = title.trim();
    if (!trimmed) return;

    state.tasks.push({
      id: makeId("task"),
      title: trimmed,
      date: date || "",
      priority: priority || "normal",
      completed: false,
      createdAt: Date.now()
    });

    saveAll();
    renderCalendar();
    showToast("タスクを追加しました。");
  }

  function toggleTask(id, completed) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;

    task.completed = completed;
    saveAll();
    renderCalendar();
  }

  function deleteTask(id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;

    if (!confirm(`「${task.title}」を削除しますか？`)) return;

    state.tasks = state.tasks.filter(item => item.id !== id);
    saveAll();
    renderCalendar();
    showToast("タスクを削除しました。");
  }

  function renderGoalParentOptions() {
    const select = $("#goal-parent");
    if (!select) return;

    select.innerHTML = '<option value="">なし（大きな目標）</option>' +
      state.goals.map(goal => `
        <option value="${escapeHTML(goal.id)}">${escapeHTML(goal.name)}</option>`
      ).join("");
  }

  function goalDepth(goal, visited = new Set()) {
    if (!goal.parentId || visited.has(goal.id)) return 0;

    visited.add(goal.id);
    const parent = state.goals.find(item => item.id === goal.parentId);

    if (!parent) return 0;
    return 1 + goalDepth(parent, visited);
  }

  function goalStatus(goal) {
    if (goal.completed) return "completed";
    if (goal.parentId) {
      const parent = state.goals.find(item => item.id === goal.parentId);
      if (parent && !parent.completed) return "locked";
    }
    return "active";
  }

  function goalStatusName(goal) {
    return ({
      completed: "達成！",
      active: "進行中",
      locked: "準備中"
    })[goalStatus(goal)];
  }

  function renderGoals() {
    const container = $("#goal-list");
    const nodes = $("#goal-nodes");
    const details = $("#goal-details");

    if (!container || !nodes || !details) return;

    const mainGoal = state.goals.find(goal => !goal.parentId) || state.goals[0];
    const mainTitle = $("#goal-main-title");
    const mainDescription = $("#goal-main-description");

    if (mainTitle) mainTitle.textContent = mainGoal ? mainGoal.name : "目標を設定しよう";
    if (mainDescription) {
      mainDescription.textContent = mainGoal
        ? mainGoal.description || "小さなステップを達成して進みましょう。"
        : "大きな目標と、そのための小さなステップを登録できます。";
    }

    if (!state.goals.length) {
      nodes.innerHTML = `
        <g>
          <circle cx="180" cy="115" r="32" fill="#263b74" stroke="#91a8ff" stroke-width="2"/>
          <text x="180" y="120" text-anchor="middle" fill="#fff" font-size="13">START</text>
          <path d="M180 150 L180 215" stroke="#7588d1" stroke-width="2" stroke-dasharray="4 6"/>
          <circle cx="180" cy="250" r="25" fill="#17294d" stroke="#7087d9" stroke-width="2"/>
          <text x="180" y="254" text-anchor="middle" fill="#fff" font-size="10">GOAL</text>
          <text x="180" y="330" text-anchor="middle" fill="#b9c8ef" font-size="12">目標を追加して宇宙へ進もう</text>
          <circle cx="180" cy="480" r="46" fill="#293e79" stroke="#c4d3ff" stroke-width="2"/>
          <text x="180" y="485" text-anchor="middle" fill="#fff" font-size="14">MOON</text>
        </g>`;
      container.innerHTML = '<p class="empty-state">最初の目標を追加しましょう。</p>';
      details.innerHTML = "";
      return;
    }

    const sorted = [...state.goals].sort((a, b) =>
      goalDepth(b) - goalDepth(a) ||
      Number(a.createdAt || 0) - Number(b.createdAt || 0)
    );

    const positions = new Map();
    const topY = 75;
    const bottomY = 525;
    const gapY = sorted.length > 1
      ? Math.min(100, (bottomY - topY) / (sorted.length - 1))
      : 0;

    sorted.forEach((goal, index) => {
      const depth = goalDepth(goal);
      const x = 180 + (depth % 2 === 0 ? -1 : 1) * Math.min(depth, 2) * 65;
      const y = sorted.length === 1 ? 300 : topY + index * gapY;
      positions.set(goal.id, {
        x: Math.max(65, Math.min(295, x)),
        y
      });
    });

    let svg = `
      <g>
        <circle cx="180" cy="565" r="23" fill="#263e75" stroke="#b7ccff" stroke-width="2"/>
        <text x="180" y="569" text-anchor="middle" fill="#fff" font-size="10">MOON</text>
      </g>`;

    sorted.forEach(goal => {
      if (!goal.parentId) return;

      const from = positions.get(goal.parentId);
      const to = positions.get(goal.id);
      if (!from || !to) return;

      const middleY = (from.y + to.y) / 2;
      svg += `<path class="goal-connection" d="M ${from.x} ${from.y} C ${from.x} ${middleY}, ${to.x} ${middleY}, ${to.x} ${to.y}"/>`;
    });

    sorted.forEach(goal => {
      const position = positions.get(goal.id);
      const status = goalStatus(goal);
      const label = goal.name.length > 12
        ? goal.name.slice(0, 11) + "…"
        : goal.name;

      svg += `
        <g class="goal-node ${status}" data-goal-node="${escapeHTML(goal.id)}"
          role="button" tabindex="0" aria-label="${escapeHTML(goal.name)}">
          <circle cx="${position.x}" cy="${position.y}" r="24"
            fill="${status === "completed" ? "#276e75" : status === "locked" ? "#263047" : "#354d8b"}"
            stroke="${status === "completed" ? "#7be8d7" : status === "locked" ? "#65718b" : "#9eafff"}"
            stroke-width="2"/>
          <text x="${position.x}" y="${position.y + 4}">${status === "completed" ? "✓" : status === "locked" ? "Ⅱ" : "✦"}</text>
          <text x="${position.x}" y="${position.y + 39}">${escapeHTML(label)}</text>
        </g>`;
    });

    nodes.innerHTML = svg;

    container.innerHTML = sorted.map(goal => `
      <article class="goal-card">
        <div class="goal-card-header">
          <div>
            <h3>${escapeHTML(goal.name)}</h3>
            <p>${escapeHTML(goal.description || goal.step || "目標を達成しよう。")}</p>
            ${goal.deadline ? `<p>期限：${escapeHTML(formatDate(goal.deadline, { year: true }))}</p>` : ""}
          </div>
          <span class="goal-status ${goalStatus(goal)}">${goalStatusName(goal)}</span>
        </div>
        <div class="button-row">
          ${!goal.completed
            ? `<button class="primary-button" type="button" data-complete-goal="${escapeHTML(goal.id)}">達成にする</button>`
            : `<button class="secondary-button" type="button" data-uncomplete-goal="${escapeHTML(goal.id)}">未達成に戻す</button>`}
          <button class="secondary-button" type="button" data-delete-goal="${escapeHTML(goal.id)}">削除</button>
        </div>
      </article>`).join("");

    const activeGoals = sorted.filter(goal => !goal.completed);
    const nextGoal = activeGoals[0];

    details.innerHTML = nextGoal ? `
      <article class="goal-card">
        <h3>次のミッション：${escapeHTML(nextGoal.name)}</h3>
        <p>${escapeHTML(nextGoal.step || "この目標に向けて、今日できることを一つ進めよう。")}</p>
      </article>` : `
      <article class="goal-card">
        <h3>すべての目標を達成しました！</h3>
        <p>新しい目標を登録して、次の星を目指しましょう。</p>
      </article>`;
  }

  function addGoal(data) {
    const name = data.name.trim();
    if (!name) return;

    const parentId = data.parentId || "";

    if (parentId && !state.goals.some(goal => goal.id === parentId)) {
      showToast("親目標が見つかりません。");
      return;
    }

    const goal = {
      id: makeId("goal"),
      name,
      description: data.description.trim(),
      deadline: data.deadline || "",
      parentId,
      step: data.step.trim(),
      completed: false,
      createdAt: Date.now()
    };

    state.goals.push(goal);
    saveAll();
    renderGoals();
    showToast("目標を追加しました。");
  }

  function completeGoal(id, completed) {
    const goal = state.goals.find(item => item.id === id);
    if (!goal) return;

    if (completed) {
      const children = state.goals.filter(item => item.parentId === id);
      const incompleteChildren = children.filter(item => !item.completed);

      if (incompleteChildren.length) {
        const proceed = confirm(
          "未達成の子目標があります。それでもこの目標を達成にしますか？"
        );
        if (!proceed) return;
      }
    }

    goal.completed = completed;
    saveAll();
    renderGoals();
    showToast(completed ? "目標達成！" : "目標を未達成に戻しました。");
  }

  function deleteGoal(id) {
    const goal = state.goals.find(item => item.id === id);
    if (!goal) return;

    const children = state.goals.filter(item => item.parentId === id);
    const message = children.length
      ? `「${goal.name}」と、その下の目標のつながりを解除しますか？`
      : `「${goal.name}」を削除しますか？`;

    if (!confirm(message)) return;

    state.goals = state.goals.filter(item => item.id !== id);
    state.goals.forEach(item => {
      if (item.parentId === id) item.parentId = "";
    });

    saveAll();
    renderGoals();
    showToast("目標を削除しました。");
  }

  function exportRecords() {
    const data = {
      exportedAt: new Date().toISOString(),
      subjects: state.subjects,
      items: state.items,
      records: state.records,
      events: state.events,
      tasks: state.tasks,
      goals: state.goals,
      countdown: state.countdown,
      settings: state.settings
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `one-for-all-backup-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("記録を書き出しました。");
  }

  function bindEvents() {
    document.addEventListener("click", event => {
      const target = event.target.closest("button, [data-goal-node]");
      if (!target) return;

      if (target.dataset.navigate) {
        showView(target.dataset.navigate);
        return;
      }

      if (target.dataset.openDialog) {
        openDialog(target.dataset.openDialog);
        return;
      }

      if (target.hasAttribute("data-close-dialog")) {
        closeDialog(target.closest("dialog"));
        return;
      }

      if (target.dataset.selectSubject) {
        selectSubject(target.dataset.selectSubject);
        return;
      }

      if (target.dataset.selectItem) {
        selectItem(target.dataset.selectItem);
        return;
      }

      if (target.dataset.deleteSubject) {
        deleteSubject(target.dataset.deleteSubject);
        return;
      }

      if (target.dataset.deleteItem) {
        deleteItem(target.dataset.deleteItem);
        return;
      }

      if (target.dataset.deleteRecord) {
        deleteRecord(target.dataset.deleteRecord);
        return;
      }

      if (target.dataset.chartPeriod) {
        state.chartPeriod = target.dataset.chartPeriod;
        $$("[data-chart-period]").forEach(button => {
          button.classList.toggle("active", button === target);
        });
        renderChart();
        return;
      }

      if (target.dataset.breakdownMode) {
        state.breakdownMode = target.dataset.breakdownMode;
        $$("[data-breakdown-mode]").forEach(button => {
          button.classList.toggle("active", button === target);
        });
        renderBreakdown();
        return;
      }

      if (target.dataset.calendarDate) {
        state.selectedDate = target.dataset.calendarDate;
        const selected = parseDate(state.selectedDate);
        state.calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
        renderCalendar();
        return;
      }

      if (target.id === "calendar-prev") {
        state.calendarMonth = new Date(
          state.calendarMonth.getFullYear(),
          state.calendarMonth.getMonth() - 1,
          1
        );
        renderCalendarGrid();
        return;
      }

      if (target.id === "calendar-next") {
        state.calendarMonth = new Date(
          state.calendarMonth.getFullYear(),
          state.calendarMonth.getMonth() + 1,
          1
        );
        renderCalendarGrid();
        return;
      }

      if (target.id === "calendar-today" || target.id === "today-button") {
        state.selectedDate = todayKey();
        state.calendarMonth = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        );

        if (target.id === "today-button" && state.view !== "calendar") {
          showView("home");
        } else {
          renderCalendar();
        }
        return;
      }

      if (target.dataset.deleteEvent) {
        deleteEvent(target.dataset.deleteEvent);
        return;
      }

      if (target.dataset.deleteTask) {
        deleteTask(target.dataset.deleteTask);
        return;
      }

      if (target.dataset.completeGoal) {
        completeGoal(target.dataset.completeGoal, true);
        return;
      }

      if (target.dataset.uncompleteGoal) {
        completeGoal(target.dataset.uncompleteGoal, false);
        return;
      }

      if (target.dataset.deleteGoal) {
        deleteGoal(target.dataset.deleteGoal);
        return;
      }

      if (target.dataset.goalNode) {
        const goal = state.goals.find(item => item.id === target.dataset.goalNode);
        if (goal) {
          const card = [...$$(".goal-card")].find(element =>
            element.querySelector("h3")?.textContent === goal.name
          );
          card?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (target.id === "timer-start") {
        startTimer();
        return;
      }

      if (target.id === "timer-pause") {
        pauseTimer();
        return;
      }

      if (target.id === "timer-stop") {
        stopTimer();
        return;
      }

      if (target.id === "export-records") {
        exportRecords();
      }
    });

    document.addEventListener("change", event => {
      const target = event.target;

      if (target.matches("[data-toggle-task]")) {
        toggleTask(target.dataset.toggleTask, target.checked);
        return;
      }

      if (target.id === "manual-subject") {
        renderSubjectSelects();
        return;
      }

      if (target.id === "manual-item") {
        const item = itemById(target.value);
        if (item) {
          state.selectedSubjectId = item.subjectId;
          state.selectedItemId = item.id;
        }
      }
    });

    $("#subject-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const name = $("#subject-name")?.value || "";
      const color = $("#subject-color")?.value || COLORS[0];

      addSubject(name, color);
      event.currentTarget.reset();
      closeDialog($("#subject-dialog"));
    });

    $("#item-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const name = $("#item-name")?.value || "";
      const subjectId = $("#item-subject")?.value || "";

      if (!subjectId) {
        showToast("科目を選択してください。");
        return;
      }

      addItem(name, subjectId);
      event.currentTarget.reset();
      closeDialog($("#item-dialog"));
    });

    $("#manual-time-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const subjectId = $("#manual-subject")?.value || "";
      const itemId = $("#manual-item")?.value || "";
      const hours = Number($("#manual-hours")?.value || 0);
      const minutes = Number($("#manual-minutes")?.value || 0);
      const date = $("#manual-date")?.value || todayKey();
      const note = $("#manual-note")?.value || "";

      if (!subjectById(subjectId)) {
        showToast("科目を選択してください。");
        return;
      }

      if (!Number.isFinite(hours) || !Number.isFinite(minutes) ||
          hours < 0 || minutes < 0 || minutes > 59) {
        showToast("時間と分を正しく入力してください。");
        return;
      }

      const total = hours * 60 + minutes;
      if (total <= 0) {
        showToast("1分以上の時間を入力してください。");
        return;
      }

      const saved = addStudyRecord({
        subjectId,
        itemId,
        date,
        minutes: total,
        note
      });

      if (saved) {
        $("#manual-hours").value = "0";
        $("#manual-minutes").value = "30";
        $("#manual-note").value = "";
        showToast("学習時間を追加しました。");
      }
    });

    $("#study-target-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const daily = Number($("#daily-target")?.value);
      const weekly = Number($("#weekly-target")?.value);

      if (!Number.isFinite(daily) || daily < 1 ||
          !Number.isFinite(weekly) || weekly < 1) {
        showToast("目標時間は1分以上にしてください。");
        return;
      }

      state.settings.dailyTarget = daily;
      state.settings.weeklyTarget = weekly;

      saveAll();
      renderTargetProgress();
      showToast("目標学習時間を保存しました。");
    });

    $("#event-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const title = $("#event-title")?.value || "";
      const date = $("#event-date")?.value || "";

      if (!title.trim() || !date) {
        showToast("予定名と日付を入力してください。");
        return;
      }

      addEvent({
        title,
        date,
        time: $("#event-time")?.value || "",
        category: $("#event-category")?.value || "personal",
        note: $("#event-note")?.value || ""
      });

      event.currentTarget.reset();
      closeDialog($("#event-dialog"));
    });

    $("#task-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const title = $("#task-title")?.value || "";
      if (!title.trim()) return;

      addTask(
        title,
        $("#task-date")?.value || "",
        $("#task-priority")?.value || "normal"
      );

      event.currentTarget.reset();
      closeDialog($("#task-dialog"));
    });

    $("#goal-form")?.addEventListener("submit", event => {
      event.preventDefault();

      addGoal({
        name: $("#goal-name")?.value || "",
        description: $("#goal-description")?.value || "",
        deadline: $("#goal-deadline")?.value || "",
        parentId: $("#goal-parent")?.value || "",
        step: $("#goal-step")?.value || ""
      });

      event.currentTarget.reset();
      closeDialog($("#goal-dialog"));
    });

    $("#countdown-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const name = $("#countdown-name")?.value || "";
      const date = $("#countdown-date")?.value || "";

      if (!name.trim() || !date) {
        showToast("イベント名と日付を入力してください。");
        return;
      }

      state.countdown = {
        name: name.trim(),
        date
      };

      saveAll();
      renderCountdown();
      closeDialog($("#countdown-dialog"));
      showToast("カウントダウンを保存しました。");
    });

    window.addEventListener("resize", () => {
      if (state.view === "records") renderChart();
    });

    window.addEventListener("pagehide", () => {
      if (state.timer.running) {
        state.timer.elapsedBeforeStart +=
          (Date.now() - state.timer.startedAt) / 1000;
        state.timer.startedAt = Date.now();
      }
      saveAll();
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;

      const open = $("dialog[open]");
      if (open) closeDialog(open);
    });
  }

  function initializeFormDefaults() {
    const dateInput = $("#manual-date");
    if (dateInput && !dateInput.value) dateInput.value = todayKey();

    const daily = $("#daily-target");
    if (daily) daily.value = state.settings.dailyTarget;

    const weekly = $("#weekly-target");
    if (weekly) weekly.value = state.settings.weeklyTarget;

    renderSubjectSelects();
  }

  function init() {
    loadData();
    bindEvents();
    initializeFormDefaults();

    renderHome();
    renderSubjects();
    renderRecords();
    renderCalendar();
    renderGoals();

    showView("home");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();