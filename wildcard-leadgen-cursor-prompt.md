# Wild Card Lead Gen & Site Auditor - Cursor Prompt

## Project Overview

Build a lead generation and website auditing application for Wild Card Creative Co. The app scrapes local business data, audits their websites for performance/SEO issues, scores and categorizes leads, and integrates with n8n for automated email outreach.

**Business Goal:** Find local businesses that either need a website or have a poorly performing one, then automate personalized outreach pitches.

**Company:** Wild Card Creative Co.  
**Website:** https://www.wildcardcreativeco.com/  
**Location:** (Northwest Indiana)

---

## AI Development Setup

### MCP Server Configuration

Create `.cursor/mcp.json` in your project root for enhanced AI assistance:

```json
{
  "mcpServers": {
    "nuxt": {
      "url": "https://mcp.nuxt.com/sse"
    },
    "nuxt-ui": {
      "type": "http",
      "url": "https://ui.nuxt.com/mcp"
    }
  }
}
```

### LLMs.txt References

When asking questions, reference these URLs for up-to-date documentation:

- **Nuxt 4 Docs:** https://nuxt.com/llms.txt (overview) or https://nuxt.com/llms-full.txt (comprehensive)
- **Nuxt UI Docs:** https://ui.nuxt.com/llms.txt or https://ui.nuxt.com/llms-full.txt

Example prompts:
- "Using Nuxt documentation from https://nuxt.com/llms.txt, help me set up..."
- "Follow Nuxt UI guidelines from https://ui.nuxt.com/llms.txt for this component..."

---

## Tech Stack

- **Framework:** Nuxt 4 (Vue 3 + Nitro server)
- **UI Library:** Nuxt UI v3 (includes Tailwind CSS)
- **Database:** SQLite with Prisma ORM
- **APIs:**
  - OpenWeb Ninja (Local Business Data) via RapidAPI
  - Google PageSpeed Insights API (free)
- **Email:** Mailgun API (free tier: 100/day permanently)
- **Automation:** n8n webhook integration

---

## Environment Variables

```env
# .env
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=local-business-data.p.rapidapi.com

# Optional - PageSpeed works without key but has rate limits
GOOGLE_PAGESPEED_API_KEY=optional_key_here

# Mailgun (for email integration)
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=outreach.wildcardcreativeco.com

# n8n Webhook
N8N_WEBHOOK_URL=your_n8n_webhook_url
```

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Search {
  id          String     @id @default(cuid())
  query       String     // e.g., "restaurants"
  location    String     // e.g., "Gary, Indiana"
  createdAt   DateTime   @default(now())
  businesses  Business[]
}

