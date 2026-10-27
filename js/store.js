
/* =========================================================
   ONE FOR ALL COSMOS
   js/store.js

   共通データ保存システム
   ・学習記録
   ・学習タイマー
   ・カレンダー / タスク
   ・目標マップ
   ・ロケット進行状況
   ・経済
   ・カウントダウン
   ・設定

   注意：
   既存の学習・タイマー・カレンダーの保存キーは維持する。
   ========================================================= */

"use strict";

/* =========================================================
   1. 保存キー
   ========================================================= */

export const STORE_KEYS = Object.freeze({
  study: "oneforall-study-v1",
  timer: "oneforall-timer-v1",
  calendar: "personal-calendar-v1",

  goals: "oneforall-goals-v1",
  rocket: "oneforall-rocket-v1",
  economy: "oneforall-economy-v1",
  countdown: "oneforall-countdown-v1",
  settings: "oneforall-settings-v1"
});

/* =========================================================
   2. 保存領域へのアクセス
   ========================================================= */

function getStorage() {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }

    return localStorage;
  } catch (error) {
    console.error(
      "[COSMOS Store] 保存領域にアクセスできません。",
      error
    );

    return null;
  }
}

/* =========================================================
   3. データの読み込み
   ========================================================= */

/**
 * 保存データを読み込む。
 *
 * @param {string} key 保存キー
 * @param {*} fallback データがない場合の初期値
 * @returns {*} 読み込んだデータ
 */
export function loadData(key, fallback = null) {
  const storage = getStorage();

  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(key);

    if (raw === null) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      `[COSMOS Store] 読み込みに失敗しました: ${key}`,
      error
    );

    return fallback;
  }
}

/* =========================================================
   4. データの保存
   ========================================================= */

/**
 * データを保存する。
 *
 * @param {string} key 保存キー
 * @param {*} value 保存するデータ
 * @returns {boolean} 保存できたか
 */
export function saveData(key, value) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      console.error(
        `[COSMOS Store] 保存できないデータです: ${key}`
      );

      return false;
    }

    storage.setItem(key, serialized);

    return true;
  } catch (error) {
    console.error(
      `[COSMOS Store] 保存に失敗しました: ${key}`,
      error
    );

    return false;
  }
}

/* =========================================================
   5. データの更新
   ========================================================= */

/**
 * 現在のデータを取得し、更新して保存する。
 *
 * @param {string} key 保存キー
 * @param {Function} updater 更新処理
 * @param {*} fallback データがない場合の初期値
 * @returns {*} 更新後のデータ
 */
export function updateData(
  key,
  updater,
  fallback = null
) {
  if (typeof updater !== "function") {
    throw new TypeError(
      "updateData の updater には関数を指定してください。"
    );
  }

  const current = loadData(key, fallback);
  const updated = updater(current);

  if (updated === undefined) {
    console.error(
      `[COSMOS Store] 更新結果が undefined です: ${key}`
    );

    return current;
  }

  if (!saveData(key, updated)) {
    return current;
  }

  return updated;
}

/* =========================================================
   6. データの削除
   ========================================================= */

/**
 * 指定した保存キーのデータを削除する。
 *
 * 全データを一括削除する機能ではない。
 *
 * @param {string} key 保存キー
 * @returns {boolean} 削除できたか
 */
export function removeData(key) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    console.error(
      `[COSMOS Store] 削除に失敗しました: ${key}`,
      error
    );

    return false;
  }
}

/* =========================================================
   7. 機能別の読み込み・保存
   ========================================================= */

