
/* =========================================================
   ONE FOR ALL COSMOS
   js/notifications.js

   通知管理
   ・ブラウザ通知の許可状態
   ・学習リマインダー
   ・期限が近いイベントの確認
   ・通知済みデータの保存
   ・同じ通知の重複防止

   注意：
   ブラウザ通知は対応環境や許可状態に依存します。
   このファイルだけでは定刻に自動実行されません。
   ========================================================= */

"use strict";

import {
  loadObject,
  saveData,
} from "./storage.js";

import {
  getSettings,
} from "./settings.js";

import {
  getUpcomingCountdowns,
} from "./countdown.js";

const NOTIFICATION_STORAGE_KEY =
  "oneforall-notifications-v1";

const MAX_NOTIFICATION_HISTORY = 1000;

/* ---------------------------------------------------------
   保存データ
   --------------------------------------------------------- */

function getNotificationData() {
  const data = loadObject(NOTIFICATION_STORAGE_KEY);

  return {
    version: 1,
    sent: Array.isArray(data.sent) ? data.sent : [],
    lastStudyReminderDate:
      typeof data.lastStudyReminderDate === "string"
        ? data.lastStudyReminderDate
        : "",
  };
}

function saveNotificationData(data) {
  data.sent = data.sent.slice(-MAX_NOTIFICATION_HISTORY);

  saveData(NOTIFICATION_STORAGE_KEY, data);
}

/* ---------------------------------------------------------
   日付処理
   --------------------------------------------------------- */

function getTodayKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentTimeKey() {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

/* ---------------------------------------------------------
   対応状況
   --------------------------------------------------------- */

/**
 * このブラウザで通知APIが使えるか確認する
 */
export function isNotificationSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window
  );
}

/**
 * 現在の通知許可状態を取得する
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) {
    return "unsupported";
  }

  return Notification.permission;
}

/* ---------------------------------------------------------
   通知許可
   --------------------------------------------------------- */

/**
 * ユーザー操作から呼び出して通知許可を求める
 *
 * 例：
 * ボタンのクリック時に requestNotificationPermission() を実行する
 */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return {
      success: false,
      permission: "unsupported",
      error: "この環境ではブラウザ通知を利用できません。",
    };
  }

  if (Notification.permission === "granted") {
    return {
      success: true,
      permission: "granted",
    };
  }

  if (Notification.permission === "denied") {
    return {
      success: false,
      permission: "denied",
      error: "通知がブラウザの設定で拒否されています。",
    };
  }

  try {
    const permission = await Notification.requestPermission();

    return {
      success: permission === "granted",
      permission,
    };
  } catch {
    return {
      success: false,
      permission: "default",
      error: "通知の許可を取得できませんでした。",
    };
  }
}

/* ---------------------------------------------------------
   通知履歴
   --------------------------------------------------------- */

function wasSent(notificationId) {
  const data = getNotificationData();

  return data.sent.some(
    (item) => item.id === notificationId
  );
}

function markAsSent(notificationId) {
  const data = getNotificationData();

  if (data.sent.some((item) => item.id === notificationId)) {
    return;
  }

  data.sent.push({
    id: notificationId,
    sentAt: new Date().toISOString(),
  });

  saveNotificationData(data);
}

/**
 * 保存された通知履歴を取得する
 */
export function getNotificationHistory(limit = 50) {
  const safeLimit = Math.max(
    0,
    Math.min(500, Math.floor(Number(limit) || 0))
  );

  return getNotificationData()
    .sent
    .slice(-safeLimit)
    .reverse();
}

/* ---------------------------------------------------------
   通知の表示
   --------------------------------------------------------- */

/**
 * 通知を表示する
 *
 * 同じnotificationIdの通知は重複表示しない。
 *
 * options:
 *   body：本文
 *   tag：通知グループ
 *   requireInteraction：通知を画面に残すか
 */
