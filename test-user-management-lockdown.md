# Test Plan: User Management Lockdown

## Quick Test Commands

### Test 1: Verify Backend Permissions (Local)

```bash
# Start backend server
cd server
npm run dev
```

### Test 2: SHOP_ADMIN API Test (Should Fail with 403)

```bash
# Login as SHOP_ADMIN first to get JWT token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "healthcaresurgicalmart@gmail.com",
    "password": "YOUR_PASSWORD"
  }'

# Copy the token from response, then test:

# Try to list users (should fail with 403)
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_SHOP_ADMIN_TOKEN"

# Expected Response:
# {
#   "success": false,
#   "message": "Insufficient permissions",
#   "required": "view_users",
#   "userRole": "SHOP_ADMIN"
# }

# Try to create user (should fail with 403)
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_SHOP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "STAFF"
  }'

# Expected Response:
# {
#   "success": false,
#   "message": "Insufficient permissions",
#   "required": "create_user",
#   "userRole": "SHOP_ADMIN"
# }
```

### Test 3: SUPER_ADMIN API Test (Should Succeed)

```bash
# Login as SUPER_ADMIN to get JWT token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mahimrahman07@gmail.com",
    "password": "YOUR_PASSWORD"
  }'

# Copy the token, then test:

# List users (should succeed with 200)
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"

# Expected Response:
# {
#   "success": true,
#   "data": [ ... array of users ... ]
# }

# Create user (should succeed with 201)
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Staff",
    "email": "teststaff@example.com",
    "password": "password123",
    "role": "STAFF"
  }'

# Expected Response:
# {
#   "success": true,
#   "message": "User created successfully",
#   "data": { ... user object ... }
# }
```

### Test 4: Frontend Test (Manual)

**SHOP_ADMIN Test**:
1. Open browser: https://health-care-60ee6.web.app/login
2. Login as `healthcaresurgicalmart@gmail.com`
3. Navigate to Settings
4. **VERIFY**: "User Management" tab is NOT visible
5. Try direct URL: https://health-care-60ee6.web.app/settings (then click tabs)
6. **VERIFY**: All other tabs work (Shop, Tax, System, Receipt, Backup)
7. **VERIFY**: Can still access POS, Products, Sales, etc.

**SUPER_ADMIN Test**:
1. Logout
2. Login as `mahimrahman07@gmail.com`
3. Navigate to Settings
4. **VERIFY**: "User Management" tab IS visible
5. Click "User Management" tab
6. **VERIFY**: "+ Add User" button IS visible
7. **VERIFY**: Can see user list
8. **VERIFY**: Edit/Delete buttons visible for all users (except self)

### Test 5: Check Browser Console

With SHOP_ADMIN logged in:
1. Open DevTools (F12)
2. Go to Settings page
3. **VERIFY**: No JavaScript errors
4. Try to create user via API (should fail):
   ```javascript
   // In browser console:
   fetch('https://health-care-surgical-mart.onrender.com/api/users', {
     method: 'POST',
     credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       name: 'Hacker User',
       email: 'hacker@test.com',
       password: 'password123',
       role: 'SHOP_ADMIN'
     })
   }).then(r => r.json()).then(console.log)
   ```
5. **VERIFY**: Response is 403 Forbidden

## Production Testing Checklist

After deployment to production:

- [ ] **SHOP_ADMIN cannot see User Management tab**
- [ ] **SHOP_ADMIN gets 403 on GET /api/users**
- [ ] **SHOP_ADMIN gets 403 on POST /api/users**
- [ ] **SHOP_ADMIN gets 403 on PUT /api/users/:id**
- [ ] **SHOP_ADMIN gets 403 on DELETE /api/users/:id**
- [ ] **SHOP_ADMIN can still access POS**
- [ ] **SHOP_ADMIN can still access Products**
- [ ] **SHOP_ADMIN can still access Reports**
- [ ] **SUPER_ADMIN can see User Management tab**
- [ ] **SUPER_ADMIN can list users**
- [ ] **SUPER_ADMIN can create users**
- [ ] **SUPER_ADMIN can edit users**
- [ ] **SUPER_ADMIN can delete users**
- [ ] **No JavaScript errors in console**
- [ ] **No broken UI elements**

## Security Verification

Run these checks after deployment:

```bash
# 1. Verify RBAC permissions
node -e "
const rbac = require('./server/src/utils/rbac.js');
console.log('SHOP_ADMIN permissions:', rbac.ROLE_PERMISSIONS.SHOP_ADMIN);
console.log('Has VIEW_USERS?', rbac.ROLE_PERMISSIONS.SHOP_ADMIN.includes('view_users'));
console.log('Has CREATE_STAFF?', rbac.ROLE_PERMISSIONS.SHOP_ADMIN.includes('create_staff'));
console.log('Has CREATE_USER?', rbac.ROLE_PERMISSIONS.SHOP_ADMIN.includes('create_user'));
"

# Expected output:
# Has VIEW_USERS? false
# Has CREATE_STAFF? false
# Has CREATE_USER? false
```

## Rollback Plan

If tests fail, rollback immediately:

```bash
# Backend rollback
cd server
git log --oneline -5  # Find the commit before lockdown
git revert <commit-hash>
git push origin main

# Frontend rollback
cd client
git log --oneline -5
git revert <commit-hash>
npm run build
firebase deploy --only hosting
```

## Expected Behavior Summary

| Role | View Tab | Add User | Edit User | Delete User | API Access |
|------|----------|----------|-----------|-------------|------------|
| SUPER_ADMIN | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| SHOP_ADMIN | ❌ No | ❌ No | ❌ No | ❌ No | ❌ 403 |
| STAFF | ❌ No | ❌ No | ❌ No | ❌ No | ❌ 403 |

## Support Information

If issues arise:
- Check `USER_MANAGEMENT_LOCKDOWN.md` for full implementation details
- Review Render logs: https://dashboard.render.com/
- Review Firebase hosting logs
- Contact: mahimrahman07@gmail.com