model Business {
  id              String    @id @default(cuid())
  searchId        String
  search          Search    @relation(fields: [searchId], references: [id], onDelete: Cascade)
  
  // Basic Info (from OpenWeb Ninja)
  name            String
  address         String?
  city            String?
  state           String?
  zipCode         String?
  phone           String?
  website         String?   // null = HOT LEAD (needs website)
  email           String?   // scraped from website or enriched
  googleMapsUrl   String?
  placeId         String?   @unique
  
  // Business Details
  category        String?
  rating          Float?
  reviewCount     Int?
  priceLevel      String?
  
  // Audit Results
  audit           Audit?
  
  // Lead Scoring
  leadScore       Int       @default(0)  // 0-100
  leadCategory    String?   // "hot", "warm", "cold", "skip"
  
  // Outreach Status
  status          String    @default("new") // "new", "approved", "sent", "responded", "rejected"
  approvedAt      DateTime?
  sentAt          DateTime?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Audit {
  id                    String   @id @default(cuid())
  businessId            String   @unique
  business              Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  // PageSpeed Scores (0-100)
  performanceScore      Int?
  accessibilityScore    Int?
  bestPracticesScore    Int?
  seoScore              Int?
  
  // Core Web Vitals
  firstContentfulPaint  String?  // e.g., "1.2 s"
  largestContentfulPaint String?
  totalBlockingTime     String?
  cumulativeLayoutShift String?
  speedIndex            String?
  
  // Custom Checks
  isMobileResponsive    Boolean?
  hasSSL                Boolean?
  hasMissingMetaTags    Boolean?
  
  // Tech Detection
  detectedPlatform      String?  // "WordPress", "Wix", "Squarespace", "Custom", etc.
  
  // Raw data storage
  rawLighthouseJson     String?  // Store full response for detailed reports
  
  auditedAt             DateTime @default(now())
}

model EmailTemplate {
  id          String   @id @default(cuid())
  name        String   // "no_website", "poor_performance", "poor_seo"
  subject     String
  body        String   // Supports {{variables}}
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model OutreachLog {
  id          String   @id @default(cuid())
  businessId  String
  templateId  String
  emailTo     String
  subject     String
  status      String   // "sent", "delivered", "opened", "clicked", "bounced", "failed"
  sentAt      DateTime @default(now())
  messageId   String?  // Mailgun message ID for tracking
}
```

---

## Project Structure (Nuxt 4)

Nuxt 4 uses the new `app/` directory structure for cleaner organization:

```
wildcard-leadgen/
├── .cursor/
│   └── mcp.json                     # MCP server config for AI assistance
├── nuxt.config.ts
├── package.json
├── .env
├── prisma/
│   └── schema.prisma
├── app/                             # NEW in Nuxt 4 - all app code goes here
│   ├── assets/
│   ├── components/
│   │   ├── SearchForm.vue           # City, category, count inputs
│   │   ├── BusinessCard.vue         # Individual business display
│   │   ├── BusinessTable.vue        # Sortable/filterable table
│   │   ├── AuditReport.vue          # Visual audit results
│   │   ├── AuditGauge.vue           # Score gauge component
│   │   ├── LeadScoreBadge.vue       # Score visualization
│   │   ├── StatusBadge.vue          # Outreach status
│   │   ├── ApprovalQueue.vue        # Review queue component
│   │   ├── ExportMenu.vue           # Export options dropdown
│   │   ├── ProgressBar.vue          # Audit progress indicator
│   │   └── EmailTemplateEditor.vue  # Template CRUD
│   ├── composables/
│   │   ├── useSearch.ts             # Search state management
│   │   ├── useBusinesses.ts         # Business CRUD
│   │   └── useAudit.ts              # Audit operations
│   ├── layouts/
│   │   └── default.vue
│   ├── pages/
│   │   ├── index.vue                # Dashboard / Search
│   │   ├── businesses/
│   │   │   ├── index.vue            # All businesses list
│   │   │   └── [id].vue             # Business detail + audit
│   │   ├── queue.vue                # Approval queue
│   │   ├── templates.vue            # Email templates
│   │   └── settings.vue             # API keys, config
│   ├── plugins/
│   ├── utils/
│   ├── app.vue
│   └── app.config.ts
├── server/
│   ├── api/
│   │   ├── search/
│   │   │   └── index.post.ts        # Search for businesses
│   │   ├── businesses/
│   │   │   ├── index.get.ts         # List all businesses
│   │   │   ├── [id].get.ts          # Get single business
│   │   │   ├── [id].patch.ts        # Update status/approval
│   │   │   └── [id]/
│   │   │       └── audit.post.ts    # Trigger audit for single business
│   │   ├── audit/
│   │   │   └── batch.post.ts        # Audit multiple businesses
│   │   ├── export/
│   │   │   ├── csv.get.ts           # Export to CSV
│   │   │   ├── json.get.ts          # Export to JSON
│   │   │   └── n8n.post.ts          # Send to n8n webhook
│   │   ├── templates/
│   │   │   ├── index.get.ts         # List templates
│   │   │   ├── index.post.ts        # Create template
│   │   │   └── [id].patch.ts        # Update template
│   │   └── outreach/
│   │       └── send.post.ts         # Send emails via Mailgun
│   └── utils/
│       ├── openweb-ninja.ts         # RapidAPI client
│       ├── pagespeed.ts             # Google PageSpeed client
│       ├── lead-scorer.ts           # Scoring logic
│       └── mailgun.ts               # Mailgun client
├── shared/                          # NEW in Nuxt 4 - code shared between app and server
│   └── types/
│       └── index.ts                 # TypeScript interfaces
└── public/
```

---

## Nuxt Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // Nuxt 4 is now the default, no compatibility flag needed
  
  modules: [
    '@nuxt/ui',
    '@prisma/nuxt',  // or use manual prisma setup
  ],

  // Nuxt UI v3 includes Tailwind, no separate config needed
  ui: {
    // Customize theme if needed
  },

  runtimeConfig: {
    rapidApiKey: process.env.RAPIDAPI_KEY,
    rapidApiHost: process.env.RAPIDAPI_HOST,
    googlePageSpeedApiKey: process.env.GOOGLE_PAGESPEED_API_KEY,
    mailgunApiKey: process.env.MAILGUN_API_KEY,
    mailgunDomain: process.env.MAILGUN_DOMAIN,
    n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
  },

  devtools: { enabled: true },
})
```

---

## API Implementations

### 1. OpenWeb Ninja - Business Search

```typescript
// server/utils/openweb-ninja.ts

interface BusinessSearchParams {
  query: string
  location: string
  limit?: number
}

interface OpenWebBusiness {
  name: string
  full_address: string
  city: string
  state: string
  postal_code: string
  phone_number: string
  website: string | null
  place_id: string
  google_maps_url: string
  rating: number
  review_count: number
  price_level: string
  types: string[]
}

export async function searchBusinesses(params: BusinessSearchParams): Promise<OpenWebBusiness[]> {
  const config = useRuntimeConfig()
  
  const response = await fetch(
    `https://local-business-data.p.rapidapi.com/search?` + new URLSearchParams({
      query: params.query,
      location: params.location,
      limit: String(params.limit || 10)
    }),
    {
      headers: {
        'X-RapidAPI-Key': config.rapidApiKey,
        'X-RapidAPI-Host': 'local-business-data.p.rapidapi.com'
      }
    }
  )
  
  if (!response.ok) {
    throw new Error(`OpenWeb Ninja API error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.data || []
}
```

### 2. Google PageSpeed Insights

```typescript
// server/utils/pagespeed.ts

interface PageSpeedResult {
  performanceScore: number
  accessibilityScore: number
  bestPracticesScore: number
  seoScore: number
  firstContentfulPaint: string
  largestContentfulPaint: string
  totalBlockingTime: string
  cumulativeLayoutShift: string
  speedIndex: string
  rawJson: string
}

export async function auditWebsite(url: string): Promise<PageSpeedResult> {
  // Ensure URL has protocol
  const fullUrl = url.startsWith('http') ? url : `https://${url}`
  
  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  apiUrl.searchParams.set('url', fullUrl)
  apiUrl.searchParams.set('category', 'performance')
  apiUrl.searchParams.set('category', 'accessibility')
  apiUrl.searchParams.set('category', 'best-practices')
  apiUrl.searchParams.set('category', 'seo')
  apiUrl.searchParams.set('strategy', 'mobile') // Mobile-first
  
  const config = useRuntimeConfig()
  if (config.googlePageSpeedApiKey) {
    apiUrl.searchParams.set('key', config.googlePageSpeedApiKey)
  }
  
  const response = await fetch(apiUrl.toString())
  
  if (!response.ok) {
    throw new Error(`PageSpeed API error: ${response.status}`)
  }
  
  const data = await response.json()
  const lighthouse = data.lighthouseResult
  const categories = lighthouse.categories
  const audits = lighthouse.audits
  
  return {
    performanceScore: Math.round((categories.performance?.score || 0) * 100),
    accessibilityScore: Math.round((categories.accessibility?.score || 0) * 100),
    bestPracticesScore: Math.round((categories['best-practices']?.score || 0) * 100),
    seoScore: Math.round((categories.seo?.score || 0) * 100),
    firstContentfulPaint: audits['first-contentful-paint']?.displayValue || 'N/A',
    largestContentfulPaint: audits['largest-contentful-paint']?.displayValue || 'N/A',
    totalBlockingTime: audits['total-blocking-time']?.displayValue || 'N/A',
    cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue || 'N/A',
    speedIndex: audits['speed-index']?.displayValue || 'N/A',
    rawJson: JSON.stringify(data)
  }
}
```

### 3. Lead Scoring Logic

```typescript
// server/utils/lead-scorer.ts

interface ScoringInput {
  hasWebsite: boolean
  performanceScore?: number
  seoScore?: number
  accessibilityScore?: number
  isMobileResponsive?: boolean
  hasSSL?: boolean
  reviewCount?: number
  rating?: number
}

interface ScoringResult {
  score: number          // 0-100
  category: 'hot' | 'warm' | 'cold' | 'skip'
  reasons: string[]
}

export function calculateLeadScore(input: ScoringInput): ScoringResult {
  let score = 0
  const reasons: string[] = []
  
  // NO WEBSITE = Hottest lead
  if (!input.hasWebsite) {
    score = 95
    reasons.push('No website - needs new site')
    return { score, category: 'hot', reasons }
  }
  
  // Has website - score based on quality
  let websiteScore = 0
  
  // Performance (weight: 30%)
  if (input.performanceScore !== undefined) {
    if (input.performanceScore < 50) {
      websiteScore += 30
      reasons.push(`Poor performance score: ${input.performanceScore}`)
    } else if (input.performanceScore < 70) {
      websiteScore += 15
      reasons.push(`Mediocre performance: ${input.performanceScore}`)
    }
  }
  
  // SEO (weight: 30%)
  if (input.seoScore !== undefined) {
    if (input.seoScore < 50) {
      websiteScore += 30
      reasons.push(`Poor SEO score: ${input.seoScore}`)
    } else if (input.seoScore < 70) {
      websiteScore += 15
      reasons.push(`Mediocre SEO: ${input.seoScore}`)
    }
  }
  
  // Mobile (weight: 20%)
  if (input.isMobileResponsive === false) {
    websiteScore += 20
    reasons.push('Not mobile responsive')
  }
  
  // SSL (weight: 10%)
  if (input.hasSSL === false) {
    websiteScore += 10
    reasons.push('No SSL certificate')
  }
  
  // Accessibility (weight: 10%)
  if (input.accessibilityScore !== undefined && input.accessibilityScore < 50) {
    websiteScore += 10
    reasons.push(`Poor accessibility: ${input.accessibilityScore}`)
  }
  
  // Business credibility bonus (good reviews = worth pursuing)
  if (input.reviewCount && input.reviewCount > 20 && input.rating && input.rating >= 4) {
    websiteScore += 10
    reasons.push('Established business with good reviews')
  }
  
  score = Math.min(websiteScore, 90) // Cap at 90 for businesses with websites
  
  // Categorize
  let category: 'hot' | 'warm' | 'cold' | 'skip'
  if (score >= 70) {
    category = 'hot'
  } else if (score >= 40) {
    category = 'warm'
  } else if (score >= 20) {
    category = 'cold'
  } else {
    category = 'skip'
    reasons.push('Website is decent - low priority')
  }
  
  return { score, category, reasons }
}
```

---

## Key UI Components (using Nuxt UI v3)

### SearchForm.vue
- Use `UInput` for city/location and category/query
- Use `USelect` for number of results (5, 10, 20)
- Use `UButton` with loading state for "Search & Audit"
- Use `UProgress` for audit progress

### BusinessTable.vue
- Use `UTable` with sortable columns
- Columns: Name, Category, Website (yes/no), Lead Score, Status, Actions
- Use `UBadge` for status indicators
- Filterable by category (hot/warm/cold) using `USelect`

### AuditReport.vue
- Use `UMeter` or custom gauge for Performance, SEO, Accessibility, Best Practices scores
- Use `UCard` for Core Web Vitals breakdown
- Use `UAlert` for critical issues

### ApprovalQueue.vue
- Use `UCard` for each pending lead
- Use `UButtonGroup` for approve/reject actions
- Use `UModal` for email preview before sending

---

## n8n Integration

### Webhook Payload Structure

```typescript
// Sent to n8n when leads are approved and ready for outreach

interface N8nWebhookPayload {
  action: 'send_outreach'
  leads: Array<{
    id: string
    businessName: string
    email: string
    phone: string | null
    website: string | null
    leadCategory: 'hot' | 'warm' | 'cold'
    leadScore: number
    pitchType: 'new_website' | 'website_improvement'
    issues: string[]  // Specific problems to mention in email
    audit?: {
      performanceScore: number
      seoScore: number
      accessibilityScore: number
    }
  }>
  template: {
    id: string
    subject: string
    body: string
  }
}
```

### n8n Workflow Outline

1. **Webhook Trigger** - Receives payload from app
2. **Loop** - Iterate through leads array
3. **Switch** - Route by pitchType (new_website vs improvement)
4. **Template** - Replace {{variables}} in email
5. **Mailgun Node** - Send email
6. **HTTP Request** - Callback to app to update status

---

## Email Templates (Default)

### Template 1: No Website

**Subject:** `Quick question about {{businessName}}'s online presence`

**Body:**
```
Hi there,

I was looking for {{category}} businesses in {{city}} and came across {{businessName}}. I noticed you don't currently have a website, and I wanted to reach out because I help local businesses like yours get online.

A simple, professional website can help you:
- Show up when people search for "{{category}} in {{city}}"
- Give customers a way to learn about your services 24/7
- Build credibility with reviews and photos

I'm Ryan with Wild Card Creative, a local web design company. I'd love to chat for 15 minutes about what a website could do for your business - no pressure, just an honest conversation.

Would you be open to a quick call this week?

Best,
Ryan
Wild Card Creative Co.
https://www.wildcardcreativeco.com/
```

### Template 2: Poor Website Performance

**Subject:** `Your website might be losing you customers`

**Body:**
```
Hi,

I recently came across {{businessName}}'s website and noticed a few things that might be hurting your business:

{{#issues}}
- {{.}}
{{/issues}}

These issues can cause visitors to leave before they even see what you offer. In fact, {{performanceScore}}% performance means your site loads slower than most websites.

I'm Ryan with Wild Card Creative, and I specialize in helping local businesses fix exactly these problems. I'd be happy to put together a quick report showing what's slowing things down and how to fix it - completely free.

Interested?

Best,
Ryan
Wild Card Creative Co.
https://www.wildcardcreativeco.com/
```

---

## Export Options

1. **CSV** - All fields, for spreadsheets
2. **JSON** - Full data, for developers/n8n
3. **PDF Report** - Pretty formatted audit report (future)
4. **Direct to n8n** - POST to webhook URL
5. **Copy to Clipboard** - Quick sharing

---

## Implementation Order

### Phase 1: Core Search & Audit
1. Set up Nuxt 4 project with Nuxt UI
2. Configure Prisma with SQLite
3. Set up MCP server config in `.cursor/mcp.json`
4. Implement OpenWeb Ninja search endpoint
5. Implement PageSpeed audit endpoint
6. Build SearchForm and BusinessTable components
7. Basic CRUD for businesses

### Phase 2: Scoring & Categorization
1. Implement lead scoring logic
2. Add scoring to audit flow
3. Build LeadScoreBadge and category filters
4. Create detail view with full audit report

### Phase 3: Approval Queue
1. Build ApprovalQueue component
2. Add status management
3. Implement bulk actions

### Phase 4: Export & Integration
1. CSV/JSON export endpoints
2. n8n webhook integration
3. Email template CRUD
4. Mailgun integration

### Phase 5: Polish
1. Progress indicators for long operations
2. Error handling and retry logic
3. Settings page for API keys
4. Dashboard with stats

---

## Notes for Development

- PageSpeed API takes 10-30 seconds per URL. Show progress and process sequentially.
- OpenWeb Ninja free tier has limits - cache results in database.
- Some businesses won't have emails - phone outreach may be needed.
- Consider rate limiting your own searches to avoid API costs.
- Store raw API responses for debugging and future feature extraction.
- Use Nuxt 4's `shared/` directory for types used in both app and server code.
- Nuxt 4 data fetching: `useAsyncData` and `useFetch` now return `undefined` instead of `null` by default.

---

## Commands to Get Started

```bash
# Create Nuxt 4 project
npx nuxi@latest init wildcard-leadgen
cd wildcard-leadgen

# Add dependencies
npm install @prisma/client
npm install -D prisma

# Add Nuxt UI (includes Tailwind)
npx nuxi@latest module add @nuxt/ui

# Initialize Prisma
npx prisma init --datasource-provider sqlite

# After adding schema
npx prisma db push
npx prisma generate

# Create MCP config for Cursor
mkdir -p .cursor
echo '{
  "mcpServers": {
    "nuxt": {
      "url": "https://mcp.nuxt.com/sse"
    },
    "nuxt-ui": {
      "type": "http",
      "url": "https://ui.nuxt.com/mcp"
    }
  }
}' > .cursor/mcp.json
```

---

## Cursor AI Tips

1. **Reference the MCP servers** - After setting up `.cursor/mcp.json`, Cursor will have direct access to current Nuxt 4 and Nuxt UI documentation.

2. **Use llms.txt for complex questions** - For detailed implementation questions, explicitly reference:
   - `https://nuxt.com/llms-full.txt` for comprehensive Nuxt docs
   - `https://ui.nuxt.com/llms-full.txt` for all Nuxt UI components

3. **Component help** - Ask Cursor things like:
   - "Using the Nuxt UI MCP server, show me how to use UTable with sorting"
   - "What props does UProgress accept?"

4. **Nuxt 4 specifics** - Remember the key Nuxt 4 changes:
   - App code lives in `app/` directory
   - Shared types go in `shared/`
   - `useAsyncData`/`useFetch` return `undefined` not `null`
   - Component names are standardized (folder + file name)
