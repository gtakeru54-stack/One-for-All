
/* =========================================================
   ONE FOR ALL COSMOS
   js/settings.js

   アプリ共通設定
   ・1日の学習目標
   ・週の学習目標
   ・テーマ設定
   ・通知設定
   ・タイマー設定
   ・ホーム画面設定
   ・設定の初期化
   ========================================================= */

"use strict";

import {
  loadObject,
  saveData,
} from "./storage.js";

const SETTINGS_STORAGE_KEY = "oneforall-settings-v1";

/* ---------------------------------------------------------
   初期設定
   --------------------------------------------------------- */

export const DEFAULT_SETTINGS = Object.freeze({
  version: 1,

  study: {
    dailyGoalMinutes: 120,
    weeklyGoalMinutes: 840,
    minimumActionMinutes: 5,
    defaultTimerMinutes: 25,
    autoSaveTimer: true,
    showTimerSeconds: true,
  },

  appearance: {
    theme: "cosmos",
    animations: true,
    compactMode: false,
    showStars: true,
  },

  notifications: {
    enabled: false,
    studyReminder: false,
    studyReminderTime: "19:00",
    eventReminder: false,
    countdownReminderDays: 7,
  },

  home: {
    showDailyGoal: true,
    showNextEvent: true,
    showNextStudyItem: true,
    showRocket: true,
    showHabitList: true,
    showFinance: true,
  },

  calendar: {
    weekStartsOnMonday: true,
    defaultView: "month",
  },

  privacy: {
    shareStudyRecords: false,
  },
});

/* ---------------------------------------------------------
   値の検証
   --------------------------------------------------------- */

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(number)));
}

function normalizeTime(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
}

function normalizeTheme(value) {
  const allowedThemes = [
    "cosmos",
    "dark",
    "light",
  ];

  return allowedThemes.includes(value)
    ? value
    : DEFAULT_SETTINGS.appearance.theme;
}

function normalizeCalendarView(value) {
  const allowedViews = [
    "month",
    "week",
    "day",
  ];

  return allowedViews.includes(value)
    ? value
    : DEFAULT_SETTINGS.calendar.defaultView;
}

/* ---------------------------------------------------------
   設定データの正規化
   --------------------------------------------------------- */

function normalizeSettings(input) {
  const source = isPlainObject(input) ? input : {};

  const study = isPlainObject(source.study)
    ? source.study
    : {};

  const appearance = isPlainObject(source.appearance)
    ? source.appearance
    : {};

  const notifications = isPlainObject(source.notifications)
    ? source.notifications
    : {};

  const home = isPlainObject(source.home)
    ? source.home
    : {};

  const calendar = isPlainObject(source.calendar)
    ? source.calendar
    : {};

  const privacy = isPlainObject(source.privacy)
    ? source.privacy
    : {};

  return {
    version: 1,

    study: {
      dailyGoalMinutes: clampNumber(
        study.dailyGoalMinutes,
        1,
        1440,
        DEFAULT_SETTINGS.study.dailyGoalMinutes
      ),

      weeklyGoalMinutes: clampNumber(
        study.weeklyGoalMinutes,
        1,
        10080,
        DEFAULT_SETTINGS.study.weeklyGoalMinutes
      ),

      minimumActionMinutes: clampNumber(
        study.minimumActionMinutes,
        1,
        60,
        DEFAULT_SETTINGS.study.minimumActionMinutes
      ),

      defaultTimerMinutes: clampNumber(
        study.defaultTimerMinutes,
        1,
        180,
        DEFAULT_SETTINGS.study.defaultTimerMinutes
      ),

      autoSaveTimer:
        typeof study.autoSaveTimer === "boolean"
          ? study.autoSaveTimer
          : DEFAULT_SETTINGS.study.autoSaveTimer,

      showTimerSeconds:
        typeof study.showTimerSeconds === "boolean"
          ? study.showTimerSeconds
          : DEFAULT_SETTINGS.study.showTimerSeconds,
    },

    appearance: {
      theme: normalizeTheme(appearance.theme),

      animations:
        typeof appearance.animations === "boolean"
          ? appearance.animations
          : DEFAULT_SETTINGS.appearance.animations,

      compactMode:
        typeof appearance.compactMode === "boolean"
          ? appearance.compactMode
          : DEFAULT_SETTINGS.appearance.compactMode,

      showStars:
        typeof appearance.showStars === "boolean"
          ? appearance.showStars
          : DEFAULT_SETTINGS.appearance.showStars,
    },

    notifications: {
      enabled:
        typeof notifications.enabled === "boolean"
          ? notifications.enabled
          : DEFAULT_SETTINGS.notifications.enabled,

      studyReminder:
        typeof notifications.studyReminder === "boolean"
          ? notifications.studyReminder
          : DEFAULT_SETTINGS.notifications.studyReminder,

      studyReminderTime: normalizeTime(
        notifications.studyReminderTime,
        DEFAULT_SETTINGS.notifications.studyReminderTime
      ),

      eventReminder:
        typeof notifications.eventReminder === "boolean"
          ? notifications.eventReminder
          : DEFAULT_SETTINGS.notifications.eventReminder,

      countdownReminderDays: clampNumber(
        notifications.countdownReminderDays,
        0,
        365,
        DEFAULT_SETTINGS.notifications.countdownReminderDays
      ),
    },

    home: {
      showDailyGoal:
        typeof home.showDailyGoal === "boolean"
          ? home.showDailyGoal
          : DEFAULT_SETTINGS.home.showDailyGoal,

      showNextEvent:
        typeof home.showNextEvent === "boolean"
          ? home.showNextEvent
          : DEFAULT_SETTINGS.home.showNextEvent,

      showNextStudyItem:
        typeof home.showNextStudyItem === "boolean"
          ? home.showNextStudyItem
          : DEFAULT_SETTINGS.home.showNextStudyItem,

      showRocket:
        typeof home.showRocket === "boolean"
          ? home.showRocket
          : DEFAULT_SETTINGS.home.showRocket,

      showHabitList:
        typeof home.showHabitList === "boolean"
          ? home.showHabitList
          : DEFAULT_SETTINGS.home.showHabitList,

      showFinance:
        typeof home.showFinance === "boolean"
          ? home.showFinance
          : DEFAULT_SETTINGS.home.showFinance,
    },

    calendar: {
      weekStartsOnMonday:
        typeof calendar.weekStartsOnMonday === "boolean"
          ? calendar.weekStartsOnMonday
          : DEFAULT_SETTINGS.calendar.weekStartsOnMonday,

      defaultView: normalizeCalendarView(
        calendar.defaultView
      ),
    },

    privacy: {
      /*
       * 学習記録の共有は初期状態で無効。
       * この設定だけで外部への送信処理が追加されることはない。
       */
      shareStudyRecords:
        typeof privacy.shareStudyRecords === "boolean"
          ? privacy.shareStudyRecords
          : false,
    },
  };
}

