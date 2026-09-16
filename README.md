# platform-guardrails

Infrastructure and identity guardrails for a small production platform:
Terraform for DigitalOcean + Cloudflare, an Okta-compatible OIDC/RBAC layer,
secrets validation, and an incident alerting pipeline. Built as one coherent
system rather than four unrelated demos, because in a real environment
they're the same job: keep the surface area an attacker or a mistake can
reach as small as possible, and make sure someone finds out fast when
something does go wrong.

## What's here

```
terraform/
  modules/digitalocean-app/   droplet + firewall, hardened at boot via cloud-init
  modules/cloudflare-dns/     proxied DNS + strict-mode TLS + origin cert
  environments/production/    wires the modules together, remote state with locking
src/
  iam/        OIDC token verification + Okta-group-to-role RBAC middleware
  secrets/    fail-fast secret validation, safe redaction
  incident/   severity-gated, deduped alert dispatch to a webhook (Slack/PagerDuty-shaped)
docs/
  SECRETS.md              where secrets live, rotation, what never happens
  INCIDENT_RESPONSE.md    the runbook the incident/ code implements
```

## Why these specific decisions

**Infrastructure**
- The droplet's cloud-init disables root SSH and password auth, and turns on
  `ufw` + `fail2ban` *before* the box is reachable — hardening isn't a
  post-boot script that a fast attacker can beat.
- No inbound port 80 rule on the origin at all. Cloudflare terminates TLS and
  redirects HTTP to HTTPS at the edge in `strict` mode, which also means the
  origin's certificate is actually validated, not just present.
- `allowed_ssh_cidrs` has a Terraform `validation` block that refuses
  `0.0.0.0/0` outright — the module cannot be applied with SSH open to the
  internet, not "shouldn't be," cannot be.

**Accepted findings (documented `tfsec:ignore`, not a blanket suppression)**

`tfsec` flags any rule with a `0.0.0.0/0`/`::/0` address as critical,
regardless of port or direction. Four of those are real fixes (see egress,
above); three are inherent to running a public HTTPS service and are
ignored inline with a comment at the exact rule, not disabled for the
module or the repo:

| Finding | Why it's accepted |
|---|---|
| Inbound 443 open to the internet | It's the app's public listener. A web server that only accepts HTTPS from a private range isn't a web server. |
| Outbound 443 to the internet | Package registries, upstream APIs, and Let's Encrypt/Cloudflare all live on the public internet over HTTPS. |
| Outbound 53 (tcp+udp) to the internet | DNS resolution has no meaningful CIDR to scope to. |

The egress rules that *were* scopeable — the original `1-65535`/any-protocol
rule this replaced — were tightened rather than ignored.

**CI/CD**
- `tfsec` and `gitleaks` run on every PR, before any plan touches real
  credentials, so a bad rule or a leaked token fails in a PR check, not in
  an incident.
- `terraform plan` against production only runs inside a GitHub
  `environment` with required reviewers — a plan (let alone an apply) that
  reads real cloud credentials is never a click a PR author can trigger alone.

**Identity**
- `OidcVerifier` verifies signature, issuer, audience and expiry against the
  IdP's real JWKS — the tests sign tokens with a locally generated RSA key
  the verifier is told *not* to trust, specifically to prove a forged-but-
  well-formed token is rejected, not just a malformed one.
- `requireRole` checks intersection of required vs. assigned roles, so
  adding a stricter requirement to a route can only ever narrow access.

**Incident response**
- Severity threshold and fingerprint dedupe are separate, independently
  testable gates. A flapping `warning` check gets deduped; an `info` check
  never pages regardless of how often it fires. Conflating "is this
  page-worthy" with "have we already paged for this" is how both alert
  fatigue and missed pages happen.

## Running it

```bash
npm ci
npm test          # 27 tests: OIDC verification, RBAC, secrets, alert dispatch
npm run typecheck
npm run lint

cd terraform/modules/digitalocean-app && terraform init -backend=false && terraform validate
cd terraform/modules/cloudflare-dns   && terraform init -backend=false && terraform validate
```

Applying `terraform/environments/production` needs a DigitalOcean API token,
a Cloudflare API token + zone ID, and an S3 bucket + DynamoDB table for state
— see `terraform/environments/production/variables.tfvars.example` and
`docs/SECRETS.md`. Nothing in this repo can be applied without real
credentials supplied out of band; there is no default that reaches a live
account.
