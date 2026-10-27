
"use strict";

import {
  COSMOS_VIEWS,
  initNavigation,
  showView
} from "./navigation.js";

/* =========================================================
   ONE FOR ALL COSMOS
   js/ui.js
   共通UI・画面切り替え・サイドメニュー・ダイアログ
   ========================================================= */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

let initialized = false;

/* ---------------------------------------------------------
   メッセージ表示
   --------------------------------------------------------- */

export function showMessage(message, duration = 2500) {
  const toast = $("#cosmos-message");

  if (!toast) {
    console.log("[COSMOS]", message);
    return;
  }

  toast.textContent = String(message);
  toast.hidden = false;
  toast.classList.add("show");
  toast.setAttribute("role", "status");

  if (toast._hideTimeout) {
    clearTimeout(toast._hideTimeout);
  }

  toast._hideTimeout = setTimeout(() => {
    toast.classList.remove("show");
    toast.hidden = true;
    toast._hideTimeout = null;
  }, duration);
}

/* ---------------------------------------------------------
   画面切り替え
   --------------------------------------------------------- */

export function navigateTo(viewName) {
  if (!COSMOS_VIEWS.includes(viewName)) {
    console.warn(`[COSMOS] 未登録の画面です: ${viewName}`);
    return false;
  }

  const changed = showView(viewName);

  if (changed) {
    closeMenu();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  return changed;
}

/* ---------------------------------------------------------
   サイドメニュー
   --------------------------------------------------------- */

function getMenuElements() {
  return {
    menu: $("#side-menu"),
    backdrop: $("#menu-backdrop"),
    openButton: $("#menu-open"),
    closeButton: $("#menu-close")
  };
}

export function openMenu() {
  const { menu, backdrop, openButton } = getMenuElements();

  if (!menu) {
    showMessage("メニューが見つかりません。");
    return;
  }

  menu.classList.add("open");
  menu.setAttribute("aria-hidden", "false");
  menu.removeAttribute("inert");

  if (backdrop) {
    backdrop.hidden = false;
    backdrop.classList.add("visible");
  }

  if (openButton) {
    openButton.setAttribute("aria-expanded", "true");
  }

  document.body.classList.add("menu-open");
}

export function closeMenu() {
  const { menu, backdrop, openButton } = getMenuElements();

  if (menu) {
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    menu.setAttribute("inert", "");
  }

  if (backdrop) {
    backdrop.classList.remove("visible");
    backdrop.hidden = true;
  }

  if (openButton) {
    openButton.setAttribute("aria-expanded", "false");
  }

  document.body.classList.remove("menu-open");
}

/* ---------------------------------------------------------
   ダイアログ
   --------------------------------------------------------- */

export function openDialog({
  title = "",
  content = "",
  confirmText = "決定",
  onConfirm = null
} = {}) {
  const dialog = $("#cosmos-dialog");
  const titleElement = $("#cosmos-dialog-title");
  const contentElement = $("#cosmos-dialog-content");
  const confirmButton = $("#cosmos-dialog-confirm");

  if (!dialog) {
    showMessage("ダイアログが見つかりません。");
    return;
  }

  if (titleElement) {
    titleElement.textContent = title;
  }

  if (contentElement) {
    if (content instanceof Node) {
      contentElement.replaceChildren(content);
    } else {
      contentElement.textContent = String(content);
    }
  }

  if (confirmButton) {
    confirmButton.textContent = confirmText;
    confirmButton.onclick = null;

    if (typeof onConfirm === "function") {
      confirmButton.onclick = async event => {
        event.preventDefault();

        try {
          const result = await onConfirm();

          if (result !== false) {
            closeDialog();
          }
        } catch (error) {
          console.error("[COSMOS] ダイアログ処理エラー:", error);
          showMessage("処理に失敗しました。");
        }
      };
    }
  }

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) {
      dialog.showModal();
    }
  } else {
    dialog.setAttribute("open", "");
  }
}

export function closeDialog() {
  const dialog = $("#cosmos-dialog");

  if (!dialog) return;

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

/* ---------------------------------------------------------
   共通アクション
   --------------------------------------------------------- */

function handleActionClick(event) {
  const button = event.target.closest("[data-action]");

  if (!button || button.disabled) return;

  const action = button.dataset.action;

  switch (action) {
    case "navigate": {
      const destination = button.dataset.view;

      if (destination) {
        event.preventDefault();
        navigateTo(destination);
      }
      break;
    }

    case "close-message": {
      event.preventDefault();

      const toast = $("#cosmos-message");

      if (toast) {
        toast.classList.remove("show");
        toast.hidden = true;
      }
      break;
    }

    case "close-dialog":
      event.preventDefault();
      closeDialog();
      break;

    case "open-menu":
      event.preventDefault();
      openMenu();
      break;

    case "close-menu":
      event.preventDefault();
      closeMenu();
      break;

    case "scroll-top":
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;

    case "back":
      event.preventDefault();
      navigateTo("home");
      break;

    default:
      /*
       * 学習・カレンダー・経済などの機能別処理は、
       * それぞれの機能モジュールに任せます。
       * ここで勝手に処理を実行しないことで、
       * 二重登録や保存データの破損を防ぎます。
       */
      break;
  }
}

/* ---------------------------------------------------------
   初期画面
   --------------------------------------------------------- */

function initializeInitialView() {
  const currentView = document.body.dataset.currentView;

  if (
    currentView &&
    COSMOS_VIEWS.includes(currentView) &&
    document.getElementById(`view-${currentView}`)
  ) {
    showView(currentView);
    return;
  }

  showView("home");
}

/* ---------------------------------------------------------
   初期化
   --------------------------------------------------------- */

export function initUI() {
  if (initialized) return;

  initialized = true;

  initNavigation();

  const { openButton, closeButton, backdrop } = getMenuElements();

  openButton?.addEventListener("click", event => {
    event.preventDefault();
    openMenu();
  });

  closeButton?.addEventListener("click", event => {
    event.preventDefault();
    closeMenu();
  });

  backdrop?.addEventListener("click", closeMenu);

  document.addEventListener("click", handleActionClick);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  initializeInitialView();

  document.dispatchEvent(
    new CustomEvent("cosmos:ui-ready")
  );
}

/* ---------------------------------------------------------
   自動起動
   --------------------------------------------------------- */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI, {
    once: true
  });
} else {
  initUI();
}
