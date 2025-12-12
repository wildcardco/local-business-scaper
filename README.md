# Wild Card Lead Gen & Site Auditor

A lead generation and website auditing application for Wild Card Creative Co. Find local businesses that need websites or have poorly performing ones, then automate personalized outreach.

## Features

- **Business Search**: Search local businesses via RapidAPI's Local Business Data
- **Website Auditing**: Audit websites using Google PageSpeed Insights
- **Lead Scoring**: Automatically score and categorize leads (Hot/Warm/Cold/Skip)
- **Approval Queue**: Review and approve leads before outreach
- **Email Templates**: Customizable email templates with variable support
- **Export**: Export to CSV, JSON, or send directly to n8n webhooks
- **Outreach**: Send emails via Mailgun integration

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3 + Nitro)
- **UI**: Nuxt UI v3 (Tailwind CSS)
- **Database**: SQLite + Prisma ORM
- **APIs**: RapidAPI (Local Business Data), Google PageSpeed Insights
- **Email**: Mailgun
- **Automation**: n8n webhook integration

## Setup

1. **Clone and install dependencies**:

```bash
cd wildcard-leadgen
npm install
```

2. **Configure environment variables**:

Copy `.env.example` to `.env` and fill in your API keys:

```bash
# RapidAPI - Local Business Data
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=local-business-data.p.rapidapi.com

# Google PageSpeed Insights (optional - works without key but has rate limits)
GOOGLE_PAGESPEED_API_KEY=optional_key_here

# Mailgun (for email integration)
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=outreach.wildcardcreativeco.com

# n8n Webhook
N8N_WEBHOOK_URL=your_n8n_webhook_url

# Database
DATABASE_URL="file:./dev.db"
```

3. **Initialize the database**:

```bash
npx prisma db push
npx prisma generate
```

4. **Start the development server**:

```bash
npm run dev
```

5. **Open the app** at [http://localhost:3000](http://localhost:3000)

## Usage

### 1. Search for Businesses

- Go to the Dashboard
- Enter a business type (e.g., "restaurants") and location (e.g., "Gary, Indiana")
- Click "Search & Score"
- Results will be automatically scored based on whether they have a website

### 2. Audit Websites

- From the business list or detail page, click "Run Audit"
- The audit will run Google PageSpeed Insights and update the lead score
- Businesses without websites are automatically marked as "Hot" leads

### 3. Review and Approve

- Go to the Approval Queue
- Review leads sorted by score
- Approve or reject leads for outreach

### 4. Set Up Email Templates

- Go to Templates
- Click "Add Default Templates" or create your own
- Templates support variables like `{{businessName}}`, `{{category}}`, etc.

### 5. Export or Send Outreach

- Use the Export menu to download CSV/JSON
- Or send approved leads to n8n for automated email campaigns

## Lead Scoring Logic

| Condition | Score |
|-----------|-------|
| No website | 95 (Hot) |
| Performance < 50 | +30 |
| SEO < 50 | +30 |
| Performance 50-70 | +15 |
| SEO 50-70 | +15 |
| No SSL | +10 |
| Accessibility < 50 | +10 |
| Good reviews (4+ rating, 20+ reviews) | +10 |

**Categories**:
- **Hot**: Score ≥ 70
- **Warm**: Score 40-69
- **Cold**: Score 20-39
- **Skip**: Score < 20

## Project Structure

```
wildcard-leadgen/
├── app/
│   ├── components/          # Vue components
│   ├── pages/               # Route pages
│   └── assets/css/          # Styles
├── server/
│   ├── api/                 # API endpoints
│   └── utils/               # Server utilities
├── prisma/
│   └── schema.prisma        # Database schema
└── shared/
    └── types/               # Shared TypeScript types
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | POST | Search for businesses |
| `/api/businesses` | GET | List all businesses |
| `/api/businesses/[id]` | GET/PATCH | Get/update business |
| `/api/businesses/[id]/audit` | POST | Run website audit |
| `/api/audit/batch` | POST | Batch audit multiple businesses |
| `/api/templates` | GET/POST | List/create email templates |
| `/api/templates/[id]` | PATCH/DELETE | Update/delete template |
| `/api/export/csv` | GET | Export to CSV |
| `/api/export/json` | GET | Export to JSON |
| `/api/export/n8n` | POST | Send to n8n webhook |
| `/api/outreach/send` | POST | Send single email |
| `/api/outreach/bulk` | POST | Send bulk emails |

## Company

**Wild Card Creative Co.**  
Website: [https://www.wildcardcreativeco.com/](https://www.wildcardcreativeco.com/)  
Location: Northwest Indiana
