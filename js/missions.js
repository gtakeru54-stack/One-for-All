
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/missions.js
 *
 * ミッション・打ち上げ・宇宙探索システム
 *
 * 担当:
 * - ミッションの管理
 * - ミッションの進捗更新
 * - 目標達成によるミッション進行
 * - 打ち上げの記録
 * - 宇宙探索の進行
 * - 月を目指す長期目標の土台
 *
 * 注意:
 * このファイルはデータ管理用です。
 * アニメーションや画面表示は別モジュールで接続します。
 */

import {
  STORAGE_KEYS,
  loadArray,
  saveData,
  createId,
  getTodayKey
} from "./storage.js";

import {
  getRocketSummary
} from "./rocket.js";

import {
  getGoalById,
  getGoalSummary
} from "./goals.js";

// --------------------------------------------------
// 保存先
// --------------------------------------------------

const MISSIONS_STORAGE_KEY =
  STORAGE_KEYS?.missions ?? "oneforall-missions-v1";

const SPACE_STORAGE_KEY =
  "oneforall-space-exploration-v1";

// --------------------------------------------------
// 初期ミッション
// --------------------------------------------------

const DEFAULT_MISSIONS = [
  {
    id: "first-study",
    title: "宇宙開発を始めよう",
    description: "まずは勉強して開発経験を獲得しよう。",
    type: "study",
    target: 60,
    progress: 0,
    rewardExp: 20,
    rewardPoints: 20,
    order: 1
  },
  {
    id: "rocket-development",
    title: "ロケットを開発しよう",
    description: "ロケットの部品を強化して出発の準備をしよう。",
    type: "rocket-level",
    target: 2,
    progress: 0,
    rewardExp: 30,
    rewardPoints: 30,
    order: 2
  },
  {
    id: "first-launch",
    title: "初めての打ち上げ",
    description: "準備を整えてロケットを打ち上げよう。",
    type: "launch",
    target: 1,
    progress: 0,
    rewardExp: 50,
    rewardPoints: 50,
    order: 3
  },
  {
    id: "moon-exploration",
    title: "月への道",
    description: "学習と目標達成を積み重ね、月を目指そう。",
    type: "goal",
    target: 3,
    progress: 0,
    rewardExp: 100,
    rewardPoints: 100,
    order: 4
  }
];

// --------------------------------------------------
// 内部処理
// --------------------------------------------------

function notifyMissionChange(type, detail = {}) {
  if (typeof document === "undefined") {
    return;
  }

  document.dispatchEvent(
    new CustomEvent("cosmos:mission-change", {
      detail: {
        type,
        ...detail
      }
    })
  );
}

function normalizeInteger(value, minimum = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.max(minimum, Math.floor(number));
}

function normalizeMission(mission) {
  const target = Math.max(
    1,
    normalizeInteger(mission.target, 1)
  );

  const progress = Math.min(
    target,
    normalizeInteger(mission.progress, 0)
  );

  return {
    id: String(mission.id),
    title: String(mission.title ?? "ミッション"),
    description: String(mission.description ?? ""),
    type: String(mission.type ?? "custom"),
    target,
    progress,
    rewardExp: normalizeInteger(mission.rewardExp, 0),
    rewardPoints: normalizeInteger(mission.rewardPoints, 0),
    order: normalizeInteger(mission.order, 1),
    completed: Boolean(mission.completed) || progress >= target,
    completedAt: mission.completedAt ?? null,
    createdAt: mission.createdAt ?? null
  };
}

function getStoredMissions() {
  const stored = loadArray(MISSIONS_STORAGE_KEY);

  if (stored.length === 0) {
    return DEFAULT_MISSIONS.map(mission =>
      normalizeMission(mission)
    );
  }

  return stored
    .filter(mission =>
      mission &&
      typeof mission.id === "string"
    )
    .map(normalizeMission);
}

function saveMissions(missions) {
  saveData(
    MISSIONS_STORAGE_KEY,
    missions.map(normalizeMission)
  );
}

function getMissionIndex(missions, id) {
  return missions.findIndex(
    mission => mission.id === String(id)
  );
}

// --------------------------------------------------
// ミッション取得
// --------------------------------------------------

/**
 * すべてのミッションを取得します。
 */
export function getMissions() {
  return getStoredMissions()
    .sort((a, b) => a.order - b.order);
}

