
/* =========================================================
   ONE FOR ALL COSMOS
   js/countdown.js

   カウントダウン管理
   ・受験、定期テスト、提出期限などの登録
   ・追加、編集、削除
   ・残り日数の計算
   ・期限を過ぎたイベントの判定
   ・近日中のイベントの取得
   ・localStorageへの保存
   ========================================================= */

"use strict";

import {
  loadArray,
  saveData,
  createId,
} from "./storage.js";

const COUNTDOWN_STORAGE_KEY = "oneforall-countdowns-v1";

/* ---------------------------------------------------------
   日付処理
   --------------------------------------------------------- */

/**
 * 日付を YYYY-MM-DD 形式に統一する
 * UTC変換による日付ずれを防ぐ
 */
function normalizeDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const value = String(dateValue).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }

  return value;
}

/**
 * 今日の日付を YYYY-MM-DD で取得する
 */
function getLocalTodayKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * 日付文字列を日付番号に変換する
 */
function dateToDayNumber(dateString) {
  const normalized = normalizeDate(dateString);

  if (!normalized) {
    return NaN;
  }

  const [year, month, day] = normalized.split("-").map(Number);

  return Math.floor(
    Date.UTC(year, month - 1, day) / 86400000
  );
}

/**
 * 目標日までの日数を計算する
 *
 * 正の値：目標日までの日数
 * 0：目標日当日
 * 負の値：目標日を過ぎた日数
 */
export function getDaysRemaining(targetDate, referenceDate = getLocalTodayKey()) {
  const targetNumber = dateToDayNumber(targetDate);
  const referenceNumber = dateToDayNumber(referenceDate);

  if (
    !Number.isFinite(targetNumber) ||
    !Number.isFinite(referenceNumber)
  ) {
    return null;
  }

  return targetNumber - referenceNumber;
}

/* ---------------------------------------------------------
   データ取得・保存
   --------------------------------------------------------- */

/**
 * カウントダウン一覧を取得する
 */
