
/* =========================================================
   ONE FOR ALL COSMOS
   js/rocket.js

   宇宙開発・ロケット進行システム
   ・ロケットの発射 / 飛行 / 着陸
   ・燃料管理
   ・月までの飛行距離と進捗率
   ・学習などによる進捗追加
   ・発射記録 / 月到達記録
   ・データ自動保存
   ========================================================= */

"use strict";

import { store } from "./store.js";

/* =========================================================
   基本設定
   ========================================================= */

const ROCKET_CONFIG = Object.freeze({
  version: 1,

  // 月までの距離をシステム上の単位として表現
  moonDistance: 384400,

  // 初期燃料
  initialFuel: 100,

  // 進捗を追加できる1回あたりの最大値
  maxProgressPerAction: 10000,

  // 初期ロケット名
  defaultRocketName: "COSMOS-01",

  // 初期状態
  defaultStatus: "ready"
});

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
    "rocket-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  const factor = 10 ** digits;

  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNonNegative(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, number);
}

function isValidStatus(status) {
  return [
    "ready",
    "flying",
    "landed",
    "failed"
  ].includes(status);
}

function createDateLabel() {
  return new Date().toISOString();
}

/* =========================================================
   初期データ
   ========================================================= */

function createDefaultData() {
  return {
    version: ROCKET_CONFIG.version,

    rocket: {
      id: createId(),
      name: ROCKET_CONFIG.defaultRocketName,
      status: ROCKET_CONFIG.defaultStatus,

      fuel: ROCKET_CONFIG.initialFuel,
      maxFuel: ROCKET_CONFIG.initialFuel,

      distance: 0,

      launchedAt: null,
      landedAt: null
    },

    totalDistance: 0,

    totalProgressAdded: 0,

    launchCount: 0,

    moonReached: false,

    moonReachedAt: null,

    launchHistory: [],

    progressHistory: [],

    lastUpdated: Date.now()
  };
}

/* =========================================================
   データの正規化
   ========================================================= */

function normalizeRocketData(saved) {
  const defaults = createDefaultData();

  if (!saved || typeof saved !== "object") {
    return defaults;
  }

  const oldRocket = saved.rocket || {};

  const maxFuel = Math.max(
    1,
    normalizeNonNegative(
      oldRocket.maxFuel ?? ROCKET_CONFIG.initialFuel
    )
  );

  const fuel = clamp(
    normalizeNonNegative(
      oldRocket.fuel ?? ROCKET_CONFIG.initialFuel
    ),
    0,
    maxFuel
  );

  const distance = Math.min(
    ROCKET_CONFIG.moonDistance,
    normalizeNonNegative(oldRocket.distance)
  );

  return {
    version: ROCKET_CONFIG.version,

    rocket: {
      id: String(oldRocket.id || createId()),
      name: String(
        oldRocket.name || ROCKET_CONFIG.defaultRocketName
      ),

      status: isValidStatus(oldRocket.status)
        ? oldRocket.status
        : ROCKET_CONFIG.defaultStatus,

      fuel,
      maxFuel,

      distance,

      launchedAt: oldRocket.launchedAt || null,
      landedAt: oldRocket.landedAt || null
    },

    totalDistance: normalizeNonNegative(
      saved.totalDistance
    ),

    totalProgressAdded: normalizeNonNegative(
      saved.totalProgressAdded
    ),

    launchCount: Math.floor(
      normalizeNonNegative(saved.launchCount)
    ),

    moonReached: Boolean(saved.moonReached),

    moonReachedAt: saved.moonReachedAt || null,

    launchHistory: Array.isArray(saved.launchHistory)
      ? saved.launchHistory
      : [],

    progressHistory: Array.isArray(saved.progressHistory)
      ? saved.progressHistory
      : [],

    lastUpdated: Number(saved.lastUpdated) || Date.now()
  };
}

/* =========================================================
   読み込み・保存
   ========================================================= */

function loadRocketData() {
  try {
    return normalizeRocketData(store.rocket.load(null));
  } catch (error) {
    console.error("[Rocket] 読み込みエラー:", error);
    return createDefaultData();
  }
}

let data = loadRocketData();

function saveRocketData() {
  data.lastUpdated = Date.now();

  try {
    return store.rocket.save(data);
  } catch (error) {
    console.error("[Rocket] 保存エラー:", error);
    return false;
  }
}

/* =========================================================
   基本情報
   ========================================================= */

function getRocket() {
  return clone(data.rocket);
}

function getRocketStatus() {
  return data.rocket.status;
}

function getRocketName() {
  return data.rocket.name;
}

function renameRocket(name) {
  const nextName = String(name || "").trim();

  if (!nextName) {
    return {
      success: false,
      message: "ロケット名を入力してください。"
    };
  }

  data.rocket.name = nextName;

  const saved = saveRocketData();

  return {
    success: saved !== false,
    name: data.rocket.name,
    message: "ロケット名を更新しました。"
  };
}

/* =========================================================
   月までの進捗
   ========================================================= */

