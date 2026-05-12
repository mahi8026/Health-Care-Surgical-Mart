# 🚀 Production Deployment Checklist

## Health Care Surgical Mart - Render Deployment Guide

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### 1. Database Setup
- [ ] MongoDB Atlas cluster is created and running
- [ ] Database user created with read/write permissions
- [ ] Network access configured (allow connections from anywhere: 0.0.0.0/0)
- [ ] Connection string tested locally
- [ ] Database name confirmed: `Health_Care_DB`
- [ ] Automated backups enabled in Atlas (see section below)

### 2. Firebase Configuration
- [ ] Firebase project created
- [ ] Firebase Authentication enabled (Email/Password provider)
- [ ] Firebase Admin SDK service account downloaded
- [ ] Service account JSON file secured (NOT in repository)
- [ ] Firebase web app credentials obtained for frontend

### 3. Email Provider Setup (Choose ONE)
- [ ] **SendGrid**: Account created, API key generated, sender verified
- [ ] **Mailchimp**: Account created, API key generated, audience list created
- [ ] Test email sent successfully

### 4. SMS Provider Setup (Choose ONE)
- [ ] **Twilio**: Account created, phone number purchased, credentials obtained
- [ ] **MSG91**: Account created, sender ID registered, auth key obtained
- [ ] Test SMS sent successfully

### 5. Redis Setup (REQUIRED for queues)
- [ ] Redis instance provisioned (Render Redis or external provider)
- [ ] Redis connection URL obtained
- [ ] Redis connection tested

### 6. Security Preparation
- [ ] JWT secret generated (32+ characters)
- [ ] All credentials stored securely (password manager)
- [ ] No credentials in git history verified
- [ ] `.env` files added to `.gitignore`

---

## 🔧 RENDER DEPLOYMENT STEPS

### Step 1: Create Web Service on Render

1. **Login to Render Dashboard**: https://dashboard.render.com
2. **Click "New +" → "Web Service"**
3. **Connect GitHub Repository**:
   - Authorize Render to access your GitHub
   - Select repository: `Health-Care-Surgical-Mart`
   - Branch: `main` or `master`

4. **Configure Service**:
   ```
   Name: health-care-surgical-mart-api
   Region: Oregon (or closest to your users)
   Branch: main
   Root Directory: server
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   Plan: Free (or upgrade as needed)
   ```

5. **Advanced Settings**:
   - Health Check Path: `/health`
   - Auto-Deploy: Yes

### Step 2: Configure Environment Variables

**CRITICAL**: Set ALL environment variables in Render Dashboard → Environment → Environment Variables

#### Required Variables (MUST SET):

```bash
# Server
NODE_ENV=production
PORT=10000
HOST=0.0.0.0

# Database
MONGODB_URI=mongodb+srv://<USERNAME>:<PASSWORD>@<CLUSTER>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=Health_Care_DB

# JWT (Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<YOUR_32_CHAR_SECRET>
JWT_EXPIRES_IN=24h

# Firebase Admin SDK (Base64 encoded)
FIREBASE_SERVICE_ACCOUNT_BASE64=<BASE64_ENCODED_JSON>

# CORS
ALLOWED_ORIGINS=https://health-care-60ee6.web.app,https://health-care-60ee6.firebaseapp.com

# Email Provider (SendGrid example)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Health Care Surgical Mart

# SMS Provider (Twilio example)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Redis (REQUIRED for queues)
REDIS_URL=redis://:<PASSWORD>@<HOST>:6379
ENABLE_QUEUES=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=false
```

#### How to Generate JWT Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### How to Base64 Encode Firebase Service Account:
```bash
# Linux/Mac
cat firebase-service-account.json | base64

# Windows PowerShell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("firebase-service-account.json"))

# Or use online tool (ensure it's secure): https://www.base64encode.org/
```

### Step 3: Create Redis Instance on Render

1. **Click "New +" → "Redis"**
2. **Configure**:
   ```
   Name: health-care-redis
   Region: Oregon (same as web service)
   Plan: Free (256 MB)
   ```
3. **Copy Internal Redis URL** (format: `redis://red-xxxxx:6379`)
4. **Add to Web Service Environment Variables**:
   ```
   REDIS_URL=<INTERNAL_REDIS_URL>
   ```

### Step 4: Deploy

1. **Click "Create Web Service"**
2. **Monitor Deployment Logs**:
   - Watch for "✅ Successfully connected to MongoDB"
   - Watch for "Server running on port 10000"
   - Check for any error messages

3. **Verify Health Check**:
   - Visit: `https://your-service.onrender.com/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

### Step 5: Update Frontend Configuration

1. **Update `client/.env.production`**:
   ```env
   VITE_API_URL=https://your-service.onrender.com/api
   ```

2. **Rebuild and Deploy Frontend**:
   ```bash
   cd client
   npm run build
   firebase deploy --only hosting
   ```

---

## 🧪 POST-DEPLOYMENT VERIFICATION

### Backend Verification

- [ ] **Health Check**: `GET https://your-service.onrender.com/health`
  - Expected: `{"status":"ok"}`

- [ ] **API Root**: `GET https://your-service.onrender.com/api`
  - Expected: Welcome message

- [ ] **Database Connection**: Check logs for "Successfully connected to MongoDB"

- [ ] **Redis Connection**: Check logs for "Redis connected" or "Bull queue initialized"

- [ ] **Firebase Admin**: Check logs for Firebase initialization success

### Frontend Verification

- [ ] **Login Page**: Visit `https://health-care-60ee6.web.app/login`
- [ ] **Test Login**: Try logging in with test credentials
- [ ] **API Communication**: Check browser console for API errors
- [ ] **Firebase Auth**: Verify Firebase authentication works

