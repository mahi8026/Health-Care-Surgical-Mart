# Testing Sales History Feature

## Prerequisites

1. **Server Running**: Ensure backend server is running on port 5001
2. **Client Running**: Ensure frontend is running on port 3000
3. **Database**: MongoDB should be connected
4. **Authentication**: You need to be logged in

## Fixed Issues

### ✅ Sentry Initialization Error
**Problem**: Server was crashing with "Cannot read properties of undefined (reading 'Http')"

**Solution**: Updated `server/src/config/sentry.js` to handle missing Sentry integrations gracefully. The integrations array is now empty but Sentry will still work for basic error tracking.

**Status**: Fixed - Server should now start without crashing

## Testing Steps

### 1. Start the Application

```bash
# Terminal 1 - Start Server
cd server
npm run dev

# Terminal 2 - Start Client
cd client
npm run dev
```

**Expected**: 
- Server runs on http://localhost:5001
- Client runs on http://localhost:3000
- No crash errors

### 2. Login to Application

1. Open http://localhost:3000
2. Login with your credentials
3. You should see the dashboard

### 3. Access Sales History

**Method 1: Via Navigation**
1. Look at the left sidebar
2. Find "Sales History" menu item (with history icon)
3. Click on it

**Method 2: Direct URL**
1. Navigate to http://localhost:3000/sales-history

**Expected**:
- Page loads without errors
- You see the Sales History page with filters
- Table shows existing sales (if any)
- If no sales, you see "No sales found" message

### 4. Test Filters

#### Test Search
1. Type an invoice number in the search box
2. Click "Apply Filters"
3. Results should filter

#### Test Date Range
1. Select a start date
2. Select an end date
3. Click "Apply Filters"
4. Only sales in that range should show

#### Test Payment Status
1. Select "Paid" from dropdown
2. Click "Apply Filters"
3. Only paid sales should show

#### Test Reset
1. Apply some filters
2. Click "Reset" button
3. All filters should clear
4. All sales should show again

### 5. Test View Invoice

1. Find any sale in the table
2. Click the **eye icon** (👁️)
3. Invoice modal should open
4. Check that invoice displays correctly:
   - Company header
   - Customer details
   - Invoice number
   - Items list
   - Totals
   - Payment details

### 6. Test Print Invoice

**Method 1: From Table**
1. Click the **print icon** (🖨️) on any sale
2. Invoice modal opens
3. Print dialog appears automatically

**Method 2: From Modal**
1. Open invoice (eye icon)
2. Click "Print Invoice" button in modal
3. Print dialog appears

**Expected**:
- Print preview shows properly formatted invoice
- Layout is optimized for A4 paper
- All details are visible

### 7. Test Download PDF

1. Click the **download icon** (⬇️) on any sale
2. Wait for spinner (shows loading)
3. PDF should generate and open in new tab

**Expected**:
- Loading spinner appears briefly
- New tab opens with PDF
- PDF shows professional invoice
- Success message appears
- If customer has email: "Invoice downloaded and sent to customer email"
- If no email: "Invoice downloaded successfully"

**Check**:
- PDF is properly formatted
- All sale details are correct
- Company branding is visible

### 8. Test Pagination

**Only if you have more than 20 sales:**

1. Scroll to bottom of table
2. You should see pagination controls
3. Click "Next" button
4. Page 2 loads
5. Click "Previous" button
6. Back to page 1

### 9. Test Responsive Design

1. Resize browser window to mobile size
2. Check that:
   - Filters stack vertically
   - Table is scrollable horizontally
   - Buttons are still accessible
   - Modal works on mobile

### 10. Test Error Handling

#### Test with No Internet (Optional)
1. Disconnect internet
2. Try to download PDF
3. Should show error message

#### Test with Invalid Sale ID
1. Open browser console
2. Try to access `/sales-history` with invalid filters
3. Should handle gracefully

## Common Issues & Solutions

### Issue: "Sales History" not in menu
**Solution**: 
- Check if you have VIEW_SALES permission
- Refresh the page
- Clear browser cache

### Issue: Page shows "No sales found"
**Possible Causes**:
1. No sales in database yet
2. Filters are too restrictive
3. Database connection issue

**Solution**:
- Click "Reset" to clear filters
- Create a test sale from POS
- Check database connection

### Issue: Download PDF not working
**Possible Causes**:
1. Server not running
2. PDF generation service error
3. File upload service not configured

**Solution**:
- Check server logs for errors
- Verify PDFKit is installed: `npm list pdfkit`
- Check if GCS or local storage is configured

### Issue: Invoice modal not opening
**Solution**:
- Check browser console for errors
- Verify sale data exists
- Try refreshing the page

### Issue: Print not working
**Solution**:
- Check if popup blocker is enabled
- Try different browser
- Use "Print Invoice" button in modal

## Verification Checklist

Use this checklist to verify everything works:

- [ ] Server starts without errors
- [ ] Client starts without errors
- [ ] Can login successfully
- [ ] Sales History appears in navigation
- [ ] Sales History page loads
- [ ] Filters section displays
- [ ] Sales table displays
- [ ] Search filter works
- [ ] Date range filter works
- [ ] Payment status filter works
- [ ] Reset button works
- [ ] View invoice (eye icon) works
- [ ] Invoice modal displays correctly
- [ ] Print invoice (print icon) works
- [ ] Print dialog appears
- [ ] Download PDF (download icon) works
- [ ] PDF generates successfully
- [ ] PDF opens in new tab
- [ ] PDF content is correct
- [ ] Success message appears
- [ ] Pagination works (if applicable)
- [ ] Mobile responsive design works
- [ ] Error messages display properly
- [ ] Close modal works

## Database Check

If you want to verify data in MongoDB:

```javascript
// Connect to MongoDB
use Health_Care_Shop_DB

// Check sales collection
db.sales.find().limit(5).pretty()

// Count total sales
db.sales.countDocuments()

// Check recent sales
db.sales.find().sort({ saleDate: -1 }).limit(5).pretty()
```

## API Testing (Optional)

Test the API endpoints directly:

### Get Sales List
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/sales?limit=10
```

### Get Single Sale
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/sales/SALE_ID
```

### Generate Invoice PDF
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/sales/SALE_ID/send-invoice
```

## Performance Testing

### Load Test
1. Create 100+ sales in database
2. Access Sales History page
3. Check page load time
4. Test pagination performance
5. Test filter performance

### PDF Generation Test
1. Generate 10 PDFs in quick succession
2. Check server memory usage
3. Verify all PDFs generate correctly
4. Check response times

## Browser Compatibility

Test in multiple browsers:

- [ ] Chrome/Edge (Latest)
- [ ] Firefox (Latest)
- [ ] Safari (Latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

## Security Testing

- [ ] Verify permission checks work
- [ ] Try accessing without login (should redirect)
- [ ] Try accessing with wrong permission (should deny)
- [ ] Check if sensitive data is hidden in PDFs
- [ ] Verify API endpoints require authentication

## Next Steps After Testing

1. **If everything works**: Feature is ready for production!
2. **If issues found**: Document them and fix
3. **Performance issues**: Optimize queries or add caching
4. **UI improvements**: Gather user feedback

## Reporting Issues

If you find bugs, report with:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/OS information
5. Console errors (if any)
6. Server logs (if relevant)

---

**Happy Testing! 🚀**
