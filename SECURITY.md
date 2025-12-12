# Security Guide

## 🔒 Files That Should NEVER Be Committed

The following files contain sensitive data and are protected by `.gitignore`:

### Database Files
- `*.db` - SQLite database files
- `*.db-shm` - SQLite shared memory files
- `*.db-wal` - SQLite write-ahead log files
- `dev.db` - Local development database
- `local.db` - Alternative local database

### Environment Files
- `.env` - Your environment variables with API keys
- `.env.local`
- `.env.production`
- `.env.development`

**✅ Protected**: All these files are in `.gitignore` and will not be committed.

## 🛡️ Before Pushing to GitHub

### 1. Verify No Sensitive Files Are Staged

```bash
# Check what files will be committed
git status

# If you see dev.db or .env, they should NOT be there!
# If they appear, run:
git rm --cached dev.db
git rm --cached .env
```

### 2. Check Git History (If Already Committed)

If you accidentally committed sensitive files in the past:

```bash
# Check if sensitive files are in git history
git log --all --full-history -- dev.db
git log --all --full-history -- .env

# If found, you MUST clean the history (see below)
```

### 3. Remove Sensitive Files from Git History

**⚠️ WARNING**: This rewrites git history. Only do this before others have cloned your repo.

```bash
# Install BFG Repo Cleaner
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Remove database files from history
java -jar bfg.jar --delete-files dev.db
java -jar bfg.jar --delete-files "*.db"

# Remove .env files from history
java -jar bfg.jar --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ only if repo is private and not shared yet!)
git push --force
```

**Alternative**: Delete the repo and create a new one if it was already public.

## 🔑 Environment Variable Security

### Development (.env file)

```bash
# ❌ NEVER commit this file
# ❌ NEVER share your .env file
# ❌ NEVER post API keys in Discord/Slack/etc.

# ✅ Keep .env file local only
# ✅ Use .env.example as a template (no real values)
# ✅ Rotate keys if accidentally exposed
```

### Production (Vercel)

```bash
# ✅ Set environment variables in Vercel dashboard
# ✅ Use different keys for production vs development
# ✅ Enable 2FA on your Vercel account
# ✅ Limit team access to production environment
```

## 🔐 API Key Security Best Practices

### 1. Key Rotation Schedule

Rotate your API keys regularly:
- **Every 90 days**: All API keys (minimum)
- **Immediately**: If you suspect a key was exposed
- **After team changes**: When someone leaves your team

### 2. Key Exposure Response

If you accidentally expose an API key:

**Immediate Actions (within 5 minutes):**
1. Go to the provider's dashboard
2. Revoke/delete the exposed key
3. Generate a new key
4. Update your .env and Vercel

**Follow-up Actions (within 24 hours):**
1. Review access logs for unauthorized usage
2. Check if any damage was done
3. Document the incident
4. Update security procedures

### 3. Service-Specific Security

#### Turso Database
```bash
# Rotate auth token
turso db tokens create local-business-scraper
# Then revoke old token
turso db tokens revoke <old-token-id>

# Monitor database access
turso db inspect local-business-scraper

# Set up read-only tokens for reporting
turso db tokens create local-business-scraper --read-only
```

#### RapidAPI
- Monitor usage in dashboard
- Set up usage alerts
- Use different keys per environment

#### Google PageSpeed
- Restrict API key to your domain
- Set up quotas
- Monitor usage in Google Cloud Console

#### Resend
- Use domain verification (more secure than individual emails)
- Set up webhook signing
- Monitor email sends for unusual activity

#### Groq
- Monitor token usage
- Set up rate limits
- Review API logs regularly

## 🚨 Common Security Mistakes to Avoid

### ❌ Don't Do This

```javascript
// ❌ Hardcoded API key
const apiKey = 'sk-1234567890abcdef'

// ❌ API key in client-side code
const config = {
  publicKey: process.env.SECRET_KEY // exposed to browser!
}

// ❌ Committing .env file
git add .env  // NEVER!

// ❌ Sharing keys in screenshots
// Be careful when sharing screenshots of your dashboard
```

### ✅ Do This Instead

```javascript
// ✅ Use runtime config (server-side only)
const config = useRuntimeConfig()
const apiKey = config.secretApiKey

// ✅ Public keys only in public config
const config = useRuntimeConfig()
const publicKey = config.public.publicImageKitKey

// ✅ Use .env.example for documentation
// See .env.example for required variables

// ✅ Blur sensitive info in screenshots
// Use image editing to hide API keys before sharing
```

## 🔍 Security Audit Checklist

Before deploying or sharing your repo:

### Git Repository
- [ ] `.gitignore` includes `*.db` and `.env`
- [ ] No sensitive files in git status
- [ ] No sensitive files in git history
- [ ] `.env.example` has no real values

### Environment Variables
- [ ] All secrets use environment variables
- [ ] No hardcoded API keys in code
- [ ] Different keys for dev vs production
- [ ] Session password is 32+ characters

### API Keys
- [ ] All keys are valid and active
- [ ] Keys have appropriate permissions (least privilege)
- [ ] Usage monitoring is set up
- [ ] Quota alerts are configured

### Vercel Settings
- [ ] Environment variables are set correctly
- [ ] No sensitive data in build logs
- [ ] 2FA is enabled on account
- [ ] Team access is properly configured

### Database
- [ ] Turso auth token is secret
- [ ] Database has no test data with real emails
- [ ] Backups are configured
- [ ] Access logs are monitored

## 📱 2FA Setup

Enable 2FA on all accounts:

1. **GitHub**: Settings → Password and authentication → Enable 2FA
2. **Vercel**: Settings → Security → Enable 2FA
3. **Turso**: Account Settings → Enable 2FA
4. **RapidAPI**: Account Settings → Security → Enable 2FA
5. **Google Cloud**: Account → Security → 2-Step Verification

## 🔔 Security Monitoring

### Daily Checks
- Review Vercel deployment logs for errors
- Check for unusual API usage patterns

### Weekly Checks
- Review Turso database access logs
- Check API quota usage across all services
- Review Resend email sending activity

### Monthly Checks
- Audit all API keys and rotate if needed
- Review team access permissions
- Update dependencies (npm audit)
- Review security settings on all platforms

## 🆘 Incident Response

If you discover a security breach:

### Step 1: Contain (Immediate)
1. Revoke all potentially exposed credentials
2. Generate new keys
3. Update all environments with new keys
4. Block suspicious IP addresses if possible

### Step 2: Assess (Within 1 hour)
1. Review access logs
2. Identify what data was accessed
3. Determine the scope of the breach
4. Document findings

### Step 3: Remediate (Within 24 hours)
1. Fix the vulnerability
2. Update security procedures
3. Notify affected users if needed
4. File incident report

### Step 4: Prevent (Within 1 week)
1. Update security practices
2. Add monitoring/alerts
3. Team training on security
4. Regular security audits

## 📞 Security Contacts

If you need help with security issues:

- **Vercel**: security@vercel.com
- **Turso**: https://discord.gg/turso (security channel)
- **RapidAPI**: support@rapidapi.com
- **Google**: https://support.google.com/cloud/

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [Vercel Security](https://vercel.com/docs/security)
- [Turso Security](https://docs.turso.tech/security)

---

**Remember**: Security is not a one-time setup, it's an ongoing process. Stay vigilant! 🛡️