### Integration Testing

- [ ] **Create Product**: Test product creation
- [ ] **Create Sale**: Test POS functionality
- [ ] **Send Email**: Test email notification
- [ ] **Send SMS**: Test SMS notification
- [ ] **Generate Report**: Test financial reports

---

## 🔍 TROUBLESHOOTING GUIDE

### Issue: "Database connection failed"
**Solution**:
1. Verify `MONGODB_URI` is correct
2. Check MongoDB Atlas network access (allow 0.0.0.0/0)
3. Verify database user has correct permissions
4. Check Render logs for detailed error

### Issue: "JWT_SECRET is missing or too short"
**Solution**:
1. Generate new secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Ensure it's at least 32 characters
3. Set in Render environment variables
4. Redeploy service

### Issue: "Firebase token verification failed"
**Solution**:
1. Verify `FIREBASE_SERVICE_ACCOUNT_BASE64` is set correctly
2. Re-encode service account JSON: `cat firebase-service-account.json | base64`
3. Ensure no line breaks in base64 string
4. Check Firebase project ID matches

### Issue: "Redis connection failed"
**Solution**:
1. Verify Redis instance is running on Render
2. Check `REDIS_URL` format: `redis://:<password>@<host>:6379`
3. Use internal Redis URL (not external)
4. If Redis unavailable, set `ENABLE_QUEUES=false` (temporary fallback)

### Issue: "Email/SMS not sending"
**Solution**:
1. Verify provider credentials are correct
2. Check provider account is active and funded
3. Review Render logs for detailed error messages
4. Test credentials locally first

### Issue: "CORS errors in browser"
**Solution**:
1. Verify `ALLOWED_ORIGINS` includes your frontend URL
2. Ensure no trailing slashes in URLs
3. Check frontend is using correct API URL
4. Clear browser cache

---

## 📊 MONITORING & MAINTENANCE

### Daily Checks
- [ ] Check Render dashboard for service health
- [ ] Review error logs for critical issues
- [ ] Monitor database storage usage in Atlas
- [ ] Check Redis memory usage

### Weekly Checks
- [ ] Review application performance metrics
- [ ] Check for failed background jobs (email/SMS queues)
- [ ] Verify automated backups are running
- [ ] Review security logs for suspicious activity

### Monthly Checks
- [ ] Update dependencies (security patches)
- [ ] Review and optimize database indexes
- [ ] Analyze API usage patterns
- [ ] Test backup restoration procedure

---

## 🔐 SECURITY BEST PRACTICES

### Environment Variables
- ✅ Never commit `.env` files to git
- ✅ Use Render's environment variable encryption
- ✅ Rotate secrets every 90 days
- ✅ Use different credentials for dev/staging/production

### Database Security
- ✅ Enable MongoDB Atlas IP whitelist (if possible)
- ✅ Use strong database passwords (20+ characters)
- ✅ Enable database encryption at rest
- ✅ Regular security audits

### API Security
- ✅ Rate limiting enabled (100 req/15min)
- ✅ Helmet.js security headers active
- ✅ CORS properly configured
- ✅ JWT tokens expire after 24 hours

---

## 📦 MONGODB ATLAS BACKUP CONFIGURATION

### Enable Continuous Backups

1. **Login to MongoDB Atlas**: https://cloud.mongodb.com
2. **Select Your Cluster** → Click "..." → "Edit Configuration"
3. **Backup Section**:
   - Enable "Continuous Backup" (M10+ clusters) OR
   - Enable "Cloud Backup" (M2/M5 clusters)
4. **Configure Backup Policy**:
   ```
   Snapshot Frequency: Every 6 hours
   Retention: 7 days
   Point-in-Time Restore: Enabled (if available)
   ```
5. **Save Configuration**

### Backup Verification
- [ ] First backup completed successfully
- [ ] Backup schedule is active
- [ ] Retention policy is correct
- [ ] Test restore procedure documented

### Manual Backup (Before Major Changes)
1. Atlas Dashboard → Cluster → "Backup" tab
2. Click "Take Snapshot Now"
3. Add description: "Pre-deployment backup - [DATE]"
4. Wait for completion

---

## 🆘 EMERGENCY CONTACTS & RESOURCES

### Service Providers
- **Render Support**: https://render.com/docs/support
- **MongoDB Atlas Support**: https://support.mongodb.com
- **Firebase Support**: https://firebase.google.com/support
- **SendGrid Support**: https://support.sendgrid.com
- **Twilio Support**: https://support.twilio.com

### Documentation
- **Project README**: `/README.md`
- **API Documentation**: (To be created - Priority 3)
- **Environment Template**: `/server/.env.production.template`

### Rollback Procedure
1. Render Dashboard → Service → "Manual Deploy"
2. Select previous successful commit
3. Click "Deploy"
4. Monitor logs for successful startup
5. Verify health check endpoint

---

## ✅ DEPLOYMENT COMPLETION CHECKLIST

- [ ] All environment variables configured in Render
- [ ] Redis instance created and connected
- [ ] Backend deployed successfully
- [ ] Frontend updated with production API URL
- [ ] Health check endpoint responding
- [ ] Test login successful
- [ ] Test transaction (create product, make sale)
- [ ] Email notification tested
- [ ] SMS notification tested
- [ ] MongoDB backups enabled
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment
- [ ] Documentation updated

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Backend URL**: https://health-care-surgical-mart.onrender.com  
**Frontend URL**: https://health-care-60ee6.web.app  
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete

---

## 📝 NOTES

_Add any deployment-specific notes, issues encountered, or special configurations here:_

