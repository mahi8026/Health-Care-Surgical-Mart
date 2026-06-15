# 🚀 Deployment Guide: JWT Security Migration

## ✅ Code Changes Completed

All code changes have been committed and pushed to GitHub:
- Commit: `8173825`
- Message: "security: migrate JWT from localStorage to httpOnly cookies - XSS protection"

---

## 📋 What Changed

### Security Improvement
**JWT tokens are now stored in httpOnly cookies** instead of localStorage, protecting against XSS attacks.

### Files Modified
1. **Backend (7 files)**
   - `server/package.json` - Added cookie-parser dependency
   - `server/src/server.js` - Added cookie-parser middleware
   - `server/src/routes/auth-multi-tenant.routes.js` - Set JWT as cookie, added /logout and /me endpoints
   - `server/src/middleware/auth-multi-tenant.js` - Read JWT from cookie

2. **Frontend (2 files)**
   - `client/src/config/api.js` - Added withCredentials: true, removed Bearer token
   - `client/src/contexts/AuthContext.jsx` - Removed token from localStorage, call /me for session restore

3. **Documentation (1 new file)**
   - `JWT_SECURITY_MIGRATION.md` - Complete migration documentation

---

## 🚀 Deployment Steps

### Step 1: Backend (Render) - Auto-Deploy ✅

**Status:** Automatic deployment triggered by git push

1. Go to: https://dashboard.render.com
2. Find your service: "medical-pos-backend"
3. Click **"Logs"** tab
4. Watch for deployment progress
5. Wait for: `✔️ Deploy successful` (~3-5 minutes)

**Environment Variables (Already Set):**
- ✅ `ALLOWED_ORIGINS` - Already updated with production URLs
- ✅ `JWT_SECRET` - Already set
- ✅ `FIREBASE_SERVICE_ACCOUNT_BASE64` - Already set
- ✅ `MONGODB_URI` - Already set

**No additional env vars needed!** 🎉

---

### Step 2: Frontend (Firebase Hosting)

**After backend is deployed**, rebuild and deploy the frontend:

```bash
# Navigate to client directory
cd client

# Build production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

**Expected output:**
```
✔  Deploy complete!
Hosting URL: https://health-care-60ee6.web.app
```

---

## 🧪 Testing After Deployment

### Test 1: Verify Backend is Live

```bash
curl https://medical-pos-backend.onrender.com/api/auth/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "checks": {
    "firebaseAdmin": "ok",
    "mongodbConnection": "ok",
    "jwtSecret": "set",
    "corsOrigins": [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://health-care-60ee6.web.app",
      "https://health-care-60ee6.firebaseapp.com",
      "https://medical-pos-backend.onrender.com"
    ],
    "productionCors": "ok"
  }
}
```

### Test 2: Login with New JWT Cookie System

1. **Open:** https://health-care-60ee6.web.app/login

2. **Open DevTools:** Press F12

3. **Go to Application tab → Cookies → https://medical-pos-backend.onrender.com**

4. **Login with valid credentials**

5. **Verify Cookie is Set:**
   - ✅ Cookie named `jwt` should appear
   - ✅ `HttpOnly` flag should be checked ✅
   - ✅ `Secure` flag should be checked ✅
   - ✅ `SameSite` should be `Strict` ✅
   - ✅ `Path` should be `/`
   - ✅ `Expires` should be 24 hours from now

6. **Verify Login Succeeds:**
   - ✅ Redirected to `/dashboard`
   - ✅ No errors in Console tab
   - ✅ User data loaded

### Test 3: Check API Requests Use Cookie

1. **Stay logged in**
2. **F12 → Network tab**
3. **Navigate to different pages (Products, Sales, etc.)**
4. **Click on any API request**
5. **Check Request Headers:**
   - ✅ Should show: `Cookie: jwt=eyJhbGciOiJIUzI1NiIs...`
   - ❌ Should NOT show: `Authorization: Bearer ...`

### Test 4: Session Restore on Page Refresh

1. **While logged in, press Ctrl+Shift+R (hard refresh)**
2. **Check Network tab:**
   - ✅ Should see request to `GET /api/auth/me`
   - ✅ Should return user data
   - ✅ User stays logged in (not redirected to login)

### Test 5: Logout Clears Cookie

1. **Click Logout button**
2. **F12 → Application → Cookies**
3. **Verify:**
   - ✅ `jwt` cookie is removed
   - ✅ Redirected to `/login`

### Test 6: XSS Protection Test (Security Verification)

1. **Login successfully**
2. **F12 → Console tab**
3. **Run this command:**
   ```javascript
   document.cookie
   ```
4. **Expected result:**
   - ❌ You should NOT see the `jwt` cookie in the output
   - ✅ This proves the cookie is httpOnly (JavaScript cannot access it)

---

## 🔍 Troubleshooting

### Issue 1: Login succeeds but no cookie is set

**Check:**
1. Backend logs in Render for errors
2. CORS configuration has `credentials: true` ✅ (already configured)
3. Frontend axios has `withCredentials: true` ✅ (already added)
4. Response headers include `Set-Cookie`

**Solution:**
- Most likely a CORS issue
- Verify ALLOWED_ORIGINS in Render includes frontend URL

### Issue 2: Cookie is set but not sent with API requests

**Check:**
1. Cookie domain matches API domain
2. Cookie hasn't expired
3. Axios withCredentials is true

**Solution:**
- Clear all cookies and try login again
- Check cookie domain in DevTools

### Issue 3: "Not authenticated" error after page refresh

**Check:**
1. `GET /api/auth/me` endpoint returns 401
2. Cookie exists in Application → Cookies
3. Backend logs for JWT verification errors

**Solution:**
- JWT might have expired
- Logout and login again
- Check backend logs for detailed error

### Issue 4: CORS error appears

**Check:**
1. Render environment variable `ALLOWED_ORIGINS`
2. Backend CORS config includes frontend URL
3. Backend has been redeployed after env var change

**Solution:**
- Update ALLOWED_ORIGINS in Render
- Wait for redeploy
- Hard refresh frontend (Ctrl+Shift+R)

---

## 📊 Comparison: Before vs After

### Before Migration (localStorage)

**Security:**
- ❌ Vulnerable to XSS attacks
- ❌ Token visible in DevTools
- ❌ Can be stolen by malicious JavaScript

**Implementation:**
```javascript
// Login response
{ token: "eyJ...", user: {...} }

