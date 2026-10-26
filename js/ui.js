
// =========================================================
// ONE FOR ALL COSMOS
// js/ui.js
// 共通UI・画面遷移・ボタン操作・メッセージ管理
// =========================================================

"use strict";

import { initNavigation, showView } from "./navigation.js";

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

const VALID_VIEWS = [
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

let messageTimer = null;
let initialized = false;

/* ---------------------------------------------------------
   メッセージ表示
   --------------------------------------------------------- */

export function showMessage(message, type = "info", duration = 2800) {
  let element =
    $("#cosmos-toast") ||
    $("#toast") ||
    $("#message-area") ||
    $("#message");

  if (!element) {
    element = document.createElement("div");
    element.id = "cosmos-toast";
    element.className = "toast";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    document.body.appendChild(element);
  }

  if (messageTimer !== null) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }

  element.textContent = String(message ?? "");
  element.className = "toast";

  if (type === "success") {
    element.classList.add("success");
  } else if (type === "error") {
    element.classList.add("error");
    element.setAttribute("role", "alert");
    element.setAttribute("aria-live", "assertive");
  } else {
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
  }

  element.hidden = false;

  if (duration > 0) {
    messageTimer = setTimeout(() => {
      element.hidden = true;
      messageTimer = null;
    }, duration);
  }

  return element;
}

/* ---------------------------------------------------------
   画面切り替え
   --------------------------------------------------------- */

export function navigateTo(viewName) {
  const name = String(viewName ?? "").trim();

  if (!VALID_VIEWS.includes(name)) {
    showMessage("指定された画面が見つかりません。", "error");
    return false;
  }

  const target = document.getElementById(`view-${name}`);

  if (!target) {
    showMessage(
      `画面「${name}」がHTMLに見つかりません。`,
      "error"
    );
    return false;
  }

  // navigation.js の既存処理を利用する
  showView(name);

  // hidden 属性と表示状態を明示的に同期する
  $$("main > section[id^='view-']").forEach((section) => {
    const isTarget = section.id === `view-${name}`;

    section.hidden = !isTarget;
    section.classList.toggle("active", isTarget);
    section.setAttribute(
      "aria-hidden",
      isTarget ? "false" : "true"
    );
  });

  // 下部メニューの選択状態を更新する
  $$("[data-view]").forEach((button) => {
    const buttonView = button.dataset.view;
    const isActive = buttonView === name;

    button.classList.toggle("active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  // 現在の画面を記録
  document.body.dataset.currentView = name;

  // 別モジュールが画面更新に反応できるよう通知
  document.dispatchEvent(
    new CustomEvent("cosmos:viewchange", {
      detail: { view: name }
    })
  );

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });

  return true;
}

/* ---------------------------------------------------------
   ダイアログを閉じる
   --------------------------------------------------------- */

export function closeDialog(target) {
  let dialog = target;

  if (typeof target === "string") {
    dialog = document.querySelector(target);
  }

  if (!dialog) {
    return false;
  }

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
    return true;
  }

  dialog.hidden = true;
  dialog.classList.remove("open");
  dialog.setAttribute("aria-hidden", "true");

  return true;
}

/* ---------------------------------------------------------
   ダイアログを開く
   --------------------------------------------------------- */

export function openDialog(target) {
  let dialog = target;

  if (typeof target === "string") {
    dialog = document.querySelector(target);
  }

  if (!dialog) {
    showMessage("ダイアログが見つかりません。", "error");
    return false;
  }

  if (
    typeof dialog.showModal === "function" &&
    dialog.tagName === "DIALOG"
  ) {
    if (!dialog.open) {
      dialog.showModal();
    }

    return true;
  }

  dialog.hidden = false;
  dialog.classList.add("open");
  dialog.setAttribute("aria-hidden", "false");

  return true;
}

/* ---------------------------------------------------------
   画面操作用の共通イベント
   --------------------------------------------------------- */

