# Deployment Checklist - User Management Lockdown

**Date**: June 15, 2026  
**Critical Security Fix**: Lock User Management to SUPER_ADMIN Only

---

## ✅ Pre-Deployment Checklist

### Code Review
- [x] Backend RBAC permissions updated (`server/src/utils/rbac.js`)
- [x] Backend route permissions updated (`server/src/routes/users.routes.js`)
- [x] Frontend permissions updated (`client/src/utils/permissions.js`)
- [x] Settings tab filtering added (`client/src/pages/Settings.jsx`)
- [x] UserManagement buttons hidden (`client/src/components/UserManagement.jsx`)
- [x] No TypeScript/ESLint errors
- [x] Documentation created

### Testing (Local)
- [ ] Backend server starts without errors
- [ ] Frontend builds without errors
- [ ] SHOP_ADMIN cannot access GET /api/users (403)
- [ ] SHOP_ADMIN cannot access POST /api/users (403)
- [ ] SUPER_ADMIN can access GET /api/users (200)
- [ ] SUPER_ADMIN can access POST /api/users (201)
- [ ] SHOP_ADMIN doesn't see User Management tab
- [ ] SUPER_ADMIN sees User Management tab

### Git Preparation
- [ ] All changes committed to local branch
- [ ] Commit messages are clear and descriptive
- [ ] No uncommitted changes remain

---

## 🚀 Deployment Steps

### Step 1: Backend Deployment
- [ ] Push backend changes to GitHub main branch
- [ ] Verify Render auto-deploy started
- [ ] Wait for Render build to complete (~5 minutes)
- [ ] Check Render logs for errors
- [ ] Test backend health: `curl https://health-care-surgical-mart.onrender.com/health`

### Step 2: Frontend Deployment
- [ ] Run `cd client && npm run build`
- [ ] Verify build completed without errors
- [ ] Run `firebase deploy --only hosting`
- [ ] Verify Firebase deployment succeeded
- [ ] Check Firebase hosting dashboard

### Step 3: Cache Clearing
- [ ] Clear browser cache (Ctrl+Shift+Del)
- [ ] Open incognito/private window for testing
- [ ] Hard refresh (Ctrl+F5) on production site

---

## 🧪 Post-Deployment Testing

### Backend API Testing

#### Test with SHOP_ADMIN
Login as: `healthcaresurgicalmart@gmail.com`

- [ ] GET /api/users → Returns **403 Forbidden**
- [ ] POST /api/users → Returns **403 Forbidden**
- [ ] PUT /api/users/:id → Returns **403 Forbidden**
- [ ] DELETE /api/users/:id → Returns **403 Forbidden**

