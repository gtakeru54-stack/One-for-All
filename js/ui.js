/* =========================================================
ONE FOR ALL COSMOS
js/ui.js
画面操作・左側メニュー・ダイアログ・メッセージ
========================================================= */

“use strict”;

import {
COSMOS_VIEWS,
initNavigation,
showView
} from “./navigation.js”;

/* =========================================================
共通設定
========================================================= */

const $ = (selector, root = document) =>
root.querySelector(selector);

const $$ = (selector, root = document) =>
Array.from(root.querySelectorAll(selector));

let initialized = false;

/* =========================================================
メッセージ表示
========================================================= */

let messageTimer = null;

export function showMessage(message, type = “info”, duration = 3000) {
const element =
$(”#cosmos-message”) ||
$(”#toast-message”) ||
$(”#app-message”);

if (!element) {
console.warn(”[COSMOS] メッセージ表示領域がありません:”, message);
return null;
}

if (messageTimer !== null) {
clearTimeout(messageTimer);
messageTimer = null;
}

element.textContent = String(message);
element.dataset.type = type;

element.classList.remove(
“is-visible”,
“show”,
“success”,
“error”,
“warning”,
“info”
);

element.classList.add(type, “is-visible”, “show”);
element.hidden = false;
element.setAttribute(“role”, type === “error” ? “alert” : “status”);

if (duration > 0) {
messageTimer = setTimeout(() => {
element.classList.remove(“is-visible”, “show”);
messageTimer = null;
}, duration);
}

return element;
}

/* =========================================================
画面遷移
========================================================= */

export function navigateTo(viewName) {
if (!COSMOS_VIEWS.includes(viewName)) {
console.warn(”[COSMOS] 未登録の画面です:”, viewName);
return false;
}

const target = document.getElementById(view-${viewName});

if (!target) {
console.warn(
[COSMOS] 移動先の画面がありません: #view-${viewName}
);
return false;
}

const success = showView(viewName);

if (!success) {
return false;
}

closeMenu();

window.scrollTo({
top: 0,
behavior: “auto”
});

return true;
}

/* =========================================================
左側メニュー
========================================================= */

function getMenuDrawer() {
return $(”#menu-drawer”) || $(”.menu-drawer”);
}

function getMenuBackdrop() {
return $(”#menu-backdrop”) || $(”.menu-backdrop”);
}

function isMenuOpen() {
const drawer = getMenuDrawer();

return (
document.body.classList.contains(“menu-open”) ||
drawer?.classList.contains(“is-open”) === true
);
}

export function openMenu() {
const drawer = getMenuDrawer();
const backdrop = getMenuBackdrop();

if (!drawer) {
console.warn(
“[COSMOS] メニューが見つかりません。index.html のメニュー部分を確認してください。”
);
return false;
}

document.body.classList.add(“menu-open”);
drawer.classList.add(“is-open”);
drawer.setAttribute(“aria-hidden”, “false”);

if (“inert” in drawer) {
drawer.inert = false;
}

if (backdrop) {
backdrop.classList.add(“is-open”);
backdrop.hidden = false;
backdrop.setAttribute(“aria-hidden”, “false”);
}

const toggle = $(”[data-menu-toggle]”);

if (toggle) {
toggle.setAttribute(“aria-expanded”, “true”);
}

const closeButton = $(
“[data-menu-close]”,
drawer
);

if (closeButton) {
closeButton.focus({
preventScroll: true
});
}

return true;
}

export function closeMenu() {
const drawer = getMenuDrawer();
const backdrop = getMenuBackdrop();

document.body.classList.remove(“menu-open”);

if (drawer) {
drawer.classList.remove(“is-open”);
drawer.setAttribute(“aria-hidden”, “true”);

if ("inert" in drawer) {
  drawer.inert = true;
}

}

if (backdrop) {
backdrop.classList.remove(“is-open”);
backdrop.setAttribute(“aria-hidden”, “true”);
}

const toggle = $(”[data-menu-toggle]”);

if (toggle) {
toggle.setAttribute(“aria-expanded”, “false”);
}

return true;
}

function toggleMenu() {
if (isMenuOpen()) {
closeMenu();
} else {
openMenu();
}
}

/* =========================================================
ダイアログ
========================================================= */

export function closeDialog(dialogId = “cosmos-dialog”) {
const dialog = document.getElementById(dialogId);

if (!dialog) {
return false;
}

if (typeof dialog.close === “function” && dialog.open) {
dialog.close();
} else {
dialog.removeAttribute(“open”);
}

return true;
}

export function openDialog(dialogId = “cosmos-dialog”) {
const dialog = document.getElementById(dialogId);

if (!dialog) {
console.warn(”[COSMOS] ダイアログがありません:”, dialogId);
return false;
}

if (typeof dialog.showModal === “function”) {
if (!dialog.open) {
dialog.showModal();
}
} else {
dialog.setAttribute(“open”, “”);
}

return true;
}

/* =========================================================
data-action 共通処理
各機能専用の処理は既存の機能モジュールに任せる
========================================================= */

function handleActionClick(event) {
const element = event.target.closest(”[data-action]”);

if (!element) {
return;
}

const action = element.dataset.action;

if (!action) {
return;
}

switch (action) {
case “navigate”: {
const viewName =
element.dataset.view ||
element.dataset.target;

  if (viewName) {
    event.preventDefault();
    navigateTo(viewName);
  }
  break;
}
case "close-message": {
  event.preventDefault();
  const message =
    $("#cosmos-message") ||
    $("#toast-message") ||
    $("#app-message");
  if (message) {
    message.classList.remove("is-visible", "show");
  }
  break;
}
case "close-dialog": {
  event.preventDefault();
  closeDialog(
    element.dataset.dialog || "cosmos-dialog"
  );
  break;
}
case "open-dialog": {
  event.preventDefault();
  openDialog(
    element.dataset.dialog || "cosmos-dialog"
  );
  break;
}
case "show-message": {
  event.preventDefault();
  showMessage(
    element.dataset.message || "完了しました。",
    element.dataset.type || "info"
  );
  break;
}
case "scroll-top": {
  event.preventDefault();
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
  break;
}
case "back": {
  event.preventDefault();
  const destination = element.dataset.back || "home";
  if (COSMOS_VIEWS.includes(destination)) {
    navigateTo(destination);
  }
  break;
}
/*
 * タイマー、カレンダー、経済などの機能専用操作は
 * ここで処理を横取りしない。
 * 既存の各機能モジュールに任せる。
 */
default:
  break;

}
}

/* =========================================================
メニュー操作
========================================================= */

function handleMenuClick(event) {
const target = event.target;

if (!(target instanceof Element)) {
return;
}

const toggle = target.closest(”[data-menu-toggle]”);

if (toggle) {
event.preventDefault();
toggleMenu();
return;
}

const closeButton = target.closest(”[data-menu-close]”);

if (closeButton) {
event.preventDefault();
closeMenu();
return;
}

const backdrop = getMenuBackdrop();

if (
backdrop &&
(target === backdrop ||
target.closest(”.menu-backdrop”) === backdrop)
) {
closeMenu();
return;
}

const drawer = getMenuDrawer();

if (!drawer || !drawer.contains(target)) {
return;
}

const viewButton = target.closest(”[data-view]”);

if (viewButton) {
const viewName = viewButton.dataset.view;

if (COSMOS_VIEWS.includes(viewName)) {
  event.preventDefault();
  navigateTo(viewName);
}

}
}

/* =========================================================
キーボード操作
========================================================= */

function handleGlobalKeydown(event) {
if (event.key === “Escape” && isMenuOpen()) {
closeMenu();

const toggle = $("[data-menu-toggle]");
if (toggle) {
  toggle.focus({
    preventScroll: true
  });
}

}
}

/* =========================================================
ダイアログの背景クリック
========================================================= */

function handleDialogClick(event) {
const dialog = event.target;

if (!(dialog instanceof HTMLDialogElement)) {
return;
}

if (dialog.id !== “cosmos-dialog”) {
return;
}

if (dialog.dataset.closeOnBackdrop !== “true”) {
return;
}

if (event.target === dialog) {
closeDialog(dialog.id);
}
}

/* =========================================================
メニュー初期状態
========================================================= */

function initializeMenu() {
const drawer = getMenuDrawer();
const backdrop = getMenuBackdrop();
const toggle = $(”[data-menu-toggle]”);

if (drawer) {
drawer.classList.remove(“is-open”);
drawer.setAttribute(“aria-hidden”, “true”);

if ("inert" in drawer) {
  drawer.inert = true;
}

}

if (backdrop) {
backdrop.classList.remove(“is-open”);
backdrop.setAttribute(“aria-hidden”, “true”);
}

document.body.classList.remove(“menu-open”);

if (toggle) {
toggle.setAttribute(“aria-expanded”, “false”);
toggle.setAttribute(“aria-controls”, drawer?.id || “menu-drawer”);
}
}

/* =========================================================
初期画面
========================================================= */

function initializeInitialView() {
const activeSection = $(
“main > section.active[id^=‘view-’]”
);

if (activeSection) {
const viewName = activeSection.id.replace(“view-”, “”);

if (
  COSMOS_VIEWS.includes(viewName) &&
  document.getElementById(`view-${viewName}`)
) {
  showView(viewName);
  return;
}

}

showView(“home”);
}

/* =========================================================
初期化
========================================================= */

export function initUI() {
if (initialized) {
return;
}

initialized = true;

initializeMenu();

/*

* 画面遷移の初期化
    */
    initNavigation();

/*

* 共通操作
    */
    document.addEventListener(“click”, handleMenuClick);
    document.addEventListener(“click”, handleActionClick);
    document.addEventListener(“click”, handleDialogClick);
    document.addEventListener(“keydown”, handleGlobalKeydown);

/*

* 初期画面をホームに設定
    */
    initializeInitialView();

/*

* 他の機能モジュールが初期化を検知できるようにする
    */
    document.dispatchEvent(
    new CustomEvent(“cosmos:ui-ready”)
    );
    }

/* =========================================================
終了処理
========================================================= */

export function destroyUI() {
if (!initialized) {
return;
}

document.removeEventListener(“click”, handleMenuClick);
document.removeEventListener(“click”, handleActionClick);
document.removeEventListener(“click”, handleDialogClick);
document.removeEventListener(“keydown”, handleGlobalKeydown);

if (messageTimer !== null) {
clearTimeout(messageTimer);
messageTimer = null;
}

closeMenu();

initialized = false;
}

/* =========================================================
DOM読み込み後に自動初期化
========================================================= */

if (document.readyState === “loading”) {
document.addEventListener(
“DOMContentLoaded”,
initUI,
{ once: true }
);
} else {
initUI();
}