
/* =========================================================
   ALGOL — Study Constellation
   js/economy.js

   ECONOMY SYSTEM

   確定設定
   ・初期所持金：0 CR
   ・日利：3%

   基本機能
   ・所持金管理
   ・CRの獲得と支払い
   ・取引履歴
   ・借入データの管理領域
   ・利息の計算

   注意
   ・未確定の借金上限や延滞ペナルティは実装しない
   ・利息の自動発生や複利処理はまだ行わない
   ・既存データを自動削除・初期化しない
   ========================================================= */

"use strict";

import { loadData, saveData } from "./store.js";

/* =========================================================
   設定
   ========================================================= */

export const ECONOMY_CONFIG = Object.freeze({
  INITIAL_BALANCE: 0,
  DAILY_INTEREST_RATE: 0.03,
  CURRENCY: "CR"
});

/* =========================================================
   共通関数
   ========================================================= */

function createId(prefix = "transaction") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function toAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("金額は0より大きい数値にしてください。");
  }

  return Math.round(amount * 100) / 100;
}

/* =========================================================
   データ取得・保存
   ========================================================= */

function createDefaultEconomy() {
  return {
    balance: ECONOMY_CONFIG.INITIAL_BALANCE,
    transactions: [],
    loans: [],
    updatedAt: now()
  };
}

function getEconomyData() {
  const saved = loadData("economy", null);

  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return createDefaultEconomy();
  }

  return {
    ...createDefaultEconomy(),
    ...saved,

    balance: Number.isFinite(Number(saved.balance))
      ? Number(saved.balance)
      : ECONOMY_CONFIG.INITIAL_BALANCE,

    transactions: Array.isArray(saved.transactions)
      ? saved.transactions
      : [],

    loans: Array.isArray(saved.loans)
      ? saved.loans
      : []
  };
}

function saveEconomyData(data) {
  data.updatedAt = now();
  saveData("economy", data);
  return data;
}

/* =========================================================
   所持金
   ========================================================= */

export function getBalance() {
  return getEconomyData().balance;
}

export function getEconomyStatus() {
  const data = getEconomyData();

  return {
    balance: data.balance,
    currency: ECONOMY_CONFIG.CURRENCY,
    dailyInterestRate: ECONOMY_CONFIG.DAILY_INTEREST_RATE,
    transactionCount: data.transactions.length,
    loanCount: data.loans.length,
    updatedAt: data.updatedAt
  };
}

/* =========================================================
   取引履歴
   ========================================================= */

