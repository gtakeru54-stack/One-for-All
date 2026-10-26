
/* =========================================================
   ONE FOR ALL COSMOS
   js/charts.js

   グラフ用データ管理
   ・科目別の学習時間
   ・日別の学習時間
   ・週別の学習時間
   ・月別の学習時間
   ・目標達成率
   ・予定と実績の比較
   ・グラフ表示用カラー
   ・Canvas描画関数

   注意：
   このファイルはグラフのデータ集計と描画を担当する。
   ========================================================= */

"use strict";

import {
  loadStudyData,
  getDailyStudySeconds,
  getTotalStudySeconds,
} from "./study.js";

import {
  getDailyGoalMinutes,
  getWeeklyGoalMinutes,
} from "./settings.js";

/* ---------------------------------------------------------
   基本設定
   --------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

const CHART_COLORS = [
  "#8B7CFF",
  "#4CC9F0",
  "#65D6A6",
  "#FFD166",
  "#FF8C9A",
  "#B58CFF",
  "#FFAD66",
  "#6DDAE8",
  "#F08ACB",
  "#A6D96A",
  "#8CA8FF",
  "#E5C07B",
];

const OTHER_COLOR = "#64748B";

/* ---------------------------------------------------------
   日付処理
   --------------------------------------------------------- */

