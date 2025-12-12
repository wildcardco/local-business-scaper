# Wild Card Lead Gen - Complete Application Documentation

A lead generation and website auditing tool built for Wild Card Creative Co. This application helps find local businesses that need websites or have poorly performing ones, then automates personalized outreach.

**Tech Stack:** Nuxt 4, Nuxt UI v4, Prisma, SQLite, TypeScript

---

## Table of Contents

1. [Overview](#overview)
2. [Features Summary](#features-summary)
3. [Pages & Navigation](#pages--navigation)
4. [Core Features (Working)](#core-features-working)
5. [Export & Report Features (Working)](#export--report-features-working)
6. [Integration Features](#integration-features)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [Configuration](#configuration)
10. [Known Limitations & Not Working](#known-limitations--not-working)

---

## Overview

Wild Card Lead Gen is designed to:
1. **Search** for local businesses using the RapidAPI Local Business Data API
2. **Audit** their websites using Google PageSpeed Insights (Lighthouse)
3. **Score** leads based on website quality (or lack thereof)
4. **Approve/Reject** leads through a queue system
5. **Export** data in multiple formats (CSV, JSON, HTML, Markdown, PDF)
6. **Generate Reports** after audits for Mailgun emails and n8n automation
7. **Send Outreach** emails via Mailgun or n8n workflows

---

## Features Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Business Search | ✅ Working | Requires RapidAPI key |
| Website Auditing | ✅ Working | Uses Google PageSpeed API |
| Lead Scoring | ✅ Working | Automatic scoring algorithm |
| Approval Queue | ✅ Working | Approve/reject leads |
| Bulk Actions | ✅ Working | Approve, reject, delete multiple |
| CSV Export | ✅ Working | Download all businesses |
| JSON Export | ✅ Working | Download all businesses |
| Audit Report Generation | ✅ Working | NEW - Multiple formats |
| Report Export (JSON/HTML/MD/PDF) | ✅ Working | NEW - Single & batch |
| Email Report via Mailgun | ✅ Working | NEW - Requires Mailgun config |
| Send Report to n8n | ✅ Working | NEW - Webhook integration |
| Email Templates | ✅ Working | CRUD operations |
| Direct Email Outreach | ⚠️ Partial | Requires email on business |
| n8n Integration | ✅ Working | Send leads to webhook |
| Settings Page | ✅ Working | View stats, config info |
| Dark/Light Mode | ✅ Working | Toggle in sidebar |

---

## Pages & Navigation

### 1. Dashboard (`/`)
The main landing page with:
- **Stats Cards**: Total leads, hot leads, no website, pending review
- **Search Form**: Search for businesses by query and location
- **Recent Leads Table**: Shows last 10 businesses found
- **Search Results**: Displays results after a search

### 2. Businesses (`/businesses`)
Full list of all businesses with:
- Sortable/filterable table
- Selection checkboxes for bulk actions
- Floating action toolbar (appears when items selected)
- Actions: Audit, View, Approve, Reject, Delete
- Export menu with all export options

### 3. Business Detail (`/businesses/[id]`)
Individual business view with:
- Business information card
- Lead score visualization (circular gauge)
- Audit report section (Lighthouse scores, Core Web Vitals)
- **Export Report** dropdown (NEW)
- Status management buttons

### 4. Approval Queue (`/queue`)
Review pending leads:
- Shows only businesses with `status: 'new'`
- Stats: Pending, Hot, Warm, Cold counts
- Bulk approve/reject functionality

### 5. Email Templates (`/templates`)
Manage outreach email templates:
- Create/Edit/Delete templates
- Toggle active/inactive
- Seed default templates
- Template variables: `{{businessName}}`, `{{category}}`, `{{city}}`, etc.

### 6. Settings (`/settings`)
Configuration and stats:
- Database statistics
- API configuration reference (env vars)
- Quick links to external services
- Danger zone (clear data)

---

## Core Features (Working)

### Business Search

**How it works:**
1. User enters a search query (e.g., "restaurants") and location (e.g., "Gary, Indiana")
2. Frontend calls `POST /api/search`
3. Server uses RapidAPI Local Business Data to fetch results
4. Results are saved to SQLite database with initial lead scores
5. Businesses are displayed in a table

**API Used:** `local-business-data.p.rapidapi.com/search`

**Initial Scoring:**
- Businesses WITHOUT a website get score **95** (hot lead)
- Businesses WITH a website get score **0** (needs audit)

### Website Auditing

**How it works:**
1. User clicks "Run Audit" on a business with a website
2. Progress modal shows real-time status
3. Server calls Google PageSpeed Insights API
4. Lighthouse scores are extracted (Performance, SEO, Accessibility, Best Practices)
5. Core Web Vitals are stored (FCP, LCP, TBT, CLS, Speed Index)
6. Platform detection runs (WordPress, Wix, Squarespace, etc.)
7. Lead score is recalculated based on audit results
8. Results saved to database

**Scoring Algorithm:**
```
Base Score = 0 (for businesses WITH websites)

Add points for issues:
- Performance < 50: +30 points
- Performance 50-70: +15 points
- SEO < 50: +30 points
- SEO 50-70: +15 points
- Not mobile responsive: +20 points
- No SSL: +10 points
- Accessibility < 50: +10 points
- Good reviews (20+ reviews, 4+ rating): +10 points

Max Score: 90 (for businesses with websites)

Categories:
- Hot: Score >= 70
- Warm: Score >= 40
- Cold: Score >= 20
- Skip: Score < 20
```

### Batch Auditing

**Endpoint:** `POST /api/audit/batch`

Audits multiple businesses in sequence (max 50 per batch). Each business is audited one at a time to avoid API rate limits.

### Lead Management

**Status Flow:**
```
new → approved → sent → responded
     └→ rejected
```

- **new**: Just discovered, needs review
- **approved**: Ready for outreach
- **sent**: Outreach email sent
- **responded**: Got a response
- **rejected**: Not a good fit

---

## Export & Report Features (Working)

### Basic Exports

#### CSV Export (`GET /api/export/csv`)
Downloads all businesses as CSV file with columns:
- Name, Category, Address, City, State, Zip
- Phone, Email, Website
- Rating, Reviews
- Lead Score, Lead Category, Status
- Performance Score, SEO Score, Accessibility Score
- Platform, Has SSL

#### JSON Export (`GET /api/export/json`)
Downloads all businesses as JSON with full audit data included.

### Audit Report Generation (NEW)

The new report system generates comprehensive audit reports that can be:
- Downloaded in multiple formats
- Emailed via Mailgun
- Sent to n8n for automation workflows

#### Single Business Report (`GET /api/report/[id]`)

**Query Parameters:**
- `format`: `json` | `html` | `markdown` | `pdf`

**What's Included:**
- Business information
- Lead score with category and reasons
- Full audit data (if audited)
- Core Web Vitals
- Technical details (platform, SSL)
- Personalized recommendations

**Recommendations are generated based on:**
- Performance issues → Image optimization, caching, CDN suggestions
- SEO issues → Meta tags, structured data, sitemap suggestions
- Accessibility issues → Contrast, ARIA labels, keyboard navigation
- Security issues → SSL certificate installation
- Platform-specific → WordPress plugin suggestions, etc.

#### Batch Report (`POST /api/report/batch`)

**Body:**
```json
{
  "businessIds": ["id1", "id2", "id3"],
  "format": "json" | "html" | "markdown" | "pdf"
}
```

Generates a combined report for multiple businesses with:
- Summary statistics (total, hot leads, warm leads, no website, avg score)
- Table of all businesses with key metrics
- Up to 50 businesses per batch

#### Email Report (`POST /api/report/email`)

**Body:**
```json
{
  "businessId": "...",
  "recipientEmail": "client@example.com",
  "customSubject": "Optional custom subject",
  "includeRecommendations": true
}
```

Sends a formatted HTML audit report via Mailgun. Logs the outreach to database.

#### Send Report to n8n (`POST /api/report/n8n`)

**Body:**
```json
{
  "businessId": "...",
  "format": "json",
  "webhookUrl": "optional-custom-webhook"
}
```

Sends report to n8n webhook with payload:
```json
{
  "action": "send_audit_report",
  "report": { /* full report data */ },
  "format": "json",
  "htmlContent": "...",
  "markdownContent": "..."
}
```

### Frontend Export Component

The `AuditReportExport` component provides a dropdown menu with options:
- Download JSON
- Download HTML
- Download Markdown
- Save as PDF (opens print dialog)
- Send to n8n
- Email Report (opens modal for recipient)

This appears on:
- Business detail page (after audit or if no website)
- Businesses list page (in floating toolbar when items selected)

---

## Integration Features

### Mailgun Integration

**Configuration:**
```env
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=your-domain.mailgun.org
```

**Capabilities:**
- Send outreach emails with templates
- Send audit reports
- Variable substitution in templates
- Outreach logging

**Template Variables:**
- `{{businessName}}` - Business name
- `{{category}}` - Business category
- `{{city}}`, `{{state}}` - Location
- `{{performanceScore}}`, `{{seoScore}}`, `{{accessibilityScore}}` - Audit scores
- `{{#issues}}...{{.}}...{{/issues}}` - Loop through issues list

### n8n Integration

**Configuration:**
```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/xxx
```

**Capabilities:**
1. **Send Leads** (`POST /api/export/n8n`) - Send approved leads for outreach
2. **Send Report** (`POST /api/report/n8n`) - Send audit report for automation

**Lead Payload:**
```json
{
  "action": "send_outreach",
  "leads": [{
    "id": "...",
    "businessName": "...",
    "email": "...",
    "phone": "...",
    "website": "...",
    "leadCategory": "hot|warm|cold",
    "leadScore": 85,
    "pitchType": "new_website|website_improvement",
    "issues": ["Poor performance: 35/100", "No SSL"],
    "audit": { /* scores */ }
  }],
  "template": {
    "id": "...",
    "subject": "...",
    "body": "..."
  }
}
```

---

## API Endpoints

### Search
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/search` | Search for businesses |
| GET | `/api/autocomplete` | Location autocomplete |

### Businesses
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/businesses` | List all businesses |
| GET | `/api/businesses/[id]` | Get single business |
| PATCH | `/api/businesses/[id]` | Update business (status, etc.) |
| POST | `/api/businesses/delete` | Bulk delete businesses |

### Auditing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/businesses/[id]/audit` | Run single audit |
| POST | `/api/audit/batch` | Run batch audit |

### Reports (NEW)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/report/[id]` | Get single business report |
| POST | `/api/report/batch` | Generate batch report |
| POST | `/api/report/email` | Email report via Mailgun |
| POST | `/api/report/n8n` | Send report to n8n webhook |

### Exports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/export/csv` | Export as CSV |
| GET | `/api/export/json` | Export as JSON |
| POST | `/api/export/n8n` | Send leads to n8n |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/templates` | List all templates |
| POST | `/api/templates` | Create template |
| PATCH | `/api/templates/[id]` | Update template |
| DELETE | `/api/templates/[id]` | Delete template |
| POST | `/api/templates/seed` | Add default templates |

### Outreach
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/outreach/send` | Send email to single business |
| POST | `/api/outreach/bulk` | Send bulk emails |
| GET | `/api/outreach/logs` | Get outreach history |

---

## Database Schema

### Models

**Search** - Records search queries
```prisma
model Search {
  id         String     @id @default(cuid())
  query      String     // "restaurants"
  location   String     // "Gary, Indiana"
  createdAt  DateTime   @default(now())
  businesses Business[]
}
```

**Business** - Main business entity
```prisma
model Business {
  id            String    @id @default(cuid())
  searchId      String
  name          String
  address       String?
  city          String?
  state         String?
  zipCode       String?
  phone         String?
  website       String?   // null = HOT LEAD
  email         String?
  googleMapsUrl String?
  placeId       String?   @unique
  category      String?
  rating        Float?
  reviewCount   Int?
  priceLevel    String?
  audit         Audit?
  leadScore     Int       @default(0)
  leadCategory  String?   // "hot", "warm", "cold", "skip"
  status        String    @default("new")
  approvedAt    DateTime?
  sentAt        DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

**Audit** - Website audit results
```prisma
model Audit {
  id                     String   @id @default(cuid())
  businessId             String   @unique
  performanceScore       Int?
  accessibilityScore     Int?
  bestPracticesScore     Int?
  seoScore               Int?
  firstContentfulPaint   String?
  largestContentfulPaint String?
  totalBlockingTime      String?
  cumulativeLayoutShift  String?
  speedIndex             String?
  isMobileResponsive     Boolean?
  hasSSL                 Boolean?
  hasMissingMetaTags     Boolean?
  detectedPlatform       String?
  rawLighthouseJson      String?
  auditedAt              DateTime @default(now())
}
```

**EmailTemplate** - Outreach email templates
```prisma
model EmailTemplate {
  id        String   @id @default(cuid())
  name      String
  subject   String
  body      String   // Supports {{variables}}
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**OutreachLog** - Email sending history
```prisma
model OutreachLog {
  id         String   @id @default(cuid())
  businessId String
  templateId String
  emailTo    String
  subject    String
  status     String   // "sent", "delivered", etc.
  sentAt     DateTime @default(now())
  messageId  String?
}
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Database (SQLite default)
DATABASE_URL="file:./dev.db"

# RapidAPI - Local Business Data (REQUIRED for search)
RAPIDAPI_KEY=your-rapidapi-key
RAPIDAPI_HOST=local-business-data.p.rapidapi.com

# Google PageSpeed Insights (OPTIONAL - works without, but rate limited)
GOOGLE_PAGESPEED_API_KEY=your-google-api-key

# Mailgun (REQUIRED for email features)
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-domain.mailgun.org

# n8n (REQUIRED for n8n integration)
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/xxx
```

### Getting API Keys

1. **RapidAPI**: Sign up at [rapidapi.com](https://rapidapi.com) and subscribe to [Local Business Data API](https://rapidapi.com/letscrape-6bRBa3QguO5/api/local-business-data)

2. **Google PageSpeed**: Create project at [Google Cloud Console](https://console.cloud.google.com) and enable PageSpeed Insights API

3. **Mailgun**: Sign up at [mailgun.com](https://www.mailgun.com) and create a domain

4. **n8n**: Self-host or use n8n cloud, create a webhook trigger node

---

## Known Limitations & Not Working

### Limitations

1. **Email Required for Direct Outreach**
   - Businesses scraped from Google often don't have email addresses
   - Email must be manually added or use n8n to enrich data

2. **PageSpeed API Rate Limits**
   - Without API key: ~25 requests/day
   - With API key: ~25,000 requests/day
   - Batch audits may hit limits

3. **SQLite Database**
   - Single file database
   - Not suitable for production at scale
   - Consider migrating to PostgreSQL for production

4. **PDF Export**
   - Opens browser print dialog
   - User must manually save as PDF
   - No true server-side PDF generation

5. **No Email Tracking**
   - Opens/clicks not tracked (would need Mailgun webhooks)
   - Status updates are manual

### Not Implemented

1. **Clear All Data Button**
   - Shows "Feature not implemented" toast
   - Use `npx prisma db push --force-reset` instead

2. **Email Enrichment**
   - No automatic email finding
   - Would need additional API (Hunter.io, etc.)

3. **Webhook Status Updates**
   - Mailgun webhooks not configured
   - n8n response handling not implemented

4. **User Authentication**
   - No login system
   - Designed for single-user/local use

5. **Schedule/Automation**
   - No built-in scheduling
   - Use n8n or cron jobs externally

---

## Running the Application

```bash
# Install dependencies
pnpm install

# Initialize database
npx prisma db push

# Start development server
pnpm dev

# Build for production
pnpm build
pnpm preview
```

---

## File Structure

```
├── app/
│   ├── components/
│   │   ├── ApprovalQueue.vue      # Queue table component
│   │   ├── AuditGauge.vue         # Circular score gauge
│   │   ├── AuditProgress.vue      # Audit progress modal
│   │   ├── AuditReport.vue        # Audit results display
│   │   ├── AuditReportExport.vue  # NEW - Export dropdown
│   │   ├── BusinessTable.vue      # Main business table
│   │   ├── EmailTemplateEditor.vue # Template form
│   │   ├── ExportMenu.vue         # Export dropdown menu
│   │   ├── LeadScoreBadge.vue     # Score badge
│   │   ├── SearchForm.vue         # Search input form
│   │   └── StatusBadge.vue        # Status badge
│   ├── composables/
│   │   └── useAudit.ts            # Audit state management
│   ├── pages/
│   │   ├── index.vue              # Dashboard
│   │   ├── businesses/
│   │   │   ├── index.vue          # All businesses
│   │   │   └── [id].vue           # Business detail
│   │   ├── queue.vue              # Approval queue
│   │   ├── templates.vue          # Email templates
│   │   └── settings.vue           # Settings
│   └── assets/css/main.css        # Global styles
├── server/
│   ├── api/
│   │   ├── audit/batch.post.ts    # Batch audit
│   │   ├── businesses/            # Business CRUD
│   │   ├── export/                # CSV, JSON, n8n exports
│   │   ├── outreach/              # Email sending
│   │   ├── report/                # NEW - Report generation
│   │   ├── search/                # Business search
│   │   └── templates/             # Template CRUD
│   └── utils/
│       ├── lead-scorer.ts         # Scoring algorithm
│       ├── mailgun.ts             # Mailgun client
│       ├── openweb-ninja.ts       # RapidAPI client
│       ├── pagespeed.ts           # PageSpeed client
│       ├── prisma.ts              # Database client
│       └── report-generator.ts    # NEW - Report builder
├── shared/types/index.ts          # TypeScript types
├── prisma/schema.prisma           # Database schema
└── nuxt.config.ts                 # Nuxt configuration
```

---

*Documentation last updated: December 2024*
*Version: 1.0.0 with Audit Report Export Feature*

