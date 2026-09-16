import { exportJWK, generateKeyPair, SignJWT } from 'jose';

export const ISSUER = 'https://test-org.okta.com/oauth2/default';
export const AUDIENCE = 'api://platform-guardrails';

export async function makeTestIdentity() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key-1';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const jwks = { keys: [jwk] };

  async function issueToken(claims: Record<string, unknown>, opts: { expiresInSeconds?: number; issuer?: string; audience?: string } = {}) {
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuedAt()
      .setIssuer(opts.issuer ?? ISSUER)
      .setAudience(opts.audience ?? AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) + (opts.expiresInSeconds ?? 300))
      .setSubject((claims.sub as string) ?? 'user-1')
      .sign(privateKey);
  }

  return { jwks, issueToken };
}
