
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/calendar.js
 *
 * カレンダー・予定・タスク管理システム
 *
 * 担当:
 * - 予定の追加・編集・削除
 * - タスクの追加・編集・削除
 * - タスクの完了状態の切り替え
 * - 日付別の予定取得
 * - 日付別のタスク取得
 *
 * 画面描画や週間予定表の表示は別モジュールが担当します。
 */

import {
  STORAGE_KEYS,
  loadArray,
  saveData,
  createId,
  getTodayKey
} from "./storage.js";

// --------------------------------------------------
// 予定
// --------------------------------------------------

/**
 * すべての予定を取得します。
 */
export function getEvents() {
  return loadArray(STORAGE_KEYS.events, []);
}

/**
 * 予定を追加します。
 */
export function addEvent({
  title,
  date,
  start = "",
  end = "",
  notes = ""
}) {
  const normalizedTitle = String(title ?? "").trim();

  if (!normalizedTitle) {
    return {
      success: false,
      error: "予定名を入力してください。"
    };
  }

  if (!isValidDate(date)) {
    return {
      success: false,
      error: "有効な日付を指定してください。"
    };
  }

  if (!isValidTimeRange(start, end)) {
    return {
      success: false,
      error: "開始時刻と終了時刻を確認してください。"
    };
  }

  const events = getEvents();

  const entry = {
    id: createId(),
    title: normalizedTitle,
    date,
    start,
    end,
    notes: String(notes ?? "").trim(),
    createdAt: new Date().toISOString()
  };

  events.push(entry);

  if (!saveData(STORAGE_KEYS.events, events)) {
    return {
      success: false,
      error: "予定を保存できませんでした。"
    };
  }

  announceCalendarChange("event-added", entry);

  return {
    success: true,
    event: entry
  };
}

/**
 * 既存の予定を更新します。
 */
export function updateEvent(id, changes) {
  const events = getEvents();
  const index = events.findIndex(event => event.id === id);

  if (index === -1) {
    return {
      success: false,
      error: "編集する予定が見つかりません。"
    };
  }

  const previous = events[index];

  const updated = {
    ...previous,
    title: String(changes.title ?? previous.title).trim(),
    date: changes.date ?? previous.date,
    start: changes.start ?? previous.start ?? "",
    end: changes.end ?? previous.end ?? "",
    notes: String(changes.notes ?? previous.notes ?? "").trim(),
    updatedAt: new Date().toISOString()
  };

  if (!updated.title) {
    return {
      success: false,
      error: "予定名を入力してください。"
    };
  }

  if (!isValidDate(updated.date)) {
    return {
      success: false,
      error: "有効な日付を指定してください。"
    };
  }

  if (!isValidTimeRange(updated.start, updated.end)) {
    return {
      success: false,
      error: "開始時刻と終了時刻を確認してください。"
    };
  }

  events[index] = updated;

  if (!saveData(STORAGE_KEYS.events, events)) {
    return {
      success: false,
      error: "予定を更新できませんでした。"
    };
  }

  announceCalendarChange("event-updated", updated);

  return {
    success: true,
    event: updated
  };
}

/**
 * 指定した予定を削除します。
 */
export function deleteEvent(id) {
  const events = getEvents();
  const event = events.find(item => item.id === id);

  if (!event) {
    return {
      success: false,
      error: "削除する予定が見つかりません。"
    };
  }

  const updated = events.filter(item => item.id !== id);

  if (!saveData(STORAGE_KEYS.events, updated)) {
    return {
      success: false,
      error: "予定を削除できませんでした。"
    };
  }

  announceCalendarChange("event-deleted", event);

  return {
    success: true,
    event
  };
}

/**
 * 指定日の予定を取得します。
 */
export function getEventsByDate(date = getTodayKey()) {
  return getEvents()
    .filter(event => event.date === date)
    .sort((a, b) => {
      const timeA = a.start || "99:99";
      const timeB = b.start || "99:99";
      return timeA.localeCompare(timeB);
    });
}

// --------------------------------------------------
// タスク
// --------------------------------------------------

/**
 * すべてのタスクを取得します。
 */