function toDateKey(date = new Date()) {
  const d = date instanceof Date
    ? date
    : new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(key || "")
  );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function shiftDate(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getRecords() {
  const data = loadStudyData();

  return Array.isArray(data.records)
    ? data.records
    : [];
}

function getRecordDate(record) {
  return String(
    record.date ||
    record.dateKey ||
    record.day ||
    ""
  ).slice(0, 10);
}

function getRecordSeconds(record) {
  const seconds = Number(
    record.durationSeconds ??
    record.seconds ??
    record.duration ??
    0
  );

  return Number.isFinite(seconds)
    ? Math.max(0, seconds)
    : 0;
}

function getRecordSubjectId(record) {
  return String(
    record.subjectId ||
    record.subject ||
    "unassigned"
  );
}

function getSubjectName(subjects, subjectId) {
  const subject = subjects.find((item) => {
    return String(item.id) === String(subjectId);
  });

  if (subject) {
    return subject.name || "名称未設定";
  }

  return subjectId === "unassigned"
    ? "科目未設定"
    : "その他";
}

function getSubjectColor(subject, index) {
  if (subject && typeof subject.color === "string") {
    const color = subject.color.trim();

    if (
      /^#[0-9a-fA-F]{3}$/.test(color) ||
      /^#[0-9a-fA-F]{6}$/.test(color)
    ) {
      return color;
    }
  }

  return CHART_COLORS[index % CHART_COLORS.length];
}

/* ---------------------------------------------------------
   表示形式
   --------------------------------------------------------- */

/**
 * 秒を「○時間○分」に変換する
 */
export function formatChartDuration(seconds) {
  const safeSeconds = Math.max(
    0,
    Math.floor(Number(seconds) || 0)
  );

  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}分`;
  }

  if (minutes === 0) {
    return `${hours}時間`;
  }

  return `${hours}時間${minutes}分`;
}

/**
 * 秒を小数の時間に変換する
 */
export function secondsToHours(seconds) {
  return Math.round(
    (Math.max(0, Number(seconds) || 0) / 3600) * 100
  ) / 100;
}

/**
 * グラフの割合を計算する
 */
export function getPercentage(value, total) {
  const safeValue = Math.max(0, Number(value) || 0);
  const safeTotal = Math.max(0, Number(total) || 0);

  if (safeTotal === 0) {
    return 0;
  }

  return Math.round((safeValue / safeTotal) * 1000) / 10;
}

/* ---------------------------------------------------------
   科目別データ
   --------------------------------------------------------- */

/**
 * 科目別の学習時間を集計する
 *
 * period:
 *   all  = 全期間
 *   today = 今日
 *   week = 今週（月曜開始）
 *   month = 今月
 */
export function getSubjectChartData(
  period = "all",
  referenceDate = new Date()
) {
  const data = loadStudyData();

  const records = Array.isArray(data.records)
    ? data.records
    : [];

  const subjects = Array.isArray(data.subjects)
    ? data.subjects
    : [];

  const referenceKey = toDateKey(referenceDate);
  const reference = parseDateKey(referenceKey);

  if (!reference) {
    return [];
  }

  const monday = new Date(reference);
  const dayOfWeek = (monday.getDay() + 6) % 7;

  monday.setDate(monday.getDate() - dayOfWeek);

  const monthStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    1
  );

  const totals = new Map();

  for (const subject of subjects) {
    totals.set(String(subject.id), {
      subjectId: String(subject.id),
      name: subject.name || "名称未設定",
      seconds: 0,
      color: getSubjectColor(
        subject,
        subjects.indexOf(subject)
      ),
    });
  }

  for (const record of records) {
    const dateKey = getRecordDate(record);
    const recordDate = parseDateKey(dateKey);

    if (!recordDate) {
      continue;
    }

    if (period === "today" && dateKey !== referenceKey) {
      continue;
    }

    if (period === "week") {
      const nextMonday = shiftDate(monday, 7);

      if (recordDate < monday || recordDate >= nextMonday) {
        continue;
      }
    }

    if (period === "month") {
      const nextMonth = new Date(
        reference.getFullYear(),
        reference.getMonth() + 1,
        1
      );

      if (
        recordDate < monthStart ||
        recordDate >= nextMonth
      ) {
        continue;
      }
    }

    const subjectId = getRecordSubjectId(record);
    const seconds = getRecordSeconds(record);

    if (!totals.has(subjectId)) {
      totals.set(subjectId, {
        subjectId,
        name: getSubjectName(subjects, subjectId),
        seconds: 0,
        color: OTHER_COLOR,
      });
    }

    totals.get(subjectId).seconds += seconds;
  }

  const result = Array.from(totals.values())
    .filter((item) => item.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);

  const totalSeconds = result.reduce(
    (sum, item) => sum + item.seconds,
    0
  );

  return result.map((item) => ({
    ...item,
    hours: secondsToHours(item.seconds),
    percentage: getPercentage(
      item.seconds,
      totalSeconds
    ),
    formattedTime: formatChartDuration(item.seconds),
  }));
}

/* ---------------------------------------------------------
   日別データ
   --------------------------------------------------------- */

/**
 * 指定日数分の日別学習時間を取得する
 *
 * days = 7 なら直近7日分
 */
export function getDailyChartData(
  days = 7,
  referenceDate = new Date()
) {
  const count = Math.max(
    1,
    Math.min(366, Math.floor(Number(days) || 7))
  );

  const reference = parseDateKey(
    toDateKey(referenceDate)
  );

  if (!reference) {
    return [];
  }

  const records = getRecords();
  const totals = new Map();

  for (const record of records) {
    const key = getRecordDate(record);

    if (!parseDateKey(key)) {
      continue;
    }

    totals.set(
      key,
      (totals.get(key) || 0) + getRecordSeconds(record)
    );
  }

  const result = [];

  for (let i = count - 1; i >= 0; i--) {
    const date = shiftDate(reference, -i);
    const key = toDateKey(date);
    const seconds = totals.get(key) || 0;

    result.push({
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      weekday: ["日", "月", "火", "水", "木", "金", "土"][
        date.getDay()
      ],
      seconds,
      hours: secondsToHours(seconds),
      formattedTime: formatChartDuration(seconds),
    });
  }

  return result;
}

/* ---------------------------------------------------------
   週別データ
   --------------------------------------------------------- */

/**
 * 週ごとの学習時間を取得する
 *
 * weeks = 4 なら今週と過去3週
 */
export function getWeeklyChartData(
  weeks = 8,
  referenceDate = new Date()
) {
  const count = Math.max(
    1,
    Math.min(104, Math.floor(Number(weeks) || 8))
  );

  const reference = parseDateKey(
    toDateKey(referenceDate)
  );

  if (!reference) {
    return [];
  }

  const currentMonday = new Date(reference);

  currentMonday.setDate(
    currentMonday.getDate() -
    ((currentMonday.getDay() + 6) % 7)
  );

  const records = getRecords();
  const totals = new Map();

  for (const record of records) {
    const key = getRecordDate(record);

    if (!parseDateKey(key)) {
      continue;
    }

    totals.set(
      key,
      (totals.get(key) || 0) + getRecordSeconds(record)
    );
  }

  const result = [];

  for (let i = count - 1; i >= 0; i--) {
    const start = shiftDate(currentMonday, -7 * i);
    const end = shiftDate(start, 7);

    let seconds = 0;

    for (const [key, value] of totals.entries()) {
      const date = parseDateKey(key);

      if (date && date >= start && date < end) {
        seconds += value;
      }
    }

    result.push({
      startDate: toDateKey(start),
      endDate: toDateKey(shiftDate(end, -1)),
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      seconds,
      hours: secondsToHours(seconds),
      formattedTime: formatChartDuration(seconds),
    });
  }

  return result;
}

/* ---------------------------------------------------------
   月別データ
   --------------------------------------------------------- */

/**
 * 月ごとの学習時間を取得する
 */
export function getMonthlyChartData(
  months = 6,
  referenceDate = new Date()
) {
  const count = Math.max(
    1,
    Math.min(120, Math.floor(Number(months) || 6))
  );

  const reference = parseDateKey(
    toDateKey(referenceDate)
  );

  if (!reference) {
    return [];
  }

  const records = getRecords();
  const totals = new Map();

  for (const record of records) {
    const key = getRecordDate(record);

    if (!parseDateKey(key)) {
      continue;
    }

    const monthKey = key.slice(0, 7);

    totals.set(
      monthKey,
      (totals.get(monthKey) || 0) +
        getRecordSeconds(record)
    );
  }

  const result = [];

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(
      reference.getFullYear(),
      reference.getMonth() - i,
      1
    );

    const monthKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
    ].join("-");

    const seconds = totals.get(monthKey) || 0;

    result.push({
      month: monthKey,
      label: `${date.getFullYear()}/${date.getMonth() + 1}`,
      seconds,
      hours: secondsToHours(seconds),
      formattedTime: formatChartDuration(seconds),
    });
  }

  return result;
}

/* ---------------------------------------------------------
   学習目標の達成率
   --------------------------------------------------------- */

/**
 * 今日の学習目標に対する達成率
 */
export function getDailyGoalChartData(
  referenceDate = new Date()
) {
  const dateKey = toDateKey(referenceDate);

  const seconds = getDailyStudySeconds(dateKey) || 0;
  const studiedMinutes = seconds / 60;

  const goalMinutes = Math.max(
    0,
    Number(getDailyGoalMinutes()) || 0
  );

  const percentage = goalMinutes > 0
    ? Math.min(
        100,
        Math.round((studiedMinutes / goalMinutes) * 100)
      )
    : 0;

  return {
    date: dateKey,
    studiedSeconds: seconds,
    studiedMinutes: Math.floor(studiedMinutes),
    goalMinutes,
    remainingMinutes: Math.max(
      0,
      Math.ceil(goalMinutes - studiedMinutes)
    ),
    percentage,
    completed: goalMinutes > 0 &&
      studiedMinutes >= goalMinutes,
  };
}

/**
 * 今週の学習目標に対する達成率
 */
export function getWeeklyGoalChartData(
  referenceDate = new Date()
) {
  const dailyData = getDailyChartData(7, referenceDate);

  const seconds = dailyData.reduce(
    (sum, day) => sum + day.seconds,
    0
  );

  const studiedMinutes = seconds / 60;

  const goalMinutes = Math.max(
    0,
    Number(getWeeklyGoalMinutes()) || 0
  );

  const percentage = goalMinutes > 0
    ? Math.min(
        100,
        Math.round((studiedMinutes / goalMinutes) * 100)
      )
    : 0;

  return {
    studiedSeconds: seconds,
    studiedMinutes: Math.floor(studiedMinutes),
    goalMinutes,
    remainingMinutes: Math.max(
      0,
      Math.ceil(goalMinutes - studiedMinutes)
    ),
    percentage,
    completed: goalMinutes > 0 &&
      studiedMinutes >= goalMinutes,
  };
}

/* ---------------------------------------------------------
   科目カラー
   --------------------------------------------------------- */

/**
 * 科目一覧とグラフカラーの対応を取得する
 */
export function getChartColorList() {
  return [...CHART_COLORS];
}

/**
 * 円グラフなどで使用するカラー付きデータ
 */
export function getSubjectPieChartData(
  period = "all",
  referenceDate = new Date()
) {
  return getSubjectChartData(
    period,
    referenceDate
  ).map((item, index) => ({
    ...item,
    color: item.color || CHART_COLORS[
      index % CHART_COLORS.length
    ],
  }));
}

/* ---------------------------------------------------------
   グラフ全体の概要
   --------------------------------------------------------- */

/**
 * 統計画面で使うデータをまとめて取得する
 */
export function getChartsDashboardData(
  referenceDate = new Date()
) {
  return {
    today: getDailyGoalChartData(referenceDate),
    week: getWeeklyGoalChartData(referenceDate),

    subjectsToday: getSubjectChartData(
      "today",
      referenceDate
    ),

    subjectsWeek: getSubjectChartData(
      "week",
      referenceDate
    ),

    subjectsMonth: getSubjectChartData(
      "month",
      referenceDate
    ),

    subjectsAll: getSubjectChartData(
      "all",
      referenceDate
    ),

    daily7: getDailyChartData(
      7,
      referenceDate
    ),

    daily30: getDailyChartData(
      30,
      referenceDate
    ),

    weekly8: getWeeklyChartData(
      8,
      referenceDate
    ),

    monthly6: getMonthlyChartData(
      6,
      referenceDate
    ),

    totalStudySeconds: getTotalStudySeconds(),
  };
}

/* ---------------------------------------------------------
   Canvas 円グラフ描画
   --------------------------------------------------------- */

/**
 * Canvasに円グラフを描画する
 *
 * canvas：canvas要素
 * data：getSubjectPieChartData()の戻り値
 *
 * 戻り値：
 * true = 描画成功
 * false = 描画できなかった
 */
export function drawDoughnutChart(
  canvas,
  data,
  options = {}
) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return false;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return false;
  }

  const width = Math.max(
    1,
    canvas.clientWidth || canvas.width || 240
  );

  const height = Math.max(
    1,
    canvas.clientHeight || canvas.height || 240
  );

  const pixelRatio = Math.max(
    1,
    Math.min(3, Number(options.pixelRatio) || 1)
  );

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  context.setTransform(
    pixelRatio,
    0,
    0,
    pixelRatio,
    0,
    0
  );

  context.clearRect(0, 0, width, height);

  const validData = Array.isArray(data)
    ? data.filter((item) => {
        return Number(item.seconds) > 0;
      })
    : [];

  const total = validData.reduce(
    (sum, item) => sum + Number(item.seconds),
    0
  );

  const centerX = width / 2;
  const centerY = height / 2;

  const radius = Math.max(
    10,
    Math.min(width, height) * 0.43
  );

  const innerRadius = radius * 0.64;

  if (total <= 0) {
    context.beginPath();
    context.arc(
      centerX,
      centerY,
      radius,
      0,
      Math.PI * 2
    );

    context.strokeStyle = "#26324A";
    context.lineWidth = radius - innerRadius;
    context.stroke();

    context.fillStyle = "#94A3B8";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "12px sans-serif";
    context.fillText(
      "データなし",
      centerX,
      centerY
    );

    return true;
  }

  let startAngle = -Math.PI / 2;

  validData.forEach((item, index) => {
    const value = Math.max(
      0,
      Number(item.seconds) || 0
    );

    const angle = (value / total) * Math.PI * 2;

    context.beginPath();

    context.arc(
      centerX,
      centerY,
      radius,
      startAngle,
      startAngle + angle
    );

    context.strokeStyle = item.color ||
      CHART_COLORS[index % CHART_COLORS.length];

    context.lineWidth = radius - innerRadius;
    context.lineCap = "butt";
    context.stroke();

    startAngle += angle;
  });

  const centerText = options.centerText === undefined
    ? formatChartDuration(total)
    : String(options.centerText);

  context.fillStyle = options.textColor || "#FFFFFF";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = options.font || "bold 14px sans-serif";
  context.fillText(
    centerText,
    centerX,
    centerY
  );

  return true;
}

/* ---------------------------------------------------------
   Canvas 棒グラフ描画
   --------------------------------------------------------- */

/**
 * Canvasに棒グラフを描画する
 *
 * dataの各要素は以下の形式：
 * {
 *   label: "10/27",
 *   seconds: 3600
 * }
 */
export function drawBarChart(
  canvas,
  data,
  options = {}
) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return false;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return false;
  }

  const width = Math.max(
    1,
    canvas.clientWidth || canvas.width || 320
  );

  const height = Math.max(
    1,
    canvas.clientHeight || canvas.height || 200
  );

  const pixelRatio = Math.max(
    1,
    Math.min(3, Number(options.pixelRatio) || 1)
  );

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  context.setTransform(
    pixelRatio,
    0,
    0,
    pixelRatio,
    0,
    0
  );

  context.clearRect(0, 0, width, height);

  const values = Array.isArray(data)
    ? data.map((item) => ({
        label: String(item.label || ""),
        seconds: Math.max(
          0,
          Number(item.seconds) || 0
        ),
      }))
    : [];

  if (values.length === 0) {
    context.fillStyle = "#94A3B8";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "12px sans-serif";
    context.fillText(
      "データなし",
      width / 2,
      height / 2
    );

    return true;
  }

  const paddingLeft = 12;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 30;

  const chartWidth = Math.max(
    1,
    width - paddingLeft - paddingRight
  );

  const chartHeight = Math.max(
    1,
    height - paddingTop - paddingBottom
  );

  const maxValue = Math.max(
    1,
    ...values.map((item) => item.seconds)
  );

  const slotWidth = chartWidth / values.length;
  const barWidth = Math.max(
    2,
    slotWidth * 0.58
  );

  context.strokeStyle = "#26324A";
  context.lineWidth = 1;

  context.beginPath();
  context.moveTo(
    paddingLeft,
    paddingTop + chartHeight
  );

  context.lineTo(
    width - paddingRight,
    paddingTop + chartHeight
  );

  context.stroke();

  values.forEach((item, index) => {
    const barHeight =
      (item.seconds / maxValue) * chartHeight;

    const x =
      paddingLeft +
      index * slotWidth +
      (slotWidth - barWidth) / 2;

    const y =
      paddingTop +
      chartHeight -
      barHeight;

    context.fillStyle = options.color ||
      CHART_COLORS[index % CHART_COLORS.length];

    context.beginPath();

    const radius = Math.min(
      5,
      barWidth / 2,
      barHeight / 2
    );

    context.roundRect(
      x,
      y,
      barWidth,
      Math.max(1, barHeight),
      radius
    );

    context.fill();

    context.fillStyle = options.labelColor || "#94A3B8";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.font = "10px sans-serif";

    context.fillText(
      item.label,
      x + barWidth / 2,
      paddingTop + chartHeight + 8
    );
  });

  return true;
}
