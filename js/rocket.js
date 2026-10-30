
/* =========================================================
   ALGOL — Study Constellation
   js/rocket.js

   ROCKET SYSTEM

   ・学習による経験値の獲得
   ・ロケットのレベル管理
   ・ロケットパーツの解放と装備
   ・ミッション管理
   ・惑星探索
   ・進行状況の保存

   学習記録のデータ自体は変更しない。
   ========================================================= */

"use strict";

import { loadData, saveData } from "./store.js";
import { getAllStudyRecords } from "./study.js";

/* =========================================================
   定数
   ========================================================= */

const STORAGE_KEY = "rocket";

export const ROCKET_CONFIG = {
  initialLevel: 1,
  initialExperience: 0,

  // レベルアップに必要な経験値
  experiencePerLevel: 100,

  // 学習1分あたりの経験値
  experiencePerStudyMinute: 1,

  // 一度に取得できる経験値の上限
  maxExperiencePerSync: 10000
};

/* =========================================================
   初期データ
   ========================================================= */

function createDefaultRocket() {
  return {
    experience: 0,
    totalExperience: 0,
    level: 1,

    parts: [],
    equippedParts: {
      engine: null,
      body: null,
      wings: null,
      satellite: null
    },

    missions: [],
    completedMissions: [],

    exploration: [],

    lastStudySync: null,
    updatedAt: new Date().toISOString()
  };
}

function getRocketData() {
  const data = loadData(STORAGE_KEY, null);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return createDefaultRocket();
  }

  const defaults = createDefaultRocket();

  return {
    ...defaults,
    ...data,

    equippedParts: {
      ...defaults.equippedParts,
      ...(data.equippedParts || {})
    },

    parts: Array.isArray(data.parts) ? data.parts : [],
    missions: Array.isArray(data.missions) ? data.missions : [],
    completedMissions: Array.isArray(data.completedMissions)
      ? data.completedMissions
      : [],
    exploration: Array.isArray(data.exploration)
      ? data.exploration
      : []
  };
}

function saveRocketData(data) {
  data.updatedAt = new Date().toISOString();
  saveData(STORAGE_KEY, data);

  return data;
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
}

/* =========================================================
   レベル・経験値
   ========================================================= */

export function getExperienceForNextLevel(level) {
  const currentLevel = Math.max(1, Number(level) || 1);

  return ROCKET_CONFIG.experiencePerLevel *
    currentLevel;
}

export function getRocketLevelInfo() {
  const rocket = getRocketData();

  const level = Math.max(1, Number(rocket.level) || 1);
  const experience = Math.max(0, Number(rocket.experience) || 0);
  const required = getExperienceForNextLevel(level);

  return {
    level,
    experience,
    requiredExperience: required,
    remainingExperience: Math.max(0, required - experience),

    progress: required > 0
      ? Math.round(clamp(experience / required * 100, 0, 100))
      : 0,

    totalExperience: Math.max(
      0,
      Number(rocket.totalExperience) || 0
    )
  };
}

/*
  経験値を加算する。

  レベルアップした場合も余った経験値を保持する。
  複数レベルの連続上昇にも対応。
*/

export function addRocketExperience(amount, reason = "manual") {
  const value = Math.floor(Number(amount));

  if (!Number.isFinite(value) || value <= 0) {
    return {
      gained: 0,
      levelUps: [],
      rocket: getRocketLevelInfo()
    };
  }

  const rocket = getRocketData();
  const gained = Math.min(
    value,
    ROCKET_CONFIG.maxExperiencePerSync
  );

  rocket.experience += gained;
  rocket.totalExperience += gained;

  const levelUps = [];

  while (
    rocket.experience >=
    getExperienceForNextLevel(rocket.level)
  ) {
    const required = getExperienceForNextLevel(rocket.level);

    rocket.experience -= required;
    rocket.level++;

    levelUps.push({
      level: rocket.level,
      reachedAt: new Date().toISOString()
    });
  }

  if (!Array.isArray(rocket.levelHistory)) {
    rocket.levelHistory = [];
  }

  rocket.levelHistory.push(...levelUps);

  if (levelUps.length > 0) {
    rocket.lastLevelUp = levelUps[levelUps.length - 1].reachedAt;
  }

  rocket.lastExperienceReason = reason;

  saveRocketData(rocket);

  return {
    gained,
    levelUps,
    rocket: getRocketLevelInfo()
  };
}