export function getTransactions(options = {}) {
  const data = getEconomyData();

  let transactions = [...data.transactions];

  if (options.type) {
    transactions = transactions.filter(
      item => item.type === options.type
    );
  }

  if (options.limit !== undefined) {
    const limit = Math.max(0, Number(options.limit) || 0);
    transactions = transactions.slice(0, limit);
  }

  return transactions.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

export function getTransaction(transactionId) {
  return getEconomyData().transactions.find(
    item => item.id === transactionId
  ) ?? null;
}

function createTransaction(data) {
  return {
    id: createId(),
    type: data.type,
    amount: data.amount,
    balanceAfter: data.balanceAfter,
    description: data.description || "",
    relatedId: data.relatedId || null,
    createdAt: now()
  };
}

/* =========================================================
   CRの獲得
   ========================================================= */

export function earnCR(amount, description = "CR獲得", options = {}) {
  const value = toAmount(amount);
  const data = getEconomyData();

  data.balance = Math.round(
    (data.balance + value) * 100
  ) / 100;

  const transaction = createTransaction({
    type: "income",
    amount: value,
    balanceAfter: data.balance,
    description,
    relatedId: options.relatedId
  });

  data.transactions.push(transaction);
  saveEconomyData(data);

  return {
    success: true,
    amount: value,
    balance: data.balance,
    transaction
  };
}

/* =========================================================
   CRの支払い
   ========================================================= */

export function spendCR(amount, description = "CR支払い", options = {}) {
  const value = toAmount(amount);
  const data = getEconomyData();

  if (data.balance < value) {
    return {
      success: false,
      reason: "insufficient_funds",
      required: value,
      balance: data.balance,
      shortfall: Math.round(
        (value - data.balance) * 100
      ) / 100
    };
  }

  data.balance = Math.round(
    (data.balance - value) * 100
  ) / 100;

  const transaction = createTransaction({
    type: "expense",
    amount: value,
    balanceAfter: data.balance,
    description,
    relatedId: options.relatedId
  });

  data.transactions.push(transaction);
  saveEconomyData(data);

  return {
    success: true,
    amount: value,
    balance: data.balance,
    transaction
  };
}

/* =========================================================
   残高の変更
   ========================================================= */

/*
  管理用の残高変更関数。

  通常のゲーム内処理では earnCR / spendCR を使用する。
  この関数は管理画面などからの調整用。
*/

export function setBalance(amount, description = "残高調整") {
  const value = Number(amount);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("残高は0以上の数値にしてください。");
  }

  const data = getEconomyData();
  const nextBalance = Math.round(value * 100) / 100;
  const difference = Math.round(
    (nextBalance - data.balance) * 100
  ) / 100;

  data.balance = nextBalance;

  if (difference !== 0) {
    data.transactions.push(createTransaction({
      type: "adjustment",
      amount: difference,
      balanceAfter: data.balance,
      description
    }));
  }

  saveEconomyData(data);

  return {
    balance: data.balance,
    difference
  };
}

/* =========================================================
   利息計算
   ========================================================= */

/*
  日利3%で1日分の利息を計算する。

  この関数は計算結果を返すだけで、
  所持金や借入データを変更しない。

  利息の発生タイミング・複利方式・端数処理の
  最終ルールが決まった後に自動処理へ接続する。
*/

export function calculateDailyInterest(principal) {
  const value = Number(principal);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("元本は0以上の数値にしてください。");
  }

  const interest =
    value * ECONOMY_CONFIG.DAILY_INTEREST_RATE;

  return {
    principal: value,
    rate: ECONOMY_CONFIG.DAILY_INTEREST_RATE,
    interest: Math.round(interest * 100) / 100,
    total: Math.round(
      (value + interest) * 100
    ) / 100
  };
}

/* =========================================================
   借入データ
   ========================================================= */

/*
  借入・返済の具体的なルールは未確定。

  そのため、この段階では既存の借入データを
  読み取る機能だけを用意する。
*/

export function getLoans() {
  return getEconomyData().loans;
}

export function getLoan(loanId) {
  return getLoans().find(
    loan => loan.id === loanId
  ) ?? null;
}

/* =========================================================
   取引履歴の集計
   ========================================================= */

export function getTransactionSummary() {
  const transactions = getEconomyData().transactions;

  const income = transactions
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const expense = transactions
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const adjustment = transactions
    .filter(item => item.type === "adjustment")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    adjustment: Math.round(adjustment * 100) / 100,
    transactionCount: transactions.length
  };
}

/* =========================================================
   初期化
   ========================================================= */

/*
  保存データが存在しない場合だけ初期データを作る。

  既存データがある場合は上書きしない。
*/

export function initializeEconomy() {
  const existing = loadData("economy", null);

  if (
    !existing ||
    typeof existing !== "object" ||
    Array.isArray(existing)
  ) {
    saveData("economy", createDefaultEconomy());
  }

  return getEconomyStatus();
}

/* =========================================================
   デフォルトエクスポート
   ========================================================= */

export default {
  ECONOMY_CONFIG,

  initializeEconomy,

  getBalance,
  getEconomyStatus,

  getTransactions,
  getTransaction,
  getTransactionSummary,

  earnCR,
  spendCR,
  setBalance,

  calculateDailyInterest,

  getLoans,
  getLoan
};
