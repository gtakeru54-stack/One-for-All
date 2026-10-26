
/* =========================================================
   ONE FOR ALL COSMOS
   js/dashboard.js

   ホーム画面のデータ集約
   ・今日の学習時間
   ・1日の目標達成率
   ・週間目標達成率
   ・次のカウントダウン
   ・今日の予定とタスク
   ・ロケットの進行状況
   ・習慣の達成状況
   ・経済情報
   ・ホーム画面カードの表示設定

   このファイルは表示用データを集約する。
   HTMLの生成や画面イベントの設定は別途行う。
   ========================================================= */

"use strict";

import {
  getTodayKey,
  loadArray,
} from "./storage.js";

import {
  getDailyStudySeconds,
  getTotalStudySeconds,
  getStudySummary,
} from "./study.js";

import {
  getEventsByDate,
  getTasksByDate,
} from "./calendar.js";

import {
  getUpcomingCountdowns,
  getCountdownSummary,
} from "./countdown.js";

import {
  getDailyStudyGoalMinutes,
  getWeeklyStudyGoalMinutes,
  getSettings,
} from "./settings.js";

import {
  getRocketSummary,
  getRocketState,
} from "./rocket.js";

import {
  getHabitSummary,
  getHabitsForDate,
} from "./habits.js";

import {
  getFinanceSummary,
} from "./finance.js";

import {
  getMissionDashboard,
} from "./missions.js";

/* ---------------------------------------------------------
   基本処理
   --------------------------------------------------------- */

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(
    0,
    Math.floor(Number(seconds) || 0)
  );

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  }

  return `${minutes}分`;
}

function safeCall(callback, fallback = null) {
  try {
    return callback();
  } catch (error) {
    console.error("[COSMOS Dashboard]", error);
    return fallback;
  }
}

function getTodayDate() {
  return getTodayKey();
}

function getDailyStudyMinutes() {
  const seconds = safeCall(
    () => getDailyStudySeconds(getTodayDate()),
    0
  );

  return Math.floor(Math.max(0, Number(seconds) || 0) / 60);
}

/* ---------------------------------------------------------
   学習時間と目標
   --------------------------------------------------------- */

/**
 * 今日の学習状況を取得する
 */
export function getDashboardStudyData() {
  const todaySeconds = safeCall(
    () => getDailyStudySeconds(getTodayDate()),
    0
  );

  const totalSeconds = safeCall(
    () => getTotalStudySeconds(),
    0
  );

  const dailyGoalMinutes = getDailyStudyGoalMinutes();
  const weeklyGoalMinutes = getWeeklyStudyGoalMinutes();

  const todayMinutes = Math.floor(
    Math.max(0, Number(todaySeconds) || 0) / 60
  );

  const dailyGoalSeconds = dailyGoalMinutes * 60;

  const dailyGoalPercent =
    dailyGoalSeconds > 0
      ? clampPercent(
          (todaySeconds / dailyGoalSeconds) * 100
        )
      : 0;

  const studySummary = safeCall(
    () => getStudySummary(),
    null
  );

  return {
    todaySeconds: Math.max(0, Number(todaySeconds) || 0),
    todayMinutes,
    todayFormatted: formatDuration(todaySeconds),

    totalSeconds: Math.max(0, Number(totalSeconds) || 0),
    totalFormatted: formatDuration(totalSeconds),

    dailyGoalMinutes,
    dailyGoalSeconds,
    dailyGoalPercent,

    dailyGoalRemainingSeconds: Math.max(
      0,
      dailyGoalSeconds - todaySeconds
    ),

    dailyGoalRemainingFormatted: formatDuration(
      Math.max(0, dailyGoalSeconds - todaySeconds)
    ),

    dailyGoalAchieved: todaySeconds >= dailyGoalSeconds,

    weeklyGoalMinutes,

    /*
     * studySummaryの内部構造に依存しないよう、
     * 取得できた場合だけ参照用に含める。
     */
    studySummary,
  };
}

/* ---------------------------------------------------------
   今日の予定
   --------------------------------------------------------- */

/**
 * 今日のカレンダー情報を取得する
 */
export function getDashboardCalendarData() {
  const today = getTodayDate();

  const events = safeCall(
    () => getEventsByDate(today),
    []
  );

  const tasks = safeCall(
    () => getTasksByDate(today),
    []
  );

  const normalizedEvents = Array.isArray(events)
    ? events
    : [];

  const normalizedTasks = Array.isArray(tasks)
    ? tasks
    : [];

  const incompleteTasks = normalizedTasks.filter(
    (task) => !task.completed
  );

  const completedTasks = normalizedTasks.filter(
    (task) => Boolean(task.completed)
  );

  return {
    date: today,
    events: normalizedEvents,
    tasks: normalizedTasks,

    eventCount: normalizedEvents.length,
    taskCount: normalizedTasks.length,

    completedTaskCount: completedTasks.length,
    incompleteTaskCount: incompleteTasks.length,

    incompleteTasks,
    completedTasks,
  };
}

