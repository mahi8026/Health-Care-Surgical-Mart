# Quick Start Guide

## Health Care Surgical Mart - Development Setup

### 🚀 Starting the Application

#### Option 1: Start Both Servers (Recommended)

```bash
npm run dev
```

This starts both the backend (port 5000) and frontend (port 3001) servers.

#### Option 2: Start Servers Individually

```bash
# Terminal 1 - Backend
npm run server:dev

# Terminal 2 - Frontend
npm run client:dev
```

### 🌐 Access URLs

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:5000
- **API Health**: http://localhost:5000/api/test

### 🔐 Default Login Credentials

#### Shop Admin

- **Email**: `admin@healthcaremart.com`
- **Password**: `Admin@123`

#### Staff

- **Email**: `staff@healthcaremart.com`
- **Password**: `Staff@123`

### 🛠️ Common Commands

#### Development

```bash
npm run dev              # Start both servers
npm run server:dev       # Start backend only
npm run client:dev       # Start frontend only
```

#### Cleanup

```bash
npm run clean            # Clean all temporary files
npm run clean:logs       # Clean log files only
cleanup-script.bat       # Run automated cleanup (Windows)
```

#### Testing

```bash
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage
```

#### Code Quality

```bash
npm run lint             # Lint all code
npm run format           # Format all code
```

### 🐛 Troubleshooting

#### Port Already in Use

**Problem**: Error "Port 5000 is already in use"

**Solution**:

```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>

# Restart servers
npm run dev
```

#### MongoDB Connection Error

**Problem**: Cannot connect to MongoDB

**Solution**:

1. Check `.env` file has correct `MONGODB_URI`
2. Verify MongoDB Atlas network access
3. Check IP whitelist in MongoDB Atlas
4. Ensure internet connection is active

#### Module Not Found

**Problem**: Error "Cannot find module"

**Solution**:

```bash
# Reinstall dependencies
npm run clean:all
npm install
cd client && npm install
cd ../server && npm install
```

#### Build Errors

**Problem**: Build fails with errors

**Solution**:

```bash
# Clean and rebuild
npm run clean:build
npm run build
```

### 📦 Project Structure

```
health-care-surgical-mart/
├── client/              # React Frontend (Port 3001)
├── server/              # Node.js Backend (Port 5000)
├── database/            # Database scripts
├── logs/                # Application logs
├── .env                 # Environment variables
├── package.json         # Root dependencies
└── README.md            # Full documentation
```

### 🔄 Development Workflow

1. **Start Development**

   ```bash
   npm run dev
   ```

2. **Make Changes**
   - Edit files in `client/src/` or `server/src/`
   - Changes auto-reload (hot reload enabled)

3. **Test Changes**

   ```bash
   npm test
   ```

4. **Clean Up**

   ```bash
   npm run clean
   ```

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "Your message"
   git push
   ```

### 📝 Important Files

- **`.env`** - Environment configuration (DO NOT COMMIT)
- **`package.json`** - Project dependencies and scripts
- **`README.md`** - Complete documentation
- **`MAINTENANCE_GUIDE.md`** - Maintenance procedures
- **`CLEANUP_SUMMARY.md`** - Cleanup history

### 🎯 Key Features

- ✅ Point of Sale (POS) System
- ✅ Inventory Management
- ✅ Expense Tracking
- ✅ Purchase Management
- ✅ Financial Reports
- ✅ User Management (RBAC)
- ✅ Multi-tenant Architecture

### 📞 Support

- **Documentation**: See README.md
- **Maintenance**: See MAINTENANCE_GUIDE.md
- **Issues**: Create issue in repository

### ⚡ Quick Tips

1. **Always run `npm run clean` before committing**
2. **Use `npm run lint` to check code quality**
3. **Keep `.env` files secure and never commit them**
4. **Run tests before pushing changes**
5. **Check logs in `server/logs/` for debugging**

---

**Last Updated**: February 5, 2026
**Version**: 2.0.0
