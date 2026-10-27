
/* =========================================================
   ONE FOR ALL — COSMOS
   js/ui.js
   画面操作・学習記録・タイマー・設定・保存
   ========================================================= */

"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const STORAGE_KEY = "ofa-cosmos-data-v1";

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

  let data = loadData();
  let timer = {
    running: false,
    startedAt: 0,
    accumulated: 0,
    subject: "",
    item: "",
    interval: null
  };

  let dialogResolve = null;
  let selectedDate = dateKey(new Date());
  let calendarMonth = new Date();
  let currentView = "home";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return clone(DEFAULTS);

      const parsed = JSON.parse(saved);

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
        }
      };
    } catch (error) {
      console.error("保存データを読み込めませんでした:", error);
      return clone(DEFAULTS);
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("データを保存できませんでした:", error);
      showMessage("保存できませんでした。空き容量を確認してください。");
      return false;
    }
  }

  function uid(prefix = "item") {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
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

  function formatMinutes(minutes) {
    const total = Math.max(0, Math.floor(minutes));
    const hours = Math.floor(total / 60);
    const mins = total % 60;

    if (hours && mins) return `${hours}時間${mins}分`;
    if (hours) return `${hours}時間`;
    return `${mins}分`;
  }

  function formatClock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor(total / 60) % 60).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function showMessage(message) {
    const toast = $("#cosmos-message");
    if (!toast) {
      console.info(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("is-visible");
    toast.hidden = false;

    clearTimeout(showMessage.timeout);
    showMessage.timeout = setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.hidden = true;
    }, 2800);
  }

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
      section.classList.toggle("active", active);
      section.hidden = !active;
      section.setAttribute("aria-hidden", String(!active));
    });

    $$("[data-view]").forEach(button => {
      const active = button.dataset.view === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    closeMenu();

    if (name === "home") renderHome();
    if (name === "study") renderStudy();
    if (name === "calendar") renderCalendar();
    if (name === "statistics") renderStatistics();
    if (name === "goals") renderGoals();
    if (name === "rocket") renderRocket();
    if (name === "economy") renderEconomy();
    if (name === "countdown") renderCountdown();
    if (name === "notifications") renderNotifications();
    if (name === "settings") renderSettings();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function dialog(title, content, confirmText = "保存") {
    const element = $("#cosmos-dialog");
    const titleElement = $("#cosmos-dialog-title");
    const contentElement = $("#cosmos-dialog-content");
    const confirmButton = $("#cosmos-dialog-confirm");

    if (!element || !contentElement || !confirmButton) {
      return Promise.resolve(null);
    }

    titleElement.textContent = title;
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
    if (!element) return;

    if (typeof element.close === "function" && element.open) {
      element.close();
    } else {
      element.removeAttribute("open");
    }

    if (dialogResolve) {
      const resolve = dialogResolve;
      dialogResolve = null;
      resolve(result);
    }
  }

  function dialogValue(name) {
    const field = $(`[name="${name}"]`, $("#cosmos-dialog-content"));
    return field ? field.value.trim() : "";
  }

  function addStudyRecord(record) {
    const minutes = Math.floor(Number(record.minutes));

    if (!Number.isFinite(minutes) || minutes <= 0) {
      showMessage("学習時間は1分以上にしてください。");
      return false;
    }

    const subject = String(record.subject || "").trim();
    const item = String(record.item || "").trim();

    if (!subject) {
      showMessage("教科を入力してください。");
      return false;
    }

    const date = record.date || todayKey();

    const savedRecord = {
      id: uid("study"),
      date,
      subject,
      item,
      minutes,
      note: String(record.note || "").trim(),
      createdAt: new Date().toISOString()
    };

    data.studyRecords.push(savedRecord);

    const existingSubject = data.subjects.find(
      entry => entry.name === subject
    );

    if (!existingSubject) {
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

    awardStudyExp(minutes);
    saveData();
    renderAll();

    showMessage("学習記録を保存しました。行動実績にも反映しました。");
    return true;
  }

  function colorForIndex(index) {
    const colors = [
      "#69a7ff",
      "#b69aff",
      "#ff8fc7",
      "#76e3b0",
      "#ffd780",
      "#66e0e8",
      "#ff8295"
    ];

    return colors[index % colors.length];
  }

  function totalMinutes(records) {
    return records.reduce((sum, record) =>
      sum + Math.max(0, Number(record.minutes) || 0), 0);
  }

  function recordsForDate(date) {
    return data.studyRecords.filter(record => record.date === date);
  }

  function totalForDate(date) {
    return totalMinutes(recordsForDate(date));
  }

  function totalForRange(start, end) {
    return totalMinutes(data.studyRecords.filter(record =>
      record.date >= start && record.date <= end
    ));
  }

  function startTimer() {
    if (timer.running) return;

    timer.running = true;
    timer.startedAt = Date.now();
    timer.interval = setInterval(updateTimerDisplay, 250);

    $("#study-timer-status") &&
      ($("#study-timer-status").textContent = "学習中");

    updateTimerButtons();
    updateTimerDisplay();
  }

  function pauseTimer() {
    if (!timer.running) return;

    timer.accumulated += Date.now() - timer.startedAt;
    timer.running = false;
    clearInterval(timer.interval);
    timer.interval = null;

    $("#study-timer-status") &&
      ($("#study-timer-status").textContent = "一時停止中");

    updateTimerButtons();
    updateTimerDisplay();
  }

  function resetTimer() {
    clearInterval(timer.interval);

    timer = {
      running: false,
      startedAt: 0,
      accumulated: 0,
      subject: "",
      item: "",
      interval: null
    };

    updateTimerButtons();
    updateTimerDisplay();

    const status = $("#study-timer-status");
    if (status) status.textContent = "待機中";
  }

  function elapsedMilliseconds() {
    return timer.accumulated +
      (timer.running ? Date.now() - timer.startedAt : 0);
  }

  function updateTimerDisplay() {
    const display = $("#study-timer-display");
    if (!display) return;

    display.textContent = formatClock(
      elapsedMilliseconds() / 1000
    );
  }

  function updateTimerButtons() {
    const start = $('[data-action="timer-start"]');
    const pause = $('[data-action="timer-pause"]');
    const finish = $('[data-action="timer-finish"]');

    if (start) start.disabled = timer.running;
    if (pause) pause.disabled = !timer.running;
    if (finish) finish.disabled = elapsedMilliseconds() < 1000;
  }

  async function finishTimer() {
    if (timer.running) pauseTimer();

    const minutes = Math.floor(elapsedMilliseconds() / 60000);

    if (minutes < 1) {
      showMessage("1分以上計測してから記録してください。");
      return;
    }

    const content = `
      <label>教科
        <input name="subject" required maxlength="60"
          placeholder="例：数学" value="${escapeHTML(timer.subject)}">
      </label>
      <label>学習した内容
        <input name="item" maxlength="120"
          placeholder="例：二次関数" value="${escapeHTML(timer.item)}">
      </label>
      <label>記録時間（分）
        <input name="minutes" type="number" min="1"
          max="${minutes}" value="${minutes}" required>
      </label>
      <label>メモ
        <textarea name="note" maxlength="500"
          placeholder="任意"></textarea>
      </label>
      <p>計測時間：${formatMinutes(minutes)}</p>
    `;

    const result = await dialog("学習を記録", content, "記録する");

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

  function renderSubjects() {
    const list = $("#study-subject-list");
    if (!list) return;

    if (!data.subjects.length) {
      list.innerHTML = "<p>教科がありません。教科を追加してください。</p>";
      return;
    }

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
          <button type="button" data-remove-subject="${escapeHTML(subject.id)}"
            aria-label="${escapeHTML(subject.name)}を削除">削除</button>
        </article>
      `;
    }).join("");
  }

  function renderStudyRecords() {
    const list = $("#study-record-list");
    if (!list) return;

    const records = [...data.studyRecords].sort((a, b) =>
      `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)
    );

    if (!records.length) {
      list.innerHTML = "<p>まだ学習記録がありません。</p>";
      return;
    }

    list.innerHTML = records.slice(0, 100).map(record => `
      <article class="record-card">
        <div>
          <strong>${escapeHTML(record.subject)}</strong>
          ${record.item ? `<span>${escapeHTML(record.item)}</span>` : ""}
          <small>${escapeHTML(record.date)}</small>
          ${record.note ? `<p>${escapeHTML(record.note)}</p>` : ""}
        </div>
        <strong>${formatMinutes(record.minutes)}</strong>
        <button type="button" data-delete-record="${escapeHTML(record.id)}"
          aria-label="学習記録を削除">削除</button>
      </article>
    `).join("");
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
        <input name="name" maxlength="60" required placeholder="例：情報">
      </label>
    `);

    if (!result || !result.name) return;

    if (data.subjects.some(subject => subject.name === result.name)) {
      showMessage("その教科はすでに登録されています。");
      return;
    }

    data.subjects.push({
      id: uid("subject"),
      name: result.name,
      color: colorForIndex(data.subjects.length)
    });

    saveData();
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

    if (!result || !result.subject || !result.name) return;

    if (!data.subjects.some(subject => subject.name === result.subject)) {
      data.subjects.push({
        id: uid("subject"),
        name: result.subject,
        color: colorForIndex(data.subjects.length)
      });
    }

    data.studyItems.push({
      id: uid("study-item"),
      subject: result.subject,
      name: result.name
    });

    saveData();
    renderStudy();
    showMessage("学習項目を追加しました。");
  }

  function renderHome() {
    const todayMinutes = totalForDate(todayKey());
    const goal = Math.max(1, Number(data.settings.dailyGoal) || 120);
    const percent = Math.min(100, Math.round(todayMinutes / goal * 100));

    setText("#home-today-time", formatMinutes(todayMinutes));
    setText("#home-goal-percent", `${percent}%`);
    setText("#home-goal-message",
      todayMinutes >= goal ? "今日の目標達成！" : "目標まであと " +
      formatMinutes(goal - todayMinutes));

    setWidth("#home-goal-progress", percent);

    setText("#home-rocket-level", `Lv.${data.rocket.level}`);
    setText("#home-rocket-exp", `${data.rocket.exp} EXP`);
    setWidth("#home-rocket-progress", data.rocket.exp % 100);

    const nextRecord = [...data.studyItems].slice(0, 1)[0];
    setText("#home-next-mission",
      nextRecord ? `${nextRecord.subject}：${nextRecord.name}` : "学習項目を登録しよう");

    renderHomeSchedule();
    renderHomeCountdown();
  }

  function renderHomeSchedule() {
    const list = $("#home-schedule-list");
    if (!list) return;

    const events = data.events
      .filter(event => event.date === todayKey())
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    const records = recordsForDate(todayKey());

    const rows = [
      ...events.map(event => ({
        time: event.time || "",
        title: event.title,
        type: "予定"
      })),
      ...records.map(record => ({
        time: "",
        title: `${record.subject}${record.item ? "： " + record.item : ""} (${formatMinutes(record.minutes)})`,
        type: "実績"
      }))
    ].sort((a, b) => a.time.localeCompare(b.time));

    list.innerHTML = rows.length
      ? rows.map(row => `
          <article class="schedule-row">
            <span>${escapeHTML(row.time || "—")}</span>
            <span class="schedule-type">${row.type}</span>
            <span>${escapeHTML(row.title)}</span>
          </article>
        `).join("")
      : "<p>今日の予定・実績はありません。</p>";
  }

  function renderHomeCountdown() {
    const list = $("#home-countdown-list");
    if (!list) return;

    const today = parseDate(todayKey());

    list.innerHTML = data.countdowns.slice(0, 3).map(item => {
      const days = Math.ceil(
        (parseDate(item.date) - today) / 86400000
      );

      return `
        <article class="countdown-row">
          <strong>${escapeHTML(item.title)}</strong>
          <span>${days < 0 ? "期限超過" : `あと ${days} 日`}</span>
        </article>
      `;
    }).join("") || "<p>カウントダウンはありません。</p>";
  }

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
        const selected = key === selectedDate;

        html += `
          <button type="button"
            class="calendar-day${selected ? " selected" : ""}${key === todayKey() ? " today" : ""}"
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
        title: `${record.subject}${record.item ? "： " + record.item : ""}`,
        detail: formatMinutes(record.minutes)
      }))
    ].sort((a, b) => a.time.localeCompare(b.time));

    list.innerHTML = entries.length
      ? entries.map(entry => `
          <article class="day-entry">
            <span class="entry-type">${entry.type}</span>
            <strong>${escapeHTML(entry.title)}</strong>
            <span>${escapeHTML(entry.time || entry.detail)}</span>
            ${entry.type === "予定"
              ? `<button type="button" data-delete-event="${escapeHTML(entry.id)}">削除</button>`
              : ""}
          </article>
        `).join("")
      : "<p>この日の予定・実績はありません。</p>";
  }

  async function addEvent() {
    const result = await dialog("予定を追加", `
      <label>予定名
        <input name="title" required maxlength="120" placeholder="例：数学の課題">
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

    if (!result || !result.title || !result.date) return;

    data.events.push({
      id: uid("event"),
      title: result.title,
      date: result.date,
      time: result.time,
      note: result.note
    });

    selectedDate = result.date;
    calendarMonth = parseDate(result.date);
    saveData();
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
            item.day === index && Number(item.hour) === hour
          );

          return `<td>${
            entries.map(item =>
              `<div class="timetable-entry">${escapeHTML(item.title)}</div>`
            ).join("")
          }</td>`;
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

    if (!result || !result.title) return;

    data.timetable.push({
      id: uid("timetable"),
      day: Number(result.day),
      hour: Number(result.hour),
      title: result.title
    });

    saveData();
    renderTimetable();
    showMessage("時間割を保存しました。");
  }

  async function addTask() {
    const result = await dialog("タスクを追加", `
      <label>タスク名
        <input name="title" required maxlength="120" placeholder="例：英単語を覚える">
      </label>
      <label>期限
        <input name="date" type="date" value="${todayKey()}">
      </label>
    `);

    if (!result || !result.title) return;

    data.tasks.push({
      id: uid("task"),
      title: result.title,
      date: result.date || todayKey(),
      done: false
    });

    saveData();
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

  function renderStatistics() {
    const today = totalForDate(todayKey());
    const goal = Number(data.settings.dailyGoal) || 120;

    setText("#stats-today-time", formatMinutes(today));
    setText("#stats-today-goal", formatMinutes(goal));
    setText("#stats-today-progress",
      `${Math.min(100, Math.round(today / Math.max(1, goal) * 100))}%`);

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

    canvas.width = Math.max(1, rect.width * ratio);
    canvas.height = Math.max(1, rect.height * ratio);
    ctx.scale(ratio, ratio);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.38;
    const innerRadius = radius * 0.58;

    const values = data.subjects.map(subject => ({
      ...subject,
      minutes: totalMinutes(data.studyRecords.filter(record =>
        record.subject === subject.name
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
        const nextAngle = angle + item.minutes / total * Math.PI * 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, angle, nextAngle);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = radius - innerRadius;
        ctx.stroke();

        angle = nextAngle;
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

    canvas.width = Math.max(1, rect.width * ratio);
    canvas.height = Math.max(1, rect.height * ratio);
    ctx.scale(ratio, ratio);

    const width = rect.width;
    const height = rect.height;
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
      ctx.roundRect(x, y, barWidth, Math.max(2, barHeight), 4);
      ctx.fill();

      ctx.fillStyle = "#aab7d2";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        weekly ? `${item.date.getMonth() + 1}/${item.date.getDate()}` :
          `${item.date.getMonth() + 1}/${item.date.getDate()}`,
        x + barWidth / 2,
        height - 7
      );
    });
  }

  function renderGoals() {
    const list = $("#goal-list");
    if (!list) return;

    const completed = data.goals.filter(goal => goal.done).length;
    setText("#goal-map-completion",
      `${completed}/${data.goals.length}`);
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
    const height = Math.max(400, data.goalNodes.length * 100 + 120);

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);

    const nodes = data.goalNodes.length
      ? data.goalNodes
      : [
          { id: "root", title: "月を目指す", parentId: null, done: false }
        ];

    const centerX = width / 2;
    const positions = new Map();

    nodes.forEach((node, index) => {
      positions.set(node.id, {
        x: centerX + ((index % 3) - 1) * Math.min(90, width * 0.24),
        y: 55 + Math.floor(index / 3) * 95
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
      const label = String(node.title || "").slice(0, 12);

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
      ctx.fillText(label, point.x, point.y + 38);
    });
  }

  async function addGoal() {
    const result = await dialog("目標を追加", `
      <label>目標
        <input name="title" required maxlength="120" placeholder="例：数学のテストで目標点を取る">
      </label>
      <label>期限
        <input name="date" type="date">
      </label>
    `);

    if (!result || !result.title) return;

    data.goals.push({
      id: uid("goal"),
      title: result.title,
      date: result.date,
      done: false
    });

    saveData();
    renderGoals();
    showMessage("目標を追加しました。");
  }

  async function addGoalNode() {
    const options = data.goalNodes.map(node =>
      `<option value="${escapeHTML(node.id)}">${escapeHTML(node.title)}</option>`
    ).join("");

    const result = await dialog("スキルツリーに追加", `
      <label>ノード名
        <input name="title" required maxlength="80" placeholder="例：基礎学力を完成させる">
      </label>
      <label>接続先
        <select name="parentId">
          <option value="">月への最初の目標</option>
          ${options}
        </select>
      </label>
    `);

    if (!result || !result.title) return;

    data.goalNodes.push({
      id: uid("node"),
      title: result.title,
      parentId: result.parentId || null,
      done: false
    });

    saveData();
    renderGoals();
    showMessage("スキルツリーにノードを追加しました。");
  }

  async function addHabit() {
    const result = await dialog("習慣を追加", `
      <label>習慣名
        <input name="title" required maxlength="100" placeholder="例：毎日英単語を復習">
      </label>
    `);

    if (!result || !result.title) return;

    data.habits.push({
      id: uid("habit"),
      title: result.title,
      dates: []
    });

    saveData();
    renderHabits();
    showMessage("習慣を追加しました。");
  }

  function renderHabits() {
    const list = $("#habit-list");
    if (!list) return;

    list.innerHTML = data.habits.map(habit => {
      const doneToday = habit.dates.includes(todayKey());

      return `
        <article class="habit-row">
          <label>
            <input type="checkbox" data-habit="${escapeHTML(habit.id)}"
              ${doneToday ? "checked" : ""}>
            ${escapeHTML(habit.title)}
          </label>
          <small>達成 ${habit.dates.length}日</small>
        </article>
      `;
    }).join("") || "<p>習慣を登録しましょう。</p>";
  }

  function awardStudyExp(minutes) {
    const oldLevel = data.rocket.level;
    data.rocket.exp += Math.max(0, minutes);

    while (data.rocket.exp >= 100) {
      data.rocket.exp -= 100;
      data.rocket.level += 1;
    }

    if (data.rocket.level > oldLevel) {
      showMessage(`ロケットがレベル ${data.rocket.level} に上がりました！`);
    }
  }

  function renderRocket() {
    setText("#rocket-name", data.rocket.name);
    setText("#rocket-level", `Lv.${data.rocket.level}`);
    setText("#rocket-exp-label", `${data.rocket.exp}/100 EXP`);
    setWidth("#rocket-exp-progress", data.rocket.exp);

    const missionList = $("#mission-list");
    if (missionList) {
      missionList.innerHTML = data.rocket.missions.map(mission => `
        <article>${escapeHTML(mission.title)}</article>
      `).join("") || "<p>ミッションは今後追加できます。</p>";
    }

    const partsList = $("#rocket-parts-list");
    if (partsList) {
      partsList.innerHTML = data.rocket.parts.map(part =>
        `<article>${escapeHTML(part.title)}</article>`
      ).join("") || "<p>パーツはまだありません。</p>";
    }

    const explorationList = $("#space-exploration-list");
    if (explorationList) {
      explorationList.innerHTML = data.rocket.explorations.map(item =>
        `<article>${escapeHTML(item.title)}</article>`
      ).join("") || "<p>学習を積み重ねて宇宙を目指しましょう。</p>";
    }
  }

  function renderEconomy() {
    setText("#economy-balance",
      `${Number(data.economy.balance || 0).toLocaleString()} コスモ`);

    setText("#economy-net-worth",
      `${Number(data.economy.balance || 0).toLocaleString()} コスモ`);

    const loans = $("#economy-loan-list");
    if (loans) {
      loans.innerHTML = data.economy.loans.map(loan => `
        <article>
          <strong>${escapeHTML(loan.title || "借入")}</strong>
          <span>${Number(loan.amount || 0).toLocaleString()} コスモ</span>
        </article>
      `).join("") || "<p>借入はありません。</p>";
    }

    const transactions = $("#economy-transaction-list");
    if (transactions) {
      transactions.innerHTML = [...data.economy.transactions]
        .reverse().slice(0, 50).map(item => `
          <article>
            <span>${escapeHTML(item.date)}</span>
            <span>${escapeHTML(item.title)}</span>
            <strong>${item.amount >= 0 ? "+" : ""}${Number(item.amount).toLocaleString()}</strong>
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

    saveData();
    renderEconomy();
    showMessage("取引を保存しました。");
  }

  async function addCountdown() {
    const result = await dialog("カウントダウンを追加", `
      <label>イベント名
        <input name="title" required maxlength="100" placeholder="例：定期考査">
      </label>
      <label>日付
        <input name="date" type="date" required>
      </label>
    `);

    if (!result || !result.title || !result.date) return;

    data.countdowns.push({
      id: uid("countdown"),
      title: result.title,
      date: result.date
    });

    saveData();
    renderCountdown();
    renderHomeCountdown();
    showMessage("カウントダウンを追加しました。");
  }

  function renderCountdown() {
    const list = $("#countdown-list");
    if (!list) return;

    const today = parseDate(todayKey());

    list.innerHTML = data.countdowns.map(item => {
      const days = Math.ceil(
        (parseDate(item.date) - today) / 86400000
      );

      return `
        <article class="countdown-card">
          <div>
            <strong>${escapeHTML(item.title)}</strong>
            <small>${escapeHTML(item.date)}</small>
          </div>
          <strong>${days < 0 ? `${Math.abs(days)}日超過` : `あと${days}日`}</strong>
          <button type="button" data-delete-countdown="${escapeHTML(item.id)}">削除</button>
        </article>
      `;
    }).join("") || "<p>イベントを追加してください。</p>";
  }

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

  function renderSettings() {
    setValue("#setting-daily-goal", data.settings.dailyGoal);
    setValue("#setting-weekly-goal", data.settings.weeklyGoal);
    setValue("#setting-minimum-action", data.settings.minimumAction);
    setChecked("#setting-animations", data.settings.animations);
    setValue("#setting-theme", data.settings.theme);

    $$('input[name="bottomShortcut"]').forEach(input => {
      input.checked = data.settings.shortcuts.includes(input.value);
    });

    renderBottomNavigation();
  }

  function saveSettings(event) {
    event?.preventDefault();

    data.settings.dailyGoal = Math.max(
      1, Number($("#setting-daily-goal")?.value) || 120
    );

    data.settings.weeklyGoal = Math.max(
      1, Number($("#setting-weekly-goal")?.value) || 840
    );

    data.settings.minimumAction = Math.max(
      1, Number($("#setting-minimum-action")?.value) || 5
    );

    data.settings.animations = $("#setting-animations")?.checked ?? true;
    data.settings.theme = $("#setting-theme")?.value || "cosmos";

    data.settings.shortcuts = $$('input[name="bottomShortcut"]:checked')
      .map(input => input.value);

    document.body.classList.toggle(
      "animations-disabled",
      !data.settings.animations
    );

    document.documentElement.dataset.theme = data.settings.theme;

    saveData();
    renderBottomNavigation();
    renderHome();
    showMessage("設定を保存しました。");
  }

  function renderBottomNavigation() {
    const nav = $("#bottom-navigation");
    if (!nav) return;

    const shortcuts = data.settings.shortcuts || [];
    const buttons = $$("[data-shortcut]", nav);

    buttons.forEach(button => {
      const key = button.dataset.shortcut;
      button.hidden = !shortcuts.includes(key);
    });

    nav.hidden = shortcuts.length === 0;
  }

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
    renderBottomNavigation();
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function setValue(selector, value) {
    const element = $(selector);
    if (element) element.value = value;
  }

  function setChecked(selector, value) {
    const element = $(selector);
    if (element) element.checked = Boolean(value);
  }

  function setWidth(selector, percent) {
    const element = $(selector);
    if (element) {
      element.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      element.setAttribute("aria-valuenow", String(Math.round(percent)));
    }
  }

  function bindEvents() {
    $("#menu-open")?.addEventListener("click", openMenu);
    $("#menu-close")?.addEventListener("click", closeMenu);
    $("#menu-backdrop")?.addEventListener("click", closeMenu);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    });

    $$("[data-view]").forEach(button => {
      button.addEventListener("click", () => {
        showView(button.dataset.view);
      });
    });

    $$("[data-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;

        if (action === "start-study") {
          showView("study");
          startTimer();
        }

        if (action === "timer-start") startTimer();
        if (action === "timer-pause") pauseTimer();
        if (action === "timer-finish") finishTimer();
      });
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

      if (success) event.target.reset();

      const dateField = $("#manual-study-date");
      if (dateField) dateField.value = todayKey();
    });

    $("#add-subject")?.addEventListener("click", addSubject);
    $("#add-study-item")?.addEventListener("click", addStudyItem);

    $("#add-event")?.addEventListener("click", addEvent);
    $("#calendar-prev")?.addEventListener("click", () => {
      calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      );
      renderCalendar();
    });

    $("#calendar-next")?.addEventListener("click", () => {
      calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      );
      renderCalendar();
    });

    $("#calendar-grid")?.addEventListener("click", event => {
      const button = event.target.closest("[data-calendar-date]");
      if (!button) return;

      selectedDate = button.dataset.calendarDate;
      renderCalendar();
    });

    $("#edit-timetable")?.addEventListener("click", editTimetable);
    $("#add-task")?.addEventListener("click", addTask);

    $("#add-goal")?.addEventListener("click", addGoal);
    $("#add-goal-map-node")?.addEventListener("click", addGoalNode);
    $("#add-habit")?.addEventListener("click", addHabit);

    $("#add-countdown")?.addEventListener("click", addCountdown);
    $("#enable-notifications")?.addEventListener("click", enableNotifications);

    $("#settings-study-form")?.addEventListener("submit", saveSettings);

    $("#economy-deposit")?.addEventListener("click", () => economyTransaction("deposit"));
    $("#economy-withdraw")?.addEventListener("click", () => economyTransaction("withdraw"));
    $("#economy-borrow")?.addEventListener("click", () => economyTransaction("borrow"));

    $("#cosmos-dialog-confirm")?.addEventListener("click", event => {
      event.preventDefault();

      const content = $("#cosmos-dialog-content");
      const form = content?.querySelector("form");
      const fields = content?.querySelectorAll("input, select, textarea") || [];

      for (const field of fields) {
        if (!field.reportValidity()) return;
      }

      const result = {};
      fields.forEach(field => {
        if (field.name) result[field.name] = field.value.trim();
      });

      closeDialog(result);
    });

    $("#cosmos-dialog")?.addEventListener("click", event => {
      const element = $("#cosmos-dialog");
      if (event.target === element) closeDialog(null);
    });

    $("#cosmos-dialog")?.addEventListener("cancel", event => {
      event.preventDefault();
      closeDialog(null);
    });

    document.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;

      if (button.dataset.deleteRecord) {
        if (!confirm("この学習記録を削除しますか？")) return;

        data.studyRecords = data.studyRecords.filter(record =>
          record.id !== button.dataset.deleteRecord
        );

        saveData();
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

        saveData();
        renderStudy();
      }

      if (button.dataset.deleteEvent) {
        data.events = data.events.filter(item =>
          item.id !== button.dataset.deleteEvent
        );

        saveData();
        renderCalendar();
        renderHome();
      }

      if (button.dataset.deleteTask) {
        data.tasks = data.tasks.filter(item =>
          item.id !== button.dataset.deleteTask
        );

        saveData();
        renderTasks();
        renderHome();
      }

      if (button.dataset.deleteGoal) {
        data.goals = data.goals.filter(item =>
          item.id !== button.dataset.deleteGoal
        );

        saveData();
        renderGoals();
      }

      if (button.dataset.deleteCountdown) {
        data.countdowns = data.countdowns.filter(item =>
          item.id !== button.dataset.deleteCountdown
        );

        saveData();
        renderCountdown();
        renderHomeCountdown();
      }
    });

    document.addEventListener("change", event => {
      const input = event.target;

      if (input.matches("[data-task-done]")) {
        const task = data.tasks.find(item =>
          item.id === input.dataset.taskDone
        );

        if (task) task.done = input.checked;

        saveData();
        renderTasks();
      }

      if (input.matches("[data-goal-done]")) {
        const goal = data.goals.find(item =>
          item.id === input.dataset.goalDone
        );

        if (goal) goal.done = input.checked;

        saveData();
        renderGoals();
      }

      if (input.matches("[data-habit]")) {
        const habit = data.habits.find(item =>
          item.id === input.dataset.habit
        );

        if (!habit) return;

        habit.dates = habit.dates.filter(date => date !== todayKey());

        if (input.checked) habit.dates.push(todayKey());

        saveData();
        renderHabits();
      }
    });

    window.addEventListener("resize", () => {
      if (currentView === "statistics") renderStatistics();
      if (currentView === "goals") renderGoalTree();
    });
  }

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

    document.documentElement.dataset.theme = data.settings.theme || "cosmos";

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
