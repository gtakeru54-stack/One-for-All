
"use strict";

/* =========================================================
   ONE FOR ALL COSMOS
   js/ui.js
   共通UI・学習記録・カレンダー・設定
   ========================================================= */

import Store from "./store.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DAY = 86400000;
const pad = n => String(n).padStart(2, "0");
const today = () => dateKey(new Date());
const dateKey = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
const minutesText = n => {
  n = Math.max(0, Math.floor(Number(n) || 0));
  return n >= 60 ? `${Math.floor(n / 60)}時間${n % 60}分` : `${n}分`;
};
const formatDate = date => {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? date
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

let currentView = "home";
let selectedDate = today();
let calendarMonth = new Date();
let toastTimer = null;
let timerInterval = null;
let timerStartedAt = null;
let timerAccumulated = 0;
let timerRunning = false;
let timerSubjectId = "";
let timerItemId = "";
let dialogSubmit = null;
let dialogBusy = false;

function notify(message, duration = 2500) {
  const el = $("#cosmos-message");
  if (!el) return;

  el.textContent = message;
  el.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, duration);
}

function showMessage(message, duration) {
  notify(message, duration);
}

function safeRun(callback) {
  try {
    callback();
  } catch (error) {
    console.error("[COSMOS]", error);
    notify(error?.message || "処理中にエラーが発生しました。");
  }
}

/* =========================================================
   画面切り替え
   ========================================================= */

function showView(name) {
  const target = $(`#view-${CSS.escape(name)}`);
  if (!target) {
    console.warn(`[COSMOS] 画面が見つかりません: ${name}`);
    return false;
  }

  currentView = name;

  $$("[data-view-panel], main > section[id^='view-']").forEach(section => {
    const active = section === target;
    section.hidden = !active;
    section.classList.toggle("active", active);
    section.setAttribute("aria-hidden", String(!active));
  });

  $$("[data-view]").forEach(button => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  document.body.dataset.currentView = name;
  document.title = `${({
    home: "ホーム",
    study: "学習記録",
    calendar: "カレンダー・時間割",
    statistics: "学習統計",
    goals: "目標マップ",
    rocket: "宇宙開発",
    economy: "経済",
    countdown: "カウントダウン",
    notifications: "通知",
    settings: "設定"
  })[name] || name} | One for All COSMOS`;

  closeMenu();
  window.scrollTo({ top: 0, behavior: "auto" });

  document.dispatchEvent(
    new CustomEvent("cosmos:viewchange", { detail: { view: name } })
  );

  renderAll();
  return true;
}

/* =========================================================
   メニュー
   ========================================================= */

function openMenu() {
  const menu = $("#side-menu");
  const backdrop = $("#menu-backdrop");
  const opener = $("#menu-open");

  if (!menu) return;

  menu.inert = false;
  menu.setAttribute("aria-hidden", "false");
  menu.classList.add("open");

  if (backdrop) {
    backdrop.hidden = false;
    backdrop.classList.add("open");
  }

  opener?.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  const menu = $("#side-menu");
  const backdrop = $("#menu-backdrop");

  menu?.classList.remove("open");
  if (menu) {
    menu.setAttribute("aria-hidden", "true");
    menu.inert = true;
  }

  if (backdrop) {
    backdrop.classList.remove("open");
    backdrop.hidden = true;
  }

  $("#menu-open")?.setAttribute("aria-expanded", "false");
}

/* =========================================================
   共通ダイアログ
   ========================================================= */

function openDialog(title, fields, onSubmit, options = {}) {
  const dialog = $("#cosmos-dialog");
  const titleEl = $("#cosmos-dialog-title");
  const content = $("#cosmos-dialog-content");
  const confirm = $("#cosmos-dialog-confirm");

  if (!dialog || !content || !confirm) {
    notify("入力画面を表示できません。");
    return;
  }

  titleEl.textContent = title;
  content.replaceChildren();

  for (const field of fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "dialog-field";

    const label = document.createElement("label");
    label.htmlFor = `dialog-${field.name}`;
    label.textContent = field.label;
    wrapper.append(label);

    let input;

    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = field.rows || 3;
    } else if (field.type === "select") {
      input = document.createElement("select");

      for (const option of field.options || []) {
        const opt = document.createElement("option");
        opt.value = String(option.value);
        opt.textContent = option.label;
        input.append(opt);
      }
    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
    }

    input.id = `dialog-${field.name}`;
    input.name = field.name;

    if (field.value !== undefined) input.value = field.value;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.required) input.required = true;
    if (field.step !== undefined) input.step = String(field.step);

    wrapper.append(input);
    content.append(wrapper);
  }

  dialogSubmit = onSubmit;
  dialogBusy = false;
  confirm.disabled = false;
  confirm.textContent = options.confirmText || "決定";

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  const firstInput = content.querySelector("input,select,textarea");
  firstInput?.focus();
}

function closeDialog() {
  const dialog = $("#cosmos-dialog");

  if (dialog?.open && typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog?.removeAttribute("open");
  }

  dialogSubmit = null;
  dialogBusy = false;
}

async function submitDialog() {
  if (dialogBusy || typeof dialogSubmit !== "function") return;

  const content = $("#cosmos-dialog-content");
  const values = {};

  for (const field of $$("input,select,textarea", content)) {
    if (!field.reportValidity()) return;
    values[field.name] = field.value;
  }

  dialogBusy = true;
  const confirm = $("#cosmos-dialog-confirm");
  if (confirm) confirm.disabled = true;

  try {
    const result = await dialogSubmit(values);
    if (result !== false) closeDialog();
  } catch (error) {
    console.error("[COSMOS] ダイアログ処理失敗", error);
    notify(error?.message || "保存できませんでした。");
  } finally {
    dialogBusy = false;
    if (confirm) confirm.disabled = false;
  }
}

/* =========================================================
   学習科目・項目
   ========================================================= */

function subjects() {
  return Store.list("subjects");
}

function findSubject(id) {
  return subjects().find(s => s.id === id);
}

function findItem(subject, id) {
  return (subject?.items || []).find(item => item.id === id);
}

function populateSubjectSelects() {
  const options = subjects();

  for (const select of [
    $("#manual-study-subject"),
    $("#timer-subject")
  ]) {
    if (!select) continue;

    const previous = select.value;
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "科目を選択";
    select.append(placeholder);

    for (const subject of options) {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      select.append(option);
    }

    if (options.some(s => s.id === previous)) select.value = previous;
  }

  updateItemSelect();
}

