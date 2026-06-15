# 🔒 JWT Security Migration: localStorage → httpOnly Cookies

## Overview
**Migration completed:** June 15, 2026  
**Security Improvement:** JWT tokens moved from localStorage to httpOnly cookies

### ✅ Benefits
1. **XSS Protection:** JavaScript cannot access the JWT token
2. **Automatic Transmission:** Browser sends cookie with every request
3. **Secure Flag:** HTTPS-only transmission in production
4. **SameSite Protection:** CSRF protection with SameSite=Strict

---

## 🔧 Changes Made

### Backend Changes

#### 1. **Installed cookie-parser**
```bash
npm install cookie-parser
```

#### 2. **Updated server.js**
- Added `const cookieParser = require("cookie-parser")`
- Added `app.use(cookieParser())` middleware

#### 3. **Updated auth-multi-tenant.routes.js**

**Login endpoints (POST /api/auth/login and POST /api/auth/firebase-login):**
- Now set JWT as httpOnly cookie instead of returning it in response body
- Cookie configuration:
  ```javascript
  res.cookie('jwt', token, {
    httpOnly: true,           // Cannot be accessed by JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',       // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
  ```
- Response now returns ONLY user data (no token field)

**New endpoint: POST /api/auth/logout**
- Clears the JWT cookie
- Returns success message

**New endpoint: GET /api/auth/me**
- Reads JWT from httpOnly cookie
- Verifies token and returns user data
- Used for session restoration on page refresh
- Returns 401 if cookie missing or token invalid

#### 4. **Updated auth-multi-tenant.js middleware**

**authenticate() function:**
- Now reads JWT from cookie first (preferred)
- Falls back to Authorization header (backward compatibility)
- Code:
  ```javascript
  let token;
  if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  } else if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.substring(7);
  }
  ```

---

### Frontend Changes

#### 1. **Updated client/src/config/api.js**

**Removed:**
- Authorization header injection in request interceptor
- `localStorage.getItem("token")` calls

**Added:**
- `withCredentials: true` in axios instance config
- This tells axios to send cookies with every request

**Request interceptor:**
```javascript
api.interceptors.request.use(
  (config) => {
    // No need to manually add Authorization header
    // The browser automatically sends the httpOnly cookie
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);
```

**Response interceptor:**
- Changed to only clear user from localStorage (not token)
- Cookie is automatically managed by browser

#### 2. **Updated client/src/contexts/AuthContext.jsx**

**Removed:**
- `const [token, setToken] = useState(localStorage.getItem("token"))`
- All `localStorage.setItem("token", ...)` calls
- All `localStorage.getItem("token")` calls
- `token` from context value export

**Updated login() function:**
- Now only stores user data in localStorage (not token)
- Backend automatically sets cookie

**Updated logout() function:**
- Calls `POST /api/auth/logout` to clear cookie
- Removes user from localStorage

**Updated session restoration (useEffect):**
- Calls `GET /api/auth/me` to verify session on page refresh
- If valid, restores user state
- If invalid, clears localStorage and signs out

**Updated token refresh:**
- Still refreshes Firebase token every 50 minutes
- Backend automatically updates JWT cookie

---

## 🔍 CORS Configuration

### Already Configured ✅
```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [...];
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,  // ✅ CRITICAL: Allows cookies to be sent
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
```

**Important:**
- `credentials: true` allows cookies to be sent cross-origin
- `origin` must be explicitly set (cannot be `*` when using credentials)

---

## 🧪 Testing Guide

### Test 1: Login
1. Open: https://health-care-60ee6.web.app/login
2. Press F12 → Application tab → Cookies
3. Login with valid credentials
4. ✅ Check: New cookie named `jwt` appears
5. ✅ Check: Cookie has `HttpOnly` flag checked
6. ✅ Check: Cookie has `Secure` flag checked (production only)
7. ✅ Check: Cookie has `SameSite=Strict`

### Test 2: API Calls After Login
1. Stay logged in
2. F12 → Network tab
3. Navigate to dashboard or make an API call
4. Click on any API request
5. ✅ Check: Request Headers show `Cookie: jwt=...`
6. ✅ Check: No `Authorization: Bearer ...` header

### Test 3: Page Refresh (Session Restore)
1. Login successfully
2. F12 → Console
3. Hard refresh: Ctrl+Shift+R
4. ✅ Check: Console shows no errors
5. ✅ Check: User remains logged in
6. ✅ Check: Network tab shows `GET /api/auth/me` request
7. ✅ Check: `/api/auth/me` returns user data

### Test 4: Logout
1. Click logout button
2. F12 → Application → Cookies
3. ✅ Check: `jwt` cookie is removed
4. ✅ Check: Redirected to /login
5. ✅ Check: Network tab shows `POST /api/auth/logout`