export function getTasks() {
  return loadArray(STORAGE_KEYS.tasks, []);
}

/**
 * タスクを追加します。
 */
export function addTask({
  title,
  date = "",
  notes = ""
}) {
  const normalizedTitle = String(title ?? "").trim();

  if (!normalizedTitle) {
    return {
      success: false,
      error: "タスク名を入力してください。"
    };
  }

  if (date && !isValidDate(date)) {
    return {
      success: false,
      error: "有効な日付を指定してください。"
    };
  }

  const tasks = getTasks();

  const task = {
    id: createId(),
    title: normalizedTitle,
    date,
    notes: String(notes ?? "").trim(),
    done: false,
    createdAt: new Date().toISOString()
  };

  tasks.push(task);

  if (!saveData(STORAGE_KEYS.tasks, tasks)) {
    return {
      success: false,
      error: "タスクを保存できませんでした。"
    };
  }

  announceCalendarChange("task-added", task);

  return {
    success: true,
    task
  };
}

/**
 * タスクを編集します。
 */
export function updateTask(id, changes) {
  const tasks = getTasks();
  const index = tasks.findIndex(task => task.id === id);

  if (index === -1) {
    return {
      success: false,
      error: "編集するタスクが見つかりません。"
    };
  }

  const previous = tasks[index];

  const updated = {
    ...previous,
    title: String(changes.title ?? previous.title).trim(),
    date: changes.date ?? previous.date ?? "",
    notes: String(changes.notes ?? previous.notes ?? "").trim(),
    updatedAt: new Date().toISOString()
  };

  if (!updated.title) {
    return {
      success: false,
      error: "タスク名を入力してください。"
    };
  }

  if (updated.date && !isValidDate(updated.date)) {
    return {
      success: false,
      error: "有効な日付を指定してください。"
    };
  }

  tasks[index] = updated;

  if (!saveData(STORAGE_KEYS.tasks, tasks)) {
    return {
      success: false,
      error: "タスクを更新できませんでした。"
    };
  }

  announceCalendarChange("task-updated", updated);

  return {
    success: true,
    task: updated
  };
}

/**
 * タスクの完了・未完了を切り替えます。
 */
export function toggleTask(id) {
  const tasks = getTasks();
  const task = tasks.find(item => item.id === id);

  if (!task) {
    return {
      success: false,
      error: "タスクが見つかりません。"
    };
  }

  task.done = !task.done;
  task.updatedAt = new Date().toISOString();

  if (!saveData(STORAGE_KEYS.tasks, tasks)) {
    return {
      success: false,
      error: "タスクの状態を保存できませんでした。"
    };
  }

  announceCalendarChange("task-updated", task);

  return {
    success: true,
    task
  };
}

/**
 * タスクを削除します。
 */
export function deleteTask(id) {
  const tasks = getTasks();
  const task = tasks.find(item => item.id === id);

  if (!task) {
    return {
      success: false,
      error: "削除するタスクが見つかりません。"
    };
  }

  const updated = tasks.filter(item => item.id !== id);

  if (!saveData(STORAGE_KEYS.tasks, updated)) {
    return {
      success: false,
      error: "タスクを削除できませんでした。"
    };
  }

  announceCalendarChange("task-deleted", task);

  return {
    success: true,
    task
  };
}

/**
 * 指定日のタスクを取得します。
 */
export function getTasksByDate(date = getTodayKey()) {
  return getTasks()
    .filter(task => task.date === date)
    .sort((a, b) => Number(a.done) - Number(b.done));
}

// --------------------------------------------------
// 共通処理
// --------------------------------------------------

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function isValidTimeRange(start, end) {
  const validTime = value =>
    value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

  if (!validTime(start) || !validTime(end)) {
    return false;
  }

  if (start && end && end <= start) {
    return false;
  }

  return true;
}

/**
 * データ変更を画面側に知らせます。
 * 描画処理そのものは各画面のモジュールが担当します。
 */
function announceCalendarChange(type, data) {
  document.dispatchEvent(
    new CustomEvent("cosmos:calendar-change", {
      detail: {
        type,
        data
      }
    })
  );
}