function updateItemSelect() {
  const subjectSelect = $("#manual-study-subject");
  const itemSelect = $("#manual-study-item");
  if (!subjectSelect || !itemSelect) return;

  const previous = itemSelect.value;
  const subject = findSubject(subjectSelect.value);

  itemSelect.replaceChildren();

  const first = document.createElement("option");
  first.value = "";
  first.textContent = "項目を選択（任意）";
  itemSelect.append(first);

  for (const item of subject?.items || []) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    itemSelect.append(option);
  }

  if ((subject?.items || []).some(item => item.id === previous)) {
    itemSelect.value = previous;
  }
}

function addSubject() {
  openDialog("科目を追加", [
    { name: "name", label: "科目名", required: true, placeholder: "例：物理" },
    {
      name: "color",
      label: "グラフの色",
      type: "color",
      value: "#7c9cff",
      required: true
    }
  ], values => {
    const name = values.name.trim();
    if (!name) throw new Error("科目名を入力してください。");

    if (subjects().some(s => s.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("同じ名前の科目がすでにあります。");
    }

    Store.add("subjects", {
      name,
      color: values.color || "#7c9cff",
      items: []
    });

    renderAll();
    notify("科目を追加しました。");
  });
}

function addStudyItem() {
  const available = subjects();

  if (!available.length) {
    notify("先に科目を追加してください。");
    return;
  }

  openDialog("学習項目を追加", [
    {
      name: "subjectId",
      label: "科目",
      type: "select",
      required: true,
      options: available.map(s => ({ value: s.id, label: s.name }))
    },
    {
      name: "name",
      label: "学習項目名",
      required: true,
      placeholder: "例：二次関数"
    }
  ], values => {
    const subject = findSubject(values.subjectId);
    const name = values.name.trim();

    if (!subject) throw new Error("科目を選び直してください。");
    if (!name) throw new Error("項目名を入力してください。");

    if (subject.items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("その項目はすでに登録されています。");
    }

    Store.replace("subjects", subject.id, {
      items: [...subject.items, { id: Store.makeId("item"), name }]
    });

    renderAll();
    notify("学習項目を追加しました。");
  });
}

function renderSubjects() {
  const container = $("#study-subject-list");
  if (!container) return;

  container.replaceChildren();

  if (!subjects().length) {
    container.textContent = "科目がありません。＋科目から追加してください。";
    return;
  }

  for (const subject of subjects()) {
    const card = document.createElement("article");
    card.className = "study-subject-card";

    const heading = document.createElement("h3");
    heading.textContent = subject.name;
    heading.style.borderLeft = `4px solid ${subject.color || "#7c9cff"}`;
    heading.style.paddingLeft = "10px";
    card.append(heading);

    const total = document.createElement("p");
    total.className = "muted";
    total.textContent = `累計 ${minutesText(Store.getSubjectMinutes(subject.id))}`;
    card.append(total);

    for (const item of subject.items || []) {
      const row = document.createElement("div");
      row.className = "list-row";

      const label = document.createElement("span");
      label.textContent = item.name;

      const time = document.createElement("span");
      const itemMinutes = Store.list("studyRecords")
        .filter(r => r.subjectId === subject.id && r.itemId === item.id)
        .reduce((sum, r) => sum + (Number(r.minutes) || 0), 0);
      time.textContent = minutesText(itemMinutes);

      row.append(label, time);
      card.append(row);
    }

    const addItemButton = document.createElement("button");
    addItemButton.type = "button";
    addItemButton.className = "text-button";
    addItemButton.textContent = "＋ この科目に項目を追加";
    addItemButton.addEventListener("click", () => {
      openDialog("学習項目を追加", [
        {
          name: "name",
          label: "項目名",
          required: true,
          placeholder: "例：英文法"
        }
      ], values => {
        const name = values.name.trim();
        if (!name) throw new Error("項目名を入力してください。");

        const latest = findSubject(subject.id);
        if (!latest) throw new Error("科目が見つかりません。");

        Store.replace("subjects", subject.id, {
          items: [...latest.items, { id: Store.makeId("item"), name }]
        });

        renderAll();
        notify("学習項目を追加しました。");
      });
    });

    card.append(addItemButton);
    container.append(card);
  }
}

/* =========================================================
   学習タイマー
   ========================================================= */

function elapsedMs() {
  return timerAccumulated +
    (timerRunning && timerStartedAt ? Date.now() - timerStartedAt : 0);
}

function timerText(ms) {
  const total = Math.floor(ms / 1000);
  return `${pad(Math.floor(total / 3600))}:` +
    `${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

function renderTimer() {
  const display = $("#study-timer-display");
  const status = $("#study-timer-status");

  if (display) display.textContent = timerText(elapsedMs());

  if (status) {
    status.textContent = timerRunning
      ? "学習中です。集中して取り組もう。"
      : elapsedMs() > 0
        ? "一時停止中です。再開するか、記録して終了できます。"
        : "学習を始める準備ができています。";
  }

  const start = $('[data-action="timer-start"]');
  const pause = $('[data-action="timer-pause"]');
  const finish = $('[data-action="timer-finish"]');

  if (start) start.disabled = timerRunning;
  if (pause) pause.disabled = !timerRunning;
  if (finish) finish.disabled = elapsedMs() < 1000;
}

function persistTimer() {
  Store.set("timer", {
    running: timerRunning,
    startedAt: timerStartedAt,
    subjectId: timerSubjectId || null,
    itemId: timerItemId || null,
    accumulatedMs: timerAccumulated
  });
}

function restoreTimer() {
  const saved = Store.get("timer", {});

  timerAccumulated = Math.max(0, Number(saved.accumulatedMs) || 0);
  timerSubjectId = saved.subjectId || "";
  timerItemId = saved.itemId || "";
  timerStartedAt = saved.startedAt || null;
  timerRunning = Boolean(saved.running && timerStartedAt);

  if (timerRunning) {
    const start = new Date(timerStartedAt).getTime();
    if (!Number.isFinite(start) || start > Date.now()) {
      timerRunning = false;
      timerStartedAt = null;
    }
  }

  if (timerRunning) {
    timerInterval = setInterval(() => {
      renderTimer();
      if (Date.now() % 5000 < 1000) persistTimer();
    }, 250);
  }

  renderTimer();
}

function startTimer() {
  if (timerRunning) return;

  if (elapsedMs() === 0) {
    openDialog("学習を開始", [
      {
        name: "subjectId",
        label: "科目",
        type: "select",
        required: true,
        options: subjects().map(s => ({ value: s.id, label: s.name }))
      }
    ], values => {
      timerSubjectId = values.subjectId;
      timerItemId = "";
      timerAccumulated = 0;
      timerStartedAt = new Date().toISOString();
      timerRunning = true;

      clearInterval(timerInterval);
      timerInterval = setInterval(renderTimer, 250);
      persistTimer();
      renderTimer();
      notify("学習タイマーを開始しました。");
    });

    return;
  }

  timerStartedAt = new Date().toISOString();
  timerRunning = true;

  clearInterval(timerInterval);
  timerInterval = setInterval(renderTimer, 250);
  persistTimer();
  renderTimer();
  notify("タイマーを再開しました。");
}

function pauseTimer() {
  if (!timerRunning) return;

  timerAccumulated += Date.now() - new Date(timerStartedAt).getTime();
  timerStartedAt = null;
  timerRunning = false;

  clearInterval(timerInterval);
  timerInterval = null;

  persistTimer();
  renderTimer();
  notify("タイマーを一時停止しました。");
}

function finishTimer() {
  if (timerRunning) {
    timerAccumulated += Date.now() - new Date(timerStartedAt).getTime();
    timerRunning = false;
    timerStartedAt = null;
  }

  clearInterval(timerInterval);
  timerInterval = null;

  const minutes = Math.floor(timerAccumulated / 60000);

  if (minutes < 1) {
    persistTimer();
    renderTimer();
    notify("記録するには1分以上の学習時間が必要です。");
    return;
  }

  const subject = findSubject(timerSubjectId);

  Store.addStudyRecord({
    subjectId: subject?.id || "",
    subject: subject?.name || "未分類",
    itemId: timerItemId,
    item: findItem(subject, timerItemId)?.name || "",
    minutes,
    date: today(),
    source: "timer"
  });

  timerAccumulated = 0;
  timerSubjectId = "";
  timerItemId = "";
  timerStartedAt = null;
  timerRunning = false;

  persistTimer();
  renderAll();
  notify(`${minutes}分の学習を記録しました。`);
}

/* =========================================================
   学習記録
   ========================================================= */

function renderRecords() {
  const container = $("#study-record-list");
  if (!container) return;

  container.replaceChildren();

  const records = Store.list("studyRecords")
    .slice()
    .sort((a, b) =>
      `${b.date || ""}${b.createdAt || ""}`.localeCompare(
        `${a.date || ""}${a.createdAt || ""}`
      )
    )
    .slice(0, 50);

  if (!records.length) {
    container.textContent = "学習記録はまだありません。";
    return;
  }

  for (const record of records) {
    const row = document.createElement("article");
    row.className = "list-row";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = record.subject || "未分類";

    const detail = document.createElement("p");
    detail.className = "muted";
    detail.textContent = [
      record.item,
      formatDate(record.date || today()),
      record.note
    ].filter(Boolean).join(" ・ ");

    info.append(title, detail);

    const time = document.createElement("strong");
    time.textContent = minutesText(record.minutes);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "削除";
    remove.setAttribute("aria-label", "この学習記録を削除");
    remove.addEventListener("click", () => {
      if (!window.confirm("この学習記録を削除しますか？")) return;
      Store.remove("studyRecords", record.id);
      renderAll();
      notify("学習記録を削除しました。");
    });

    row.append(info, time, remove);
    container.append(row);
  }
}

function submitManualStudy(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const values = new FormData(form);
  const subject = findSubject(values.get("subjectId"));
  const item = findItem(subject, values.get("itemId"));
  const minutes = Number(values.get("minutes"));

  if (!subject) {
    notify("科目を選択してください。");
    return;
  }

  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    notify("学習時間は1〜1440分で入力してください。");
    return;
  }

  Store.addStudyRecord({
    subjectId: subject.id,
    subject: subject.name,
    itemId: item?.id || "",
    item: item?.name || "",
    date: values.get("date"),
    minutes,
    note: String(values.get("note") || "").trim(),
    source: "manual"
  });

  form.reset();
  $("#manual-study-date").value = today();

  renderAll();
  notify("学習時間を追加しました。");
}

/* =========================================================
   カレンダー・予定
   ========================================================= */

function events() {
  return Store.list("calendar.events");
}

function tasks() {
  return Store.list("calendar.tasks");
}

function renderCalendar() {
  const label = $("#calendar-month-label");
  const grid = $("#calendar-grid");
  const dateLabel = $("#calendar-selected-date-label");
  const eventList = $("#calendar-event-list");

  if (!grid) return;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  if (label) label.textContent = `${year}年${month + 1}月`;

  grid.replaceChildren();

  for (const name of ["日", "月", "火", "水", "木", "金", "土"]) {
    const heading = document.createElement("div");
    heading.className = "calendar-weekday";
    heading.textContent = name;
    grid.append(heading);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-day empty";
    blank.setAttribute("aria-hidden", "true");
    grid.append(blank);
  }

  for (let day = 1; day <= count; day++) {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);

    if (key === today()) button.classList.add("today");
    if (key === selectedDate) button.classList.add("selected");

    if (events().some(e => e.date === key)) {
      button.classList.add("has-event");
      button.setAttribute("aria-label", `${day}日、予定あり`);
    }

    button.addEventListener("click", () => {
      selectedDate = key;
      renderCalendar();
    });

    grid.append(button);
  }

  if (dateLabel) dateLabel.textContent = formatDate(selectedDate);
  if (!eventList) return;

  eventList.replaceChildren();

  const selectedEvents = events()
    .filter(e => e.date === selectedDate)
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

  if (!selectedEvents.length) {
    eventList.textContent = "この日の予定はありません。";
  }

  for (const event of selectedEvents) {
    const row = document.createElement("article");
    row.className = "list-row";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = event.title;

    const detail = document.createElement("p");
    detail.className = "muted";
    detail.textContent = [
      event.time,
      event.endTime,
      event.note
    ].filter(Boolean).join(" – ");

    info.append(title, detail);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      if (!confirm("この予定を削除しますか？")) return;
      Store.remove("calendar.events", event.id);
      renderAll();
      notify("予定を削除しました。");
    });

    row.append(info, remove);
    eventList.append(row);
  }
}

function addEvent() {
  openDialog("予定を追加", [
    { name: "title", label: "予定名", required: true },
    { name: "date", label: "日付", type: "date", value: selectedDate, required: true },
    { name: "time", label: "開始時刻", type: "time" },
    { name: "endTime", label: "終了時刻", type: "time" },
    { name: "note", label: "メモ", type: "textarea" }
  ], values => {
    const title = values.title.trim();
    if (!title) throw new Error("予定名を入力してください。");

    Store.add("calendar.events", {
      title,
      date: values.date,
      time: values.time,
      endTime: values.endTime,
      note: values.note.trim(),
      completed: false
    });

    selectedDate = values.date;
    calendarMonth = new Date(`${values.date}T00:00:00`);
    renderAll();
    notify("予定を追加しました。");
  });
}

function renderTasks() {
  const container = $("#task-list");
  if (!container) return;

  container.replaceChildren();

  const list = tasks().slice().sort((a, b) =>
    Number(a.completed) - Number(b.completed)
  );

  if (!list.length) {
    container.textContent = "タスクはありません。";
    return;
  }

  for (const task of list) {
    const row = document.createElement("article");
    row.className = "list-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.setAttribute("aria-label", `${task.title}を完了にする`);
    checkbox.addEventListener("change", () => {
      Store.replace("calendar.tasks", task.id, {
        completed: checkbox.checked,
        completedAt: checkbox.checked ? new Date().toISOString() : null
      });
      renderAll();
    });

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = task.title;
    if (task.completed) title.classList.add("completed");

    const detail = document.createElement("p");
    detail.className = "muted";
    detail.textContent = task.dueDate
      ? `期限：${formatDate(task.dueDate)}`
      : "期限なし";

    info.append(title, detail);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      if (!confirm("このタスクを削除しますか？")) return;
      Store.remove("calendar.tasks", task.id);
      renderAll();
      notify("タスクを削除しました。");
    });

    row.append(checkbox, info, remove);
    container.append(row);
  }
}

function addTask() {
  openDialog("タスクを追加", [
    { name: "title", label: "タスク名", required: true },
    { name: "dueDate", label: "期限", type: "date", value: selectedDate },
    { name: "note", label: "メモ", type: "textarea" }
  ], values => {
    const title = values.title.trim();
    if (!title) throw new Error("タスク名を入力してください。");

    Store.add("calendar.tasks", {
      title,
      dueDate: values.dueDate,
      note: values.note.trim(),
      completed: false
    });

    renderAll();
    notify("タスクを追加しました。");
  });
}

function renderTimetable() {
  const body = $("#timetable-body");
  if (!body) return;

  body.replaceChildren();

  const days = ["月", "火", "水", "木", "金", "土", "日"];
  const timetable = Store.list("calendar.timetable");
  const startHour = 6;
  const endHour = 26;

  for (let hour = startHour; hour < endHour; hour++) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");

    th.textContent = `${pad(hour % 24)}:00`;
    tr.append(th);

    for (let day = 0; day < 7; day++) {
      const td = document.createElement("td");
      const entry = timetable.find(
        item => Number(item.day) === day &&
          Number(item.hour) === hour
      );

      td.textContent = entry?.title || "";
      td.title = entry?.title || "";
      td.tabIndex = 0;
      td.setAttribute("role", "button");
      td.setAttribute("aria-label", `${days[day]}曜日 ${pad(hour % 24)}時`);

      const edit = () => {
        openDialog("時間割を編集", [
          {
            name: "title",
            label: "内容（空欄で削除）",
            value: entry?.title || ""
          }
        ], values => {
          const next = timetable.filter(
            item => !(Number(item.day) === day &&
              Number(item.hour) === hour)
          );

          if (values.title.trim()) {
            next.push({
              id: entry?.id || Store.makeId("slot"),
              day,
              hour,
              title: values.title.trim()
            });
          }

          Store.set("calendar.timetable", next);
          renderTimetable();
          notify("時間割を更新しました。");
        });
      };

      td.addEventListener("click", edit);
      td.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          edit();
        }
      });

      tr.append(td);
    }

    body.append(tr);
  }
}

/* =========================================================
   ホーム・統計
   ========================================================= */

function renderHome() {
  const todayMinutes = Store.getStudyMinutes(today());
  const dailyGoal = Math.max(1, Number(Store.get("settings.dailyGoal", 120)));
  const percent = Math.floor(todayMinutes / dailyGoal * 100);
  const bounded = Math.min(100, percent);

  if ($("#home-today-time")) {
    $("#home-today-time").textContent = minutesText(todayMinutes);
  }

  if ($("#home-goal-percent")) {
    $("#home-goal-percent").textContent = `${percent}%`;
  }

  if ($("#home-goal-progress")) {
    $("#home-goal-progress").style.width = `${bounded}%`;
  }

  if ($("#home-goal-message")) {
    $("#home-goal-message").textContent = percent >= 100
      ? "今日の目標を達成しました！"
      : todayMinutes === 0
        ? "まずは5分から始めよう。"
        : `目標まであと${minutesText(dailyGoal - todayMinutes)}。`;
  }

  const rocketLevel = Number(Store.get("rocket.level", 1)) || 1;
  const exp = Number(Store.get("rocket.experience", 0)) || 0;
  const needed = rocketLevel * 100;

  if ($("#home-rocket-level")) {
    $("#home-rocket-level").textContent = `LEVEL ${rocketLevel}`;
  }
  if ($("#home-rocket-exp")) {
    $("#home-rocket-exp").textContent = `EXP ${exp} / ${needed}`;
  }
  if ($("#home-rocket-progress")) {
    $("#home-rocket-progress").style.width =
      `${Math.min(100, exp / Math.max(1, needed) * 100)}%`;
  }

  if ($("#home-next-mission")) {
    $("#home-next-mission").textContent =
      "学習を記録して、ロケットの成長を進めよう。";
  }

  const schedule = $("#home-schedule-list");
  if (schedule) {
    schedule.replaceChildren();

    const upcoming = events()
      .filter(e => e.date >= today())
      .sort((a, b) =>
        `${a.date} ${a.time || ""}`.localeCompare(
          `${b.date} ${b.time || ""}`
        )
      ).slice(0, 5);

    if (!upcoming.length) {
      schedule.textContent = "予定はまだありません。";
    } else {
      for (const event of upcoming) {
        const p = document.createElement("p");
        p.textContent = `${formatDate(event.date)} ${event.time || ""} ${event.title}`;
        schedule.append(p);
      }
    }
  }

  const countdown = $("#home-countdown-list");
  if (countdown) {
    countdown.replaceChildren();

    const items = Store.list("countdowns")
      .filter(item => item.date >= today())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);

    if (!items.length) {
      countdown.textContent = "試験や目標の日を登録しよう。";
    } else {
      for (const item of items) {
        const p = document.createElement("p");
        const days = Math.ceil(
          (new Date(`${item.date}T00:00:00`) -
            new Date(`${today()}T00:00:00`)) / DAY
        );
        p.textContent = `${item.title}：あと${days}日`;
        countdown.append(p);
      }
    }
  }
}

function renderStatistics() {
  const minutes = Store.getStudyMinutes(today());
  const goal = Math.max(1, Number(Store.get("settings.dailyGoal", 120)));

  if ($("#stats-today-time")) {
    $("#stats-today-time").textContent = minutesText(minutes);
  }
  if ($("#stats-today-goal")) {
    $("#stats-today-goal").textContent = `目標 ${minutesText(goal)}`;
  }
  if ($("#stats-today-progress")) {
    $("#stats-today-progress").style.width =
      `${Math.min(100, minutes / goal * 100)}%`;
  }

  drawCharts();
}

function drawCharts() {
  const records = Store.list("studyRecords");
  const colors = subjects();

  const subjectTotals = colors.map(subject => ({
    name: subject.name,
    color: subject.color || "#7c9cff",
    minutes: records
      .filter(r => r.subjectId === subject.id)
      .reduce((sum, r) => sum + (Number(r.minutes) || 0), 0)
  }));

  const legend = $("#subject-chart-legend");
  if (legend) {
    legend.replaceChildren();

    for (const subject of subjectTotals) {
      const row = document.createElement("p");
      row.className = "chart-legend-item";

      const dot = document.createElement("span");
      dot.textContent = "●";
      dot.style.color = subject.color;

      const text = document.createElement("span");
      text.textContent = `${subject.name}：${minutesText(subject.minutes)}`;

      row.append(dot, text);
      legend.append(row);
    }
  }

  drawDonut($("#subject-doughnut-chart"), subjectTotals);
  drawBar($("#daily-bar-chart"), dailyData(records));
  drawBar($("#weekly-bar-chart"), weeklyData(records));
  drawBar($("#monthly-bar-chart"), monthlyData(records));
}

function setupCanvas(canvas) {
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(200, Math.floor(rect.width || 320));
  const height = Math.max(140, Math.floor(rect.height || 180));
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  return { ctx, width, height };
}

function drawDonut(canvas, data) {
  const setup = setupCanvas(canvas);
  if (!setup) return;

  const { ctx, width, height } = setup;
  const total = data.reduce((sum, item) => sum + item.minutes, 0);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const thickness = Math.max(14, radius * 0.35);

  ctx.lineWidth = thickness;
  ctx.lineCap = "butt";

  if (!total) {
    ctx.beginPath();
    ctx.strokeStyle = "#26314c";
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    let angle = -Math.PI / 2;

    for (const item of data) {
      if (item.minutes <= 0) continue;

      const next = angle + item.minutes / total * Math.PI * 2;
      ctx.beginPath();
      ctx.strokeStyle = item.color;
      ctx.arc(cx, cy, radius, angle, next);
      ctx.stroke();
      angle = next;
    }
  }

  ctx.fillStyle = "#f4f6ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(minutesText(total), cx, cy);
}

function dailyData(records) {
  const result = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dateKey(d);
    result.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value: records.filter(r => r.date === key)
        .reduce((s, r) => s + (Number(r.minutes) || 0), 0)
    });
  }

  return result;
}

function weeklyData(records) {
  const result = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
    const from = dateKey(start);
    const to = dateKey(end);

    result.push({
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      value: records.filter(r => r.date >= from && r.date <= to)
        .reduce((s, r) => s + (Number(r.minutes) || 0), 0)
    });
  }

  return result;
}

function monthlyData(records) {
  const result = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

    result.push({
      label: `${d.getMonth() + 1}月`,
      value: records.filter(r => String(r.date).startsWith(prefix))
        .reduce((s, r) => s + (Number(r.minutes) || 0), 0)
    });
  }

  return result;
}

function drawBar(canvas, data) {
  const setup = setupCanvas(canvas);
  if (!setup) return;

  const { ctx, width, height } = setup;
  const max = Math.max(1, ...data.map(d => d.value));
  const left = 30;
  const right = 8;
  const top = 15;
  const bottom = 30;
  const chartHeight = height - top - bottom;
  const chartWidth = width - left - right;
  const gap = 7;
  const barWidth = Math.max(
    3,
    (chartWidth - gap * (data.length - 1)) / data.length
  );

  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#aebbd8";
  ctx.strokeStyle = "#26314c";
  ctx.lineWidth = 1;

  for (let i = 0; i < 4; i++) {
    const y = top + chartHeight * i / 3;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
  }

  data.forEach((item, index) => {
    const x = left + index * (barWidth + gap);
    const barHeight = item.value / max * chartHeight;
    const y = top + chartHeight - barHeight;

    ctx.fillStyle = "#7c9cff";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#aebbd8";
    ctx.fillText(
      item.label,
      x + barWidth / 2,
      height - bottom + 7
    );
  });
}

/* =========================================================
   目標・習慣・マップ
   ========================================================= */

function addGoal() {
  openDialog("新しい目標", [
    { name: "title", label: "目標名", required: true },
    { name: "date", label: "目標日", type: "date" },
    { name: "note", label: "メモ", type: "textarea" }
  ], values => {
    Store.add("goals.goals", {
      title: values.title.trim(),
      date: values.date,
      note: values.note.trim(),
      completed: false
    });
    renderAll();
    notify("目標を追加しました。");
  });
}

function addGoalNode() {
  openDialog("目標マップに追加", [
    { name: "title", label: "目標名", required: true },
    { name: "note", label: "達成条件", type: "textarea" }
  ], values => {
    Store.add("goals.nodes", {
      title: values.title.trim(),
      note: values.note.trim(),
      completed: false
    });
    renderAll();
    notify("目標マップに追加しました。");
  });
}

function addHabit() {
  openDialog("習慣を追加", [
    { name: "title", label: "習慣名", required: true }
  ], values => {
    Store.add("goals.habits", {
      title: values.title.trim(),
      completedDates: []
    });
    renderAll();
    notify("習慣を追加しました。");
  });
}

function renderGoals() {
  const goals = Store.list("goals.goals");
  const nodes = Store.list("goals.nodes");
  const habits = Store.list("goals.habits");

  renderSimpleList("#goal-list", goals, "目標はまだありません。",
    (item, row) => {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(item.completed);
      checkbox.setAttribute("aria-label", `${item.title}を達成済みにする`);
      checkbox.addEventListener("change", () => {
        Store.replace("goals.goals", item.id, {
          completed: checkbox.checked
        });
        renderAll();
      });
      row.prepend(checkbox);
    },
    "goals.goals"
  );

  renderSimpleList("#goal-map-canvas", nodes, "目標マップはまだありません。",
    (item, row) => {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(item.completed);
      checkbox.setAttribute("aria-label", `${item.title}を達成済みにする`);
      checkbox.addEventListener("change", () => {
        Store.replace("goals.nodes", item.id, {
          completed: checkbox.checked
        });
        renderAll();
      });
      row.prepend(checkbox);
    },
    "goals.nodes"
  );

  renderSimpleList("#habit-list", habits, "習慣はまだありません。",
    (item, row) => {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = (item.completedDates || []).includes(today());
      checkbox.setAttribute("aria-label", `${item.title}を今日達成`);
      checkbox.addEventListener("change", () => {
        const dates = new Set(item.completedDates || []);
        if (checkbox.checked) dates.add(today());
        else dates.delete(today());

        Store.replace("goals.habits", item.id, {
          completedDates: [...dates]
        });
        renderAll();
      });
      row.prepend(checkbox);
    },
    "goals.habits"
  );

  const percent = nodes.length
    ? Math.round(nodes.filter(n => n.completed).length / nodes.length * 100)
    : 0;

  if ($("#goal-map-completion")) {
    $("#goal-map-completion").textContent = `${percent}%`;
  }
  if ($("#goal-map-progress")) {
    $("#goal-map-progress").style.width = `${percent}%`;
  }
}

function renderSimpleList(selector, items, emptyText, decorate, path) {
  const container = $(selector);
  if (!container) return;

  container.replaceChildren();

  if (!items.length) {
    container.textContent = emptyText;
    return;
  }

  for (const item of items) {
    const row = document.createElement("article");
    row.className = "list-row";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title || item.name || "項目";
    info.append(title);

    const noteText = item.note || item.date || "";
    if (noteText) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = noteText;
      info.append(note);
    }

    row.append(info);
    decorate?.(item, row);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      if (!confirm("この項目を削除しますか？")) return;
      Store.remove(path, item.id);
      renderAll();
    });

    row.append(remove);
    container.append(row);
  }
}

/* =========================================================
   ロケット
   ========================================================= */

function renderRocket() {
  const level = Number(Store.get("rocket.level", 1)) || 1;
  const exp = Number(Store.get("rocket.experience", 0)) || 0;
  const needed = level * 100;

  if ($("#rocket-level")) $("#rocket-level").textContent = `LEVEL ${level}`;
  if ($("#rocket-exp-label")) {
    $("#rocket-exp-label").textContent = `EXP ${exp} / ${needed}`;
  }
  if ($("#rocket-exp-progress")) {
    $("#rocket-exp-progress").style.width =
      `${Math.min(100, exp / Math.max(1, needed) * 100)}%`;
  }

  const missions = $("#mission-list");
  if (missions) {
    missions.replaceChildren();
    const list = [
      { id: "first-study", title: "最初の学習を記録", description: "学習記録を1件追加する" },
      { id: "study-30", title: "30分学習", description: "合計30分の学習を達成する" },
      { id: "study-120", title: "2時間学習", description: "合計120分の学習を達成する" }
    ];

    for (const mission of list) {
      const total = Store.list("studyRecords")
        .reduce((sum, r) => sum + (Number(r.minutes) || 0), 0);

      const done = mission.id === "first-study"
        ? Store.list("studyRecords").length > 0
        : mission.id === "study-30"
          ? total >= 30
          : total >= 120;

      const p = document.createElement("p");
      p.textContent = `${done ? "✓" : "○"} ${mission.title} — ${mission.description}`;
      missions.append(p);
    }
  }

  const parts = $("#rocket-parts-list");
  if (parts) {
    parts.textContent = Store.list("rocket.parts").length
      ? Store.list("rocket.parts").map(p => p.name || p.id).join("、")
      : "学習を積み重ねてパーツを集めよう。";
  }

  const exploration = $("#space-exploration-list");
  if (exploration) {
    exploration.textContent = Store.list("rocket.explored").length
      ? Store.list("rocket.explored").map(p => p.name || p.id).join("、")
      : "宇宙探索はこれから始まります。";
  }
}

/* =========================================================
   経済
   ========================================================= */

function money(value) {
  return `${Math.floor(Number(value) || 0).toLocaleString("ja-JP")} COSMO`;
}

function economyTransaction(type, amount, note = "") {
  amount = Math.floor(Number(amount));

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("金額は1以上の整数で入力してください。");
  }

  const balance = Number(Store.get("economy.balance", 0)) || 0;

  if (type === "withdraw" && balance < amount) {
    throw new Error("残高が不足しています。");
  }

  const next = type === "deposit"
    ? balance + amount
    : type === "withdraw"
      ? balance - amount
      : balance;

  Store.set("economy.balance", next);

  Store.add("economy.transactions", {
    type,
    amount,
    note,
    date: new Date().toISOString()
  });

  renderAll();
}

function openEconomyAction(type) {
  const config = {
    deposit: { title: "入金", label: "入金額", action: "deposit" },
    withdraw: { title: "出金", label: "出金額", action: "withdraw" },
    borrow: { title: "借入", label: "借入額", action: "borrow" }
  }[type];

  if (!config) return;

  openDialog(config.title, [
    {
      name: "amount",
      label: `${config.label}（COSMO）`,
      type: "number",
      min: 1,
      step: 1,
      required: true
    },
    { name: "note", label: "メモ", type: "textarea" }
  ], values => {
    const amount = Number(values.amount);

    if (type === "borrow") {
      const loans = Store.list("economy.loans");
      const loan = {
        id: Store.makeId("loan"),
        principal: amount,
        balance: amount,
        dailyRate: 0.05,
        createdAt: new Date().toISOString(),
        status: "active",
        note: values.note.trim()
      };

      Store.add("economy.loans", loan);
      Store.set("economy.balance",
        (Number(Store.get("economy.balance", 0)) || 0) + amount
      );
      Store.add("economy.transactions", {
        type: "borrow",
        amount,
        note: values.note.trim(),
        date: new Date().toISOString()
      });
      renderAll();
      notify("借入を記録しました。");
      return;
    }

    economyTransaction(type, amount, values.note.trim());
    notify(type === "deposit" ? "入金しました。" : "出金しました。");
  });
}

function renderEconomy() {
  const balance = Number(Store.get("economy.balance", 0)) || 0;
  const loans = Store.list("economy.loans")
    .filter(loan => loan.status === "active");
  const debt = loans.reduce(
    (sum, loan) => sum + (Number(loan.balance) || 0), 0
  );

  if ($("#economy-balance")) {
    $("#economy-balance").textContent = money(balance);
  }
  if ($("#economy-net-worth")) {
    $("#economy-net-worth").textContent =
      `借入残高 ${money(debt)} ／ 差引 ${money(balance - debt)}`;
  }

  renderSimpleList("#economy-loan-list", loans, "借入はありません。",
    (loan, row) => {
      const repay = document.createElement("button");
      repay.type = "button";
      repay.className = "secondary-button";
      repay.textContent = "返済";

      repay.addEventListener("click", () => {
        openDialog("借入を返済", [
          {
            name: "amount",
            label: `返済額（残高 ${money(loan.balance)}）`,
            type: "number",
            min: 1,
            max: loan.balance,
            step: 1,
            required: true
          }
        ], values => {
          const amount = Math.floor(Number(values.amount));
          const currentBalance =
            Number(Store.get("economy.balance", 0)) || 0;

          if (amount <= 0 || amount > loan.balance) {
            throw new Error("返済額を確認してください。");
          }
          if (amount > currentBalance) {
            throw new Error("残高が不足しています。");
          }

          Store.set("economy.balance", currentBalance - amount);
          Store.replace("economy.loans", loan.id, {
            balance: loan.balance - amount,
            status: loan.balance - amount === 0 ? "paid" : "active"
          });
          Store.add("economy.transactions", {
            type: "repay",
            amount,
            note: "借入返済",
            date: new Date().toISOString()
          });
          renderAll();
          notify("返済を記録しました。");
        });
      });

      row.append(repay);
    },
    "economy.loans"
  );

  const history = $("#economy-transaction-list");
  if (history) {
    history.replaceChildren();

    const transactions = Store.list("economy.transactions")
      .slice().reverse().slice(0, 50);

    if (!transactions.length) {
      history.textContent = "取引履歴はありません。";
    }

    for (const transaction of transactions) {
      const p = document.createElement("p");
      const label = ({
        deposit: "入金",
        withdraw: "出金",
        borrow: "借入",
        repay: "返済",
        interest: "利息"
      })[transaction.type] || transaction.type;

      p.textContent = `${label} ${money(transaction.amount)} — ${
        transaction.note || ""
      }`;
      history.append(p);
    }
  }
}

/* =========================================================
   カウントダウン
   ========================================================= */

function addCountdown() {
  openDialog("カウントダウンを追加", [
    { name: "title", label: "イベント名", required: true },
    { name: "date", label: "日付", type: "date", required: true },
    { name: "note", label: "メモ", type: "textarea" }
  ], values => {
    Store.add("countdowns", {
      title: values.title.trim(),
      date: values.date,
      note: values.note.trim()
    });
    renderAll();
    notify("カウントダウンを追加しました。");
  });
}

function renderCountdowns() {
  const container = $("#countdown-list");
  if (!container) return;

  container.replaceChildren();

  const items = Store.list("countdowns")
    .slice().sort((a, b) => a.date.localeCompare(b.date));

  if (!items.length) {
    container.textContent = "イベントはありません。";
    return;
  }

  for (const item of items) {
    const row = document.createElement("article");
    row.className = "list-row";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const detail = document.createElement("p");
    detail.className = "muted";

    const days = Math.ceil(
      (new Date(`${item.date}T00:00:00`) -
        new Date(`${today()}T00:00:00`)) / DAY
    );

    detail.textContent = days > 0
      ? `${formatDate(item.date)} — あと${days}日`
      : days === 0
        ? `${formatDate(item.date)} — 今日`
        : `${formatDate(item.date)} — ${Math.abs(days)}日前`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      if (!confirm("削除しますか？")) return;
      Store.remove("countdowns", item.id);
      renderAll();
    });

    row.append(title, detail, remove);
    container.append(row);
  }
}

/* =========================================================
   通知
   ========================================================= */

async function enableNotifications() {
  if (!("Notification" in window)) {
    notify("この環境ではブラウザ通知を利用できません。");
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      new Notification("One for All COSMOS", {
        body: "通知を有効にしました。"
      });
      Store.add("notifications", {
        title: "通知を有効化",
        date: new Date().toISOString()
      });
      notify("通知を有効にしました。");
    } else {
      notify("通知は許可されませんでした。端末の設定を確認してください。");
    }

    renderNotifications();
  } catch (error) {
    console.error(error);
    notify("通知を設定できませんでした。");
  }
}

function renderNotifications() {
  const container = $("#notification-list");
  if (!container) return;

  container.replaceChildren();

  const items = Store.list("notifications").slice().reverse();

  if (!items.length) {
    container.textContent = "通知履歴はありません。";
    return;
  }

  for (const item of items) {
    const p = document.createElement("p");
    p.textContent = `${item.title || "通知"} — ${item.date || ""}`;
    container.append(p);
  }
}

/* =========================================================
   設定・下部ショートカット
   ========================================================= */

function loadSettings() {
  const settings = Store.get("settings", {});

  if ($("#setting-daily-goal")) {
    $("#setting-daily-goal").value = settings.dailyGoal ?? 120;
  }
  if ($("#setting-weekly-goal")) {
    $("#setting-weekly-goal").value = settings.weeklyGoal ?? 840;
  }
  if ($("#setting-minimum-action")) {
    $("#setting-minimum-action").value = settings.minimumAction ?? 5;
  }
  if ($("#setting-animations")) {
    $("#setting-animations").checked = settings.animations !== false;
  }
  if ($("#setting-theme")) {
    $("#setting-theme").value = settings.theme || "cosmos";
  }

  const shortcuts = settings.shortcuts || [];

  $$('input[name="bottomShortcut"]').forEach(input => {
    input.checked = shortcuts.includes(input.value);
  });

  applyTheme(settings.theme || "cosmos");
  updateShortcuts(shortcuts);
}

function saveSettings(event) {
  event.preventDefault();

  const dailyGoal = Number($("#setting-daily-goal").value);
  const weeklyGoal = Number($("#setting-weekly-goal").value);
  const minimumAction = Number($("#setting-minimum-action").value);

  if (!Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 1440) {
    notify("1日の目標は1〜1440分で設定してください。");
    return;
  }
  if (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > 10080) {
    notify("週間目標は1〜10080分で設定してください。");
    return;
  }
  if (!Number.isInteger(minimumAction) ||
      minimumAction < 1 || minimumAction > 60) {
    notify("最小行動は1〜60分で設定してください。");
    return;
  }

  Store.set("settings", {
    ...Store.get("settings", {}),
    dailyGoal,
    weeklyGoal,
    minimumAction,
    animations: $("#setting-animations").checked,
    theme: $("#setting-theme").value
  });

  applyTheme($("#setting-theme").value);
  renderAll();
  notify("設定を保存しました。");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "cosmos";
  document.body.dataset.theme = theme || "cosmos";

  const animations = Store.get("settings.animations", true);
  document.documentElement.classList.toggle("no-animations", !animations);
}

function updateShortcuts(shortcuts) {
  const nav = $("#bottom-navigation");
  if (!nav) return;

  const selected = new Set(shortcuts || []);
  const buttons = $$("[data-shortcut]", nav);

  for (const button of buttons) {
    button.hidden = !selected.has(button.dataset.shortcut);
  }

  nav.hidden = selected.size === 0;
}

function saveShortcuts() {
  const shortcuts = $$('input[name="bottomShortcut"]:checked')
    .map(input => input.value);

  Store.set("settings.shortcuts", shortcuts);
  updateShortcuts(shortcuts);
  notify("ショートカットを保存しました。");
}

/* =========================================================
   共通アクション
   ========================================================= */

function handleAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;

  const action = button.dataset.action;

  const actions = {
    "start-study": () => {
      showView("study");
      startTimer();
    },
    "timer-start": startTimer,
    "timer-pause": pauseTimer,
    "timer-finish": finishTimer,
    "add-subject": addSubject,
    "add-study-item": addStudyItem,
    "add-event": addEvent,
    "calendar-prev": () => {
      calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      );
      renderCalendar();
    },
    "calendar-next": () => {
      calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      );
      renderCalendar();
    },
    "edit-timetable": () => {
      notify("時間割のセルをタップすると編集できます。");
    },
    "add-task": addTask,
    "add-goal": addGoal,
    "add-goal-map-node": addGoalNode,
    "add-habit": addHabit,
    "economy-deposit": () => openEconomyAction("deposit"),
    "economy-withdraw": () => openEconomyAction("withdraw"),
    "economy-borrow": () => openEconomyAction("borrow"),
    "add-countdown": addCountdown,
    "enable-notifications": enableNotifications,
    "close-message": () => {
      $("#cosmos-message").hidden = true;
    },
    "close-dialog": closeDialog,
    "open-menu": openMenu,
    "close-menu": closeMenu,
    "scroll-top": () => window.scrollTo({ top: 0, behavior: "smooth" }),
    "back": () => showView("home")
  };

  if (actions[action]) {
    event.preventDefault();
    safeRun(actions[action]);
  }
}

/* =========================================================
   全画面更新
   ========================================================= */

function renderAll() {
  populateSubjectSelects();
  renderTimer();
  renderSubjects();
  renderRecords();
  renderCalendar();
  renderTasks();
  renderTimetable();
  renderHome();
  renderStatistics();
  renderGoals();
  renderRocket();
  renderEconomy();
  renderCountdowns();
  renderNotifications();
}

function onStoreChange() {
  if (!document.hidden) renderAll();
}

/* =========================================================
   初期化
   ========================================================= */

function initUI() {
  if (document.documentElement.dataset.cosmosInitialized === "true") {
    return;
  }

  document.documentElement.dataset.cosmosInitialized = "true";

  $("#menu-open")?.addEventListener("click", openMenu);
  $("#menu-close")?.addEventListener("click", closeMenu);
  $("#menu-backdrop")?.addEventListener("click", closeMenu);

  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");

    if (viewButton) {
      event.preventDefault();
      showView(viewButton.dataset.view);
      return;
    }

    handleAction(event);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  $("#manual-study-form")?.addEventListener("submit", event => {
    safeRun(() => submitManualStudy(event));
  });

  $("#manual-study-subject")?.addEventListener("change", updateItemSelect);

  $("#settings-study-form")?.addEventListener("submit", event => {
    safeRun(() => saveSettings(event));
  });

  $("#setting-theme")?.addEventListener("change", event => {
    applyTheme(event.target.value);
  });

  $("#setting-animations")?.addEventListener("change", event => {
    document.documentElement.classList.toggle(
      "no-animations",
      !event.target.checked
    );
  });

  $("#shortcut-settings")?.addEventListener("change", saveShortcuts);

  $("#cosmos-dialog-confirm")?.addEventListener("click", submitDialog);

  $("#cosmos-dialog-form")?.addEventListener("submit", event => {
    if (event.submitter?.value === "cancel") {
      dialogSubmit = null;
      return;
    }

    if (dialogSubmit) {
      event.preventDefault();
      safeRun(submitDialog);
    }
  });

  $("#manual-study-date").value = today();

  loadSettings();
  restoreTimer();

  Store.on("change", onStoreChange);
  Store.on("add", onStoreChange);
  Store.on("remove", onStoreChange);
  Store.on("update", onStoreChange);
  Store.on("reset", onStoreChange);
  Store.on("import", onStoreChange);

  showView("home");
  renderAll();

  window.addEventListener("resize", () => {
    if (currentView === "statistics") drawCharts();
  });

  document.dispatchEvent(new CustomEvent("cosmos:ui-ready"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI, { once: true });
} else {
  initUI();
}

export {
  showView,
  openMenu,
  closeMenu,
  openDialog,
  closeDialog,
  showMessage,
  renderAll
};