function getDistanceToMoon() {
  return Math.max(
    0,
    ROCKET_CONFIG.moonDistance - data.rocket.distance
  );
}

function getProgressPercentage() {
  if (data.moonReached) {
    return 100;
  }

  return roundNumber(
    (data.rocket.distance / ROCKET_CONFIG.moonDistance) * 100,
    2
  );
}

function getProgressDetails() {
  return {
    rocketName: data.rocket.name,

    status: data.rocket.status,

    distance: roundNumber(data.rocket.distance),

    moonDistance: ROCKET_CONFIG.moonDistance,

    distanceRemaining: roundNumber(getDistanceToMoon()),

    percentage: getProgressPercentage(),

    fuel: data.rocket.fuel,

    maxFuel: data.rocket.maxFuel,

    fuelPercentage: roundNumber(
      (data.rocket.fuel / data.rocket.maxFuel) * 100,
      2
    ),

    launchCount: data.launchCount,

    moonReached: data.moonReached,

    moonReachedAt: data.moonReachedAt
  };
}

/* =========================================================
   燃料管理
   ========================================================= */

function addFuel(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return {
      success: false,
      message: "追加する燃料は0より大きい数値にしてください。"
    };
  }

  if (data.rocket.status === "flying") {
    return {
      success: false,
      message: "飛行中は燃料を追加できません。"
    };
  }

  const before = data.rocket.fuel;

  data.rocket.fuel = roundNumber(
    clamp(
      before + value,
      0,
      data.rocket.maxFuel
    )
  );

  const added = roundNumber(data.rocket.fuel - before);

  const saved = saveRocketData();

  return {
    success: saved !== false,
    added,
    fuel: data.rocket.fuel,
    maxFuel: data.rocket.maxFuel,
    message: added > 0
      ? "燃料を追加しました。"
      : "燃料はすでに最大です。"
  };
}

function setFuel(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value < 0) {
    return {
      success: false,
      message: "燃料は0以上の数値にしてください。"
    };
  }

  if (data.rocket.status === "flying") {
    return {
      success: false,
      message: "飛行中は燃料を変更できません。"
    };
  }

  data.rocket.fuel = roundNumber(
    clamp(value, 0, data.rocket.maxFuel)
  );

  const saved = saveRocketData();

  return {
    success: saved !== false,
    fuel: data.rocket.fuel
  };
}

function setMaxFuel(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return {
      success: false,
      message: "最大燃料は0より大きい数値にしてください。"
    };
  }

  if (data.rocket.status === "flying") {
    return {
      success: false,
      message: "飛行中は最大燃料を変更できません。"
    };
  }

  data.rocket.maxFuel = roundNumber(value);

  data.rocket.fuel = Math.min(
    data.rocket.fuel,
    data.rocket.maxFuel
  );

  const saved = saveRocketData();

  return {
    success: saved !== false,
    fuel: data.rocket.fuel,
    maxFuel: data.rocket.maxFuel
  };
}

/* =========================================================
   発射
   ========================================================= */

function launchRocket() {
  if (data.moonReached) {
    return {
      success: false,
      message: "すでに月へ到達しています。"
    };
  }

  if (data.rocket.status === "flying") {
    return {
      success: false,
      message: "ロケットはすでに飛行中です。"
    };
  }

  if (data.rocket.fuel <= 0) {
    return {
      success: false,
      message: "燃料がありません。燃料を補充してください。"
    };
  }

  data.rocket.status = "flying";

  data.rocket.launchedAt = createDateLabel();

  data.rocket.landedAt = null;

  data.launchCount += 1;

  const history = {
    id: createId(),
    rocketName: data.rocket.name,
    launchedAt: data.rocket.launchedAt,
    distanceAtLaunch: data.rocket.distance,
    status: "flying"
  };

  data.launchHistory.unshift(history);

  const saved = saveRocketData();

  return {
    success: saved !== false,
    rocket: getRocket(),
    message: "ロケットを発射しました。"
  };
}

/* =========================================================
   飛行距離の追加
   ========================================================= */

/*
  distance はシステム上の距離単位です。

  この関数は、画面側やゲーム進行処理から呼び出します。
  勉強時間から距離への換算ルールはまだ固定していません。
*/

