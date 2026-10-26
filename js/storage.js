/* =========================================================
   One for All — COSMOS
   js/storage.js

   共通データ保存・読み込み・日付・通知処理

   注意：
   ・ブラウザの localStorage に保存
   ・JSONの読み込みエラーに対応
   ・既存の保存キーをできる限り維持
   ・このファイルでは画面操作を行わない
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   1. 保存キー
   --------------------------------------------------------- */

export const STORAGE_KEYS = Object.freeze({
  study: "oneforall-study-v1",
  timer: "oneforall-timer-v1",
  goals: "oneforall-goals-v1",
  calendar: "personal-calendar-v1",
  countdowns: "oneforall-countdowns-v1",
  rocket: "oneforall-rocket-v1",
  statistics: "oneforall-statistics-v1"
});


/* ---------------------------------------------------------
   2. localStorage の利用確認
   --------------------------------------------------------- */

export function canUseStorage() {
  try {
    if (typeof localStorage === "undefined") {
      return false;
    }

    const testKey = "__ofa_storage_test__";

    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);

    return true;
  } catch (error) {
    console.error(
      "[COSMOS] 保存領域を利用できません。",
      error
    );

    return false;
  }
}


/* ---------------------------------------------------------
   3. データ読み込み
   --------------------------------------------------------- */

/**
 * 保存されたJSONデータを読み込む。
 *
 * @param {string} key 保存キー
 * @param {*} fallback 保存データがない場合の初期値
 * @returns {*} 読み込んだデータ
 */
export function loadData(key, fallback = null) {
  try {
    if (typeof localStorage === "undefined") {
      return fallback;
    }

    const raw = localStorage.getItem(key);

    if (raw === null) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      `[COSMOS] データ読み込み失敗: ${key}`,
      error
    );

    return fallback;
  }
}


/* ---------------------------------------------------------
   4. データ保存
   --------------------------------------------------------- */

/**
 * データをJSON形式で保存する。
 *
 * @param {string} key 保存キー
 * @param {*} value 保存するデータ
 * @returns {boolean} 保存できた場合は true
 */
export function saveData(key, value) {
  try {
    if (typeof localStorage === "undefined") {
      console.error(
        "[COSMOS] localStorage が利用できません。"
      );

      return false;
    }

    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      console.error(
        `[COSMOS] 保存できないデータ形式です: ${key}`
      );

      return false;
    }

    localStorage.setItem(key, serialized);

    return true;
  } catch (error) {
    console.error(
      `[COSMOS] データ保存失敗: ${key}`,
      error
    );

    return false;
  }
}


/* ---------------------------------------------------------
   5. データ削除
   --------------------------------------------------------- */

/**
 * 指定された保存キーのデータを削除する。
 *
 * 通常の機能から安易に呼び出さないこと。
 *
 * @param {string} key 保存キー
 * @returns {boolean}
 */
export function removeData(key) {
  try {
    if (typeof localStorage === "undefined") {
      return false;
    }

    localStorage.removeItem(key);

    return true;
  } catch (error) {
    console.error(
      `[COSMOS] データ削除失敗: ${key}`,
      error
    );

    return false;
  }
}


/* ---------------------------------------------------------
   6. 共通ID生成
   --------------------------------------------------------- */

/**
 * データの識別用IDを生成する。
 *
 * @param {string} prefix IDの接頭辞
 * @returns {string}
 */
export function createId(prefix = "item") {
  const randomPart =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : [
          Date.now().toString(36),
          Math.random().toString(36).slice(2, 11)
        ].join("-");

  return `${prefix}-${randomPart}`;
}


/* ---------------------------------------------------------
   7. 日付ユーティリティ
   --------------------------------------------------------- */

/**
 * 日付を YYYY-MM-DD 形式に変換する。
 *
 * Date オブジェクトを渡した場合はローカル日付を使う。
 *
 * @param {Date|string|number} value
 * @returns {string}
 */
export function toDateKey(value = new Date()) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "[COSMOS] 無効な日付が指定されました。"
    );
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/**
 * 今日の日付キーを取得する。
 *
 * @returns {string}
 */
export function getTodayKey() {
  return toDateKey(new Date());
}


