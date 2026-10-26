
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/storage.js
 *
 * 共通データ保存システム
 * 学習・予定・タスク・目標・経済などの
 * データを localStorage に保存します。
 *
 * 他のJavaScriptファイルから import して使用します。
 */

const STORAGE_KEYS = Object.freeze({
  study: "oneforall-study-v1",
  events: "oneforall-events-v1",
  tasks: "oneforall-tasks-v1",
  goals: "oneforall-goals-v1",
  finance: "oneforall-finance-v1",
  target: "oneforall-target-v1",
  dailyGoal: "oneforall-daily-study-goal",

  // 今後追加する成長・ロケット関連データ
  progression: "oneforall-progression-v1",
  habits: "oneforall-habits-v1",
  missions: "oneforall-missions-v1"
});

/**
 * データを読み込みます。
 * 保存データがない場合や読み込みに失敗した場合は
 * fallback を返します。
 */
export function loadData(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      `[COSMOS] データの読み込みに失敗しました: ${key}`,
      error
    );

    return fallback;
  }
}

/**
 * データを保存します。
 * 成功した場合は true、失敗した場合は false を返します。
 */
export function saveData(key, value) {
  try {
    const serialized = JSON.stringify(value);

    localStorage.setItem(key, serialized);

    return true;
  } catch (error) {
    console.error(
      `[COSMOS] データの保存に失敗しました: ${key}`,
      error
    );

    return false;
  }
}

/**
 * 指定した保存データを削除します。
 * 呼び出し元が明示的に指定したキーだけを削除します。
 */
export function removeData(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(
      `[COSMOS] データの削除に失敗しました: ${key}`,
      error
    );

    return false;
  }
}

/**
 * 保存データが存在するか確認します。
 */
export function hasData(key) {
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(
      `[COSMOS] データの確認に失敗しました: ${key}`,
      error
    );

    return false;
  }
}

/**
 * 配列データを読み込みます。
 * 配列以外の値が保存されていた場合は fallback を返します。
 */
export function loadArray(key, fallback = []) {
  const value = loadData(key, fallback);

  return Array.isArray(value) ? value : fallback;
}

/**
 * オブジェクトデータを読み込みます。
 * null や配列は通常のオブジェクトとして扱いません。
 */
export function loadObject(key, fallback = {}) {
  const value = loadData(key, fallback);

  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return fallback;
  }

  return value;
}

/**
 * 新しい一意のIDを生成します。
 */
export function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 11)
  );
}

/**
 * 現在の日付を YYYY-MM-DD 形式で返します。
 * 日本時間の端末で利用することを想定しています。
 */
export function getTodayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

/**
 * Date または日付として解釈できる値を
 * YYYY-MM-DD 形式に変換します。
 */
export function getDateKey(value = new Date()) {
  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

/**
 * データ保存の状態を確認するための情報を返します。
 * 学習内容などの個人データそのものは返しません。
 */
export function getStorageStatus() {
  try {
    return {
      available: true,
      keyCount: Object.keys(STORAGE_KEYS).length
    };
  } catch (error) {
    return {
      available: false,
      keyCount: 0
    };
  }
}

export { STORAGE_KEYS };
