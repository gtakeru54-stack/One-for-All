
/* =========================================================
   ALGOL — Study Constellation
   js/countdown.js

   EVENT COUNTDOWN SYSTEM

   ・イベントの追加、編集、削除
   ・イベント一覧の取得
   ・残り日数の計算
   ・終了済みイベントの判定
   ・直近イベントの取得
   ・イベントの並び替え
   ・データの保存

   保存先：store.js の countdown
   ========================================================= */

"use strict";

import { loadData, saveData } from "./store.js";

/* =========================================================
   共通関数
   ========================================================= */

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return `countdown-${globalThis.crypto.randomUUID()}`;
  }

  return `countdown-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isValidDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(dateString) {
  if (!isValidDate(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/* =========================================================
   データ取得・保存
   ========================================================= */

function getCountdownData() {
  const data = loadData("countdown", []);

  return Array.isArray(data) ? data : [];
}

function saveCountdownData(data) {
  saveData("countdown", data);
  return data;
}

/* =========================================================
   残り日数計算
   ========================================================= */

export function getDaysRemaining(targetDate, currentDate = new Date()) {
  const target = parseDate(targetDate);

  if (!target) {
    throw new Error("正しい日付を指定してください。");
  }

  const current = startOfDay(currentDate);
  const difference = target.getTime() - current.getTime();

  return Math.round(difference / 86400000);
}

export function getCountdownStatus(event, currentDate = new Date()) {
  const remainingDays = getDaysRemaining(
    event.date,
    currentDate
  );

  let status = "upcoming";

  if (remainingDays < 0) {
    status = "passed";
  } else if (remainingDays === 0) {
    status = "today";
  }

  return {
    ...event,
    remainingDays,
    status,
    isToday: remainingDays === 0,
    isPassed: remainingDays < 0,
    isUpcoming: remainingDays >= 0
  };
}

/* =========================================================
   イベント追加
   ========================================================= */

export function addCountdownEvent(data = {}) {
  const title = normalizeText(data.title);
  const date = normalizeText(data.date);

  if (!title) {
    throw new Error("イベント名を入力してください。");
  }

  if (!isValidDate(date)) {
    throw new Error("正しい日付を入力してください。");
  }

  const events = getCountdownData();

  const event = {
    id: createId(),
    title,
    date,

    description: normalizeText(data.description),
    category: normalizeText(data.category) || "other",

    color: data.color || "#91aaff",
    icon: data.icon || "star",

    pinned: data.pinned === true,

    createdAt: now(),
    updatedAt: now()
  };

  events.push(event);
  saveCountdownData(events);

  return event;
}

/* =========================================================
   イベント編集
   ========================================================= */

export function updateCountdownEvent(eventId, updates = {}) {
  const events = getCountdownData();

  const index = events.findIndex(
    event => event.id === eventId
  );

  if (index === -1) {
    throw new Error("編集するイベントが見つかりません。");
  }

  const event = { ...events[index] };

  if (updates.title !== undefined) {
    const title = normalizeText(updates.title);

    if (!title) {
      throw new Error("イベント名を入力してください。");
    }

    event.title = title;
  }

  if (updates.date !== undefined) {
    const date = normalizeText(updates.date);

    if (!isValidDate(date)) {
      throw new Error("正しい日付を入力してください。");
    }

    event.date = date;
  }

  if (updates.description !== undefined) {
    event.description = normalizeText(updates.description);
  }

  if (updates.category !== undefined) {
    event.category = normalizeText(updates.category) || "other";
  }

  if (updates.color !== undefined) {
    event.color = updates.color || "#91aaff";
  }

  if (updates.icon !== undefined) {
    event.icon = updates.icon || "star";
  }

  if (updates.pinned !== undefined) {
    event.pinned = updates.pinned === true;
  }

  event.updatedAt = now();

  events[index] = event;
  saveCountdownData(events);

  return event;
}

/* =========================================================
   イベント削除
   ========================================================= */

export function deleteCountdownEvent(eventId) {
  const events = getCountdownData();

  const remaining = events.filter(
    event => event.id !== eventId
  );

  if (remaining.length === events.length) {
    return false;
  }

  saveCountdownData(remaining);

  return true;
}

/* =========================================================
   イベント取得
   ========================================================= */

export function getAllCountdownEvents() {
  return getCountdownData();
}

export function getCountdownEvent(eventId) {
  return getCountdownData().find(
    event => event.id === eventId
  ) ?? null;
}

/* =========================================================
   イベント一覧・並び替え
   ========================================================= */

export function getUpcomingCountdownEvents(options = {}) {
  const currentDate = options.currentDate || new Date();
  const limit = Math.max(0, Number(options.limit) || 100);

  return getCountdownData()
    .map(event => getCountdownStatus(event, currentDate))
    .filter(event => event.remainingDays >= 0)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      return a.remainingDays - b.remainingDays;
    })
    .slice(0, limit);
}

export function getPassedCountdownEvents(currentDate = new Date()) {
  return getCountdownData()
    .map(event => getCountdownStatus(event, currentDate))
    .filter(event => event.remainingDays < 0)
    .sort((a, b) => b.remainingDays - a.remainingDays);
}

export function getTodayCountdownEvents(currentDate = new Date()) {
  return getCountdownData()
    .map(event => getCountdownStatus(event, currentDate))
    .filter(event => event.remainingDays === 0);
}

export function getNearestCountdownEvent(currentDate = new Date()) {
  return getUpcomingCountdownEvents({
    currentDate,
    limit: 1
  })[0] ?? null;
}

/* =========================================================
   カテゴリー別取得
   ========================================================= */

export function getCountdownEventsByCategory(category) {
  return getCountdownData()
    .filter(event => event.category === category)
    .map(event => getCountdownStatus(event));
}

/* =========================================================
   ピン留め
   ========================================================= */

export function toggleCountdownPin(eventId) {
  const events = getCountdownData();

  const event = events.find(
    item => item.id === eventId
  );

  if (!event) {
    throw new Error("イベントが見つかりません。");
  }

  event.pinned = !event.pinned;
  event.updatedAt = now();

  saveCountdownData(events);

  return event;
}

/* =========================================================
   並び替え
   ========================================================= */

export function reorderCountdownEvents(eventIds = []) {
  if (!Array.isArray(eventIds)) {
    throw new Error("イベントIDの配列を指定してください。");
  }

  const events = getCountdownData();
  const orderMap = new Map(
    eventIds.map((id, index) => [id, index])
  );

  const updated = events.map(event => {
    if (!orderMap.has(event.id)) {
      return event;
    }

    return {
      ...event,
      order: orderMap.get(event.id),
      updatedAt: now()
    };
  });

  saveCountdownData(updated);

  return updated;
}

/* =========================================================
   集計
   ========================================================= */

export function getCountdownSummary(currentDate = new Date()) {
  const events = getCountdownData().map(
    event => getCountdownStatus(event, currentDate)
  );

  return {
    total: events.length,

    upcoming: events.filter(
      event => event.remainingDays > 0
    ).length,

    today: events.filter(
      event => event.remainingDays === 0
    ).length,

    passed: events.filter(
      event => event.remainingDays < 0
    ).length,

    pinned: events.filter(
      event => event.pinned
    ).length
  };
}

/* =========================================================
   表示用テキスト
   ========================================================= */

export function formatRemainingDays(remainingDays) {
  const days = Number(remainingDays);

  if (!Number.isFinite(days)) {
    return "";
  }

  if (days > 0) {
    return `あと${days}日`;
  }

  if (days === 0) {
    return "今日";
  }

  return `${Math.abs(days)}日前`;
}

export function getCountdownDisplay(event, currentDate = new Date()) {
  const status = getCountdownStatus(event, currentDate);

  return {
    ...status,
    remainingText: formatRemainingDays(status.remainingDays)
  };
}

/* =========================================================
   初期化
   ========================================================= */

export function initializeCountdown() {
  const events = getCountdownData();

  saveCountdownData(events);

  return {
    events,
    summary: getCountdownSummary()
  };
}

/* =========================================================
   デフォルトエクスポート
   ========================================================= */

export default {
  initializeCountdown,

  addCountdownEvent,
  updateCountdownEvent,
  deleteCountdownEvent,

  getAllCountdownEvents,
  getCountdownEvent,

  getDaysRemaining,
  getCountdownStatus,
  getCountdownDisplay,
  formatRemainingDays,

  getUpcomingCountdownEvents,
  getPassedCountdownEvents,
  getTodayCountdownEvents,
  getNearestCountdownEvent,

  getCountdownEventsByCategory,
  toggleCountdownPin,
  reorderCountdownEvents,

  getCountdownSummary
};
