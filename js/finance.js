
/* =========================================================
   ONE FOR ALL COSMOS
   js/finance.js

   経済システム
   ・口座残高
   ・入金、出金
   ・借入、返済
   ・日利の計算
   ・返済期限
   ・延滞状態
   ・取引履歴
   ・データ保存

   注意：
   このファイルは経済データを管理する基礎モジュールです。
   実際の画面への接続は別途必要です。
   ========================================================= */

"use strict";

import {
  loadObject,
  saveData,
  createId,
} from "./storage.js";

const FINANCE_STORAGE_KEY = "oneforall-finance-v1";

/*
 * 初期設定
 *
 * 日利5%：
 * 利息 = 借入残高 × 0.05
 *
 * 例：
 * 借入残高 1,000
 * 1日分の利息 50
 *
 * ※日利は毎日複利で増える設定です。
 * ※期限超過後の猶予期間や延滞時の追加利率は、
 *   現段階では自動加算しません。
 */

export const FINANCE_CONFIG = Object.freeze({
  dailyInterestRate: 0.05,
  currencyName: "COSMO",
  currencySymbol: "C",
  defaultGraceDays: 3,
  minimumTransactionAmount: 1,
  maximumBalance: 999999999999,
});

/* ---------------------------------------------------------
   初期データ
   --------------------------------------------------------- */

function createInitialFinanceData() {
  return {
    version: 1,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    totalBorrowed: 0,
    totalRepaid: 0,
    loans: [],
    transactions: [],
    lastInterestDate: getTodayKey(),
    settings: {
      dailyInterestRate: FINANCE_CONFIG.dailyInterestRate,
      graceDays: FINANCE_CONFIG.defaultGraceDays,
    },
  };
}

/* ---------------------------------------------------------
   日付処理
   --------------------------------------------------------- */

function getTodayKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  if (typeof value !== "string") {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }

  return value;
}

function dateToDayNumber(value) {
  const normalized = normalizeDate(value);

  if (!normalized) {
    return NaN;
  }

  const [year, month, day] = normalized.split("-").map(Number);

  return Math.floor(
    Date.UTC(year, month - 1, day) / 86400000
  );
}

function getDaysBetween(startDate, endDate) {
  const start = dateToDayNumber(startDate);
  const end = dateToDayNumber(endDate);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  return Math.max(0, end - start);
}

/* ---------------------------------------------------------
   データの読み込み・保存
   --------------------------------------------------------- */

function normalizeFinanceData(data) {
  const initial = createInitialFinanceData();

  if (!data || typeof data !== "object") {
    return initial;
  }

  return {
    ...initial,
    ...data,

    balance: normalizeAmount(data.balance),
    totalEarned: normalizeAmount(data.totalEarned),
    totalSpent: normalizeAmount(data.totalSpent),
    totalBorrowed: normalizeAmount(data.totalBorrowed),
    totalRepaid: normalizeAmount(data.totalRepaid),

    loans: Array.isArray(data.loans)
      ? data.loans
      : [],

    transactions: Array.isArray(data.transactions)
      ? data.transactions
      : [],

    lastInterestDate:
      normalizeDate(data.lastInterestDate) || getTodayKey(),

    settings: {
      ...initial.settings,
      ...(data.settings || {}),
    },
  };
}

function readFinanceData() {
  const stored = loadObject(FINANCE_STORAGE_KEY);

  return normalizeFinanceData(stored);
}

function writeFinanceData(data) {
  saveData(
    FINANCE_STORAGE_KEY,
    normalizeFinanceData(data)
  );
}

/* ---------------------------------------------------------
   数値処理
   --------------------------------------------------------- */

function normalizeAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.min(
    Math.floor(amount),
    FINANCE_CONFIG.maximumBalance
  );
}

function validateAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return {
      success: false,
      error: "金額が正しくありません。",
    };
  }

  if (
    amount < FINANCE_CONFIG.minimumTransactionAmount ||
    !Number.isSafeInteger(amount)
  ) {
    return {
      success: false,
      error: "金額は1以上の整数で入力してください。",
    };
  }

  if (amount > FINANCE_CONFIG.maximumBalance) {
    return {
      success: false,
      error: "金額が上限を超えています。",
    };
  }

  return {
    success: true,
    amount,
  };
}

/* ---------------------------------------------------------
   口座情報
   --------------------------------------------------------- */

/**
 * 経済データを取得する
 */
export function getFinanceData() {
  return readFinanceData();
}

/**
 * 現在の残高を取得する
 */
export function getBalance() {
  return readFinanceData().balance;
}

