/* =========================================================
   ONE FOR ALL — COSMOS
   js/rocket.js
   CR・借金・利息・返済・取引履歴
   ========================================================= */

"use strict";

import {
  loadData,
  saveData,
  createId,
  formatCredits,
  escapeHTML
} from "./storage.js";

const ROCKET_STORAGE_KEY = "oneforall-rocket-v1";
const DAILY_INTEREST_RATE = 0.05;
const DEBT_LIMIT = 10000;

let rocketData = {
  cr: 0,
  debt: 0,
  unpaid: 0,
  lastInterestDate: "",
  transactions: [],
  penalties: []
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeRocketData(data) {
  return {
    cr: Math.max(0, Number(data?.cr) || 0),
    debt: Math.max(0, Number(data?.debt) || 0),
    unpaid: Math.max(0, Number(data?.unpaid) || 0),
    lastInterestDate: data?.lastInterestDate || "",
    transactions: Array.isArray(data?.transactions) ? data.transactions : [],
    penalties: Array.isArray(data?.penalties) ? data.penalties : []
  };
}

function saveRocket() {
  saveData(ROCKET_STORAGE_KEY, rocketData);
  renderRocket();
  window.dispatchEvent(new Event("cosmos:datachange"));
}

function addTransaction(type, amount, description) {
  rocketData.transactions.unshift({
    id: createId("transaction"),
    type,
    amount: Math.round(amount),
    description,
    date: new Date().toISOString()
  });

  rocketData.transactions = rocketData.transactions.slice(0, 500);
}

function daysBetween(startKey, endKey) {
  if (!startKey || !endKey) return 0;

  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  return Math.max(0, Math.floor((end - start) / 86400000));
}

function applyDailyInterest() {
  const today = todayKey();

  if (!rocketData.lastInterestDate) {
    rocketData.lastInterestDate = today;
    saveData(ROCKET_STORAGE_KEY, rocketData);
    return;
  }

  const elapsedDays = daysBetween(rocketData.lastInterestDate, today);

  if (elapsedDays <= 0 || rocketData.debt <= 0) {
    if (elapsedDays > 0) {
      rocketData.lastInterestDate = today;
      saveData(ROCKET_STORAGE_KEY, rocketData);
    }
    return;
  }

  const before = rocketData.debt;
  rocketData.debt = Math.ceil(
    rocketData.debt * Math.pow(1 + DAILY_INTEREST_RATE, elapsedDays)
  );

  const interest = rocketData.debt - before;

  if (interest > 0) {
    addTransaction(
      "interest",
      interest,
      `${elapsedDays}日分の借金利息（日利5%・複利）`
    );
  }

  rocketData.lastInterestDate = today;
  saveData(ROCKET_STORAGE_KEY, rocketData);
}

function renderTransactions() {
  const container =
    document.querySelector("#rocket-history") ||
    document.querySelector("#transaction-history") ||
    document.querySelector("#rocket-transactions");

  if (!container) return;

  container.replaceChildren();

  if (!rocketData.transactions.length) {
    container.innerHTML = '<p class="empty-state">取引履歴はありません</p>';
    return;
  }

  rocketData.transactions.slice(0, 50).forEach((transaction) => {
    const row = document.createElement("article");
    row.className = "transaction-row";

    const amount = Number(transaction.amount || 0);
    const sign = ["income", "repayment"].includes(transaction.type) ? "+" : "";

    row.innerHTML = `
      <div>
        <strong>${escapeHTML(transaction.description || transaction.type)}</strong>
        <p>${escapeHTML(String(transaction.date || "").slice(0, 16).replace("T", " "))}</p>
      </div>
      <span>${sign}${formatCredits(amount)} CR</span>
    `;

    container.appendChild(row);
  });
}

function renderRocket() {
  const crTargets = [
    "#rocket-cr",
    "#current-cr",
    "#finance-cr",
    "[data-rocket-cr]"
  ];

  const debtTargets = [
    "#rocket-debt",
    "#current-debt",
    "#finance-debt",
    "[data-rocket-debt]"
  ];

  const unpaidTargets = [
    "#rocket-unpaid",
    "#unpaid-amount",
    "[data-rocket-unpaid]"
  ];

  crTargets.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = formatCredits(rocketData.cr);
    });
  });

  debtTargets.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = formatCredits(rocketData.debt);
    });
  });

  unpaidTargets.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = formatCredits(rocketData.unpaid);
    });
  });

  const interestLabel = document.querySelector("#rocket-interest-rate");
  if (interestLabel) interestLabel.textContent = "日利5%（複利）";

  const debtLimitLabel = document.querySelector("#rocket-debt-limit");
  if (debtLimitLabel) debtLimitLabel.textContent = `${formatCredits(DEBT_LIMIT)} CR`;

  renderTransactions();
}

