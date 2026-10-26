/* =========================================================
ONE FOR ALL — COSMOS
js/calendar.js
カレンダー・予定・タスク・土日祝日カラー
========================================================= */

“use strict”;

import {
STORAGE_KEYS,
loadData,
saveData,
createId,
toDateKey,
getTodayKey,
formatDateJP,
escapeHTML
} from “./storage.js”;

let calendarData = { events: [], tasks: [] };
let displayedDate = new Date();
let selectedDate = getTodayKey();

/* ––––– データ ––––– */

function normalizeCalendarData(data) {
if (Array.isArray(data)) {
return { events: data, tasks: [] };
}

return {
events: Array.isArray(data?.events) ? data.events : [],
tasks: Array.isArray(data?.tasks) ? data.tasks : []
};
}

function persistCalendar() {
saveData(STORAGE_KEYS.calendar, calendarData);
window.dispatchEvent(new Event(“cosmos:datachange”));
}

function getDateFromKey(key) {
const parts = String(key).split(”-”).map(Number);

if (
parts.length !== 3 ||
parts.some(Number.isNaN)
) {
return new Date();
}

return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dateMatches(item, key) {
return item.date === key || item.dateKey === key;
}

function getMonthTitle(date) {
return ${date.getFullYear()}年${date.getMonth() + 1}月;
}

/* ––––– 日本の祝日 ––––– */

function nthWeekday(year, month, weekday, nth) {
const first = new Date(year, month - 1, 1);
const offset = (weekday - first.getDay() + 7) % 7;
return 1 + offset + (nth - 1) * 7;
}

function vernalEquinoxDay(year) {
return Math.floor(
20.8431 + 0.242194 * (year - 1980) -
Math.floor((year - 1980) / 4)
);
}

function autumnalEquinoxDay(year) {
return Math.floor(
23.2488 + 0.242194 * (year - 1980) -
Math.floor((year - 1980) / 4)
);
}

function getJapaneseHolidayDates(year) {
const holidays = new Set();

const add = (month, day) => {
holidays.add(
toDateKey(new Date(year, month - 1, day))
);
};

// 元日
add(1, 1);

// 成人の日
add(1, nthWeekday(year, 1, 1, 2));

// 建国記念の日
add(2, 11);

// 天皇誕生日
if (year >= 2020) add(2, 23);

// 春分の日
add(3, vernalEquinoxDay(year));

// 昭和の日
add(4, 29);

// 憲法記念日・みどりの日・こどもの日
add(5, 3);
add(5, 4);
add(5, 5);

// 海の日
if (year >= 2003) {
add(7, nthWeekday(year, 7, 1, 3));
} else if (year >= 1996) {
add(7, 20);
}

// 山の日
if (year >= 2016) add(8, 11);

// 敬老の日
if (year >= 2003) {
add(9, nthWeekday(year, 9, 1, 3));
} else if (year >= 1966) {
add(9, 15);
}

// 秋分の日
add(9, autumnalEquinoxDay(year));

// スポーツの日
if (year >= 2022) {
add(10, nthWeekday(year, 10, 1, 2));
} else if (year >= 2000) {
add(10, nthWeekday(year, 10, 1, 2));
} else if (year >= 1966) {
add(10, 10);
}

// 文化の日・勤労感謝の日
add(11, 3);
add(11, 23);

// 祝日法による特例
const specialHolidays = {
2019: [
“2019-04-30”,
“2019-05-01”,
“2019-05-02”,
“2019-10-22”
],
2020: [
“2020-07-23”,
“2020-07-24”,
“2020-08-10”
],
2021: [
“2021-07-22”,
“2021-07-23”,
“2021-08-08”,
“2021-08-09”
]
};

(specialHolidays[year] || []).forEach((key) => {
holidays.add(key);
});

// 日曜日に重なった祝日の振替休日
const initialDates = […holidays];

for (const key of initialDates) {
const date = getDateFromKey(key);

if (date.getDay() !== 0) continue;
const substitute = new Date(date);
do {
  substitute.setDate(substitute.getDate() + 1);
} while (
  holidays.has(toDateKey(substitute))
);
holidays.add(toDateKey(substitute));

}

// 祝日と祝日に挟まれた平日を休日にする
for (let month = 1; month <= 12; month++) {
const daysInMonth = new Date(year, month, 0).getDate();

for (let day = 2; day < daysInMonth; day++) {
  const current = new Date(year, month - 1, day);
  if (current.getDay() === 0) continue;
  const previous = toDateKey(
    new Date(year, month - 1, day - 1)
  );
  const next = toDateKey(
    new Date(year, month - 1, day + 1)
  );
  const currentKey = toDateKey(current);
  if (
    holidays.has(previous) &&
    holidays.has(next) &&
    !holidays.has(currentKey)
  ) {
    holidays.add(currentKey);
  }
}

}

return holidays;
}

/* ––––– カレンダー表示 ––––– */

function renderMonthLabel() {
const title = getMonthTitle(displayedDate);

[
“#month-title”,
“#calendar-month-label”,
“#calendar-title”,
“#current-month”,
“[data-calendar-month]”
].forEach((selector) => {
document.querySelectorAll(selector).forEach((element) => {
element.textContent = title;
});
});
}

function renderCalendarGrid() {
const grid = document.querySelector(”#calendar-grid”);
if (!grid) return;

grid.replaceChildren();

const year = displayedDate.getFullYear();
const month = displayedDate.getMonth();
const firstDay = new Date(year, month, 1);
const startOffset = firstDay.getDay();
const daysInMonth = new Date(year, month + 1, 0).getDate();
const today = getTodayKey();
const holidays = getJapaneseHolidayDates(year);

// 月初までの空白
for (let i = 0; i < startOffset; i++) {
const empty = document.createElement(“div”);
empty.className = “calendar-day calendar-day-empty”;
empty.setAttribute(“aria-hidden”, “true”);
grid.appendChild(empty);
}

for (let day = 1; day <= daysInMonth; day++) {
const date = new Date(year, month, day);
const key = toDateKey(date);
const weekday = date.getDay();

const button = document.createElement("button");
button.type = "button";
button.className = "calendar-day";
button.textContent = String(day);
button.dataset.date = key;
if (weekday === 0) {
  button.classList.add("sunday");
}
if (weekday === 6) {
  button.classList.add("saturday");
}
if (holidays.has(key)) {
  button.classList.add("holiday");
  button.setAttribute("data-holiday", "true");
}
if (key === today) {
  button.classList.add("today");
}
if (key === selectedDate) {
  button.classList.add("selected");
}
const hasEvent = calendarData.events.some(
  (item) => dateMatches(item, key)
);
const hasTask = calendarData.tasks.some(
  (item) => dateMatches(item, key)
);
if (hasEvent) button.classList.add("has-event");
if (hasTask) button.classList.add("has-task");
button.setAttribute(
  "aria-label",
  `${formatDateJP(date)}${holidays.has(key) ? " 祝日" : ""}`
);
button.addEventListener("click", () => {
  selectedDate = key;
  renderCalendar();
});
grid.appendChild(button);

}
}

function renderDayItems() {
const heading =
document.querySelector(”#selected-date-title”) ||
document.querySelector(”#selected-date-label”);

if (heading) {
heading.textContent = formatDateJP(
getDateFromKey(selectedDate)
);
}

const eventsContainer = document.querySelector(”#day-items”);
const tasksContainer = document.querySelector(”#task-list”);

const events = calendarData.events.filter(
(item) => dateMatches(item, selectedDate)
);

const tasks = calendarData.tasks.filter(
(item) => dateMatches(item, selectedDate)
);

if (eventsContainer) {
eventsContainer.replaceChildren();

if (!events.length) {
  eventsContainer.innerHTML =
    '<p class="empty-state">予定はありません</p>';
} else {
  events.forEach((item) => {
    const row = document.createElement("article");
    row.className = "calendar-list-item";
    const title = document.createElement("strong");
    title.textContent = item.title || "名称未設定";
    const time = document.createElement("span");
    time.textContent = item.time || "";
    const description = document.createElement("p");
    description.textContent =
      item.description || item.notes || "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.textContent = "削除";
    remove.dataset.deleteEvent = item.id || "";
    row.append(title, time, description, remove);
    eventsContainer.appendChild(row);
  });
}

}

if (tasksContainer) {
tasksContainer.replaceChildren();

if (!tasks.length) {
  tasksContainer.innerHTML =
    '<p class="empty-state">タスクはありません</p>';
} else {
  tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "task-list-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.dataset.toggleTask = task.id || "";
    checkbox.setAttribute(
      "aria-label",
      `${task.title || "タスク"}の完了`
    );
    const title = document.createElement("span");
    title.textContent = task.title || "名称未設定";
    if (task.completed) {
      title.classList.add("completed");
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.textContent = "削除";
    remove.dataset.deleteTask = task.id || "";
    row.append(checkbox, title, remove);
    tasksContainer.appendChild(row);
  });
}

}
}

function renderCalendar() {
renderMonthLabel();
renderCalendarGrid();
renderDayItems();
}

/* ––––– 月の切り替え ––––– */

function moveMonth(amount) {
displayedDate = new Date(
displayedDate.getFullYear(),
displayedDate.getMonth() + amount,
1
);

renderCalendar();
}

function bindMonthButtons() {
[
“#prev-month”,
“#calendar-prev”,
“[data-calendar-prev]”
].forEach((selector) => {
document.querySelectorAll(selector).forEach((button) => {
button.addEventListener(“click”, () => moveMonth(-1));
});
});

[
“#next-month”,
“#calendar-next”,
“[data-calendar-next]”
].forEach((selector) => {
document.querySelectorAll(selector).forEach((button) => {
button.addEventListener(“click”, () => moveMonth(1));
});
});

[
“#today-button”,
“#calendar-today”
].forEach((selector) => {
document.querySelectorAll(selector).forEach((button) => {
button.addEventListener(“click”, () => {
displayedDate = new Date();
selectedDate = getTodayKey();
renderCalendar();
});
});
});
}

/* ––––– 予定・タスクの追加 ––––– */

function openDialog(form) {
const dialog = form?.closest(“dialog”);
if (!dialog) return;

if (!dialog.open) {
dialog.showModal();
}
}

function bindCalendarForms() {
const eventForm =
document.querySelector(”#event-form”) ||
document.querySelector(”#schedule-form”);

eventForm?.addEventListener(“submit”, (event) => {
event.preventDefault();

const form = event.currentTarget;
const title =
  form.querySelector('[name="title"]')?.value?.trim() ||
  document.querySelector("#event-title")?.value?.trim();
if (!title) return;
const date =
  form.querySelector('[name="date"]')?.value ||
  document.querySelector("#event-date")?.value ||
  selectedDate;
const time =
  form.querySelector('[name="start"]')?.value ||
  form.querySelector('[name="time"]')?.value ||
  document.querySelector("#event-start")?.value ||
  document.querySelector("#event-time")?.value ||
  "";
const description =
  form.querySelector('[name="notes"]')?.value?.trim() ||
  form.querySelector('[name="description"]')?.value?.trim() ||
  document.querySelector("#event-notes")?.value?.trim() ||
  document.querySelector("#event-description")?.value?.trim() ||
  "";
const idInput = document.querySelector("#event-id");
const editingId = idInput?.value || "";
if (editingId) {
  const existing = calendarData.events.find(
    (item) => item.id === editingId
  );
  if (existing) {
    existing.title = title;
    existing.date = date;
    existing.time = time;
    existing.description = description;
  }
} else {
  calendarData.events.push({
    id: createId("event"),
    title,
    date,
    time,
    description,
    createdAt: new Date().toISOString()
  });
}
selectedDate = date;
displayedDate = getDateFromKey(date);
persistCalendar();
renderCalendar();
form.reset();
if (idInput) idInput.value = "";
const dialog = form.closest("dialog");
if (dialog?.open) dialog.close();

});

const taskForm = document.querySelector(”#task-form”);

taskForm?.addEventListener(“submit”, (event) => {
event.preventDefault();

const form = event.currentTarget;
const title =
  form.querySelector('[name="title"]')?.value?.trim() ||
  document.querySelector("#task-title")?.value?.trim();
if (!title) return;
const date =
  form.querySelector('[name="date"]')?.value ||
  document.querySelector("#task-date")?.value ||
  selectedDate;
const notes =
  form.querySelector('[name="notes"]')?.value?.trim() ||
  document.querySelector("#task-notes")?.value?.trim() ||
  "";
calendarData.tasks.push({
  id: createId("task"),
  title,
  date,
  notes,
  completed: false,
  createdAt: new Date().toISOString()
});
selectedDate = date;
displayedDate = getDateFromKey(date);
persistCalendar();
renderCalendar();
form.reset();
const dialog = form.closest("dialog");
if (dialog?.open) dialog.close();

});

// HTML内の追加ボタンからダイアログを開く
document.querySelector(”#add-event-day”)?.addEventListener(
“click”,
() => {
const dateInput = document.querySelector(”#event-date”);
if (dateInput) dateInput.value = selectedDate;

  const idInput = document.querySelector("#event-id");
  if (idInput) idInput.value = "";
  if (eventForm) eventForm.reset();
  if (dateInput) dateInput.value = selectedDate;
  openDialog(eventForm);
}

);

document.querySelector(”#add-task-button”)?.addEventListener(
“click”,
() => {
const dateInput = document.querySelector(”#task-date”);
if (dateInput) dateInput.value = selectedDate;

  if (taskForm) taskForm.reset();
  if (dateInput) dateInput.value = selectedDate;
  openDialog(taskForm);
}

);

document.addEventListener(“click”, (event) => {
const target = event.target;
if (!(target instanceof Element)) return;

const deleteEventButton =
  target.closest("[data-delete-event]");
if (deleteEventButton) {
  const id = deleteEventButton.dataset.deleteEvent;
  calendarData.events = calendarData.events.filter(
    (item) => item.id !== id
  );
  persistCalendar();
  renderCalendar();
  return;
}
const deleteTaskButton =
  target.closest("[data-delete-task]");
if (deleteTaskButton) {
  const id = deleteTaskButton.dataset.deleteTask;
  calendarData.tasks = calendarData.tasks.filter(
    (item) => item.id !== id
  );
  persistCalendar();
  renderCalendar();
}

});

document.addEventListener(“change”, (event) => {
const target = event.target;
if (!(target instanceof Element)) return;

const checkbox = target.closest("[data-toggle-task]");
if (!checkbox) return;
const task = calendarData.tasks.find(
  (item) => item.id === checkbox.dataset.toggleTask
);
if (task) {
  task.completed = checkbox.checked;
  persistCalendar();
  renderCalendar();
}

});
}

/* ––––– 初期化 ––––– */

export function getCalendarData() {
return calendarData;
}

export function initCalendar() {
calendarData = normalizeCalendarData(
loadData(STORAGE_KEYS.calendar, {
events: [],
tasks: []
})
);

selectedDate = getTodayKey();
displayedDate = new Date();

bindMonthButtons();
bindCalendarForms();
renderCalendar();

window.addEventListener(“cosmos:viewchange”, (event) => {
if (event.detail?.view === “calendar”) {
renderCalendar();
}
});
}