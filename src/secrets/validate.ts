export interface SecretSpec {
  name: string;
  /** A regex the value must match, e.g. so a Slack webhook URL can't silently be a placeholder string. */
  pattern?: RegExp;
  /** Minimum length, useful for catching a secret pasted as an empty string or a visibly truncated copy-paste. */
  minLength?: number;
}

export class MissingSecretsError extends Error {
  constructor(public readonly missing: string[], public readonly invalid: string[]) {
    super(
      [
        missing.length ? `missing: ${missing.join(', ')}` : null,
        invalid.length ? `invalid: ${invalid.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('; '),
    );
  }
}

/**
 * Fails fast, at process start, if required secrets are absent or obviously
 * wrong-shaped -- catching a missing DO token in a 2-second startup check
 * beats catching it when the first deploy job runs at 2am and fails
 * three minutes into a rollout with no clear cause.
 *
 * Never logs a secret's value, only its name, on purpose: a startup crash
 * log is one of the most common places a secret ends up in a log aggregator
 * by accident.
 */
export function validateSecrets(spec: SecretSpec[], env: NodeJS.ProcessEnv = process.env): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const s of spec) {
    const value = env[s.name];
    if (value === undefined || value === '') {
      missing.push(s.name);
      continue;
    }
    if (s.minLength !== undefined && value.length < s.minLength) {
      invalid.push(s.name);
      continue;
    }
    if (s.pattern && !s.pattern.test(value)) {
      invalid.push(s.name);
    }
  }

  if (missing.length || invalid.length) {
    throw new MissingSecretsError(missing, invalid);
  }
}

/** Redacts a value for the one legitimate reason to ever print something secret-shaped: confirming which secret rotated, without revealing it. */
export function redact(value: string): string {
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`;
}
