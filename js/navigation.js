
// =========================================================
// ONE FOR ALL COSMOS
// js/navigation.js
// 画面遷移・下部メニュー管理
// =========================================================

"use strict";

export const COSMOS_VIEWS = [
  "home",
  "calendar",
  "study",
  "statistics",
  "goals",
  "rocket",
  "economy",
  "countdown",
  "notifications",
  "settings"
];

const VIEW_TITLES = {
  home: "ホーム",
  calendar: "カレンダー",
  study: "学習記録",
  statistics: "学習統計",
  goals: "目標マップ",
  rocket: "ロケット",
  economy: "経済",
  countdown: "カウントダウン",
  notifications: "通知",
  settings: "設定"
};

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

let initialized = false;

/* ---------------------------------------------------------
   画面一覧を取得
   --------------------------------------------------------- */

export function getAvailableViews() {
  return COSMOS_VIEWS.filter((name) =>
    document.getElementById(`view-${name}`)
  );
}

/* ---------------------------------------------------------
   画面タイトルを取得
   --------------------------------------------------------- */

export function getViewTitle(name) {
  return VIEW_TITLES[name] || name;
}

/* ---------------------------------------------------------
   下部メニューの選択状態を更新
   --------------------------------------------------------- */

function updateNavigationState(name) {
  $$("[data-view]").forEach((element) => {
    const active = element.dataset.view === name;

    element.classList.toggle("active", active);

    if (active) {
      element.setAttribute("aria-current", "page");
    } else {
      element.removeAttribute("aria-current");
    }
  });
}

/* ---------------------------------------------------------
   画面を切り替える
   --------------------------------------------------------- */

export function showView(name) {
  if (!COSMOS_VIEWS.includes(name)) {
    console.warn(
      `[COSMOS] 未登録の画面です: ${name}`
    );

    return false;
  }

  const target = document.getElementById(`view-${name}`);

  if (!target) {
    console.warn(
      `[COSMOS] 画面要素が見つかりません: #view-${name}`
    );

    return false;
  }

  const sections = $$("main > section[id^='view-']");

  sections.forEach((section) => {
    const active = section === target;

    section.hidden = !active;
    section.classList.toggle("active", active);
    section.setAttribute(
      "aria-hidden",
      active ? "false" : "true"
    );
  });

  updateNavigationState(name);

  document.body.dataset.currentView = name;

  document.title =
    `${getViewTitle(name)} | One for All COSMOS`;

  document.dispatchEvent(
    new CustomEvent("cosmos:viewchange", {
      detail: {
        view: name,
        title: getViewTitle(name)
      }
    })
  );

  return true;
}

/* ---------------------------------------------------------
   data-view のクリック処理
   --------------------------------------------------------- */

function handleViewClick(event) {
  const element = event.target.closest("[data-view]");

  if (!element) {
    return;
  }

  const name = element.dataset.view;

  if (!COSMOS_VIEWS.includes(name)) {
    return;
  }

  event.preventDefault();
  showView(name);

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });
}

/* ---------------------------------------------------------
   戻る操作
   --------------------------------------------------------- */

function handleBackClick(event) {
  const button = event.target.closest("[data-back]");

  if (!button) {
    return;
  }

  event.preventDefault();

  const destination = button.dataset.back || "home";

  if (COSMOS_VIEWS.includes(destination)) {
    showView(destination);
  }
}

/* ---------------------------------------------------------
   初期画面を決定
   --------------------------------------------------------- */

export function initializeNavigation() {
  const active = $("main > section.active[id^='view-']");

  if (active) {
    const name = active.id.replace("view-", "");

    if (
      COSMOS_VIEWS.includes(name) &&
      document.getElementById(`view-${name}`)
    ) {
      return showView(name);
    }
  }

  return showView("home");
}

/* ---------------------------------------------------------
   ナビゲーションを初期化
   --------------------------------------------------------- */

export function initNavigation() {
  if (initialized) {
    return;
  }

  initialized = true;

  document.addEventListener(
    "click",
    handleViewClick
  );

  document.addEventListener(
    "click",
    handleBackClick
  );

  initializeNavigation();
}

/* ---------------------------------------------------------
   ナビゲーションを解除
   --------------------------------------------------------- */

export function destroyNavigation() {
  if (!initialized) {
    return;
  }

  document.removeEventListener(
    "click",
    handleViewClick
  );

  document.removeEventListener(
    "click",
    handleBackClick
  );

  initialized = false;
}
