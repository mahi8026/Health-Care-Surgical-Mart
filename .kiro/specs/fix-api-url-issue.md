# Fix API URL Issue - Complete Solution

## Problem Statement
The frontend is making API calls to Vercel (https://health-care-surgical-mart-client.vercel.app/api/...) instead of Render (https://health-care-surgical-mart.onrender.com/api/...), causing 405 errors.

## Root Cause
Environment variables are set in Vercel Dashboard but not being loaded into the application build.

## Requirements

### 1. Verify Environment Variable Loading
- Check that VITE_API_URL is properly loaded in production
- Add console logs to verify the value
- Ensure the variable is available at build time

### 2. Fix API Service Configuration
- Ensure both api.js and constants.js use the environment variable correctly
- Add fallback handling
- Add debug logging

### 3. Force Vercel Rebuild
- Trigger a fresh deployment
- Clear any cached builds
- Verify new build uses correct environment variables

## Design

### Solution 1: Add Debug Logging
Add explicit logging to see what's happening:

```javascript
// In api.js and constants.js
console.log('Environment:', import.meta.env.MODE);
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('All env vars:', import.meta.env);
```

### Solution 2: Hardcode for Testing
Temporarily hardcode the URL to verify it works:

```javascript
const API_BASE_URL = 'https://health-care-surgical-mart.onrender.com/api';
```

### Solution 3: Check Vercel Build Logs
- Review build logs to see if environment variables are injected
- Check for any warnings about environment variables

## Implementation Tasks

### Task 1: Add Debug Logging to API Files
- [ ] Add logging to client/src/services/api.js
- [ ] Add logging to client/src/config/constants.js
- [ ] Commit and push changes

### Task 2: Verify Vercel Configuration
- [ ] Check Vercel Dashboard environment variables
- [ ] Verify variables are set for "Production" environment
- [ ] Check if variables need to be set for "Preview" and "Development" too

### Task 3: Force Clean Rebuild
- [ ] Delete .vercel folder if exists
- [ ] Trigger manual redeploy in Vercel
- [ ] Check build logs for environment variable injection

### Task 4: Test Temporary Hardcode
- [ ] Temporarily hardcode the Render URL
- [ ] Deploy and test
- [ ] If it works, environment variable is the issue
- [ ] Revert hardcode and fix environment variable loading

## Testing

### Test 1: Check Console Logs
After deployment, open browser console and verify:
- Environment mode is shown
- VITE_API_URL value is shown
- All environment variables are listed

### Test 2: Check Network Tab
- Verify API calls go to Render URL
- No 405 errors
- Login works

### Test 3: Check Build Logs
- Review Vercel build logs
- Look for environment variable injection
- Check for any warnings

## Acceptance Criteria
- [ ] API calls go to https://health-care-surgical-mart.onrender.com/api/...
- [ ] No 405 errors
- [ ] Login works successfully
- [ ] Console shows correct VITE_API_URL value
- [ ] Network tab shows requests to Render, not Vercel

