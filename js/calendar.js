
/* =========================================================
   ONE FOR ALL COSMOS
   js/calendar.js

   カレンダー管理システム
   ・月間カレンダー用の日付生成
   ・予定の追加 / 編集 / 削除
   ・タスクの追加 / 編集 / 削除
   ・完了状態の管理
   ・繰り返し予定
   ・予定の検索
   ・日付別の予定取得
   ・今日 / 今月の予定取得
   ・リマインダー対象の取得
   ・データの保存

   保存処理：既存の js/store.js を利用
   ========================================================= */

"use strict";

import { store } from "./store.js";

/* =========================================================
   1. 定数
   ========================================================= */

const MAX_EVENTS = 10000;

const EVENT_TYPES = Object.freeze({
  EVENT: "event",
  TASK: "task"
});

const REPEAT_TYPES = Object.freeze([
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly"
]);

/* =========================================================
   2. 共通関数
   ========================================================= */

function createId(prefix = "calendar") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 9)
  );
}

function todayKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function isValidDateKey(value) {
  return parseDateKey(value) !== null;
}

function normalizeTime(value) {
  if (value === "" || value == null) {
    return "";
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value));

  if (!match) {
    throw new Error("時刻は HH:MM の形式で入力してください。");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    throw new Error("正しい時刻を入力してください。");
  }

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0")
  );
}

function normalizeRepeat(value) {
  const repeat = String(value || "none");

  if (!REPEAT_TYPES.includes(repeat)) {
    throw new Error("繰り返しの設定が正しくありません。");
  }

  return repeat;
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  /*
   * 旧形式との互換性を考慮し、
   * date / title / time / note を維持する。
   */
  const date = String(event.date || "");

  if (!isValidDateKey(date)) {
    return null;
  }

  const type =
    event.type === EVENT_TYPES.TASK
      ? EVENT_TYPES.TASK
      : EVENT_TYPES.EVENT;

  return {
    ...event,
    id: String(event.id || createId("event")),
    type,
    title: String(event.title || "名称未設定"),
    date,
    time: safeNormalizeTime(event.time),
    note: String(event.note || ""),
    completed: Boolean(event.completed),
    category: String(event.category || "general"),
    color: String(event.color || ""),
    reminder: normalizeReminder(event.reminder),
    repeat: safeNormalizeRepeat(event.repeat),
    repeatUntil: isValidDateKey(event.repeatUntil)
      ? event.repeatUntil
      : "",
    createdAt: Number(event.createdAt) || Date.now(),
    updatedAt: Number(event.updatedAt) || Date.now()
  };
}

function safeNormalizeTime(value) {
  try {
    return normalizeTime(value);
  } catch {
    return "";
  }
}

function safeNormalizeRepeat(value) {
  try {
    return normalizeRepeat(value);
  } catch {
    return "none";
  }
}

function normalizeReminder(value) {
  if (value === true) {
    return {
      enabled: true,
      minutesBefore: 0
    };
  }

  if (!value || typeof value !== "object") {
    return {
      enabled: false,
      minutesBefore: 0
    };
  }

  const minutesBefore = Number(value.minutesBefore);

  return {
    enabled: Boolean(value.enabled),
    minutesBefore:
      Number.isFinite(minutesBefore) &&
      minutesBefore >= 0 &&
      minutesBefore <= 10080
        ? Math.floor(minutesBefore)
        : 0
  };
}

/* =========================================================
   3. データの読み込み・保存
   ========================================================= */

function loadCalendarData() {
  const raw = store.calendar.load({});

  /*
   * 旧形式が配列だった場合も読み込む。
   */
  if (Array.isArray(raw)) {
    return {
      version: 1,
      events: raw.map(normalizeEvent).filter(Boolean)
    };
  }

  if (!raw || typeof raw !== "object") {
    return {
      version: 1,
      events: []
    };
  }

  const source = Array.isArray(raw.events)
    ? raw.events
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  return {
    ...raw,
    version: 1,
    events: source
      .map(normalizeEvent)
      .filter(Boolean)
      .slice(-MAX_EVENTS)
  };
}

function saveCalendarData(data) {
  const success = store.calendar.save(data);

  if (!success) {
    throw new Error(
      "カレンダーのデータを保存できませんでした。"
    );
  }

  return true;
}

