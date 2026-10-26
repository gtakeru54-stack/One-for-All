/* =========================================================
   ONE FOR ALL — COSMOS
   js/calendar.js
   カレンダー・予定・タスク
   ========================================================= */

"use strict";

import {
  STORAGE_KEYS,
  loadData,
  saveData,
  createId,
  toDateKey,
  getTodayKey,
  formatDateJP,
  addDays,
  escapeHTML
} from "./storage.js";

let calendarData = { events: [], tasks: [] };
let displayedDate = new Date();
let selectedDate = getTodayKey();

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
  window.dispatchEvent(new Event("cosmos:datachange"));
}

function getDateFromKey(key) {
  const parts = String(key).split("-").map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return new Date();
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dateMatches(item, key) {
  return item.date === key || item.dateKey === key;
}

function getMonthTitle(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function renderMonthLabel() {
  const targets = [
    "#calendar-month-label",
    "#calendar-title",
    "#current-month",
    "[data-calendar-month]"
  ];

  targets.forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = getMonthTitle(displayedDate);
  });
}

function renderCalendarGrid() {
  const grid = document.querySelector("#calendar-grid");
  if (!grid) return;

  grid.replaceChildren();

  const year = displayedDate.getFullYear();
  const month = displayedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = getTodayKey();

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day calendar-day-empty";
    empty.setAttribute("aria-hidden", "true");
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);
    button.dataset.date = key;

    if (key === today) button.classList.add("today");
    if (key === selectedDate) button.classList.add("selected");

    const hasEvent = calendarData.events.some((item) => dateMatches(item, key));
    const hasTask = calendarData.tasks.some((item) => dateMatches(item, key));

    if (hasEvent) button.classList.add("has-event");
    if (hasTask) button.classList.add("has-task");

    button.setAttribute("aria-label", formatDateJP(date));

    button.addEventListener("click", () => {
      selectedDate = key;
      renderCalendarGrid();
      renderDayItems();
    });

    grid.appendChild(button);
  }
}

function renderDayItems() {
  const dateHeading = document.querySelector("#selected-date-label");
  if (dateHeading) {
    dateHeading.textContent = formatDateJP(getDateFromKey(selectedDate));
  }

  const eventsContainer = document.querySelector("#day-items");
  const tasksContainer = document.querySelector("#task-list");

  const events = calendarData.events.filter((item) =>
    dateMatches(item, selectedDate)
  );

  const tasks = calendarData.tasks.filter((item) =>
    dateMatches(item, selectedDate)
  );

  if (eventsContainer) {
    eventsContainer.replaceChildren();

    if (!events.length) {
      eventsContainer.innerHTML = '<p class="empty-state">予定はありません</p>';
    } else {
      events.forEach((event) => {
        const item = document.createElement("article");
        item.className = "calendar-list-item";
        item.innerHTML = `
          <div class="calendar-item-main">
            <strong>${escapeHTML(event.title || "名称未設定")}</strong>
            <span>${escapeHTML(event.time || "")}</span>
            <p>${escapeHTML(event.description || "")}</p>
          </div>
          <button type="button" class="delete-button"
            data-delete-event="${escapeHTML(event.id)}">削除</button>
        `;
        eventsContainer.appendChild(item);
      });
    }
  }

  if (tasksContainer) {
    tasksContainer.replaceChildren();

    if (!tasks.length) {
      tasksContainer.innerHTML = '<p class="empty-state">タスクはありません</p>';
    } else {
      tasks.forEach((task) => {
        const item = document.createElement("label");
        item.className = "task-list-item";
        item.innerHTML = `
          <input type="checkbox" data-toggle-task="${escapeHTML(task.id)}"
            ${task.completed ? "checked" : ""}>
          <span class="${task.completed ? "completed" : ""}">
            ${escapeHTML(task.title || "名称未設定")}
          </span>
          <button type="button" class="delete-button"
            data-delete-task="${escapeHTML(task.id)}">削除</button>
        `;
        tasksContainer.appendChild(item);
      });
    }
  }
}

function renderCalendar() {
  renderMonthLabel();
  renderCalendarGrid();
  renderDayItems();
}

function moveMonth(amount) {
  displayedDate = new Date(
    displayedDate.getFullYear(),
    displayedDate.getMonth() + amount,
    1
  );
  renderCalendar();
}

function bindMonthButtons() {
  const previousSelectors = [
    "#calendar-prev",
    "#prev-month",
    "[data-calendar-prev]"
  ];

  const nextSelectors = [
    "#calendar-next",
    "#next-month",
    "[data-calendar-next]"
  ];

  previousSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((button) => {
      button.addEventListener("click", () => moveMonth(-1));
    });
  });

  nextSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((button) => {
      button.addEventListener("click", () => moveMonth(1));
    });
  });

  document.querySelector("#calendar-today")?.addEventListener("click", () => {
    displayedDate = new Date();
    selectedDate = getTodayKey();
    renderCalendar();
  });
}

function bindCalendarForms() {
  const eventForm =
    document.querySelector("#event-form") ||
    document.querySelector("#schedule-form");

  eventForm?.addEventListener("submit", (event) => {
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
      form.querySelector('[name="time"]')?.value ||
      document.querySelector("#event-time")?.value ||
      "";

    const description =
      form.querySelector('[name="description"]')?.value?.trim() ||
      document.querySelector("#event-description")?.value?.trim() ||
      "";

    calendarData.events.push({
      id: createId("event"),
      title,
      date,
      time,
      description,
      createdAt: new Date().toISOString()
    });

    selectedDate = date;
    displayedDate = getDateFromKey(date);
    persistCalendar();
    renderCalendar();
    form.reset();

    const dialog = form.closest("dialog");
    if (dialog) dialog.close();
  });

  const taskForm = document.querySelector("#task-form");

  taskForm?.addEventListener("submit", (event) => {
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

    calendarData.tasks.push({
      id: createId("task"),
      title,
      date,
      completed: false,
      createdAt: new Date().toISOString()
    });

    selectedDate = date;
    displayedDate = getDateFromKey(date);
    persistCalendar();
    renderCalendar();
    form.reset();

    const dialog = form.closest("dialog");
    if (dialog) dialog.close();
  });

  document.addEventListener("click", (event) => {
    const deleteEventButton = event.target.closest("[data-delete-event]");

    if (deleteEventButton) {
      const id = deleteEventButton.dataset.deleteEvent;
      calendarData.events = calendarData.events.filter((item) => item.id !== id);
      persistCalendar();
      renderCalendar();
      return;
    }

    const deleteTaskButton = event.target.closest("[data-delete-task]");

    if (deleteTaskButton) {
      const id = deleteTaskButton.dataset.deleteTask;
      calendarData.tasks = calendarData.tasks.filter((item) => item.id !== id);
      persistCalendar();
      renderCalendar();
    }
  });

  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-toggle-task]");
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

export function getCalendarData() {
  return calendarData;
}

export function initCalendar() {
  calendarData = normalizeCalendarData(
    loadData(STORAGE_KEYS.calendar, { events: [], tasks: [] })
  );

  selectedDate = getTodayKey();
  displayedDate = new Date();

  bindMonthButtons();
  bindCalendarForms();
  renderCalendar();

  window.addEventListener("cosmos:viewchange", (event) => {
    if (event.detail?.view === "calendar") renderCalendar();
  });
}