/**
 * 借入残高の合計を取得する
 */
export function getTotalDebt() {
  const data = readFinanceData();

  return data.loans.reduce((total, loan) => {
    if (loan.status === "repaid") {
      return total;
    }

    return total + normalizeAmount(loan.remainingAmount);
  }, 0);
}

/**
 * 未返済の借入一覧を取得する
 */
export function getActiveLoans() {
  return readFinanceData()
    .loans
    .filter((loan) => {
      return (
        loan.status !== "repaid" &&
        normalizeAmount(loan.remainingAmount) > 0
      );
    })
    .map((loan) => ({
      ...loan,
      daysUntilDue: getDaysBetween(
        getTodayKey(),
        loan.dueDate
      ),
      overdueDays: Math.max(
        0,
        getDaysBetween(loan.dueDate, getTodayKey())
      ),
      isOverdue:
        Boolean(loan.dueDate) &&
        loan.dueDate < getTodayKey() &&
        normalizeAmount(loan.remainingAmount) > 0,
    }));
}

/* ---------------------------------------------------------
   取引履歴
   --------------------------------------------------------- */

function addTransaction(data, transaction) {
  data.transactions.unshift({
    id: createId(),
    date: getTodayKey(),
    createdAt: new Date().toISOString(),
    ...transaction,
  });

  /*
   * 履歴が無制限に増え続けないように、
   * 最新5000件を保存する
   */
  data.transactions = data.transactions.slice(0, 5000);
}

/**
 * 取引履歴を取得する
 */
export function getTransactions({
  limit = 100,
  type = null,
} = {}) {
  const safeLimit = Math.max(
    0,
    Math.min(5000, Math.floor(Number(limit) || 0))
  );

  return readFinanceData()
    .transactions
    .filter((transaction) => {
      return !type || transaction.type === type;
    })
    .slice(0, safeLimit);
}

/* ---------------------------------------------------------
   入金
   --------------------------------------------------------- */

/**
 * 入金する
 *
 * 例：
 * deposit(100, "ミッション報酬");
 */
export function deposit(amount, description = "入金") {
  const validation = validateAmount(amount);

  if (!validation.success) {
    return validation;
  }

  const data = readFinanceData();
  const nextBalance = data.balance + validation.amount;

  if (nextBalance > FINANCE_CONFIG.maximumBalance) {
    return {
      success: false,
      error: "残高の上限を超えています。",
    };
  }

  data.balance = nextBalance;
  data.totalEarned += validation.amount;

  addTransaction(data, {
    type: "deposit",
    amount: validation.amount,
    balanceAfter: data.balance,
    description: String(description),
  });

  writeFinanceData(data);

  return {
    success: true,
    balance: data.balance,
  };
}

/* ---------------------------------------------------------
   出金
   --------------------------------------------------------- */

/**
 * 出金する
 *
 * 残高不足の場合は出金しない
 */
export function withdraw(amount, description = "出金") {
  const validation = validateAmount(amount);

  if (!validation.success) {
    return validation;
  }

  const data = readFinanceData();

  if (data.balance < validation.amount) {
    return {
      success: false,
      error: "残高が不足しています。",
    };
  }

  data.balance -= validation.amount;
  data.totalSpent += validation.amount;

  addTransaction(data, {
    type: "withdraw",
    amount: validation.amount,
    balanceAfter: data.balance,
    description: String(description),
  });

  writeFinanceData(data);

  return {
    success: true,
    balance: data.balance,
  };
}

/* ---------------------------------------------------------
   借入
   --------------------------------------------------------- */

/**
 * 借入を行う
 *
 * options:
 *   dueDate：返済期限 YYYY-MM-DD
 *   description：借入理由
 *   graceDays：期限後の猶予日数
 *
 * 注意：
 * 借入金は残高に加算されます。
 * 借入元本は返済義務のある負債として別管理します。
 */