export function showNotification(
  notificationId,
  title,
  {
    body = "",
    tag = "one-for-all-cosmos",
    requireInteraction = false,
  } = {}
) {
  if (!notificationId || !title) {
    return {
      success: false,
      error: "通知IDとタイトルが必要です。",
    };
  }

  if (!isNotificationSupported()) {
    return {
      success: false,
      error: "この環境では通知を利用できません。",
    };
  }

  if (Notification.permission !== "granted") {
    return {
      success: false,
      error: "通知の許可が必要です。",
    };
  }

  if (wasSent(notificationId)) {
    return {
      success: false,
      duplicate: true,
      error: "この通知はすでに表示済みです。",
    };
  }

  try {
    const notification = new Notification(String(title), {
      body: String(body),
      tag: String(tag),
      requireInteraction: Boolean(requireInteraction),
    });

    markAsSent(notificationId);

    return {
      success: true,
      notification,
    };
  } catch {
    return {
      success: false,
      error: "通知を表示できませんでした。",
    };
  }
}

/* ---------------------------------------------------------
   学習リマインダー
   --------------------------------------------------------- */

/**
 * 設定された時刻に学習リマインダーを出すべきか確認する
 *
 * この関数を定期的に呼び出す処理は別途必要。
 */
export function checkStudyReminder({
  date = getTodayKey(),
  time = getCurrentTimeKey(),
} = {}) {
  const settings = getSettings();
  const notificationSettings = settings.notifications;

  if (!notificationSettings.enabled) {
    return {
      shouldNotify: false,
      reason: "notifications-disabled",
    };
  }

  if (!notificationSettings.studyReminder) {
    return {
      shouldNotify: false,
      reason: "study-reminder-disabled",
    };
  }

  if (time !== notificationSettings.studyReminderTime) {
    return {
      shouldNotify: false,
      reason: "not-reminder-time",
    };
  }

  const data = getNotificationData();

  if (data.lastStudyReminderDate === date) {
    return {
      shouldNotify: false,
      reason: "already-notified-today",
    };
  }

  return {
    shouldNotify: true,
    date,
    time,
  };
}

/**
 * 学習リマインダーを表示する
 */
export function sendStudyReminder() {
  const check = checkStudyReminder();

  if (!check.shouldNotify) {
    return {
      success: false,
      reason: check.reason,
    };
  }

  const result = showNotification(
    `study-reminder-${check.date}`,
    "学習の時間です",
    {
      body: "まずは5分だけ、今日の学習を始めてみましょう。",
      tag: "cosmos-study-reminder",
    }
  );

  if (result.success) {
    const data = getNotificationData();

    data.lastStudyReminderDate = check.date;

    saveNotificationData(data);
  }

  return result;
}

/* ---------------------------------------------------------
   カウントダウン通知
   --------------------------------------------------------- */

/**
 * 期限が近いイベントを確認する
 *
 * 通知の対象日数は設定画面の値を使う。
 */
export function checkCountdownReminders() {
  const settings = getSettings();
  const notificationSettings = settings.notifications;

  if (!notificationSettings.enabled) {
    return [];
  }

  if (!notificationSettings.eventReminder) {
    return [];
  }

  const daysBefore =
    notificationSettings.countdownReminderDays;

  const upcoming = getUpcomingCountdowns({
    limit: 500,
    includeToday: true,
  });

  return upcoming.filter((event) => {
    return (
      event.daysRemaining === 0 ||
      event.daysRemaining === daysBefore
    );
  });
}

/**
 * 期限が近いイベントの通知を表示する
 */
export function sendCountdownReminders() {
  const events = checkCountdownReminders();
  const results = [];

  for (const event of events) {
    const notificationId =
      `countdown-${event.id}-${getTodayKey()}`;

    results.push(
      showNotification(
        notificationId,
        event.daysRemaining === 0
          ? `今日が期限：${event.title}`
          : `あと${event.daysRemaining}日：${event.title}`,
        {
          body: `${event.date} の予定を確認しましょう。`,
          tag: `cosmos-countdown-${event.id}`,
        }
      )
    );
  }

  return results;
}

/* ---------------------------------------------------------
   通知確認用のまとめ
   --------------------------------------------------------- */

/**
 * 通知機能の状態を取得する
 */
export function getNotificationSummary() {
  const settings = getSettings();

  return {
    supported: isNotificationSupported(),
    permission: getNotificationPermission(),
    enabled: settings.notifications.enabled,
    studyReminder: settings.notifications.studyReminder,
    studyReminderTime:
      settings.notifications.studyReminderTime,
    eventReminder: settings.notifications.eventReminder,
    countdownReminderDays:
      settings.notifications.countdownReminderDays,
    historyCount: getNotificationData().sent.length,
  };
}