/**
 * IDでミッションを取得します。
 */
export function getMissionById(id) {
  return getMissions().find(
    mission => mission.id === String(id)
  ) ?? null;
}

/**
 * 未達成のミッションを取得します。
 */
export function getActiveMissions() {
  return getMissions().filter(
    mission => !mission.completed
  );
}

/**
 * 達成済みミッションを取得します。
 */
export function getCompletedMissions() {
  return getMissions().filter(
    mission => mission.completed
  );
}

// --------------------------------------------------
// ミッション作成・編集・削除
// --------------------------------------------------

/**
 * 新しいミッションを追加します。
 *
 * type の例:
 * study / rocket-level / launch / goal / custom
 */
export function addMission(input = {}) {
  const title = String(input.title ?? "").trim();

  if (!title) {
    return {
      error: "ミッション名を入力してください。"
    };
  }

  const missions = getStoredMissions();

  const id = input.id
    ? String(input.id)
    : createId();

  if (missions.some(mission => mission.id === id)) {
    return {
      error: "同じIDのミッションがすでにあります。"
    };
  }

  const target = normalizeInteger(input.target ?? 1, 1);

  const mission = normalizeMission({
    id,
    title,
    description: input.description ?? "",
    type: input.type ?? "custom",
    target,
    progress: input.progress ?? 0,
    rewardExp: input.rewardExp ?? 0,
    rewardPoints: input.rewardPoints ?? 0,
    order: input.order ?? missions.length + 1,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString()
  });

  missions.push(mission);
  saveMissions(missions);

  notifyMissionChange("created", {
    mission
  });

  return mission;
}

/**
 * ミッションを編集します。
 */
export function updateMission(id, changes = {}) {
  const missions = getStoredMissions();
  const index = getMissionIndex(missions, id);

  if (index === -1) {
    return {
      error: "ミッションが見つかりません。"
    };
  }

  const existing = missions[index];

  const updated = normalizeMission({
    ...existing,
    ...changes,
    id: existing.id
  });

  missions[index] = updated;
  saveMissions(missions);

  notifyMissionChange("updated", {
    mission: updated
  });

  return updated;
}

/**
 * ミッションを削除します。
 */
export function deleteMission(id) {
  const missions = getStoredMissions();
  const exists = missions.some(
    mission => mission.id === String(id)
  );

  if (!exists) {
    return {
      error: "ミッションが見つかりません。"
    };
  }

  saveMissions(
    missions.filter(mission => mission.id !== String(id))
  );

  notifyMissionChange("deleted", {
    id: String(id)
  });

  return {
    success: true,
    id: String(id)
  };
}

// --------------------------------------------------
// ミッション進捗
// --------------------------------------------------

/**
 * ミッションの進捗を設定します。
 */
export function setMissionProgress(id, progress) {
  const missions = getStoredMissions();
  const index = getMissionIndex(missions, id);

  if (index === -1) {
    return {
      error: "ミッションが見つかりません。"
    };
  }

  const mission = missions[index];

  if (mission.completed) {
    return mission;
  }

  const nextProgress = Math.min(
    mission.target,
    normalizeInteger(progress, 0)
  );

  const completed = nextProgress >= mission.target;

  const updated = {
    ...mission,
    progress: nextProgress,
    completed,
    completedAt: completed
      ? new Date().toISOString()
      : null
  };

  missions[index] = updated;
  saveMissions(missions);

  notifyMissionChange(
    completed ? "completed" : "progress",
    {
      mission: updated
    }
  );

  return updated;
}

/**
 * ミッションの進捗を指定量だけ増やします。
 */
export function advanceMission(id, amount = 1) {
  const mission = getMissionById(id);

  if (!mission) {
    return {
      error: "ミッションが見つかりません。"
    };
  }

  if (mission.completed) {
    return mission;
  }

  const increment = normalizeInteger(amount, 0);

  return setMissionProgress(
    id,
    mission.progress + increment
  );
}

// --------------------------------------------------
// ミッション初期化
// --------------------------------------------------

/**
 * 初期ミッションが存在しない場合に登録します。
 *
 * 既存のミッションは上書きしません。
 */
