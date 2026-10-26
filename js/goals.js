
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/goals.js
 *
 * 目標管理システム
 *
 * 担当:
 * - 目標の追加・編集・削除
 * - 親目標と子目標の管理
 * - 目標の達成状態
 * - 期限管理
 * - 目標マップ用データ
 * - 目標達成イベントの通知
 *
 * 画面の描画は別モジュールが担当します。
 */

import {
  STORAGE_KEYS,
  loadArray,
  saveData,
  createId,
  getTodayKey
} from "./storage.js";

// --------------------------------------------------
// 保存先
// --------------------------------------------------

const GOALS_STORAGE_KEY =
  STORAGE_KEYS?.goals ?? "oneforall-goals-v1";

// --------------------------------------------------
// 内部処理
// --------------------------------------------------

function notifyGoalChange(type, goal = null) {
  if (typeof document === "undefined") {
    return;
  }

  document.dispatchEvent(
    new CustomEvent("cosmos:goals-change", {
      detail: {
        type,
        goal
      }
    })
  );
}

function normalizeText(value, maxLength = 120) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function normalizeDate(value) {
  const date = String(value ?? "").trim();

  if (!date) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return null;
  }

  return date;
}

function normalizeType(value) {
  const allowed = [
    "main",
    "study",
    "habit",
    "exam",
    "milestone",
    "custom"
  ];

  const type = String(value ?? "custom");

  return allowed.includes(type) ? type : "custom";
}

function normalizeStatus(value, done) {
  if (done) {
    return "completed";
  }

  const allowed = [
    "locked",
    "available",
    "in_progress",
    "completed"
  ];

  const status = String(value ?? "available");

  return allowed.includes(status)
    ? status
    : "available";
}

function getAllGoals() {
  const goals = loadArray(GOALS_STORAGE_KEY);

  return goals.filter(goal =>
    goal &&
    typeof goal === "object" &&
    typeof goal.id === "string"
  );
}

function saveGoals(goals) {
  saveData(GOALS_STORAGE_KEY, goals);
}

function findGoal(goals, id) {
  return goals.find(goal => goal.id === String(id));
}

function hasCircularParent(goals, goalId, parentId) {
  let currentId = parentId;
  const visited = new Set();

  while (currentId) {
    if (currentId === goalId) {
      return true;
    }

    if (visited.has(currentId)) {
      return true;
    }

    visited.add(currentId);

    const current = findGoal(goals, currentId);

    if (!current) {
      return false;
    }

    currentId = current.parentId || null;
  }

  return false;
}

function normalizeGoalInput(input = {}) {
  const name = normalizeText(input.name, 120);
  const description = normalizeText(
    input.description ?? input.note,
    1000
  );

  const dueDate = normalizeDate(input.dueDate);

  if (!name) {
    return {
      ok: false,
      error: "目標名を入力してください。"
    };
  }

  if (dueDate === null) {
    return {
      ok: false,
      error: "期限の日付が正しくありません。"
    };
  }

  const rawProgress = Number(input.progress ?? 0);

  const progress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, Math.round(rawProgress)))
    : 0;

  const done = Boolean(input.done) ||
    input.status === "completed";

  return {
    ok: true,
    goal: {
      name,
      description,
      type: normalizeType(input.type),
      parentId: input.parentId
        ? String(input.parentId)
        : null,
      dueDate,
      progress: done ? 100 : progress,
      done,
      status: normalizeStatus(input.status, done),
      color: normalizeText(input.color, 30),
      icon: normalizeText(input.icon, 30),
      position: {
        x: Number.isFinite(Number(input.position?.x))
          ? Number(input.position.x)
          : 0,
        y: Number.isFinite(Number(input.position?.y))
          ? Number(input.position.y)
          : 0
      }
    }
  };
}

// --------------------------------------------------
// 基本取得
// --------------------------------------------------

/**
 * すべての目標を取得します。
 */
export function getGoals() {
  return getAllGoals();
}

