
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/rocket.js
 *
 * ロケット開発・経験値・レベル管理
 *
 * 基本方針:
 * - 学習時間に応じて経験値を獲得する
 * - 経験値からレベルを計算する
 * - 開発ポイントでロケット部品を成長させる
 * - 学習記録1件につき報酬を二重付与しない
 * - ミッション・打ち上げとの連携に備える
 *
 * 注意:
 * このファイルはデータ管理用です。
 * 画面表示やアニメーションは別モジュールで接続します。
 */

import {
  STORAGE_KEYS,
  loadObject,
  saveData,
  createId
} from "./storage.js";

import {
  loadStudyData
} from "./study.js";

// --------------------------------------------------
// 保存設定
// --------------------------------------------------

const ROCKET_STORAGE_KEY =
  STORAGE_KEYS?.progression ?? "oneforall-progression-v1";

const DEFAULT_STATE = {
  version: 1,

  totalExp: 0,
  level: 1,

  developmentPoints: 0,
  spentDevelopmentPoints: 0,

  totalStudySeconds: 0,
  rewardedRecordIds: [],

  parts: {
    body: 0,
    engine: 0,
    fuelTank: 0,
    noseCone: 0
  },

  unlockedParts: [
    "body"
  ],

  updatedAt: null
};

// --------------------------------------------------
// 基本処理
// --------------------------------------------------

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.floor(number);
}

function normalizeState(raw = {}) {
  const defaults = cloneDefaultState();

  const parts = raw.parts && typeof raw.parts === "object"
    ? raw.parts
    : {};

  const validParts = {};

  for (const key of Object.keys(defaults.parts)) {
    validParts[key] = normalizeNonNegativeInteger(
      parts[key]
    );
  }

  const rewardedRecordIds = Array.isArray(
    raw.rewardedRecordIds
  )
    ? [
        ...new Set(
          raw.rewardedRecordIds
            .filter(id => typeof id === "string")
        )
      ]
    : [];

  const unlockedParts = Array.isArray(raw.unlockedParts)
    ? [
        ...new Set(
          raw.unlockedParts.filter(id =>
            Object.hasOwn(defaults.parts, id)
          )
        )
      ]
    : [...defaults.unlockedParts];

  if (!unlockedParts.includes("body")) {
    unlockedParts.unshift("body");
  }

  const state = {
    ...defaults,
    ...raw,

    totalExp: normalizeNonNegativeInteger(raw.totalExp),
    level: 1,

    developmentPoints: normalizeNonNegativeInteger(
      raw.developmentPoints
    ),

    spentDevelopmentPoints: normalizeNonNegativeInteger(
      raw.spentDevelopmentPoints
    ),

    totalStudySeconds: normalizeNonNegativeInteger(
      raw.totalStudySeconds
    ),

    rewardedRecordIds,

    parts: validParts,
    unlockedParts
  };

  state.level = getLevelForExp(state.totalExp);

  return state;
}

function readState() {
  const stored = loadObject(ROCKET_STORAGE_KEY, {});
  return normalizeState(stored);
}

function writeState(state) {
  state.updatedAt = new Date().toISOString();

  saveData(
    ROCKET_STORAGE_KEY,
    normalizeState(state)
  );
}

function notifyRocketChange(type, detail = {}) {
  if (typeof document === "undefined") {
    return;
  }

  document.dispatchEvent(
    new CustomEvent("cosmos:rocket-change", {
      detail: {
        type,
        ...detail
      }
    })
  );
}

// --------------------------------------------------
// レベルと経験値
// --------------------------------------------------

/**
 * 次のレベルまでに必要な累計経験値を取得します。
 *
 * レベル1: 0 EXP
 * レベル2: 100 EXP
 * レベル3: 250 EXP
 * レベル4: 450 EXP
 *
 * レベルが上がるほど必要経験値が増えます。
 */
export function getExpRequiredForLevel(level) {
  const targetLevel = Math.max(
    1,
    Math.floor(Number(level) || 1)
  );

  if (targetLevel === 1) {
    return 0;
  }

  let total = 0;

  for (let currentLevel = 1;
       currentLevel < targetLevel;
       currentLevel += 1) {
    total += 100 + (currentLevel - 1) * 50;
  }

  return total;
}

/**
 * 累計経験値からレベルを計算します。
 */
export function getLevelForExp(totalExp) {
  const exp = normalizeNonNegativeInteger(totalExp);

  let level = 1;

  while (
    level < 1000 &&
    exp >= getExpRequiredForLevel(level + 1)
  ) {
    level += 1;
  }

  return level;
}

/**
 * 現在の経験値と次のレベルまでの進捗を取得します。
 */
