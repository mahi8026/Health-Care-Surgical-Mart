# Health Care Surgical Mart - Medical Store POS System

A comprehensive Point of Sale (POS) system designed for medical stores and pharmacies, featuring inventory management, sales tracking, expense management, and customer relationship tools.

## 🚀 Live Demo

**Frontend:** [https://health-care-60ee6.web.app](https://health-care-60ee6.web.app)

**Backend API:** [https://health-care-surgical-mart.onrender.com](https://health-care-surgical-mart.onrender.com)

---

## 📋 Features

### Core Functionality
- 🛒 Sales Management with invoice generation
- 📦 Inventory & Stock Management
- 💰 Purchase Order Management
- 🔄 Product Returns & Refunds
- 👥 Customer Management
- 💳 Expense Tracking & Categories
- 📊 Financial Reports & Analytics
- 📧 Email Campaign Management
- 📱 SMS Notifications
- 🔐 Firebase Authentication
- 👤 Role-based Access Control

### Technical Features
- Real-time stock updates
- Professional invoice generation
- Bulk product import
- Advanced search & filtering
- Responsive design for all devices
- Secure authentication with Firebase
- RESTful API architecture

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** React Query
- **Routing:** React Router v6
- **Authentication:** Firebase Auth
- **Charts:** Chart.js
- **HTTP Client:** Axios
- **Form Handling:** React Hook Form
- **Notifications:** React Hot Toast

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** Firebase Admin SDK
- **File Upload:** Multer
- **Security:** Helmet, CORS, Rate Limiting
- **Logging:** Winston
- **Email:** Nodemailer
- **SMS:** Twilio

### Deployment
- **Frontend Hosting:** Firebase Hosting
- **Backend Hosting:** Render.com
- **Database:** MongoDB Atlas
- **Authentication:** Firebase

---

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- MongoDB
- Firebase Account
- npm or yarn

### Clone Repository
```bash
git clone <repository-url>
cd "Health Care Surgical Mart"
```

### Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd client
npm install
```

### Environment Variables

**Backend (.env):**
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
ALLOWED_ORIGINS=http://localhost:5173,https://health-care-60ee6.web.app
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

---

## 🚀 Running Locally

### Start Backend
```bash
cd server
npm run dev
```
Backend runs on: http://localhost:5000

### Start Frontend
```bash
cd client
npm run dev
```
Frontend runs on: http://localhost:5173

---

## 📤 Deployment

### Frontend (Firebase Hosting)
```bash
cd client
npm run build
npm run deploy
```

### Backend (Render.com)
1. Push code to GitHub
2. Connect repository to Render
3. Set environment variables
4. Deploy

See `FIREBASE_HOSTING_DEPLOYMENT.md` for detailed deployment instructions.

---

## 📁 Project Structure

```
Health Care Surgical Mart/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── hooks/         # Custom React hooks
│   │   ├── contexts/      # React contexts
│   │   ├── config/        # Configuration files
│   │   ├── utils/         # Utility functions
│   │   └── styles/        # Global styles
│   └── public/            # Static assets
├── server/                # Backend Node.js application
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── controllers/   # Route controllers
│   │   ├── models/        # MongoDB models
│   │   ├── middleware/    # Express middleware
│   │   ├── config/        # Server configuration
│   │   └── utils/         # Utility functions
│   └── logs/              # Application logs
├── database/              # Database scripts
│   ├── migrations/        # Database migrations
│   └── seeds/             # Seed data
└── docs/                  # Documentation
```

---

## 🔐 Authentication

The system uses Firebase Authentication for secure user management:

- Email/Password authentication
- Role-based access control (Admin, Manager, Staff)
- Protected routes and API endpoints
- JWT token validation

---

## 📊 API Documentation

### Base URL
```
Production: https://health-care-surgical-mart.onrender.com/api
Development: http://localhost:5000/api
```

### Main Endpoints
- `POST /api/auth/firebase-login` - User authentication
- `GET /api/products` - Get all products
- `POST /api/sales` - Create new sale
- `GET /api/customers` - Get all customers
- `POST /api/expenses` - Create expense
- `GET /api/reports/financial` - Get financial reports

---

## 🧪 Testing

### Run Tests
```bash
# Frontend tests
cd client
npm run test

# Backend tests
cd server
npm run test
```

---

## 📝 License

This project is proprietary software for Health Care Surgical Mart.

---

## 👥 Authors

- **Developer:** Mahi M Rahman
- **Email:** mahimrahman07@gmail.com

---

## 🤝 Contributing

This is a private project. For any issues or suggestions, please contact the development team.

---

## 📞 Support

For technical support or inquiries:
- Email: mahimrahman07@gmail.com
- Project Console: https://console.firebase.google.com/project/health-care-60ee6

---

## 🔄 Version History

- **v2.0.0** - Current version with Firebase Hosting deployment
- **v1.0.0** - Initial release

---

**Last Updated:** April 3, 2026
