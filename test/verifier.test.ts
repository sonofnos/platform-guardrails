import { createLocalJWKSet } from 'jose';
import { describe, expect, it } from 'vitest';
import { OidcVerifier, TokenVerificationError } from '../src/iam/verifier.js';
import { AUDIENCE, ISSUER, makeTestIdentity } from './testUtils.js';

describe('OidcVerifier', () => {
  it('accepts a token signed by the trusted key, matching issuer and audience', async () => {
    const { jwks, issueToken } = await makeTestIdentity();
    const verifier = new OidcVerifier({ issuer: ISSUER, audience: AUDIENCE, keySource: createLocalJWKSet(jwks) });

    const token = await issueToken({ email: 'alice@example.com', groups: ['okta-admins'] });
    const claims = await verifier.verify(token);

    expect(claims.sub).toBe('user-1');
    expect(claims.email).toBe('alice@example.com');
  });

  it('rejects a token signed by a key the verifier does not trust', async () => {
    const { issueToken } = await makeTestIdentity(); // token signed by identity A
    const { jwks: jwksB } = await makeTestIdentity(); // verifier only trusts identity B's keys
    const verifier = new OidcVerifier({ issuer: ISSUER, audience: AUDIENCE, keySource: createLocalJWKSet(jwksB) });

    const token = await issueToken({});
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects a token from the wrong issuer, even if correctly signed', async () => {
    const { jwks, issueToken } = await makeTestIdentity();
    const verifier = new OidcVerifier({ issuer: ISSUER, audience: AUDIENCE, keySource: createLocalJWKSet(jwks) });

    const token = await issueToken({}, { issuer: 'https://attacker.example.com/oauth2/default' });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects a token for the wrong audience', async () => {
    const { jwks, issueToken } = await makeTestIdentity();
    const verifier = new OidcVerifier({ issuer: ISSUER, audience: AUDIENCE, keySource: createLocalJWKSet(jwks) });

    const token = await issueToken({}, { audience: 'api://some-other-service' });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects an expired token', async () => {
    const { jwks, issueToken } = await makeTestIdentity();
    const verifier = new OidcVerifier({ issuer: ISSUER, audience: AUDIENCE, keySource: createLocalJWKSet(jwks) });

    const token = await issueToken({}, { expiresInSeconds: -60 });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects a structurally invalid token without throwing an unhandled error', async () => {
    const { jwks } = await makeTestIdentity();
    const verifier = new OidcVerifier({ issuer: ISSUER, audience: AUDIENCE, keySource: createLocalJWKSet(jwks) });

    await expect(verifier.verify('not-a-jwt')).rejects.toBeInstanceOf(TokenVerificationError);
  });
});