export function getLevelProgress(totalExp) {
  const exp = normalizeNonNegativeInteger(totalExp);
  const level = getLevelForExp(exp);

  const currentLevelExp = getExpRequiredForLevel(level);
  const nextLevelExp = getExpRequiredForLevel(level + 1);

  const requiredForNext = nextLevelExp - currentLevelExp;
  const earnedInLevel = exp - currentLevelExp;

  return {
    level,
    totalExp: exp,
    currentLevelExp,
    nextLevelExp,
    earnedInLevel,
    requiredForNext,
    remainingExp: Math.max(0, nextLevelExp - exp),
    percentage: requiredForNext > 0
      ? Math.min(
          100,
          Math.floor(earnedInLevel / requiredForNext * 100)
        )
      : 100
  };
}

// --------------------------------------------------
// 学習時間と経験値
// --------------------------------------------------

/**
 * 経験値の基本ルール:
 * 学習1分につき1 EXP。
 *
 * 端数は学習記録ごとに切り捨てず、
 * 累計秒数から計算するため、短時間学習も無駄になりません。
 */
export function getExpForStudySeconds(seconds) {
  return Math.floor(
    normalizeNonNegativeInteger(seconds) / 60
  );
}

/**
 * 現在のロケット状態を取得します。
 */
export function getRocketState() {
  return readState();
}

/**
 * ロケットの進捗状況をまとめて取得します。
 */
export function getRocketSummary() {
  const state = readState();
  const levelProgress = getLevelProgress(state.totalExp);

  return {
    ...state,
    levelProgress,

    availableDevelopmentPoints: Math.max(
      0,
      state.developmentPoints -
      state.spentDevelopmentPoints
    ),

    parts: {
      ...state.parts
    },

    unlockedParts: [
      ...state.unlockedParts
    ]
  };
}

/**
 * 学習時間をロケットに反映します。
 *
 * recordId:
 * 学習記録の一意なID。
 *
 * 同じrecordIdで複数回呼び出しても、
 * 経験値を二重付与しません。
 *
 * 戻り値:
 * { success, addedExp, levelBefore, levelAfter }
 */
export function rewardStudyRecord({
  recordId,
  seconds
} = {}) {
  const id = String(recordId ?? "").trim();

  if (!id) {
    return {
      error: "学習記録のIDが必要です。"
    };
  }

  const duration = normalizeNonNegativeInteger(seconds);

  if (duration <= 0) {
    return {
      error: "学習時間が正しくありません。"
    };
  }

  const state = readState();

  if (state.rewardedRecordIds.includes(id)) {
    return {
      success: false,
      duplicate: true,
      addedExp: 0,
      message: "この学習記録には報酬が付与済みです。"
    };
  }

  const levelBefore = state.level;

  const oldWholeMinutes = Math.floor(
    state.totalStudySeconds / 60
  );

  state.totalStudySeconds += duration;

  const newWholeMinutes = Math.floor(
    state.totalStudySeconds / 60
  );

  const addedExp = newWholeMinutes - oldWholeMinutes;

  state.totalExp += addedExp;
  state.developmentPoints += addedExp;

  state.rewardedRecordIds.push(id);
  state.level = getLevelForExp(state.totalExp);

  writeState(state);

  const result = {
    success: true,
    duplicate: false,
    addedExp,
    levelBefore,
    levelAfter: state.level,
    leveledUp: state.level > levelBefore,
    totalExp: state.totalExp,
    developmentPoints: state.developmentPoints,
    totalStudySeconds: state.totalStudySeconds
  };

  notifyRocketChange("study-reward", result);

  if (result.leveledUp) {
    notifyRocketChange("level-up", {
      levelBefore,
      levelAfter: state.level
    });
  }

  return result;
}

// --------------------------------------------------
// 既存の学習記録との同期
// --------------------------------------------------

/**
 * 未報酬の学習記録をロケットに反映します。
 *
 * 注意:
 * 記録IDがない学習記録は自動付与しません。
 * 既存データの誤った二重加算を避けるためです。
 */
