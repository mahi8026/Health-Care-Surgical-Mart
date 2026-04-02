# Health Care Surgical Mart - POS & Inventory Management System

A professional, full-stack Medical Store Point of Sale and Inventory Management System with comprehensive expense tracking, multi-tenant architecture, and role-based access control.

## 🏥 About

Health Care Surgical Mart is a complete business management solution designed specifically for medical equipment stores, surgical supply shops, and healthcare retail businesses. The system provides end-to-end management of sales, inventory, purchases, expenses, and financial reporting with a modern, user-friendly interface.

## ✨ Key Features

### 🛒 Point of Sale (POS)

- Fast and intuitive sales interface
- Product search with autocomplete
- Multiple payment methods (Cash, Bank, Mixed)
- Professional invoice generation with print support
- Customer management and history
- Real-time stock updates
- Return and refund management

### 📦 Inventory Management

- Complete product catalog management
- Stock tracking with low-stock alerts
- Batch and expiry date tracking
- Product categories and SKU management
- Stock valuation reports
- Multi-location inventory support
- **Bulk Product Import/Export** - Mass product management with CSV/Excel
- **Bulk Update/Delete** - Batch operations for efficiency
- Template-based data import with validation

### 💰 Expense Tracking

- Comprehensive expense management
- Customizable expense categories
- Receipt upload and attachment
- Recurring expense automation
- Expense analytics and trends
- Month-over-month comparisons
- Category-wise distribution reports
- Bulk expense operations

### 📊 Purchase Management

- Supplier management
- Purchase order creation
- Purchase history tracking
- Supplier payment tracking
- Purchase analytics

### 📈 Financial Reports

- Dashboard with key metrics
- Sales reports (daily, monthly, yearly)
- Expense reports and analytics
- Profit and loss statements
- Stock valuation reports
- Financial trends and insights
- Export to PDF/Excel

### 👥 User Management

- Multi-tenant architecture (multiple shops)
- Role-based access control (RBAC)
- Three user roles: Super Admin, Shop Admin, Staff
- Permission-based feature access
- User activity logging
- Secure authentication with JWT

### 🎨 Professional UI/UX

- Modern, responsive design
- Mobile-friendly interface
- Dark mode support
- Professional invoice templates
- Interactive charts and graphs
- Real-time data updates
- Accessibility compliant (WCAG 2.1)

## 🏗️ Architecture

### Project Structure

