/* =========================================================
   ALGOL — STUDY CONSTELLATION
   js/calendar.js

   カレンダー・予定・タスク管理

   役割:
   - 月表示・日付選択
   - 予定管理
   - 終日予定・時間指定予定
   - カテゴリー・色分け
   - タスク管理
   - 日別・週別予定取得

   保存処理は store.js に統一する。
   ========================================================= */

import {
  loadData,
  saveData
} from "./store.js";

/* =========================================================
   01. CONSTANTS
   ========================================================= */

const CALENDAR_KEY = "calendar";
const TASK_KEY = "tasks";

export const CALENDAR_CATEGORIES = Object.freeze([
  {
    id: "study",
    name: "勉強",
    color: "#91aaff"
  },
  {
    id: "school",
    name: "学校",
    color: "#72e1ed"
  },
  {
    id: "club",
    name: "部活",
    color: "#7fe0b2"
  },
  {
    id: "personal",
    name: "プライベート",
    color: "#ed9ed4"
  },
  {
    id: "exam",
    name: "試験・締切",
    color: "#ff929e"
  },
  {
    id: "other",
    name: "その他",
    color: "#b49aff"
  }
]);

/* =========================================================
   02. UTILITIES
   ========================================================= */

function createId(prefix = "calendar") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function nowISO() {
  return new Date().toISOString();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    throw new Error("日付が正しくありません。");
  }

  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate())
  ].join("-");
}

function parseDateKey(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new Error("日付の形式が正しくありません。");
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("存在しない日付です。");
  }

  return date;
}

function validateTime(value, label) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const time = String(value);

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`${label}の形式が正しくありません。`);
  }

  return time;
}

function assertTitle(value, label = "タイトル") {
  const title = normalizeText(value);

  if (!title) {
    throw new Error(`${label}を入力してください。`);
  }

  return title;
}

/* =========================================================
   03. DATA ACCESS
   ========================================================= */

function getEvents() {
  const data = loadData(CALENDAR_KEY, []);

  return Array.isArray(data) ? data : [];
}

function getTasks() {
  const data = loadData(TASK_KEY, []);

  return Array.isArray(data) ? data : [];
}

function saveEvents(events) {
  saveData(CALENDAR_KEY, events);
}

function saveTasks(tasks) {
  saveData(TASK_KEY, tasks);
}

/* =========================================================
   04. CATEGORY
   ========================================================= */

export function getCalendarCategories() {
  return clone(CALENDAR_CATEGORIES);
}

export function getCalendarCategory(categoryId) {
  return (
    CALENDAR_CATEGORIES.find(
      category => category.id === categoryId
    ) || CALENDAR_CATEGORIES.find(
      category => category.id === "other"
    )
  );
}

/* =========================================================
   05. EVENT CREATION
   ========================================================= */

function normalizeEvent(options = {}) {
  const title = assertTitle(options.title, "予定名");

  const date = toDateKey(
    parseDateKey(options.date)
  );

  const allDay = Boolean(options.allDay);

  const startTime = allDay
    ? null
    : validateTime(options.startTime, "開始時刻");

  const endTime = allDay
    ? null
    : validateTime(options.endTime, "終了時刻");

  if (
    startTime &&
    endTime &&
    endTime <= startTime
  ) {
    throw new Error(
      "終了時刻は開始時刻より後にしてください。"
    );
  }

  const categoryId =
    options.categoryId || "other";

  const category = getCalendarCategory(categoryId);

  return {
    title,
    date,
    allDay,
    startTime,
    endTime,
    categoryId: category.id,
    color: options.color || category.color,
    description: normalizeText(options.description),
    location: normalizeText(options.location),
    reminderMinutes:
      options.reminderMinutes === null ||
      options.reminderMinutes === undefined
        ? null
        : Math.max(
            0,
            Math.floor(Number(options.reminderMinutes) || 0)
          ),
    repeat: options.repeat || "none"
  };
}

/* =========================================================
   06. ADD EVENT
   ========================================================= */

export function addCalendarEvent(options = {}) {
  const eventData = normalizeEvent(options);

  const events = getEvents();

  const event = {
    id: createId("event"),
    ...eventData,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  events.push(event);

  saveEvents(events);

  return clone(event);
}

/* =========================================================
   07. GET EVENTS
   ========================================================= */

export function getAllCalendarEvents() {
  return clone(getEvents());
}

export function getCalendarEvent(eventId) {
  return (
    getEvents().find(
      event => event.id === eventId
    ) || null
  );
}

export function getEventsByDate(date) {
  const dateKey = toDateKey(
    parseDateKey(date)
  );

  return clone(
    getEvents()
      .filter(event => event.date === dateKey)
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;

        return String(a.startTime || "").localeCompare(
          String(b.startTime || "")
        );
      })
  );
}

