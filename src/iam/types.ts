export interface OidcClaims {
  sub: string;
  email?: string;
  /** Okta puts group membership in a custom claim; the claim name is configurable per Okta authorization server. */
  groups?: string[];
  iss: string;
  aud: string | string[];
  exp: number;
  [key: string]: unknown;
}

export interface AuthenticatedPrincipal {
  subject: string;
  email?: string;
  roles: string[];
}

export type RoleMapper = (claims: OidcClaims) => string[];
