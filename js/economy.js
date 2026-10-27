
/* =========================================================
   ONE FOR ALL COSMOS
   js/economy.js

   ゲーム内経済システム
   ・所持金管理
   ・借入管理
   ・日利5%の複利計算
   ・返済期限管理
   ・3日間の猶予期間
   ・利息優先の返済
   ・取引履歴
   ・データ自動保存

   注意:
   延滞金・延滞時の追加利率は未設定。
   ========================================================= */

"use strict";

import { store } from "./store.js";

/* =========================================================
   基本設定
   ========================================================= */

const ECONOMY_CONFIG = Object.freeze({
  version: 1,

  // 日利5%
  dailyInterestRate: 0.05,

  // 返済期限後の猶予期間
  gracePeriodDays: 3,

  // 初期所持金
  initialBalance: 1000,

  // 金額の小数点以下の桁数
  decimalPlaces: 2
});

/* =========================================================
   内部ユーティリティ
   ========================================================= */

function createId(prefix = "economy") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

function roundMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  const factor = 10 ** ECONOMY_CONFIG.decimalPlaces;

  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

function normalizeMoney(value) {
  return Math.max(0, roundMoney(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function todayString() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isValidDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function dateToDayNumber(value) {
  if (!isValidDate(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  return Math.floor(
    Date.UTC(year, month - 1, day) / 86400000
  );
}

function addDays(dateString, days) {
  const dayNumber = dateToDayNumber(dateString);

  if (dayNumber === null) {
    return null;
  }

  const date = new Date((dayNumber + days) * 86400000);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function daysBetween(fromDate, toDate) {
  const from = dateToDayNumber(fromDate);
  const to = dateToDayNumber(toDate);

  if (from === null || to === null) {
    return 0;
  }

  return to - from;
}

/* =========================================================
   データ構造
   ========================================================= */

function createDefaultData() {
  return {
    version: ECONOMY_CONFIG.version,

    balance: ECONOMY_CONFIG.initialBalance,

    loans: [],

    transactions: [],

    lastInterestDate: todayString(),

    createdAt: Date.now(),

    updatedAt: Date.now()
  };
}

function normalizeLoan(loan) {
  const principal = normalizeMoney(loan.principal);
  const outstandingPrincipal = normalizeMoney(
    loan.outstandingPrincipal ?? principal
  );

  const accruedInterest = normalizeMoney(loan.accruedInterest);

  return {
    id: String(loan.id || createId("loan")),

    title: String(loan.title || "借入"),

    originalPrincipal: principal,

    outstandingPrincipal,

    accruedInterest,

    borrowedAt: String(loan.borrowedAt || todayString()),

    dueDate: isValidDate(loan.dueDate)
      ? loan.dueDate
      : addDays(todayString(), 7),

    status: ["active", "paid"].includes(loan.status)
      ? loan.status
      : (
          outstandingPrincipal <= 0 && accruedInterest <= 0
            ? "paid"
            : "active"
        ),

    lastInterestDate: isValidDate(loan.lastInterestDate)
      ? loan.lastInterestDate
      : String(loan.borrowedAt || todayString()),

    createdAt: Number(loan.createdAt) || Date.now(),

    updatedAt: Number(loan.updatedAt) || Date.now()
  };
}

function normalizeTransaction(transaction) {
  return {
    id: String(transaction.id || createId("transaction")),

    type: String(transaction.type || "unknown"),

    amount: roundMoney(transaction.amount),

    balanceAfter: roundMoney(transaction.balanceAfter),

    loanId: transaction.loanId || null,

    note: String(transaction.note || ""),

    date: String(transaction.date || todayString()),

    createdAt: Number(transaction.createdAt) || Date.now()
  };
}

/* =========================================================
   読み込み・保存
   ========================================================= */

function loadEconomyData() {
  let saved = null;

  try {
    saved = store.economy.load(null);
  } catch (error) {
    console.error("[Economy] 読み込みエラー:", error);
  }

  if (!saved || typeof saved !== "object") {
    return createDefaultData();
  }

  return {
    version: ECONOMY_CONFIG.version,

    balance: normalizeMoney(
      saved.balance ?? ECONOMY_CONFIG.initialBalance
    ),

    loans: Array.isArray(saved.loans)
      ? saved.loans.map(normalizeLoan)
      : [],

    transactions: Array.isArray(saved.transactions)
      ? saved.transactions.map(normalizeTransaction)
      : [],

    lastInterestDate: isValidDate(saved.lastInterestDate)
      ? saved.lastInterestDate
      : todayString(),

    createdAt: Number(saved.createdAt) || Date.now(),

    updatedAt: Number(saved.updatedAt) || Date.now()
  };
}

let data = loadEconomyData();

function saveEconomyData() {
  data.updatedAt = Date.now();

  try {
    return store.economy.save(data);
  } catch (error) {
    console.error("[Economy] 保存エラー:", error);
    return false;
  }
}

/* =========================================================
   取引履歴
   ========================================================= */

function addTransaction({
  type,
  amount,
  balanceAfter = data.balance,
  loanId = null,
  note = ""
}) {
  const transaction = {
    id: createId("transaction"),

    type,

    amount: roundMoney(amount),

    balanceAfter: roundMoney(balanceAfter),

    loanId,

    note: String(note || ""),

    date: todayString(),

    createdAt: Date.now()
  };

  data.transactions.unshift(transaction);

  // 履歴が無制限に増えないよう、最新2000件を保持
  if (data.transactions.length > 2000) {
    data.transactions = data.transactions.slice(0, 2000);
  }

  return transaction;
}

function getTransactions(options = {}) {
  const limit = Number.isFinite(Number(options.limit))
    ? Math.max(0, Math.floor(Number(options.limit)))
    : data.transactions.length;

  const type = options.type || null;

  let result = [...data.transactions];

  if (type) {
    result = result.filter(item => item.type === type);
  }

  if (options.from && isValidDate(options.from)) {
    result = result.filter(item => item.date >= options.from);
  }

  if (options.to && isValidDate(options.to)) {
    result = result.filter(item => item.date <= options.to);
  }

  return clone(result.slice(0, limit));
}

/* =========================================================
   所持金
   ========================================================= */

function getBalance() {
  return data.balance;
}

function deposit(amount, note = "入金") {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return {
      success: false,
      message: "入金額は0より大きい数値にしてください。"
    };
  }

  const amountToAdd = roundMoney(value);

  data.balance = roundMoney(data.balance + amountToAdd);

  addTransaction({
    type: "deposit",
    amount: amountToAdd,
    note
  });

  const saved = saveEconomyData();

  return {
    success: saved !== false,
    amount: amountToAdd,
    balance: data.balance,
    message: saved === false
      ? "入金しましたが、保存に失敗しました。"
      : "入金しました。"
  };
}

function withdraw(amount, note = "出金") {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return {
      success: false,
      message: "出金額は0より大きい数値にしてください。"
    };
  }

  const amountToWithdraw = roundMoney(value);

  if (amountToWithdraw > data.balance) {
    return {
      success: false,
      message: "所持金が不足しています。"
    };
  }

  data.balance = roundMoney(data.balance - amountToWithdraw);

  addTransaction({
    type: "withdraw",
    amount: amountToWithdraw,
    note
  });

  const saved = saveEconomyData();

  return {
    success: saved !== false,
    amount: amountToWithdraw,
    balance: data.balance,
    message: saved === false
      ? "出金しましたが、保存に失敗しました。"
      : "出金しました。"
  };
}

/* =========================================================
   借入情報
   ========================================================= */

function getLoans() {
  return clone(data.loans);
}

function getLoan(loanId) {
  const loan = data.loans.find(item => item.id === loanId);

  return loan ? clone(loan) : null;
}

function getActiveLoans() {
  return clone(
    data.loans.filter(loan => loan.status === "active")
  );
}

/* =========================================================
   借入
   ========================================================= */

function borrow(options = {}) {
  const amount = Number(options.amount);
  const title = String(options.title || "借入").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: "借入額は0より大きい数値にしてください。"
    };
  }

  if (!title) {
    return {
      success: false,
      message: "借入の名前を入力してください。"
    };
  }

  const principal = roundMoney(amount);

  const dueDate = options.dueDate === undefined
    ? addDays(todayString(), 7)
    : String(options.dueDate);

  if (!isValidDate(dueDate)) {
    return {
      success: false,
      message: "返済期限の日付が正しくありません。"
    };
  }

  if (dueDate < todayString()) {
    return {
      success: false,
      message: "返済期限は今日以降の日付にしてください。"
    };
  }

  const loan = normalizeLoan({
    id: createId("loan"),
    title,
    principal,
    outstandingPrincipal: principal,
    accruedInterest: 0,
    borrowedAt: todayString(),
    dueDate,
    status: "active",
    lastInterestDate: todayString(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  data.loans.push(loan);

  data.balance = roundMoney(data.balance + principal);

  addTransaction({
    type: "borrow",
    amount: principal,
    loanId: loan.id,
    note: `借入：${title}`
  });

  const saved = saveEconomyData();

  return {
    success: saved !== false,
    loan: clone(loan),
    balance: data.balance,
    message: saved !== false
      ? "借入を登録しました。"
      : "借入を登録しましたが、保存に失敗しました。"
  };
}

/* =========================================================
   利息計算
   ========================================================= */

/*
  日利5%の複利計算。

  毎日の利息は、未返済の元本に対して計算します。
  発生した利息は accruedInterest に加算します。

  利息を元本へ組み入れる方式ではなく、
  未返済元本と未払い利息を分けて管理します。
  ========================================================= */

function applyOneDayInterest(loan) {
  if (loan.status !== "active") {
    return 0;
  }

  if (loan.outstandingPrincipal <= 0) {
    return 0;
  }

  const interest = roundMoney(
    loan.outstandingPrincipal *
    ECONOMY_CONFIG.dailyInterestRate
  );

  loan.accruedInterest = roundMoney(
    loan.accruedInterest + interest
  );

  loan.lastInterestDate = addDays(loan.lastInterestDate, 1);
  loan.updatedAt = Date.now();

  return interest;
}

function accrueInterestThrough(targetDate = todayString()) {
  if (!isValidDate(targetDate)) {
    return {
      success: false,
      message: "利息計算の日付が正しくありません。"
    };
  }

  if (targetDate < data.lastInterestDate) {
    return {
      success: false,
      message: "過去の日付には利息を計算できません。"
    };
  }

  let totalInterestAdded = 0;
  let daysProcessed = 0;

  for (const loan of data.loans) {
    if (loan.status !== "active") {
      continue;
    }

    let lastDate = loan.lastInterestDate;

    if (!isValidDate(lastDate)) {
      lastDate = loan.borrowedAt;
    }

    while (lastDate < targetDate) {
      const nextDate = addDays(lastDate, 1);

      if (!nextDate) {
        break;
      }

      const interest = applyOneDayInterest(loan);

      totalInterestAdded = roundMoney(
        totalInterestAdded + interest
      );

      lastDate = nextDate;
      daysProcessed += 1;
    }
  }

  data.lastInterestDate = targetDate;

  if (totalInterestAdded > 0) {
    addTransaction({
      type: "interest",
      amount: totalInterestAdded,
      note: "日利5%の利息"
    });
  }

  const saved = saveEconomyData();

  return {
    success: saved !== false,
    totalInterestAdded,
    daysProcessed,
    message: "利息計算を完了しました。"
  };
}

function calculateNextDailyInterest(loanId) {
  const loan = data.loans.find(item => item.id === loanId);

  if (!loan || loan.status !== "active") {
    return 0;
  }

  return roundMoney(
    loan.outstandingPrincipal *
    ECONOMY_CONFIG.dailyInterestRate
  );
}

/* =========================================================
   返済期限・猶予期間
   ========================================================= */

/*
  期限当日までは期限内。
  期限の翌日から3日間を猶予期間とする。
  猶予期間終了後は overdue として判定する。

  追加の延滞金・延滞利率は設定していない。
  ========================================================= */

function getLoanStatusDetails(loanOrId) {
  const loan = typeof loanOrId === "string"
    ? data.loans.find(item => item.id === loanOrId)
    : loanOrId;

  if (!loan) {
    return null;
  }

  if (loan.status === "paid") {
    return {
      loanId: loan.id,
      status: "paid",
      statusText: "返済済み",
      daysUntilDue: null,
      graceDaysRemaining: 0
    };
  }

  const today = todayString();
  const daysUntilDue = daysBetween(today, loan.dueDate);

  let status;
  let statusText;
  let graceDaysRemaining = 0;

  if (daysUntilDue > 0) {
    status = "active";
    statusText = "返済期限前";
  } else if (daysUntilDue === 0) {
    status = "due";
    statusText = "返済期限当日";
  } else {
    const daysPastDue = Math.abs(daysUntilDue);

    if (daysPastDue <= ECONOMY_CONFIG.gracePeriodDays) {
      status = "grace";
      statusText = "猶予期間中";

      graceDaysRemaining =
        ECONOMY_CONFIG.gracePeriodDays - daysPastDue;
    } else {
      status = "overdue";
      statusText = "期限超過";
    }
  }

  return {
    loanId: loan.id,
    status,
    statusText,
    daysUntilDue,
    gracePeriodDays: ECONOMY_CONFIG.gracePeriodDays,
    graceDaysRemaining
  };
}

function getLoanDetails(loanId) {
  const loan = data.loans.find(item => item.id === loanId);

  if (!loan) {
    return null;
  }

  const status = getLoanStatusDetails(loan);

  return {
    ...clone(loan),
    totalOutstanding: roundMoney(
      loan.outstandingPrincipal + loan.accruedInterest
    ),
    nextDailyInterest: calculateNextDailyInterest(loan.id),
    statusDetails: status
  };
}

function getAllLoanDetails() {
  return data.loans.map(loan => getLoanDetails(loan.id));
}

/* =========================================================
   返済
   ========================================================= */

/*
  返済順序:
  1. 未払い利息
  2. 未返済元本

  所持金を超える金額は返済できません。
  ========================================================= */

function repay(loanId, amount) {
  const loan = data.loans.find(item => item.id === loanId);

  if (!loan || loan.status !== "active") {
    return {
      success: false,
      message: "返済できる借入が見つかりません。"
    };
  }

  const requestedAmount = Number(amount);

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return {
      success: false,
      message: "返済額は0より大きい数値にしてください。"
    };
  }

  const repaymentAmount = roundMoney(requestedAmount);

  if (repaymentAmount > data.balance) {
    return {
      success: false,
      message: "所持金が不足しています。"
    };
  }

  const totalDebt = roundMoney(
    loan.accruedInterest + loan.outstandingPrincipal
  );

  const actualPayment = Math.min(repaymentAmount, totalDebt);

  // 先に利息を支払う
  const interestPayment = Math.min(
    actualPayment,
    loan.accruedInterest
  );

  loan.accruedInterest = roundMoney(
    loan.accruedInterest - interestPayment
  );

  // 残った返済額で元本を減らす
  const principalPayment = Math.min(
    roundMoney(actualPayment - interestPayment),
    loan.outstandingPrincipal
  );

  loan.outstandingPrincipal = roundMoney(
    loan.outstandingPrincipal - principalPayment
  );

  data.balance = roundMoney(data.balance - actualPayment);

  if (
    loan.outstandingPrincipal <= 0 &&
    loan.accruedInterest <= 0
  ) {
    loan.outstandingPrincipal = 0;
    loan.accruedInterest = 0;
    loan.status = "paid";
  }

  loan.updatedAt = Date.now();

  addTransaction({
    type: "repayment",
    amount: actualPayment,
    loanId: loan.id,
    note:
      `返済：${loan.title}` +
      `（利息 ${interestPayment}、元本 ${principalPayment}）`
  });

  const saved = saveEconomyData();

  return {
    success: saved !== false,
    requestedAmount: repaymentAmount,
    actualPayment,
    interestPayment,
    principalPayment,
    remainingInterest: loan.accruedInterest,
    remainingPrincipal: loan.outstandingPrincipal,
    totalOutstanding: roundMoney(
      loan.accruedInterest + loan.outstandingPrincipal
    ),
    balance: data.balance,
    loanStatus: loan.status,
    message: saved !== false
      ? "返済しました。"
      : "返済しましたが、保存に失敗しました。"
  };
}

function repayAll(loanId) {
  const loan = data.loans.find(item => item.id === loanId);

  if (!loan || loan.status !== "active") {
    return {
      success: false,
      message: "返済できる借入が見つかりません。"
    };
  }

  const totalDebt = roundMoney(
    loan.outstandingPrincipal + loan.accruedInterest
  );

  if (totalDebt > data.balance) {
    return {
      success: false,
      message: "全額返済するには所持金が不足しています。",
      required: totalDebt,
      balance: data.balance
    };
  }

  return repay(loanId, totalDebt);
}

/* =========================================================
   経済状況の集計
   ========================================================= */

function getTotalPrincipal() {
  return roundMoney(
    data.loans
      .filter(loan => loan.status === "active")
      .reduce(
        (total, loan) => total + loan.outstandingPrincipal,
        0
      )
  );
}

function getTotalInterest() {
  return roundMoney(
    data.loans
      .filter(loan => loan.status === "active")
      .reduce(
        (total, loan) => total + loan.accruedInterest,
        0
      )
  );
}

function getTotalDebt() {
  return roundMoney(
    getTotalPrincipal() + getTotalInterest()
  );
}

function getEconomySummary() {
  const activeLoans = data.loans.filter(
    loan => loan.status === "active"
  );

  const overdueLoans = activeLoans.filter(
    loan => getLoanStatusDetails(loan).status === "overdue"
  );

  const graceLoans = activeLoans.filter(
    loan => getLoanStatusDetails(loan).status === "grace"
  );

  const dueTodayLoans = activeLoans.filter(
    loan => getLoanStatusDetails(loan).status === "due"
  );

  const principal = getTotalPrincipal();
  const interest = getTotalInterest();

  return {
    balance: data.balance,
    activeLoanCount: activeLoans.length,
    paidLoanCount: data.loans.filter(
      loan => loan.status === "paid"
    ).length,
    principal,
    interest,
    totalDebt: roundMoney(principal + interest),
    estimatedNextDailyInterest: roundMoney(
      activeLoans.reduce(
        (total, loan) =>
          total +
          loan.outstandingPrincipal *
          ECONOMY_CONFIG.dailyInterestRate,
        0
      )
    ),
    overdueCount: overdueLoans.length,
    gracePeriodCount: graceLoans.length,
    dueTodayCount: dueTodayLoans.length
  };
}

/* =========================================================
   初期化
   ========================================================= */

function initializeEconomy() {
  data = loadEconomyData();

  // 前回の利息計算日から今日までを計算する
  const result = accrueInterestThrough(todayString());

  return {
    summary: getEconomySummary(),
    interestResult: result
  };
}

/* =========================================================
   設定・データ取得
   ========================================================= */

function getConfig() {
  return {
    ...ECONOMY_CONFIG
  };
}

function getEconomyData() {
  return clone(data);
}

/*
  リセットは既存の経済データをすべて消去するため、
  UIの確認操作などから明示的に呼び出すこと。
  通常の初期化処理からは呼び出さない。
*/
function resetEconomy() {
  data = createDefaultData();

  const saved = saveEconomyData();

  return {
    success: saved !== false,
    summary: getEconomySummary(),
    message: saved !== false
      ? "経済データを初期状態に戻しました。"
      : "初期化しましたが、保存に失敗しました。"
  };
}

/* =========================================================
   公開API
   ========================================================= */

export const economy = Object.freeze({
  getConfig,

  initializeEconomy,
  getEconomyData,
  getEconomySummary,

  getBalance,
  deposit,
  withdraw,

  getLoans,
  getLoan,
  getActiveLoans,
  getLoanDetails,
  getAllLoanDetails,

  borrow,

  accrueInterestThrough,
  calculateNextDailyInterest,

  getLoanStatusDetails,

  repay,
  repayAll,

  getTotalPrincipal,
  getTotalInterest,
  getTotalDebt,

  getTransactions,

  resetEconomy,
  save: saveEconomyData
});

export default economy;