Response should be:
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "required": "view_users",
  "userRole": "SHOP_ADMIN"
}
```

#### Test with SUPER_ADMIN
Login as: `mahimrahman07@gmail.com` or `superadmin@medicalpos.com`

- [ ] GET /api/users → Returns **200 OK** with user list
- [ ] POST /api/users → Returns **201 Created**
- [ ] PUT /api/users/:id → Returns **200 OK**
- [ ] DELETE /api/users/:id → Returns **200 OK**

### Frontend UI Testing

#### Test as SHOP_ADMIN
Login: `healthcaresurgicalmart@gmail.com`

- [ ] Navigate to Dashboard → Works ✅
- [ ] Navigate to POS → Works ✅
- [ ] Navigate to Products → Works ✅
- [ ] Navigate to Sales History → Works ✅
- [ ] Navigate to Reports → Works ✅
- [ ] Navigate to Settings → Works ✅
- [ ] In Settings, User Management tab is **NOT visible** ✅
- [ ] Try direct URL: `/settings` with manual tab switch → User Management content hidden ✅
- [ ] No JavaScript errors in console ✅

#### Test as SUPER_ADMIN
Login: `mahimrahman07@gmail.com`

- [ ] Navigate to Dashboard → Works ✅
- [ ] Navigate to Settings → Works ✅
- [ ] User Management tab **IS visible** ✅
- [ ] Click User Management tab → Opens successfully ✅
- [ ] User list loads ✅
- [ ] "+ Add User" button **IS visible** ✅
- [ ] Click "+ Add User" → Modal opens ✅
- [ ] Create test user → Success ✅
- [ ] Edit user button visible ✅
- [ ] Delete user button visible ✅
- [ ] No JavaScript errors in console ✅

#### Test as STAFF
Login: `staff@shop.com` (if active)

- [ ] Navigate to Dashboard → Works ✅
- [ ] Settings not visible in navigation ✅
- [ ] Direct URL to `/settings` → Should redirect or show limited view ✅

### Security Testing

#### Attempt Bypass (SHOP_ADMIN)
- [ ] Try API call in browser console → Returns 403
- [ ] Try direct tab manipulation → Content still hidden
- [ ] Try modifying localStorage → No effect (cookies used)
- [ ] Try modified fetch request → Returns 403

#### Verify Defense in Depth
- [ ] RBAC middleware blocks request → Yes ✅
- [ ] Controller-level check blocks request → Yes ✅
- [ ] Frontend hides UI elements → Yes ✅

---

## 📊 Monitoring

### First 24 Hours After Deployment
- [ ] Check Render logs for 403 errors (expected from SHOP_ADMIN)
- [ ] Monitor error rates in Render dashboard
- [ ] Check Firebase analytics for errors
- [ ] Monitor support channels for user complaints

### Check These Metrics
- [ ] No 500 errors on user endpoints
- [ ] 403 errors for SHOP_ADMIN (expected, not a bug)
- [ ] SUPER_ADMIN can still create users successfully
- [ ] No spike in frontend JavaScript errors

---

## 🆘 Rollback Plan

If critical issues arise:

### Issue: Backend Errors
```bash
# Rollback backend
git log --oneline -5
git revert <backend-commit-hash>
git push origin main
# Wait for Render to redeploy
```

### Issue: Frontend Errors
```bash
# Rollback frontend
git log --oneline -5
git revert <frontend-commit-hash>
cd client
npm run build
firebase deploy --only hosting
```

### Issue: SUPER_ADMIN Can't Access
**DO NOT ROLLBACK** - This indicates a different problem.
1. Check if logged in as correct user
2. Check browser console for errors
3. Check if cookie is being set
4. Try incognito window

---

## 📞 Communication Plan

### Notify These People
- [ ] System administrator (you)
- [ ] Other SUPER_ADMIN users
- [ ] SHOP_ADMIN users (explain they lost user management access)

### Message Template for SHOP_ADMIN
```
Subject: Security Update - User Management Changes

We've deployed a security update that restricts user management 
to system administrators only.

What changed:
- The "User Management" tab is no longer visible in Settings
- You can no longer create or edit user accounts
- All other features remain unchanged (POS, Products, Sales, Reports, etc.)

Why this change:
- Enhanced security and compliance
- Centralized user management
- Prevention of unauthorized account creation

What you can still do:
- Everything related to daily operations
- POS transactions
- Product management
- Sales and reports
- Customer management
- Expense tracking

If you need a new user account created, please contact:
Email: mahimrahman07@gmail.com

Thank you for your understanding.
```

---

## 📝 Post-Deployment Actions

### Immediate (Within 1 Hour)
- [ ] Verify all tests passed
- [ ] Document any issues encountered
- [ ] Notify team of successful deployment

### Short-term (Within 24 Hours)
- [ ] Monitor error logs
- [ ] Respond to user questions
- [ ] Update user documentation if needed

### Long-term (Within 1 Week)
- [ ] Review audit logs for unusual activity
- [ ] Confirm no bypass attempts succeeded
- [ ] Consider additional security hardening

---

## 📚 Documentation Reference

- **USER_MANAGEMENT_LOCKDOWN.md** - Full implementation details
- **test-user-management-lockdown.md** - Testing procedures
- **LOCKDOWN_CHANGES_SUMMARY.md** - Line-by-line changes
- **RBAC_BEFORE_AFTER.md** - Visual comparison
- **QUICK_DEPLOYMENT_GUIDE.md** - Fast deployment steps

---

## ✅ Final Sign-Off

### Before Deployment
- [ ] All pre-deployment checks complete
- [ ] Backup of current production state taken
- [ ] Rollback plan documented and understood
- [ ] Team notified of deployment window

### After Deployment
- [ ] All post-deployment tests passed
- [ ] No critical errors in logs
- [ ] Users notified of changes
- [ ] Documentation updated

### Deployment Approved By
- [ ] Developer: ___________________ Date: ___________
- [ ] System Admin: ________________ Date: ___________

---

## 🎯 Success Criteria

Deployment is considered successful when:

1. ✅ SHOP_ADMIN cannot see User Management tab
2. ✅ SHOP_ADMIN gets 403 on all user endpoints
3. ✅ SUPER_ADMIN can see User Management tab
4. ✅ SUPER_ADMIN can create/edit/delete users
5. ✅ No JavaScript errors in console
6. ✅ All other features work for SHOP_ADMIN
7. ✅ No 500 errors in backend logs
8. ✅ Users can still login and work normally

---

**Deployment Status**: ⏳ Pending

Update this document as you complete each step!