/**
 * IDで目標を取得します。
 */
export function getGoalById(id) {
  return getAllGoals().find(
    goal => goal.id === String(id)
  ) ?? null;
}

/**
 * 親目標を指定して子目標を取得します。
 * parentId が null の場合はルート目標を取得します。
 */
export function getChildGoals(parentId = null) {
  const expectedParent = parentId
    ? String(parentId)
    : null;

  return getAllGoals().filter(goal =>
    (goal.parentId || null) === expectedParent
  );
}

/**
 * 目標の子孫をすべて取得します。
 */
export function getDescendantGoals(goalId) {
  const goals = getAllGoals();
  const result = [];
  const visited = new Set([String(goalId)]);
  const queue = [String(goalId)];

  while (queue.length > 0) {
    const currentId = queue.shift();

    for (const goal of goals) {
      if (
        goal.parentId === currentId &&
        !visited.has(goal.id)
      ) {
        visited.add(goal.id);
        result.push(goal);
        queue.push(goal.id);
      }
    }
  }

  return result;
}

// --------------------------------------------------
// 目標の作成
// --------------------------------------------------

/**
 * 新しい目標を作成します。
 *
 * 例:
 * addGoal({
 *   name: "英語の試験で目標点を取る",
 *   type: "exam",
 *   dueDate: "2027-01-20"
 * })
 *
 * 成功時は作成した目標を返します。
 * 失敗時は { error: "..." } を返します。
 */
export function addGoal(input = {}) {
  const goals = getAllGoals();
  const normalized = normalizeGoalInput(input);

  if (!normalized.ok) {
    return {
      error: normalized.error
    };
  }

  const parentId = normalized.goal.parentId;

  if (parentId && !findGoal(goals, parentId)) {
    return {
      error: "親目標が見つかりません。"
    };
  }

  const id = createId();

  if (parentId && hasCircularParent(goals, id, parentId)) {
    return {
      error: "目標の親子関係が正しくありません。"
    };
  }

  const now = new Date().toISOString();

  const goal = {
    id,
    ...normalized.goal,
    createdAt: now,
    updatedAt: now,
    completedAt: normalized.goal.done
      ? now
      : null
  };

  goals.push(goal);
  saveGoals(goals);

  notifyGoalChange("created", goal);

  return goal;
}

// --------------------------------------------------
// 目標の編集
// --------------------------------------------------

/**
 * 既存の目標を編集します。
 * 変更する項目だけを渡すこともできます。
 */
export function updateGoal(id, changes = {}) {
  const goals = getAllGoals();
  const index = goals.findIndex(
    goal => goal.id === String(id)
  );

  if (index === -1) {
    return {
      error: "目標が見つかりません。"
    };
  }

  const existing = goals[index];

  const merged = {
    ...existing,
    ...changes,
    position: {
      ...existing.position,
      ...(changes.position ?? {})
    }
  };

  const normalized = normalizeGoalInput(merged);

  if (!normalized.ok) {
    return {
      error: normalized.error
    };
  }

  const parentId = normalized.goal.parentId;

  if (parentId === existing.id) {
    return {
      error: "自分自身を親目標にはできません。"
    };
  }

  if (parentId && !findGoal(goals, parentId)) {
    return {
      error: "親目標が見つかりません。"
    };
  }

  if (
    parentId &&
    hasCircularParent(goals, existing.id, parentId)
  ) {
    return {
      error: "親子関係が循環するため変更できません。"
    };
  }

  const now = new Date().toISOString();

  const updated = {
    ...existing,
    ...normalized.goal,
    updatedAt: now,
    completedAt: normalized.goal.done
      ? (existing.completedAt || now)
      : null
  };

  goals[index] = updated;
  saveGoals(goals);

  notifyGoalChange("updated", updated);

  return updated;
}

// --------------------------------------------------
// 達成状態
// --------------------------------------------------

/**
 * 目標を達成済みにします。
 */
