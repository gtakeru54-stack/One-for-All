
/* =========================================================
   ONE FOR ALL COSMOS
   js/statistics.js

   学習統計システム
   ・今日 / 昨日 / 直近7日 / 直近30日
   ・全期間の学習時間
   ・科目別の学習時間
   ・日別の学習時間
   ・学習時間の円グラフ用データ
   ・週間 / 月間の比較
   ・目標達成率
   ・連続学習日数
   ・曜日別の学習時間
   ・グラフ表示用データ

   学習記録：既存の js/study.js を利用
   ========================================================= */

"use strict";

import {
  getStudyRecords,
  getSubjects,
  getTodayStudyMinutes,
  getWeekStudyMinutes,
  getTotalStudyMinutes,
  getSubjectStudyStats,
  getDailyStudyStats,
  formatStudyTime
} from "./study.js";

/* =========================================================
   1. 共通関数
   ========================================================= */

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(value || "")
  );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const result = new Date(year, month - 1, day);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }

  return result;
}

function startOfDay(date = new Date()) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
}

function shiftDays(date, days) {
  const result = startOfDay(date);

  result.setDate(result.getDate() + days);

  return result;
}

function sumMinutes(records) {
  return records.reduce(
    (sum, record) => sum + Math.max(0, Number(record.minutes) || 0),
    0
  );
}

function getRecordsBetween(startDate, endDate) {
  const from = dateKey(startDate);
  const to = dateKey(endDate);

  return getStudyRecords({ from, to });
}

function percentage(value, total) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 1000) / 10;
}

/* =========================================================
   2. 基本統計
   ========================================================= */

export function getBasicStatistics() {
  const today = startOfDay();
  const yesterday = shiftDays(today, -1);
  const weekStart = shiftDays(today, -6);
  const monthStart = shiftDays(today, -29);

  const todayMinutes = getTodayStudyMinutes();

  const yesterdayMinutes = sumMinutes(
    getRecordsBetween(yesterday, yesterday)
  );

  const weekMinutes = getWeekStudyMinutes();

  const monthMinutes = sumMinutes(
    getRecordsBetween(monthStart, today)
  );

  const totalMinutes = getTotalStudyMinutes();

  return {
    todayMinutes,
    yesterdayMinutes,
    weekMinutes,
    monthMinutes,
    totalMinutes,

    todayText: formatStudyTime(todayMinutes),
    yesterdayText: formatStudyTime(yesterdayMinutes),
    weekText: formatStudyTime(weekMinutes),
    monthText: formatStudyTime(monthMinutes),
    totalText: formatStudyTime(totalMinutes)
  };
}

/* =========================================================
   3. 円グラフ用データ
   ========================================================= */

/**
 * 科目ごとの学習時間を円グラフ用に変換する。
 *
 * 戻り値の例：
 * [
 *   { name: "数学", value: 120, percentage: 50, color: "#..." }
 * ]
 */
export function getSubjectPieChart({
  from,
  to
} = {}) {
  const stats = getSubjectStudyStats({ from, to });

  const total = stats.reduce(
    (sum, item) => sum + item.minutes,
    0
  );

  return stats
    .filter(item => item.minutes > 0)
    .map(item => ({
      name: item.subjectName,
      subjectId: item.subjectId,
      value: item.minutes,
      minutes: item.minutes,
      percentage: percentage(item.minutes, total),
      color: item.color,
      formattedTime: formatStudyTime(item.minutes)
    }));
}

/* =========================================================
   4. 直近7日間のグラフ
   ========================================================= */

export function getWeeklyChartData() {
  const daily = getDailyStudyStats(7);

  return daily.map(day => {
    const date = parseDate(day.date);

    return {
      date: day.date,
      label: date
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : day.date,
      minutes: day.minutes,
      hours: Math.round((day.minutes / 60) * 100) / 100,
      formattedTime: formatStudyTime(day.minutes)
    };
  });
}

/* =========================================================
   5. 直近30日間のグラフ
   ========================================================= */