function mutateCalendarData(mutator) {
  const data = loadCalendarData();

  const result = mutator(data);

  if (result === false) {
    return false;
  }

  if (data.events.length > MAX_EVENTS) {
    data.events = data.events.slice(-MAX_EVENTS);
  }

  saveCalendarData(data);

  return result === undefined ? true : result;
}

/* =========================================================
   4. 予定・タスクの取得
   ========================================================= */

export function getAllEvents() {
  return loadCalendarData()
    .events
    .slice()
    .sort(compareEvents)
    .map(event => ({ ...event }));
}

function compareEvents(a, b) {
  const dateCompare = a.date.localeCompare(b.date);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  const timeA = a.time || "99:99";
  const timeB = b.time || "99:99";

  return timeA.localeCompare(timeB);
}

export function getEventById(eventId) {
  const event = loadCalendarData().events.find(
    item => item.id === String(eventId)
  );

  return event ? { ...event } : null;
}

export function getEventsByDate(date) {
  if (!isValidDateKey(date)) {
    throw new Error("日付の形式が正しくありません。");
  }

  return getAllEvents().filter(event => {
    return isEventOnDate(event, date);
  });
}

export function getEventsByMonth(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);

  return getAllEvents().filter(event => {
    return (
      event.date <= endKey &&
      getLastRepeatDate(event) >= startKey
    );
  });
}

export function getTodayEvents() {
  return getEventsByDate(todayKey());
}

export function getUpcomingEvents(limit = 20) {
  const today = todayKey();

  const events = getAllEvents().filter(event => {
    const lastDate = getLastRepeatDate(event);

    return lastDate >= today;
  });

  return events.slice(0, Math.max(0, Number(limit) || 20));
}

export function getTasks({
  completed,
  date
} = {}) {
  let tasks = getAllEvents().filter(
    event => event.type === EVENT_TYPES.TASK
  );

  if (typeof completed === "boolean") {
    tasks = tasks.filter(
      task => task.completed === completed
    );
  }

  if (date) {
    tasks = tasks.filter(
      task => isEventOnDate(task, date)
    );
  }

  return tasks;
}

/* =========================================================
   5. 予定・タスクの追加
   ========================================================= */

