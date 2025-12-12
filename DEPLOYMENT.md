# Deployment Guide for Vercel

This guide will help you deploy your Local Business Scraper application to Vercel with Turso database.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Turso Account**: Sign up at [turso.tech](https://turso.tech)
3. **GitHub Repository**: Your code should be in a GitHub repository

## Step 1: Set Up Turso Database

### Install Turso CLI
```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (PowerShell)
irm get.tur.so/install.ps1 | iex
```

### Create Database
```bash
# Login to Turso
turso auth login

# Create a new database
turso db create local-business-scraper

# Get the database URL
turso db show local-business-scraper --url

# Create an auth token
turso db tokens create local-business-scraper
```

**Save these values** - you'll need them for Vercel:
- Database URL (starts with `libsql://`)
- Auth Token (long string)

## Step 2: Configure Vercel Project

### Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure the project:
   - **Framework Preset**: Nuxt.js (auto-detected)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.output` (auto-detected)

### Set Environment Variables

In your Vercel project settings, add these environment variables:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NUXT_SESSION_PASSWORD` | Random 32+ character string | Generate with `openssl rand -base64 32` |
| `TURSO_DB_URL` | Your Turso database URL | `libsql://your-db.turso.io` |
| `TURSO_KEY` | Your Turso auth token | `eyJhbGc...` (from Turso) |

#### API Keys (Required for full functionality)

| Variable | Description | Get From |
|----------|-------------|----------|
| `RAPIDAPI_KEY` | Local Business Data API | [RapidAPI Hub](https://rapidapi.com/hub) |
| `GOOGLE_PAGESPEED_API_KEY` | PageSpeed Insights API | [Google Cloud Console](https://console.cloud.google.com/) |
| `RESEND_API_KEY` | Email sending service | [Resend Dashboard](https://resend.com/api-keys) |
| `GROQ_API` | AI email generation | [Groq Console](https://console.groq.com/) |

#### Optional Variables

| Variable | Description | Get From |
|----------|-------------|----------|
| `N8N_WEBHOOK_URL` | Automation webhooks | Your n8n instance |
| `IMAGE_KIT_URL` | Image CDN endpoint | [ImageKit Dashboard](https://imagekit.io/) |
| `IMAGE_KIT_PUBLIC_KEY` | ImageKit public key | ImageKit Dashboard |
| `IMAGE_KIT_PRIVATE_KEY` | ImageKit private key | ImageKit Dashboard |
| `RAPIDAPI_HOST` | RapidAPI hostname | `local-business-data.p.rapidapi.com` |

### Adding Environment Variables in Vercel

1. Go to your project → **Settings** → **Environment Variables**
2. Add each variable with its value
3. Select which environments (Production, Preview, Development)
4. Click **Save**

## Step 3: Deploy

### Initial Deployment

After adding environment variables:
1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Check the deployment logs for any errors

### Automatic Deployments

- **Production**: Every push to `main` branch
- **Preview**: Every pull request or push to other branches

## Step 4: Initialize Database

The database schema will be automatically initialized on the first deployment. The Nitro plugin (`server/plugins/db.ts`) runs the schema initialization on server startup.

To verify:
1. Check deployment logs for "✅ Database schema initialized"
2. If you see errors, check your Turso credentials

## Step 5: Create First User

After deployment, visit your Vercel URL and:
1. Go to `/register`
2. Create your first admin account
3. Login and start using the application

## Troubleshooting

### Database Connection Errors

**Error**: "Failed to initialize database"
- **Solution**: Verify `TURSO_DB_URL` and `TURSO_KEY` are correct
- Run `turso db show local-business-scraper` to verify database exists

### Session Errors

**Error**: "Session password must be at least 32 characters"
- **Solution**: Generate a new session password:
  ```bash
  openssl rand -base64 32
  ```
  Add it as `NUXT_SESSION_PASSWORD` in Vercel

### API Errors

**Error**: "API key not configured"
- **Solution**: Add the required API keys in Vercel environment variables
- Make sure you've enabled the APIs in their respective dashboards

### Build Errors

**Error**: Build fails with TypeScript errors
- **Solution**: Run `npm run build` locally first to catch errors
- Fix any TypeScript issues before deploying

## Monitoring

### Vercel Analytics

Enable in your Vercel project:
1. **Analytics** → Enable Web Analytics
2. **Speed Insights** → Enable Speed Insights

### Database Monitoring

Monitor your Turso database:
```bash
# Check database stats
turso db show local-business-scraper

# View recent operations
turso db inspect local-business-scraper
```

## Updating Environment Variables

To update variables after deployment:
1. Go to **Settings** → **Environment Variables**
2. Click on the variable to edit
3. Update the value
4. **Important**: Redeploy for changes to take effect

## Scaling Considerations

### Turso Limits

- **Free Tier**: 500 MB storage, 1B row reads/month
- **Paid Tiers**: Higher limits and multiple replicas
- See [Turso Pricing](https://turso.tech/pricing)

### Vercel Limits

- **Free (Hobby)**: 100 GB bandwidth/month, 100 hours execution/month
- **Pro**: Higher limits and better performance
- See [Vercel Pricing](https://vercel.com/pricing)

## Security Best Practices

1. **Never commit** environment variables to Git
2. **Rotate tokens** regularly (especially Turso auth tokens)
3. **Use strong passwords** for the session secret
4. **Enable 2FA** on Vercel and Turso accounts
5. **Review access logs** regularly in both platforms

## Backup Strategy

### Turso Backups

Turso automatically backs up your database. To create manual backups:

```bash
# Create a backup
turso db shell local-business-scraper ".backup /path/to/backup.db"

# Restore from backup
turso db shell local-business-scraper ".restore /path/to/backup.db"
```

### Alternative: Export Data

Use the built-in export features:
- Go to `/businesses` in your app
- Click **Export** → **JSON** or **CSV**
- Store exports in a secure location

## Support

For issues:
- **Application**: Check GitHub issues or create a new one
- **Vercel**: [Vercel Support](https://vercel.com/support)
- **Turso**: [Turso Discord](https://discord.gg/turso)

## Quick Reference

### Useful Commands

```bash
# Turso CLI
turso auth login
turso db list
turso db show <db-name>
turso db shell <db-name>

# Vercel CLI
npm i -g vercel
vercel login
vercel --prod
vercel env ls
vercel logs
```

### Environment Variable Template

Create a `.env.example` file (don't commit actual values):

```bash
# Database (Required)
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_KEY=your-turso-auth-token

# Session (Required)
NUXT_SESSION_PASSWORD=your-32-char-random-string

# APIs (Required for features)
RAPIDAPI_KEY=your-rapidapi-key
GOOGLE_PAGESPEED_API_KEY=your-google-api-key
RESEND_API_KEY=your-resend-key
GROQ_API=your-groq-api-key

# Optional
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/...
IMAGE_KIT_URL=https://ik.imagekit.io/your-id
IMAGE_KIT_PUBLIC_KEY=your-imagekit-public-key
IMAGE_KIT_PRIVATE_KEY=your-imagekit-private-key
RAPIDAPI_HOST=local-business-data.p.rapidapi.com
```

## Next Steps

After successful deployment:

1. **Configure Branding**: Visit `/settings` to set up your company branding
2. **Add Email Templates**: Go to `/templates` to create email templates
3. **Verify Email Domain**: Set up your domain in Resend for email sending
4. **Test Features**: Try searching for businesses and running audits
5. **Monitor Usage**: Keep an eye on API quotas and database usage

---

**Need Help?** Check the [main README](./README.md) for more information about using the application.

