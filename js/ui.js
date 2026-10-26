
/* =========================================================
   ONE FOR ALL COSMOS
   js/ui.js

   統合UI管理
   ・画面切り替え
   ・メニュー操作
   ・ボタン操作の集約
   ・各機能モジュールとの接続準備
   ========================================================= */

"use strict";

import { initNavigation, showView } from "./navigation.js";

/* ---------------------------------------------------------
   UI初期化状態
   --------------------------------------------------------- */

let initialized = false;

/* ---------------------------------------------------------
   共通DOM取得
   --------------------------------------------------------- */

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/* ---------------------------------------------------------
   メッセージ表示
   --------------------------------------------------------- */

export function showMessage(message, type = "info") {
  let element = $("#cosmos-message");

  if (!element) {
    element = document.createElement("div");
    element.id = "cosmos-message";
    element.className = "cosmos-message";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    document.body.appendChild(element);
  }

  element.textContent = String(message || "");
  element.dataset.type = type;

  element.hidden = false;
}

/* ---------------------------------------------------------
   画面切り替え
   --------------------------------------------------------- */

export function navigateTo(viewName) {
  try {
    showView(viewName);
  } catch (error) {
    console.error("[COSMOS] 画面切り替えエラー:", error);
    showMessage("画面を開けませんでした。", "error");
  }
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
    case "navigate":
      navigateTo(button.dataset.view);
      break;

    case "close-message": {
      const message = $("#cosmos-message");

      if (message) {
        message.hidden = true;
      }

      break;
    }

    default:
      /*
       * 学習・経済・ロケットなどの操作は、
       * 対応する機能との接続時に追加する。
       */
      break;
  }
}

/* ---------------------------------------------------------
   UI初期化
   --------------------------------------------------------- */

export function initUI() {
  if (initialized) {
    return;
  }

  initNavigation();

  document.addEventListener(
    "click",
    handleActionClick
  );

  initialized = true;

  document.dispatchEvent(
    new CustomEvent("cosmos:ui-ready")
  );
}

/* ---------------------------------------------------------
   初期化の解除
   テスト時などに使用
   --------------------------------------------------------- */

export function destroyUI() {
  if (!initialized) {
    return;
  }

  document.removeEventListener(
    "click",
    handleActionClick
  );

  initialized = false;
}

/* ---------------------------------------------------------
   ページ読み込み時の初期化
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
