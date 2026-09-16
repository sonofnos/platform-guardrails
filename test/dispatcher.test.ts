import { describe, expect, it } from 'vitest';
import { AlertDispatcher } from '../src/incident/dispatcher.js';
import { InMemoryNotifier } from '../src/incident/notifiers.js';
import type { Alert } from '../src/incident/types.js';

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    fingerprint: 'disk-full:web-1',
    severity: 'critical',
    title: 'Disk usage above 90%',
    description: '/var/log is at 94% on web-1',
    source: 'do-monitoring',
    firedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AlertDispatcher', () => {
  it('pages on a critical alert at or above the threshold', async () => {
    const notifier = new InMemoryNotifier();
    const dispatcher = new AlertDispatcher(notifier, { dedupeWindowMs: 60_000, pageThreshold: 'warning' });

    const result = await dispatcher.dispatch(alert());

    expect(result).toEqual({ sent: true, reason: 'sent' });
    expect(notifier.sent).toHaveLength(1);
  });

  it('suppresses an info alert below the page threshold without touching the notifier', async () => {
    const notifier = new InMemoryNotifier();
    const dispatcher = new AlertDispatcher(notifier, { dedupeWindowMs: 60_000, pageThreshold: 'warning' });

    const result = await dispatcher.dispatch(alert({ severity: 'info' }));

    expect(result).toEqual({ sent: false, reason: 'below_threshold' });
    expect(notifier.sent).toHaveLength(0);
  });

  it('dedupes repeated firings of the same fingerprint within the window', async () => {
    let now = 1_000_000;
    const notifier = new InMemoryNotifier();
    const dispatcher = new AlertDispatcher(notifier, { dedupeWindowMs: 60_000, pageThreshold: 'warning', now: () => now });

    const first = await dispatcher.dispatch(alert());
    now += 5_000; // still within the 60s window
    const second = await dispatcher.dispatch(alert());

    expect(first.reason).toBe('sent');
    expect(second.reason).toBe('deduped');
    expect(notifier.sent).toHaveLength(1);
    expect(dispatcher.occurrencesSinceLastPage('disk-full:web-1')).toBe(2);
  });

  it('pages again once the dedupe window has elapsed', async () => {
    let now = 1_000_000;
    const notifier = new InMemoryNotifier();
    const dispatcher = new AlertDispatcher(notifier, { dedupeWindowMs: 60_000, pageThreshold: 'warning', now: () => now });

    await dispatcher.dispatch(alert());
    now += 61_000; // window elapsed
    const second = await dispatcher.dispatch(alert());

    expect(second.reason).toBe('sent');
    expect(notifier.sent).toHaveLength(2);
  });

  it('dedupes independently per fingerprint', async () => {
    const notifier = new InMemoryNotifier();
    const dispatcher = new AlertDispatcher(notifier, { dedupeWindowMs: 60_000, pageThreshold: 'warning' });

    await dispatcher.dispatch(alert({ fingerprint: 'disk-full:web-1' }));
    const other = await dispatcher.dispatch(alert({ fingerprint: 'disk-full:web-2' }));

    expect(other.reason).toBe('sent');
    expect(notifier.sent).toHaveLength(2);
  });
});
