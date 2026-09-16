import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTVerifyOptions } from 'jose';
import type { OidcClaims } from './types.js';

export interface OidcVerifierConfig {
  /** e.g. https://your-org.okta.com/oauth2/default -- the OIDC issuer. */
  issuer: string;
  /** JWKS endpoint. Only used to build the default key source; ignored if `keySource` is provided. */
  jwksUri?: string;
  audience: string | string[];
  /** Clock skew allowance between this service and the identity provider. */
  clockToleranceSeconds?: number;
  /**
   * Where public keys come from. Defaults to a remote JWKS fetched (and
   * cached) from `jwksUri`. Tests inject `createLocalJWKSet(jwks)` here
   * instead, so verifying a token never depends on a real network call.
   */
  keySource?: JWTVerifyGetKey;
}

export class TokenVerificationError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}

/**
 * Verifies an OIDC ID token: signature against the IdP's public keys, issuer,
 * audience, and expiry. This is the boundary between "a token that decodes"
 * and "a token this service should trust" -- decoding a JWT without verifying
 * it is not authentication, it is reading a public label someone else wrote.
 */
export class OidcVerifier {
  private readonly keySource: JWTVerifyGetKey;

  constructor(private readonly config: OidcVerifierConfig) {
    if (config.keySource) {
      this.keySource = config.keySource;
    } else {
      if (!config.jwksUri) throw new Error('either jwksUri or keySource must be provided');
      this.keySource = createRemoteJWKSet(new URL(config.jwksUri));
    }
  }

  async verify(token: string): Promise<OidcClaims> {
    const options: JWTVerifyOptions = {
      issuer: this.config.issuer,
      audience: this.config.audience,
      clockTolerance: this.config.clockToleranceSeconds ?? 5,
    };
    try {
      const { payload } = await jwtVerify(token, this.keySource, options);
      return payload as OidcClaims;
    } catch (err) {
      throw new TokenVerificationError('token failed verification', err);
    }
  }
}
