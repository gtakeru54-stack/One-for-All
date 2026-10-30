
/* =========================================================
   ALGOL — Study Constellation
   js/statistics.js

   学習統計・分析レポート

   ・日別、週別、月別の学習時間
   ・科目別、学習項目別の集計
   ・学習時間の推移
   ・目標時間との比較
   ・達成率の計算
   ・グラフ表示用データの生成
   ========================================================= */

"use strict";

import {
  getAllStudyRecords,
  getAllSubjects,
  getAllStudyItems,
  formatStudyMinutes
} from "./study.js";

import { loadData } from "./store.js";

/* =========================================================
   共通関数
   ========================================================= */

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(dateValue) {
  if (dateValue instanceof Date) {
    return new Date(dateValue);
  }

  if (typeof dateValue !== "string") {
    return null;
  }

  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date) {
  const result = startOfDay(date);
  const day = result.getDay();

  // 月曜日を週の開始日にする
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);

  return result;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonths(date, amount) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1
  );
}

function getMinutes(record) {
  const minutes = Number(record.minutes);

  return Number.isFinite(minutes) && minutes > 0
    ? minutes
    : 0;
}

function getRecordDate(record) {
  return parseDate(record.date);
}

function getRecordsInRange(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  return getAllStudyRecords().filter(record => {
    const date = getRecordDate(record);

    if (!date) {
      return false;
    }

    const normalized = startOfDay(date);

    return normalized >= start && normalized <= end;
  });
}

function sumMinutes(records) {
  return records.reduce(
    (total, record) => total + getMinutes(record),
    0
  );
}

function roundPercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

function getSettings() {
  return loadData("settings", {
    dailyTarget: 60,
    weeklyTarget: 420
  });
}

/* =========================================================
   日別統計
   ========================================================= */

export function getDailyStatistics(date = new Date()) {
  const target = startOfDay(new Date(date));
  const dateKey = toDateKey(target);

  const records = getAllStudyRecords().filter(record => {
    return record.date === dateKey;
  });

  const totalMinutes = sumMinutes(records);
  const settings = getSettings();
  const targetMinutes = Math.max(
    0,
    Number(settings.dailyTarget) || 0
  );

  return {
    date: dateKey,
    totalMinutes,
    formattedTime: formatStudyMinutes(totalMinutes),
    targetMinutes,
    achievementRate: targetMinutes > 0
      ? roundPercent(totalMinutes / targetMinutes * 100)
      : 0,
    remainingMinutes: Math.max(0, targetMinutes - totalMinutes),
    recordCount: records.length,
    records
  };
}

/* =========================================================
   週別統計
   ========================================================= */

export function getWeeklyStatistics(date = new Date()) {
  const weekStart = startOfWeek(new Date(date));
  const weekEnd = addDays(weekStart, 6);

  const records = getRecordsInRange(weekStart, weekEnd);
  const totalMinutes = sumMinutes(records);

  const settings = getSettings();
  const targetMinutes = Math.max(
    0,
    Number(settings.weeklyTarget) || 0
  );

  const daily = [];

  for (let i = 0; i < 7; i++) {
    const current = addDays(weekStart, i);
    const dateKey = toDateKey(current);

    const dayRecords = records.filter(
      record => record.date === dateKey
    );

    daily.push({
      date: dateKey,
      day: ["月", "火", "水", "木", "金", "土", "日"][i],
      minutes: sumMinutes(dayRecords),
      recordCount: dayRecords.length
    });
  }

  return {
    startDate: toDateKey(weekStart),
    endDate: toDateKey(weekEnd),
    totalMinutes,
    formattedTime: formatStudyMinutes(totalMinutes),
    targetMinutes,
    achievementRate: targetMinutes > 0
      ? roundPercent(totalMinutes / targetMinutes * 100)
      : 0,
    remainingMinutes: Math.max(0, targetMinutes - totalMinutes),
    daily
  };
}

/* =========================================================
   月別統計
   ========================================================= */

export function getMonthlyStatistics(date = new Date()) {
  const monthStart = startOfMonth(new Date(date));
  const nextMonth = addMonths(monthStart, 1);
  const monthEnd = addDays(nextMonth, -1);

  const records = getRecordsInRange(monthStart, monthEnd);
  const totalMinutes = sumMinutes(records);

  const daysInMonth = monthEnd.getDate();
  const daily = [];

  for (let i = 0; i < daysInMonth; i++) {
    const current = addDays(monthStart, i);
    const dateKey = toDateKey(current);

    const dayRecords = records.filter(
      record => record.date === dateKey
    );

    daily.push({
      date: dateKey,
      day: current.getDate(),
      minutes: sumMinutes(dayRecords),
      recordCount: dayRecords.length
    });
  }

  return {
    year: monthStart.getFullYear(),
    month: monthStart.getMonth() + 1,
    startDate: toDateKey(monthStart),
    endDate: toDateKey(monthEnd),
    totalMinutes,
    formattedTime: formatStudyMinutes(totalMinutes),
    dailyAverage: daysInMonth > 0
      ? Math.round(totalMinutes / daysInMonth)
      : 0,
    studyDays: daily.filter(day => day.minutes > 0).length,
    daily
  };
}

/* =========================================================
   科目別統計
   ========================================================= */

export function getSubjectStatistics(startDate, endDate) {
  const subjects = getAllSubjects();
  const records = startDate && endDate
    ? getRecordsInRange(new Date(startDate), new Date(endDate))
    : getAllStudyRecords();

  const totalMinutes = sumMinutes(records);

  return subjects.map(subject => {
    const subjectRecords = records.filter(
      record => record.subjectId === subject.id
    );

    const minutes = sumMinutes(subjectRecords);

    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      minutes,
      formattedTime: formatStudyMinutes(minutes),
      percentage: totalMinutes > 0
        ? roundPercent(minutes / totalMinutes * 100)
        : 0,
      recordCount: subjectRecords.length
    };
  }).sort((a, b) => b.minutes - a.minutes);
}