export function borrowMoney(
  amount,
  {
    dueDate,
    description = "借入",
    graceDays,
  } = {}
) {
  const validation = validateAmount(amount);

  if (!validation.success) {
    return validation;
  }

  const normalizedDueDate = normalizeDate(dueDate);

  if (!normalizedDueDate) {
    return {
      success: false,
      error: "返済期限を正しく指定してください。",
    };
  }

  if (normalizedDueDate < getTodayKey()) {
    return {
      success: false,
      error: "返済期限は今日以降にしてください。",
    };
  }

  const data = readFinanceData();
  const nextBalance = data.balance + validation.amount;

  if (nextBalance > FINANCE_CONFIG.maximumBalance) {
    return {
      success: false,
      error: "残高の上限を超えています。",
    };
  }

  const safeGraceDays =
    graceDays === undefined
      ? data.settings.graceDays
      : Math.max(0, Math.floor(Number(graceDays) || 0));

  const loan = {
    id: createId(),
    principal: validation.amount,
    remainingPrincipal: validation.amount,
    accruedInterest: 0,
    remainingAmount: validation.amount,
    dailyInterestRate: Number(
      data.settings.dailyInterestRate
    ),
    dueDate: normalizedDueDate,
    graceDays: safeGraceDays,
    borrowedDate: getTodayKey(),
    description: String(description),
    status: "active",
    lastInterestDate: getTodayKey(),
  };

  data.balance = nextBalance;
  data.totalBorrowed += validation.amount;
  data.loans.push(loan);

  addTransaction(data, {
    type: "borrow",
    amount: validation.amount,
    balanceAfter: data.balance,
    loanId: loan.id,
    description: loan.description,
  });

  writeFinanceData(data);

  return {
    success: true,
    loan,
    balance: data.balance,
  };
}

/* ---------------------------------------------------------
   利息計算
   --------------------------------------------------------- */

/**
 * 借入残高に対する1日分の利息を計算する
 *
 * 端数は切り上げる。
 * 日利5%の場合：
 * 1000 × 0.05 = 50
 */
export function calculateDailyInterest(
  principal,
  dailyRate = FINANCE_CONFIG.dailyInterestRate
) {
  const amount = normalizeAmount(principal);
  const rate = Number(dailyRate);

  if (!Number.isFinite(rate) || rate < 0) {
    return 0;
  }

  return Math.ceil(amount * rate);
}

/**
 * 指定日までに発生する利息の試算
 *
 * 実際のデータは変更しない
 */
export function estimateLoanInterest(
  loanId,
  throughDate = getTodayKey()
) {
  const loan = readFinanceData()
    .loans
    .find((item) => item.id === loanId);

  if (!loan || loan.status === "repaid") {
    return {
      success: false,
      error: "有効な借入が見つかりません。",
    };
  }

  const endDate = normalizeDate(throughDate);

  if (!endDate) {
    return {
      success: false,
      error: "試算日が正しくありません。",
    };
  }

  const startDate =
    normalizeDate(loan.lastInterestDate) ||
    normalizeDate(loan.borrowedDate);

  const days = getDaysBetween(startDate, endDate);
  let balance = normalizeAmount(loan.remainingAmount);
  let estimatedInterest = 0;

  for (let day = 0; day < days; day += 1) {
    const interest = calculateDailyInterest(
      balance,
      loan.dailyInterestRate
    );

    estimatedInterest += interest;
    balance += interest;
  }

  return {
    success: true,
    loanId,
    days,
    currentAmount: normalizeAmount(loan.remainingAmount),
    estimatedInterest,
    estimatedTotal: balance,
    throughDate: endDate,
  };
}

/**
 * 未処理の日数分の利息を確定する
 *
 * 重要：
 * 同じ日付の利息を二重に加算しない。
 *
 * この関数は呼び出された時点で利息を確定する。
 * アプリを開いていない間に自動実行されるわけではない。
 */
export function applyDailyInterest(
  referenceDate = getTodayKey()
) {
  const targetDate = normalizeDate(referenceDate);

  if (!targetDate) {
    return {
      success: false,
      error: "日付が正しくありません。",
    };
  }

  const data = readFinanceData();
  let totalInterestAdded = 0;
  let processedDays = 0;

  for (const loan of data.loans) {
    if (
      loan.status === "repaid" ||
      normalizeAmount(loan.remainingAmount) <= 0
    ) {
      continue;
    }

    let lastDate =
      normalizeDate(loan.lastInterestDate) ||
      normalizeDate(loan.borrowedDate);

    if (!lastDate || targetDate <= lastDate) {
      continue;
    }

    let days = getDaysBetween(lastDate, targetDate);

    /*
     * 未来の日付を指定して利息を先取りしない。
     */
    if (targetDate > getTodayKey()) {
      return {
        success: false,
        error: "未来の日付には利息を確定できません。",
      };
    }

    while (days > 0) {
      const interest = calculateDailyInterest(
        loan.remainingAmount,
        loan.dailyInterestRate
      );

      loan.accruedInterest =
        normalizeAmount(loan.accruedInterest) + interest;

      loan.remainingAmount =
        normalizeAmount(loan.remainingAmount) + interest;

      totalInterestAdded += interest;
      processedDays += 1;
      days -= 1;
    }

    loan.lastInterestDate = targetDate;

    if (loan.remainingAmount <= 0) {
      loan.status = "repaid";
    }
  }

  data.lastInterestDate = targetDate;

  if (totalInterestAdded > 0) {
    addTransaction(data, {
      type: "interest",
      amount: totalInterestAdded,
      balanceAfter: data.balance,
      description: "借入利息",
    });
  }

  writeFinanceData(data);

  return {
    success: true,
    totalInterestAdded,
    processedDays,
  };
}