/* =========================================================
   学習記録との同期
   ========================================================= */

/*
  新しい学習記録だけを経験値に変換する。

  同じ記録から二重に経験値を取得しないよう、
  処理済みの記録IDを保存する。

  学習記録の削除や編集によって、
  取得済み経験値を自動で減らすことはしない。
*/

export function syncStudyExperience() {
  const rocket = getRocketData();
  const records = getAllStudyRecords();

  const processedIds = new Set(
    Array.isArray(rocket.processedStudyRecordIds)
      ? rocket.processedStudyRecordIds
      : []
  );

  const newRecords = records.filter(record => {
    return (
      record.id &&
      !processedIds.has(record.id) &&
      Number(record.minutes) > 0
    );
  });

  if (newRecords.length === 0) {
    return {
      newRecordCount: 0,
      gainedExperience: 0,
      levelUps: [],
      rocket: getRocketLevelInfo()
    };
  }

  const totalMinutes = newRecords.reduce((total, record) => {
    return total + Math.max(0, Number(record.minutes) || 0);
  }, 0);

  const gainedExperience = Math.floor(
    totalMinutes * ROCKET_CONFIG.experiencePerStudyMinute
  );

  rocket.processedStudyRecordIds = [
    ...processedIds,
    ...newRecords.map(record => record.id)
  ];

  rocket.lastStudySync = new Date().toISOString();

  saveRocketData(rocket);

  const result = addRocketExperience(
    gainedExperience,
    "study"
  );

  return {
    newRecordCount: newRecords.length,
    gainedExperience: result.gained,
    levelUps: result.levelUps,
    rocket: result.rocket
  };
}

/* =========================================================
   ロケットパーツ
   ========================================================= */

export const ROCKET_PART_TYPES = {
  engine: "エンジン",
  body: "機体",
  wings: "翼",
  satellite: "衛星"
};

export const DEFAULT_ROCKET_PARTS = [
  {
    id: "engine-basic",
    name: "スターターエンジン",
    type: "engine",
    description: "ロケットの基本エンジン",
    requiredLevel: 1,
    rarity: "common"
  },
  {
    id: "body-basic",
    name: "スターターボディ",
    type: "body",
    description: "ロケットの基本機体",
    requiredLevel: 1,
    rarity: "common"
  },
  {
    id: "wings-basic",
    name: "スターターウィング",
    type: "wings",
    description: "ロケットの基本翼",
    requiredLevel: 1,
    rarity: "common"
  },
  {
    id: "satellite-basic",
    name: "観測衛星",
    type: "satellite",
    description: "宇宙探索を補助する衛星",
    requiredLevel: 3,
    rarity: "rare"
  },
  {
    id: "engine-advanced",
    name: "ネビュラエンジン",
    type: "engine",
    description: "高出力のエンジン",
    requiredLevel: 5,
    rarity: "rare"
  },
  {
    id: "body-advanced",
    name: "コスモスボディ",
    type: "body",
    description: "強化されたロケット機体",
    requiredLevel: 8,
    rarity: "epic"
  },
  {
    id: "wings-advanced",
    name: "ギャラクシーウィング",
    type: "wings",
    description: "長距離飛行に対応した翼",
    requiredLevel: 12,
    rarity: "epic"
  }
];

export function getAvailableRocketParts() {
  const rocket = getRocketData();

  return DEFAULT_ROCKET_PARTS.map(part => ({
    ...part,
    unlocked: rocket.level >= part.requiredLevel,
    equipped: rocket.equippedParts[part.type] === part.id
  }));
}

export function getUnlockedRocketParts() {
  return getAvailableRocketParts().filter(
    part => part.unlocked
  );
}

export function unlockRocketPart(partId) {
  const part = DEFAULT_ROCKET_PARTS.find(
    item => item.id === partId
  );

  if (!part) {
    throw new Error("指定されたパーツが見つかりません。");
  }

  const rocket = getRocketData();

  if (rocket.level < part.requiredLevel) {
    throw new Error("ロケットのレベルが足りません。");
  }

  if (!rocket.parts.includes(partId)) {
    rocket.parts.push(partId);
    saveRocketData(rocket);
  }

  return getAvailableRocketParts().find(
    item => item.id === partId
  );
}

