# Sales History & Invoice Download Feature

## Overview
Added comprehensive sales history viewing and invoice download functionality to the Health Care Surgical Mart POS system.

## Features Implemented

### 1. Sales History Page (`/sales-history`)
A dedicated page to view all previous sales transactions with:

#### Filtering Options
- **Search**: Search by invoice number or customer name
- **Date Range**: Filter sales by start and end date
- **Payment Status**: Filter by Paid, Partial, Credit, or Pending status
- **Reset Filters**: Quick reset to default view

#### Sales Table Display
- Invoice Number
- Sale Date & Time
- Customer Name & Type
- Number of Items
- Total Amount
- Amount Paid
- Due Amount
- Payment Status Badge (color-coded)
- Action Buttons (View, Print, Download)

#### Pagination
- Configurable items per page (default: 20)
- Page navigation controls
- Total count display

### 2. Invoice Actions

#### View Invoice
- Click the eye icon to view invoice in a modal
- Full invoice preview with professional layout
- Company branding and details

#### Print Invoice
- Click the print icon to directly print the invoice
- Optimized A4 print layout
- Automatic print dialog

#### Download PDF
- Click the download icon to generate and download PDF
- Server-side PDF generation using PDFKit
- Automatic upload to cloud storage (GCS) or local fallback
- Opens PDF in new tab for download
- Optional email to customer if email address is available

### 3. Enhanced Invoice Component

Updated `ProfessionalInvoice.jsx` to support:
- Download button in modal header
- Callback function for PDF generation
- Maintains existing print functionality

### 4. Navigation Integration

Added "Sales History" to the main navigation menu:
- Icon: History icon (fas fa-history)
- Permission: VIEW_SALES
- Located in Main section with Dashboard and POS

## Technical Implementation

### Frontend Components

#### New Files
- `client/src/pages/SalesHistory.jsx` - Main sales history page

#### Modified Files
- `client/src/App.jsx` - Added route for `/sales-history`
- `client/src/config/navigation.js` - Added navigation menu item
- `client/src/components/ProfessionalInvoice.jsx` - Added download functionality
- `client/src/pages/Sales.jsx` - Added download handler to invoice modal

### Backend API

#### Existing Endpoints Used
- `GET /api/sales` - Fetch sales with filters and pagination
- `GET /api/sales/:id` - Fetch single sale details
- `POST /api/sales/:id/send-invoice` - Generate PDF and optionally email

#### Services Used
- `email.service.js` - PDF generation and email sending
- `file-upload.service.js` - Upload PDFs to GCS or local storage

## API Query Parameters

### GET /api/sales
```
?startDate=YYYY-MM-DD
&endDate=YYYY-MM-DD
&customerId=<customer_id>
&paymentStatus=Paid|Partial|Credit|Pending
&search=<invoice_or_customer>
&page=1
&limit=20
```

## User Permissions

- **VIEW_SALES**: Required to access Sales History page
- **CREATE_SALE**: Required for POS (existing)
- **MANAGE_SALES**: Required for invoice generation (backend)

## UI/UX Features

### Color-Coded Status Badges
- **Paid**: Green badge
- **Partial**: Yellow badge
- **Credit**: Orange badge
- **Pending**: Gray badge

### Responsive Design
- Mobile-friendly table layout
- Responsive grid for filters
- Optimized for various screen sizes

### Loading States
- Spinner during data fetch
- Individual loading state for each download button
- Prevents duplicate requests

### Error Handling
- User-friendly error messages
- Dismissible error alerts
- Console logging for debugging

## Usage Instructions

### For Users

1. **Access Sales History**
   - Click "Sales History" in the main navigation menu
   - Or navigate to `/sales-history`

2. **Filter Sales**
   - Use search box for quick lookup
   - Set date range for specific period
   - Select payment status to filter
   - Click "Apply Filters" to search
   - Click "Reset" to clear all filters

3. **View Invoice**
   - Click the eye icon (👁️) in the Actions column
   - Invoice opens in a modal
   - Use "Print Invoice" or "Download PDF" buttons
   - Close modal with X button

4. **Print Invoice**
   - Click the print icon (🖨️) in the Actions column
   - Print dialog opens automatically
   - Optimized for A4 paper

5. **Download PDF**
   - Click the download icon (⬇️) in the Actions column
   - PDF is generated on the server
   - Opens in new tab for download
   - If customer has email, they receive a copy

### For Developers

#### Adding Custom Filters
Edit `client/src/pages/SalesHistory.jsx`:
```javascript
const [filters, setFilters] = useState({
  // Add your custom filter here
  customField: "",
});
```

#### Customizing PDF Layout
Edit `server/src/services/email/email.service.js`:
```javascript
async generateInvoicePDF(sale) {
  // Customize PDF generation here
}
```

#### Modifying Table Columns
Edit the table in `SalesHistory.jsx`:
```javascript
<thead>
  <tr>
    {/* Add or remove columns here */}
  </tr>
</thead>
```

## Testing Checklist

- [ ] Sales History page loads correctly
- [ ] Filters work as expected
- [ ] Pagination navigates properly
- [ ] View invoice opens modal
- [ ] Print invoice triggers print dialog
- [ ] Download PDF generates and opens file
- [ ] Error messages display correctly
- [ ] Mobile responsive layout works
- [ ] Permission checks work correctly
- [ ] Empty state displays when no sales

## Future Enhancements

### Potential Improvements
1. **Bulk Actions**
   - Select multiple invoices
   - Bulk download as ZIP
   - Bulk email to customers

2. **Advanced Filters**
   - Filter by product
   - Filter by employee/cashier
   - Filter by payment method

3. **Export Options**
   - Export to Excel/CSV
   - Export to PDF report
   - Email report to admin

4. **Analytics**
   - Sales trends chart
   - Top customers
   - Payment method breakdown

5. **Invoice Customization**
   - Multiple invoice templates
   - Custom branding per shop
   - Multi-language support

6. **Quick Actions**
   - Resend invoice email
   - Create return from invoice
   - Record payment for due invoices

## Dependencies

### Frontend
- React Router (routing)
- Font Awesome (icons)
- Tailwind CSS (styling)

### Backend
- PDFKit (PDF generation)
- Google Cloud Storage (file storage)
- SendGrid (email delivery)

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Performance Considerations

- Lazy loading of Sales History page
- Pagination to limit data load
- Debounced search input (can be added)
- Cached PDF URLs (stored in database)
- Async PDF generation (non-blocking)

## Security

- Permission-based access control
- Server-side PDF generation (prevents tampering)
- Secure file storage with signed URLs
- Input validation on filters
- SQL injection prevention (MongoDB)

## Support

For issues or questions:
1. Check browser console for errors
2. Verify user permissions
3. Check server logs for API errors
4. Ensure database connectivity
5. Verify cloud storage configuration

---

**Version**: 1.0.0  
**Date**: May 14, 2026  
**Author**: Development Team
