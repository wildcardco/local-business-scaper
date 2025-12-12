# Wild Card Lead Gen & Site Auditor

A lead generation and website auditing application for Wild Card Creative Co. Find local businesses that need websites or have poorly performing ones, then automate personalized outreach.

## Features

- **🔐 Authentication**: Secure user registration and login with session management
- **🔍 Business Search**: Search local businesses via RapidAPI's Local Business Data
- **📊 Website Auditing**: Comprehensive audits using Google PageSpeed Insights
- **🎯 Lead Scoring**: Automatically score and categorize leads (Hot/Warm/Cold/Skip)
- **✅ Approval Queue**: Review and approve leads before outreach
- **📧 AI Email Generation**: Generate personalized outreach emails with Groq AI
- **📝 Email Templates**: Customizable templates with variable support
- **📤 Email Outreach**: Send emails via Resend with reply tracking
- **💬 Inbox Management**: Track email threads and replies
- **🎨 Branding Settings**: Customize company info, logos, and email appearance
- **📥 Export**: Export to CSV, JSON, or send to n8n webhooks
- **🔑 Password Management**: Change password in settings
- **☁️ Cloud Database**: Turso (LibSQL) for edge-hosted, globally distributed data

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3 + Nitro)
- **UI**: Nuxt UI v4 (Tailwind CSS)
- **Database**: Turso (LibSQL) - Edge-hosted SQLite
- **APIs**: RapidAPI (Local Business Data), Google PageSpeed Insights, Groq AI
- **Email**: Resend
- **Authentication**: nuxt-auth-utils
- **Image Upload**: ImageKit
- **Automation**: n8n webhook integration

## Setup

### Local Development

1. **Clone and install dependencies**:

```bash
git clone <your-repo>
cd local-business-scraper
npm install
```

2. **Configure environment variables**:

Create a `.env` file in the root directory:

```bash
# Local development database (uses this automatically)
DATABASE_URL=file:dev.db

# Production database (Vercel uses these)
# Get from: turso db create local-business-scraper
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_KEY=your-turso-auth-token

# Session password (required)
# Generate with: openssl rand -base64 32
NUXT_SESSION_PASSWORD=your-random-32-char-string

# API keys (required for features)
RAPIDAPI_KEY=your_rapidapi_key
RESEND_API_KEY=your_resend_key
GROQ_API=your_groq_key
GOOGLE_PAGESPEED_API_KEY=your_google_key
```

**Note**: The app automatically uses local SQLite (`dev.db`) in development and Turso in production.

3. **Start the development server**:

```bash
npm run dev
```

The database will be automatically initialized on startup.

4. **Create your first user**:

- Open [http://localhost:3000](http://localhost:3000)
- Go to `/register` and create an account
- Start searching for businesses!

### Production Deployment

For deploying to Vercel with Turso database, see the comprehensive **[DEPLOYMENT.md](./DEPLOYMENT.md)** guide.

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
local-business-scraper/
├── app/
│   ├── components/          # Vue components
│   ├── composables/         # Vue composables
│   ├── pages/               # Route pages
│   ├── layouts/             # Page layouts
│   ├── middleware/          # Route middleware
│   └── assets/css/          # Styles
├── server/
│   ├── api/                 # API endpoints
│   │   ├── auth/           # Authentication
│   │   ├── businesses/     # Business CRUD
│   │   ├── audit/          # Website audits
│   │   ├── emails/         # Email generation
│   │   ├── outreach/       # Email sending
│   │   ├── templates/      # Email templates
│   │   └── export/         # Data export
│   ├── middleware/         # Server middleware
│   ├── plugins/            # Server plugins
│   └── utils/              # Server utilities
│       ├── db.ts           # Database connection
│       ├── schema.ts       # Database schema
│       ├── auth.ts         # Auth helpers
│       └── ...             # Other utilities
├── shared/
│   └── types/              # Shared TypeScript types
├── public/
│   └── brand-assets/       # Company branding
├── DEPLOYMENT.md           # Deployment guide
└── .env.example            # Environment variables template
```

## API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login user |
| `/api/auth/logout` | POST | Logout user |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/change-password` | POST | Change password |

### Businesses
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | POST | Search for businesses |
| `/api/businesses` | GET | List all businesses |
| `/api/businesses/[id]` | GET/PATCH | Get/update business |
| `/api/businesses/[id]/audit` | POST | Run website audit |
| `/api/businesses/[id]/scrape-contacts` | POST | Scrape contact info |
| `/api/businesses/delete` | POST | Delete businesses (batch) |
| `/api/audit/batch` | POST | Batch audit multiple businesses |

### Email & Outreach
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/templates` | GET/POST | List/create email templates |
| `/api/templates/[id]` | PATCH/DELETE | Update/delete template |
| `/api/templates/seed` | POST | Seed default templates |
| `/api/emails/generate` | POST | Generate AI email |
| `/api/emails/webhook` | POST | Handle email webhooks |
| `/api/drafts` | GET/POST | List/create email drafts |
| `/api/drafts/[id]` | GET/DELETE | Get/delete draft |
| `/api/outreach/send` | POST | Send single email |
| `/api/outreach/bulk` | POST | Send bulk emails |
| `/api/outreach/logs` | GET | Get outreach logs |
| `/api/inbox/threads` | GET | Get email threads |
| `/api/inbox/[id]` | GET | Get thread details |

### Export & Reports
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/export/csv` | GET | Export to CSV |
| `/api/export/json` | GET | Export to JSON |
| `/api/export/n8n` | POST | Send to n8n webhook |
| `/api/report/[id]` | GET | Get audit report |
| `/api/report/batch` | POST | Batch generate reports |
| `/api/report/email` | POST | Email report |
| `/api/report/n8n` | POST | Send report to n8n |

### Settings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/branding` | GET/POST | Get/update branding |
| `/api/imagekit/auth` | GET | Get ImageKit auth |
| `/api/autocomplete` | GET | Search autocomplete |

## Company

**Wild Card Creative Co.**  
Website: [https://www.wildcardcreativeco.com/](https://www.wildcardcreativeco.com/)  
Location: Northwest Indiana
