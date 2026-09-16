import { describe, expect, it, vi } from 'vitest';
import { WebhookNotifier } from '../src/incident/notifiers.js';
import type { Alert } from '../src/incident/types.js';

const alert: Alert = {
  fingerprint: 'x',
  severity: 'critical',
  title: 'test',
  description: 'test',
  source: 'test',
  firedAt: new Date().toISOString(),
};

describe('WebhookNotifier', () => {
  it('posts the alert as JSON to the configured URL', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('ok', { status: 200 }));
    const notifier = new WebhookNotifier('https://hooks.slack.com/services/x', fetchMock as unknown as typeof fetch);

    await notifier.send(alert);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hooks.slack.com/services/x');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.alert.fingerprint).toBe('x');
  });

  it('throws when the webhook endpoint responds with a non-2xx status', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('nope', { status: 500 }));
    const notifier = new WebhookNotifier('https://hooks.slack.com/services/x', fetchMock as unknown as typeof fetch);

    await expect(notifier.send(alert)).rejects.toThrow(/500/);
  });
});
