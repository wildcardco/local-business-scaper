# Testing Guide

This guide helps you test all features of the Local Business Scraper application before and after deployment.

## Pre-Deployment Testing (Local)

### 1. Database Connection

Test with local SQLite:
```bash
# Set in .env
TURSO_DB_URL=file:dev.db

# Start server
npm run dev

# Check logs for:
# ✅ Database schema initialized
```

Test with Turso cloud (optional):
```bash
# Create Turso database
turso db create local-business-scraper-test

# Get credentials
turso db show local-business-scraper-test --url
turso db tokens create local-business-scraper-test

# Update .env with Turso credentials
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_KEY=your-token

# Restart and verify connection
npm run dev
```

### 2. Authentication Flow

**Register New User**
- [ ] Navigate to `/register`
- [ ] Enter username (min 3 chars)
- [ ] Enter name (min 2 chars)
- [ ] Enter password (min 8 chars)
- [ ] Submit and verify redirect to dashboard
- [ ] Check: User session created

**Login**
- [ ] Navigate to `/login`
- [ ] Enter credentials
- [ ] Verify successful login
- [ ] Check: Redirected to dashboard

**Logout**
- [ ] Click logout button
- [ ] Verify redirect to login page
- [ ] Check: Session cleared

**Password Change**
- [ ] Go to `/settings`
- [ ] Scroll to "Account Security" section
- [ ] Enter current password
- [ ] Enter new password (min 8 chars)
- [ ] Confirm new password
- [ ] Click "Change Password"
- [ ] Verify success message
- [ ] Logout and login with new password

### 3. Business Search

**Search Local Businesses**
- [ ] Go to dashboard or `/businesses`
- [ ] Enter query (e.g., "restaurants")
- [ ] Enter location (e.g., "Gary, Indiana")
- [ ] Click "Search & Score"
- [ ] Verify: Results appear in table
- [ ] Check: Each business has basic info (name, address, phone)
- [ ] Check: Lead scores are calculated

**Scrape Additional Contacts**
- [ ] Click on a business row
- [ ] Go to business detail page
- [ ] Click "Scrape Contacts" button
- [ ] Verify: Emails and social profiles are fetched
- [ ] Check: Email, Facebook, LinkedIn, etc. appear

### 4. Website Auditing

**Single Business Audit**
- [ ] From business detail page
- [ ] Click "Run Audit" button
- [ ] Wait for audit to complete
- [ ] Verify: Audit scores appear (Performance, SEO, etc.)
- [ ] Check: Lead score updates based on audit
- [ ] View audit report

**Batch Audit**
- [ ] From businesses list page
- [ ] Select multiple businesses (with websites)
- [ ] Click "Audit Selected" button
- [ ] Verify: Progress indicator shows
- [ ] Check: All selected businesses are audited
- [ ] Check: Audit results appear in table

### 5. Lead Management

**Approval Queue**
- [ ] Go to `/queue`
- [ ] Verify: Businesses are sorted by lead score
- [ ] Review a business
- [ ] Click "Approve" button
- [ ] Check: Status changes to "approved"
- [ ] Check: Business appears in approved list

**Status Updates**
- [ ] Change business status (new/approved/contacted/rejected)
- [ ] Verify: Status badge updates
- [ ] Check: Filters work correctly

### 6. Email Templates

**Create Template**
- [ ] Go to `/templates`
- [ ] Click "New Template"
- [ ] Enter template name
- [ ] Enter subject with variables (e.g., `{{businessName}}`)
- [ ] Enter body with variables
- [ ] Save template
- [ ] Verify: Template appears in list

**Seed Default Templates**
- [ ] Click "Seed Default Templates" button
- [ ] Verify: Multiple templates are created
- [ ] Check: Templates have proper variables

**Edit Template**
- [ ] Click edit on a template
- [ ] Modify subject or body
- [ ] Save changes
- [ ] Verify: Changes are saved

**Delete Template**
- [ ] Click delete on a template
- [ ] Confirm deletion
- [ ] Verify: Template is removed