export function completeGoal(id) {
  const goal = getGoalById(id);

  if (!goal) {
    return {
      error: "目標が見つかりません。"
    };
  }

  if (goal.done) {
    return goal;
  }

  const updated = updateGoal(id, {
    done: true,
    status: "completed",
    progress: 100
  });

  if (!updated.error) {
    notifyGoalChange("completed", updated);
  }

  return updated;
}

/**
 * 目標の達成状態を切り替えます。
 */
export function toggleGoal(id) {
  const goal = getGoalById(id);

  if (!goal) {
    return {
      error: "目標が見つかりません。"
    };
  }

  if (goal.done) {
    return updateGoal(id, {
      done: false,
      status: "available",
      progress: 0
    });
  }

  return completeGoal(id);
}

/**
 * 目標の進捗を変更します。
 * 100%になると達成済みになります。
 */
export function setGoalProgress(id, progress) {
  const value = Number(progress);

  if (!Number.isFinite(value)) {
    return {
      error: "進捗率は数値で指定してください。"
    };
  }

  const normalized = Math.max(
    0,
    Math.min(100, Math.round(value))
  );

  if (normalized >= 100) {
    return completeGoal(id);
  }

  return updateGoal(id, {
    progress: normalized,
    done: false,
    status: normalized > 0
      ? "in_progress"
      : "available"
  });
}

// --------------------------------------------------
// 目標の削除
// --------------------------------------------------

/**
 * 目標を削除します。
 *
 * 子目標がある場合は、誤削除を防ぐため
 * cascade を true にしない限り削除しません。
 */
export function deleteGoal(id, { cascade = false } = {}) {
  const goals = getAllGoals();
  const goal = findGoal(goals, String(id));

  if (!goal) {
    return {
      error: "目標が見つかりません。"
    };
  }

  const descendants = getDescendantGoals(id);

  if (descendants.length > 0 && !cascade) {
    return {
      error: "子目標があります。まとめて削除する場合は cascade: true を指定してください。",
      childCount: descendants.length
    };
  }

  const idsToDelete = new Set([
    String(id),
    ...descendants.map(item => item.id)
  ]);

  const remaining = goals.filter(
    item => !idsToDelete.has(item.id)
  );

  saveGoals(remaining);

  notifyGoalChange("deleted", {
    id: String(id),
    deletedIds: Array.from(idsToDelete)
  });

  return {
    success: true,
    deletedCount: idsToDelete.size
  };
}

// --------------------------------------------------
// 目標マップ
// --------------------------------------------------

/**
 * 目標マップ用に、親子関係と状態を整理します。
 */
export function getGoalMapData() {
  const goals = getAllGoals();

  return goals.map(goal => ({
    ...goal,
    children: goals
      .filter(child => child.parentId === goal.id)
      .map(child => child.id),
    isRoot: !goal.parentId,
    isOverdue:
      !goal.done &&
      Boolean(goal.dueDate) &&
      goal.dueDate < getTodayKey()
  }));
}

/**
 * 目標の達成数と進捗率を取得します。
 */
export function getGoalSummary() {
  const goals = getAllGoals();
  const total = goals.length;
  const completed = goals.filter(goal => goal.done).length;
  const active = goals.filter(goal => !goal.done).length;
  const overdue = goals.filter(goal =>
    !goal.done &&
    goal.dueDate &&
    goal.dueDate < getTodayKey()
  ).length;

  return {
    total,
    completed,
    active,
    overdue,
    percentage: total > 0
      ? Math.round(completed / total * 100)
      : 0
  };
}

/**
 * 期限が近い未達成目標を取得します。
 */
export function getUpcomingGoals(limit = 5) {
  const count = Math.max(
    1,
    Math.min(100, Math.floor(Number(limit) || 5))
  );

  return getAllGoals()
    .filter(goal => !goal.done && goal.dueDate)
    .sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate)
    )
    .slice(0, count);
}