export function equipRocketPart(partId) {
  const part = DEFAULT_ROCKET_PARTS.find(
    item => item.id === partId
  );

  if (!part) {
    throw new Error("指定されたパーツが見つかりません。");
  }

  const rocket = getRocketData();

  if (rocket.level < part.requiredLevel) {
    throw new Error("ロケットのレベルが足りません。");
  }

  if (!rocket.parts.includes(partId)) {
    rocket.parts.push(partId);
  }

  rocket.equippedParts[part.type] = partId;

  saveRocketData(rocket);

  return rocket.equippedParts;
}

export function unequipRocketPart(type) {
  if (!Object.hasOwn(ROCKET_PART_TYPES, type)) {
    throw new Error("指定されたパーツ種類は存在しません。");
  }

  const rocket = getRocketData();
  rocket.equippedParts[type] = null;

  saveRocketData(rocket);

  return rocket.equippedParts;
}

/* =========================================================
   ミッション管理
   ========================================================= */

export function getAllMissions() {
  return getRocketData().missions;
}

export function addMission(data = {}) {
  const title = String(data.title ?? "").trim();

  if (!title) {
    throw new Error("ミッション名を入力してください。");
  }

  const rocket = getRocketData();

  const mission = {
    id: createId("mission"),
    title,
    description: String(data.description ?? "").trim(),

    type: data.type || "custom",

    target: Math.max(1, Number(data.target) || 1),
    current: 0,

    rewardExperience: Math.max(
      0,
      Number(data.rewardExperience) || 0
    ),

    status: "active",
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  rocket.missions.push(mission);
  saveRocketData(rocket);

  return mission;
}

export function updateMission(missionId, updates = {}) {
  const rocket = getRocketData();

  const index = rocket.missions.findIndex(
    mission => mission.id === missionId
  );

  if (index === -1) {
    throw new Error("ミッションが見つかりません。");
  }

  const mission = { ...rocket.missions[index] };

  if (updates.title !== undefined) {
    const title = String(updates.title).trim();

    if (!title) {
      throw new Error("ミッション名を入力してください。");
    }

    mission.title = title;
  }

  if (updates.description !== undefined) {
    mission.description = String(updates.description).trim();
  }

  if (updates.target !== undefined) {
    mission.target = Math.max(1, Number(updates.target) || 1);
  }

  if (updates.rewardExperience !== undefined) {
    mission.rewardExperience = Math.max(
      0,
      Number(updates.rewardExperience) || 0
    );
  }

  rocket.missions[index] = mission;
  saveRocketData(rocket);

  return mission;
}

export function addMissionProgress(missionId, amount = 1) {
  const rocket = getRocketData();

  const mission = rocket.missions.find(
    item => item.id === missionId
  );

  if (!mission) {
    throw new Error("ミッションが見つかりません。");
  }

  if (mission.status !== "active") {
    return mission;
  }

  mission.current = Math.min(
    mission.target,
    mission.current + Math.max(0, Number(amount) || 0)
  );

  if (mission.current >= mission.target) {
    mission.status = "completed";
    mission.completedAt = new Date().toISOString();

    if (!rocket.completedMissions.includes(mission.id)) {
      rocket.completedMissions.push(mission.id);
    }

    saveRocketData(rocket);

    if (!mission.rewardClaimed) {
      mission.rewardClaimed = true;

      saveRocketData(rocket);

      if (mission.rewardExperience > 0) {
        addRocketExperience(
          mission.rewardExperience,
          "mission"
        );
      }
    }

    return mission;
  }

  saveRocketData(rocket);

  return mission;
}

export function deleteMission(missionId) {
  const rocket = getRocketData();

  const originalLength = rocket.missions.length;

  rocket.missions = rocket.missions.filter(
    mission => mission.id !== missionId
  );

  if (rocket.missions.length === originalLength) {
    return false;
  }

  saveRocketData(rocket);

  return true;
}

/* =========================================================
   惑星・宇宙探索
   ========================================================= */

export const DEFAULT_PLANETS = [
  {
    id: "moon",
    name: "LUNA",
    displayName: "月",
    description: "宇宙探索の最初の目的地",
    requiredLevel: 1,
    rewardExperience: 20
  },
  {
    id: "mars",
    name: "MARS",
    displayName: "火星",
    description: "赤い大地が広がる惑星",
    requiredLevel: 3,
    rewardExperience: 50
  },
  {
    id: "jupiter",
    name: "JUPITER",
    displayName: "木星",
    description: "巨大なガス惑星",
    requiredLevel: 6,
    rewardExperience: 100
  },
  {
    id: "saturn",
    name: "SATURN",
    displayName: "土星",
    description: "美しい環を持つ惑星",
    requiredLevel: 10,
    rewardExperience: 150
  },
  {
    id: "neptune",
    name: "NEPTUNE",
    displayName: "海王星",
    description: "遠い青い惑星",
    requiredLevel: 15,
    rewardExperience: 250
  }
];

export function getAllPlanets() {
  const rocket = getRocketData();

  return DEFAULT_PLANETS.map(planet => {
    const exploration = rocket.exploration.find(
      item => item.planetId === planet.id
    );

    return {
      ...planet,
      unlocked: rocket.level >= planet.requiredLevel,
      explored: Boolean(exploration?.explored),
      exploredAt: exploration?.exploredAt ?? null
    };
  });
}

export function explorePlanet(planetId) {
  const planet = DEFAULT_PLANETS.find(
    item => item.id === planetId
  );

  if (!planet) {
    throw new Error("指定された惑星が見つかりません。");
  }

  const rocket = getRocketData();

  if (rocket.level < planet.requiredLevel) {
    throw new Error("ロケットのレベルが足りません。");
  }

  let exploration = rocket.exploration.find(
    item => item.planetId === planetId
  );

  if (exploration?.explored) {
    return {
      success: false,
      reason: "already_explored",
      planet
    };
  }

  if (!exploration) {
    exploration = {
      planetId,
      explored: false,
      exploredAt: null
    };

    rocket.exploration.push(exploration);
  }

  exploration.explored = true;
  exploration.exploredAt = new Date().toISOString();

  saveRocketData(rocket);

  if (planet.rewardExperience > 0) {
    addRocketExperience(
      planet.rewardExperience,
      "exploration"
    );
  }

  return {
    success: true,
    planet,
    rewardExperience: planet.rewardExperience
  };
}

/* =========================================================
   ロケット全体の状態
   ========================================================= */

export function getRocketStatus() {
  const rocket = getRocketData();
  const levelInfo = getRocketLevelInfo();

  const planets = getAllPlanets();
  const missions = rocket.missions;

  return {
    level: levelInfo.level,
    experience: levelInfo.experience,
    totalExperience: levelInfo.totalExperience,
    requiredExperience: levelInfo.requiredExperience,
    remainingExperience: levelInfo.remainingExperience,
    progress: levelInfo.progress,

    unlockedParts: getUnlockedRocketParts().length,
    totalParts: DEFAULT_ROCKET_PARTS.length,

    completedMissions: missions.filter(
      mission => mission.status === "completed"
    ).length,

    activeMissions: missions.filter(
      mission => mission.status === "active"
    ).length,

    exploredPlanets: planets.filter(
      planet => planet.explored
    ).length,

    totalPlanets: planets.length,

    equippedParts: rocket.equippedParts
  };
}

/* =========================================================
   初期化
   ========================================================= */

export function initializeRocket() {
  const rocket = getRocketData();

  saveRocketData(rocket);

  return getRocketStatus();
}

/* =========================================================
   デフォルトエクスポート
   ========================================================= */

export default {
  ROCKET_CONFIG,
  ROCKET_PART_TYPES,
  DEFAULT_ROCKET_PARTS,
  DEFAULT_PLANETS,

  initializeRocket,

  getRocketLevelInfo,
  getExperienceForNextLevel,
  addRocketExperience,
  syncStudyExperience,

  getAvailableRocketParts,
  getUnlockedRocketParts,
  unlockRocketPart,
  equipRocketPart,
  unequipRocketPart,

  getAllMissions,
  addMission,
  updateMission,
  addMissionProgress,
  deleteMission,

  getAllPlanets,
  explorePlanet,

  getRocketStatus
};
