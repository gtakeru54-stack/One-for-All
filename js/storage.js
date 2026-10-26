
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/storage.js
 *
 * 共通データ保存システム
 * すべての機能で共通して使用する。
 */

const STORAGE_PREFIX = "oneforall-";

export const STORAGE_KEYS = Object.freeze({
  study: `${STORAGE_PREFIX}study-v1`,
  events: `${STORAGE_PREFIX}events-v1`,
  tasks: `${STORAGE_PREFIX}tasks-v1`,
  goals: `${STORAGE_PREFIX}goals-v1`,
  finance: `${STORAGE_PREFIX}finance-v1`,
  target: `${STORAGE_PREFIX}target-v1`,
  dailyGoal: `${STORAGE_PREFIX}daily-study-goal`,
  settings: `${STORAGE_PREFIX}settings-v1`,
  rocket: `${STORAGE_PREFIX}rocket-v1`,
  missions: `${STORAGE_PREFIX}missions-v1`
});

/**
 * データを読み込む。
 * 保存データがない、または読み込みに失敗した場合は
 * 指定された初期値を返す。
 */
export function readStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return fallback;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error(
      `[COSMOS] データ読み込みエラー: ${key}`,
      error
    );

    return fallback;
  }
}

/**
 * データを保存する。
 * 成功した場合は true、失敗した場合は false を返す。
 *
 * 保存に成功した場合、同じ画面内の別機能にも
 * 更新を知らせるイベントを発生させる。
 */
export function writeStorage(key, value) {
  try {
    const serialized = JSON.stringify(value);

    localStorage.setItem(key, serialized);

    window.dispatchEvent(
      new CustomEvent("cosmos:data-updated", {
        detail: { key }
      })
    );

    return true;
  } catch (error) {
    console.error(
      `[COSMOS] データ保存エラー: ${key}`,
      error
    );

    return false;
  }
}

/**
 * データを削除する。
 * 通常の機能では使わず、必要な場合のみ使用する。
 */
export function removeStorage(key) {
  try {
    localStorage.removeItem(key);

    window.dispatchEvent(
      new CustomEvent("cosmos:data-updated", {
        detail: { key }
      })
    );

    return true;
  } catch (error) {
    console.error(
      `[COSMOS] データ削除エラー: ${key}`,
      error
    );

    return false;
  }
}

/**
 * 配列形式のデータを安全に読み込む。
 */
export function readStorageArray(key) {
  const value = readStorage(key, []);
  return Array.isArray(value) ? value : [];
}

/**
 * オブジェクト形式のデータを安全に読み込む。
 */
export function readStorageObject(key, fallback = {}) {
  const value = readStorage(key, fallback);

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
 * 保存データの更新を監視する。
 * 戻り値の関数を呼ぶと監視を解除できる。
 */
export function onStorageUpdate(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("callback は関数である必要があります。");
  }

  const handler = event => {
    callback(event.detail);
  };

  window.addEventListener("cosmos:data-updated", handler);

  return () => {
    window.removeEventListener("cosmos:data-updated", handler);
  };
}
