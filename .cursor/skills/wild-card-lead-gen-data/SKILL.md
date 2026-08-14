---
name: wild-card-lead-gen-data
description: >-
  Data layer for Wild Card Lead Gen (local-business-scaper) — LibSQL schema,
  TypeScript types, lead-scoring algorithm, RapidAPI/PageSpeed/Groq/Resend
  payloads, and the full API route map. Use when adding tables or columns,
  writing server routes, changing scoring, wiring n8n, or touching shared/types.
---

# Wild Card Lead Gen — Data Layer

## Connection

```ts
// server/utils/db.ts
url: isDevelopment ? (DATABASE_URL || 'file:dev.db') : (TURSO_DB_URL || 'file:dev.db')
authToken: isProduction ? TURSO_KEY : undefined
generateId() // `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
```

Schema: `initializeSchema()` on Nitro start. `CREATE TABLE IF NOT EXISTS` + try/catch `ALTER TABLE`.

## Local database (dev.db)

`dev.db` is **not tracked in git** (removed Aug 2026; gitignored via `*.db`). Fresh clones start with no database — `initializeSchema()` creates an empty one automatically on first `npm run dev`, then sign in with an allowlisted email code.

Local `dev.db` and production Turso are **separate databases with separate accounts**. Production credentials will not log in locally and vice versa. Never commit `dev.db` or seed it into the repo.

## Tables

| Table | Scope | Notes |
|---|---|---|
| `users` | — | `username` UNIQUE, **`email` UNIQUE**, `password_hash` leftover unused, `role` default `user`. Allowlisted emails only. Sign-in via `login_codes`. |
| `login_codes` | email | Hashed 6-digit code, 10 min expiry, max 5 attempts |
| `searches` | user | query + location |
| `businesses` | user | `search_id` nullable; **`UNIQUE(user_id, place_id)`** where place_id is not null (not global unique) |
| `audits` | 1:1 business | Lighthouse + CWV + `raw_lighthouse_json` |
| `email_templates` | **global** | not per-user |
| `outreach_logs` | user | Resend `message_id`, `ai_generated` |
| `email_replies` | log | inbound (helper not routed) |
| `email_drafts` | user | |
| `branding_settings` | user | defaults `#D6293E` / `#2d1818`. Also `ai_model` (default `claude-fable-5`), `ai_max_tokens` (16000), `pitch_max_tokens` (1500) |
| `mockups` | user | Studio + n8n digest rows. Keyed by `place_id` + owner slug |

Indexes: businesses(user, search, status, unique user+place), searches(user), outreach_logs(user, business), email_replies(outreach), mockups(user, business, place).

SQLite booleans = INTEGER 0/1. Timestamps = `datetime('now')` text.

## Session user

```ts
{ id: string; username: string; name: string; email: string; role: string }
```

## Scoring (`lead-scorer.ts`)

No website → **95 hot**. Else add: perf <50 +30 / <70 +15; SEO same; not mobile +20; no SSL +10; a11y <50 +10; reviews>20 & rating≥4 +10. Cap 90.

hot ≥70 · warm ≥40 · cold ≥20 · skip <20.

`calculateAuditScore` does not pass `isMobileResponsive` today.

Status ≠ category. Status: `new | approved | sent | responded | rejected`.

## Types (`shared/types/index.ts`)

`BusinessSearchParams` `OpenWebBusiness` `PageSpeedResult` `ScoringInput` `ScoringResult` `N8nWebhookPayload` (`action: 'send_outreach'`) `LeadCategory` `OutreachStatus` `EmailStatus` `AuditReportData` `N8nReportPayload` (`action: 'send_audit_report'`) leftover `MailgunReportPayload`.

## Search

`POST /api/search` → RapidAPI `/search` + `extract_emails_and_contacts`. Optional lat/lng/zoom 14. US state post-filter. Upsert `(place_id, user_id)`. Email = first extracted email.

Contacts: `POST /api/businesses/[id]/scrape-contacts` → `/business-details`.

## Audit

PageSpeed v5 mobile, four categories. Platform from `detected-technologies`. SSL = URL starts with `https://`. Batch max 50 sequential.

## Email

Groq JSON `{ subject, bodyText }` + `generateEmailHTML`. Send requires approved + email. Template vars: `{{businessName}}` `{{category}}` `{{city}}` `{{state}}` `{{performanceScore}}` `{{seoScore}}` `{{accessibilityScore}}` `{{#issues}}{{.}}{{/issues}}`.

Seed templates: `no_website`, `poor_performance`, `poor_seo`.

## API map (session unless noted)

**Public prefix:** `/api/auth/*` `/api/_auth/` `/api/_nuxt_icon/` `/api/health` `/api/mockups/webhook`

| Method | Path |
|---|---|
| POST | `/api/auth/request-code` `login` `logout` |
| GET | `/api/auth/session` |
| POST | `/api/search` `/api/businesses/manual` |
| GET | `/api/autocomplete` `/api/businesses` `/api/businesses/[id]` `/api/mockups` `/api/mockups/[id]` |
| PATCH | `/api/businesses/[id]` |
| POST | `/api/businesses/delete` `[id]/audit` `[id]/scrape-contacts` `/api/audit/batch` |
| POST | `/api/mockups/generate` `/api/mockups/sync` `/api/mockups/[id]/revise` `pitch` `photos` |
| POST | `/api/mockups/webhook` (public, `X-Studio-Secret`) |
| GET/POST | `/api/templates` `/api/drafts` `/api/branding` |
| PATCH/DEL | `/api/templates/[id]` |
| POST | `/api/templates/seed` `/api/emails/generate` `/api/emails/webhook` |
| GET/DEL | `/api/drafts/[id]` |
| POST | `/api/outreach/send` `bulk` |
| GET | `/api/outreach/logs` `/api/inbox/threads` `/api/inbox/[id]` |
| GET | `/api/export/csv` `json` `/api/report/[id]` |
| POST | `/api/export/n8n` `/api/report/batch` `email` `n8n` |
| GET | `/api/imagekit/auth` |

Studio webhook `/api/mockups/webhook` is public except `X-Studio-Secret`. Resend `/api/emails/webhook` is still session-gated.

## Categories

`app/data/business-categories.ts` — groups: Food & Dining, Home Services, Automotive, Health & Medical, Beauty & Personal Care, plus more. `popularCategories`: restaurant, plumber, electrician, auto repair shop, dentist, hair salon, lawyer, real estate agent, gym, hotel.

## Migrate to Turso

`npm run migrate-to-turso` — needs `TURSO_DB_URL` + `TURSO_KEY`. Order: users → searches → businesses → audits → email_templates → outreach_logs → email_replies → email_drafts → branding_settings → mockups.

`npm run backfill-user-emails` — maps `ryan` / `aaron` / `chase` usernames to allowlisted addresses.

## Studio AI

Per-user in `branding_settings`. Defaults match live n8n: HTML `claude-fable-5` @ 16000 tokens, pitch 1500 tokens. Options: Haiku (cheap), Sonnet, Fable (current HTML), Opus. Sent on every Studio fire as `model`, `max_tokens`, `pitch_max_tokens`, `research_model`.
