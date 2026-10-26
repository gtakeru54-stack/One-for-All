
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/timer.js
 *
 * 学習タイマーシステム
 *
 * 担当:
 * - 計測開始
 * - 一時停止
 * - 計測再開
 * - 経過時間の取得
 * - 計測終了
 *
 * 学習記録への保存は、呼び出し元に任せます。
 * このファイル単体では学習記録を追加しません。
 */

export class StudyTimer {
  constructor() {
    this.running = false;
    this.startedAt = 0;
    this.elapsedBeforePause = 0;
  }

  /**
   * タイマーを開始します。
   */
  start() {
    if (this.running) {
      return {
        success: false,
        error: "タイマーはすでに動作しています。"
      };
    }

    this.startedAt = Date.now();
    this.running = true;

    return {
      success: true,
      seconds: this.getSeconds()
    };
  }

  /**
   * タイマーを一時停止します。
   */
  pause() {
    if (!this.running) {
      return {
        success: false,
        error: "タイマーは動作していません。"
      };
    }

    this.elapsedBeforePause = this.getSeconds();
    this.startedAt = 0;
    this.running = false;

    return {
      success: true,
      seconds: this.elapsedBeforePause
    };
  }

  /**
   * 一時停止したタイマーを再開します。
   */
  resume() {
    if (this.running) {
      return {
        success: false,
        error: "タイマーはすでに動作しています。"
      };
    }

    this.startedAt = Date.now();
    this.running = true;

    return {
      success: true,
      seconds: this.getSeconds()
    };
  }

  /**
   * 現在までの経過時間を秒単位で返します。
   */
  getSeconds() {
    const currentElapsed = this.running
      ? Math.floor((Date.now() - this.startedAt) / 1000)
      : 0;

    return Math.max(
      0,
      this.elapsedBeforePause + currentElapsed
    );
  }

  /**
   * タイマーの状態を返します。
   */
  getState() {
    return {
      running: this.running,
      seconds: this.getSeconds()
    };
  }

  /**
   * 計測を終了し、計測時間を返します。
   * このメソッドは学習記録の保存までは行いません。
   */
  finish() {
    const seconds = this.getSeconds();

    this.reset();

    return {
      success: seconds > 0,
      seconds
    };
  }

  /**
   * タイマーを初期状態に戻します。
   */
  reset() {
    this.running = false;
    this.startedAt = 0;
    this.elapsedBeforePause = 0;
  }
}

/**
 * 表示用の HH:MM:SS 形式に変換します。
 */
export function formatTimerClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));

  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const remainingSeconds = String(total % 60).padStart(2, "0");

  return `${hours}:${minutes}:${remainingSeconds}`;
}

/**
 * 表示用の学習時間に変換します。
 */
export function formatStudyDuration(seconds) {
  const totalMinutes = Math.floor(
    Math.max(0, Number(seconds) || 0) / 60
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0
    ? `${hours}時間${minutes}分`
    : `${minutes}分`;
}