### 7. AI Email Generation

**Generate Email for Business**
- [ ] Go to `/compose` or business detail
- [ ] Select a business
- [ ] Select a template (or use custom prompt)
- [ ] Click "Generate with AI"
- [ ] Verify: Email is generated with business details
- [ ] Check: Variables are replaced correctly
- [ ] Check: Email is personalized

**Save as Draft**
- [ ] After generating email
- [ ] Click "Save Draft"
- [ ] Verify: Draft is saved
- [ ] Go to drafts list
- [ ] Check: Draft appears with correct details

### 8. Email Outreach

**Send Single Email**
- [ ] From compose page or draft
- [ ] Verify: Recipient email is set
- [ ] Click "Send Email"
- [ ] Verify: Success message appears
- [ ] Check: Email is logged in outreach logs
- [ ] Check: Business status updates to "contacted"

**Send Bulk Emails**
- [ ] From businesses list
- [ ] Select multiple approved businesses (with emails)
- [ ] Click "Send Bulk Outreach"
- [ ] Select template
- [ ] Confirm sending
- [ ] Verify: All emails are sent
- [ ] Check: Outreach logs updated for all

**View Outreach Logs**
- [ ] View outreach history
- [ ] Check: Sent emails appear with status
- [ ] Check: Timestamps are correct
- [ ] Check: Message IDs are stored

### 9. Inbox & Email Replies

**View Email Threads**
- [ ] Go to `/inbox`
- [ ] Verify: Sent emails appear as threads
- [ ] Check: Thread count shows correctly

**View Thread Details**
- [ ] Click on a thread
- [ ] Verify: Original email appears
- [ ] Check: Replies are shown (if any)
- [ ] Check: Thread is properly formatted

### 10. Branding Settings

**Update Company Info**
- [ ] Go to `/settings`
- [ ] Update company name
- [ ] Update tagline
- [ ] Save settings
- [ ] Verify: Changes are saved

**Upload Logo**
- [ ] Click "Upload Logo"
- [ ] Select image file (max 5MB)
- [ ] Verify: Image uploads to ImageKit
- [ ] Check: Logo URL is stored
- [ ] Check: Preview updates

**Update Email Configuration**
- [ ] Enter sender name
- [ ] Enter sender email (must be verified in Resend)
- [ ] Save settings
- [ ] Verify: Email settings are saved

**Customize Colors**
- [ ] Change primary color
- [ ] Change secondary color
- [ ] Verify: Preview updates in real-time
- [ ] Save settings
- [ ] Check: Colors are applied

**Change Font**
- [ ] Select different font family
- [ ] Verify: Preview updates
- [ ] Save settings
- [ ] Check: Font is applied

### 11. Export Features

**Export to CSV**
- [ ] From businesses list
- [ ] Click "Export" → "CSV"
- [ ] Verify: CSV file downloads
- [ ] Open CSV
- [ ] Check: All business data is present

**Export to JSON**
- [ ] Click "Export" → "JSON"
- [ ] Verify: JSON file downloads
- [ ] Check: Proper JSON structure
- [ ] Check: All fields are included

**Send to n8n Webhook**
- [ ] Configure N8N_WEBHOOK_URL in .env
- [ ] Click "Export" → "Send to n8n"
- [ ] Verify: Success message
- [ ] Check: Data arrives at n8n webhook

### 12. Audit Reports

**Generate Report**
- [ ] View business with audit
- [ ] Click "View Report"
- [ ] Verify: Comprehensive report displays
- [ ] Check: All audit metrics shown
- [ ] Check: Recommendations appear

**Email Report**
- [ ] From report page
- [ ] Click "Email Report"
- [ ] Enter recipient email
- [ ] Send report
- [ ] Verify: Email is sent
- [ ] Check: Report arrives correctly formatted

**Export Report**
- [ ] Click "Export Report"
- [ ] Verify: Report exports correctly
- [ ] Check: Formatted properly

## Post-Deployment Testing (Vercel)

### Environment Validation

After deploying to Vercel:

