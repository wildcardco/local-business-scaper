# Pre-Deployment Checklist

Use this checklist before pushing to GitHub and deploying to Vercel.

## ✅ Security Check

- [ ] **Verify .gitignore**: `dev.db` and `.env` are listed
- [ ] **Check git status**: No sensitive files appear
- [ ] **Review .env**: Only non-sensitive values (if any)
- [ ] **API Keys**: All keys are in environment variables, not hardcoded
- [ ] **Database**: Using Turso connection string (not local db path)

```bash
# Run this to verify
git status
# Should NOT see: dev.db, .env, or any *.db files
```

## ✅ Code Quality

- [ ] **No linter errors**: Run `npm run lint`
- [ ] **TypeScript compiles**: Run `npm run typecheck`
- [ ] **Build succeeds**: Run `npm run build`
- [ ] **No console errors**: Check browser console

```bash
npm run lint
npm run typecheck
npm run build
```

## ✅ Environment Variables

### Local (.env file)
- [ ] `TURSO_DB_URL` - Set to your Turso database URL
- [ ] `TURSO_KEY` - Set to your Turso auth token
- [ ] `NUXT_SESSION_PASSWORD` - Random 32+ char string
- [ ] `RAPIDAPI_KEY` - From RapidAPI dashboard
- [ ] `GOOGLE_PAGESPEED_API_KEY` - From Google Cloud Console
- [ ] `RESEND_API_KEY` - From Resend dashboard
- [ ] `GROQ_API` - From Groq console

### Vercel (Production)
- [ ] All variables from local are added to Vercel
- [ ] Variables are set for "Production" environment
- [ ] Session password is different from local
- [ ] All API keys are valid and active

## ✅ Database

- [ ] **Turso Database Created**: `turso db create local-business-scraper`
- [ ] **Auth Token Generated**: `turso db tokens create local-business-scraper`
- [ ] **Connection Tested**: Can connect to Turso from local
- [ ] **Schema Will Auto-Initialize**: On first deployment

```bash
# Verify Turso setup
turso db show local-business-scraper
turso db shell local-business-scraper "SELECT 1"
```

## ✅ API Services

- [ ] **RapidAPI**: Account created, subscription active
- [ ] **Google PageSpeed**: API enabled, key created
- [ ] **Resend**: Account created, domain/email verified
- [ ] **Groq**: Account created, API key generated
- [ ] **ImageKit** (optional): Account created, keys obtained

## ✅ Vercel Configuration

- [ ] **Repository Connected**: GitHub repo linked to Vercel
- [ ] **Framework Preset**: Nuxt.js (auto-detected)
- [ ] **Environment Variables**: All required vars added
- [ ] **Build Settings**: Default settings (npm run build)
- [ ] **Domain** (optional): Custom domain configured

## ✅ Git Repository

- [ ] **All changes committed**: `git status` is clean
- [ ] **No sensitive files committed**: Check git history
- [ ] **README updated**: Reflects current features
- [ ] **.env.example exists**: Template for others
- [ ] **Remote added**: GitHub repo URL set

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## ✅ Pre-Deployment Test (Local)

Test these features locally before deploying:

- [ ] **Register/Login**: Create account, login, logout
- [ ] **Search**: Search for businesses (with API key)
- [ ] **Audit**: Run audit on a business (with API key)
- [ ] **Email Generate**: Generate AI email (with API key)
- [ ] **Settings**: Update branding settings
- [ ] **Password Change**: Change account password

## 🚀 Deployment Steps

### 1. Push to GitHub
```bash
git push origin main
```

### 2. Deploy to Vercel

#### Option A: Using Vercel Dashboard
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Add all environment variables
4. Click "Deploy"

#### Option B: Using Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### 3. Monitor Deployment

- [ ] **Build Logs**: Check for errors during build
- [ ] **Deployment Status**: Wait for "Deployment Ready"
- [ ] **Initial Load**: Open the Vercel URL
- [ ] **Server Logs**: Look for "✅ Database schema initialized"

### 4. Post-Deployment Verification

- [ ] **Register First User**: Create admin account
- [ ] **Test Search**: Search for businesses
- [ ] **Test Audit**: Run a website audit
- [ ] **Test Email**: Send a test email
- [ ] **Test Settings**: Update branding
- [ ] **Check Performance**: Page load times < 3 seconds
- [ ] **Check Errors**: No console errors

## 🔍 Common Issues & Solutions

### Build Fails

**Error**: "Module not found"
```bash
# Solution: Ensure all dependencies are in package.json
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
```

**Error**: "TypeScript errors"
```bash
# Solution: Fix TypeScript errors locally first
npm run typecheck
# Fix errors, then deploy
```

### Database Connection Fails

**Error**: "Failed to initialize database"
```bash
# Solution: Verify Turso credentials in Vercel
# 1. Check TURSO_DB_URL format: libsql://your-db.turso.io
# 2. Check TURSO_KEY is correct
# 3. Redeploy after fixing
```

### Environment Variables Not Working

**Error**: "API key not configured"
```bash
# Solution: 
# 1. Go to Vercel → Settings → Environment Variables
# 2. Ensure variables are set for "Production"
# 3. Click "Redeploy" after adding variables
```

### Session Errors

**Error**: "Session password required"
```bash
# Solution: Generate and add session password
openssl rand -base64 32
# Add as NUXT_SESSION_PASSWORD in Vercel
# Redeploy
```

## 📊 Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor Vercel function invocations
- [ ] Check error rates in Vercel dashboard
- [ ] Review Turso database usage
- [ ] Check API quota usage
- [ ] Test all critical features

### First Week
- [ ] Daily check of error logs
- [ ] Monitor API costs
- [ ] Check database size growth
- [ ] Review user feedback
- [ ] Performance monitoring

### Ongoing
- [ ] Weekly security review
- [ ] Monthly API key rotation
- [ ] Regular backups
- [ ] Dependency updates
- [ ] Feature monitoring

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ Build completes without errors
- ✅ All pages load without 500 errors
- ✅ User registration works
- ✅ Business search returns results
- ✅ Audits complete successfully
- ✅ Emails send successfully
- ✅ Settings save correctly
- ✅ No console errors in browser
- ✅ Page load times < 3 seconds
- ✅ Mobile responsive design works

## 📝 Deployment Log Template

Keep a log of your deployments:

```
Date: [YYYY-MM-DD]
Version: [v1.0.0]
Deployed By: [Your Name]
Environment: [Production/Staging]
Commit: [git commit hash]
Status: [Success/Failed]
Issues: [Any issues encountered]
Notes: [Additional notes]
```

## 🔗 Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Turso Dashboard**: https://turso.tech/app
- **GitHub Repo**: [Your repo URL]
- **Production URL**: [Your Vercel URL]
- **Documentation**: See DEPLOYMENT.md for details

---

**Ready to Deploy?** 🚀 

If all checkboxes are ticked, you're good to go!

```bash
git push origin main
# Then deploy via Vercel dashboard
```

**Need Help?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

