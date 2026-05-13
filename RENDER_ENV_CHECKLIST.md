# Render Environment Variables - Quick Checklist

## 📋 Copy-Paste Template

Use this template in your Render dashboard (**Environment** tab):

```bash
# ============================================================
# 1. SENTRY - ERROR TRACKING
# ============================================================
SENTRY_DSN=https://[YOUR_KEY]@[YOUR_ORG].ingest.sentry.io/[PROJECT_ID]

# Get from: https://sentry.io/ → Create Project → Copy DSN


# ============================================================
# 2. GOOGLE CLOUD STORAGE - FILE STORAGE
# ============================================================
GCS_BUCKET_NAME=health-care-surgical-mart-files
GCS_PROJECT_ID=[your-gcp-project-id]
GOOGLE_APPLICATION_CREDENTIALS_JSON=[base64-encoded-json]

# Get from: https://console.cloud.google.com/storage
# 1. Create bucket
# 2. Create service account with Storage Object Admin role
# 3. Download JSON key and convert to base64


# ============================================================
# 3. SENDGRID - EMAIL DELIVERY
# ============================================================
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Health Care Surgical Mart
EMAIL_PROVIDER=sendgrid

# Get from: https://signup.sendgrid.com/
# Settings → API Keys → Create API Key


# ============================================================
# 4. TWILIO - SMS DELIVERY
# ============================================================
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
SMS_PROVIDER=twilio

# Get from: https://www.twilio.com/try-twilio
# Console → Account Info → Copy SID & Auth Token
# Phone Numbers → Buy a Number


# ============================================================
# 5. REDIS - CACHING + QUEUES
# ============================================================
REDIS_URL=redis://red-xxxxxxxxxxxxx:6379
ENABLE_QUEUES=true

# Option A: Render Dashboard → New → Redis → Copy Internal URL
# Option B: https://upstash.com/ → Create Database → Copy URL
```

---

## ✅ Setup Checklist

### Before You Start
- [ ] Have access to Render dashboard
- [ ] Backend service is deployed
- [ ] Have a credit card ready (for free trials that require it)

### 1. Sentry Setup (5 minutes)
- [ ] Sign up at https://sentry.io/signup/
- [ ] Create new project (Node.js)
- [ ] Copy DSN
- [ ] Add `SENTRY_DSN` to Render
- [ ] Verify in logs: "Sentry initialized successfully"

### 2. Google Cloud Storage Setup (15 minutes)
- [ ] Go to https://console.cloud.google.com/storage
- [ ] Create new bucket (unique name)
- [ ] Create service account
- [ ] Download JSON key
- [ ] Convert JSON to base64
- [ ] Add 3 variables to Render:
  - [ ] `GCS_BUCKET_NAME`
  - [ ] `GCS_PROJECT_ID`
  - [ ] `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- [ ] Verify in logs: "GCS initialized: bucket [name]"

### 3. SendGrid Setup (10 minutes)
- [ ] Sign up at https://signup.sendgrid.com/
- [ ] Verify email address
- [ ] Create API key (Full Access)
- [ ] Copy API key (starts with `SG.`)
- [ ] Add 4 variables to Render:
  - [ ] `SENDGRID_API_KEY`
  - [ ] `SENDGRID_FROM_EMAIL`
  - [ ] `SENDGRID_FROM_NAME`
  - [ ] `EMAIL_PROVIDER=sendgrid`
- [ ] Verify sender email in SendGrid
- [ ] Verify in logs: "SendGrid email provider initialized"

### 4. Twilio Setup (10 minutes)
- [ ] Sign up at https://www.twilio.com/try-twilio
- [ ] Verify phone number
- [ ] Copy Account SID (starts with `AC`)
- [ ] Copy Auth Token
- [ ] Buy a phone number (with SMS capability)
- [ ] Add 4 variables to Render:
  - [ ] `TWILIO_ACCOUNT_SID`
  - [ ] `TWILIO_AUTH_TOKEN`
  - [ ] `TWILIO_PHONE_NUMBER`
  - [ ] `SMS_PROVIDER=twilio`
- [ ] Verify in logs: "Twilio SMS provider initialized"

### 5. Redis Setup (5 minutes)
- [ ] In Render: New → Redis → Create
- [ ] Copy Internal Redis URL
- [ ] Add 2 variables to Render:
  - [ ] `REDIS_URL`
  - [ ] `ENABLE_QUEUES=true`
- [ ] Verify in logs: "Redis connected successfully"

### Final Verification
- [ ] All 5 services show success in Render logs
- [ ] No error messages in logs
- [ ] Backend service restarted automatically
- [ ] Test file upload (GCS)
- [ ] Test email sending (SendGrid)
- [ ] Test SMS sending (Twilio)
- [ ] Check Sentry dashboard for events

---

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| Sentry DSN invalid | Must be full URL: `https://...ingest.sentry.io/...` |
| GCS uploads fail | Check service account has Storage Object Admin role |
| SendGrid key rejected | Must start with `SG.` - regenerate if needed |
| Twilio SMS not sending | Trial accounts can only send to verified numbers |
| Redis connection timeout | Ensure Redis and backend in same region |

---

## 📊 Expected Log Output

After successful setup, your Render logs should show:

```
[INFO] Starting Health Care Surgical Mart Backend v2.0.0
[INFO] Environment: production
[INFO] Sentry initialized successfully
[INFO] GCS initialized: bucket health-care-surgical-mart-files
[INFO] SendGrid email provider initialized
[INFO] Twilio SMS provider initialized  
[INFO] Redis connected successfully
[INFO] MongoDB connected: Health_Care_Shop_DB
[INFO] Server listening on port 5001
[INFO] ✅ All systems operational
```

---

## 💡 Pro Tips

1. **Set up all 5 at once** - Render will restart service only once
2. **Use Render Redis** - Same platform, better performance
3. **Start with free tiers** - Upgrade only when needed
4. **Monitor usage** - Set billing alerts in each service
5. **Document credentials** - Save in password manager
6. **Test immediately** - Verify each service works before moving on

---

## 📞 Quick Links

- **Render Dashboard:** https://dashboard.render.com/
- **Sentry:** https://sentry.io/
- **GCS Console:** https://console.cloud.google.com/storage
- **SendGrid:** https://app.sendgrid.com/
- **Twilio Console:** https://console.twilio.com/
- **Upstash (Redis):** https://console.upstash.com/

---

**Estimated Total Setup Time:** 45 minutes

**Total Cost (Free Tiers):** $0/month for development

**Production Cost Estimate:** $20-50/month depending on usage
