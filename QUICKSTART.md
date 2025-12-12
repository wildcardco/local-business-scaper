# Quick Start Guide

Get up and running in 5 minutes!

## 🚀 Local Development (No Turso Required)

```bash
# 1. Install dependencies
npm install

# 2. Create .env file with minimum config
cat > .env << EOF
# Database (local SQLite)
TURSO_DB_URL=file:dev.db

# Session Security (generate with: openssl rand -base64 32)
NUXT_SESSION_PASSWORD=$(openssl rand -base64 32)

# API Keys - Get from respective services
RAPIDAPI_KEY=your_key_here
GOOGLE_PAGESPEED_API_KEY=your_key_here
RESEND_API_KEY=your_key_here
GROQ_API=your_key_here
EOF

# 3. Start the dev server
npm run dev

# 4. Open http://localhost:3000 and register!
```

## 🌐 Deploy to Vercel in 10 Minutes

### Prerequisites
- GitHub account
- Vercel account (free tier is fine)
- Turso account (free tier is fine)

### Step-by-Step

**1. Set up Turso (2 minutes)**
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash  # macOS/Linux
# OR
irm get.tur.so/install.ps1 | iex  # Windows PowerShell

# Login and create database
turso auth login
turso db create local-business-scraper

# Get credentials (save these!)
turso db show local-business-scraper --url
turso db tokens create local-business-scraper
```

**2. Push to GitHub (1 minute)**
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

**3. Deploy to Vercel (5 minutes)**

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Add environment variables in Vercel dashboard:

**Required Variables:**
```
NUXT_SESSION_PASSWORD=<generate-with-openssl-rand-base64-32>
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_KEY=<your-turso-token>
RAPIDAPI_KEY=<your-key>
GOOGLE_PAGESPEED_API_KEY=<your-key>
RESEND_API_KEY=<your-key>
GROQ_API=<your-key>
```

4. Click **Deploy**
5. Wait for build to complete (~2 minutes)
6. Open your Vercel URL and register!

**4. Verify Deployment (2 minutes)**
- [ ] Open your Vercel URL
- [ ] Register a new account
- [ ] Try searching for businesses
- [ ] Run an audit
- [ ] Send a test email

✅ **Done!** Your app is live and ready to use.

## 🔑 Getting API Keys

### RapidAPI (Required for Business Search)
1. Go to https://rapidapi.com/letscrape-6bRBa3QguO5/api/local-business-data
2. Sign up and subscribe (free tier available)
3. Copy your API key

### Google PageSpeed (Required for Audits)
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable PageSpeed Insights API
4. Create credentials → API Key
5. Copy your API key

### Resend (Required for Emails)
1. Go to https://resend.com/
2. Sign up for free account
3. Get API key from dashboard
4. **Important**: Verify your domain or add test email addresses

### Groq (Required for AI Emails)
1. Go to https://console.groq.com/
2. Sign up for free account
3. Create API key
4. Copy your key

### ImageKit (Optional - for Logo Uploads)
1. Go to https://imagekit.io/
2. Sign up for free account
3. Get public and private keys from dashboard

## 📚 Next Steps

- **Full Setup Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Testing Guide**: See [TESTING.md](./TESTING.md)
- **Feature Documentation**: See [APP-DOCUMENTATION.md](./APP-DOCUMENTATION.md)
- **README**: See [README.md](./README.md)

## 🆘 Common Issues

### "Session password must be at least 32 characters"
```bash
# Generate a proper session password
openssl rand -base64 32
```

### "Database connection failed"
- Check `TURSO_DB_URL` starts with `libsql://` (for Turso)
- Or use `file:dev.db` (for local development)
- Verify `TURSO_KEY` is correct

### "API key not configured"
- Make sure all required API keys are set
- In Vercel: Settings → Environment Variables
- Redeploy after adding variables

### "Email sending failed"
- Verify sender email in Resend dashboard
- Check RESEND_API_KEY is correct
- Make sure recipient email is valid

## 💡 Pro Tips

1. **Start Local First**: Test everything locally before deploying
2. **Use .env.example**: Copy it to `.env` and fill in your keys
3. **Check Logs**: Vercel logs show detailed error messages
4. **Monitor Quotas**: Keep an eye on API usage limits
5. **Backup Data**: Export your data regularly

## 🎯 Minimum Working Setup

**Absolute minimum to test locally:**
```bash
TURSO_DB_URL=file:dev.db
NUXT_SESSION_PASSWORD=any-random-32-character-string-here-abc123
RAPIDAPI_KEY=your_key
```

This lets you:
- Register and login
- Search for businesses
- View results (without audits)
- Test the UI

**For full features, add:**
- `GOOGLE_PAGESPEED_API_KEY` for website audits
- `RESEND_API_KEY` for email sending
- `GROQ_API` for AI email generation

---

**Ready to Launch?** 🚀 Follow the steps above and you'll be up in minutes!