// Storage
localStorage.setItem("token", token)

// Usage
Authorization: Bearer eyJ...
```

### After Migration (httpOnly Cookie)

**Security:**
- ✅ Protected from XSS attacks
- ✅ Token NOT accessible to JavaScript
- ✅ HttpOnly + Secure + SameSite flags

**Implementation:**
```javascript
// Login response
{ user: {...} }  // No token!

// Storage (automatic)
Set-Cookie: jwt=eyJ...; HttpOnly; Secure; SameSite=Strict

// Usage (automatic)
Cookie: jwt=eyJ...
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [x] Code changes committed
- [x] Code pushed to GitHub
- [x] No TypeScript/ESLint errors
- [x] Documentation created

### Backend Deployment
- [ ] Render shows "Deploying..." status
- [ ] Render deployment completes successfully
- [ ] `/health` endpoint returns "healthy"
- [ ] `/api/auth/health` endpoint returns "healthy"
- [ ] Logs show no errors

### Frontend Deployment
- [ ] `npm run build` completes successfully
- [ ] `firebase deploy --only hosting` succeeds
- [ ] Frontend loads without errors
- [ ] No console errors on login page

### Post-Deployment Testing
- [ ] Login succeeds
- [ ] `jwt` cookie is set with HttpOnly flag
- [ ] API requests include cookie
- [ ] Page refresh maintains session
- [ ] Logout clears cookie
- [ ] XSS protection verified (cookie not accessible to JS)

---

## 🎉 Success Criteria

When everything is working correctly:

1. ✅ **Login**: Cookie set, user redirected to dashboard
2. ✅ **API Calls**: Cookie sent automatically, no Bearer token needed
3. ✅ **Page Refresh**: Session restored via `/api/auth/me`
4. ✅ **Logout**: Cookie cleared, redirected to login
5. ✅ **Security**: JavaScript cannot access JWT token
6. ✅ **No Errors**: Console and Network tabs clean

---

## 📞 Support

If you encounter issues after deployment:

1. **Share Backend Logs:**
   - Render Dashboard → Logs
   - Last 50 lines showing errors

2. **Share Frontend Console:**
   - F12 → Console tab
   - Screenshot of errors

3. **Share Network Tab:**
   - F12 → Network tab
   - Screenshot of failed request
   - Request/Response headers

4. **Share Cookie Info:**
   - F12 → Application → Cookies
   - Screenshot showing cookie details

---

## 📚 Additional Documentation

- **Complete migration guide:** `JWT_SECURITY_MIGRATION.md`
- **Authentication audit:** `AUTH_AUDIT_REPORT.md`
- **RBAC audit:** `RBAC_AUDIT_REPORT.md`
- **Deployment guide:** `DEPLOYMENT_GUIDE.md`

---

**Deployment Status:** ⏳ Awaiting Render deployment  
**Estimated Time:** 5-10 minutes  
**Risk Level:** Low (backward compatible with fallback to Authorization header)

**Last Updated:** June 15, 2026  
**Commit:** 8173825
