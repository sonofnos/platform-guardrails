# Incident response runbook

## Severity

| Level | Meaning | Paged? |
|---|---|---|
| `critical` | Customer-facing outage, or data at risk | Immediately, `AlertDispatcher` bypasses no gate but severity threshold |
| `warning` | Degraded but not down (elevated latency, disk >80%) | Paged by default; threshold is configurable per environment |
| `info` | Recorded, reviewed at the next sync | Never pages |

## First five minutes

1. **Acknowledge.** Claim the page so a second responder doesn't duplicate work.
2. **Check `occurrencesSinceLastPage`** for the alert's fingerprint before
   doing anything else — a fingerprint that's fired forty times in the
   dedupe window is a different problem (a flapping check, or a real outage
   that's been silently re-triggering) than one that's fired once.
3. **Read the fingerprint, not just the title.** Fingerprints are built as
   `<check>:<host>` specifically so the same failure on two hosts pages as
   two distinct incidents rather than merging into one confusing thread.
4. **Widen or narrow scope explicitly.** State out loud (in the incident
   channel) whether this looks isolated to one host/service or systemic,
   before starting remediation — narrows what the next fifteen minutes
   should be spent on.

## During

- Every material action (restart, rollback, scale-up, firewall change) gets
  one line in the incident channel: what, why, when. This is what the
  post-incident review is built from; reconstructing it from memory two days
  later is where root causes get lost.
- A `terraform apply` during an active incident still goes through the same
  `production` environment approval gate as any other change — an incident
  is not a reason to bypass the control that exists to prevent a second,
  self-inflicted one.

## After

- Every `critical` and every `warning` that paged gets a written note: root
  cause, what fixed it, what would have caught it sooner. No note, no
  closed incident.
- If the alert should not have paged at the severity it did (too sensitive,
  not sensitive enough), the threshold or the check itself gets changed in
  the same pull request as the postmortem, not left as a follow-up ticket
  that quietly never happens.
