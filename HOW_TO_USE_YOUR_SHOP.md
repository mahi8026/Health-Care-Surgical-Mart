# 🏥 How to Use Your Health Care Surgical Mart System

## 🎉 Congratulations!

Your shop management system is now **100% production-ready** with real credentials!

---

## 🚀 Quick Start (First Time Setup)

### Step 1: Create Your Admin Account

Run this command in your project root:

```bash
node setup-admin.js
```

**You'll be asked for:**
1. MongoDB URI (press Enter for default)
2. Database name (press Enter for default)
3. **Your Shop Name** (e.g., "My Medical Shop")
4. **Your Full Name** (e.g., "John Doe")
5. **Your Email** (e.g., "john@myshop.com")
6. **Your Password** (minimum 6 characters)

**Example Session:**
```
==============================================
  Health Care Surgical Mart - Admin Setup
==============================================

MongoDB URI (default: mongodb://localhost:27017): [Press Enter]
Database name (default: health_care_pos): [Press Enter]

--- Shop Information ---
Shop Name (e.g., "Health Care Plus"): My Medical Shop
✓ Shop ID will be: my-medical-shop

--- Admin Account ---
Admin Full Name: John Doe
Admin Email: john@mymedicalshop.com
Admin Password (min 6 characters): MySecure123

✓ Connected to MongoDB
✓ Shop "My Medical Shop" created
✓ Admin user created
✓ Indexes created

==============================================
  ✅ Setup Complete!
==============================================

Your login credentials:
  Shop ID: my-medical-shop
  Email: john@mymedicalshop.com
  Password: MySecure123
  Role: SHOP_ADMIN
```

---

### Step 2: Start Your System

**Terminal 1 - Start Server:**
```bash
cd server
npm start
```

**Terminal 2 - Start Client:**
```bash
cd client
npm run dev
```

---

### Step 3: Login

1. Open browser: **http://localhost:5173**
2. Click **"Shop Admin"** tab
3. Enter your email and password
4. Leave **Shop ID** empty (auto-detected from email)
5. Click **"Sign In"**

---

## 📊 What You Can Do Now

### 1. Dashboard
- View sales statistics
- Monitor stock levels
- Track expenses
- See recent activities

### 2. Products Management
- Add new products
- Update prices and stock
- Set expiry dates
- Manage categories
- Bulk import products

### 3. Sales (POS)
- Create sales invoices
- Add multiple products
- Apply discounts
- Print receipts
- Hold/resume sales

### 4. Customers
- Add customer records
- Track purchase history
- Manage customer credits
- View customer analytics

### 5. Expenses
- Record expenses
- Categorize spending
- View expense reports
- Export expense data

### 6. Reports
- Sales reports (daily, monthly, yearly)
- Stock valuation
- Profit/loss statements
- Expense analytics
- Customer analytics

### 7. User Management
- Add staff members
- Assign roles (Admin/Staff)
- Activate/deactivate users
- Change passwords
- View user activity

### 8. Settings
- Shop information
- Tax configuration
- Receipt customization
- System preferences
- Backup management

---

## 👥 Adding More Users (Staff)

Once logged in as admin:

1. Go to **Settings → User Management**
2. Click **"Add User"** button
3. Fill in:
   - Full Name
   - Email
   - Password
   - Role: **STAFF** (for cashiers) or **SHOP_ADMIN** (for managers)
4. Click **"Create User"**

**Staff members can then login with their credentials!**

---

## 🔐 User Roles & Permissions

### SHOP_ADMIN (You)
✅ Full access to everything:
- Create/edit/delete products
- Process sales
- Manage customers
- View all reports
- Manage expenses
- Add/remove staff
- Configure settings
- Access audit logs

### STAFF (Your Employees)
✅ Limited access:
- Process sales
- View products
- Add customers
- View basic reports
- Record expenses

❌ Cannot:
- Delete products
- Manage users
- Change settings
- View audit logs

---

## 📱 Daily Operations

### Morning Routine:
1. Login to system
2. Check dashboard for overview
3. Review low stock alerts
4. Check expiring products

### During Sales:
1. Go to **Sales** page
2. Search/scan products
3. Add to cart
4. Apply discounts if needed
5. Complete sale
6. Print receipt