/* ---------------------------------------------------------
   設定の取得
   --------------------------------------------------------- */

/**
 * 現在の設定を取得する
 */
export function getSettings() {
  const stored = loadObject(SETTINGS_STORAGE_KEY);
  return normalizeSettings(stored);
}

/**
 * 指定した設定項目を取得する
 *
 * 使用例：
 * getSetting("study.dailyGoalMinutes")
 */
export function getSetting(path) {
  if (typeof path !== "string" || !path.trim()) {
    return undefined;
  }

  const settings = getSettings();
  const keys = path.split(".");
  let current = settings;

  for (const key of keys) {
    if (
      !current ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

/* ---------------------------------------------------------
   設定の保存
   --------------------------------------------------------- */

/**
 * 設定全体を保存する
 */
export function saveSettings(settings) {
  if (!isPlainObject(settings)) {
    return {
      success: false,
      error: "設定データが正しくありません。",
    };
  }

  const normalized = normalizeSettings(settings);

  saveData(SETTINGS_STORAGE_KEY, normalized);

  notifySettingsChange();

  return {
    success: true,
    settings: normalized,
  };
}

/**
 * 指定した設定項目だけを変更する
 *
 * 使用例：
 * setSetting("study.dailyGoalMinutes", 180);
 * setSetting("appearance.animations", false);
 */
export function setSetting(path, value) {
  if (typeof path !== "string" || !path.trim()) {
    return {
      success: false,
      error: "設定項目が指定されていません。",
    };
  }

  const keys = path.split(".");
  const settings = getSettings();

  let current = settings;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];

    if (
      !Object.prototype.hasOwnProperty.call(current, key) ||
      !isPlainObject(current[key])
    ) {
      return {
        success: false,
        error: "変更できない設定項目です。",
      };
    }

    current = current[key];
  }

  const finalKey = keys[keys.length - 1];

  if (
    !Object.prototype.hasOwnProperty.call(current, finalKey)
  ) {
    return {
      success: false,
      error: "その設定項目は存在しません。",
    };
  }

  current[finalKey] = value;

  const result = saveSettings(settings);

  return result.success
    ? {
        success: true,
        value: getSetting(path),
      }
    : result;
}

/* ---------------------------------------------------------
   学習目標の専用関数
   --------------------------------------------------------- */

/**
 * 1日の学習目標を分単位で取得する
 */
export function getDailyStudyGoalMinutes() {
  return getSettings().study.dailyGoalMinutes;
}

/**
 * 1週間の学習目標を分単位で取得する
 */
export function getWeeklyStudyGoalMinutes() {
  return getSettings().study.weeklyGoalMinutes;
}

/**
 * 1日の学習目標を変更する
 */
export function setDailyStudyGoalMinutes(minutes) {
  const value = Number(minutes);

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 1440
  ) {
    return {
      success: false,
      error: "1日の目標は1〜1440分で設定してください。",
    };
  }

  return setSetting("study.dailyGoalMinutes", value);
}

