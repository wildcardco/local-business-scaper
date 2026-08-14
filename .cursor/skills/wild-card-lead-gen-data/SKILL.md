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

## Tables

| Table | Scope | Notes |
|---|---|---|
| `users` | — | `username` UNIQUE, `password_hash`, `role` default `user` |
| `searches` | user | query + location |
| `businesses` | user | `place_id` **UNIQUE globally**; social cols via ALTER |
| `audits` | 1:1 business | Lighthouse + CWV + `raw_lighthouse_json` |
| `email_templates` | **global** | not per-user |
| `outreach_logs` | user | Resend `message_id`, `ai_generated` |
| `email_replies` | log | inbound (helper not routed) |
| `email_drafts` | user | |
| `branding_settings` | user | purple defaults `#8b5cf6` / `#3b1f5c` |

Indexes: businesses(user, search, status), searches(user), outreach_logs(user, business), email_replies(outreach).

SQLite booleans = INTEGER 0/1. Timestamps = `datetime('now')` text.

## Session user

```ts
{ id: string; username: string; name: string; role: string }
```

`AuthUser.email` in `server/utils/auth.ts` is unused. Prefer `#auth-utils` User.

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

**Public prefix:** `/api/auth/*` `/api/_auth/` `/api/_nuxt_icon/` `/api/health`

| Method | Path |
|---|---|
| POST | `/api/auth/register` `login` `logout` `change-password` |
| GET | `/api/auth/session` |
| POST | `/api/search` |
| GET | `/api/autocomplete` `/api/businesses` `/api/businesses/[id]` |
| PATCH | `/api/businesses/[id]` |
| POST | `/api/businesses/delete` `[id]/audit` `[id]/scrape-contacts` `/api/audit/batch` |
| GET/POST | `/api/templates` `/api/drafts` `/api/branding` |
| PATCH/DEL | `/api/templates/[id]` |
| POST | `/api/templates/seed` `/api/emails/generate` `/api/emails/webhook` |
| GET/DEL | `/api/drafts/[id]` |
| POST | `/api/outreach/send` `bulk` |
| GET | `/api/outreach/logs` `/api/inbox/threads` `/api/inbox/[id]` |
| GET | `/api/export/csv` `json` `/api/report/[id]` |
| POST | `/api/export/n8n` `/api/report/batch` `email` `n8n` |
| GET | `/api/imagekit/auth` |

Webhook is **not** actually public — middleware will 401 Resend.

## Categories

`app/data/business-categories.ts` — groups: Food & Dining, Home Services, Automotive, Health & Medical, Beauty & Personal Care, plus more. `popularCategories`: restaurant, plumber, electrician, auto repair shop, dentist, hair salon, lawyer, real estate agent, gym, hotel.

## Migrate to Turso

`npm run migrate-to-turso` — needs `TURSO_DB_URL` + `TURSO_KEY`. Order: users → searches → businesses → audits → email_templates → outreach_logs → email_replies → email_drafts → branding_settings.