/* ---------------------------------------------------------
   返済
   --------------------------------------------------------- */

/**
 * 借入を返済する
 *
 * 返済額は口座残高から引かれます。
 * 利息を含む残りの借入額を返済します。
 */
export function repayLoan(loanId, amount) {
  const validation = validateAmount(amount);

  if (!validation.success) {
    return validation;
  }

  const data = readFinanceData();
  const loan = data.loans.find((item) => item.id === loanId);

  if (!loan || loan.status === "repaid") {
    return {
      success: false,
      error: "返済できる借入が見つかりません。",
    };
  }

  if (data.balance < validation.amount) {
    return {
      success: false,
      error: "口座残高が不足しています。",
    };
  }

  if (validation.amount > loan.remainingAmount) {
    return {
      success: false,
      error: "残りの返済額を超えています。",
    };
  }

  const repayment = validation.amount;

  /*
   * 返済は利息から先に充当し、
   * その後に元本を減らす。
   */
  const interestPaid = Math.min(
    normalizeAmount(loan.accruedInterest),
    repayment
  );

  const principalPaid = repayment - interestPaid;

  loan.accruedInterest -= interestPaid;
  loan.remainingPrincipal = Math.max(
    0,
    normalizeAmount(loan.remainingPrincipal) - principalPaid
  );

  loan.remainingAmount -= repayment;

  if (loan.remainingAmount <= 0) {
    loan.remainingAmount = 0;
    loan.accruedInterest = 0;
    loan.remainingPrincipal = 0;
    loan.status = "repaid";
    loan.repaidDate = getTodayKey();
  }

  data.balance -= repayment;
  data.totalRepaid += repayment;

  addTransaction(data, {
    type: "repayment",
    amount: repayment,
    balanceAfter: data.balance,
    loanId: loan.id,
    description: "借入返済",
  });

  writeFinanceData(data);

  return {
    success: true,
    repayment,
    interestPaid,
    principalPaid,
    remainingAmount: loan.remainingAmount,
    balance: data.balance,
    loan,
  };
}

/* ---------------------------------------------------------
   経済情報の概要
   --------------------------------------------------------- */

/**
 * ホーム画面などで使う経済情報
 */
export function getFinanceSummary() {
  const data = readFinanceData();
  const activeLoans = getActiveLoans();

  const overdueLoans = activeLoans.filter(
    (loan) => loan.isOverdue
  );

  const nearestDueLoan = [...activeLoans]
    .filter((loan) => loan.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;

  return {
    balance: data.balance,
    totalDebt: getTotalDebt(),
    totalEarned: data.totalEarned,
    totalSpent: data.totalSpent,
    totalBorrowed: data.totalBorrowed,
    totalRepaid: data.totalRepaid,
    activeLoanCount: activeLoans.length,
    overdueLoanCount: overdueLoans.length,
    overdueLoans,
    nearestDueLoan,
    dailyInterestRate: data.settings.dailyInterestRate,
    graceDays: data.settings.graceDays,
  };
}

/* ---------------------------------------------------------
   設定変更
   --------------------------------------------------------- */

/**
 * 日利を変更する
 *
 * 例：
 * setDailyInterestRate(0.05)
 *
 * 0.05 = 日利5%
 */
export function setDailyInterestRate(rate) {
  const value = Number(rate);

  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    return {
      success: false,
      error: "日利は0以上100%以下で指定してください。",
    };
  }

  const data = readFinanceData();
  data.settings.dailyInterestRate = value;

  writeFinanceData(data);

  return {
    success: true,
    dailyInterestRate: value,
  };
}

/**
 * 返済期限後の猶予日数を変更する
 *
 * この設定は期限判定に使用します。
 * 猶予終了後の追加ペナルティはまだ実装していません。
 */
export function setGraceDays(days) {
  const value = Number(days);

  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 365
  ) {
    return {
      success: false,
      error: "猶予日数は0〜365日の整数で指定してください。",
    };
  }

  const data = readFinanceData();
  data.settings.graceDays = value;

  writeFinanceData(data);

  return {
    success: true,
    graceDays: value,
  };
}