export function getMonthlyChartData() {
  const daily = getDailyStudyStats(30);

  return daily.map(day => {
    const date = parseDate(day.date);

    return {
      date: day.date,
      label: date
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : day.date,
      minutes: day.minutes,
      hours: Math.round((day.minutes / 60) * 100) / 100,
      formattedTime: formatStudyTime(day.minutes)
    };
  });
}

/* =========================================================
   6. 科目別の詳細
   ========================================================= */

export function getSubjectStatistics({
  from,
  to
} = {}) {
  const subjects = getSubjects();

  const stats = getSubjectStudyStats({ from, to });

  const total = stats.reduce(
    (sum, item) => sum + item.minutes,
    0
  );

  return stats.map(item => {
    const subject = subjects.find(
      entry => entry.id === item.subjectId
    );

    return {
      ...item,
      percentage: percentage(item.minutes, total),
      formattedTime: formatStudyTime(item.minutes),
      itemCount: subject ? subject.items.length : 0
    };
  });
}

/* =========================================================
   7. 期間比較
   ========================================================= */

/**
 * 直近7日間と、その前の7日間を比較する。
 */
export function getWeeklyComparison() {
  const today = startOfDay();

  const currentStart = shiftDays(today, -6);
  const previousEnd = shiftDays(today, -7);
  const previousStart = shiftDays(today, -13);

  const currentMinutes = sumMinutes(
    getRecordsBetween(currentStart, today)
  );

  const previousMinutes = sumMinutes(
    getRecordsBetween(previousStart, previousEnd)
  );

  const difference = currentMinutes - previousMinutes;

  let changePercentage = null;

  if (previousMinutes > 0) {
    changePercentage =
      Math.round(
        (difference / previousMinutes) * 1000
      ) / 10;
  } else if (currentMinutes > 0) {
    changePercentage = 100;
  } else {
    changePercentage = 0;
  }

  return {
    currentMinutes,
    previousMinutes,
    difference,
    changePercentage,
    increased: difference > 0,
    decreased: difference < 0,
    currentText: formatStudyTime(currentMinutes),
    previousText: formatStudyTime(previousMinutes),
    differenceText: formatStudyTime(Math.abs(difference))
  };
}

/* =========================================================
   8. 目標達成率
   ========================================================= */

/**
 * 1日の学習目標を分単位で指定する。
 *
 * 例：
 * getDailyGoalProgress(120)
 */
export function getDailyGoalProgress(goalMinutes = 120) {
  const goal = Math.max(0, Number(goalMinutes) || 0);

  const studied = getTodayStudyMinutes();

  const progress =
    goal > 0
      ? Math.min(100, percentage(studied, goal))
      : 0;

  return {
    goalMinutes: goal,
    studiedMinutes: studied,
    remainingMinutes: Math.max(0, goal - studied),
    progress,
    completed: goal > 0 && studied >= goal,
    goalText: formatStudyTime(goal),
    studiedText: formatStudyTime(studied),
    remainingText: formatStudyTime(
      Math.max(0, goal - studied)
    )
  };
}

/**
 * 1週間の学習目標を分単位で指定する。
 */
export function getWeeklyGoalProgress(goalMinutes = 840) {
  const goal = Math.max(0, Number(goalMinutes) || 0);

  const studied = getWeekStudyMinutes();

  const progress =
    goal > 0
      ? Math.min(100, percentage(studied, goal))
      : 0;

  return {
    goalMinutes: goal,
    studiedMinutes: studied,
    remainingMinutes: Math.max(0, goal - studied),
    progress,
    completed: goal > 0 && studied >= goal,
    goalText: formatStudyTime(goal),
    studiedText: formatStudyTime(studied),
    remainingText: formatStudyTime(
      Math.max(0, goal - studied)
    )
  };
}

/* =========================================================
   9. 連続学習日数
   ========================================================= */