function addDistance(distance, source = "manual") {
  const value = Number(distance);

  if (!Number.isFinite(value) || value <= 0) {
    return {
      success: false,
      message: "追加する距離は0より大きい数値にしてください。"
    };
  }

  if (data.moonReached) {
    return {
      success: false,
      message: "月への到達はすでに記録されています。"
    };
  }

  const safeValue = Math.min(
    value,
    ROCKET_CONFIG.maxProgressPerAction
  );

  const before = data.rocket.distance;

  data.rocket.distance = Math.min(
    ROCKET_CONFIG.moonDistance,
    roundNumber(before + safeValue)
  );

  const added = roundNumber(
    data.rocket.distance - before
  );

  data.totalDistance = roundNumber(
    data.totalDistance + added
  );

  data.totalProgressAdded = roundNumber(
    data.totalProgressAdded + added
  );

  const reachedMoon =
    data.rocket.distance >= ROCKET_CONFIG.moonDistance;

  const record = {
    id: createId(),
    amount: added,
    source: String(source || "manual"),
    date: createDateLabel(),
    distanceAfter: data.rocket.distance
  };

  data.progressHistory.unshift(record);

  if (data.progressHistory.length > 1000) {
    data.progressHistory = data.progressHistory.slice(0, 1000);
  }

  if (reachedMoon) {
    data.rocket.distance = ROCKET_CONFIG.moonDistance;

    data.moonReached = true;

    data.moonReachedAt = createDateLabel();

    data.rocket.status = "landed";

    data.rocket.landedAt = data.moonReachedAt;

    const latestLaunch = data.launchHistory[0];

    if (latestLaunch) {
      latestLaunch.status = "landed";
      latestLaunch.landedAt = data.moonReachedAt;
    }
  }

  const saved = saveRocketData();

  return {
    success: saved !== false,
    added,
    distance: data.rocket.distance,
    distanceRemaining: getDistanceToMoon(),
    percentage: getProgressPercentage(),
    moonReached: data.moonReached,
    message: data.moonReached
      ? "月への到達を記録しました！"
      : "飛行距離を更新しました。"
  };
}

/* =========================================================
   学習記録からの進捗追加
   ========================================================= */

/*
  minutes は勉強時間（分）です。
  distancePerMinute は、1分あたりの進行距離です。

  換算率は画面側から指定してください。
  自動で勉強時間を読み取る機能は、study.jsとの接続後に実装します。
*/

function addStudyProgress(minutes, distancePerMinute = 1) {
  const studyMinutes = Number(minutes);
  const rate = Number(distancePerMinute);

  if (
    !Number.isFinite(studyMinutes) ||
    studyMinutes <= 0
  ) {
    return {
      success: false,
      message: "勉強時間は0より大きい数値にしてください。"
    };
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    return {
      success: false,
      message: "換算率は0より大きい数値にしてください。"
    };
  }

  const distance = Math.min(
    studyMinutes * rate,
    ROCKET_CONFIG.maxProgressPerAction
  );

  return addDistance(distance, "study");
}

/* =========================================================
   着陸・飛行終了
   ========================================================= */

function landRocket() {
  if (data.rocket.status !== "flying") {
    return {
      success: false,
      message: "飛行中のロケットがありません。"
    };
  }

  data.rocket.status = "landed";

  data.rocket.landedAt = createDateLabel();

  const latestLaunch = data.launchHistory[0];

  if (latestLaunch) {
    latestLaunch.status = "landed";
    latestLaunch.landedAt = data.rocket.landedAt;
  }

  const saved = saveRocketData();

  return {
    success: saved !== false,
    rocket: getRocket(),
    message: "ロケットを着陸状態にしました。"
  };
}

function returnToReady() {
  if (data.rocket.status === "flying") {
    return {
      success: false,
      message: "飛行中は準備状態に戻せません。"
    };
  }

  if (data.moonReached) {
    return {
      success: false,
      message: "月への到達後は状態を戻せません。"
    };
  }

  data.rocket.status = "ready";

  const saved = saveRocketData();

  return {
    success: saved !== false,
    rocket: getRocket(),
    message: "ロケットを準備状態に戻しました。"
  };
}

/* =========================================================
   履歴
   ========================================================= */

function getLaunchHistory(limit = 50) {
  const safeLimit = Math.max(
    0,
    Math.floor(Number(limit) || 0)
  );

  return clone(data.launchHistory.slice(0, safeLimit));
}

function getProgressHistory(limit = 100) {
  const safeLimit = Math.max(
    0,
    Math.floor(Number(limit) || 0)
  );

  return clone(data.progressHistory.slice(0, safeLimit));
}

/* =========================================================
   初期化
   ========================================================= */

function initializeRocket() {
  data = loadRocketData();

  return {
    rocket: getRocket(),
    progress: getProgressDetails()
  };
}

/* =========================================================
   リセット
   ========================================================= */

/*
  すべてのロケット進捗・履歴を消去します。
  通常の起動時には呼び出さないでください。
*/

function resetRocket() {
  data = createDefaultData();

  const saved = saveRocketData();

  return {
    success: saved !== false,
    rocket: getRocket(),
    progress: getProgressDetails(),
    message: "ロケットデータを初期化しました。"
  };
}

/* =========================================================
   公開API
   ========================================================= */

export const rocket = Object.freeze({
  getConfig: () => ({ ...ROCKET_CONFIG }),

  initializeRocket,

  getRocket,
  getRocketStatus,
  getRocketName,
  renameRocket,

  getDistanceToMoon,
  getProgressPercentage,
  getProgressDetails,

  addFuel,
  setFuel,
  setMaxFuel,

  launchRocket,
  addDistance,
  addStudyProgress,

  landRocket,
  returnToReady,

  getLaunchHistory,
  getProgressHistory,

  resetRocket,

  save: saveRocketData
});

export default rocket;
