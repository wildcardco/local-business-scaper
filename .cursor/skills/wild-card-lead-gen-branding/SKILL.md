---
name: wild-card-lead-gen-branding
description: >-
  Design system for Wild Card Lead Gen (local-business-scaper) — official site
  red/gold dark-only UI tokens (wcNeutral/wcRed/wcGold), burgundy brand guide,
  Inter/Outfit/JetBrains Mono, email HTML chrome, lead-category colors, and logo
  rules. Use when editing main.css, app.config.ts, dashboard chrome, email
  templates, Groq brand prompts, ImageKit logos, or any Wild Card Creative Co.
  visual in this app.
---

# Wild Card Lead Gen — Branding

Three systems. Do not collapse them:

| System | Primary | Where |
|---|---|---|
| **App UI** | Official red/gold dark-only (`#D6293E` / `#C9A227` on `#1A1A1A`) | `app/assets/css/main.css`, `app.config.ts` — tokens ported from `wcco-official-website` |
| **Official WC guide** | Burgundy `#2d1818` | `public/brand-assets/`, email fallbacks, Groq prompt |
| **Outbound email HTML** | Settings defaults red `#D6293E` / burgundy `#2d1818` | Resend/Groq/`branding_settings` — separate system, but purple is retired here too (Aug 2026) |

## App tokens (`@theme static`)

Canonical full scales live in `wcco-official-website` `main.css`. This app mirrors them in `app/assets/css/main.css`:

| Scale | Key anchors | Role |
|---|---|---|
| `wcNeutral` | 950 `#1A1A1A` · 900 `#201F25` · 700 `#34323A` · 50 `#F2F2F0` | bg / surface / border / text |
| `wcRed` | 500 `#D6293E` | primary CTA (one per view) |
| `wcGold` | 400 `#C9A227` | secondary / featured trim only |
| `wcSuccess` | 500 `#12B76A` | success state |
| `wcWarning` | 400 `#F97316` · 500 `#EA580C` | warning state |
| `wcError` | 500 `#EF4444` | error state |
| `wcInfo` | 500 `#3B82F6` | info state |

```css
:root, .dark {
  --ui-primary: var(--color-wcRed-500);
  --ui-secondary: var(--color-wcGold-400);
  --ui-bg: var(--color-wcNeutral-950);       /* #1A1A1A */
  --ui-bg-muted: var(--color-wcNeutral-900); /* #201F25 */
  --ui-border: var(--color-wcNeutral-700);   /* #34323A */
  --ui-text-highlighted: var(--color-wcNeutral-50); /* #F2F2F0 */
  --ui-radius: var(--radius-wc);             /* 10px */
}
```

```ts
// app/app.config.ts — NOT nuxt.config
ui: {
  colors: {
    primary: 'wcRed',
    secondary: 'wcGold',
    neutral: 'wcNeutral',
    success: 'wcSuccess',
    warning: 'wcWarning',
    error: 'wcError',
    info: 'wcInfo'
  }
}
```

**Dark-only:** `nuxt.config.ts` sets `colorMode` preference/fallback `'dark'`; `html` class `dark` is forced. `UColorModeButton` removed. No light theme. **No `dark:` prefixed classes** in app Vue files.

Fonts via `@nuxt/fonts` in `nuxt.config.ts`: **Inter** (body, `--font-sans`), **Outfit** (display/headings/buttons, `--font-display`), **JetBrains Mono** (mono labels/eyebrows, `--font-mono`). Space Grotesk removed. Google Fonts `<link>` tags removed. Official guide still says ITC Avant Garde Gothic Pro — do not add it without licensing.

Radius: `--ui-radius: var(--radius-wc)` = **10px**; cards **16px** (`--radius-wc-lg`).

## Official burgundy (client-facing)

| Name | Hex |
|---|---|
| Deep | `#2d1818` |
| Rich | `#3a1818` |
| Warm | `#4a1c1c` |
| White | `#ffffff` |

Email signature / `formatIssuesListHTML` use `#2d1818`. Settings defaults are red `#D6293E` / burgundy `#2d1818`. **Purple is fully retired** — no purple anywhere (UI, emails, reports). `scripts/migrate-purple-branding.mjs` updates old purple rows in the DB.

## Lead colors

`.lead-hot` red-500 · `.lead-warm` amber-500 · `.lead-cold` sky-500 · `.lead-skip` neutral-400 — semantic, not brand.

## Chrome

- Brand marks: `app/assets/icons/wc/mark.svg` + `spade.svg` registered as Iconify collection prefix `wc` (`i-wc-mark`, `i-wc-spade`), copied from `wcco-official-website`
- Sidebar and auth pages: `i-wc-mark` white on charcoal — **no purple gradient W tile**
- No `UColorModeButton` — dark-only
- Semantic tokens only for chrome: `bg-default` / `bg-muted` / `bg-elevated` / `border-default` / `text-muted` etc. — **no `gray-*` / `bg-white`**
- Email preview iframes stay white (outbound email documents) but sit inside dark chrome
- Custom: `.gradient-border`, `.animate-pulse-soft`, page fade 0.2s
- Reports HTML: burgundy→red header `#2d1818` → `#D6293E`; gold `#C9A227` for no-website stat

## Email HTML (`generateEmailHTML`)

600px table-ish div, inline CSS. Header/footer = `secondaryColor`. Links/strong = `primaryColor`. Footer: company, Chicago, wildcardcreativeco.com, `dev@wildcardcreativeco.com`.

Logo: `branding.logoUrl` or `https://www.wildcardcreativeco.com/brand-assets/logos/WCLogoWBackground.png`.

Groq loads `public/brand-assets/Wild-Card-Creative-Brand-Guide.md` via `loadBrandGuide()`.

## Voice

Company: professional, approachable, confident, solution-oriented. Tagline: **"Your Ace in Digital Success"**.  
Dashboard microcopy: plain ops English.  
Not Riotboard ALL-CAPS. Not official-site planning slogans.

## Logo rules

Clear space = spade height. Min 120px digital. White on dark, burgundy on light. No stretch/recolor/shadow. Guide names `WCLogo.png`, `WCEmblem.png`, `WCSpade.png`, `WCType.png` — PNGs may be missing from git; markdown is present.

## Agent rules

- New colors → `@theme` `--color-*`. No `tailwind.config.js`. No `theme()` v3 syntax.
- Never add `@tailwindcss/vite`.
- Dashboard UI = official site tokens, dark-only. No `dark:` pairs. No `gray-*`/`bg-white` chrome. Do not reintroduce purple.
- One red primary CTA per view; gold = secondary/featured trim only; semantic state colors always with icon/text.
- Branding settings restyle **email only**, not Nuxt UI.