```
health-care-surgical-mart/
├── client/                     # React Frontend Application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/            # Basic UI components (Button, Input, Modal, etc.)
│   │   │   ├── expense/       # Expense-specific components
│   │   │   ├── Layout.jsx     # Main layout wrapper
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── PermissionGate.jsx
│   │   │   └── ProfessionalInvoice.jsx
│   │   ├── pages/             # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Sales.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── Purchases.jsx
│   │   │   ├── ExpensesPage.jsx
│   │   │   ├── ExpenseCategories.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Returns.jsx
│   │   │   ├── FinancialReports.jsx
│   │   │   ├── StockReport.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Login.jsx
│   │   ├── contexts/          # React contexts
│   │   │   └── AuthContext.jsx
│   │   ├── services/          # API services
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── expenseService.js
│   │   │   └── expenseCategoryService.js
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useApi.js
│   │   │   ├── usePermissions.js
│   │   │   ├── usePagination.js
│   │   │   └── useLocalStorage.js
│   │   ├── utils/             # Utility functions
│   │   │   ├── formatters.js
│   │   │   ├── validators.js
│   │   │   ├── permissions.js
│   │   │   └── helpers.js
│   │   ├── config/            # Configuration
│   │   │   ├── api.js
│   │   │   ├── constants.js
│   │   │   └── navigation.js
│   │   ├── styles/            # Global styles
│   │   │   └── index.css
│   │   ├── App.jsx            # Main App component
│   │   └── main.jsx           # Entry point
│   ├── public/                # Static assets
│   │   └── favicon.svg
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── server/                     # Node.js Backend Application
│   ├── src/
│   │   ├── config/            # Configuration files
│   │   │   ├── database.js
│   │   │   ├── security.js
│   │   │   ├── middleware.js
│   │   │   ├── routes.js
│   │   │   ├── logging.js
│   │   │   └── error-handling.js
│   │   ├── models/            # Mongoose schemas
│   │   │   ├── user.schema.js
│   │   │   ├── shop.schema.js
│   │   │   ├── product.schema.js
│   │   │   ├── stock.schema.js
│   │   │   ├── sale.schema.js
│   │   │   ├── purchase.schema.js
│   │   │   ├── customer.schema.js
│   │   │   ├── return.schema.js
│   │   │   ├── expense.schema.js
│   │   │   ├── expense-category.schema.js
│   │   │   └── settings.schema.js
│   │   ├── routes/            # API routes
│   │   │   ├── auth-multi-tenant.routes.js
│   │   │   ├── products.routes.js
│   │   │   ├── sales.routes.js
│   │   │   ├── purchases.routes.js
│   │   │   ├── customers.routes.js
│   │   │   ├── returns.routes.js
│   │   │   ├── expenses.routes.js
│   │   │   ├── expense-categories.routes.js
│   │   │   ├── expense-analytics.routes.js
│   │   │   ├── recurring-expenses.routes.js
│   │   │   ├── financial-reports.routes.js
│   │   │   ├── reports.routes.js
│   │   │   ├── stock.routes.js
│   │   │   ├── users.routes.js
│   │   │   ├── settings.routes.js
│   │   │   └── super-admin.routes.js
│   │   ├── middleware/        # Custom middleware
│   │   │   └── auth-multi-tenant.js
│   │   ├── services/          # Business logic
│   │   │   ├── expense-number-generator.js
│   │   │   ├── expense-category-seeder.js
│   │   │   ├── recurring-expense.service.js
│   │   │   ├── recurring-expense-scheduler.js
│   │   │   └── file-upload.service.js
│   │   ├── utils/             # Utility functions
│   │   │   ├── database-initializer.js
│   │   │   ├── environment-validator.js
│   │   │   ├── rbac.js
│   │   │   ├── shop-manager.js
│   │   │   └── api.js
│   │   ├── server.js          # Main server file
│   │   └── .env               # Environment variables
│   ├── uploads/               # File uploads
│   │   └── receipts/
│   ├── logs/                  # Application logs
│   └── package.json
│
├── database/                   # Database scripts
│   ├── migrations/            # Database migrations
│   │   ├── add-expense-tracking.js
│   │   ├── migrate-to-optimized.js
│   │   └── seed-database.js
│   └── seeds/                 # Seed data
│       ├── categories.json
│       ├── products.json
│       ├── customers.json
│       ├── suppliers.json
│       ├── sample-sales.json
│       └── sample-purchases.json
│
├── shared/                     # Shared utilities
│   ├── constants/
│   ├── types/
│   └── utils/
│
├── logs/                       # Root logs directory
├── .env                        # Root environment variables
├── package.json                # Root package.json
├── docker-compose.yml          # Docker configuration
├── Dockerfile                  # Docker image
├── .gitignore
├── .eslintrc.js
├── .prettierrc
└── README.md
```

## 🛠️ Technology Stack

### Frontend

- **React 18** - Modern React with hooks and concurrent features
- **React Router v6** - Client-side routing
- **React Query** - Server state management and caching
- **Axios** - HTTP client for API calls
- **Tailwind CSS** - Utility-first CSS framework
- **Chart.js** - Data visualization and charts
- **React Hook Form** - Form management
- **Vite** - Fast build tool and dev server
- **Vitest** - Unit testing framework
- **Testing Library** - Component testing

### Backend