/* ---------------------------------------------------------
   次のカウントダウン
   --------------------------------------------------------- */

/**
 * 直近のイベントを取得する
 */
export function getDashboardCountdownData() {
  const countdowns = safeCall(
    () => getUpcomingCountdowns({
      limit: 5,
      includeToday: true,
    }),
    []
  );

  const summary = safeCall(
    () => getCountdownSummary(),
    null
  );

  const upcoming = Array.isArray(countdowns)
    ? countdowns
    : [];

  return {
    nextEvent: upcoming[0] || null,
    upcoming,
    summary,
    count: upcoming.length,
  };
}

/* ---------------------------------------------------------
   習慣
   --------------------------------------------------------- */

/**
 * 今日の習慣の状況を取得する
 */
export function getDashboardHabitData() {
  const today = getTodayDate();

  const habits = safeCall(
    () => getHabitsForDate(today),
    []
  );

  const summary = safeCall(
    () => getHabitSummary(today),
    null
  );

  const normalizedHabits = Array.isArray(habits)
    ? habits
    : [];

  const completedHabits = normalizedHabits.filter(
    (habit) => Boolean(habit.completed)
  );

  const remainingHabits = normalizedHabits.filter(
    (habit) => !habit.completed
  );

  const completionPercent =
    normalizedHabits.length > 0
      ? clampPercent(
          (completedHabits.length / normalizedHabits.length) * 100
        )
      : 0;

  return {
    date: today,
    habits: normalizedHabits,
    summary,

    total: normalizedHabits.length,
    completed: completedHabits.length,
    remaining: remainingHabits.length,

    completionPercent,
    allCompleted:
      normalizedHabits.length > 0 &&
      completedHabits.length === normalizedHabits.length,
  };
}

/* ---------------------------------------------------------
   ロケット
   --------------------------------------------------------- */

/**
 * ロケットの成長情報を取得する
 */
export function getDashboardRocketData() {
  const state = safeCall(
    () => getRocketState(),
    null
  );

  const summary = safeCall(
    () => getRocketSummary(),
    null
  );

  const missionDashboard = safeCall(
    () => getMissionDashboard(),
    null
  );

  return {
    state,
    summary,
    missionDashboard,
  };
}

/* ---------------------------------------------------------
   経済
   --------------------------------------------------------- */

/**
 * 経済システムの概要を取得する
 */
export function getDashboardFinanceData() {
  return safeCall(
    () => getFinanceSummary(),
    {
      balance: 0,
      totalDebt: 0,
      activeLoanCount: 0,
      overdueLoanCount: 0,
    }
  );
}

/* ---------------------------------------------------------
   ホーム画面のカード設定
   --------------------------------------------------------- */

/**
 * 各カードの表示・非表示を取得する
 */
export function getDashboardCardVisibility() {
  const settings = getSettings();

  return {
    dailyGoal: settings.home.showDailyGoal,
    nextEvent: settings.home.showNextEvent,
    nextStudyItem: settings.home.showNextStudyItem,
    rocket: settings.home.showRocket,
    habits: settings.home.showHabitList,
    finance: settings.home.showFinance,
  };
}

/* ---------------------------------------------------------
   学習の次の一歩
   --------------------------------------------------------- */

/**
 * 最低限の学習行動を取得する
 *
 * 「今すぐ5分」ボタンなどで使用する。
 */
export function getDashboardMinimumAction() {
  const settings = getSettings();
  const minutes = settings.study.minimumActionMinutes;

  return {
    minutes,
    seconds: minutes * 60,
    label: `今すぐ${minutes}分`,
    description: `${minutes}分だけ学習を始めましょう。`,
  };
}

/* ---------------------------------------------------------
   ホーム画面の全データ
   --------------------------------------------------------- */

/**
 * ホーム画面に必要なデータを一括取得する
 *
 * 使用例：
 * const dashboard = getDashboardData();
 * console.log(dashboard.study.todayFormatted);
 */
export function getDashboardData() {
  return {
    updatedAt: new Date().toISOString(),
    date: getTodayDate(),

    study: getDashboardStudyData(),
    calendar: getDashboardCalendarData(),
    countdown: getDashboardCountdownData(),
    habits: getDashboardHabitData(),
    rocket: getDashboardRocketData(),
    finance: getDashboardFinanceData(),

    cardVisibility: getDashboardCardVisibility(),
    minimumAction: getDashboardMinimumAction(),
  };
}

/* ---------------------------------------------------------
   表示用データの更新通知
   --------------------------------------------------------- */

/**
 * ホーム画面の再描画を要求する
 *
 * 各機能の保存処理から自動で呼び出されるわけではない。
 * 必要なタイミングで呼び出す。
 */
export function notifyDashboardUpdate() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("cosmos:dashboard-update", {
      detail: getDashboardData(),
    })
  );
}
