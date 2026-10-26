
/* =========================================================
   ONE FOR ALL COSMOS
   js/goal-map.js

   目標マップ・スキルツリー
   ・月を最終目標にした分岐型マップ
   ・目標同士の接続
   ・解放条件の判定
   ・進捗管理
   ・達成状態の管理
   ・独自の目標ノード追加
   ・ローカル保存

   注意：
   このファイルは目標マップのデータ管理を担当する。
   星や線の描画は画面側で行う。
   ========================================================= */

"use strict";

import {
  loadObject,
  saveData,
  createId,
} from "./storage.js";

import {
  getGoals,
  getGoalById,
  addGoal,
  setGoalProgress,
  completeGoal,
} from "./goals.js";

const GOAL_MAP_STORAGE_KEY = "oneforall-goal-map-v1";

/* ---------------------------------------------------------
   マップの初期構成
   --------------------------------------------------------- */

/**
 * mapId：ノードの一意なID
 * title：表示名
 * description：目標の説明
 * parentIds：先に進むために必要なノード
 * goalId：既存の目標システムと連携するID
 * targetMinutes：学習時間を条件にする場合の目標分数
 */
const DEFAULT_NODES = [
  {
    mapId: "earth-start",
    title: "地球",
    description: "学習の旅を始めよう",
    branch: "start",
    x: 50,
    y: 92,
    parentIds: [],
    goalId: null,
    targetMinutes: 0,
    targetCount: 0,
    rewardExp: 0,
    isFinal: false,
  },

  {
    mapId: "first-step",
    title: "第一歩",
    description: "まずは5分間学習する",
    branch: "habit",
    x: 50,
    y: 80,
    parentIds: ["earth-start"],
    goalId: null,
    targetMinutes: 5,
    targetCount: 1,
    rewardExp: 10,
    isFinal: false,
  },

  {
    mapId: "study-star",
    title: "学習の星",
    description: "学習時間を合計60分にする",
    branch: "study",
    x: 28,
    y: 68,
    parentIds: ["first-step"],
    goalId: null,
    targetMinutes: 60,
    targetCount: 0,
    rewardExp: 20,
    isFinal: false,
  },

  {
    mapId: "habit-star",
    title: "習慣の星",
    description: "学習を3日間続ける",
    branch: "habit",
    x: 72,
    y: 68,
    parentIds: ["first-step"],
    goalId: null,
    targetMinutes: 0,
    targetCount: 3,
    rewardExp: 20,
    isFinal: false,
  },

  {
    mapId: "knowledge-planet",
    title: "知識の惑星",
    description: "学習時間を合計5時間にする",
    branch: "study",
    x: 18,
    y: 53,
    parentIds: ["study-star"],
    goalId: null,
    targetMinutes: 300,
    targetCount: 0,
    rewardExp: 40,
    isFinal: false,
  },

  {
    mapId: "discipline-planet",
    title: "継続の惑星",
    description: "学習を7日間続ける",
    branch: "habit",
    x: 82,
    y: 53,
    parentIds: ["habit-star"],
    goalId: null,
    targetMinutes: 0,
    targetCount: 7,
    rewardExp: 40,
    isFinal: false,
  },

  {
    mapId: "exam-nebula",
    title: "試験の星雲",
    description: "自分で決めた試験対策の目標を達成する",
    branch: "exam",
    x: 40,
    y: 39,
    parentIds: [
      "knowledge-planet",
      "discipline-planet",
    ],
    goalId: null,
    targetMinutes: 0,
    targetCount: 1,
    rewardExp: 60,
    isFinal: false,
  },

  {
    mapId: "galaxy",
    title: "銀河",
    description: "学習時間を合計20時間にする",
    branch: "study",
    x: 65,
    y: 27,
    parentIds: ["exam-nebula"],
    goalId: null,
    targetMinutes: 1200,
    targetCount: 0,
    rewardExp: 100,
    isFinal: false,
  },

  {
    mapId: "moon",
    title: "月",
    description: "自分の大きな目標を達成する",
    branch: "final",
    x: 50,
    y: 10,
    parentIds: ["galaxy"],
    goalId: null,
    targetMinutes: 0,
    targetCount: 1,
    rewardExp: 200,
    isFinal: true,
  },
];

/* ---------------------------------------------------------
   保存データ
   --------------------------------------------------------- */

function getStoredMapData() {
  const data = loadObject(GOAL_MAP_STORAGE_KEY);

  return {
    version: 1,
    nodes: Array.isArray(data.nodes)
      ? data.nodes
      : [],
    progress: data.progress &&
      typeof data.progress === "object"
      ? data.progress
      : {},
    completedNodeIds: Array.isArray(data.completedNodeIds)
      ? data.completedNodeIds
      : [],
    claimedRewardIds: Array.isArray(data.claimedRewardIds)
      ? data.claimedRewardIds
      : [],
  };
}

