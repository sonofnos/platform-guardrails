import { describe, expect, it } from 'vitest';
import { MissingSecretsError, redact, validateSecrets } from '../src/secrets/validate.js';

describe('validateSecrets', () => {
  it('passes silently when every secret is present and well-formed', () => {
    expect(() =>
      validateSecrets(
        [
          { name: 'DO_TOKEN', minLength: 20 },
          { name: 'SLACK_WEBHOOK_URL', pattern: /^https:\/\/hooks\.slack\.com\// },
        ],
        { DO_TOKEN: 'dop_v1_' + 'a'.repeat(20), SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/x' },
      ),
    ).not.toThrow();
  });

  it('collects every missing secret in one error rather than failing on the first', () => {
    try {
      validateSecrets([{ name: 'A' }, { name: 'B' }, { name: 'C' }], { B: 'present' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MissingSecretsError);
      expect((err as MissingSecretsError).missing).toEqual(['A', 'C']);
    }
  });

  it('flags a value that is present but too short as invalid, not missing', () => {
    try {
      validateSecrets([{ name: 'DO_TOKEN', minLength: 20 }], { DO_TOKEN: 'short' });
      expect.unreachable();
    } catch (err) {
      const e = err as MissingSecretsError;
      expect(e.missing).toEqual([]);
      expect(e.invalid).toEqual(['DO_TOKEN']);
    }
  });

  it('flags a value that fails its pattern as invalid', () => {
    try {
      validateSecrets([{ name: 'SLACK_WEBHOOK_URL', pattern: /^https:\/\/hooks\.slack\.com\// }], {
        SLACK_WEBHOOK_URL: 'http://not-slack.example.com',
      });
      expect.unreachable();
    } catch (err) {
      expect((err as MissingSecretsError).invalid).toEqual(['SLACK_WEBHOOK_URL']);
    }
  });

  it('treats an empty string the same as an absent variable', () => {
    try {
      validateSecrets([{ name: 'A' }], { A: '' });
      expect.unreachable();
    } catch (err) {
      expect((err as MissingSecretsError).missing).toEqual(['A']);
    }
  });
});

describe('redact', () => {
  it('keeps the first and last four characters and masks the middle', () => {
    expect(redact('dop_v1_abcdefghijklmnop')).toBe('dop_***************mnop');
  });

  it('fully masks a short value rather than revealing it entirely', () => {
    expect(redact('short')).toBe('*****');
  });
});