- **Node.js 18+** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Tokens for authentication
- **Bcrypt** - Password hashing
- **Multer** - File upload handling
- **Winston** - Logging library
- **Node-Cron** - Task scheduling
- **Helmet** - Security headers
- **Express Rate Limit** - Rate limiting
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **Compression** - Response compression

### DevOps & Tools

- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Concurrently** - Run multiple commands
- **Nodemon** - Auto-restart development server
- **Supertest** - API testing
- **Jest** - Testing framework

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **MongoDB Atlas** account (or local MongoDB)
- **Git** for version control

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/health-care-surgical-mart.git
cd health-care-surgical-mart
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install

# Return to root
cd ..
```

### 3. Environment Configuration

#### Root `.env` file:

```env
# Application
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=health_care_surgical_mart

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./server/uploads
```

#### Client `.env` file (`client/.env`):

```env
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=Health Care Surgical Mart
VITE_APP_VERSION=2.0.0
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_FILE_UPLOAD=true
```

#### Server `.env` file (`server/.env`):

```env
# Same as root .env or specific server configs
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=health_care_surgical_mart
JWT_SECRET=your_super_secret_jwt_key
```

### 4. Database Setup

```bash
# Seed database with initial data
npm run seed
```

This will create:

- Default expense categories
- Sample products
- Sample customers
- Sample suppliers
- Initial shop setup
- Admin user accounts

### 5. Start Development Servers

```bash
# Start both client and server concurrently
npm run dev

# Or start individually:
# Terminal 1 - Backend (port 5000)
npm run server:dev

# Terminal 2 - Frontend (port 5173)
npm run client:dev
```

### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health

## 🔐 Default User Accounts

### Super Admin

- **Email**: `superadmin@medicalpos.com`
- **Password**: `SuperAdmin@123`
- **Access**: Full system access, manage all shops

### Shop Admin

- **Email**: `admin@healthcaremart.com`
- **Password**: `Admin@123`
- **Access**: Shop management, all features within shop

### Staff

- **Email**: `staff@healthcaremart.com`
- **Password**: `Staff@123`
- **Access**: Limited access for daily operations

## 📜 Available Scripts

### Root Level Scripts

```bash
# Development
npm run dev                 # Start both client and server
npm run build              # Build both client and server
npm start                  # Start production server

# Testing
npm test                   # Run all tests
npm run test:api           # Run API tests
npm run test:integration   # Run integration tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage
npm run test:ci            # Run tests in CI mode

# Code Quality
npm run lint               # Lint all code
npm run format             # Format all code with Prettier

# Database
npm run seed               # Seed database with sample data
npm run db:migrate         # Run database migrations
npm run db:seed            # Seed database

# Docker
npm run docker:build       # Build Docker images
npm run docker:up          # Start Docker containers
npm run docker:down        # Stop Docker containers
npm run deploy             # Build and deploy
```

### Client Scripts

```bash
cd client

npm run dev                # Start development server
npm run build              # Build for production
npm run preview            # Preview production build
npm test                   # Run tests
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage
npm run lint               # Lint code
npm run lint:fix           # Fix linting errors
npm run format             # Format code
```

### Server Scripts

```bash
cd server

