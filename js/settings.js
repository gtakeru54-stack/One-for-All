
/* =========================================================
   ALGOL — Study Constellation
   js/settings.js

   APPLICATION SETTINGS SYSTEM
   ========================================================= */

"use strict";

import { loadData, saveData } from "./store.js";

/* =========================================================
   デフォルト設定
   ========================================================= */

export const DEFAULT_SETTINGS = Object.freeze({
  theme: "cosmos",

  dailyTarget: 60,
  weeklyTarget: 420,
  minimumActionMinutes: 5,

  animations: true,

  notifications: {
    enabled: false,
    studyReminder: false,
    calendarReminder: false,
    goalReminder: false
  },

  study: {
    timerSound: true,
    autoSave: true,
    showSeconds: true
  },

  calendar: {
    weekStartsOn: 1,
    showCompletedTasks: true
  },

  statistics: {
    defaultPeriod: "week",
    chartGrouping: "subject"
  },

  appearance: {
    compactMode: false,
    showSeconds: true
  },

  bottomShortcuts: [
    "home",
    "study",
    "calendar",
    "statistics",
    "goals"
  ]
});

/* =========================================================
   初期値コピー
   ========================================================= */

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

/* =========================================================
   オブジェクト統合
   ========================================================= */

function mergeSettings(defaults, saved) {
  const result = { ...defaults };

  if (
    !saved ||
    typeof saved !== "object" ||
    Array.isArray(saved)
  ) {
    return result;
  }

  for (const key of Object.keys(saved)) {
    const defaultValue = defaults[key];
    const savedValue = saved[key];

    if (
      defaultValue &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue) &&
      savedValue &&
      typeof savedValue === "object" &&
      !Array.isArray(savedValue)
    ) {
      result[key] = mergeSettings(
        defaultValue,
        savedValue
      );
    } else {
      result[key] = savedValue;
    }
  }

  return result;
}

/* =========================================================
   設定取得
   ========================================================= */

export function getSettings() {
  const saved = loadData("settings", {});

  return mergeSettings(
    cloneDefaults(),
    saved
  );
}

/* =========================================================
   設定保存
   ========================================================= */

export function saveSettings(settings) {
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    throw new Error("正しい設定データを指定してください。");
  }

  const merged = mergeSettings(
    cloneDefaults(),
    settings
  );

  validateSettings(merged);
  saveData("settings", merged);

  return merged;
}

/* =========================================================
   個別設定取得
   ========================================================= */

export function getSetting(key, fallback = undefined) {
  if (typeof key !== "string" || !key.trim()) {
    return fallback;
  }

  const settings = getSettings();
  const keys = key.split(".");
  let value = settings;

  for (const part of keys) {
    if (
      value === null ||
      typeof value !== "object" ||
      !Object.prototype.hasOwnProperty.call(value, part)
    ) {
      return fallback;
    }

    value = value[part];
  }

  return value;
}

/* =========================================================
   個別設定変更
   ========================================================= */

export function setSetting(key, value) {
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("設定項目を指定してください。");
  }

  const settings = getSettings();
  const keys = key.split(".");
  let target = settings;

  for (let i = 0; i < keys.length - 1; i++) {
    const part = keys[i];

    if (
      !target[part] ||
      typeof target[part] !== "object" ||
      Array.isArray(target[part])
    ) {
      throw new Error(`設定項目が存在しません：${key}`);
    }

    target = target[part];
  }

  const finalKey = keys[keys.length - 1];

  if (
    !Object.prototype.hasOwnProperty.call(
      target,
      finalKey
    )
  ) {
    throw new Error(`設定項目が存在しません：${key}`);
  }

  target[finalKey] = value;

  validateSettings(settings);
  saveData("settings", settings);

  return value;
}

/* =========================================================
   設定検証
   ========================================================= */

