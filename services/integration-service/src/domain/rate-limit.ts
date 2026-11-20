// Fixed-window request counter kept in memory: at most `limit` calls per integration in each 60-second window.
// It is per process: with more than one instance of this service, or after a restart, counts start again.

export interface RateDecision { allowed: boolean; limit: number; remaining: number; resetAt: number }

export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();
  private readonly windowMs: number;
  constructor(windowMs = 60_000) {
    this.windowMs = windowMs;
  }

  hit(key: string, limit: number, now = Date.now()): RateDecision {
    if (this.windows.size > 10_000) this.prune(now);
    let w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      w = { start: now, count: 0 };
      this.windows.set(key, w);
    }
    const resetAt = w.start + this.windowMs;
    if (w.count >= limit) return { allowed: false, limit, remaining: 0, resetAt };
    w.count++;
    return { allowed: true, limit, remaining: limit - w.count, resetAt };
  }

  private prune(now: number) {
    for (const [key, w] of this.windows) if (now - w.start >= this.windowMs) this.windows.delete(key);
  }
}