npm run dev                # Start development server with nodemon
npm start                  # Start production server
npm test                   # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage
npm run lint               # Lint code
npm run lint:fix           # Fix linting errors
npm run format             # Format code
npm run seed               # Seed database
npm run logs               # View application logs
```

## 🔌 API Documentation

### Base URL

```
http://localhost:5000/api
```

### Authentication

All protected routes require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

### Main API Endpoints

#### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token

#### Products

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

#### Bulk Products

- `POST /api/bulk-products/bulk-import` - Import products from CSV/Excel
- `GET /api/bulk-products/bulk-export` - Export products to CSV
- `PUT /api/bulk-products/bulk-update` - Update multiple products
- `POST /api/bulk-products/bulk-delete` - Delete multiple products

#### Sales

- `GET /api/sales` - Get all sales
- `GET /api/sales/:id` - Get sale by ID
- `POST /api/sales` - Create sale
- `PUT /api/sales/:id` - Update sale
- `DELETE /api/sales/:id` - Delete sale

#### Purchases

- `GET /api/purchases` - Get all purchases
- `GET /api/purchases/:id` - Get purchase by ID
- `POST /api/purchases` - Create purchase
- `PUT /api/purchases/:id` - Update purchase
- `DELETE /api/purchases/:id` - Delete purchase

#### Expenses

- `GET /api/expenses` - Get all expenses
- `GET /api/expenses/:id` - Get expense by ID
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `POST /api/expenses/bulk` - Bulk operations
- `POST /api/expenses/:id/upload` - Upload receipt

#### Expense Categories

- `GET /api/expense-categories` - Get all categories
- `GET /api/expense-categories/:id` - Get category by ID
- `POST /api/expense-categories` - Create category
- `PUT /api/expense-categories/:id` - Update category
- `DELETE /api/expense-categories/:id` - Delete category

#### Expense Analytics

- `GET /api/expense-analytics/summary` - Get expense summary
- `GET /api/expense-analytics/trends` - Get expense trends
- `GET /api/expense-analytics/category-distribution` - Category distribution
- `GET /api/expense-analytics/month-over-month` - Month comparison

#### Recurring Expenses

- `GET /api/recurring-expenses` - Get recurring expenses
- `POST /api/recurring-expenses` - Create recurring expense
- `PUT /api/recurring-expenses/:id` - Update recurring expense
- `DELETE /api/recurring-expenses/:id` - Delete recurring expense

#### Customers

- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

#### Returns

- `GET /api/returns` - Get all returns
- `GET /api/returns/:id` - Get return by ID
- `POST /api/returns` - Create return
- `PUT /api/returns/:id` - Update return

#### Reports

- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/reports/sales` - Sales reports
- `GET /api/reports/stock-valuation` - Stock valuation
- `GET /api/financial-reports` - Financial reports

#### Stock

- `GET /api/stock` - Get stock levels
- `GET /api/stock/low-stock` - Get low stock items
- `PUT /api/stock/:id` - Update stock

#### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### Settings

- `GET /api/settings` - Get shop settings
- `PUT /api/settings` - Update shop settings

## 🗄️ Database Schema

### Collections

1. **users** - User accounts and authentication
2. **shops** - Shop/tenant information
3. **products** - Product catalog
4. **stock** - Inventory stock levels
5. **sales** - Sales transactions
6. **purchases** - Purchase orders
7. **customers** - Customer information
8. **returns** - Return transactions
9. **expenses** - Expense records
10. **expenseCategories** - Expense categories
11. **settings** - Shop settings

### Key Relationships

- Users belong to Shops (multi-tenant)
- Products have Stock records
- Sales reference Products and Customers
- Purchases reference Products and Suppliers
- Expenses reference Expense Categories
- All records are shop-scoped

## 👥 User Roles & Permissions

### Super Admin

- Manage all shops
- Create and manage shop admins
- View all system data
- System configuration
- Full access to all features

### Shop Admin

- Manage shop settings
- Manage shop users
- Full access to shop features
- View all shop reports
- Manage products, sales, purchases
- Manage expenses and categories

### Staff

- Create sales
- View products
- View customers
- Limited reporting access
- Cannot modify settings
- Cannot manage users

## 🎨 UI Components

### Core Components

- **Button** - Customizable button with variants
- **Input** - Form input with validation
- **Select** - Dropdown select component
- **Modal** - Dialog/modal component
- **Table** - Data table with sorting and pagination
- **Pagination** - Pagination controls
- **LoadingSpinner** - Loading indicator

### Feature Components