export function getRocketData() {
  return rocketData;
}

export function addCredits(amount, description = "CR獲得") {
  const value = Math.floor(Number(amount));

  if (!Number.isFinite(value) || value <= 0) return false;

  rocketData.cr += value;
  addTransaction("income", value, description);
  saveRocket();
  return true;
}

export function spendCredits(amount, description = "CR支出") {
  const value = Math.floor(Number(amount));

  if (!Number.isFinite(value) || value <= 0 || rocketData.cr < value) {
    return false;
  }

  rocketData.cr -= value;
  addTransaction("expense", value, description);
  saveRocket();
  return true;
}

/*
 * 期限超過時のペナルティ。
 * 同じ目標IDでは一度しか処理しない。
 * 不足分は借金にするが、借金上限10,000 CRを超える分は未払いに記録。
 */
export function applyGoalPenalty(goalId, amount, description = "目標期限超過") {
  if (!goalId || rocketData.penalties.includes(goalId)) return false;

  const penalty = Math.max(0, Math.floor(Number(amount) || 0));
  if (penalty <= 0) return false;

  const paidFromCR = Math.min(rocketData.cr, penalty);
  rocketData.cr -= paidFromCR;

  const shortage = penalty - paidFromCR;
  const availableDebt = Math.max(0, DEBT_LIMIT - rocketData.debt);
  const newDebt = Math.min(shortage, availableDebt);
  const unpaidAmount = shortage - newDebt;

  rocketData.debt += newDebt;
  rocketData.unpaid += unpaidAmount;
  rocketData.penalties.push(goalId);

  addTransaction(
    "penalty",
    penalty,
    `${description}（CR支払い ${paidFromCR}、借金 ${newDebt}、未払い ${unpaidAmount}）`
  );

  saveRocket();
  return true;
}

export function repayDebt(amount) {
  const requested = Math.floor(Number(amount));

  if (!Number.isFinite(requested) || requested <= 0) return false;
  if (rocketData.cr <= 0 || rocketData.debt <= 0) return false;

  const repayment = Math.min(requested, rocketData.cr, rocketData.debt);

  rocketData.cr -= repayment;
  rocketData.debt -= repayment;

  addTransaction("repayment", repayment, "借金返済");
  saveRocket();

  return true;
}

function bindFinanceForm() {
  const form =
    document.querySelector("#repay-form") ||
    document.querySelector("#rocket-repay-form");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const amountInput =
      form.querySelector('[name="amount"]') ||
      document.querySelector("#repay-amount");

    const amount = Number(amountInput?.value || 0);

    if (repayDebt(amount)) {
      form.reset();
    } else {
      const toast = document.querySelector("#toast");
      if (toast) {
        toast.textContent = "返済額または所持CRを確認してください";
        toast.classList.add("visible");
      }
    }
  });

  document.querySelector("#rocket-open-finance")?.addEventListener("click", () => {
    const dialog = document.querySelector("#rocket-finance-dialog");

    if (dialog instanceof HTMLDialogElement) {
      dialog.showModal();
    } else if (dialog) {
      dialog.hidden = false;
    }
  });

  document.querySelector("#rocket-open-history")?.addEventListener("click", () => {
    document.querySelector("#rocket-history")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

export function initRocket() {
  rocketData = normalizeRocketData(
    loadData(ROCKET_STORAGE_KEY, {
      cr: 0,
      debt: 0,
      unpaid: 0,
      lastInterestDate: "",
      transactions: [],
      penalties: []
    })
  );

  applyDailyInterest();
  bindFinanceForm();
  renderRocket();

  window.addEventListener("cosmos:viewchange", (event) => {
    if (event.detail?.view === "rocket") renderRocket();
  });

  window.addEventListener("cosmos:datachange", renderRocket);
}