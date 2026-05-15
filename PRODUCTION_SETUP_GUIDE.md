# Production Setup Guide - Real Credentials

## 🎯 Overview

This guide will help you set up your Health Care Surgical Mart system with **real credentials** for production use.

---

## ✅ Changes Made

### 1. Removed Demo Credentials
- ✅ Removed demo credentials display from login page
- ✅ Cleared pre-filled email/password fields
- ✅ Login page now shows empty fields for security

---

## 🚀 Setting Up Your Real Admin Account

### Method 1: Using the Setup Script (Recommended)

#### Step 1: Install Dependencies
```bash
cd server
npm install
```

#### Step 2: Run the Setup Script
```bash
node ../setup-admin.js
```

#### Step 3: Follow the Prompts
The script will ask you for:

1. **MongoDB URI** (default: `mongodb://localhost:27017`)
2. **Database name** (default: `health_care_pos`)
3. **Shop Name** (e.g., "Health Care Plus")
4. **Admin Full Name** (e.g., "John Doe")
5. **Admin Email** (e.g., "admin@yourshop.com")
6. **Admin Password** (minimum 6 characters)

#### Example:
```
==============================================
  Health Care Surgical Mart - Admin Setup
==============================================

MongoDB URI (default: mongodb://localhost:27017): 
Database name (default: health_care_pos): 

--- Shop Information ---
Shop Name (e.g., "Health Care Plus"): My Medical Shop
✓ Shop ID will be: my-medical-shop

--- Admin Account ---
Admin Full Name: John Doe
Admin Email: john@mymedicalshop.com
Admin Password (min 6 characters): MySecurePass123

--- Connecting to MongoDB ---
✓ Connected to MongoDB

--- Creating Shop ---
✓ Shop "My Medical Shop" created

--- Creating Admin User ---
✓ Admin user created

--- Creating Indexes ---
✓ Indexes created

==============================================
  ✅ Setup Complete!
==============================================

Your login credentials:
  Shop ID: my-medical-shop
  Email: john@mymedicalshop.com
  Password: MySecurePass123
  Role: SHOP_ADMIN

You can now login to your shop management system!
==============================================
```

---

### Method 2: Manual Database Setup

If you prefer to set up manually using MongoDB Compass or CLI:

#### Step 1: Create Shop Document

In the main database (`health_care_pos`), create a shop:

```javascript
// Collection: shops
{
  "shopId": "your-shop-id",
  "name": "Your Shop Name",
  "status": "active",
  "plan": "premium",
  "createdAt": new Date(),
  "updatedAt": new Date(),
  "settings": {
    "currency": "USD",
    "timezone": "UTC",
    "language": "en"
  }
}
```

#### Step 2: Create Admin User

In your shop database (`health_care_pos_your-shop-id`), create an admin user:

```javascript
// Collection: users
{
  "name": "Your Name",
  "email": "your-email@shop.com",
  "password": "$2a$12$...", // Use bcrypt to hash your password
  "role": "SHOP_ADMIN",
  "shopId": "your-shop-id",
  "isActive": true,
  "permissions": [],
  "lastLogin": null,
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

#### Step 3: Hash Your Password

Use this Node.js command to hash your password:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourPassword', 12).then(hash => console.log(hash));"
```

---

## 🔐 Security Best Practices

### 1. Strong Passwords
- ✅ Minimum 8 characters
- ✅ Mix of uppercase, lowercase, numbers, and symbols
- ✅ Avoid common words or patterns
- ✅ Example: `MyShop@2024!Secure`

### 2. Email Configuration
- ✅ Use your real business email
- ✅ Format: `admin@yourdomain.com`
- ✅ Shop ID will be auto-detected from email domain

### 3. Shop ID
- ✅ Automatically generated from shop name
- ✅ Format: lowercase, hyphens only
- ✅ Example: "Health Care Plus" → `health-care-plus`

---