- **ExpenseCard** - Expense display card
- **ExpenseList** - Expense list with filters
- **ExpenseFilters** - Advanced filtering
- **ExpenseExport** - Export functionality
- **SearchableProductSelect** - Product search and select
- **ProfessionalInvoice** - Invoice template
- **CategorySelector** - Category selection
- **PermissionGate** - Permission-based rendering
- **ProtectedRoute** - Route protection

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm run test:api
npm run test:integration
```

### Test Coverage

The project maintains high test coverage:

- Unit tests for utilities and services
- Integration tests for API endpoints
- Component tests for React components
- E2E tests for critical user flows

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build images
npm run docker:build

# Start containers
npm run docker:up

# Stop containers
npm run docker:down

# View logs
docker-compose logs -f
```

### Docker Configuration

The `docker-compose.yml` includes:

- Frontend container (React app)
- Backend container (Node.js API)
- MongoDB container (Database)
- Nginx container (Reverse proxy)

## 🚀 Production Deployment

### Build for Production

```bash
# Build both client and server
npm run build

# Build client only
npm run client:build

# Build server only
npm run server:build
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production MongoDB URI
3. Set secure JWT secret
4. Configure CORS for production domain
5. Set up SSL certificates
6. Configure reverse proxy (nginx)

### Deployment Checklist

- [ ] Update environment variables
- [ ] Build production bundles
- [ ] Run database migrations
- [ ] Set up SSL/TLS
- [ ] Configure CDN for static assets
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Test all critical features
- [ ] Set up error tracking (Sentry)
- [ ] Configure rate limiting

## 🔒 Security Features

### Authentication & Authorization

- JWT-based authentication
- Bcrypt password hashing
- Role-based access control (RBAC)
- Permission-based feature access
- Secure session management

### API Security

- Helmet.js security headers
- CORS configuration
- Rate limiting
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

### Data Security

- Encrypted passwords
- Secure file uploads
- Environment variable protection
- Audit logging
- Data backup and recovery

## 📊 Performance Optimization

### Frontend

- Code splitting and lazy loading
- React Query caching
- Image optimization
- Bundle size optimization
- Tree shaking
- Gzip compression

### Backend

- Database indexing
- Query optimization
- Response caching
- Connection pooling
- Compression middleware
- Rate limiting

## 📝 Code Quality

### Linting & Formatting

- ESLint for code quality
- Prettier for code formatting
- Consistent code style
- Pre-commit hooks with Husky
- Lint-staged for staged files

### Best Practices

- Component-based architecture
- Service layer pattern
- Custom hooks for reusability
- Error boundary implementation
- Proper error handling
- Comprehensive logging

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**

```bash
# Kill process on port 5000
npx kill-port 5000

# Kill process on port 5173
npx kill-port 5173
```

**MongoDB connection error:**

- Check MongoDB URI in .env
- Verify network access in MongoDB Atlas
- Check IP whitelist settings

**Module not found:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Build errors:**

```bash
# Clear cache and rebuild
npm run clean
npm run build
```

## 📚 Documentation

- [Frontend Architecture](./client/README.md)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Deployment Guide](#production-deployment)

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards

- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Follow React and Node.js best practices

## 📄 License

This project is proprietary software for Health Care Surgical Mart.

## 👨‍💻 Development Team

- **Project Lead**: Medical Store POS Team
- **Frontend**: React Development Team
- **Backend**: Node.js Development Team
- **Database**: MongoDB Specialists
- **DevOps**: Infrastructure Team

## 🆘 Support

For technical support or questions:

- **Email**: support@healthcaresurgicalmart.com
- **Issues**: Create an issue in the repository
- **Documentation**: Check this README and related docs

## 🙏 Acknowledgments

- Built with modern web technologies
- Designed for real-world medical store requirements
- Focused on scalability and maintainability
- Optimized for performance and security

---

**Built with ❤️ for Health Care Surgical Mart**

_Version 2.0.0 - Last Updated: February 2026_
