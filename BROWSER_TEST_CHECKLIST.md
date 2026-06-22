# BROWSER TEST CHECKLIST — Health Care Surgical Mart
**Test URL:** https://health-care-60ee6.web.app  
**Date:** 2026-06-22  
**Tester:** _____________

---

## SETUP INSTRUCTIONS

1. Open Chrome/Firefox/Safari browser
2. Navigate to: https://health-care-60ee6.web.app
3. Login with SHOP_ADMIN credentials:
   - Email: `admin@healthcaresurgicalmart.com`
   - Password: `Admin@12345`
4. Keep DevTools open (F12) for console errors

---

## TEST 3a — PRINT RECEIPT ✅ / ❌

**Purpose:** Verify invoice prints correctly with dynamic shop name from settings.

### Steps:

1. **Update shop name first (to verify dynamic loading):**
   - Go to **Settings** page
   - Click **Shop** tab
   - Change shop name to: `Health Care Test Shop`
   - Click **Save Settings**
   - Wait for success message

2. **Create a test sale:**
   - Go to **Sales (POS)** page
   - Search for any product (e.g., "Aspirin")
   - Add to cart: Qty = 1
   - Enter cash paid = 10
   - Click **Complete Sale**
   - Invoice modal should appear

3. **Click Print button** in the invoice modal
   - Browser print preview opens

4. **Verify in print preview:**
   - [ ] Shop name shows **"Health Care Test Shop"** (not the hardcoded "Health Care Surgical Mart")
   - [ ] Invoice number is present (e.g., INV-202606-00006)
   - [ ] Date **and time** are shown (not just date)
   - [ ] Product name, quantity, rate, total are visible
   - [ ] Sidebar is **NOT visible** in print preview
   - [ ] Navigation menu is **NOT visible**
   - [ ] Only invoice content is shown
   - [ ] Layout fits on A4 page (no cutoff)

5. **Restore original shop name:**
   - Cancel print
   - Go back to Settings > Shop
   - Change name back to: `Health Care Surgical Mart`
   - Save

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** ___________________________________________

---

## TEST 3b — CART CLEARS AFTER SALE ✅ / ❌

**Purpose:** Verify cart resets completely after completing a sale.

### Steps:

1. Go to **Sales (POS)** page
2. Add 2 different products to cart
3. Enter customer name: "Test Customer"
4. Enter cash paid to cover total
5. Click **Complete Sale**
6. Wait for invoice modal to appear
7. Close the invoice modal

### Verify:
- [ ] Cart is **empty** (no items)
- [ ] Product search field is **cleared**
- [ ] Customer name reset to "Cash Customer"
- [ ] Cash paid field reset to 0
- [ ] Invoice number has **incremented** (next sale shows next number)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** ___________________________________________

---

## TEST 3c — INSUFFICIENT STOCK ERROR ✅ / ❌

**Purpose:** Verify stock validation prevents overselling.

### Steps:

1. Go to **Sales (POS)** page
2. Search and select any product
3. Check the product's current stock (shown in the dropdown or product info)
4. Enter quantity: **9999** (far exceeds stock)
5. Try to add to cart

### Verify:
- [ ] **Red error message** appears
- [ ] Error says "Only X units available" or "Insufficient stock"
- [ ] Product is **NOT added** to cart
- [ ] Page does **NOT crash** or freeze
- [ ] Error disappears after 3 seconds or when dismissed

**Bonus check:** Try entering `stock + 1` (e.g., if stock is 50, try 51):
- [ ] Error appears correctly

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** ___________________________________________

---

## TEST 3d — CUSTOMER RETURN FLOW ✅ / ❌

**Purpose:** Verify full return workflow increases stock correctly.

### Steps:

1. **Note the invoice number from Test 3a or 3b** (e.g., INV-202606-00006)

2. **Check product stock before return:**
   - Go to **Stock Report**
   - Find the product that was sold (e.g., "Aspirin 75mg")
   - Note its current stock quantity: **_______**

3. **Create a return:**
   - Go to **Returns** page
   - Click **New Return** (or similar button)
   - Enter the invoice number from step 1
   - Or search by date/customer
   - Select the sale

4. **Select items to return:**
   - Check the product sold
   - Enter return quantity: **1**
   - Click **Submit** or **Process Return**
   - Wait for success message