## 👥 Adding More Users

Once you've logged in as SHOP_ADMIN, you can add more users:

### Via User Management Page:

1. **Login** as SHOP_ADMIN
2. Navigate to **Settings → User Management**
3. Click **"Add User"** button
4. Fill in the form:
   - Full Name
   - Email Address
   - Password
   - Role (SHOP_ADMIN or STAFF)
   - Active Status

### User Roles:

| Role | Permissions | Use Case |
|------|-------------|----------|
| **SHOP_ADMIN** | Full access to everything | Shop owner, manager |
| **STAFF** | Limited access (sales, customers, products) | Cashiers, sales staff |

---

## 🗄️ Database Structure

Your system uses a **multi-tenant architecture**:

### Main Database: `health_care_pos`
- Stores shop information
- Manages shop status and plans

### Shop Databases: `health_care_pos_{shop-id}`
- Each shop has its own database
- Complete data isolation
- Format: `health_care_pos_my-medical-shop`

### Collections per Shop:
- `users` - Staff accounts
- `products` - Product inventory
- `sales` - Sales transactions
- `customers` - Customer records
- `expenses` - Expense tracking
- `audit_logs` - Activity logs

---

## 🧪 Testing Your Setup

### 1. Test Login
```bash
# Start the server
cd server
npm start

# Start the client (in another terminal)
cd client
npm run dev
```

### 2. Access the Application
- Open browser: `http://localhost:5173`
- Click **"Shop Admin"** tab
- Enter your credentials
- Leave Shop ID empty (auto-detected)

### 3. Verify Access
After login, you should see:
- ✅ Dashboard with statistics
- ✅ Navigation menu with all sections
- ✅ Your name in the top-right corner
- ✅ User Management page accessible

---

## 🚨 Troubleshooting

### Issue: "Invalid credentials"
**Solution**: 
- Verify email is correct (case-insensitive)
- Check password (case-sensitive)
- Ensure user exists in correct shop database

### Issue: "Shop not found"
**Solution**:
- Verify shop exists in main database
- Check shopId matches email domain
- Leave Shop ID field empty for auto-detection

### Issue: "Cannot connect to database"
**Solution**:
- Ensure MongoDB is running
- Check connection string in `.env` file
- Verify network connectivity

---

## 📝 Environment Variables

Make sure your `.env` files are configured:

### Server `.env`:
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017
DB_NAME=health_care_pos

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server
PORT=5001
NODE_ENV=production

# CORS
CLIENT_URL=http://localhost:5173
```

### Client `.env`:
```env
VITE_API_URL=http://localhost:5001/api
```

---

## 🔄 Migrating from Demo to Production

If you've been using demo credentials and want to switch:

### Option 1: Clean Start
1. Drop all demo databases
2. Run `setup-admin.js` with your real credentials
3. Start fresh with clean data

### Option 2: Keep Data, Change Admin
1. Run `setup-admin.js`
2. Choose "yes" when asked to update existing user
3. Your data remains, only admin credentials change

---

## 📊 Next Steps After Setup

1. **Configure Shop Settings**
   - Go to Settings → Shop Settings
   - Update shop name, address, contact info
   - Set tax rates and currency

2. **Add Products**
   - Go to Products → Add Product
   - Import bulk products if needed

3. **Add Staff Members**
   - Go to Settings → User Management
   - Create accounts for your staff

4. **Configure Receipt**
   - Go to Settings → Receipt Settings
   - Customize receipt header/footer

5. **Set Up Backup**
   - Go to Settings → Backup
   - Configure automatic backups

---

## 🎉 You're Ready!

Your Health Care Surgical Mart system is now configured with real credentials and ready for production use!

### Support
If you need help:
1. Check the troubleshooting section above
2. Review the main README.md
3. Check server logs for errors

---

**Last Updated**: May 16, 2026
**Version**: 1.0.0
**Production Ready**: ✅ Yes