export function validateSettings(settings) {
  if (!settings || typeof settings !== "object") {
    throw new Error("設定データが不正です。");
  }

  if (!["cosmos", "dark"].includes(settings.theme)) {
    throw new Error("テーマ設定が不正です。");
  }

  if (
    !Number.isFinite(settings.dailyTarget) ||
    settings.dailyTarget < 0
  ) {
    throw new Error("1日の学習目標が不正です。");
  }

  if (
    !Number.isFinite(settings.weeklyTarget) ||
    settings.weeklyTarget < 0
  ) {
    throw new Error("1週間の学習目標が不正です。");
  }

  if (
    !Number.isFinite(settings.minimumActionMinutes) ||
    settings.minimumActionMinutes < 1 ||
    settings.minimumActionMinutes > 60
  ) {
    throw new Error("最小行動時間は1〜60分で指定してください。");
  }

  if (typeof settings.animations !== "boolean") {
    throw new Error("アニメーション設定が不正です。");
  }

  if (
    !["day", "week", "month", "all"].includes(
      settings.statistics.defaultPeriod
    )
  ) {
    throw new Error("統計期間の設定が不正です。");
  }

  if (
    !["subject", "item"].includes(
      settings.statistics.chartGrouping
    )
  ) {
    throw new Error("グラフの分類設定が不正です。");
  }

  if (
    ![0, 1, 6].includes(
      settings.calendar.weekStartsOn
    )
  ) {
    throw new Error("週の開始曜日の設定が不正です。");
  }

  if (!Array.isArray(settings.bottomShortcuts)) {
    throw new Error("下部メニューの設定が不正です。");
  }

  const allowedViews = [
    "home",
    "study",
    "calendar",
    "statistics",
    "goals",
    "rocket",
    "economy",
    "countdown",
    "notifications",
    "settings"
  ];

  if (
    settings.bottomShortcuts.some(
      view => !allowedViews.includes(view)
    )
  ) {
    throw new Error("存在しない画面が下部メニューに指定されています。");
  }

  if (
    new Set(settings.bottomShortcuts).size !==
    settings.bottomShortcuts.length
  ) {
    throw new Error("下部メニューに重複があります。");
  }

  return true;
}

/* =========================================================
   テーマ
   ========================================================= */

export function getTheme() {
  return getSetting("theme", "cosmos");
}

export function setTheme(theme) {
  if (!["cosmos", "dark"].includes(theme)) {
    throw new Error("利用できないテーマです。");
  }

  return setSetting("theme", theme);
}

/* =========================================================
   学習目標
   ========================================================= */

export function getDailyTarget() {
  return getSetting("dailyTarget", 60);
}

export function setDailyTarget(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("正しい1日の目標時間を指定してください。");
  }

  return setSetting("dailyTarget", value);
}

export function getWeeklyTarget() {
  return getSetting("weeklyTarget", 420);
}

export function setWeeklyTarget(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("正しい1週間の目標時間を指定してください。");
  }

  return setSetting("weeklyTarget", value);
}

/* =========================================================
   最小行動時間
   ========================================================= */

export function getMinimumActionMinutes() {
  return getSetting("minimumActionMinutes", 5);
}

export function setMinimumActionMinutes(minutes) {
  const value = Number(minutes);

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 60
  ) {
    throw new Error("最小行動時間は1〜60分で指定してください。");
  }

  return setSetting("minimumActionMinutes", value);
}

/* =========================================================
   アニメーション
   ========================================================= */

export function areAnimationsEnabled() {
  return getSetting("animations", true);
}

export function setAnimationsEnabled(enabled) {
  return setSetting("animations", Boolean(enabled));
}

/* =========================================================
   通知設定
   ========================================================= */

export function getNotificationSettings() {
  return getSetting("notifications");
}

export function setNotificationSettings(updates = {}) {
  if (
    !updates ||
    typeof updates !== "object" ||
    Array.isArray(updates)
  ) {
    throw new Error("通知設定が不正です。");
  }

  const settings = getSettings();

  settings.notifications = {
    ...settings.notifications,
    ...updates
  };

  for (const value of Object.values(settings.notifications)) {
    if (typeof value !== "boolean") {
      throw new Error("通知設定には真偽値を指定してください。");
    }
  }

  saveData("settings", settings);

  return settings.notifications;
}

