---
name: wild-card-lead-gen
description: >-
  Product vision, stack, architecture, and agent rules for Wild Card Lead Gen
  (repo local-business-scaper) — Nuxt 4 lead-gen and site-audit app with Turso,
  RapidAPI, PageSpeed, Groq, and Resend. Use proactively whenever working in
  that repo, or when the user mentions lead gen, local business scraper/scaper,
  RapidAPI Local Business Data, PageSpeed audits, lead scoring, outreach,
  inbox, templates, Turso, or Resend in this project. Consult this skill before
  guessing architecture. Companion skills: wild-card-lead-gen-branding,
  wild-card-lead-gen-data.
---

# Wild Card Lead Gen

Internal sales-ops app for Wild Card Creative Co. Search local businesses, audit sites, score leads, send branded outreach.

**Repo:** `I:\WildCard\DevFolder\repos\local-business-scaper`  
**Vault (source of truth):** `I:\WildCard\Obsidian Vault\WildCardCreativeCo\Wild Card Creative Co\Wild Card Lead Gen`

If the vault is available, read the matching note before large changes. If it is missing, this skill + the companion skills are enough to develop.

## How to use

1. Read this skill first.
2. Branding / CSS / email chrome → `wild-card-lead-gen-branding`
3. Schema / types / scoring / routes → `wild-card-lead-gen-data`
4. Vault hub: `Wild Card Lead Gen.md`

## Stack (do not substitute)

| Layer | Use this |
|---|---|
| Framework | Nuxt ^4.5, `app/` directory |
| UI | `@nuxt/ui` ^4.10 — no extra `@tailwindcss/vite` |
| Auth | `nuxt-auth-utils` — **username** + password, sealed cookie |
| DB | `@libsql/client` — `file:dev.db` in dev, Turso in prod. **No Prisma. No Drizzle.** |
| Search | RapidAPI `local-business-data.p.rapidapi.com` (`server/utils/openweb-ninja.ts`) |
| Audit | PageSpeed Insights v5, strategy `mobile` |
| AI | Groq `llama-3.3-70b-versatile`, env var **`GROQ_API`** |
| Email | **Resend** — Mailgun is dead |
| Images | ImageKit (optional, Settings logo) |
| Deploy | Vercel; schema init on Nitro start (`server/plugins/db.ts`) |

## Agent rules

- Prefer **code + this vault** over `APP-DOCUMENTATION.md` and `.env.example` (both stale: Prisma/Mailgun).
- Never commit `.env` or `*.db`. Never paste API keys into docs.
- Server utils and nuxt-auth-utils helpers are **auto-imported**. Never `import { hashPassword } from '#auth-utils'`.
- Scope SQL by `event.context.user.id` except `email_templates` (global).
- `ui.colors` only in `app/app.config.ts` (`primary: 'wcRed'`, `secondary: 'wcGold'`, `neutral: 'wcNeutral'`, etc.).
- Dashboard uses official-site red/gold dark-only tokens; do not revert to purple. No `dark:` pairs in Vue files.
- Register always creates `role: 'user'`. Open registration — do not advertise `/register`.
- Outreach send: business must be `approved` and have `email`.
- Batch audit max 50, sequential.
- `/api/emails/webhook` is session-gated and unsigned — do not assume tracking works.
- IDs: `generateId()` from `server/utils/db.ts`, not cuid.
- Windows: no `&&` in the shell; generate secrets with Node, not openssl.
- CI uses **pnpm**; local typically **npm**. Do not add a second lockfile casually.

## User flow

```
login → search → score (no site = 95 hot) → audit → queue approve
  → template or Groq → Resend → inbox / export / n8n
```

Status: `new → approved → sent → responded | rejected`.

## Pages

`/login` `/register` (layout `auth`) · `/` dashboard · `/businesses` · `/businesses/[id]` · `/queue` · `/inbox` · `/compose` · `/templates` · `/settings`

Chrome lives in `app.vue` (`UDashboardSidebar`), not `layouts/default.vue`.

## Env (names matter)

`NUXT_SESSION_PASSWORD` `DATABASE_URL` `TURSO_DB_URL` `TURSO_KEY` `RAPIDAPI_KEY` `RAPIDAPI_HOST` `GOOGLE_PAGESPEED_API_KEY` `RESEND_API_KEY` **`GROQ_API`** `N8N_WEBHOOK_URL` `IMAGE_KIT_URL` `IMAGE_KIT_PUBLIC_KEY` `IMAGE_KIT_PRIVATE_KEY`

## Local boot

```powershell
npm install
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev
```

Rewrite `.env` — drop Mailgun; do not keep example keys.

## Vault index

All under `…\Wild Card Lead Gen\`:

Overview · Architecture/Tech Stack · Repo Structure · Data Models · Brand/* · Authentication/Auth System · Development/* · Features/* · Deployment/Production Setup · Security
