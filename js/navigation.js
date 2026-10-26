
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/navigation.js
 *
 * 画面切り替えシステム
 *
 * 対応画面:
 * home         ホーム
 * calendar     カレンダー・予定
 * study        学習記録
 * statistics   統計・グラフ
 * goals        目標マップ
 * rocket       ロケット・経済
 */

const COSMOS_VIEWS = Object.freeze([
  "home",
  "calendar",
  "study",
  "statistics",
  "goals",
  "rocket"
]);

/**
 * 指定した画面を表示します。
 */
export function showView(name) {
  const viewName = COSMOS_VIEWS.includes(name)
    ? name
    : "home";

  const sections = document.querySelectorAll(
    "main > section[id^='view-']"
  );

  sections.forEach(section => {
    const active = section.id === `view-${viewName}`;

    section.hidden = !active;
    section.classList.toggle("active", active);
    section.setAttribute("aria-hidden", String(!active));
  });

  document.querySelectorAll("[data-view]").forEach(button => {
    const active = button.dataset.view === viewName;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });

  // 他の機能ファイルが登録した画面更新処理を呼び出します。
  document.dispatchEvent(
    new CustomEvent("cosmos:viewchange", {
      detail: { view: viewName }
    })
  );

  return viewName;
}

/**
 * 画面切り替えボタンを登録します。
 */
export function initNavigation() {
  if (document.documentElement.dataset.cosmosNavigationReady === "true") {
    return;
  }

  document.documentElement.dataset.cosmosNavigationReady = "true";

  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest("[data-view]");

    if (!button) {
      return;
    }

    event.preventDefault();
    showView(button.dataset.view);
  });

  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest("[data-close]");

    if (!button) {
      return;
    }

    const dialog = document.getElementById(button.dataset.close);

    if (!dialog) {
      return;
    }

    if (dialog instanceof HTMLDialogElement) {
      if (dialog.open) {
        dialog.close();
      }
    } else {
      dialog.hidden = true;
    }
  });

  document.querySelectorAll(".app-dialog").forEach(dialog => {
    if (!(dialog instanceof HTMLDialogElement)) {
      return;
    }

    dialog.addEventListener("click", event => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  });
}

export { COSMOS_VIEWS };
