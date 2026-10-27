
/* =========================================================
   One for All - COSMOS
   js/ui.js
   画面遷移・メニュー・ダイアログ・学習記録・行動表・目標マップ
   ========================================================= */

"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const STORAGE_KEY = "ofa-cosmos-data-v1";

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const makeId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const defaultData = () => ({
    subjects: [
      { id: "math", name: "数学", items: ["問題演習", "復習"] },
      { id: "english", name: "英語", items: ["英単語", "長文読解"] }
    ],
    records: [],
    events: [],
    tasks: [],
    timetable: [],
    goals: [
      {
        id: "goal-root",
        title: "最終目標",
        detail: "自分の目標を設定する",
        parentId: null,
        completed: false
      }
    ],
    dailyGoal: 120,
    timer: {
      running: false,
      start: null,
      subject: "",
      item: ""
    },
    economy: {
      balance: 0,
      loans: [],
      transactions: []
    },
    countdowns: [],
    settings: {
      theme: "cosmos",
      animations: true
    }
  });

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaultData();

      const parsed = JSON.parse(saved);
      const defaults = defaultData();

      return {
        ...defaults,
        ...parsed,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : defaults.subjects,
        records: Array.isArray(parsed.records) ? parsed.records : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        timetable: Array.isArray(parsed.timetable) ? parsed.timetable : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : defaults.goals,
        countdowns: Array.isArray(parsed.countdowns) ? parsed.countdowns : [],
        economy: { ...defaults.economy, ...(parsed.economy || {}) },
        settings: { ...defaults.settings, ...(parsed.settings || {}) }
      };
    } catch (error) {
      console.error("保存データを読み込めませんでした。", error);
      return defaultData();
    }
  }

  let data = loadData();
  let currentView = "home";
  let selectedDate = today();
  let timerInterval = null;
  let timerStartedAt = null;
  let dialogSubmit = null;

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("データを保存できませんでした。", error);
      showMessage("保存できませんでした。空き容量を確認してください。");
    }
  }

  function showMessage(message) {
    const toast = $("#cosmos-message");
    if (!toast) {
      console.log(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");
    toast.setAttribute("aria-live", "polite");

    clearTimeout(showMessage.timeout);
    showMessage.timeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  /* ---------------------------------------------------------
     画面遷移
     --------------------------------------------------------- */

  function closeMenu() {
    const menu = $("#side-menu");
    const backdrop = $("#menu-backdrop");
    const openButton = $("#menu-open");

    menu?.classList.remove("open", "active");
    menu?.setAttribute("aria-hidden", "true");

    backdrop?.classList.remove("open", "active", "visible");
    backdrop?.setAttribute("aria-hidden", "true");

    openButton?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  }

  function openMenu() {
    const menu = $("#side-menu");
    const backdrop = $("#menu-backdrop");
    const openButton = $("#menu-open");

    menu?.classList.add("open");
    menu?.classList.add("active");
    menu?.setAttribute("aria-hidden", "false");

    backdrop?.classList.add("open", "active", "visible");
    backdrop?.setAttribute("aria-hidden", "false");

    openButton?.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
  }

  function showView(viewName) {
    const requested = String(viewName || "home");
    const panel = $(`#view-${CSS.escape(requested)}`);

    if (!panel) {
      showMessage("この画面はまだ準備されていません。");
      closeMenu();
      return;
    }

    currentView = requested;

    $$(".page-section, [data-view-panel]").forEach(section => {
      const active =
        section.id === `view-${requested}` ||
        section.dataset.viewPanel === requested;

      section.hidden = !active;
      section.classList.toggle("active", active);
      section.setAttribute("aria-hidden", String(!active));
    });

    $$("[data-view]").forEach(button => {
      const active = button.dataset.view === requested;
      button.classList.toggle("active", active);

      if (button.tagName === "BUTTON") {
        button.setAttribute("aria-current", active ? "page" : "false");
      }
    });

    closeMenu();

    if (requested === "schedule") renderSchedule();
    if (requested === "study") renderStudy();
    if (requested === "goals") renderGoals();
    if (requested === "home") renderHome();
    if (requested === "calendar") renderCalendar();

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function ensureScheduleView() {
    let view = $("#view-schedule");
    if (view) return view;

    const main = $("#app-main");
    if (!main) return null;

    view = document.createElement("section");
    view.id = "view-schedule";
    view.className = "page-section";
    view.dataset.viewPanel = "schedule";
    view.hidden = true;

    view.innerHTML = `
      <div class="section-heading">
        <p class="eyebrow">DAILY PLAN & ACTUAL</p>
        <h2>予定表・行動表</h2>
        <p>予定と、実際に行ったことを1日ごとに確認します。</p>
      </div>

      <div class="schedule-date-controls">
        <button type="button" data-action="schedule-prev">前日</button>
        <label>
          <span>表示する日付</span>
          <input id="schedule-date" type="date" value="${today()}">
        </label>
        <button type="button" data-action="schedule-today">今日</button>
        <button type="button" data-action="schedule-next">翌日</button>
      </div>

      <div class="schedule-summary">
        <div>
          <span>予定時間</span>
          <strong id="schedule-planned-total">0分</strong>
        </div>
        <div>
          <span>実績時間</span>
          <strong id="schedule-actual-total">0分</strong>
        </div>
      </div>

      <div class="schedule-actions">
        <button type="button" data-action="add-event">予定を追加</button>
        <button type="button" data-action="add-actual">行動実績を追加</button>
      </div>

      <div id="schedule-timeline" class="schedule-timeline"></div>
    `;

    main.appendChild(view);

    const menu = $("#side-menu");
    if (menu && !menu.querySelector('[data-view="schedule"]')) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.view = "schedule";
      button.textContent = "予定表・行動表";
      menu.appendChild(button);
    }

    const bottom = $("#bottom-navigation");
    if (bottom && !bottom.querySelector('[data-view="schedule"]')) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.view = "schedule";
      button.dataset.shortcut = "schedule";
      button.textContent = "行動表";
      bottom.appendChild(button);
    }

    return view;
  }

  /* ---------------------------------------------------------
     ダイアログ
     --------------------------------------------------------- */

  function closeDialog() {
    const dialog = $("#cosmos-dialog");

    if (dialog?.open && typeof dialog.close === "function") {
      dialog.close();
    } else if (dialog) {
      dialog.removeAttribute("open");
      dialog.hidden = true;
      dialog.style.display = "none";
    }

    dialogSubmit = null;
  }

  function openDialog(title, fields, onSubmit) {
    const dialog = $("#cosmos-dialog");
    const titleElement = $("#cosmos-dialog-title");
    const content = $("#cosmos-dialog-content");
    const form = $("#cosmos-dialog-form");
    const confirm = $("#cosmos-dialog-confirm");

    if (!dialog || !content || !form) {
      showMessage("ダイアログのHTMLが見つかりません。");
      return;
    }

    titleElement && (titleElement.textContent = title);
    content.replaceChildren();

    fields.forEach(field => {
      const wrapper = document.createElement("label");
      wrapper.className = "dialog-field";

      const label = document.createElement("span");
      label.textContent = field.label;
      wrapper.appendChild(label);

      let input;

      if (field.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = 3;
      } else if (field.type === "select") {
        input = document.createElement("select");
        (field.options || []).forEach(option => {
          const element = document.createElement("option");
          element.value = option.value;
          element.textContent = option.label;
          input.appendChild(element);
        });
      } else {
        input = document.createElement("input");
        input.type = field.type || "text";
      }

      input.name = field.name;
      input.required = Boolean(field.required);

      if (field.value !== undefined) input.value = field.value;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.step !== undefined) input.step = field.step;

      wrapper.appendChild(input);
      content.appendChild(wrapper);
    });

    dialogSubmit = onSubmit;

    if (confirm) {
      confirm.type = "submit";
      confirm.textContent = "保存";
    }

    let cancel = $("#cosmos-dialog-cancel");

    if (!cancel) {
      cancel = document.createElement("button");
      cancel.id = "cosmos-dialog-cancel";
      cancel.type = "button";
      cancel.textContent = "キャンセル";
      cancel.className = "dialog-cancel";
      confirm?.parentElement?.appendChild(cancel);
    }

    cancel.type = "button";
    cancel.onclick = event => {
      event.preventDefault();
      closeDialog();
    };

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.hidden = false;
      dialog.style.display = "block";
      dialog.setAttribute("open", "");
    }
  }

  function getDialogValues() {
    const content = $("#cosmos-dialog-content");
    const values = {};

    $$("input[name], textarea[name], select[name]", content).forEach(input => {
      values[input.name] = input.value.trim();
    });

    return values;
  }

  function handleDialogSubmit(event) {
    if (event) event.preventDefault();

    const form = $("#cosmos-dialog-form");
    if (form && !form.reportValidity()) return;

    const callback = dialogSubmit;
    const values = getDialogValues();

    closeDialog();

    if (typeof callback === "function") {
      callback(values);
    }
  }

  /* ---------------------------------------------------------
     学習記録
     --------------------------------------------------------- */

  function getSubjectName(subjectId) {
    return data.subjects.find(subject => subject.id === subjectId)?.name
      || subjectId
      || "未分類";
  }

  function getMinutesForDate(date) {
    return data.records
      .filter(record => record.date === date)
      .reduce((total, record) => total + Number(record.minutes || 0), 0);
  }

  function addStudyRecord(record) {
    const minutes = Number(record.minutes);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      showMessage("勉強時間は1分以上で入力してください。");
      return false;
    }

    const date = record.date || today();

    data.records.push({
      id: makeId(),
      date,
      subjectId: record.subjectId || "",
      subject: record.subject || getSubjectName(record.subjectId),
      item: record.item || "学習",
      minutes: Math.round(minutes),
      note: record.note || "",
      startTime: record.startTime || "",
      endTime: record.endTime || "",
      source: record.source || "manual",
      createdAt: new Date().toISOString()
    });

    saveData();
    renderStudy();
    renderSchedule();
    renderHome();

    showMessage("学習記録を保存しました。行動表にも反映しました。");
    return true;
  }

  function renderStudy() {
    const list = $("#study-record-list");

    if (list) {
      const records = [...data.records].sort((a, b) =>
        `${b.date}${b.startTime || ""}`.localeCompare(`${a.date}${a.startTime || ""}`)
      );

      list.innerHTML = records.length
        ? records.map(record => `
            <article class="study-record-card">
              <div>
                <strong>${escapeHTML(record.subject || getSubjectName(record.subjectId))}</strong>
                <p>${escapeHTML(record.item || "学習")}</p>
                <small>${escapeHTML(record.date)} ${escapeHTML(record.startTime || "")}</small>
                ${record.note ? `<p>${escapeHTML(record.note)}</p>` : ""}
              </div>
              <strong>${Number(record.minutes)}分</strong>
              <button type="button" data-action="delete-record" data-id="${escapeHTML(record.id)}">削除</button>
            </article>
          `).join("")
        : "<p>まだ学習記録がありません。</p>";
    }

    const todayTotal = getMinutesForDate(today());
    const todayTime = $("#home-today-time");
    const statsTime = $("#stats-today-time");

    if (todayTime) todayTime.textContent = formatMinutes(todayTotal);
    if (statsTime) statsTime.textContent = formatMinutes(todayTotal);

    const goal = Math.max(1, Number(data.dailyGoal || 120));
    const percent = Math.min(100, Math.round(todayTotal / goal * 100));

    const progress = $("#home-goal-progress");
    if (progress) {
      progress.style.width = `${percent}%`;
      progress.setAttribute("aria-valuenow", String(percent));
    }

    const goalText = $("#home-goal-percent");
    if (goalText) goalText.textContent = `${percent}%`;

    const statsProgress = $("#stats-today-progress");
    if (statsProgress) {
      statsProgress.style.width = `${percent}%`;
      statsProgress.setAttribute("aria-valuenow", String(percent));
    }
  }

  function formatMinutes(minutes) {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(value / 60);
    const mins = value % 60;

    return hours ? `${hours}時間${mins}分` : `${mins}分`;
  }

  function addSubject() {
    openDialog("教科を追加", [
      { name: "name", label: "教科名", required: true, placeholder: "例：理科" }
    ], values => {
      if (data.subjects.some(subject => subject.name === values.name)) {
        showMessage("同じ名前の教科がすでにあります。");
        return;
      }

      data.subjects.push({
        id: makeId(),
        name: values.name,
        items: []
      });

      saveData();
      renderStudy();
      showMessage("教科を追加しました。");
    });
  }

  function addStudyItem() {
    if (!data.subjects.length) {
      showMessage("先に教科を追加してください。");
      return;
    }

    openDialog("学習項目を追加", [
      {
        name: "subjectId",
        label: "教科",
        type: "select",
        required: true,
        options: data.subjects.map(subject => ({
          value: subject.id,
          label: subject.name
        }))
      },
      { name: "item", label: "学習項目", required: true, placeholder: "例：二次関数" }
    ], values => {
      const subject = data.subjects.find(item => item.id === values.subjectId);
      if (!subject) return;

      subject.items ||= [];
      subject.items.push(values.item);

      saveData();
      renderStudy();
      showMessage("学習項目を追加しました。");
    });
  }

  function addManualRecord() {
    const subjectOptions = [
      { value: "", label: "未分類" },
      ...data.subjects.map(subject => ({
        value: subject.id,
        label: subject.name
      }))
    ];

    openDialog("学習実績を追加", [
      {
        name: "date",
        label: "学習した日",
        type: "date",
        value: today(),
        required: true
      },
      {
        name: "subjectId",
        label: "教科",
        type: "select",
        options: subjectOptions
      },
      {
        name: "item",
        label: "何をしたか",
        required: true,
        placeholder: "例：英単語を50個復習"
      },
      {
        name: "minutes",
        label: "勉強時間（分）",
        type: "number",
        min: "1",
        step: "1",
        required: true
      },
      {
        name: "note",
        label: "メモ",
        type: "textarea"
      }
    ], values => {
      addStudyRecord({
        ...values,
        subject: getSubjectName(values.subjectId),
        source: "manual"
      });
    });
  }

  function startTimer() {
    if (data.timer.running) {
      showMessage("タイマーはすでに動作中です。");
      return;
    }

    const subjectOptions = [
      { value: "", label: "未分類" },
      ...data.subjects.map(subject => ({
        value: subject.id,
        label: subject.name
      }))
    ];

    openDialog("学習タイマーを開始", [
      {
        name: "subjectId",
        label: "教科",
        type: "select",
        options: subjectOptions
      },
      {
        name: "item",
        label: "学習内容",
        required: true,
        placeholder: "例：数学の問題演習"
      }
    ], values => {
      timerStartedAt = Date.now();

      data.timer = {
        running: true,
        start: new Date(timerStartedAt).toISOString(),
        subjectId: values.subjectId,
        subject: getSubjectName(values.subjectId),
        item: values.item
      };

      saveData();
      startTimerDisplay();
      showMessage("タイマーを開始しました。");
    });
  }

  function startTimerDisplay() {
    clearInterval(timerInterval);

    const display = $("#study-timer-display");
    const status = $("#study-timer-status");

    const update = () => {
      if (!data.timer.running || !data.timer.start) return;

      const elapsed = Math.max(0, Math.floor(
        (Date.now() - new Date(data.timer.start).getTime()) / 1000
      ));

      if (display) {
        const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
        const minutes = String(Math.floor(elapsed % 3600 / 60)).padStart(2, "0");
        const seconds = String(elapsed % 60).padStart(2, "0");

        display.textContent = `${hours}:${minutes}:${seconds}`;
      }

      if (status) {
        status.textContent = `学習中：${data.timer.item || ""}`;
      }
    };

    update();
    timerInterval = setInterval(update, 1000);
  }

  function pauseTimer() {
    if (!data.timer.running || !data.timer.start) {
      showMessage("動作中のタイマーはありません。");
      return;
    }

    const elapsed = Math.floor(
      (Date.now() - new Date(data.timer.start).getTime()) / 1000
    );

    data.timer.running = false;
    data.timer.pausedSeconds = Math.max(0, elapsed);
    data.timer.start = null;

    clearInterval(timerInterval);
    saveData();

    const status = $("#study-timer-status");
    if (status) status.textContent = "一時停止中";

    showMessage("タイマーを一時停止しました。");
  }

  function finishTimer() {
    if (!data.timer.running || !data.timer.start) {
      showMessage("保存できる学習タイマーがありません。");
      return;
    }

    const start = new Date(data.timer.start);
    const end = new Date();
    const minutes = Math.floor((end.getTime() - start.getTime()) / 60000);

    clearInterval(timerInterval);

    if (minutes < 1) {
      showMessage("1分未満のため記録しませんでした。もう少し学習してから終了してください。");
      return;
    }

    const timer = { ...data.timer };

    data.timer = {
      running: false,
      start: null,
      subjectId: "",
      item: ""
    };

    saveData();

    addStudyRecord({
      date: start.toLocaleDateString("sv-SE"),
      subjectId: timer.subjectId,
      subject: timer.subject,
      item: timer.item,
      minutes,
      startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      endTime: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      source: "timer"
    });

    const display = $("#study-timer-display");
    const status = $("#study-timer-status");

    if (display) display.textContent = "00:00:00";
    if (status) status.textContent = "タイマー停止中";
  }

  /* ---------------------------------------------------------
     予定と行動表
     --------------------------------------------------------- */

  function addEvent() {
    openDialog("予定を追加", [
      { name: "date", label: "日付", type: "date", value: selectedDate, required: true },
      { name: "title", label: "予定", required: true, placeholder: "例：数学の問題演習" },
      { name: "startTime", label: "開始時刻", type: "time", value: "16:00", required: true },
      { name: "endTime", label: "終了時刻", type: "time", value: "17:00", required: true },
      { name: "note", label: "メモ", type: "textarea" }
    ], values => {
      if (values.endTime <= values.startTime) {
        showMessage("終了時刻は開始時刻より後にしてください。");
        return;
      }

      data.events.push({
        id: makeId(),
        date: values.date,
        title: values.title,
        startTime: values.startTime,
        endTime: values.endTime,
        note: values.note,
        createdAt: new Date().toISOString()
      });

      selectedDate = values.date;
      saveData();
      renderSchedule();
      renderCalendar();
      renderHome();
      showMessage("予定を追加しました。");
    });
  }

  function addActual() {
    openDialog("行動実績を追加", [
      { name: "date", label: "実施日", type: "date", value: selectedDate, required: true },
      { name: "title", label: "実際にしたこと", required: true, placeholder: "例：部屋の片付け" },
      { name: "startTime", label: "開始時刻", type: "time" },
      { name: "endTime", label: "終了時刻", type: "time" },
      { name: "minutes", label: "所要時間（分）", type: "number", min: "0", step: "1", value: "0" },
      { name: "note", label: "メモ", type: "textarea" }
    ], values => {
      const minutes = Number(values.minutes || 0);

      if (values.startTime && values.endTime && values.endTime <= values.startTime) {
        showMessage("終了時刻は開始時刻より後にしてください。");
        return;
      }

      data.records.push({
        id: makeId(),
        date: values.date,
        subjectId: "",
        subject: "行動記録",
        item: values.title,
        minutes,
        note: values.note,
        startTime: values.startTime,
        endTime: values.endTime,
        source: "activity",
        createdAt: new Date().toISOString()
      });

      selectedDate = values.date;
      saveData();
      renderSchedule();
      renderStudy();
      showMessage("行動実績を保存しました。");
    });
  }

  function eventDuration(event) {
    const start = event.startTime || "00:00";
    const end = event.endTime || start;

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }

  function renderSchedule() {
    const view = ensureScheduleView();
    if (!view) return;

    const dateInput = $("#schedule-date");
    if (dateInput && dateInput.value !== selectedDate) {
      dateInput.value = selectedDate;
    }

    const timeline = $("#schedule-timeline");
    if (!timeline) return;

    const events = data.events
      .filter(event => event.date === selectedDate)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    const records = data.records
      .filter(record => record.date === selectedDate)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    const planned = events.reduce((sum, event) => sum + eventDuration(event), 0);
    const actual = records.reduce((sum, record) => sum + Number(record.minutes || 0), 0);

    const plannedTotal = $("#schedule-planned-total");
    const actualTotal = $("#schedule-actual-total");

    if (plannedTotal) plannedTotal.textContent = formatMinutes(planned);
    if (actualTotal) actualTotal.textContent = formatMinutes(actual);

    const entries = [
      ...events.map(event => ({
        kind: "plan",
        id: event.id,
        date: event.date,
        title: event.title,
        startTime: event.startTime || "",
        endTime: event.endTime || "",
        minutes: eventDuration(event),
        note: event.note || ""
      })),
      ...records.map(record => ({
        kind: "actual",
        id: record.id,
        date: record.date,
        title: `${record.subject && record.subject !== "行動記録" ? `${record.subject}：` : ""}${record.item || "学習"}`,
        startTime: record.startTime || "",
        endTime: record.endTime || "",
        minutes: Number(record.minutes || 0),
        note: record.note || "",
        source: record.source
      }))
    ].sort((a, b) =>
      (a.startTime || "99:99").localeCompare(b.startTime || "99:99")
    );

    timeline.innerHTML = `
      <h3>${escapeHTML(selectedDate)} の行動</h3>
      <div class="schedule-legend">
        <span class="schedule-plan-key">予定</span>
        <span class="schedule-actual-key">実績</span>
      </div>
      ${entries.length ? entries.map(entry => `
        <article class="schedule-entry ${entry.kind === "plan" ? "is-plan" : "is-actual"}">
          <div class="schedule-entry-time">
            ${escapeHTML(entry.startTime || "時刻未設定")}
            ${entry.endTime ? `〜${escapeHTML(entry.endTime)}` : ""}
          </div>
          <div class="schedule-entry-content">
            <span class="schedule-entry-type">${entry.kind === "plan" ? "予定" : "実績"}</span>
            <strong>${escapeHTML(entry.title)}</strong>
            ${entry.minutes ? `<p>${formatMinutes(entry.minutes)}</p>` : ""}
            ${entry.note ? `<p>${escapeHTML(entry.note)}</p>` : ""}
            ${entry.source === "timer" ? "<small>タイマーから自動記録</small>" : ""}
          </div>
          <button type="button"
            data-action="${entry.kind === "plan" ? "delete-event" : "delete-record"}"
            data-id="${escapeHTML(entry.id)}">削除</button>
        </article>
      `).join("") : "<p>この日の予定・実績はありません。予定や行動を追加できます。</p>"}
    `;
  }

  function changeScheduleDate(days) {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    selectedDate = d.toLocaleDateString("sv-SE");
    renderSchedule();
  }

  /* ---------------------------------------------------------
     カレンダー
     --------------------------------------------------------- */

  function renderCalendar() {
    const grid = $("#calendar-grid");
    const label = $("#calendar-month-label");
    const selectedLabel = $("#calendar-selected-date-label");
    const eventList = $("#calendar-event-list");

    if (!grid) return;

    const current = new Date(`${selectedDate}T12:00:00`);
    const year = current.getFullYear();
    const month = current.getMonth();

    if (label) label.textContent = `${year}年${month + 1}月`;
    if (selectedLabel) selectedLabel.textContent = `${selectedDate} の予定`;

    const firstDay = new Date(year, month, 1);
    const start = new Date(year, month, 1 - firstDay.getDay());

    const days = Array.from({ length: 42 }, (_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      return d;
    });

    grid.innerHTML = days.map(d => {
      const date = d.toLocaleDateString("sv-SE");
      const hasEvent = data.events.some(event => event.date === date);
      const active = date === selectedDate;
      const inMonth = d.getMonth() === month;

      return `
        <button type="button"
          class="calendar-day ${active ? "active" : ""} ${inMonth ? "" : "outside-month"} ${hasEvent ? "has-event" : ""}"
          data-action="select-calendar-date"
          data-date="${date}"
          aria-pressed="${active}">
          <span>${d.getDate()}</span>
          ${hasEvent ? '<i aria-label="予定あり"></i>' : ""}
        </button>
      `;
    }).join("");

    if (eventList) {
      const events = data.events.filter(event => event.date === selectedDate);

      eventList.innerHTML = events.length
        ? events.map(event => `
            <article class="calendar-event">
              <strong>${escapeHTML(event.title)}</strong>
              <p>${escapeHTML(event.startTime || "")}〜${escapeHTML(event.endTime || "")}</p>
              <button type="button" data-action="delete-event" data-id="${escapeHTML(event.id)}">削除</button>
            </article>
          `).join("")
        : "<p>この日の予定はありません。</p>";
    }
  }

  /* ---------------------------------------------------------
     目標マップ：親子関係を使ったスキルツリー
     --------------------------------------------------------- */

  function addGoal() {
    openDialog("目標を追加", [
      { name: "title", label: "目標名", required: true, placeholder: "例：英語の長文を読めるようにする" },
      { name: "detail", label: "説明", type: "textarea" }
    ], values => {
      data.goals.push({
        id: makeId(),
        title: values.title,
        detail: values.detail,
        parentId: null,
        completed: false
      });

      saveData();
      renderGoals();
      showMessage("目標を追加しました。");
    });
  }

  function addGoalNode() {
    if (!data.goals.length) {
      addGoal();
      return;
    }

    openDialog("スキルツリーに目標を追加", [
      { name: "title", label: "目標名", required: true },
      { name: "detail", label: "説明", type: "textarea" },
      {
        name: "parentId",
        label: "つなげる親目標",
        type: "select",
        options: data.goals.map(goal => ({
          value: goal.id,
          label: goal.title
        }))
      }
    ], values => {
      data.goals.push({
        id: makeId(),
        title: values.title,
        detail: values.detail,
        parentId: values.parentId || null,
        completed: false
      });

      saveData();
      renderGoals();
      showMessage("スキルツリーに目標を追加しました。");
    });
  }

  function renderGoals() {
    const list = $("#goal-list");
    const canvas = $("#goal-map-canvas");
    const completion = $("#goal-map-completion");
    const progress = $("#goal-map-progress");

    const total = data.goals.length;
    const completed = data.goals.filter(goal => goal.completed).length;
    const percent = total ? Math.round(completed / total * 100) : 0;

    if (completion) completion.textContent = `${percent}%`;
    if (progress) {
      progress.style.width = `${percent}%`;
      progress.setAttribute("aria-valuenow", String(percent));
    }

    const childrenOf = parentId =>
      data.goals.filter(goal => (goal.parentId || null) === parentId);

    function renderBranch(goal, depth = 0, visited = new Set()) {
      if (visited.has(goal.id)) return "";
      const nextVisited = new Set(visited);
      nextVisited.add(goal.id);

      const children = childrenOf(goal.id);

      return `
        <div class="goal-tree-branch" style="--goal-depth:${Math.min(depth, 8)}">
          <article class="goal-node ${goal.completed ? "completed" : ""}">
            <button type="button"
              class="goal-node-toggle"
              data-action="toggle-goal"
              data-id="${escapeHTML(goal.id)}"
              aria-pressed="${goal.completed}">
              <span class="goal-node-status">${goal.completed ? "✓" : "○"}</span>
              <strong>${escapeHTML(goal.title)}</strong>
            </button>
            ${goal.detail ? `<p>${escapeHTML(goal.detail)}</p>` : ""}
            <div class="goal-node-actions">
              <button type="button" data-action="add-child-goal" data-id="${escapeHTML(goal.id)}">子目標</button>
              <button type="button" data-action="delete-goal" data-id="${escapeHTML(goal.id)}">削除</button>
            </div>
          </article>
          ${children.length ? `
            <div class="goal-tree-children">
              ${children.map(child => renderBranch(child, depth + 1, nextVisited)).join("")}
            </div>
          ` : ""}
        </div>
      `;
    }

    if (canvas) {
      const roots = data.goals.filter(goal =>
        !goal.parentId || !data.goals.some(parent => parent.id === goal.parentId)
      );

      canvas.innerHTML = roots.length
        ? roots.map(root => renderBranch(root)).join("")
        : "<p>目標を追加してスキルツリーを作成してください。</p>";
    }

    if (list) {
      list.innerHTML = data.goals.length
        ? data.goals.map(goal => `
            <article class="goal-list-item">
              <label>
                <input type="checkbox"
                  data-action="toggle-goal"
                  data-id="${escapeHTML(goal.id)}"
                  ${goal.completed ? "checked" : ""}>
                ${escapeHTML(goal.title)}
              </label>
            </article>
          `).join("")
        : "<p>目標がまだありません。</p>";
    }
  }

  /* ---------------------------------------------------------
     ホーム画面
     --------------------------------------------------------- */

  function renderHome() {
    renderStudy();

    const nextMission = $("#home-next-mission");
    if (nextMission) {
      const next = data.goals.find(goal => !goal.completed);
      nextMission.textContent = next
        ? `次の目標：${next.title}`
        : "次の目標を設定しましょう";
    }

    const scheduleList = $("#home-schedule-list");
    if (scheduleList) {
      const events = data.events
        .filter(event => event.date === today())
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

      scheduleList.innerHTML = events.length
        ? events.map(event => `
            <article>
              <strong>${escapeHTML(event.startTime || "")} ${escapeHTML(event.title)}</strong>
              <span>${escapeHTML(event.endTime || "")}</span>
            </article>
          `).join("")
        : "<p>今日の予定はありません。</p>";
    }

    const countdownList = $("#home-countdown-list");
    if (countdownList) {
      countdownList.innerHTML = data.countdowns.map(item => {
        const diff = Math.ceil(
          (new Date(`${item.date}T00:00:00`) - new Date(`${today()}T00:00:00`))
          / 86400000
        );

        return `<p>${escapeHTML(item.title)}：あと${diff}日</p>`;
      }).join("") || "<p>カウントダウンはありません。</p>";
    }
  }

  /* ---------------------------------------------------------
     設定・カウントダウン
     --------------------------------------------------------- */

  function addCountdown() {
    openDialog("カウントダウンを追加", [
      { name: "title", label: "イベント名", required: true, placeholder: "例：定期テスト" },
      { name: "date", label: "日付", type: "date", required: true }
    ], values => {
      data.countdowns.push({ id: makeId(), ...values });
      saveData();
      renderHome();
      renderCountdownList();
      showMessage("カウントダウンを追加しました。");
    });
  }

  function renderCountdownList() {
    const list = $("#countdown-list");
    if (!list) return;

    list.innerHTML = data.countdowns.map(item => `
      <article>
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML(item.date)}</span>
        <button type="button" data-action="delete-countdown" data-id="${escapeHTML(item.id)}">削除</button>
      </article>
    `).join("") || "<p>イベントがありません。</p>";
  }

  function saveSettings() {
    const dailyGoal = $("#setting-daily-goal");
    const animations = $("#setting-animations");
    const theme = $("#setting-theme");

    if (dailyGoal) {
      data.dailyGoal = Math.max(1, Number(dailyGoal.value) || 120);
    }

    if (animations) {
      data.settings.animations = animations.checked;
    }

    if (theme) {
      data.settings.theme = theme.value;
    }

    saveData();
    renderHome();
    showMessage("設定を保存しました。");
  }

  /* ---------------------------------------------------------
     ボタンイベント
     --------------------------------------------------------- */

  function handleAction(action, element) {
    switch (action) {
      case "start-study":
      case "timer-start":
        startTimer();
        break;

      case "timer-pause":
        pauseTimer();
        break;

      case "timer-finish":
        finishTimer();
        break;

      case "add-subject":
        addSubject();
        break;

      case "add-study-item":
        addStudyItem();
        break;

      case "add-event":
        addEvent();
        break;

      case "add-actual":
        addActual();
        break;

      case "add-goal":
        addGoal();
        break;

      case "add-goal-map-node":
        addGoalNode();
        break;

      case "add-countdown":
        addCountdown();
        break;

      case "schedule-prev":
        changeScheduleDate(-1);
        break;

      case "schedule-next":
        changeScheduleDate(1);
        break;

      case "schedule-today":
        selectedDate = today();
        renderSchedule();
        break;

      case "select-calendar-date":
        selectedDate = element.dataset.date;
        renderCalendar();
        break;

      case "delete-event":
        data.events = data.events.filter(item => item.id !== element.dataset.id);
        saveData();
        renderCalendar();
        renderSchedule();
        renderHome();
        showMessage("予定を削除しました。");
        break;

      case "delete-record":
        data.records = data.records.filter(item => item.id !== element.dataset.id);
        saveData();
        renderStudy();
        renderSchedule();
        renderHome();
        showMessage("記録を削除しました。");
        break;

      case "delete-countdown":
        data.countdowns = data.countdowns.filter(item => item.id !== element.dataset.id);
        saveData();
        renderCountdownList();
        renderHome();
        break;

      case "toggle-goal": {
        const goal = data.goals.find(item => item.id === element.dataset.id);
        if (!goal) break;

        goal.completed = element.type === "checkbox"
          ? element.checked
          : !goal.completed;

        saveData();
        renderGoals();
        break;
      }

      case "add-child-goal": {
        const parent = data.goals.find(item => item.id === element.dataset.id);
        if (!parent) break;

        openDialog("子目標を追加", [
          { name: "title", label: "目標名", required: true },
          { name: "detail", label: "説明", type: "textarea" }
        ], values => {
          data.goals.push({
            id: makeId(),
            title: values.title,
            detail: values.detail,
            parentId: parent.id,
            completed: false
          });

          saveData();
          renderGoals();
        });
        break;
      }

      case "delete-goal": {
        const id = element.dataset.id;
        const removeIds = new Set([id]);

        let changed = true;
        while (changed) {
          changed = false;
          data.goals.forEach(goal => {
            if (goal.parentId && removeIds.has(goal.parentId) && !removeIds.has(goal.id)) {
              removeIds.add(goal.id);
              changed = true;
            }
          });
        }

        data.goals = data.goals.filter(goal => !removeIds.has(goal.id));
        saveData();
        renderGoals();
        showMessage("目標とその子目標を削除しました。");
        break;
      }

      default:
        showMessage("この操作はまだ接続されていません。");
    }
  }

  function bindEvents() {
    $("#menu-open")?.addEventListener("click", event => {
      event.preventDefault();
      openMenu();
    });

    $("#menu-close")?.addEventListener("click", event => {
      event.preventDefault();
      closeMenu();
    });

    $("#menu-backdrop")?.addEventListener("click", closeMenu);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMenu();
        closeDialog();
      }
    });

    document.addEventListener("click", event => {
      const viewButton = event.target.closest("[data-view]");
      if (viewButton) {
        event.preventDefault();
        showView(viewButton.dataset.view);
        return;
      }

      const actionButton = event.target.closest("[data-action]");
      if (actionButton) {
        event.preventDefault();
        handleAction(actionButton.dataset.action, actionButton);
      }
    });

    const dialogForm = $("#cosmos-dialog-form");
    dialogForm?.addEventListener("submit", handleDialogSubmit);

    const dialog = $("#cosmos-dialog");
    dialog?.addEventListener("cancel", event => {
      event.preventDefault();
      closeDialog();
    });

    $("#manual-study-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const subjectId = $("#manual-study-subject")?.value || "";
      const item = $("#manual-study-item")?.value.trim() || "";
      const date = $("#manual-study-date")?.value || today();
      const minutes = Number($("#manual-study-minutes")?.value || 0);
      const note = $("#manual-study-note")?.value.trim() || "";

      if (!item) {
        showMessage("学習内容を入力してください。");
        return;
      }

      if (addStudyRecord({
        subjectId,
        subject: getSubjectName(subjectId),
        item,
        date,
        minutes,
        note,
        source: "manual"
      })) {
        event.target.reset();
      }
    });

    $("#schedule-date")?.addEventListener("change", event => {
      if (event.target.value) {
        selectedDate = event.target.value;
        renderSchedule();
      }
    });

    $("#calendar-prev")?.addEventListener("click", () => {
      const d = new Date(`${selectedDate}T12:00:00`);
      d.setMonth(d.getMonth() - 1);
      selectedDate = d.toLocaleDateString("sv-SE");
      renderCalendar();
    });

    $("#calendar-next")?.addEventListener("click", () => {
      const d = new Date(`${selectedDate}T12:00:00`);
      d.setMonth(d.getMonth() + 1);
      selectedDate = d.toLocaleDateString("sv-SE");
      renderCalendar();
    });

    $("#settings-study-form")?.addEventListener("submit", event => {
      event.preventDefault();
      saveSettings();
    });

    $("#setting-daily-goal") &&
      ($("#setting-daily-goal").value = String(data.dailyGoal));

    $("#setting-animations") &&
      ($("#setting-animations").checked = data.settings.animations);

    $("#setting-theme") &&
      ($("#setting-theme").value = data.settings.theme);

    $$('input[name="bottomShortcut"]').forEach(input => {
      input.addEventListener("change", () => {
        const selected = $$('input[name="bottomShortcut"]:checked')
          .map(item => item.value);

        $$("#bottom-navigation [data-shortcut]").forEach(button => {
          button.hidden = !selected.includes(button.dataset.shortcut);
        });
      });
    });

    $("#edit-timetable")?.addEventListener("click", () => {
      showMessage("時間割の編集機能は、次の実装段階で接続します。");
    });

    $("#add-task")?.addEventListener("click", () => {
      openDialog("タスクを追加", [
        { name: "title", label: "タスク名", required: true },
        { name: "date", label: "期限", type: "date", value: today() }
      ], values => {
        data.tasks.push({ id: makeId(), ...values, completed: false });
        saveData();
        renderTasks();
      });
    });

    $("#add-habit")?.addEventListener("click", () => {
      showMessage("習慣の追加機能は、次の実装段階で接続します。");
    });

    $("#enable-notifications")?.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        showMessage("この環境では通知を利用できません。");
        return;
      }

      const permission = await Notification.requestPermission();
      showMessage(permission === "granted"
        ? "通知を許可しました。"
        : "通知は許可されていません。");
    });

    $("#economy-deposit")?.addEventListener("click", () => economyAction("deposit"));
    $("#economy-withdraw")?.addEventListener("click", () => economyAction("withdraw"));
    $("#economy-borrow")?.addEventListener("click", () => economyAction("borrow"));
  }

  function renderTasks() {
    const list = $("#task-list");
    if (!list) return;

    list.innerHTML = data.tasks.map(task => `
      <article>
        <label>
          <input type="checkbox" data-task-id="${escapeHTML(task.id)}" ${task.completed ? "checked" : ""}>
          ${escapeHTML(task.title)}
        </label>
        <span>${escapeHTML(task.date || "")}</span>
        <button type="button" data-delete-task="${escapeHTML(task.id)}">削除</button>
      </article>
    `).join("") || "<p>タスクはありません。</p>";
  }

  function economyAction(type) {
    const labels = {
      deposit: "預け入れ",
      withdraw: "引き出し",
      borrow: "借入"
    };

    openDialog(labels[type], [
      { name: "amount", label: "金額", type: "number", min: "1", step: "1", required: true },
      { name: "note", label: "メモ" }
    ], values => {
      const amount = Math.floor(Number(values.amount));

      if (!Number.isFinite(amount) || amount <= 0) {
        showMessage("金額を正しく入力してください。");
        return;
      }

      if (type === "withdraw" && amount > data.economy.balance) {
        showMessage("残高が足りません。");
        return;
      }

      if (type === "deposit") data.economy.balance += amount;
      if (type === "withdraw") data.economy.balance -= amount;

      data.economy.transactions.push({
        id: makeId(),
        type,
        amount,
        note: values.note,
        date: today()
      });

      saveData();
      renderEconomy();
      showMessage("取引を保存しました。");
    });
  }

  function renderEconomy() {
    const balance = $("#economy-balance");
    const netWorth = $("#economy-net-worth");

    if (balance) balance.textContent = `${data.economy.balance.toLocaleString()} 円`;
    if (netWorth) netWorth.textContent = `${data.economy.balance.toLocaleString()} 円`;

    const list = $("#economy-transaction-list");
    if (list) {
      list.innerHTML = data.economy.transactions.slice().reverse().map(item => `
        <article>
          <strong>${escapeHTML(item.type)}</strong>
          <span>${Number(item.amount).toLocaleString()}円</span>
          <small>${escapeHTML(item.date)}</small>
        </article>
      `).join("") || "<p>取引履歴はありません。</p>";
    }
  }

  /* ---------------------------------------------------------
     初期化
     --------------------------------------------------------- */

  function init() {
    ensureScheduleView();
    bindEvents();

    if (data.timer.running && data.timer.start) {
      startTimerDisplay();
    }

    renderStudy();
    renderSchedule();
    renderCalendar();
    renderGoals();
    renderHome();
    renderTasks();
    renderCountdownList();
    renderEconomy();

    showView("home");

    console.log("One for All COSMOS UI initialized.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