### Test 5: Token Expiry (24 hours later)
1. Wait 24 hours (or manually delete cookie)
2. Try to access protected page
3. ✅ Check: Redirected to /login
4. ✅ Check: Shows "Session expired" or similar message

### Test 6: XSS Protection Test
1. Login successfully
2. F12 → Console
3. Try to access cookie:
   ```javascript
   document.cookie
   ```
4. ✅ Check: `jwt` cookie is NOT visible in the output
5. ✅ Check: Only non-httpOnly cookies are visible

---

## 🚀 Deployment Checklist

### Backend (Render)

- [x] Install cookie-parser: `npm install cookie-parser`
- [x] Update server.js with cookie-parser middleware
- [x] Update auth-multi-tenant.routes.js (login/logout/me endpoints)
- [x] Update auth-multi-tenant.js (middleware to read from cookie)
- [ ] Commit and push to GitHub
- [ ] Wait for Render auto-deploy
- [ ] Verify ALLOWED_ORIGINS is set in Render env vars
- [ ] Test `/api/auth/health` endpoint

### Frontend (Firebase Hosting)

- [x] Update api.js with `withCredentials: true`
- [x] Update AuthContext.jsx (remove token, call /me endpoint)
- [ ] Commit and push to GitHub
- [ ] Build: `cd client && npm run build`
- [ ] Deploy: `firebase deploy --only hosting`
- [ ] Test login flow

---

## 📊 Before vs After

### Before (localStorage)
```javascript
// Login response
{
  token: "eyJhbGciOiJIUzI1NiIs...",  // ❌ Exposed to JavaScript
  user: { ... }
}

// Stored in localStorage
localStorage.setItem("token", token);  // ❌ Vulnerable to XSS

// Sent with requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  // ❌ Manual header injection
```

### After (httpOnly Cookie)
```javascript
// Login response
{
  user: { ... }  // ✅ No token in response
}

// Set-Cookie header (automatic)
Set-Cookie: jwt=eyJhbGciOiJIUzI1NiIs...; HttpOnly; Secure; SameSite=Strict  // ✅ XSS-proof

// Sent with requests (automatic)
Cookie: jwt=eyJhbGciOiJIUzI1NiIs...  // ✅ Browser handles it
```

---

## 🔐 Security Analysis

### Threats Mitigated

1. **XSS (Cross-Site Scripting)**
   - ❌ Before: Attacker could steal token via `localStorage.getItem("token")`
   - ✅ After: Token in httpOnly cookie - inaccessible to JavaScript

2. **Token Exposure in DevTools**
   - ❌ Before: Token visible in Application → Local Storage
   - ✅ After: Token hidden (can see cookie exists, but not the value in JS context)

3. **Accidental Logging**
   - ❌ Before: Token could be logged in console or error tracking
   - ✅ After: Token never enters JavaScript scope

### Remaining Considerations

1. **CSRF (Cross-Site Request Forgery)**
   - ✅ Mitigated by `SameSite=Strict`
   - ✅ Browser won't send cookie from cross-site requests

2. **Man-in-the-Middle**
   - ✅ Mitigated by `Secure` flag in production (HTTPS only)

3. **Session Hijacking**
   - ⚠️ If attacker gets the cookie (e.g., network sniffing), they can use it
   - ✅ Short expiry (24h) limits exposure window
   - ✅ Automatic refresh keeps session alive for legitimate users

---

## 🐛 Troubleshooting

### Issue: Cookie not being set

**Symptoms:**
- Login succeeds but no cookie in Application → Cookies
- Subsequent requests fail with 401

**Solutions:**
1. Check backend logs for errors during cookie setting
2. Verify CORS has `credentials: true`
3. Verify frontend has `withCredentials: true` in axios config
4. Check if HTTPS (production) or HTTP (development) matches cookie `secure` flag

### Issue: Cookie not being sent with requests

**Symptoms:**
- Cookie exists but API calls return 401
- Network tab shows no `Cookie` header

**Solutions:**
1. Check axios config has `withCredentials: true`
2. Check CORS configuration on backend
3. Verify cookie domain matches request domain
4. Check cookie hasn't expired

### Issue: Session not restoring on page refresh

**Symptoms:**
- User gets logged out on page refresh
- `/api/auth/me` returns 401

**Solutions:**
1. Check cookie is persisted (not session-only)
2. Check `maxAge` is set in cookie options
3. Check backend `/api/auth/me` endpoint is working
4. Verify JWT hasn't expired

---

## 📚 Additional Resources

- [OWASP: HttpOnly Cookie Flag](https://owasp.org/www-community/HttpOnly)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [Express cookie-parser docs](https://expressjs.com/en/resources/middleware/cookie-parser.html)
- [Axios withCredentials](https://axios-http.com/docs/req_config)

---

**Migration Status:** ✅ Complete  
**Security Level:** High (XSS protected)  
**Production Ready:** Yes (after deployment)

**Last Updated:** June 15, 2026