function createEvent(input, type) {
  if (!input || typeof input !== "object") {
    throw new Error("予定の情報を入力してください。");
  }

  const title = String(input.title || "").trim();
  const date = String(input.date || "");

  if (!title) {
    throw new Error("タイトルを入力してください。");
  }

  if (!isValidDateKey(date)) {
    throw new Error("正しい日付を入力してください。");
  }

  const time = normalizeTime(input.time);

  const repeat = normalizeRepeat(input.repeat);

  const repeatUntil = input.repeatUntil
    ? String(input.repeatUntil)
    : "";

  if (repeatUntil && !isValidDateKey(repeatUntil)) {
    throw new Error("繰り返し終了日が正しくありません。");
  }

  if (repeatUntil && repeatUntil < date) {
    throw new Error("繰り返し終了日は開始日以降にしてください。");
  }

  const timestamp = Date.now();

  const event = {
    id: createId(type),
    type,
    title,
    date,
    time,
    note: String(input.note || "").trim(),
    completed: Boolean(input.completed),
    category: String(input.category || "general"),
    color: String(input.color || ""),
    reminder: normalizeReminder(input.reminder),
    repeat,
    repeatUntil,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  mutateCalendarData(data => {
    data.events.push(event);
  });

  return { ...event };
}

export function addEvent(input) {
  return createEvent(input, EVENT_TYPES.EVENT);
}

export function addTask(input) {
  return createEvent(input, EVENT_TYPES.TASK);
}

/* =========================================================
   6. 予定・タスクの編集
   ========================================================= */

export function updateEvent(eventId, changes = {}) {
  let updatedEvent = null;

  mutateCalendarData(data => {
    const event = data.events.find(
      item => item.id === String(eventId)
    );

    if (!event) {
      throw new Error("予定が見つかりません。");
    }

    const next = {
      ...event,
      ...changes
    };

    const title = String(next.title || "").trim();
    const date = String(next.date || "");

    if (!title) {
      throw new Error("タイトルを入力してください。");
    }

    if (!isValidDateKey(date)) {
      throw new Error("正しい日付を入力してください。");
    }

    next.title = title;
    next.date = date;
    next.time = normalizeTime(next.time);
    next.note = String(next.note || "");
    next.category = String(next.category || "general");
    next.color = String(next.color || "");
    next.repeat = normalizeRepeat(next.repeat);
    next.reminder = normalizeReminder(next.reminder);

    if (next.repeatUntil) {
      next.repeatUntil = String(next.repeatUntil);

      if (
        !isValidDateKey(next.repeatUntil) ||
        next.repeatUntil < next.date
      ) {
        throw new Error("繰り返し終了日が正しくありません。");
      }
    } else {
      next.repeatUntil = "";
    }

    next.updatedAt = Date.now();

    Object.assign(event, next);

    updatedEvent = { ...event };
  });

  return updatedEvent;
}

export function updateTask(taskId, changes = {}) {
  const task = getEventById(taskId);

  if (!task || task.type !== EVENT_TYPES.TASK) {
    throw new Error("タスクが見つかりません。");
  }

  return updateEvent(taskId, changes);
}

/* =========================================================
   7. 完了状態
   ========================================================= */

export function setTaskCompleted(taskId, completed = true) {
  const task = getEventById(taskId);

  if (!task || task.type !== EVENT_TYPES.TASK) {
    throw new Error("タスクが見つかりません。");
  }

  return updateEvent(taskId, {
    completed: Boolean(completed)
  });
}

export function toggleTaskCompleted(taskId) {
  const task = getEventById(taskId);

  if (!task || task.type !== EVENT_TYPES.TASK) {
    throw new Error("タスクが見つかりません。");
  }

  return setTaskCompleted(taskId, !task.completed);
}

/* =========================================================
   8. 削除
   ========================================================= */

export function deleteEvent(eventId) {
  return mutateCalendarData(data => {
    const index = data.events.findIndex(
      event => event.id === String(eventId)
    );

    if (index === -1) {
      throw new Error("予定が見つかりません。");
    }

    data.events.splice(index, 1);
  });
}

export function deleteTask(taskId) {
  const task = getEventById(taskId);

  if (!task || task.type !== EVENT_TYPES.TASK) {
    throw new Error("タスクが見つかりません。");
  }

  return deleteEvent(taskId);
}

/* =========================================================
   9. 繰り返し予定
   ========================================================= */

function getLastRepeatDate(event) {
  if (event.repeat === "none") {
    return event.date;
  }

  if (event.repeatUntil) {
    return event.repeatUntil;
  }

  /*
   * 終了日が指定されていない繰り返し予定は、
   * 無期限扱いとして遠い将来まで有効にする。
   */
  return "9999-12-31";
}

function isEventOnDate(event, targetDate) {
  if (!isValidDateKey(targetDate)) {
    return false;
  }

  if (targetDate < event.date) {
    return false;
  }

  if (targetDate > getLastRepeatDate(event)) {
    return false;
  }

  if (event.repeat === "none") {
    return targetDate === event.date;
  }

  const original = parseDateKey(event.date);
  const target = parseDateKey(targetDate);

  if (!original || !target) {
    return false;
  }

  if (event.repeat === "daily") {
    return true;
  }

  if (event.repeat === "weekly") {
    return original.getDay() === target.getDay();
  }

  if (event.repeat === "monthly") {
    /*
     * 1月31日の月次予定を2月末にも表示する。
     */
    return (
      target.getDate() ===
      Math.min(
        original.getDate(),
        new Date(
          target.getFullYear(),
          target.getMonth() + 1,
          0
        ).getDate()
      )
    );
  }

  if (event.repeat === "yearly") {
    return (
      target.getMonth() === original.getMonth() &&
      target.getDate() ===
        Math.min(
          original.getDate(),
          new Date(
            target.getFullYear(),
            original.getMonth() + 1,
            0
          ).getDate()
        )
    );
  }

  return false;
}

/**
 * ある日付に表示する予定を取得する。
 * 繰り返し予定も対象になる。
 */
export function getOccurrencesByDate(date) {
  return getEventsByDate(date).map(event => ({
    ...event,
    occurrenceDate: date
  }));
}

/* =========================================================
   10. 月間カレンダーの日付データ
   ========================================================= */

/**
 * 月間カレンダーの表示用データを生成する。
 *
 * weekStartsOn:
 *   0 = 日曜始まり
 *   1 = 月曜始まり
 */
export function getMonthCalendar(
  year,
  month,
  weekStartsOn = 0
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("年月が正しくありません。");
  }

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const offset =
    (firstDay.getDay() - weekStartsOn + 7) % 7;

  const start = new Date(year, month - 1, 1 - offset);

  const cells = [];
  const totalCells = Math.ceil(
    (offset + lastDay.getDate()) / 7
  ) * 7;

  for (let i = 0; i < totalCells; i++) {
    const date = new Date(start);

    date.setDate(start.getDate() + i);

    const key = formatDateKey(date);
    const occurrences = getOccurrencesByDate(key);

    cells.push({
      date: key,
      day: date.getDate(),
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      inCurrentMonth:
        date.getMonth() === month - 1 &&
        date.getFullYear() === year,
      isToday: key === todayKey(),
      events: occurrences,
      eventCount: occurrences.length,
      taskCount: occurrences.filter(
        event => event.type === EVENT_TYPES.TASK
      ).length,
      hasIncompleteTask: occurrences.some(
        event =>
          event.type === EVENT_TYPES.TASK &&
          !event.completed
      )
    });
  }

  return cells;
}