export function initializeMissions() {
  const existing = loadArray(MISSIONS_STORAGE_KEY);

  if (existing.length > 0) {
    return {
      success: true,
      created: 0,
      missions: getMissions()
    };
  }

  const missions = DEFAULT_MISSIONS.map(
    (mission, index) =>
      normalizeMission({
        ...mission,
        createdAt: new Date().toISOString(),
        order: index + 1
      })
  );

  saveMissions(missions);

  notifyMissionChange("initialized", {
    count: missions.length
  });

  return {
    success: true,
    created: missions.length,
    missions
  };
}

// --------------------------------------------------
// 打ち上げ
// --------------------------------------------------

function getSpaceState() {
  return loadArray(SPACE_STORAGE_KEY);
}

function saveSpaceState(state) {
  saveData(SPACE_STORAGE_KEY, state);
}

/**
 * 打ち上げ履歴を取得します。
 */
export function getLaunchHistory() {
  return getSpaceState()
    .filter(item => item.type === "launch")
    .sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );
}

/**
 * ロケットを打ち上げます。
 *
 * 打ち上げは履歴に記録されます。
 * 経験値やポイントは、この関数では付与しません。
 * そのため、画面側から誤って複数回報酬を付ける
 * リスクを減らせます。
 */
export function launchRocket({
  name = "COSMOS",
  missionId = null,
  note = ""
} = {}) {
  const rocket = getRocketSummary();

  if (rocket.level < 2) {
    return {
      error: "打ち上げにはロケットレベル2以上が必要です。"
    };
  }

  const state = getSpaceState();

  const launch = {
    id: createId(),
    type: "launch",
    name: String(name).trim() || "COSMOS",
    missionId: missionId ? String(missionId) : null,
    note: String(note).trim().slice(0, 500),
    createdAt: new Date().toISOString(),
    date: getTodayKey()
  };

  state.push(launch);
  saveSpaceState(state);

  notifyMissionChange("launched", {
    launch
  });

  return {
    success: true,
    launch
  };
}

// --------------------------------------------------
// 宇宙探索
// --------------------------------------------------

const SPACE_DESTINATIONS = [
  {
    id: "earth-orbit",
    name: "地球周回軌道",
    description: "最初の探索地点。宇宙への第一歩。",
    requiredLaunches: 1
  },
  {
    id: "moon-transfer",
    name: "月への航路",
    description: "地球を離れ、月を目指す航路。",
    requiredLaunches: 2
  },
  {
    id: "moon",
    name: "月面基地",
    description: "長期目標となる月面基地。",
    requiredLaunches: 4
  }
];

/**
 * 探索地点の一覧を取得します。
 */
export function getSpaceDestinations() {
  const launches = getLaunchHistory();
  const launchCount = launches.length;

  return SPACE_DESTINATIONS.map(destination => ({
    ...destination,
    unlocked: launchCount >= destination.requiredLaunches,
    launchCount,
    remainingLaunches: Math.max(
      0,
      destination.requiredLaunches - launchCount
    )
  }));
}

/**
 * 現在の宇宙探索状況を取得します。
 */
export function getExplorationSummary() {
  const launches = getLaunchHistory();
  const destinations = getSpaceDestinations();

  const unlocked = destinations.filter(
    destination => destination.unlocked
  );

  const currentDestination =
    [...unlocked].pop() ?? null;

  const nextDestination =
    destinations.find(destination => !destination.unlocked) ?? null;

  return {
    launchCount: launches.length,
    destinations,
    unlockedCount: unlocked.length,
    totalDestinations: destinations.length,
    currentDestination,
    nextDestination
  };
}

// --------------------------------------------------
// 目標とミッションの連携用情報
// --------------------------------------------------

/**
 * 目標とロケットの状態をまとめて取得します。
 *
 * この関数は進捗を自動変更しません。
 * 実際のミッション更新ルールは統合段階で設定します。
 */
export function getMissionDashboard() {
  const missions = getMissions();
  const rocket = getRocketSummary();
  const goals = getGoalSummary();
  const exploration = getExplorationSummary();

  return {
    missions,
    activeCount: missions.filter(
      mission => !mission.completed
    ).length,

    completedCount: missions.filter(
      mission => mission.completed
    ).length,

    rocket: {
      level: rocket.level,
      totalExp: rocket.totalExp,
      developmentPoints:
        rocket.developmentPoints -
        rocket.spentDevelopmentPoints
    },

    goals,

    exploration
  };
}
