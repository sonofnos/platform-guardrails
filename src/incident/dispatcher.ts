import type { Alert, Notifier, Severity } from './types.js';

interface DedupeEntry {
  lastSentAt: number;
  count: number;
}

export interface DispatcherOptions {
  /** How long a fingerprint is suppressed after firing, so a flapping check doesn't page the same person forty times in ten minutes. */
  dedupeWindowMs: number;
  /** Below this severity, alerts are recorded but never paged -- an "info" alert waking someone at 3am is how alert fatigue starts. */
  pageThreshold: Severity;
  now?: () => number;
}

const SEVERITY_ORDER: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

export interface DispatchResult {
  sent: boolean;
  reason: 'sent' | 'deduped' | 'below_threshold';
}

/**
 * Routes an incoming alert to a notifier, applying two independent gates:
 *
 * 1. Severity threshold -- routine noise never reaches a human.
 * 2. Fingerprint dedupe -- the same failing check re-firing every 30 seconds
 *    pages once, not every 30 seconds, until the dedupe window elapses.
 *
 * These are separate concerns on purpose: threshold is a policy decision
 * (what counts as page-worthy), dedupe is a mechanical one (don't spam for
 * the same root cause). Conflating them into one flag makes both harder to
 * reason about independently, and harder to test.
 */
export class AlertDispatcher {
  private readonly recent = new Map<string, DedupeEntry>();

  constructor(private readonly notifier: Notifier, private readonly options: DispatcherOptions) {}

  async dispatch(alert: Alert): Promise<DispatchResult> {
    if (SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[this.options.pageThreshold]) {
      return { sent: false, reason: 'below_threshold' };
    }

    const now = (this.options.now ?? Date.now)();
    const entry = this.recent.get(alert.fingerprint);
    if (entry && now - entry.lastSentAt < this.options.dedupeWindowMs) {
      entry.count += 1;
      return { sent: false, reason: 'deduped' };
    }

    await this.notifier.send(alert);
    this.recent.set(alert.fingerprint, { lastSentAt: now, count: 1 });
    return { sent: true, reason: 'sent' };
  }

  /** How many times a fingerprint has fired since it last actually paged -- surfaced in the eventual page so a human sees "this fired 40 times", not just once. */
  occurrencesSinceLastPage(fingerprint: string): number {
    return this.recent.get(fingerprint)?.count ?? 0;
  }
}