/* =========================================================
   08. UPDATE EVENT
   ========================================================= */

export function updateCalendarEvent(eventId, changes = {}) {
  const events = getEvents();

  const index = events.findIndex(
    event => event.id === eventId
  );

  if (index === -1) {
    throw new Error("予定が見つかりません。");
  }

  const current = events[index];

  const updated = normalizeEvent({
    ...current,
    ...changes
  });

  events[index] = {
    ...current,
    ...updated,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nowISO()
  };

  saveEvents(events);

  return clone(events[index]);
}

/* =========================================================
   09. DELETE EVENT
   ========================================================= */

export function deleteCalendarEvent(eventId) {
  const events = getEvents();

  const exists = events.some(
    event => event.id === eventId
  );

  if (!exists) {
    return false;
  }

  saveEvents(
    events.filter(
      event => event.id !== eventId
    )
  );

  return true;
}

/* =========================================================
   10. MONTH DATA
   ========================================================= */

export function getMonthCalendar(year, month) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 0 ||
    month > 11
  ) {
    throw new Error("年月の指定が正しくありません。");
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDate = new Date(
    year,
    month,
    1 - firstDay.getDay()
  );

  const endDate = new Date(
    year,
    month,
    lastDay.getDate() + (6 - lastDay.getDay())
  );

  const events = getEvents();
  const tasks = getTasks();

  const days = [];

  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const date = toDateKey(cursor);

    days.push({
      date,
      day: cursor.getDate(),
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      isCurrentMonth:
        cursor.getFullYear() === year &&
        cursor.getMonth() === month,
      isToday: date === toDateKey(new Date()),
      events: clone(
        events.filter(event => event.date === date)
      ),
      tasks: clone(
        tasks.filter(
          task => task.date === date
        )
      )
    });

    cursor.setDate(
      cursor.getDate() + 1
    );
  }

  return {
    year,
    month,
    monthLabel: `${year}年${month + 1}月`,
    days
  };
}

/* =========================================================
   11. WEEK DATA
   ========================================================= */

export function getWeekCalendar(date = new Date()) {
  const target = new Date(date);

  if (Number.isNaN(target.getTime())) {
    throw new Error("日付が正しくありません。");
  }

  const start = new Date(target);

  start.setHours(0, 0, 0, 0);
  start.setDate(
    start.getDate() - start.getDay()
  );

  const result = [];

  for (let i = 0; i < 7; i++) {
    const current = new Date(start);

    current.setDate(
      start.getDate() + i
    );

    const dateKey = toDateKey(current);

    result.push({
      date: dateKey,
      day: current.getDate(),
      weekday: current.getDay(),
      events: getEventsByDate(dateKey),
      tasks: getTasksByDate(dateKey)
    });
  }

  return result;
}

/* =========================================================
   12. TODAY EVENTS
   ========================================================= */

export function getTodayEvents() {
  return getEventsByDate(
    toDateKey(new Date())
  );
}

/* =========================================================
   13. UPCOMING EVENTS
   ========================================================= */

export function getUpcomingEvents(limit = 10) {
  const today = toDateKey(new Date());

  const safeLimit = Math.max(
    0,
    Math.floor(Number(limit) || 0)
  );

  return clone(
    getEvents()
      .filter(event => event.date >= today)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return String(a.startTime || "").localeCompare(
          String(b.startTime || "")
        );
      })
      .slice(0, safeLimit)
  );
}

/* =========================================================
   14. TASK CREATION
   ========================================================= */

function normalizeTask(options = {}) {
  const title = assertTitle(options.title, "タスク名");

  const date = options.date
    ? toDateKey(parseDateKey(options.date))
    : toDateKey(new Date());

  const priority = [
    "low",
    "normal",
    "high"
  ].includes(options.priority)
    ? options.priority
    : "normal";

  return {
    title,
    date,
    description: normalizeText(options.description),
    priority,
    categoryId: options.categoryId || "other",
    completed: Boolean(options.completed)
  };
}

/* =========================================================
   15. ADD TASK
   ========================================================= */