/**
 * 1週間の学習目標を変更する
 */
export function setWeeklyStudyGoalMinutes(minutes) {
  const value = Number(minutes);

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10080
  ) {
    return {
      success: false,
      error: "週間目標は1〜10080分で設定してください。",
    };
  }

  return setSetting("study.weeklyGoalMinutes", value);
}

/**
 * 最低限の学習行動時間を変更する
 */
export function setMinimumActionMinutes(minutes) {
  const value = Number(minutes);

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 60
  ) {
    return {
      success: false,
      error: "最低行動時間は1〜60分で設定してください。",
    };
  }

  return setSetting("study.minimumActionMinutes", value);
}

/* ---------------------------------------------------------
   表示設定
   --------------------------------------------------------- */

/**
 * テーマを変更する
 *
 * cosmos：宇宙テーマ
 * dark：ダークテーマ
 * light：ライトテーマ
 */
export function setTheme(theme) {
  if (!["cosmos", "dark", "light"].includes(theme)) {
    return {
      success: false,
      error: "指定されたテーマは使用できません。",
    };
  }

  return setSetting("appearance.theme", theme);
}

/**
 * アニメーションの有効・無効を切り替える
 */
export function setAnimationsEnabled(enabled) {
  if (typeof enabled !== "boolean") {
    return {
      success: false,
      error: "trueまたはfalseを指定してください。",
    };
  }

  return setSetting("appearance.animations", enabled);
}

/**
 * ホーム画面のカード表示を変更する
 */
export function setHomeCardVisibility(cardName, visible) {
  const allowedCards = [
    "showDailyGoal",
    "showNextEvent",
    "showNextStudyItem",
    "showRocket",
    "showHabitList",
    "showFinance",
  ];

  if (!allowedCards.includes(cardName)) {
    return {
      success: false,
      error: "そのホーム画面項目は存在しません。",
    };
  }

  if (typeof visible !== "boolean") {
    return {
      success: false,
      error: "表示設定はtrueまたはfalseで指定してください。",
    };
  }

  return setSetting(`home.${cardName}`, visible);
}

/* ---------------------------------------------------------
   通知設定
   --------------------------------------------------------- */

/**
 * 学習リマインダーの設定を変更する
 *
 * 注意：
 * ここでは設定の保存のみ行う。
 * 実際の通知処理は別途実装する必要がある。
 */
export function setStudyReminder(enabled, time) {
  if (typeof enabled !== "boolean") {
    return {
      success: false,
      error: "通知の有効・無効を指定してください。",
    };
  }

  const settings = getSettings();

  settings.notifications.studyReminder = enabled;

  if (time !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) {
      return {
        success: false,
        error: "通知時刻はHH:MM形式で指定してください。",
      };
    }

    settings.notifications.studyReminderTime = time;
  }

  return saveSettings(settings);
}

/**
 * イベント通知の設定を変更する
 */
export function setEventReminder(enabled, daysBefore) {
  if (typeof enabled !== "boolean") {
    return {
      success: false,
      error: "通知の有効・無効を指定してください。",
    };
  }

  const settings = getSettings();

  settings.notifications.eventReminder = enabled;

  if (daysBefore !== undefined) {
    const days = Number(daysBefore);

    if (
      !Number.isInteger(days) ||
      days < 0 ||
      days > 365
    ) {
      return {
        success: false,
        error: "通知する日数は0〜365日で指定してください。",
      };
    }

    settings.notifications.countdownReminderDays = days;
  }

  return saveSettings(settings);
}

/* ---------------------------------------------------------
   設定の初期化
   --------------------------------------------------------- */

/**
 * 設定だけを初期状態に戻す
 *
 * 学習記録、カレンダー、目標、経済データは削除しない。
 */
export function resetSettings() {
  const defaults = normalizeSettings(DEFAULT_SETTINGS);

  saveData(SETTINGS_STORAGE_KEY, defaults);

  notifySettingsChange();

  return {
    success: true,
    settings: defaults,
  };
}

/* ---------------------------------------------------------
   変更通知
   --------------------------------------------------------- */

function notifySettingsChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("cosmos:settings-change", {
      detail: {
        settings: getSettings(),
      },
    })
  );
}