export function getStudyStreak() {
  const records = getStudyRecords();

  const studyDates = new Set(
    records
      .filter(record => Number(record.minutes) > 0)
      .map(record => record.date)
  );

  const today = startOfDay();

  /*
   * 今日まだ勉強していない場合、
   * 昨日までの連続記録を維持して数える。
   */
  let cursor = studyDates.has(dateKey(today))
    ? today
    : shiftDays(today, -1);

  let streak = 0;

  while (studyDates.has(dateKey(cursor))) {
    streak++;
    cursor = shiftDays(cursor, -1);
  }

  return {
    days: streak,
    activeToday: studyDates.has(dateKey(today))
  };
}

/* =========================================================
   10. 曜日別の学習時間
   ========================================================= */

export function getWeekdayStatistics({
  from,
  to
} = {}) {
  const records = getStudyRecords({ from, to });

  const result = Array.from({ length: 7 }, (_, day) => ({
    weekday: day,
    label: ["日", "月", "火", "水", "木", "金", "土"][day],
    minutes: 0,
    recordCount: 0
  }));

  for (const record of records) {
    const date = parseDate(record.date);

    if (!date) {
      continue;
    }

    const item = result[date.getDay()];

    item.minutes += Math.max(0, Number(record.minutes) || 0);
    item.recordCount++;
  }

  return result.map(item => ({
    ...item,
    hours: Math.round((item.minutes / 60) * 100) / 100,
    formattedTime: formatStudyTime(item.minutes)
  }));
}

/* =========================================================
   11. 学習項目別の統計
   ========================================================= */

export function getStudyItemStatistics({
  from,
  to
} = {}) {
  const records = getStudyRecords({ from, to });

  const map = new Map();

  for (const record of records) {
    const key = `${record.subjectId}::${record.itemId || "free"}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        subjectId: record.subjectId,
        subjectName: record.subjectName || "未分類",
        itemId: record.itemId || "",
        itemName: record.itemName || "自由学習",
        minutes: 0,
        recordCount: 0
      });
    }

    const item = map.get(key);

    item.minutes += Math.max(0, Number(record.minutes) || 0);
    item.recordCount++;
  }

  return Array.from(map.values())
    .map(item => ({
      ...item,
      formattedTime: formatStudyTime(item.minutes)
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

/* =========================================================
   12. 学習時間のランキング
   ========================================================= */

export function getTopSubjects(limit = 5, options = {}) {
  const safeLimit = Math.max(
    0,
    Math.min(100, Math.floor(Number(limit) || 5))
  );

  return getSubjectStatistics(options)
    .filter(item => item.minutes > 0)
    .slice(0, safeLimit)
    .map((item, index) => ({
      rank: index + 1,
      ...item
    }));
}

/* =========================================================
   13. ダッシュボード用の統計
   ========================================================= */

/**
 * ホーム画面や統計画面でまとめて使うデータ。
 */
export function getStatisticsDashboard({
  dailyGoalMinutes = 120,
  weeklyGoalMinutes = 840
} = {}) {
  return {
    basic: getBasicStatistics(),

    dailyGoal: getDailyGoalProgress(
      dailyGoalMinutes
    ),

    weeklyGoal: getWeeklyGoalProgress(
      weeklyGoalMinutes
    ),

    streak: getStudyStreak(),

    pieChart: getSubjectPieChart(),

    weeklyChart: getWeeklyChartData(),

    monthlyChart: getMonthlyChartData(),

    weeklyComparison: getWeeklyComparison(),

    topSubjects: getTopSubjects(5)
  };
}

/* =========================================================
   14. まとめ
   ========================================================= */

export const statistics = Object.freeze({
  getBasicStatistics,

  getSubjectPieChart,
  getWeeklyChartData,
  getMonthlyChartData,

  getSubjectStatistics,
  getWeeklyComparison,

  getDailyGoalProgress,
  getWeeklyGoalProgress,

  getStudyStreak,
  getWeekdayStatistics,
  getStudyItemStatistics,

  getTopSubjects,
  getStatisticsDashboard
});