export function syncStudyRewards() {
  const studyData = loadStudyData();

  const records = Array.isArray(studyData.records)
    ? studyData.records
    : [];

  const state = readState();

  let rewardedCount = 0;
  let addedExp = 0;

  for (const record of records) {
    if (
      !record ||
      typeof record.id !== "string" ||
      state.rewardedRecordIds.includes(record.id)
    ) {
      continue;
    }

    const seconds = normalizeNonNegativeInteger(
      record.seconds
    );

    if (seconds <= 0) {
      continue;
    }

    const oldWholeMinutes = Math.floor(
      state.totalStudySeconds / 60
    );

    state.totalStudySeconds += seconds;

    const newWholeMinutes = Math.floor(
      state.totalStudySeconds / 60
    );

    const exp = newWholeMinutes - oldWholeMinutes;

    state.totalExp += exp;
    state.developmentPoints += exp;

    addedExp += exp;
    rewardedCount += 1;

    state.rewardedRecordIds.push(record.id);
  }

  if (rewardedCount > 0) {
    const previousLevel = state.level;

    state.level = getLevelForExp(state.totalExp);
    writeState(state);

    notifyRocketChange("sync", {
      rewardedCount,
      addedExp,
      levelBefore: previousLevel,
      levelAfter: state.level
    });
  }

  return {
    success: true,
    rewardedCount,
    addedExp,
    totalExp: state.totalExp,
    level: getLevelForExp(state.totalExp)
  };
}

// --------------------------------------------------
// ロケット部品
// --------------------------------------------------

const PARTS = {
  body: {
    name: "ロケット本体",
    cost: 0,
    maxLevel: 10,
    unlockAtLevel: 1
  },

  engine: {
    name: "エンジン",
    cost: 50,
    maxLevel: 10,
    unlockAtLevel: 2
  },

  fuelTank: {
    name: "燃料タンク",
    cost: 40,
    maxLevel: 10,
    unlockAtLevel: 2
  },

  noseCone: {
    name: "ノーズコーン",
    cost: 30,
    maxLevel: 10,
    unlockAtLevel: 3
  }
};

/**
 * 部品の一覧を取得します。
 */
export function getRocketParts() {
  const state = readState();

  return Object.entries(PARTS).map(([id, config]) => ({
    id,
    name: config.name,
    level: state.parts[id] ?? 0,
    maxLevel: config.maxLevel,
    cost: config.cost,
    unlocked: state.unlockedParts.includes(id),
    unlockAtLevel: config.unlockAtLevel
  }));
}

/**
 * レベル条件を満たした部品を解放します。
 */
export function unlockAvailableParts() {
  const state = readState();
  const newlyUnlocked = [];

  for (const [id, config] of Object.entries(PARTS)) {
    if (
      state.level >= config.unlockAtLevel &&
      !state.unlockedParts.includes(id)
    ) {
      state.unlockedParts.push(id);
      newlyUnlocked.push(id);
    }
  }

  if (newlyUnlocked.length > 0) {
    writeState(state);

    notifyRocketChange("parts-unlocked", {
      parts: newlyUnlocked
    });
  }

  return {
    newlyUnlocked,
    parts: getRocketParts()
  };
}

/**
 * 部品を1段階強化します。
 *
 * 初期設定:
 * - 本体: 10ポイント
 * - エンジン: 50ポイント
 * - 燃料タンク: 40ポイント
 * - ノーズコーン: 30ポイント
 *
 * 強化するたびに必要ポイントが増えます。
 */
export function upgradeRocketPart(partId) {
  const id = String(partId ?? "");
  const config = PARTS[id];

  if (!config) {
    return {
      error: "指定された部品がありません。"
    };
  }

  const state = readState();

  if (!state.unlockedParts.includes(id)) {
    return {
      error: "この部品はまだ解放されていません。"
    };
  }

  const currentLevel = state.parts[id] ?? 0;

  if (currentLevel >= config.maxLevel) {
    return {
      error: "この部品は最大レベルです。"
    };
  }

  const baseCost = id === "body"
    ? 10
    : config.cost;

  const cost = baseCost * (currentLevel + 1);

  const available =
    state.developmentPoints -
    state.spentDevelopmentPoints;

  if (available < cost) {
    return {
      error: "開発ポイントが足りません。",
      required: cost,
      available
    };
  }

  state.parts[id] = currentLevel + 1;
  state.spentDevelopmentPoints += cost;

  writeState(state);

  const result = {
    success: true,
    partId: id,
    partName: config.name,
    previousLevel: currentLevel,
    level: state.parts[id],
    cost,
    availableDevelopmentPoints:
      state.developmentPoints -
      state.spentDevelopmentPoints
  };

  notifyRocketChange("part-upgraded", result);

  return result;
}

// --------------------------------------------------
// 初期化
// --------------------------------------------------

/**
 * 初期化時にレベルと部品解放を更新します。
 * 既存の学習報酬は自動で同期しません。
 * 同期が必要な場合は、呼び出し元が
 * syncStudyRewards() を明示的に呼びます。
 */
export function initializeRocket() {
  const state = readState();

  state.level = getLevelForExp(state.totalExp);

  writeState(state);

  const unlocked = unlockAvailableParts();

  return {
    success: true,
    summary: getRocketSummary(),
    newlyUnlocked: unlocked.newlyUnlocked
  };
}