5. **Verify stock increased:**
   - Go back to **Stock Report**
   - Find the same product
   - New stock should be: **previous stock + 1**
   - [ ] Stock quantity increased correctly

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** ___________________________________________

---

## TEST 3e — SESSION EXPIRY REDIRECT ✅ / ❌

**Purpose:** Verify expired sessions redirect to login (not blank page).

### Steps:

1. Make sure you're logged in to the app
2. Open browser **DevTools** (F12)
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Find **Local Storage** → `https://health-care-60ee6.web.app`
5. Locate the JWT token entry (key name might be `token`, `authToken`, or `firebase:authUser:...`)
6. **Delete** the token entry
7. Navigate to any page (e.g., click **Dashboard** in the menu)

### Verify:
- [ ] Page **redirects to /login** immediately
- [ ] Login form is shown
- [ ] No blank page
- [ ] No error page
- [ ] No infinite spinner
- [ ] Console has no critical errors (404s are OK)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** ___________________________________________

---

## BONUS TEST — TABLET RESPONSIVE (768px) ✅ / ❌

**Purpose:** Verify POS page is usable on tablets.

### Steps:

1. Open DevTools (F12)
2. Click **Toggle Device Toolbar** (Ctrl+Shift+M)
3. Select **iPad** or set width to **768px**
4. Go to **Sales (POS)** page

### Verify:
- [ ] All sections stack vertically (Customer, Product, Cart)
- [ ] Product search is visible and functional
- [ ] Cart is visible without horizontal scroll
- [ ] Complete Sale button is visible and clickable
- [ ] No text cutoff
- [ ] No horizontal scrollbar on page
- [ ] Cart table shows: Name, Rate, Qty, Total, Action (Category hidden)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** ___________________________________________

---

## ADDITIONAL CHECKS (Optional)

### Print CSS Check:
- [ ] Open invoice modal, press Ctrl+P
- [ ] In print preview, press Ctrl+U (view source)
- [ ] Search for `@media print` — should find CSS rules
- [ ] Verify `.sidebar, nav` have `display: none` in print rules

### Invoice Data Accuracy:
- [ ] Create a sale with 2 products
- [ ] Add discount: 10%
- [ ] Add VAT if enabled
- [ ] Verify invoice calculations:
  - Subtotal = sum of line items ✅ / ❌
  - Discount = subtotal × 10% ✅ / ❌
  - VAT calculated on after-discount amount ✅ / ❌
  - Grand Total = subtotal - discount + VAT ✅ / ❌

### Mobile Layout (375px):
- [ ] Set DevTools to iPhone SE (375px wide)
- [ ] Navigate to POS
- [ ] Page is cramped but functional (expected) ✅ / ❌
- [ ] Note: Full mobile redesign is out of scope

---

## SUMMARY

| Test | Status | Critical? |
|------|--------|-----------|
| 3a - Print Receipt | ⬜ Pass / ⬜ Fail | ✅ Yes |
| 3b - Cart Clears | ⬜ Pass / ⬜ Fail | ✅ Yes |
| 3c - Stock Error | ⬜ Pass / ⬜ Fail | ✅ Yes |
| 3d - Return Flow | ⬜ Pass / ⬜ Fail | ⬜ No |
| 3e - Session Expiry | ⬜ Pass / ⬜ Fail | ✅ Yes |
| Tablet 768px | ⬜ Pass / ⬜ Fail | ⬜ No |

**Overall:** ⬜ ALL PASS / ⬜ SOME FAIL  
**Critical failures:** _____ / 4

---

## ISSUES FOUND

| Issue | Severity | Description |
|-------|----------|-------------|
| 1 | ⬜ Critical / ⬜ Medium / ⬜ Low | |
| 2 | ⬜ Critical / ⬜ Medium / ⬜ Low | |
| 3 | ⬜ Critical / ⬜ Medium / ⬜ Low | |

---

## SIGN-OFF

**Tester Name:** _________________________  
**Date Tested:** _________________________  
**Browser:** ⬜ Chrome ⬜ Firefox ⬜ Safari ⬜ Other: _______  
**Status:** ⬜ READY TO LAUNCH / ⬜ FIXES NEEDED

**Notes:**  
___________________________________________  
___________________________________________  
___________________________________________
