/* =========================================================
   ONE FOR ALL — COSMOS
   js/navigation.js
   画面切り替え・ホーム・下部メニュー
   ========================================================= */

"use strict";

const VIEW_NAMES = [
  "home",
  "calendar",
  "study",
  "statistics",
  "goals",
  "rocket"
];

let currentView = "home";

export function showView(viewName) {
  const name = VIEW_NAMES.includes(viewName) ? viewName : "home";

  document.querySelectorAll("[id^='view-']").forEach((view) => {
    const active = view.id === `view-${name}`;
    view.hidden = !active;
    view.classList.toggle("active", active);
    view.setAttribute("aria-hidden", String(!active));
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  currentView = name;

  window.dispatchEvent(
    new CustomEvent("cosmos:viewchange", {
      detail: { view: name }
    })
  );

  window.scrollTo({ top: 0, behavior: "auto" });
}

export function getCurrentView() {
  return currentView;
}

export function initNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      showView(button.dataset.view);
    });
  });

  document.querySelector("#home-button")?.addEventListener("click", () => {
    showView("home");
  });

  document.querySelector("#brand-home")?.addEventListener("click", () => {
    showView("home");
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.close;
      const dialog = document.getElementById(target);

      if (dialog instanceof HTMLDialogElement) {
        dialog.close();
      } else if (dialog) {
        dialog.hidden = true;
      }
    });
  });

  document.querySelectorAll(".app-dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && dialog instanceof HTMLDialogElement) {
        dialog.close();
      }
    });
  });

  showView("home");
}