export function getCountdowns() {
  return loadArray(COUNTDOWN_STORAGE_KEY)
    .filter((item) => {
      return (
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        normalizeDate(item.date)
      );
    })
    .map((item) => ({
      id: item.id,
      title: item.title,
      date: normalizeDate(item.date),
      type: item.type || "その他",
      notes: item.notes || "",
      pinned: Boolean(item.pinned),
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      return a.date.localeCompare(b.date);
    });
}

/**
 * カウントダウン一覧を保存する
 */
function saveCountdowns(countdowns) {
  saveData(COUNTDOWN_STORAGE_KEY, countdowns);
}

/**
 * IDからカウントダウンを取得する
 */
export function getCountdownById(id) {
  return getCountdowns().find((item) => item.id === id) || null;
}

/* ---------------------------------------------------------
   追加
   --------------------------------------------------------- */

/**
 * カウントダウンを追加する
 *
 * 使用例：
 * addCountdown({
 *   title: "大学受験",
 *   date: "2027-01-16",
 *   type: "受験",
 *   notes: "共通テスト",
 *   pinned: true
 * });
 */
export function addCountdown({
  title,
  date,
  type = "その他",
  notes = "",
  pinned = false,
} = {}) {
  const cleanTitle = String(title || "").trim();
  const cleanDate = normalizeDate(date);

  if (!cleanTitle) {
    return {
      success: false,
      error: "イベント名を入力してください。",
    };
  }

  if (!cleanDate) {
    return {
      success: false,
      error: "正しい日付を指定してください。",
    };
  }

  const countdowns = getCountdowns();
  const now = new Date().toISOString();

  const countdown = {
    id: createId(),
    title: cleanTitle,
    date: cleanDate,
    type: String(type || "その他").trim() || "その他",
    notes: String(notes || "").trim(),
    pinned: Boolean(pinned),
    createdAt: now,
    updatedAt: now,
  };

  countdowns.push(countdown);
  saveCountdowns(countdowns);

  return {
    success: true,
    data: countdown,
  };
}

/* ---------------------------------------------------------
   編集
   --------------------------------------------------------- */

/**
 * カウントダウンを編集する
 *
 * 使用例：
 * updateCountdown("イベントID", {
 *   title: "変更後のイベント名",
 *   date: "2027-02-01"
 * });
 */
export function updateCountdown(id, changes = {}) {
  const countdowns = getCountdowns();
  const index = countdowns.findIndex((item) => item.id === id);

  if (index === -1) {
    return {
      success: false,
      error: "イベントが見つかりません。",
    };
  }

  const current = countdowns[index];

  const nextTitle =
    changes.title === undefined
      ? current.title
      : String(changes.title || "").trim();

  const nextDate =
    changes.date === undefined
      ? current.date
      : normalizeDate(changes.date);

  if (!nextTitle) {
    return {
      success: false,
      error: "イベント名を入力してください。",
    };
  }

  if (!nextDate) {
    return {
      success: false,
      error: "正しい日付を指定してください。",
    };
  }

  countdowns[index] = {
    ...current,
    title: nextTitle,
    date: nextDate,
    type:
      changes.type === undefined
        ? current.type
        : String(changes.type || "その他").trim() || "その他",
    notes:
      changes.notes === undefined
        ? current.notes
        : String(changes.notes || "").trim(),
    pinned:
      changes.pinned === undefined
        ? current.pinned
        : Boolean(changes.pinned),
    updatedAt: new Date().toISOString(),
  };

  saveCountdowns(countdowns);

  return {
    success: true,
    data: countdowns[index],
  };
}

/* ---------------------------------------------------------
   削除
   --------------------------------------------------------- */

/**
 * カウントダウンを削除する
 */
export function deleteCountdown(id) {
  const countdowns = getCountdowns();
  const filtered = countdowns.filter((item) => item.id !== id);

  if (filtered.length === countdowns.length) {
    return {
      success: false,
      error: "イベントが見つかりません。",
    };
  }

  saveCountdowns(filtered);

  return {
    success: true,
  };
}

/* ---------------------------------------------------------
   状態判定
   --------------------------------------------------------- */

/**
 * イベントの残り日数や状態を取得する
 */
export function getCountdownStatus(
  countdownOrId,
  referenceDate = getLocalTodayKey()
) {
  const countdown =
    typeof countdownOrId === "string"
      ? getCountdownById(countdownOrId)
      : countdownOrId;

  if (!countdown) {
    return null;
  }

  const daysRemaining = getDaysRemaining(
    countdown.date,
    referenceDate
  );

  if (daysRemaining === null) {
    return null;
  }

  let status;
  let label;

  if (daysRemaining > 0) {
    status = "upcoming";
    label = `あと${daysRemaining}日`;
  } else if (daysRemaining === 0) {
    status = "today";
    label = "今日";
  } else {
    status = "past";
    label = `${Math.abs(daysRemaining)}日経過`;
  }

  return {
    id: countdown.id,
    title: countdown.title,
    date: countdown.date,
    type: countdown.type,
    notes: countdown.notes,
    pinned: countdown.pinned,
    daysRemaining,
    status,
    label,
  };
}

/* ---------------------------------------------------------
   一覧の絞り込み
   --------------------------------------------------------- */

/**
 * 未来のイベントを近い順に取得する
 *
 * options.limit：取得件数
 * options.includeToday：今日のイベントを含めるか
 */
export function getUpcomingCountdowns({
  limit = 10,
  includeToday = true,
  referenceDate = getLocalTodayKey(),
} = {}) {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));

  return getCountdowns()
    .map((item) => getCountdownStatus(item, referenceDate))
    .filter((item) => {
      if (!item) {
        return false;
      }

      return includeToday
        ? item.daysRemaining >= 0
        : item.daysRemaining > 0;
    })
    .sort((a, b) => {
      if (a.daysRemaining !== b.daysRemaining) {
        return a.daysRemaining - b.daysRemaining;
      }

      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      return a.date.localeCompare(b.date);
    })
    .slice(0, safeLimit);
}

/**
 * 期限を過ぎたイベントを取得する
 */
export function getPastCountdowns({
  referenceDate = getLocalTodayKey(),
} = {}) {
  return getCountdowns()
    .map((item) => getCountdownStatus(item, referenceDate))
    .filter((item) => item && item.daysRemaining < 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * カウントダウン全体の概要を取得する
 */
export function getCountdownSummary(
  referenceDate = getLocalTodayKey()
) {
  const countdowns = getCountdowns();
  const statuses = countdowns
    .map((item) => getCountdownStatus(item, referenceDate))
    .filter(Boolean);

  const today = statuses.filter(
    (item) => item.daysRemaining === 0
  );

  const upcoming = statuses.filter(
    (item) => item.daysRemaining > 0
  );

  const past = statuses.filter(
    (item) => item.daysRemaining < 0
  );

  const nextEvent = [...statuses]
    .filter((item) => item.daysRemaining >= 0)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)[0] || null;

  return {
    total: countdowns.length,
    todayCount: today.length,
    upcomingCount: upcoming.length,
    pastCount: past.length,
    nextEvent,
    todayEvents: today,
  };
}

/* ---------------------------------------------------------
   変更通知
   --------------------------------------------------------- */

/**
 * 画面側で更新を検知するための通知
 */
export function notifyCountdownChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("cosmos:countdown-change")
  );
}