export function addCalendarTask(options = {}) {
  const taskData = normalizeTask(options);

  const tasks = getTasks();

  const task = {
    id: createId("task"),
    ...taskData,
    completedAt: taskData.completed ? nowISO() : null,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  tasks.push(task);

  saveTasks(tasks);

  return clone(task);
}

/* =========================================================
   16. GET TASKS
   ========================================================= */

export function getAllCalendarTasks() {
  return clone(getTasks());
}

export function getCalendarTask(taskId) {
  return (
    getTasks().find(
      task => task.id === taskId
    ) || null
  );
}

export function getTasksByDate(date) {
  const dateKey = toDateKey(
    parseDateKey(date)
  );

  return clone(
    getTasks()
      .filter(task => task.date === dateKey)
      .sort((a, b) => {
        const priority = {
          high: 0,
          normal: 1,
          low: 2
        };

        return (
          priority[a.priority] -
          priority[b.priority]
        );
      })
  );
}

/* =========================================================
   17. UPDATE TASK
   ========================================================= */

export function updateCalendarTask(taskId, changes = {}) {
  const tasks = getTasks();

  const index = tasks.findIndex(
    task => task.id === taskId
  );

  if (index === -1) {
    throw new Error("タスクが見つかりません。");
  }

  const current = tasks[index];

  const updated = normalizeTask({
    ...current,
    ...changes
  });

  const completedAt =
    updated.completed
      ? current.completedAt || nowISO()
      : null;

  tasks[index] = {
    ...current,
    ...updated,
    id: current.id,
    completedAt,
    createdAt: current.createdAt,
    updatedAt: nowISO()
  };

  saveTasks(tasks);

  return clone(tasks[index]);
}

/* =========================================================
   18. TASK COMPLETION
   ========================================================= */

export function toggleCalendarTask(taskId) {
  const task = getCalendarTask(taskId);

  if (!task) {
    throw new Error("タスクが見つかりません。");
  }

  return updateCalendarTask(taskId, {
    completed: !task.completed
  });
}

/* =========================================================
   19. DELETE TASK
   ========================================================= */

export function deleteCalendarTask(taskId) {
  const tasks = getTasks();

  const exists = tasks.some(
    task => task.id === taskId
  );

  if (!exists) {
    return false;
  }

  saveTasks(
    tasks.filter(
      task => task.id !== taskId
    )
  );

  return true;
}

/* =========================================================
   20. TASK FILTERS
   ========================================================= */

export function getIncompleteTasks() {
  return clone(
    getTasks().filter(
      task => !task.completed
    )
  );
}

export function getCompletedTasks() {
  return clone(
    getTasks().filter(
      task => task.completed
    )
  );
}

export function getTodayTasks() {
  return getTasksByDate(
    toDateKey(new Date())
  );
}

/* =========================================================
   21. UPCOMING TASKS
   ========================================================= */

export function getUpcomingTasks(limit = 10) {
  const today = toDateKey(new Date());

  const safeLimit = Math.max(
    0,
    Math.floor(Number(limit) || 0)
  );

  return clone(
    getTasks()
      .filter(
        task =>
          !task.completed &&
          task.date >= today
      )
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);

        if (dateCompare !== 0) {
          return dateCompare;
        }

        const priority = {
          high: 0,
          normal: 1,
          low: 2
        };

        return (
          priority[a.priority] -
          priority[b.priority]
        );
      })
      .slice(0, safeLimit)
  );
}

/* =========================================================
   22. TASK SUMMARY
   ========================================================= */

export function getTaskSummary() {
  const tasks = getTasks();

  const completed = tasks.filter(
    task => task.completed
  ).length;

  const incomplete = tasks.length - completed;

  return {
    total: tasks.length,
    completed,
    incomplete,
    completionRate:
      tasks.length === 0
        ? 0
        : Math.round(
            (completed / tasks.length) * 100
          )
  };
}

/* =========================================================
   23. EVENT SUMMARY
   ========================================================= */

export function getEventSummary(date = new Date()) {
  const dateKey = toDateKey(date);

  const events = getEventsByDate(dateKey);

  return {
    date: dateKey,
    total: events.length,
    allDay: events.filter(
      event => event.allDay
    ).length,
    timed: events.filter(
      event => !event.allDay
    ).length,
    events
  };
}

/* =========================================================
   24. EXPORT DEFAULT
   ========================================================= */

export default {
  getCalendarCategories,
  getCalendarCategory,

  addCalendarEvent,
  getAllCalendarEvents,
  getCalendarEvent,
  getEventsByDate,
  updateCalendarEvent,
  deleteCalendarEvent,

  getMonthCalendar,
  getWeekCalendar,
  getTodayEvents,
  getUpcomingEvents,

  addCalendarTask,
  getAllCalendarTasks,
  getCalendarTask,
  getTasksByDate,
  updateCalendarTask,
  toggleCalendarTask,
  deleteCalendarTask,

  getIncompleteTasks,
  getCompletedTasks,
  getTodayTasks,
  getUpcomingTasks,
  getTaskSummary,

  getEventSummary
};

/* =========================================================
   END OF ALGOL CALENDAR
   ========================================================= */