1. **Check Deployment Logs**
   - [ ] Verify build succeeds
   - [ ] Check for "✅ Database schema initialized" in logs
   - [ ] No errors during startup

2. **Test Database Connection**
   - [ ] Open deployed app
   - [ ] Go to `/register`
   - [ ] Create test account
   - [ ] Verify: User is created in Turso
   - [ ] Check Turso dashboard for new row

3. **Verify All API Keys**
   - [ ] Test search (RAPIDAPI_KEY)
   - [ ] Test audit (GOOGLE_PAGESPEED_API_KEY)
   - [ ] Test AI generation (GROQ_API)
   - [ ] Test email sending (RESEND_API_KEY)
   - [ ] Test image upload (IMAGE_KIT_* keys)

### Production Features Test

Run through critical user flows:

**Critical Path 1: New User → Search → Audit → Approve**
- [ ] Register new user
- [ ] Search for businesses
- [ ] Run audit on business
- [ ] Approve business

**Critical Path 2: Template → AI Email → Send**
- [ ] Create email template
- [ ] Generate AI email
- [ ] Send email to test address
- [ ] Verify email arrives

**Critical Path 3: Settings → Password → Branding**
- [ ] Change password
- [ ] Update branding settings
- [ ] Upload logo
- [ ] Verify changes persist

### Performance Testing

- [ ] Search response time < 5 seconds
- [ ] Audit completion < 30 seconds
- [ ] Page load times < 3 seconds
- [ ] No console errors in browser

### Security Testing

- [ ] Cannot access protected routes without login
- [ ] Password change requires current password
- [ ] Session expires after logout
- [ ] Cannot access other users' data
- [ ] API endpoints require authentication

## Common Issues & Solutions

### Database Issues

**Error**: "Failed to initialize database"
- Check TURSO_DB_URL format: `libsql://your-db.turso.io`
- Verify TURSO_KEY is correct
- Check Turso dashboard for database status

**Error**: "Table already exists"
- Database schema already initialized (this is OK)
- No action needed

### API Key Issues

**Error**: "API key not configured"
- Add missing API key to .env or Vercel
- Restart server after adding keys

**Error**: "Invalid API key"
- Verify key is correct in provider dashboard
- Check for extra spaces or quotes in .env

### Email Issues

**Error**: "Email sending failed"
- Verify RESEND_API_KEY is correct
- Check sender email is verified in Resend
- Verify recipient email format

**Error**: "Domain not verified"
- Go to Resend dashboard
- Add and verify your domain
- Or add individual test emails

### Image Upload Issues

**Error**: "Image upload failed"
- Verify IMAGE_KIT_* keys are correct
- Check file size (max 5MB)
- Verify file is an image type

## Monitoring

### Production Monitoring

After deployment, monitor:

1. **Vercel Dashboard**
   - Check function invocations
   - Monitor error rates
   - Review logs

2. **Turso Dashboard**
   - Monitor database usage
   - Check query performance
   - Review row counts

3. **API Usage**
   - RapidAPI: Check request counts
   - Google PageSpeed: Monitor quota
   - Resend: Track email sends
   - Groq: Monitor token usage

### Health Checks

Daily checks:
- [ ] Login works
- [ ] Search returns results
- [ ] Emails are sending
- [ ] Database is responding

Weekly checks:
- [ ] Review error logs
- [ ] Check API quotas
- [ ] Verify backups
- [ ] Test all critical flows

## Test Data Cleanup

After testing:

```bash
# If using Turso CLI
turso db shell local-business-scraper

# Delete test data
DELETE FROM businesses WHERE user_id = 'test-user-id';
DELETE FROM users WHERE username = 'test-user';

# Or reset entire database
DROP TABLE businesses;
DROP TABLE users;
-- Restart server to reinitialize schema
```

## Automated Testing (Future)

Consider adding:
- Unit tests for utilities
- Integration tests for API endpoints
- E2E tests with Playwright
- CI/CD pipeline with GitHub Actions

---

**Testing Checklist Complete**: If all items pass, your application is ready for production use!