/* =========================================================
   学習項目別統計
   ========================================================= */

export function getStudyItemStatistics(startDate, endDate) {
  const items = getAllStudyItems();
  const subjects = getAllSubjects();

  const records = startDate && endDate
    ? getRecordsInRange(new Date(startDate), new Date(endDate))
    : getAllStudyRecords();

  const totalMinutes = sumMinutes(records);

  return items.map(item => {
    const itemRecords = records.filter(
      record => record.itemId === item.id
    );

    const minutes = sumMinutes(itemRecords);

    const subject = subjects.find(
      entry => entry.id === item.subjectId
    );

    return {
      id: item.id,
      name: item.name,
      subjectId: item.subjectId,
      subjectName: subject?.name ?? "未分類",
      color: subject?.color ?? "#91aaff",
      minutes,
      formattedTime: formatStudyMinutes(minutes),
      percentage: totalMinutes > 0
        ? roundPercent(minutes / totalMinutes * 100)
        : 0,
      recordCount: itemRecords.length
    };
  }).sort((a, b) => b.minutes - a.minutes);
}

/* =========================================================
   期間別の学習時間推移
   ========================================================= */

export function getStudyTrend(options = {}) {
  const {
    period = "day",
    count = 7,
    date = new Date()
  } = options;

  const amount = Math.max(1, Math.min(366, Number(count) || 7));
  const base = startOfDay(new Date(date));
  const result = [];

  for (let i = amount - 1; i >= 0; i--) {
    let current;

    if (period === "week") {
      current = addDays(startOfWeek(base), -7 * i);
    } else if (period === "month") {
      current = addMonths(startOfMonth(base), -i);
    } else {
      current = addDays(base, -i);
    }

    let start;
    let end;

    if (period === "week") {
      start = current;
      end = addDays(current, 6);
    } else if (period === "month") {
      start = startOfMonth(current);
      end = addDays(addMonths(start, 1), -1);
    } else {
      start = current;
      end = current;
    }

    const records = getRecordsInRange(start, end);
    const minutes = sumMinutes(records);

    result.push({
      startDate: toDateKey(start),
      endDate: toDateKey(end),
      label: period === "month"
        ? `${current.getMonth() + 1}月`
        : period === "week"
          ? `${current.getMonth() + 1}/${current.getDate()}週`
          : `${current.getMonth() + 1}/${current.getDate()}`,
      minutes,
      formattedTime: formatStudyMinutes(minutes)
    });
  }

  return result;
}

/* =========================================================
   グラフ用データ
   ========================================================= */

/*
  mode:
  "subject" = 科目別
  "item"    = 学習項目別
*/

export function getDistributionData(
  mode = "subject",
  startDate = null,
  endDate = null
) {
  if (mode === "item") {
    return getStudyItemStatistics(startDate, endDate)
      .filter(item => item.minutes > 0)
      .map(item => ({
        id: item.id,
        label: item.name,
        value: item.minutes,
        color: item.color,
        percentage: item.percentage
      }));
  }

  return getSubjectStatistics(startDate, endDate)
    .filter(subject => subject.minutes > 0)
    .map(subject => ({
      id: subject.id,
      label: subject.name,
      value: subject.minutes,
      color: subject.color,
      percentage: subject.percentage
    }));
}

/* =========================================================
   全体統計
   ========================================================= */

export function getOverallStatistics() {
  const records = getAllStudyRecords();

  const totalMinutes = sumMinutes(records);

  const validDates = records
    .map(record => parseDate(record.date))
    .filter(Boolean)
    .map(toDateKey);

  const studyDays = new Set(validDates).size;

  const today = getDailyStatistics();
  const week = getWeeklyStatistics();
  const month = getMonthlyStatistics();

  return {
    totalMinutes,
    formattedTime: formatStudyMinutes(totalMinutes),
    recordCount: records.length,
    studyDays,
    daily: today,
    weekly: week,
    monthly: month
  };
}

/* =========================================================
   統計画面用まとめデータ
   ========================================================= */

export function getStatisticsDashboard(date = new Date()) {
  return {
    overall: getOverallStatistics(),
    daily: getDailyStatistics(date),
    weekly: getWeeklyStatistics(date),
    monthly: getMonthlyStatistics(date),
    subjects: getSubjectStatistics(),
    items: getStudyItemStatistics(),
    trend: getStudyTrend({
      period: "day",
      count: 7,
      date
    }),
    distribution: getDistributionData("subject")
  };
}

/* =========================================================
   CSV出力用データ
   ========================================================= */

export function getStatisticsCSVRows() {
  const subjects = getAllSubjects();
  const items = getAllStudyItems();

  return getAllStudyRecords().map(record => {
    const subject = subjects.find(
      item => item.id === record.subjectId
    );

    const studyItem = items.find(
      item => item.id === record.itemId
    );

    return {
      date: record.date,
      subject: subject?.name ?? "未分類",
      item: studyItem?.name ?? "",
      minutes: getMinutes(record),
      note: record.note ?? ""
    };
  });
}

/* =========================================================
   デフォルトエクスポート
   ========================================================= */

export default {
  getDailyStatistics,
  getWeeklyStatistics,
  getMonthlyStatistics,

  getSubjectStatistics,
  getStudyItemStatistics,

  getStudyTrend,
  getDistributionData,

  getOverallStatistics,
  getStatisticsDashboard,

  getStatisticsCSVRows
};
