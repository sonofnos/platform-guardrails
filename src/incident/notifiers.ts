import type { Alert, Notifier } from './types.js';

/** Posts to any incoming-webhook-shaped endpoint (Slack, PagerDuty Events v2 behind a small adapter, a generic webhook). */
export class WebhookNotifier implements Notifier {
  constructor(private readonly url: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async send(alert: Alert): Promise<void> {
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        alert,
      }),
    });
    if (!res.ok) {
      throw new Error(`webhook notifier received ${res.status} from ${this.url}`);
    }
  }
}

export class InMemoryNotifier implements Notifier {
  public sent: Alert[] = [];
  async send(alert: Alert): Promise<void> {
    this.sent.push(alert);
  }
}
