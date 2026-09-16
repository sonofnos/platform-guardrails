export type Severity = 'info' | 'warning' | 'critical';

export interface Alert {
  /** Stable ID from the source system (e.g. a monitoring check name + host). Used to dedupe and to correlate open/resolved pairs. */
  fingerprint: string;
  severity: Severity;
  title: string;
  description: string;
  source: string;
  firedAt: string;
}

export interface Notifier {
  send(alert: Alert): Promise<void>;
}