function saveMapData(data) {
  saveData(GOAL_MAP_STORAGE_KEY, data);
}

/* ---------------------------------------------------------
   初期化
   --------------------------------------------------------- */

/**
 * 初期マップを保存する
 *
 * すでにマップが存在する場合は上書きしない。
 */
export function initializeGoalMap() {
  const stored = getStoredMapData();

  if (stored.nodes.length > 0) {
    return {
      success: true,
      initialized: false,
      count: stored.nodes.length,
    };
  }

  const data = {
    version: 1,
    nodes: DEFAULT_NODES.map((node) => ({
      ...node,
      createdAt: new Date().toISOString(),
    })),
    progress: {},
    completedNodeIds: [],
    claimedRewardIds: [],
  };

  saveMapData(data);

  return {
    success: true,
    initialized: true,
    count: data.nodes.length,
  };
}

/* ---------------------------------------------------------
   ノード一覧
   --------------------------------------------------------- */

/**
 * 目標マップの全ノードを取得する
 */
export function getGoalMapNodes() {
  const stored = getStoredMapData();

  if (stored.nodes.length === 0) {
    return DEFAULT_NODES.map((node) => ({ ...node }));
  }

  return stored.nodes.map((node) => ({
    ...node,
    parentIds: Array.isArray(node.parentIds)
      ? [...node.parentIds]
      : [],
  }));
}

/**
 * IDからノードを取得する
 */
export function getGoalMapNode(mapId) {
  return getGoalMapNodes().find(
    (node) => node.mapId === mapId
  ) || null;
}

/**
 * ノードの親を取得する
 */
export function getGoalMapParents(mapId) {
  const node = getGoalMapNode(mapId);

  if (!node) {
    return [];
  }

  return node.parentIds
    .map((id) => getGoalMapNode(id))
    .filter(Boolean);
}

/**
 * ノードの子を取得する
 */
export function getGoalMapChildren(mapId) {
  return getGoalMapNodes().filter((node) => {
    return node.parentIds.includes(mapId);
  });
}

/* ---------------------------------------------------------
   進捗
   --------------------------------------------------------- */

/**
 * ノードの進捗を取得する
 */
export function getGoalMapProgress(mapId) {
  const data = getStoredMapData();
  const node = getGoalMapNode(mapId);

  if (!node) {
    return null;
  }

  const saved = data.progress[mapId] || {};

  const current = Math.max(
    0,
    Number(saved.current) || 0
  );

  const target = Math.max(
    0,
    Number(saved.target) ||
      node.targetMinutes ||
      node.targetCount ||
      0
  );

  const percent =
    target > 0
      ? Math.max(
          0,
          Math.min(100, Math.floor((current / target) * 100))
        )
      : 0;

  return {
    mapId,
    current,
    target,
    percent,
    completed: data.completedNodeIds.includes(mapId),
  };
}

/**
 * ノードの進捗を更新する
 *
 * current：現在値
 * target：目標値（省略可）
 *
 * 注意：
 * 進捗値を保存するだけで、学習時間などを自動集計しない。
 */
export function updateGoalMapProgress(
  mapId,
  current,
  target
) {
  const data = getStoredMapData();
  const node = data.nodes.find(
    (item) => item.mapId === mapId
  );

  if (!node) {
    return {
      success: false,
      error: "目標マップのノードが見つかりません。",
    };
  }

  const safeCurrent = Number(current);

  if (!Number.isFinite(safeCurrent) || safeCurrent < 0) {
    return {
      success: false,
      error: "進捗は0以上の数値で指定してください。",
    };
  }

  const existing = data.progress[mapId] || {};

  let safeTarget = existing.target;

  if (target !== undefined) {
    safeTarget = Number(target);

    if (!Number.isFinite(safeTarget) || safeTarget < 0) {
      return {
        success: false,
        error: "目標値は0以上の数値で指定してください。",
      };
    }
  }

  if (!Number.isFinite(safeTarget)) {
    safeTarget =
      node.targetMinutes ||
      node.targetCount ||
      0;
  }

  data.progress[mapId] = {
    current: safeCurrent,
    target: safeTarget,
    updatedAt: new Date().toISOString(),
  };

  saveMapData(data);

  return {
    success: true,
    progress: getGoalMapProgress(mapId),
  };
}

/* ---------------------------------------------------------
   解放条件
   --------------------------------------------------------- */

/**
 * ノードが解放されているか確認する
 *
 * すべての親ノードが達成済みの場合に解放する。
 */