function handleNavigationClick(event) {
  const button = event.target.closest("[data-view]");

  if (!button) {
    return;
  }

  const viewName = button.dataset.view;

  if (!viewName) {
    return;
  }

  event.preventDefault();

  navigateTo(viewName);
}

function handleActionClick(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.action;

  switch (action) {
    case "navigate": {
      const viewName =
        button.dataset.target ||
        button.dataset.viewTarget;

      if (viewName) {
        event.preventDefault();
        navigateTo(viewName);
      } else {
        showMessage("移動先が設定されていません。", "error");
      }

      break;
    }

    case "close-message": {
      const message =
        button.closest(".toast") ||
        $("#cosmos-toast");

      if (message) {
        message.hidden = true;
      }

      break;
    }

    case "close-dialog": {
      const selector = button.dataset.target;

      if (selector) {
        closeDialog(selector);
      } else {
        const dialog = button.closest("dialog, .app-dialog");

        if (dialog) {
          closeDialog(dialog);
        }
      }

      break;
    }

    case "open-dialog": {
      const selector = button.dataset.target;

      if (selector) {
        openDialog(selector);
      } else {
        showMessage("開くダイアログが設定されていません。", "error");
      }

      break;
    }

    case "show-message": {
      const message =
        button.dataset.message ||
        "操作を受け付けました。";

      showMessage(message);
      break;
    }

    case "scroll-top": {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      break;
    }

    case "back": {
      const currentView =
        document.body.dataset.currentView || "home";

      if (currentView !== "home") {
        navigateTo("home");
      }

      break;
    }

    default: {
      // 機能モジュール側で処理するアクションは妨げない
      break;
    }
  }
}

/* ---------------------------------------------------------
   ダイアログの背景クリック
   --------------------------------------------------------- */

function handleDialogBackdropClick(event) {
  const dialog = event.target;

  if (
    dialog instanceof HTMLDialogElement &&
    dialog.open &&
    dialog.dataset.closeOnBackdrop === "true"
  ) {
    const rect = dialog.getBoundingClientRect();

    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!inside) {
      dialog.close();
    }
  }
}

/* ---------------------------------------------------------
   初期画面
   --------------------------------------------------------- */

function initializeInitialView() {
  const existing = document.body.dataset.currentView;

  if (existing && VALID_VIEWS.includes(existing)) {
    if (document.getElementById(`view-${existing}`)) {
      navigateTo(existing);
      return;
    }
  }

  const activeSection = $("main > section.active[id^='view-']");

  if (activeSection) {
    const viewName = activeSection.id.replace("view-", "");

    if (VALID_VIEWS.includes(viewName)) {
      navigateTo(viewName);
      return;
    }
  }

  navigateTo("home");
}

/* ---------------------------------------------------------
   UI 初期化
   --------------------------------------------------------- */

export function initUI() {
  if (initialized) {
    return;
  }

  initialized = true;

  // navigation.js の共通ナビゲーション処理
  initNavigation();

  // イベント委譲により、後から追加されたボタンにも対応
  document.addEventListener(
    "click",
    handleNavigationClick
  );

  document.addEventListener(
    "click",
    handleActionClick
  );

  document.addEventListener(
    "click",
    handleDialogBackdropClick
  );

  initializeInitialView();

  document.dispatchEvent(
    new CustomEvent("cosmos:ui-ready")
  );
}

/* ---------------------------------------------------------
   UI 終了処理
   --------------------------------------------------------- */

export function destroyUI() {
  if (!initialized) {
    return;
  }

  document.removeEventListener(
    "click",
    handleNavigationClick
  );

  document.removeEventListener(
    "click",
    handleActionClick
  );

  document.removeEventListener(
    "click",
    handleDialogBackdropClick
  );

  if (messageTimer !== null) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }

  initialized = false;
}

/* ---------------------------------------------------------
   自動起動
   --------------------------------------------------------- */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initUI,
    { once: true }
  );
} else {
  initUI();
}