/**
 * YYYY-MM-DD 形式の日付をローカル時間の
 * Date オブジェクトに変換する。
 *
 * UTC変換による日付ずれを防ぐ。
 *
 * @param {string} dateKey
 * @returns {Date|null}
 */
export function parseDateKey(dateKey) {
  if (typeof dateKey !== "string") {
    return null;
  }

  const match = dateKey.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}


/**
 * 日付を日本語表示にする。
 *
 * @param {string|Date} value
 * @param {object} options
 * @returns {string}
 */
export function formatDateJP(
  value,
  options = {}
) {
  const date =
    value instanceof Date
      ? value
      : parseDateKey(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "日付未設定";
  }

  const defaultOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  };

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      ...defaultOptions,
      ...options
    }
  ).format(date);
}


/**
 * 日付に指定日数を加える。
 *
 * @param {string} dateKey YYYY-MM-DD
 * @param {number} amount 加算日数
 * @returns {string}
 */
export function addDays(dateKey, amount) {
  const date = parseDateKey(dateKey);

  if (!date) {
    throw new Error(
      "[COSMOS] 日付の形式が正しくありません。"
    );
  }

  date.setDate(
    date.getDate() + Number(amount)
  );

  return toDateKey(date);
}


/**
 * 2つの日付が同じ日か確認する。
 *
 * @param {string|Date} a
 * @param {string|Date} b
 * @returns {boolean}
 */
export function isSameDate(a, b) {
  try {
    const first =
      a instanceof Date ? toDateKey(a) : a;

    const second =
      b instanceof Date ? toDateKey(b) : b;

    return first === second;
  } catch {
    return false;
  }
}


/* ---------------------------------------------------------
   8. 数値ユーティリティ
   --------------------------------------------------------- */

/**
 * 値を指定範囲内に収める。
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(
    max,
    Math.max(min, number)
  );
}


/**
 * 0以上の整数に変換する。
 *
 * @param {*} value
 * @returns {number}
 */
export function toNonNegativeInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(number)
  );
}


/**
 * 分数を「○時間○分」で表示する。
 *
 * @param {number} totalMinutes
 * @returns {string}
 */
export function formatDuration(totalMinutes) {
  const minutes = toNonNegativeInteger(
    totalMinutes
  );

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}分`;
  }

  if (remainder === 0) {
    return `${hours}時間`;
  }

  return `${hours}時間${remainder}分`;
}


/**
 * CRを日本語環境の数値形式で表示する。
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatCredits(amount) {
  const number = Number(amount);

  if (!Number.isFinite(number)) {
    return "0 CR";
  }

  return `${Math.floor(number).toLocaleString("ja-JP")} CR`;
}


/* ---------------------------------------------------------
   9. 通知
   --------------------------------------------------------- */

/**
 * HTML内の #toast に通知を表示する。
 *
 * CSS側では以下のクラスに対応する。
 * .toast.show
 *
 * @param {string} message
 * @param {number} duration 表示時間（ミリ秒）
 */
let toastTimeoutId = null;

export function showToast(
  message,
  duration = 2400
) {
  const toast = document.getElementById("toast");

  if (!toast) {
    console.info(`[COSMOS] ${message}`);
    return;
  }

  if (toastTimeoutId !== null) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }

  toast.textContent = String(message);
  toast.classList.add("show");
  toast.setAttribute("aria-live", "polite");

  toastTimeoutId = setTimeout(() => {
    toast.classList.remove("show");
    toastTimeoutId = null;
  }, Math.max(500, Number(duration) || 2400));
}


/* ---------------------------------------------------------
   10. 安全なHTML文字列変換
   --------------------------------------------------------- */

/**
 * HTMLに挿入する文字列の特殊文字を変換する。
 *
 * ユーザーが入力した科目名・予定名などを
 * HTML文字列に挿入する場合に使用する。
 *
 * @param {*} value
 * @returns {string}
 */
export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => {
      const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return replacements[character];
    }
  );
}


/* ---------------------------------------------------------
   11. 初期化用の共通確認
   --------------------------------------------------------- */

export function initializeStorage() {
  const available = canUseStorage();

  if (!available) {
    console.warn(
      "[COSMOS] 保存機能を利用できない可能性があります。"
    );

    return false;
  }

  console.info(
    "[COSMOS] 保存領域を確認しました。"
  );

  return true;
}