### End of Day:
1. View **Reports → Sales Report**
2. Check today's total sales
3. Record any expenses
4. Review stock levels

---

## 🛠️ Common Tasks

### Add a New Product:
1. **Products → Add Product**
2. Fill in: Name, Barcode, Price, Stock, Category
3. Set expiry date (if applicable)
4. Click **"Save"**

### Process a Sale:
1. **Sales** page
2. Search product by name/barcode
3. Click **"Add to Cart"**
4. Adjust quantity if needed
5. Click **"Complete Sale"**
6. Print receipt

### Add a Customer:
1. **Customers → Add Customer**
2. Fill in: Name, Phone, Email (optional)
3. Click **"Save"**

### Record an Expense:
1. **Expenses → Add Expense**
2. Fill in: Description, Amount, Category, Date
3. Attach receipt (optional)
4. Click **"Save"**

### View Reports:
1. **Reports** menu
2. Select report type
3. Choose date range
4. Click **"Generate"**
5. Export to PDF/Excel if needed

---

## 🔍 Finding Things

### Search Products:
- Use search bar on Products page
- Search by: Name, Barcode, Category
- Filter by: In Stock, Low Stock, Expired

### Search Customers:
- Use search bar on Customers page
- Search by: Name, Phone, Email

### Search Sales:
- Go to Reports → Sales Report
- Filter by: Date, Customer, Payment Method

---

## 💾 Backup Your Data

### Manual Backup:
1. **Settings → Backup**
2. Click **"Create Backup"**
3. Download backup file
4. Store safely

### Automatic Backup:
1. **Settings → Backup**
2. Enable **"Auto Backup"**
3. Set schedule (daily/weekly)
4. Configure backup location

---

## 🚨 Troubleshooting

### Can't Login?
- Check email is correct (case doesn't matter)
- Check password (case DOES matter)
- Leave Shop ID empty
- Try "Forgot Password" if available

### Product Not Found?
- Check if product exists in Products page
- Verify barcode is correct
- Try searching by name instead

### Sale Not Completing?
- Check if all products have stock
- Verify customer information is valid
- Check internet connection
- Try refreshing the page

### Report Not Loading?
- Check date range is valid
- Ensure you have data for selected period
- Try smaller date range
- Refresh the page

---

## 📞 Support

### Check These First:
1. **README_FINAL.md** - Complete documentation
2. **PRODUCTION_SETUP_GUIDE.md** - Setup details
3. Server logs - Check for errors
4. Browser console - Check for errors

### Common Issues:
- **"Failed to fetch"** → Server not running
- **"Invalid credentials"** → Wrong email/password
- **"Shop not found"** → Leave Shop ID empty
- **"Network error"** → Check MongoDB connection

---

## 🎯 Best Practices

### Security:
- ✅ Use strong passwords
- ✅ Change default passwords
- ✅ Don't share admin credentials
- ✅ Create separate accounts for staff
- ✅ Regularly backup data
- ✅ Keep software updated

### Operations:
- ✅ Update stock levels regularly
- ✅ Check expiring products daily
- ✅ Record all expenses
- ✅ Review reports weekly
- ✅ Train staff properly
- ✅ Keep customer data updated

### Data Management:
- ✅ Backup data daily
- ✅ Clean up old records periodically
- ✅ Archive completed sales
- ✅ Update product prices regularly
- ✅ Review and categorize expenses

---

## 📈 Growing Your Business

### Track These Metrics:
- Daily sales totals
- Best-selling products
- Customer purchase frequency
- Profit margins
- Expense trends
- Stock turnover rate

### Use Reports For:
- Identifying popular products
- Planning inventory purchases
- Understanding customer behavior
- Optimizing pricing
- Reducing expenses
- Forecasting sales

---

## 🎉 You're All Set!

Your Health Care Surgical Mart system is ready to help you:
- ✅ Manage inventory efficiently
- ✅ Process sales quickly
- ✅ Track expenses accurately
- ✅ Understand your business better
- ✅ Serve customers professionally
- ✅ Grow your business

**Start by running `node setup-admin.js` and create your admin account!**

---

**Need Help?** Check the documentation files or review server logs for errors.

**Happy Selling!** 🚀