/* =========================================================
   統計設定
   ========================================================= */

export function getStatisticsSettings() {
  return getSetting("statistics");
}

export function setStatisticsSettings(updates = {}) {
  const settings = getSettings();

  settings.statistics = {
    ...settings.statistics,
    ...updates
  };

  validateSettings(settings);
  saveData("settings", settings);

  return settings.statistics;
}

/* =========================================================
   カレンダー設定
   ========================================================= */

export function getCalendarSettings() {
  return getSetting("calendar");
}

export function setCalendarSettings(updates = {}) {
  const settings = getSettings();

  settings.calendar = {
    ...settings.calendar,
    ...updates
  };

  validateSettings(settings);
  saveData("settings", settings);

  return settings.calendar;
}

/* =========================================================
   表示設定
   ========================================================= */

export function getAppearanceSettings() {
  return getSetting("appearance");
}

export function setAppearanceSettings(updates = {}) {
  const settings = getSettings();

  settings.appearance = {
    ...settings.appearance,
    ...updates
  };

  if (
    typeof settings.appearance.compactMode !== "boolean" ||
    typeof settings.appearance.showSeconds !== "boolean"
  ) {
    throw new Error("表示設定が不正です。");
  }

  saveData("settings", settings);

  return settings.appearance;
}

/* =========================================================
   下部メニュー
   ========================================================= */

export function getBottomShortcuts() {
  return [...getSetting("bottomShortcuts", ["home"])];
}

export function setBottomShortcuts(shortcuts) {
  if (!Array.isArray(shortcuts)) {
    throw new Error("メニュー項目を配列で指定してください。");
  }

  const settings = getSettings();

  settings.bottomShortcuts = [...shortcuts];

  validateSettings(settings);
  saveData("settings", settings);

  return [...settings.bottomShortcuts];
}

/* =========================================================
   初期化
   ========================================================= */

export function initializeSettings() {
  const saved = loadData("settings", {});

  const settings = mergeSettings(
    cloneDefaults(),
    saved
  );

  validateSettings(settings);
  saveData("settings", settings);

  return settings;
}

/* =========================================================
   初期値に戻す
   ========================================================= */

export function resetSettings() {
  const defaults = cloneDefaults();

  saveData("settings", defaults);

  return defaults;
}

/* =========================================================
   エクスポート
   ========================================================= */

export function exportSettings() {
  return JSON.stringify(
    getSettings(),
    null,
    2
  );
}

/* =========================================================
   インポート
   ========================================================= */

export function importSettings(json) {
  let parsed;

  try {
    parsed = typeof json === "string"
      ? JSON.parse(json)
      : json;
  } catch {
    throw new Error("設定データを読み取れません。");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error("設定データの形式が不正です。");
  }

  const settings = mergeSettings(
    cloneDefaults(),
    parsed
  );

  validateSettings(settings);
  saveData("settings", settings);

  return settings;
}

/* =========================================================
   デフォルトエクスポート
   ========================================================= */

export default {
  DEFAULT_SETTINGS,

  getSettings,
  saveSettings,
  getSetting,
  setSetting,
  validateSettings,

  getTheme,
  setTheme,

  getDailyTarget,
  setDailyTarget,
  getWeeklyTarget,
  setWeeklyTarget,

  getMinimumActionMinutes,
  setMinimumActionMinutes,

  areAnimationsEnabled,
  setAnimationsEnabled,

  getNotificationSettings,
  setNotificationSettings,

  getStatisticsSettings,
  setStatisticsSettings,

  getCalendarSettings,
  setCalendarSettings,

  getAppearanceSettings,
  setAppearanceSettings,

  getBottomShortcuts,
  setBottomShortcuts,

  initializeSettings,
  resetSettings,

  exportSettings,
  importSettings
};
