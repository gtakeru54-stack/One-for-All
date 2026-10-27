
/* =========================================================
   ONE FOR ALL COSMOS
   js/countdown.js

   カウントダウン管理
   ・受験 / 試験 / 大会などの予定日管理
   ・残り日数の自動計算
   ・追加 / 編集 / 削除
   ・重要度 / メモ
   ・日付順の並び替え
   ・自動保存
   ========================================================= */

"use strict";

import { store } from "./store.js";

const STORAGE_VERSION = 1;

/* =========================================================
   内部ユーティリティ
   ========================================================= */

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    "countdown-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

function todayString() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isValidDateString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

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

function dateToDayNumber(dateString) {
  if (!isValidDateString(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);

  return Math.floor(
    Date.UTC(year, month - 1, day) / 86400000
  );
}

function getDaysRemaining(targetDate) {
  const target = dateToDayNumber(targetDate);
  const today = dateToDayNumber(todayString());

  if (target === null || today === null) {
    return null;
  }

  return target - today;
}

function normalizeCountdown(item) {
  const timestamp = Date.now();

  return {
    id: String(item.id || createId()),
    title: String(item.title || "").trim(),
    date: String(item.date || ""),
    category: String(item.category || "その他"),
    importance: ["low", "normal", "high"].includes(item.importance)
      ? item.importance
      : "normal",
    note: String(item.note || ""),
    completed: Boolean(item.completed),
    createdAt: Number(item.createdAt) || timestamp,
    updatedAt: Number(item.updatedAt) || timestamp
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* =========================================================
   保存データ
   ========================================================= */

function createDefaultData() {
  return {
    version: STORAGE_VERSION,
    items: [],
    selectedId: null,
    lastUpdated: Date.now()
  };
}

function loadData() {
  let saved;

  try {
    saved = store.countdown.load(null);
  } catch (error) {
    console.error("[Countdown] 読み込みエラー:", error);
    saved = null;
  }

  if (Array.isArray(saved)) {
    return {
      version: STORAGE_VERSION,
      items: saved.map(normalizeCountdown),
      selectedId: saved[0]?.id || null,
      lastUpdated: Date.now()
    };
  }

  if (!saved || typeof saved !== "object") {
    return createDefaultData();
  }

  const items = Array.isArray(saved.items)
    ? saved.items.map(normalizeCountdown)
    : [];

  return {
    version: STORAGE_VERSION,
    items,
    selectedId: saved.selectedId || null,
    lastUpdated: Number(saved.lastUpdated) || Date.now()
  };
}

let data = loadData();

function saveData() {
  data.lastUpdated = Date.now();

  try {
    return store.countdown.save(data);
  } catch (error) {
    console.error("[Countdown] 保存エラー:", error);
    return false;
  }
}

/* =========================================================
   一覧取得
   ========================================================= */

function getCountdowns() {
  return clone(data.items);
}

function getCountdown(id) {
  const item = data.items.find(entry => entry.id === id);

  return item ? clone(item) : null;
}

function getSelectedCountdown() {
  return getCountdown(data.selectedId);
}

function getSelectedId() {
  return data.selectedId;
}

function selectCountdown(id) {
  if (!data.items.some(item => item.id === id)) {
    return false;
  }

  data.selectedId = id;

  return saveData() !== false;
}

/* =========================================================
   カウントダウン追加
   ========================================================= */

function addCountdown(options = {}) {
  const title = String(options.title || "").trim();
  const date = String(options.date || "");

  if (!title) {
    return {
      success: false,
      message: "予定の名前を入力してください。"
    };
  }

  if (!isValidDateString(date)) {
    return {
      success: false,
      message: "正しい日付を入力してください。"
    };
  }

  const item = normalizeCountdown({
    ...options,
    id: createId(),
    title,
    date,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  data.items.push(item);
  data.selectedId = item.id;

  const saved = saveData();

  return {
    success: saved !== false,
    message: saved === false
      ? "追加しましたが、保存に失敗しました。"
      : "カウントダウンを追加しました。",
    item: clone(item)
  };
}

/* =========================================================
   カウントダウン編集
   ========================================================= */

function updateCountdown(id, changes = {}) {
  const index = data.items.findIndex(item => item.id === id);

  if (index === -1) {
    return {
      success: false,
      message: "編集する予定が見つかりません。"
    };
  }

  const current = data.items[index];

  const title = changes.title === undefined
    ? current.title
    : String(changes.title).trim();

  const date = changes.date === undefined
    ? current.date
    : String(changes.date);

  if (!title) {
    return {
      success: false,
      message: "予定の名前を入力してください。"
    };
  }

  if (!isValidDateString(date)) {
    return {
      success: false,
      message: "正しい日付を入力してください。"
    };
  }

  const updated = normalizeCountdown({
    ...current,
    ...changes,
    id: current.id,
    title,
    date,
    createdAt: current.createdAt,
    updatedAt: Date.now()
  });

  data.items[index] = updated;

  return {
    success: saveData() !== false,
    message: "カウントダウンを更新しました。",
    item: clone(updated)
  };
}

/* =========================================================
   削除
   ========================================================= */

function deleteCountdown(id) {
  const index = data.items.findIndex(item => item.id === id);

  if (index === -1) {
    return {
      success: false,
      message: "削除する予定が見つかりません。"
    };
  }

  data.items.splice(index, 1);

  if (data.selectedId === id) {
    data.selectedId = data.items[0]?.id || null;
  }

  return {
    success: saveData() !== false,
    message: "カウントダウンを削除しました。"
  };
}

/* =========================================================
   達成状態
   ========================================================= */

function setCompleted(id, completed = true) {
  return updateCountdown(id, {
    completed: Boolean(completed)
  });
}

function toggleCompleted(id) {
  const item = data.items.find(entry => entry.id === id);

  if (!item) {
    return {
      success: false,
      message: "予定が見つかりません。"
    };
  }

  return setCompleted(id, !item.completed);
}

/* =========================================================
   残り日数・状態
   ========================================================= */

function getCountdownStatus(item) {
  if (item.completed) {
    return "completed";
  }

  const remaining = getDaysRemaining(item.date);

  if (remaining === null) {
    return "invalid";
  }

  if (remaining < 0) {
    return "overdue";
  }

  if (remaining === 0) {
    return "today";
  }

  if (remaining === 1) {
    return "tomorrow";
  }

  return "upcoming";
}

function getCountdownDetails(id) {
  const item = data.items.find(entry => entry.id === id);

  if (!item) {
    return null;
  }

  const remainingDays = getDaysRemaining(item.date);

  let remainingText = "";

  if (item.completed) {
    remainingText = "達成済み";
  } else if (remainingDays === null) {
    remainingText = "日付を確認してください";
  } else if (remainingDays < 0) {
    remainingText = `${Math.abs(remainingDays)}日経過`;
  } else if (remainingDays === 0) {
    remainingText = "今日";
  } else if (remainingDays === 1) {
    remainingText = "あと1日";
  } else {
    remainingText = `あと${remainingDays}日`;
  }

  return {
    ...clone(item),
    remainingDays,
    remainingText,
    status: getCountdownStatus(item)
  };
}

function getAllCountdownDetails() {
  return data.items.map(item => getCountdownDetails(item.id));
}

/* =========================================================
   並び替え
   ========================================================= */

function getSortedCountdowns(options = {}) {
  const includeCompleted = options.includeCompleted !== false;

  const items = data.items
    .filter(item => includeCompleted || !item.completed)
    .map(item => getCountdownDetails(item.id));

  items.sort((a, b) => {
    const aDate = dateToDayNumber(a.date);
    const bDate = dateToDayNumber(b.date);

    if (aDate === null && bDate === null) {
      return a.title.localeCompare(b.title, "ja");
    }

    if (aDate === null) return 1;
    if (bDate === null) return -1;

    return aDate - bDate;
  });

  return clone(items);
}

function getUpcomingCountdowns(limit = 5) {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));

  return getSortedCountdowns({ includeCompleted: false })
    .filter(item =>
      item.remainingDays !== null &&
      item.remainingDays >= 0
    )
    .slice(0, safeLimit);
}

function getOverdueCountdowns() {
  return getSortedCountdowns({ includeCompleted: false })
    .filter(item => item.status === "overdue");
}

/* =========================================================
   カテゴリー別取得
   ========================================================= */

function getCategories() {
  return [...new Set(
    data.items.map(item => item.category).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "ja"));
}

function getCountdownsByCategory(category) {
  return getAllCountdownDetails()
    .filter(item => item.category === category);
}

/* =========================================================
   検索
   ========================================================= */

function searchCountdowns(query) {
  const keyword = String(query || "").trim().toLowerCase();

  if (!keyword) {
    return getAllCountdownDetails();
  }

  return getAllCountdownDetails().filter(item =>
    item.title.toLowerCase().includes(keyword) ||
    item.note.toLowerCase().includes(keyword) ||
    item.category.toLowerCase().includes(keyword)
  );
}

/* =========================================================
   統計
   ========================================================= */

function getSummary() {
  const items = getAllCountdownDetails();

  return {
    total: items.length,
    completed: items.filter(item => item.completed).length,
    upcoming: items.filter(item => item.status === "upcoming").length,
    today: items.filter(item => item.status === "today").length,
    tomorrow: items.filter(item => item.status === "tomorrow").length,
    overdue: items.filter(item => item.status === "overdue").length
  };
}

/* =========================================================
   初期化・リセット
   ========================================================= */

function initializeCountdown() {
  data = loadData();

  if (!data.items.some(item => item.id === data.selectedId)) {
    data.selectedId = data.items[0]?.id || null;
  }

  return getAllCountdownDetails();
}

function resetCountdowns() {
  data = createDefaultData();
  saveData();

  return getCountdowns();
}

/* =========================================================
   公開API
   ========================================================= */

export const countdown = Object.freeze({
  initializeCountdown,

  getCountdowns,
  getCountdown,
  getSelectedCountdown,
  getSelectedId,
  selectCountdown,

  addCountdown,
  updateCountdown,
  deleteCountdown,

  setCompleted,
  toggleCompleted,

  getDaysRemaining,
  getCountdownStatus,
  getCountdownDetails,
  getAllCountdownDetails,

  getSortedCountdowns,
  getUpcomingCountdowns,
  getOverdueCountdowns,

  getCategories,
  getCountdownsByCategory,
  searchCountdowns,
  getSummary,

  resetCountdowns,
  save: saveData
});

export default countdown;
