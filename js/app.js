
/* =========================================================
   ALGOL — Study Constellation
   js/app.js
   学習記録・タイマー・目標・グラフ・カレンダー
   ========================================================= */

"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const STORAGE = {
    calendar: "personal-calendar-v1",
    study: "algol-study-v1",
    items: "algol-study-items-v1",
    goals: "algol-goals-v1"
  };

  const COLORS = {
    blue: "#77a8ff",
    purple: "#bd9bff",
    green: "#71e5b1",
    orange: "#ffc77d",
    pink: "#ff9fc9",
    cyan: "#64e2ed",
    red: "#ff8298"
  };

  const SUBJECT_COLORS = [
    "#77a8ff",
    "#bd9bff",
    "#71e5b1",
    "#ffc77d",
    "#ff9fc9",
    "#64e2ed",
    "#ff8d78",
    "#c3e77b",
    "#a5a9ff",
    "#f3a5ec"
  ];

  const todayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const dateString = date => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const parseDate = value => {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);

  const makeId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  const loadJSON = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(`ALGOL: ${key} の読み込みに失敗しました`, error);
      return fallback;
    }
  };

  const saveJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`ALGOL: ${key} の保存に失敗しました`, error);
      showToast("保存できませんでした。端末の空き容量を確認してください。");
      return false;
    }
  };

  const showToast = message => {
    const toast = $("#toast");
    if (!toast) {
      console.info(message);
      return;
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => {
      toast.hidden = true;
    }, 2800);
  };

  const formatMinutes = minutes => {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours && mins) return `${hours}時間${mins}分`;
    if (hours) return `${hours}時間`;
    return `${mins}分`;
  };

  const formatDuration = seconds => {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
  };

  const formatJapaneseDate = value => {
    const d = parseDate(value);
    if (!d) return value || "";
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const sameDay = (a, b) => a === b;

  const dateDiff = (from, to) => {
    const a = parseDate(from);
    const b = parseDate(to);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  };

  /* ---------------------------------------------------------
     State
     --------------------------------------------------------- */

  let studyItems = loadJSON(STORAGE.items, []);
  let studyRecords = loadJSON(STORAGE.study, []);
  let goals = loadJSON(STORAGE.goals, []);

  if (!Array.isArray(studyItems)) studyItems = [];
  if (!Array.isArray(studyRecords)) studyRecords = [];
  if (!Array.isArray(goals)) goals = [];

  studyItems = studyItems.map(item => ({
    id: item.id || makeId(),
    subject: item.subject || "その他",
    name: item.name || item.title || "名称未設定",
    color: item.color || "",
    createdAt: item.createdAt || new Date().toISOString()
  }));

  studyRecords = studyRecords.map(record => ({
    id: record.id || makeId(),
    itemId: record.itemId || "",
    subject: record.subject || "その他",
    itemName: record.itemName || record.name || "名称未設定",
    date: record.date || todayString(),
    minutes: Math.max(0, Number(record.minutes) || 0),
    note: record.note || "",
    createdAt: record.createdAt || new Date().toISOString()
  }));

  goals = goals.map(goal => ({
    id: goal.id || makeId(),
    parentId: goal.parentId || null,
    title: goal.title || "目標",
    description: goal.description || "",
    deadline: goal.deadline || "",
    daily: Math.max(0, Number(goal.daily) || 0),
    weekly: Math.max(0, Number(goal.weekly) || 0),
    monthly: Math.max(0, Number(goal.monthly) || 0),
    completed: Boolean(goal.completed),
    createdAt: goal.createdAt || new Date().toISOString()
  }));

  const persistStudy = () => saveJSON(STORAGE.study, studyRecords);
  const persistItems = () => saveJSON(STORAGE.items, studyItems);
  const persistGoals = () => saveJSON(STORAGE.goals, goals);

  /* ---------------------------------------------------------
     Existing calendar data
     --------------------------------------------------------- */

  /*
   * 既存の personal-calendar-v1 は削除しません。
   * オブジェクト形式・配列形式のどちらでも読み取りを試みます。
   * 保存時は元データのほかのプロパティも維持します。
   */

  const rawCalendar = loadJSON(STORAGE.calendar, {});
  let calendarData = rawCalendar && typeof rawCalendar === "object"
    ? rawCalendar
    : {};

  const getCalendarArray = (names) => {
    if (Array.isArray(calendarData)) {
      const name = names[0];
      return calendarData.filter(item =>
        item && (item.type === name || item.kind === name)
      );
    }
    for (const name of names) {
      if (Array.isArray(calendarData[name])) return calendarData[name];
    }
    return [];
  };

  let events = getCalendarArray(["events", "calendarEvents", "schedules"])
    .map(event => ({
      ...event,
      id: event.id || makeId(),
      title: event.title || event.name || "予定",
      date: event.date || event.startDate || todayString(),
      start: event.start || event.startTime || "",
      end: event.end || event.endTime || "",
      color: event.color || "blue",
      notes: event.notes || event.description || "",
      reminder: event.reminder || "none"
    }));

  let tasks = getCalendarArray(["tasks", "todos", "toDos"])
    .map(task => ({
      ...task,
      id: task.id || makeId(),
      title: task.title || task.name || "タスク",
      date: task.date || task.dueDate || todayString(),
      notes: task.notes || task.description || "",
      completed: Boolean(task.completed ?? task.done)
    }));

  const calendarOriginal = calendarData;

  function persistCalendar() {
    let output;

    if (Array.isArray(calendarOriginal)) {
      const unrelated = calendarOriginal.filter(item =>
        item &&
        !["events", "tasks", "todos", "calendarEvents", "schedules"].includes(item.type) &&
        !["events", "tasks", "todos", "calendarEvents", "schedules"].includes(item.kind)
      );
      output = [
        ...unrelated,
        ...events.map(event => ({ ...event, type: "events" })),
        ...tasks.map(task => ({ ...task, type: "tasks" }))
      ];
    } else {
      output = {
        ...calendarOriginal,
        events,
        tasks
      };
    }

    if (saveJSON(STORAGE.calendar, output)) {
      calendarData = output;
    }
  }

  /* ---------------------------------------------------------
     Navigation
     --------------------------------------------------------- */

  const viewNames = [
    "home",
    "timer",
    "analysis",
    "goals",
    "record",
    "calendar"
  ];

  function showView(name) {
    if (!viewNames.includes(name)) return;

    viewNames.forEach(view => {
      const element = $(`#${view}-view`);
      if (element) element.hidden = view !== name;
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

    if (name === "analysis") renderAnalysis();
    if (name === "home") renderHome();
    if (name === "record") renderRecords();
    if (name === "calendar") renderCalendar();
    if (name === "goals") renderGoals();
    if (name === "timer") renderStudyItemOptions();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      showView(button.dataset.view);
    });
  });

  /* ---------------------------------------------------------
     Study items
     --------------------------------------------------------- */

  function findItem(id) {
    return studyItems.find(item => item.id === id);
  }

  function getSubjectColor(subject) {
    const item = studyItems.find(i => i.subject === subject && i.color);
    if (item) return item.color;

    const subjects = [...new Set(studyItems.map(i => i.subject))];
    const index = Math.max(0, subjects.indexOf(subject));
    return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
  }

  function renderStudyItemOptions() {
    const selects = ["#timer-item", "#manual-item"].map($).filter(Boolean);

    selects.forEach(select => {
      const previous = select.value;
      const firstLabel = select.id === "timer-item"
        ? "学習項目を選択"
        : "記録する学習項目を選択";

      select.innerHTML = `<option value="">${firstLabel}</option>` +
        studyItems.map(item =>
          `<option value="${escapeHTML(item.id)}">${escapeHTML(item.subject)} ／ ${escapeHTML(item.name)}</option>`
        ).join("");

      if (studyItems.some(item => item.id === previous)) {
        select.value = previous;
      }
    });

    const list = $("#study-item-list");
    if (!list) return;

    if (!studyItems.length) {
      list.innerHTML = `<div class="empty-state">まだ学習項目がありません。教科と項目名を登録してください。</div>`;
      return;
    }

    list.innerHTML = studyItems.map(item => {
      const total = studyRecords
        .filter(record => record.itemId === item.id)
        .reduce((sum, record) => sum + record.minutes, 0);

      return `
        <article class="study-item-card">
          <span class="subject-tag" style="border-color:${escapeHTML(item.color || getSubjectColor(item.subject))}">
            ${escapeHTML(item.subject)}
          </span>
          <h3>${escapeHTML(item.name)}</h3>
          <p>累計 ${formatMinutes(total)}</p>
          <div class="button-row">
            <button type="button" data-record-item="${escapeHTML(item.id)}">この項目を記録</button>
            <button type="button" class="danger" data-delete-item="${escapeHTML(item.id)}">削除</button>
          </div>
        </article>
      `;
    }).join("");

    $$("[data-record-item]", list).forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.recordItem;
        const timerSelect = $("#timer-item");
        if (timerSelect) timerSelect.value = id;
        showView("timer");
        updateTimerItemName();
      });
    });

    $$("[data-delete-item]", list).forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.deleteItem;
        const item = findItem(id);
        if (!item) return;

        if (!confirm(`「${item.name}」を学習項目一覧から削除しますか？\n過去の学習記録は削除されません。`)) return;

        studyItems = studyItems.filter(i => i.id !== id);
        persistItems();
        renderStudyItemOptions();
        renderAnalysis();
        renderHome();
        renderRecords();
        showToast("学習項目を削除しました。過去の記録は保持されています。");
      });
    });
  }

  const itemForm = $("#study-item-form");

  if (itemForm) {
    itemForm.addEventListener("submit", event => {
      event.preventDefault();

      const subject = $("#study-item-subject")?.value.trim();
      const name = $("#study-item-name")?.value.trim();

      if (!subject || !name) {
        showToast("教科と学習項目名を入力してください。");
        return;
      }

      const duplicate = studyItems.some(item =>
        item.subject.toLowerCase() === subject.toLowerCase() &&
        item.name.toLowerCase() === name.toLowerCase()
      );

      if (duplicate) {
        showToast("同じ教科・項目名がすでに登録されています。");
        return;
      }

      studyItems.push({
        id: makeId(),
        subject,
        name,
        color: getSubjectColor(subject),
        createdAt: new Date().toISOString()
      });

      persistItems();
      itemForm.reset();
      renderStudyItemOptions();
      renderAnalysis();
      renderHome();
      showToast("学習項目を登録しました。");
    });
  }

  /* ---------------------------------------------------------
     Study timer
     --------------------------------------------------------- */

  let timerRunning = false;
  let timerStartedAt = 0;
  let timerElapsedBeforeStart = 0;
  let timerInterval = null;

  const timerClock = $("#timer-clock");
  const timerStatus = $("#timer-status");
  const timerSelect = $("#timer-item");
  const timerStartButton = $("#timer-start");
  const timerStopButton = $("#timer-stop");

  function updateTimerItemName() {
    const item = findItem(timerSelect?.value);
    const label = $("#timer-selected-name");
    if (label) {
      label.textContent = item
        ? `${item.subject} ／ ${item.name}`
        : "学習項目を選択してください";
    }
  }

  function getTimerSeconds() {
    if (!timerRunning) return timerElapsedBeforeStart;
    return timerElapsedBeforeStart + (Date.now() - timerStartedAt) / 1000;
  }

  function renderTimerClock() {
    if (timerClock) timerClock.textContent = formatDuration(getTimerSeconds());
  }

  function startTimer() {
    if (timerRunning) return;

    const item = findItem(timerSelect?.value);
    if (!item) {
      showToast("先に学習項目を選択してください。");
      return;
    }

    timerRunning = true;
    timerStartedAt = Date.now();

    if (timerStatus) timerStatus.textContent = "学習中";
    if (timerStartButton) timerStartButton.disabled = true;
    if (timerSelect) timerSelect.disabled = true;
    if (timerStopButton) timerStopButton.disabled = false;

    timerInterval = setInterval(renderTimerClock, 250);
    renderTimerClock();
  }

  function stopTimer() {
    if (!timerRunning) return;

    const elapsed = Math.max(0, Math.floor(getTimerSeconds()));
    const item = findItem(timerSelect?.value);

    timerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;

    timerElapsedBeforeStart = 0;
    timerStartedAt = 0;

    if (timerStatus) timerStatus.textContent = "タイマー停止中";
    if (timerStartButton) timerStartButton.disabled = false;
    if (timerSelect) timerSelect.disabled = false;
    if (timerStopButton) timerStopButton.disabled = true;

    renderTimerClock();

    if (!item) {
      showToast("学習項目が見つからないため、記録を保存できませんでした。");
      return;
    }

    const minutes = Math.floor(elapsed / 60);

    if (minutes <= 0) {
      showToast("1分未満のため記録しませんでした。");
      return;
    }

    addStudyRecord({
      item,
      date: todayString(),
      minutes,
      note: "タイマー記録"
    });

    showToast(`${item.name}：${formatMinutes(minutes)}を記録しました。`);
  }

  if (timerSelect) {
    timerSelect.addEventListener("change", updateTimerItemName);
  }

  if (timerStartButton) {
    timerStartButton.addEventListener("click", startTimer);
  }

  if (timerStopButton) {
    timerStopButton.addEventListener("click", stopTimer);
    timerStopButton.disabled = true;
  }

  /* ---------------------------------------------------------
     Manual study record
     --------------------------------------------------------- */

  const manualDate = $("#manual-date");
  if (manualDate && !manualDate.value) manualDate.value = todayString();

  const manualForm = $("#manual-form");

  if (manualForm) {
    manualForm.addEventListener("submit", event => {
      event.preventDefault();

      const item = findItem($("#manual-item")?.value);
      const date = $("#manual-date")?.value || todayString();
      const hours = Math.max(0, Number($("#manual-hours")?.value) || 0);
      const minutes = Math.max(0, Number($("#manual-minutes")?.value) || 0);
      const note = $("#manual-note")?.value.trim() || "";
      const totalMinutes = Math.floor(hours * 60 + minutes);

      if (!item) {
        showToast("学習項目を選択してください。");
        return;
      }

      if (!parseDate(date)) {
        showToast("正しい日付を選択してください。");
        return;
      }

      if (totalMinutes <= 0) {
        showToast("学習時間を1分以上入力してください。");
        return;
      }

      addStudyRecord({ item, date, minutes: totalMinutes, note });
      manualForm.reset();
      if (manualDate) manualDate.value = todayString();
      showToast(`${item.name}：${formatMinutes(totalMinutes)}を記録しました。`);
    });
  }

  function addStudyRecord({ item, date, minutes, note = "" }) {
    if (!item || minutes <= 0) return;

    studyRecords.push({
      id: makeId(),
      itemId: item.id,
      subject: item.subject,
      itemName: item.name,
      date,
      minutes: Math.round(minutes),
      note,
      createdAt: new Date().toISOString()
    });

    persistStudy();
    renderStudyItemOptions();
    renderAnalysis();
    renderHome();
    renderRecords();
    renderGoals();
  }

  /* ---------------------------------------------------------
     Study data helpers
     --------------------------------------------------------- */

  function recordsForRange(startDate, endDate) {
    return studyRecords.filter(record =>
      record.date >= startDate && record.date <= endDate
    );
  }

  function totalMinutes(records) {
    return records.reduce((sum, record) => sum + record.minutes, 0);
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getRange(period, offset = 0) {
    const today = parseDate(todayString());

    if (period === "day") {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const s = dateString(d);
      return { start: s, end: s, label: formatJapaneseDate(s) };
    }

    if (period === "week") {
      const start = startOfWeek(today);
      start.setDate(start.getDate() + offset * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return {
        start: dateString(start),
        end: dateString(end),
        label: `${start.getMonth() + 1}/${start.getDate()}〜${end.getMonth() + 1}/${end.getDate()}`
      };
    }

    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return {
      start: dateString(first),
      end: dateString(last),
      label: `${first.getFullYear()}年${first.getMonth() + 1}月`
    };
  }

  function minutesForItem(itemId, start, end) {
    return totalMinutes(studyRecords.filter(record =>
      record.itemId === itemId &&
      record.date >= start &&
      record.date <= end
    ));
  }

  /* ---------------------------------------------------------
     Home dashboard
     --------------------------------------------------------- */

  function renderHome() {
    const today = todayString();
    const week = getRange("week");
    const todayRecords = recordsForRange(today, today);
    const weekRecords = recordsForRange(week.start, week.end);

    const setText = (id, value) => {
      const element = $(`#${id}`);
      if (element) element.textContent = value;
    };

    setText("header-date", formatJapaneseDate(today));
    setText("home-today-label", "今日の学習時間");
    setText("home-today-time", formatMinutes(totalMinutes(todayRecords)));
    setText("home-week-time", formatMinutes(totalMinutes(weekRecords)));
    setText("home-total-time", formatMinutes(totalMinutes(studyRecords)));

    const dayGoal = getGoalMinutes("day");
    const todayTotal = totalMinutes(todayRecords);
    const rate = dayGoal > 0 ? Math.min(100, Math.round(todayTotal / dayGoal * 100)) : 0;
    setText("home-goal-rate", dayGoal > 0 ? `${rate}%` : "未設定");

    const goalList = $("#home-goal-list");
    if (goalList) {
      const rootGoals = goals.filter(goal => !goal.parentId && !goal.completed);
      goalList.innerHTML = rootGoals.length
        ? rootGoals.slice(0, 4).map(goal => `
            <article class="goal-card">
              <h3>${escapeHTML(goal.title)}</h3>
              <p>${escapeHTML(goal.description || "目標を達成しよう")}</p>
              ${goal.deadline ? `<p>期限：${escapeHTML(formatJapaneseDate(goal.deadline))}</p>` : ""}
              <div class="button-row">
                <button type="button" data-open-goal="${escapeHTML(goal.id)}">目標を見る</button>
              </div>
            </article>
          `).join("")
        : `<div class="empty-state">目標を作成すると、ここに表示されます。</div>`;

      $$("[data-open-goal]", goalList).forEach(button => {
        button.addEventListener("click", () => showView("goals"));
      });
    }

    const countdownList = $("#home-countdown-list");
    const futureEvents = events
      .filter(event => event.date && event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);

    if (countdownList) {
      countdownList.innerHTML = futureEvents.length
        ? futureEvents.map(event => {
            const days = dateDiff(today, event.date);
            return `
              <article class="countdown-card">
                <div>
                  <h3>${escapeHTML(event.title)}</h3>
                  <p>${escapeHTML(formatJapaneseDate(event.date))}</p>
                </div>
                <div class="countdown-days">
                  ${days === 0 ? "今日" : `あと${days}日`}
                </div>
              </article>
            `;
          }).join("")
        : `<div class="empty-state">カレンダーに試験日や予定を追加すると、ここに表示されます。</div>`;
    }

    const recent = $("#home-recent-records");
    if (recent) {
      const sorted = [...studyRecords]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5);

      recent.innerHTML = sorted.length
        ? sorted.map(record => `
            <article class="record-card">
              <span class="subject-tag" style="border-color:${escapeHTML(getSubjectColor(record.subject))}">
                ${escapeHTML(record.subject)}
              </span>
              <h3>${escapeHTML(record.itemName)}</h3>
              <p>${escapeHTML(formatJapaneseDate(record.date))} · ${formatMinutes(record.minutes)}</p>
            </article>
          `).join("")
        : `<div class="empty-state">学習記録はまだありません。タイマーか手動記録から始めましょう。</div>`;
    }
  }

  /* ---------------------------------------------------------
     Goal targets and donut
     --------------------------------------------------------- */

  let goalTargetPeriod = "day";

  const goalTargetSelect = $("#goal-target-select");
  if (goalTargetSelect) {
    goalTargetPeriod = goalTargetSelect.value || "day";
    goalTargetSelect.addEventListener("change", () => {
      goalTargetPeriod = goalTargetSelect.value || "day";
      renderAnalysis();
    });
  }

  function getGoalMinutes(period) {
    const field = {
      day: "daily",
      week: "weekly",
      month: "monthly"
    }[period];

    if (!field) return 0;

    return goals
      .filter(goal => !goal.parentId && !goal.completed)
      .reduce((sum, goal) => sum + (Number(goal[field]) || 0), 0);
  }

  function getPeriodTotal(period) {
    const range = getRange(period);
    return totalMinutes(recordsForRange(range.start, range.end));
  }

  function drawDonut(percent) {
    const canvas = $("#goal-donut");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(100, Math.floor(rect.width || 150));

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const radius = size * 0.38;
    const lineWidth = Math.max(9, size * 0.085);

    ctx.clearRect(0, 0, size, size);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.strokeStyle = "#202b48";
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (percent > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "#64e2ed";
      ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(percent, 100) / 100);
      ctx.stroke();
    }

    const rate = $("#chart-goal-rate");
    if (rate) rate.textContent = `${Math.round(percent)}%`;
  }

  /* ---------------------------------------------------------
     Analysis graphs
     --------------------------------------------------------- */

  let chartPeriod = "week";
  let chartType = "daily";
  let chartOffset = 0;

  $$("[data-chart-period]").forEach(button => {
    button.addEventListener("click", () => {
      chartPeriod = button.dataset.chartPeriod;
      chartOffset = 0;
      $$("[data-chart-period]").forEach(b => b.classList.toggle("active", b === button));
      renderAnalysis();
    });
  });

  $$("[data-chart-type]").forEach(button => {
    button.addEventListener("click", () => {
      chartType = button.dataset.chartType;
      $$("[data-chart-type]").forEach(b => b.classList.toggle("active", b === button));
      renderAnalysis();
    });
  });

  $("#chart-prev")?.addEventListener("click", () => {
    chartOffset -= 1;
    renderAnalysis();
  });

  $("#chart-next")?.addEventListener("click", () => {
    chartOffset += 1;
    renderAnalysis();
  });

  function getChartData() {
    const range = getRange(chartPeriod, chartOffset);
    const records = recordsForRange(range.start, range.end);

    if (chartType === "subject") {
      const grouped = new Map();
      records.forEach(record => {
        grouped.set(record.subject, (grouped.get(record.subject) || 0) + record.minutes);
      });

      return {
        range,
        records,
        labels: [...grouped.keys()],
        values: [...grouped.values()],
        colors: [...grouped.keys()].map(getSubjectColor)
      };
    }

    const labels = [];
    const values = [];
    const colors = [];

    const start = parseDate(range.start);
    const end = parseDate(range.end);
    if (!start || !end) {
      return { range, records, labels, values, colors };
    }

    const days = Math.round((end - start) / 86400000) + 1;
    const step = chartPeriod === "month" ? Math.ceil(days / 10) : 1;

    for (let i = 0; i < days; i += step) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = dateString(d);
      const chunkEnd = new Date(d);
      chunkEnd.setDate(chunkEnd.getDate() + step - 1);
      const endKey = dateString(chunkEnd > end ? end : chunkEnd);

      const amount = totalMinutes(records.filter(record =>
        record.date >= key && record.date <= endKey
      ));

      labels.push(chartPeriod === "month"
        ? `${d.getDate()}日`
        : `${d.getMonth() + 1}/${d.getDate()}`);

      values.push(amount);
      colors.push("#77a8ff");
    }

    return { range, records, labels, values, colors };
  }

  function drawBarChart(data) {
    const canvas = $("#study-chart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width || 320));
    const height = Math.max(190, Math.floor(rect.height || 250));
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const pad = { top: 18, right: 12, bottom: 36, left: 42 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxValue = Math.max(60, ...data.values);
    const scale = Math.ceil(maxValue / 60) * 60;

    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + plotHeight * i / 4;
      const value = Math.round(scale * (1 - i / 4));

      ctx.strokeStyle = "rgba(156,177,226,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = "#a0accb";
      ctx.fillText(value >= 60 ? `${Math.round(value / 60)}h` : `${value}m`, pad.left - 7, y);
    }

    const count = Math.max(1, data.values.length);
    const slot = plotWidth / count;
    const barWidth = Math.min(34, slot * 0.62);

    data.values.forEach((value, index) => {
      const barHeight = plotHeight * value / scale;
      const x = pad.left + index * slot + (slot - barWidth) / 2;
      const y = pad.top + plotHeight - barHeight;

      ctx.fillStyle = data.colors[index] || "#77a8ff";
      if (barHeight > 0) {
        const radius = Math.min(5, barWidth / 2, barHeight / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      ctx.fillStyle = "#a0accb";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const label = data.labels[index] || "";
      const shortLabel = label.length > 7 ? `${label.slice(0, 6)}…` : label;
      ctx.fillText(shortLabel, x + barWidth / 2, height - pad.bottom + 10);
    });

    if (!data.values.length || data.values.every(value => value === 0)) {
      ctx.fillStyle = "#a0accb";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("この期間の学習記録はありません", width / 2, height / 2);
    }
  }

  function renderLegend(data) {
    const legend = $("#chart-legend");
    if (!legend) return;

    if (!data.labels.length) {
      legend.innerHTML = "";
      return;
    }

    legend.innerHTML = data.labels.map((label, index) => `
      <div class="legend-item">
        <span class="legend-color" style="background:${escapeHTML(data.colors[index] || "#77a8ff")}"></span>
        <span>${escapeHTML(label)}</span>
        <strong>${formatMinutes(data.values[index] || 0)}</strong>
      </div>
    `).join("");
  }

  function renderBreakdown(records) {
    const element = $("#chart-breakdown");
    if (!element) return;

    const grouped = new Map();

    records.forEach(record => {
      grouped.set(record.subject, (grouped.get(record.subject) || 0) + record.minutes);
    });

    const rows = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
    const total = totalMinutes(records);

    element.innerHTML = rows.length
      ? rows.map(([subject, minutes]) => {
          const percent = total ? Math.round(minutes / total * 100) : 0;
          return `
            <div class="breakdown-row">
              <div class="breakdown-name">
                <div class="legend-item">
                  <span class="legend-color" style="background:${escapeHTML(getSubjectColor(subject))}"></span>
                  <strong>${escapeHTML(subject)}</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width:${percent}%;background:${escapeHTML(getSubjectColor(subject))}"></div>
                </div>
              </div>
              <div class="breakdown-value">${formatMinutes(minutes)}<br><small>${percent}%</small></div>
            </div>
          `;
        }).join("")
      : `<div class="empty-state">記録が増えると教科ごとの内訳が表示されます。</div>`;
  }

  function renderAnalysis() {
    const data = getChartData();
    const total = totalMinutes(data.records);

    const label = $("#chart-period-label");
    if (label) label.textContent = data.range.label;

    const totalLabel = $("#chart-period-total");
    if (totalLabel) totalLabel.textContent = `合計：${formatMinutes(total)}`;

    drawBarChart(data);
    renderLegend(data);
    renderBreakdown(data.records);

    const target = getGoalMinutes(goalTargetPeriod);
    const achieved = getPeriodTotal(goalTargetPeriod);
    const percent = target > 0 ? Math.min(100, achieved / target * 100) : 0;

    drawDonut(percent);

    const donutTitle = $("#donut-title");
    const donutDetail = $("#donut-detail");
    const average = $("#chart-average");

    const periodNames = { day: "今日", week: "今週", month: "今月" };

    if (donutTitle) donutTitle.textContent = `${periodNames[goalTargetPeriod]}の目標`;
    if (donutDetail) {
      donutDetail.textContent = target > 0
        ? `${formatMinutes(achieved)} ／ ${formatMinutes(target)}`
        : "目標設定で学習時間の目標を設定してください。";
    }

    if (average) {
      const days = Math.max(1, data.records.length
        ? new Set(data.records.map(record => record.date)).size
        : 1);
      average.textContent = `記録がある日あたり：${formatMinutes(Math.round(total / days))}`;
    }
  }

  /* ---------------------------------------------------------
     Goals and nested branches
     --------------------------------------------------------- */

  const goalForm = $("#goal-form");

  if (goalForm) {
    goalForm.addEventListener("submit", event => {
      event.preventDefault();

      const title = $("#goal-title")?.value.trim();
      if (!title) {
        showToast("目標名を入力してください。");
        return;
      }

      const goal = {
        id: makeId(),
        parentId: null,
        title,
        description: $("#goal-description")?.value.trim() || "",
        deadline: $("#goal-deadline")?.value || "",
        daily: Math.max(0, Number($("#goal-daily")?.value) || 0),
        weekly: Math.max(0, Number($("#goal-weekly")?.value) || 0),
        monthly: Math.max(0, Number($("#goal-monthly")?.value) || 0),
        completed: false,
        createdAt: new Date().toISOString()
      };

      goals.push(goal);
      persistGoals();
      goalForm.reset();
      renderGoals();
      renderHome();
      renderAnalysis();
      showToast("目標を作成しました。");
    });
  }

  function descendantsOf(id) {
    const result = [];
    const queue = [id];

    while (queue.length) {
      const parentId = queue.shift();
      const children = goals.filter(goal => goal.parentId === parentId);
      children.forEach(child => {
        result.push(child);
        queue.push(child.id);
      });
    }

    return result;
  }

  function renderGoalNode(goal, depth = 0) {
    const children = goals.filter(item => item.parentId === goal.id);
    const cls = goal.completed ? "goal-branch completed" : "goal-branch";

    return `
      <article class="${cls}" data-goal-id="${escapeHTML(goal.id)}">
        <div class="inline-field">
          <input
            type="checkbox"
            data-goal-complete="${escapeHTML(goal.id)}"
            aria-label="目標を完了にする"
            ${goal.completed ? "checked" : ""}
          >
          <div style="flex:1;min-width:0">
            <h3>${escapeHTML(goal.title)}</h3>
            ${goal.description ? `<p>${escapeHTML(goal.description)}</p>` : ""}
            ${goal.deadline ? `<p>期限：${escapeHTML(formatJapaneseDate(goal.deadline))}</p>` : ""}
          </div>
        </div>
        <div class="goal-actions">
          <button type="button" data-add-branch="${escapeHTML(goal.id)}">＋ 分岐を追加</button>
          <button type="button" data-edit-goal="${escapeHTML(goal.id)}">名前を変更</button>
          <button type="button" class="danger" data-delete-goal="${escapeHTML(goal.id)}">削除</button>
        </div>
        ${children.length ? `
          <div class="branch-children">
            ${children.map(child => renderGoalNode(child, depth + 1)).join("")}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderGoals() {
    const map = $("#goal-map");
    const parentSelect = $("#branch-parent");
    if (!map) return;

    const roots = goals.filter(goal => !goal.parentId);

    map.innerHTML = roots.length
      ? roots.map(goal => `
          <section class="goal-tree">
            <div class="goal-root ${goal.completed ? "completed" : ""}">
              <div class="inline-field">
                <input
                  type="checkbox"
                  data-goal-complete="${escapeHTML(goal.id)}"
                  aria-label="目標を完了にする"
                  ${goal.completed ? "checked" : ""}
                >
                <div style="flex:1;min-width:0">
                  <h3>${escapeHTML(goal.title)}</h3>
                  ${goal.description ? `<p>${escapeHTML(goal.description)}</p>` : ""}
                  ${goal.deadline ? `<p>期限：${escapeHTML(formatJapaneseDate(goal.deadline))}</p>` : ""}
                </div>
              </div>
              <div class="goal-actions">
                <button type="button" data-add-branch="${escapeHTML(goal.id)}">＋ 分岐を追加</button>
                <button type="button" data-edit-goal="${escapeHTML(goal.id)}">名前を変更</button>
                <button type="button" class="danger" data-delete-goal="${escapeHTML(goal.id)}">削除</button>
              </div>
              ${goals.some(item => item.parentId === goal.id)
                ? `<div class="goal-children">${goals.filter(item => item.parentId === goal.id).map(child => renderGoalNode(child, 1)).join("")}</div>`
                : ""}
            </div>
          </section>
        `).join("")
      : `<div class="empty-state">最終目標を作成し、「＋ 分岐を追加」から小さな目標へ分けていきましょう。</div>`;

    if (parentSelect) {
      const previous = parentSelect.value;
      parentSelect.innerHTML = `<option value="">親目標を選択</option>` +
        goals.map(goal =>
          `<option value="${escapeHTML(goal.id)}">${escapeHTML(goal.title)}</option>`
        ).join("");
      if (goals.some(goal => goal.id === previous)) parentSelect.value = previous;
    }

    $$("[data-goal-complete]", map).forEach(input => {
      input.addEventListener("change", () => {
        const goal = goals.find(item => item.id === input.dataset.goalComplete);
        if (!goal) return;

        goal.completed = input.checked;

        if (goal.completed) {
          descendantsOf(goal.id).forEach(child => {
            child.completed = true;
          });
        }

        persistGoals();
        renderGoals();
        renderHome();
        renderAnalysis();
      });
    });

    $$("[data-add-branch]", map).forEach(button => {
      button.addEventListener("click", () => {
        const parent = button.dataset.addBranch;
        if (parentSelect) parentSelect.value = parent;

        $("#branch-title")?.focus();
        showToast("分岐名を入力し、「分岐を追加」を押してください。");
      });
    });

    $$("[data-edit-goal]", map).forEach(button => {
      button.addEventListener("click", () => {
        const goal = goals.find(item => item.id === button.dataset.editGoal);
        if (!goal) return;

        const nextTitle = prompt("新しい目標名を入力してください。", goal.title);
        if (nextTitle === null) return;
        if (!nextTitle.trim()) {
          showToast("目標名は空にできません。");
          return;
        }

        goal.title = nextTitle.trim();
        persistGoals();
        renderGoals();
        renderHome();
      });
    });

    $$("[data-delete-goal]", map).forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.deleteGoal;
        const goal = goals.find(item => item.id === id);
        if (!goal) return;

        if (!confirm(`「${goal.title}」と、その下の分岐目標を削除しますか？`)) return;

        const idsToDelete = new Set([id, ...descendantsOf(id).map(item => item.id)]);
        goals = goals.filter(item => !idsToDelete.has(item.id));

        persistGoals();
        renderGoals();
        renderHome();
        renderAnalysis();
        showToast("目標を削除しました。");
      });
    });
  }

  const branchForm = $("#branch-form");

  if (branchForm) {
    branchForm.addEventListener("submit", event => {
      event.preventDefault();

      const parentId = $("#branch-parent")?.value || null;
      const title = $("#branch-title")?.value.trim();

      if (!title) {
        showToast("分岐目標の名前を入力してください。");
        return;
      }

      if (parentId && !goals.some(goal => goal.id === parentId)) {
        showToast("親目標を選び直してください。");
        return;
      }

      goals.push({
        id: makeId(),
        parentId,
        title,
        description: $("#branch-detail")?.value.trim() || "",
        deadline: $("#branch-deadline")?.value || "",
        daily: 0,
        weekly: 0,
        monthly: 0,
        completed: false,
        createdAt: new Date().toISOString()
      });

      persistGoals();
      branchForm.reset();
      renderGoals();
      renderHome();
      showToast("分岐目標を追加しました。");
    });
  }

  /* ---------------------------------------------------------
     Study record history
     --------------------------------------------------------- */

  const recordDate = $("#record-date");

  if (recordDate) {
    recordDate.value = todayString();
    recordDate.addEventListener("change", renderRecords);
  }

  $("#record-date-clear")?.addEventListener("click", () => {
    if (recordDate) recordDate.value = "";
    renderRecords();
  });

  function renderRecords() {
    const today = todayString();
    const week = getRange("week");
    const selected = recordDate?.value || "";

    const setText = (id, value) => {
      const el = $(`#${id}`);
      if (el) el.textContent = value;
    };

    setText("record-today", formatMinutes(totalMinutes(recordsForRange(today, today))));
    setText("record-week", formatMinutes(totalMinutes(recordsForRange(week.start, week.end))));
    setText("record-total", formatMinutes(totalMinutes(studyRecords)));

    const history = $("#record-history");
    if (!history) return;

    const filtered = studyRecords
      .filter(record => !selected || sameDay(record.date, selected))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    history.innerHTML = filtered.length
      ? filtered.map(record => `
          <article class="record-card">
            <div class="section-heading">
              <span class="subject-tag" style="border-color:${escapeHTML(getSubjectColor(record.subject))}">
                ${escapeHTML(record.subject)}
              </span>
              <strong class="record-time">${formatMinutes(record.minutes)}</strong>
            </div>
            <h3>${escapeHTML(record.itemName)}</h3>
            <p>${escapeHTML(formatJapaneseDate(record.date))}</p>
            ${record.note ? `<p>${escapeHTML(record.note)}</p>` : ""}
            <div class="button-row">
              <button type="button" class="danger" data-delete-record="${escapeHTML(record.id)}">この記録を削除</button>
            </div>
          </article>
        `).join("")
      : `<div class="empty-state">選択した日付の学習記録はありません。</div>`;

    $$("[data-delete-record]", history).forEach(button => {
      button.addEventListener("click", () => {
        const record = studyRecords.find(item => item.id === button.dataset.deleteRecord);
        if (!record) return;

        if (!confirm(`「${record.itemName}」の ${formatMinutes(record.minutes)} の記録を削除しますか？`)) return;

        studyRecords = studyRecords.filter(item => item.id !== record.id);
        persistStudy();
        renderRecords();
        renderAnalysis();
        renderHome();
        renderStudyItemOptions();
        renderGoals();
        showToast("学習記録を削除しました。");
      });
    });
  }

  /* ---------------------------------------------------------
     Calendar rendering
     --------------------------------------------------------- */

  let calendarMonth = new Date();
  calendarMonth.setDate(1);

  let selectedCalendarDate = todayString();
  let editingEventId = null;
  let editingTaskId = null;

  function renderCalendar() {
    const title = $("#month-title");
    const grid = $("#calendar-grid");

    if (title) {
      title.textContent = `${calendarMonth.getFullYear()}年${calendarMonth.getMonth() + 1}月`;
    }

    if (!grid) {
      renderDayItems();
      renderCountdownList();
      return;
    }

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = firstDay.getDay();
    const start = new Date(year, month, 1 - offset);

    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    let html = weekdays.map(day =>
      `<div class="calendar-weekday">${day}</div>`
    ).join("");

    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dateString(date);
      const inMonth = date.getMonth() === month;
      const isToday = key === todayString();
      const isSelected = key === selectedCalendarDate;
      const hasItems = events.some(event => event.date === key) ||
        tasks.some(task => task.date === key);

      const classes = [
        "calendar-day",
        inMonth ? "" : "outside-month",
        isToday ? "today" : "",
        isSelected ? "selected" : "",
        hasItems ? "has-items" : ""
      ].filter(Boolean).join(" ");

      html += `
        <button type="button" class="${classes}" data-calendar-date="${key}">
          <span class="day-number">${date.getDate()}</span>
        </button>
      `;
    }

    grid.innerHTML = html;

    $$("[data-calendar-date]", grid).forEach(button => {
      button.addEventListener("click", () => {
        selectedCalendarDate = button.dataset.calendarDate;
        renderCalendar();
      });
    });

    renderDayItems();
    renderCountdownList();
  }

  $("#prev-month")?.addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  $("#next-month")?.addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  $("#today-button")?.addEventListener("click", () => {
    calendarMonth = new Date();
    calendarMonth.setDate(1);
    selectedCalendarDate = todayString();
    renderCalendar();
  });

  const selectedDateTitle = $("#selected-date-title");
  if (selectedDateTitle) {
    selectedDateTitle.textContent = formatJapaneseDate(selectedCalendarDate);
  }

  function renderDayItems() {
    const heading = $("#selected-date-title");
    const container = $("#day-items");

    if (heading) heading.textContent = formatJapaneseDate(selectedCalendarDate);
    if (!container) return;

    const dayEvents = events
      .filter(event => event.date === selectedCalendarDate)
      .sort((a, b) => (a.start || "").localeCompare(b.start || ""));

    const dayTasks = tasks.filter(task => task.date === selectedCalendarDate);

    const eventHTML = dayEvents.map(event => `
      <article class="event-card event-${escapeHTML(event.color || "blue")}">
        <div class="event-time">
          ${event.start ? escapeHTML(event.start) : "時間未設定"}
          ${event.end ? `〜 ${escapeHTML(event.end)}` : ""}
        </div>
        <h3>${escapeHTML(event.title)}</h3>
        ${event.notes ? `<p>${escapeHTML(event.notes)}</p>` : ""}
        <div class="button-row">
          <button type="button" data-edit-event="${escapeHTML(event.id)}">編集</button>
          <button type="button" class="danger" data-delete-event="${escapeHTML(event.id)}">削除</button>
        </div>
      </article>
    `).join("");

    const taskHTML = dayTasks.map(task => `
      <article class="task-card ${task.completed ? "is-complete" : ""}">
        <div class="task-row">
          <input
            type="checkbox"
            class="task-toggle"
            data-toggle-task="${escapeHTML(task.id)}"
            aria-label="タスク完了"
            ${task.completed ? "checked" : ""}
          >
          <div>
            <h3>${escapeHTML(task.title)}</h3>
            ${task.notes ? `<p>${escapeHTML(task.notes)}</p>` : ""}
            <div class="button-row">
              <button type="button" data-edit-task="${escapeHTML(task.id)}">編集</button>
              <button type="button" class="danger" data-delete-task="${escapeHTML(task.id)}">削除</button>
            </div>
          </div>
        </div>
      </article>
    `).join("");

    container.innerHTML = eventHTML + taskHTML ||
      `<div class="empty-state">この日の予定とタスクはありません。</div>`;

    $$("[data-edit-event]", container).forEach(button => {
      button.addEventListener("click", () => openEventDialog(button.dataset.editEvent));
    });

    $$("[data-delete-event]", container).forEach(button => {
      button.addEventListener("click", () => deleteEvent(button.dataset.deleteEvent));
    });

    $$("[data-toggle-task]", container).forEach(input => {
      input.addEventListener("change", () => {
        const task = tasks.find(item => item.id === input.dataset.toggleTask);
        if (!task) return;
        task.completed = input.checked;
        persistCalendar();
        renderCalendar();
      });
    });

    $$("[data-edit-task]", container).forEach(button => {
      button.addEventListener("click", () => openTaskDialog(button.dataset.editTask));
    });

    $$("[data-delete-task]", container).forEach(button => {
      button.addEventListener("click", () => deleteTask(button.dataset.deleteTask));
    });
  }

  /* ---------------------------------------------------------
     Event dialog
     --------------------------------------------------------- */

  const eventDialog = $("#event-dialog");
  const eventForm = $("#event-form");

  function openEventDialog(id = null) {
    editingEventId = id;
    const event = id ? events.find(item => item.id === id) : null;

    if ($("#event-id")) $("#event-id").value = event?.id || "";
    if ($("#event-title")) $("#event-title").value = event?.title || "";
    if ($("#event-date")) $("#event-date").value = event?.date || selectedCalendarDate || todayString();
    if ($("#event-start")) $("#event-start").value = event?.start || "";
    if ($("#event-end")) $("#event-end").value = event?.end || "";
    if ($("#event-color")) $("#event-color").value = event?.color || "blue";
    if ($("#event-notes")) $("#event-notes").value = event?.notes || "";
    if ($("#event-reminder")) $("#event-reminder").value = event?.reminder || "none";

    const heading = $("#event-dialog-title");
    if (heading) heading.textContent = event ? "予定を編集" : "予定を追加";

    const deleteButton = $("#delete-event");
    if (deleteButton) deleteButton.hidden = !event;

    if (eventDialog?.showModal) eventDialog.showModal();
    else if (eventDialog) eventDialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  $("#add-event-day")?.addEventListener("click", () => openEventDialog());
  $("#add-event-top")?.addEventListener("click", () => openEventDialog());

  if (eventForm) {
    eventForm.addEventListener("submit", event => {
      event.preventDefault();

      const title = $("#event-title")?.value.trim();
      const date = $("#event-date")?.value || selectedCalendarDate;
      if (!title || !parseDate(date)) {
        showToast("予定名と正しい日付を入力してください。");
        return;
      }

      const data = {
        id: editingEventId || makeId(),
        title,
        date,
        start: $("#event-start")?.value || "",
        end: $("#event-end")?.value || "",
        color: $("#event-color")?.value || "blue",
        notes: $("#event-notes")?.value.trim() || "",
        reminder: $("#event-reminder")?.value || "none"
      };

      if (editingEventId) {
        events = events.map(item => item.id === editingEventId ? { ...item, ...data } : item);
      } else {
        events.push(data);
      }

      persistCalendar();
      closeDialog(eventDialog);
      renderCalendar();
      renderHome();
      showToast(editingEventId ? "予定を更新しました。" : "予定を追加しました。");
      editingEventId = null;
    });
  }

  function deleteEvent(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;
    if (!confirm(`「${event.title}」を削除しますか？`)) return;

    events = events.filter(item => item.id !== id);
    persistCalendar();
    closeDialog(eventDialog);
    renderCalendar();
    renderHome();
    showToast("予定を削除しました。");
  }

  $("#delete-event")?.addEventListener("click", () => {
    if (editingEventId) deleteEvent(editingEventId);
  });

  /* ---------------------------------------------------------
     Task dialog
     --------------------------------------------------------- */

  const taskDialog = $("#task-dialog");
  const taskForm = $("#task-form");

  function openTaskDialog(id = null) {
    editingTaskId = id;
    const task = id ? tasks.find(item => item.id === id) : null;

    if ($("#task-id")) $("#task-id").value = task?.id || "";
    if ($("#task-title")) $("#task-title").value = task?.title || "";
    if ($("#task-date")) $("#task-date").value = task?.date || selectedCalendarDate || todayString();
    if ($("#task-notes")) $("#task-notes").value = task?.notes || "";

    const heading = $("#task-dialog-title");
    if (heading) heading.textContent = task ? "タスクを編集" : "タスクを追加";

    const deleteButton = $("#delete-task");
    if (deleteButton) deleteButton.hidden = !task;

    if (taskDialog?.showModal) taskDialog.showModal();
    else if (taskDialog) taskDialog.setAttribute("open", "");
  }

  $("#add-task-button")?.addEventListener("click", () => openTaskDialog());

  const quickTaskForm = $("#quick-task-form");
  if (quickTaskForm) {
    quickTaskForm.addEventListener("submit", event => {
      event.preventDefault();
      const title = $("#quick-task-title")?.value.trim();
      if (!title) return;

      tasks.push({
        id: makeId(),
        title,
        date: selectedCalendarDate || todayString(),
        notes: "",
        completed: false
      });

      persistCalendar();
      quickTaskForm.reset();
      renderCalendar();
      showToast("タスクを追加しました。");
    });
  }

  if (taskForm) {
    taskForm.addEventListener("submit", event => {
      event.preventDefault();

      const title = $("#task-title")?.value.trim();
      const date = $("#task-date")?.value || selectedCalendarDate;

      if (!title || !parseDate(date)) {
        showToast("タスク名と正しい日付を入力してください。");
        return;
      }

      const data = {
        id: editingTaskId || makeId(),
        title,
        date,
        notes: $("#task-notes")?.value.trim() || "",
        completed: tasks.find(item => item.id === editingTaskId)?.completed || false
      };

      if (editingTaskId) {
        tasks = tasks.map(item => item.id === editingTaskId ? { ...item, ...data } : item);
      } else {
        tasks.push(data);
      }

      persistCalendar();
      closeDialog(taskDialog);
      renderCalendar();
      showToast(editingTaskId ? "タスクを更新しました。" : "タスクを追加しました。");
      editingTaskId = null;
    });
  }

  function deleteTask(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    if (!confirm(`「${task.title}」を削除しますか？`)) return;

    tasks = tasks.filter(item => item.id !== id);
    persistCalendar();
    closeDialog(taskDialog);
    renderCalendar();
    showToast("タスクを削除しました。");
  }

  $("#delete-task")?.addEventListener("click", () => {
    if (editingTaskId) deleteTask(editingTaskId);
  });

  /* ---------------------------------------------------------
     Dialog close buttons
     --------------------------------------------------------- */

  $$(".close-dialog").forEach(button => {
    button.addEventListener("click", () => {
      closeDialog(button.closest("dialog"));
    });
  });

  [eventDialog, taskDialog].forEach(dialog => {
    if (!dialog) return;
    dialog.addEventListener("click", event => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });

  /* ---------------------------------------------------------
     Countdown list
     --------------------------------------------------------- */

  function renderCountdownList() {
    const list = $("#countdown-list");
    if (!list) return;

    const today = todayString();
    const future = events
      .filter(event => event.date && event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    list.innerHTML = future.length
      ? future.map(event => {
          const days = dateDiff(today, event.date);
          return `
            <article class="countdown-card">
              <div>
                <h3>${escapeHTML(event.title)}</h3>
                <p>${escapeHTML(formatJapaneseDate(event.date))}</p>
              </div>
              <div class="countdown-days">
                ${days === 0 ? "今日" : `あと${days}日`}
              </div>
            </article>
          `;
        }).join("")
      : `<div class="empty-state">予定を登録すると、試験や行事までの日数が表示されます。</div>`;
  }

  /* ---------------------------------------------------------
     Export / import
     --------------------------------------------------------- */

  $("#export-button")?.addEventListener("click", () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      studyItems,
      studyRecords,
      goals,
      calendar: loadJSON(STORAGE.calendar, {})
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ALGOL-backup-${todayString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("バックアップファイルを作成しました。");
  });

  $("#import-file")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!confirm("バックアップのデータを読み込みますか？\n現在のデータは、バックアップに同じ種類のデータが含まれている場合に置き換わります。")) {
        event.target.value = "";
        return;
      }

      if (Array.isArray(data.studyItems)) {
        studyItems = data.studyItems;
        persistItems();
      }

      if (Array.isArray(data.studyRecords)) {
        studyRecords = data.studyRecords;
        persistStudy();
      }

      if (Array.isArray(data.goals)) {
        goals = data.goals;
        persistGoals();
      }

      if (data.calendar && typeof data.calendar === "object") {
        if (saveJSON(STORAGE.calendar, data.calendar)) {
          location.reload();
          return;
        }
      }

      renderStudyItemOptions();
      renderAnalysis();
      renderGoals();
      renderHome();
      renderRecords();
      renderCalendar();
      showToast("バックアップを読み込みました。");
    } catch (error) {
      console.error(error);
      showToast("ファイルを読み込めませんでした。ALGOLのバックアップJSONを選んでください。");
    }

    event.target.value = "";
  });

  /* ---------------------------------------------------------
     Responsive canvas refresh
     --------------------------------------------------------- */

  let resizeTimeout = null;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (!$("#analysis-view")?.hidden) renderAnalysis();
    }, 150);
  });

  /* ---------------------------------------------------------
     Initial setup
     --------------------------------------------------------- */

  if ($("#event-date") && !$("#event-date").value) {
    $("#event-date").value = selectedCalendarDate;
  }

  if ($("#task-date") && !$("#task-date").value) {
    $("#task-date").value = selectedCalendarDate;
  }

  renderStudyItemOptions();
  renderGoals();
  renderAnalysis();
  renderHome();
  renderRecords();
  renderCalendar();
  updateTimerItemName();

  if (timerStatus) timerStatus.textContent = "タイマー停止中";
  if (timerClock) timerClock.textContent = "00:00:00";

  showView("home");

  console.info("ALGOL: 初期化が完了しました。実機での動作確認は未実施です。");
})();