/* =========================================================
   11. 予定検索
   ========================================================= */

export function searchEvents(query, {
  from,
  to,
  type
} = {}) {
  const keyword = String(query || "")
    .trim()
    .toLowerCase();

  let events = getAllEvents();

  if (from) {
    events = events.filter(event => event.date >= from);
  }

  if (to) {
    events = events.filter(event => event.date <= to);
  }

  if (type) {
    events = events.filter(event => event.type === type);
  }

  if (!keyword) {
    return events;
  }

  return events.filter(event => {
    return (
      event.title.toLowerCase().includes(keyword) ||
      event.note.toLowerCase().includes(keyword) ||
      event.category.toLowerCase().includes(keyword)
    );
  });
}

/* =========================================================
   12. リマインダー対象の取得
   ========================================================= */

/**
 * 指定時刻に通知対象となる予定を取得する。
 *
 * この関数自体は通知を表示しない。
 * 実際の通知処理は既存の画面側で接続する。
 *
 * 繰り返し予定の当日分にも対応する。
 */
export function getReminderCandidates(
  currentTimestamp = Date.now()
) {
  const current = new Date(currentTimestamp);

  const today = formatDateKey(current);

  const currentMinutes =
    current.getHours() * 60 + current.getMinutes();

  const occurrences = getOccurrencesByDate(today);

  return occurrences.filter(event => {
    if (!event.reminder.enabled || !event.time) {
      return false;
    }

    const [hours, minutes] = event.time
      .split(":")
      .map(Number);

    const eventMinutes = hours * 60 + minutes;

    const reminderAt =
      eventMinutes - event.reminder.minutesBefore;

    return (
      reminderAt >= currentMinutes &&
      reminderAt < currentMinutes + 1
    );
  });
}

/* =========================================================
   13. 日付別の予定数・タスク数
   ========================================================= */

export function getCalendarSummary(date = todayKey()) {
  const events = getOccurrencesByDate(date);

  const tasks = events.filter(
    event => event.type === EVENT_TYPES.TASK
  );

  const completedTasks = tasks.filter(
    task => task.completed
  );

  return {
    date,
    eventCount: events.filter(
      event => event.type === EVENT_TYPES.EVENT
    ).length,
    taskCount: tasks.length,
    completedTaskCount: completedTasks.length,
    incompleteTaskCount:
      tasks.length - completedTasks.length,
    events
  };
}

/* =========================================================
   14. 初期化
   ========================================================= */

export function initializeCalendar() {
  const data = loadCalendarData();

  /*
   * 既存データを消さずに正規化した内容を保存する。
   */
  saveCalendarData(data);

  return {
    eventCount: data.events.length
  };
}

/* =========================================================
   15. まとめ
   ========================================================= */

export const calendar = Object.freeze({
  initialize: initializeCalendar,

  getAllEvents,
  getEventById,
  getEventsByDate,
  getEventsByMonth,
  getTodayEvents,
  getUpcomingEvents,
  getTasks,

  addEvent,
  addTask,
  updateEvent,
  updateTask,

  setTaskCompleted,
  toggleTaskCompleted,

  deleteEvent,
  deleteTask,

  getOccurrencesByDate,
  getMonthCalendar,

  searchEvents,
  getReminderCandidates,
  getCalendarSummary
});
