import { createLocalJWKSet } from 'jose';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { defaultRoleMapper, requireAuth, requireRole } from '../src/iam/rbac.js';
import { OidcVerifier } from '../src/iam/verifier.js';
import { AUDIENCE, ISSUER, makeTestIdentity } from './testUtils.js';

async function buildApp() {
  const { jwks, issueToken } = await makeTestIdentity();
  const verifier = new OidcVerifier({ issuer: ISSUER, audience: AUDIENCE, keySource: createLocalJWKSet(jwks) });

  const app = express();
  app.get('/whoami', requireAuth(verifier), (req, res) => res.json(req.principal));
  app.post('/admin/deploy', requireAuth(verifier), requireRole('admins'), (_req, res) => res.json({ deployed: true }));

  return { app, issueToken };
}

describe('requireAuth', () => {
  it('rejects a request with no Authorization header', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/whoami');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed Authorization header', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/whoami').set('Authorization', 'garbage');
    expect(res.status).toBe(401);
  });

  it('attaches a principal with roles mapped from Okta groups on a valid token', async () => {
    const { app, issueToken } = await buildApp();
    const token = await issueToken({ email: 'alice@example.com', groups: ['Okta-Admins', 'app-Billing'] });

    const res = await request(app).get('/whoami').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subject: 'user-1', email: 'alice@example.com', roles: ['admins', 'billing'] });
  });
});

describe('requireRole', () => {
  it('allows a request when the principal has one of the allowed roles', async () => {
    const { app, issueToken } = await buildApp();
    const token = await issueToken({ groups: ['okta-admins'] });

    const res = await request(app).post('/admin/deploy').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deployed: true });
  });

  it('blocks a request when the principal lacks every allowed role, naming what was required', async () => {
    const { app, issueToken } = await buildApp();
    const token = await issueToken({ groups: ['okta-viewers'] });

    const res = await request(app).post('/admin/deploy').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden', required: ['admins'] });
  });
});

describe('defaultRoleMapper', () => {
  it('lower-cases groups and strips okta-/app- prefixes', () => {
    expect(defaultRoleMapper({ groups: ['Okta-Admins', 'APP-Billing', 'Everyone'] } as never)).toEqual([
      'admins',
      'billing',
      'everyone',
    ]);
  });

  it('returns an empty array when the token carries no groups claim', () => {
    expect(defaultRoleMapper({} as never)).toEqual([]);
  });
});
