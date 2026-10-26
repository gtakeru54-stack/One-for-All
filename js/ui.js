
/* =========================================================
   ONE FOR ALL COSMOS
   js/ui.js
   共通UI・画面遷移連携・ダイアログ・メッセージ管理
   ========================================================= */

"use strict";

import {
  COSMOS_VIEWS,
  initNavigation,
  showView
} from "./navigation.js";

const $ = (selector, root = document) =>
  root.querySelector(selector);

let messageTimer = null;
let initialized = false;

/* ---------------------------------------------------------
   メッセージ表示
   --------------------------------------------------------- */

export function showMessage(
  message,
  type = "info",
  duration = 2800
) {
  const element =
    $("#cosmos-message") ||
    $("#cosmos-toast") ||
    $("#toast") ||
    $("#message-area") ||
    $("#message");

  if (!element) {
    console.warn("[COSMOS]", String(message ?? ""));
    return null;
  }

  if (messageTimer !== null) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }

  element.textContent = String(message ?? "");
  element.classList.remove("success", "error", "info");
  element.classList.add(type);

  element.setAttribute(
    "role",
    type === "error" ? "alert" : "status"
  );

  element.setAttribute(
    "aria-live",
    type === "error" ? "assertive" : "polite"
  );

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
   実際の切り替えは navigation.js に任せる
   --------------------------------------------------------- */

export function navigateTo(viewName) {
  const name = String(viewName ?? "").trim();

  if (!COSMOS_VIEWS.includes(name)) {
    showMessage("指定された画面が見つかりません。", "error");
    return false;
  }

  if (!document.getElementById(`view-${name}`)) {
    showMessage(
      `画面「${name}」がHTMLに見つかりません。`,
      "error"
    );
    return false;
  }

  const changed = showView(name);

  if (!changed) {
    showMessage("画面の切り替えに失敗しました。", "error");
    return false;
  }

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
  const dialog =
    typeof target === "string"
      ? $(target)
      : target;

  if (!dialog) {
    return false;
  }

  if (
    dialog.tagName === "DIALOG" &&
    typeof dialog.close === "function"
  ) {
    if (dialog.open) {
      dialog.close();
    }

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
  const dialog =
    typeof target === "string"
      ? $(target)
      : target;

  if (!dialog) {
    showMessage("ダイアログが見つかりません。", "error");
    return false;
  }

  if (
    dialog.tagName === "DIALOG" &&
    typeof dialog.showModal === "function"
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
   共通ボタン操作
   --------------------------------------------------------- */

function handleActionClick(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.action;

  switch (action) {
    case "navigate": {
      const destination =
        button.dataset.target ||
        button.dataset.viewTarget;

      if (destination) {
        event.preventDefault();
        navigateTo(destination);
      } else {
        showMessage("移動先が設定されていません。", "error");
      }

      break;
    }

    case "close-message": {
      const message =
        button.closest("#cosmos-message, .toast") ||
        $("#cosmos-message");

      if (message) {
        message.hidden = true;
      }

      break;
    }

    case "close-dialog": {
      const selector = button.dataset.target;

      const dialog = selector
        ? $(selector)
        : button.closest("dialog, .app-dialog");

      if (dialog) {
        closeDialog(dialog);
      } else {
        showMessage("閉じるダイアログが見つかりません。", "error");
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
      showMessage(
        button.dataset.message || "操作を受け付けました。"
      );
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
      const current = document.body.dataset.currentView || "home";

      if (current !== "home") {
        navigateTo("home");
      }
      break;
    }

    default:
      // 学習・カレンダー・経済などの機能は
      // それぞれの機能モジュールで処理する。
      break;
  }
}

/* ---------------------------------------------------------
   ダイアログの背景クリック
   --------------------------------------------------------- */

function handleDialogBackdropClick(event) {
  const dialog = event.target;

  if (
    typeof HTMLDialogElement !== "undefined" &&
    dialog instanceof HTMLDialogElement &&
    dialog.open &&
    dialog.dataset.closeOnBackdrop === "true"
  ) {
    const rect = dialog.getBoundingClientRect();

    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!clickedInside) {
      dialog.close();
    }
  }
}

/* ---------------------------------------------------------
   初期画面
   --------------------------------------------------------- */

function initializeInitialView() {
  const current = document.body.dataset.currentView;

  if (
    current &&
    COSMOS_VIEWS.includes(current) &&
    document.getElementById(`view-${current}`)
  ) {
    navigateTo(current);
    return;
  }

  const active = $("main > section.active[id^='view-']");

  if (active) {
    const name = active.id.replace("view-", "");

    if (
      COSMOS_VIEWS.includes(name) &&
      document.getElementById(`view-${name}`)
    ) {
      navigateTo(name);
      return;
    }
  }

  navigateTo("home");
}

/* ---------------------------------------------------------
   初期化
   --------------------------------------------------------- */

export function initUI() {
  if (initialized) {
    return;
  }

  initialized = true;

  // data-view による画面切り替えは navigation.js のみで処理
  initNavigation();

  // data-action はこのファイルで共通処理する
  document.addEventListener("click", handleActionClick);

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
   終了処理
   --------------------------------------------------------- */

export function destroyUI() {
  if (!initialized) {
    return;
  }

  document.removeEventListener("click", handleActionClick);

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