export const store = Object.freeze({

  /* 学習記録 */
  study: {
    load(fallback = {}) {
      return loadData(STORE_KEYS.study, fallback);
    },

    save(data) {
      return saveData(STORE_KEYS.study, data);
    },

    update(updater, fallback = {}) {
      return updateData(
        STORE_KEYS.study,
        updater,
        fallback
      );
    }
  },

  /* タイマー */
  timer: {
    load(fallback = {}) {
      return loadData(STORE_KEYS.timer, fallback);
    },

    save(data) {
      return saveData(STORE_KEYS.timer, data);
    },

    update(updater, fallback = {}) {
      return updateData(
        STORE_KEYS.timer,
        updater,
        fallback
      );
    }
  },

  /* カレンダー・予定・タスク */
  calendar: {
    load(fallback = {}) {
      return loadData(STORE_KEYS.calendar, fallback);
    },

    save(data) {
      return saveData(STORE_KEYS.calendar, data);
    },

    update(updater, fallback = {}) {
      return updateData(
        STORE_KEYS.calendar,
        updater,
        fallback
      );
    }
  },

  /* 目標マップ */
  goals: {
    load(fallback = {}) {
      return loadData(STORE_KEYS.goals, fallback);
    },

    save(data) {
      return saveData(STORE_KEYS.goals, data);
    },

    update(updater, fallback = {}) {
      return updateData(
        STORE_KEYS.goals,
        updater,
        fallback
      );
    }
  },

  /* ロケット・宇宙進行 */
  rocket: {
    load(fallback = {}) {
      return loadData(STORE_KEYS.rocket, fallback);
    },

    save(data) {
      return saveData(STORE_KEYS.rocket, data);
    },

    update(updater, fallback = {}) {
      return updateData(
        STORE_KEYS.rocket,
        updater,
        fallback
      );
    }
  },

  /* 経済 */
  economy: {
    load(fallback = {}) {
      return loadData(STORE_KEYS.economy, fallback);
    },

    save(data) {
      return saveData(STORE_KEYS.economy, data);
    },

    update(updater, fallback = {}) {
      return updateData(
        STORE_KEYS.economy,
        updater,
        fallback
      );
    }
  },

  /* カウントダウン */
  countdown: {
    load(fallback = []) {
      return loadData(STORE_KEYS.countdown, fallback);
    },

    save(data) {
      return saveData(STORE_KEYS.countdown, data);
    },

    update(updater, fallback = []) {
      return updateData(
        STORE_KEYS.countdown,
        updater,
        fallback
      );
    }
  },

  /* 設定 */
  settings: {
    load(fallback = {}) {
      return loadData(STORE_KEYS.settings, fallback);
    },

    save(data) {
      return saveData(STORE_KEYS.settings, data);
    },

    update(updater, fallback = {}) {
      return updateData(
        STORE_KEYS.settings,
        updater,
        fallback
      );
    }
  }
});

/* =========================================================
   8. 保存データの確認
   ========================================================= */

/**
 * 各機能の保存データが存在するか確認する。
 * データの変更や削除は行わない。
 *
 * @returns {Object} 保存状況
 */
export function getStorageStatus() {
  const storage = getStorage();
  const result = {};

  for (const [name, key] of Object.entries(STORE_KEYS)) {
    if (!storage) {
      result[name] = false;
      continue;
    }

    try {
      result[name] = storage.getItem(key) !== null;
    } catch {
      result[name] = false;
    }
  }

  return result;
}

/* =========================================================
   9. 保存データの容量確認
   ========================================================= */

/**
 * このアプリの保存データのおおよその文字数を調べる。
 *
 * @returns {number} 保存データの文字数
 */
export function getStorageUsage() {
  const storage = getStorage();

  if (!storage) {
    return 0;
  }

  let total = 0;

  for (const key of Object.values(STORE_KEYS)) {
    try {
      const value = storage.getItem(key);

      if (value !== null) {
        total += key.length + value.length;
      }
    } catch (error) {
      console.warn(
        `[COSMOS Store] 容量確認に失敗しました: ${key}`,
        error
      );
    }
  }

  return total;
}

/* =========================================================
   10. 既存コードとの共存
   ========================================================= */

/*
  このファイルは保存処理の共通土台です。

  重要：
  ・既存データを自動削除しない。
  ・既存の保存キーを変更しない。
  ・保存データの形式を勝手に書き換えない。
  ・既存の学習記録や予定を初期化しない。
  ・日利や返済期限などの経済ルールはここでは処理しない。

  各機能のファイルから必要な関数を import して使用します。

  使用例：

  import { store } from "./store.js";

  const data = store.study.load({});

  store.study.save(data);

  経済データの例：

  const economyData = store.economy.load({});

  store.economy.save(economyData);

  ※このファイルを作成しただけでは、既存機能との接続は
    完了していません。次の実装で各ファイルを接続します。
*/
