export type ToastKind =
  | 'lost'
  | 'waste'
  | 'routine'
  | 'purchase'
  | 'reward'
  | 'save-error'
  | 'finance'
  | 'info'
  | 'important';

export type ToastPriority = 'routine' | 'important';

export type ToastDecision = {
  show: boolean;
  durationMs: number;
  priority: ToastPriority;
};

type ActiveToast = {
  message: string;
  priority: ToastPriority;
  expiresAt: number;
};

export type ToastTimingOptions = {
  routineCooldownMs?: number;
  routineDurationMs?: number;
  importantDurationMs?: number;
};

const ROUTINE_KINDS = new Set<ToastKind>(['lost', 'waste', 'routine']);

/** Pure timing and priority policy for the single on-screen toast. */
export class ToastTiming {
  private readonly routineCooldownMs: number;
  private readonly routineDurationMs: number;
  private readonly importantDurationMs: number;
  private active: ActiveToast | undefined;
  private lastRoutineAt = -Infinity;

  constructor(options: ToastTimingOptions = {}) {
    this.routineCooldownMs = validDuration(options.routineCooldownMs, 12_000);
    this.routineDurationMs = validDuration(options.routineDurationMs, 3_200);
    this.importantDurationMs = validDuration(options.importantDurationMs, 3_200);
  }

  request(message: string, kind: ToastKind, now: number): ToastDecision {
    const priority: ToastPriority = ROUTINE_KINDS.has(kind) ? 'routine' : 'important';
    const durationMs = priority === 'routine' ? this.routineDurationMs : this.importantDurationMs;
    if (!Number.isFinite(now)) return {show: false, durationMs, priority};

    if (this.active && now >= this.active.expiresAt) this.active = undefined;
    if (this.active) {
      // Repeating the same message must leave the visible timer untouched.
      if (this.active.message === message) return {show: false, durationMs, priority};
      // Routine noise cannot replace a visible notice. A newer important result can.
      if (priority === 'routine') {
        return {show: false, durationMs, priority};
      }
    }

    if (priority === 'routine' && now - this.lastRoutineAt < this.routineCooldownMs) {
      return {show: false, durationMs, priority};
    }

    this.active = {message, priority, expiresAt: now + durationMs};
    if (priority === 'routine') this.lastRoutineAt = now;
    return {show: true, durationMs, priority};
  }

  /** Clears the visible notice while retaining routine cooldown history. */
  clear(): void {
    this.active = undefined;
  }

  /** Exposes only the current state needed by deterministic callers and tests. */
  current(now: number): {message: string; priority: ToastPriority; remainingMs: number} | undefined {
    if (!Number.isFinite(now) || !this.active || now >= this.active.expiresAt) return undefined;
    return {
      message: this.active.message,
      priority: this.active.priority,
      remainingMs: this.active.expiresAt - now,
    };
  }
}

function validDuration(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}