export function isGoalMapNodeUnlocked(mapId) {
  const data = getStoredMapData();
  const node = getGoalMapNode(mapId);

  if (!node) {
    return false;
  }

  if (node.parentIds.length === 0) {
    return true;
  }

  return node.parentIds.every((parentId) => {
    return data.completedNodeIds.includes(parentId);
  });
}

/**
 * 解放済みノードの一覧を取得する
 */
export function getUnlockedGoalMapNodes() {
  return getGoalMapNodes().filter((node) => {
    return isGoalMapNodeUnlocked(node.mapId);
  });
}

/**
 * ロック中ノードの一覧を取得する
 */
export function getLockedGoalMapNodes() {
  return getGoalMapNodes().filter((node) => {
    return !isGoalMapNodeUnlocked(node.mapId);
  });
}

/* ---------------------------------------------------------
   達成
   --------------------------------------------------------- */

/**
 * ノードを達成済みにする
 *
 * 報酬は記録するが、EXPへの加算は別モジュールとの
 * 接続時に実装する。
 */
export function completeGoalMapNode(mapId) {
  const data = getStoredMapData();
  const node = data.nodes.find(
    (item) => item.mapId === mapId
  );

  if (!node) {
    return {
      success: false,
      error: "目標マップのノードが見つかりません。",
    };
  }

  if (!isGoalMapNodeUnlocked(mapId)) {
    return {
      success: false,
      error: "先に必要な目標を達成してください。",
    };
  }

  if (data.completedNodeIds.includes(mapId)) {
    return {
      success: true,
      alreadyCompleted: true,
      node,
    };
  }

  data.completedNodeIds.push(mapId);

  saveMapData(data);

  return {
    success: true,
    alreadyCompleted: false,
    node,
    rewardExp: Math.max(0, Number(node.rewardExp) || 0),
  };
}

/**
 * 達成報酬を一度だけ受け取った記録をつける
 *
 * EXPそのものは加算しない。
 */
export function claimGoalMapReward(mapId) {
  const data = getStoredMapData();

  if (!data.completedNodeIds.includes(mapId)) {
    return {
      success: false,
      error: "未達成の目標には報酬を受け取れません。",
    };
  }

  if (data.claimedRewardIds.includes(mapId)) {
    return {
      success: false,
      alreadyClaimed: true,
      error: "この報酬は受け取り済みです。",
    };
  }

  const node = data.nodes.find(
    (item) => item.mapId === mapId
  );

  if (!node) {
    return {
      success: false,
      error: "目標マップのノードが見つかりません。",
    };
  }

  data.claimedRewardIds.push(mapId);
  saveMapData(data);

  return {
    success: true,
    rewardExp: Math.max(0, Number(node.rewardExp) || 0),
    mapId,
  };
}

/* ---------------------------------------------------------
   ノード追加
   --------------------------------------------------------- */

/**
 * 独自の目標をマップに追加する
 *
 * 位置 x / y は0〜100の割合。
 * parentIdsは解放条件になる親ノードのID。
 */
export function addGoalMapNode({
  title,
  description = "",
  branch = "custom",
  x = 50,
  y = 50,
  parentIds = [],
  goalId = null,
  targetMinutes = 0,
  targetCount = 0,
  rewardExp = 10,
  isFinal = false,
} = {}) {
  const cleanTitle = String(title || "").trim();

  if (!cleanTitle) {
    return {
      success: false,
      error: "目標名を入力してください。",
    };
  }

  if (!Array.isArray(parentIds)) {
    return {
      success: false,
      error: "親ノードの指定が正しくありません。",
    };
  }

  const nodes = getGoalMapNodes();

  const validParentIds = parentIds.filter((id) => {
    return nodes.some((node) => node.mapId === id);
  });

  if (validParentIds.length !== parentIds.length) {
    return {
      success: false,
      error: "存在しない親ノードが指定されています。",
    };
  }

  const safeX = Number(x);
  const safeY = Number(y);
  const safeTargetMinutes = Number(targetMinutes);
  const safeTargetCount = Number(targetCount);
  const safeRewardExp = Number(rewardExp);

  if (
    !Number.isFinite(safeX) ||
    !Number.isFinite(safeY) ||
    safeX < 0 ||
    safeX > 100 ||
    safeY < 0 ||
    safeY > 100
  ) {
    return {
      success: false,
      error: "位置は0〜100の範囲で指定してください。",
    };
  }

  if (
    !Number.isFinite(safeTargetMinutes) ||
    safeTargetMinutes < 0 ||
    !Number.isFinite(safeTargetCount) ||
    safeTargetCount < 0 ||
    !Number.isFinite(safeRewardExp) ||
    safeRewardExp < 0
  ) {
    return {
      success: false,
      error: "目標値や報酬の指定が正しくありません。",
    };
  }

  const node = {
    mapId: createId(),
    title: cleanTitle,
    description: String(description || ""),
    branch: String(branch || "custom"),
    x: safeX,
    y: safeY,
    parentIds: validParentIds,
    goalId,
    targetMinutes: safeTargetMinutes,
    targetCount: safeTargetCount,
    rewardExp: Math.floor(safeRewardExp),
    isFinal: Boolean(isFinal),
    createdAt: new Date().toISOString(),
  };

  const data = getStoredMapData();

  if (data.nodes.length === 0) {
    data.nodes = DEFAULT_NODES.map((item) => ({ ...item }));
  }

  data.nodes.push(node);
  saveMapData(data);

  return {
    success: true,
    node,
  };
}

/* ---------------------------------------------------------
   ノード削除
   --------------------------------------------------------- */

/**
 * 独自ノードを削除する
 *
 * 初期マップのノードは削除できない。
 * 他ノードから親として参照されている場合も削除しない。
 */
export function deleteGoalMapNode(mapId) {
  const defaultIds = new Set(
    DEFAULT_NODES.map((node) => node.mapId)
  );

  if (defaultIds.has(mapId)) {
    return {
      success: false,
      error: "初期マップのノードは削除できません。",
    };
  }

  const data = getStoredMapData();
  const exists = data.nodes.some(
    (node) => node.mapId === mapId
  );

  if (!exists) {
    return {
      success: false,
      error: "目標マップのノードが見つかりません。",
    };
  }

  const referenced = data.nodes.some((node) => {
    return node.parentIds.includes(mapId);
  });

  if (referenced) {
    return {
      success: false,
      error: "他の目標が接続されているため削除できません。",
    };
  }

  data.nodes = data.nodes.filter(
    (node) => node.mapId !== mapId
  );

  delete data.progress[mapId];

  data.completedNodeIds =
    data.completedNodeIds.filter((id) => id !== mapId);

  data.claimedRewardIds =
    data.claimedRewardIds.filter((id) => id !== mapId);

  saveMapData(data);

  return {
    success: true,
  };
}

/* ---------------------------------------------------------
   マップ全体の概要
   --------------------------------------------------------- */

/**
 * マップ全体の進行状況を取得する
 */
export function getGoalMapSummary() {
  const nodes = getGoalMapNodes();
  const data = getStoredMapData();

  const completed = nodes.filter((node) => {
    return data.completedNodeIds.includes(node.mapId);
  });

  const unlocked = getUnlockedGoalMapNodes();

  const finalNode = nodes.find((node) => node.isFinal) || null;

  const totalRewardExp = completed.reduce((total, node) => {
    return total + Math.max(0, Number(node.rewardExp) || 0);
  }, 0);

  const claimedRewardExp = completed.reduce((total, node) => {
    if (!data.claimedRewardIds.includes(node.mapId)) {
      return total;
    }

    return total + Math.max(0, Number(node.rewardExp) || 0);
  }, 0);

  return {
    totalNodes: nodes.length,
    completedNodes: completed.length,
    unlockedNodes: unlocked.length,
    lockedNodes: nodes.length - unlocked.length,

    completionPercent:
      nodes.length > 0
        ? Math.floor((completed.length / nodes.length) * 100)
        : 0,

    totalRewardExp,
    claimedRewardExp,

    finalNode,
    finalNodeCompleted:
      finalNode !== null &&
      data.completedNodeIds.includes(finalNode.mapId),
  };
}

/* ---------------------------------------------------------
   描画用データ
   --------------------------------------------------------- */

/**
 * 画面側がスキルツリーを描画しやすい形に整える
 *
 * SVGやHTMLの描画自体は行わない。
 */
export function getGoalMapRenderData() {
  const nodes = getGoalMapNodes();

  const completedIds = new Set(
    getStoredMapData().completedNodeIds
  );

  const edges = [];

  for (const node of nodes) {
    for (const parentId of node.parentIds) {
      const parent = nodes.find(
        (item) => item.mapId === parentId
      );

      if (!parent) {
        continue;
      }

      edges.push({
        from: parent.mapId,
        to: node.mapId,
        fromX: parent.x,
        fromY: parent.y,
        toX: node.x,
        toY: node.y,
        completed:
          completedIds.has(parent.mapId) &&
          completedIds.has(node.mapId),
      });
    }
  }

  const renderNodes = nodes.map((node) => ({
    ...node,
    unlocked: isGoalMapNodeUnlocked(node.mapId),
    completed: completedIds.has(node.mapId),
    progress: getGoalMapProgress(node.mapId),
  }));

  return {
    nodes: renderNodes,
    edges,
    summary: getGoalMapSummary(),
  };
}
