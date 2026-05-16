# 🏥 Health Care Surgical Mart

<div align="center">

![Health Care Surgical Mart](https://img.shields.io/badge/Health%20Care-Surgical%20Mart-blue?style=for-the-badge&logo=hospital&logoColor=white)
![Version](https://img.shields.io/badge/version-2.0.0-green?style=for-the-badge)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=for-the-badge&logo=node.js)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

**A full-featured, multi-tenant Point of Sale (POS) system built for medical & surgical stores.**

[🌐 Live Demo](#live-demo) • [✨ Features](#features) • [🚀 Getting Started](#getting-started) • [📡 API](#api-documentation) • [🤝 Contributing](#contributing)

</div>

---

## 🌐 Live Demo

| Service | URL |
|---------|-----|
| 🖥️ **Frontend (Firebase)** | [https://health-care-60ee6.web.app](https://health-care-60ee6.web.app) |
| ⚙️ **Backend API (Render)** | [https://medical-pos-backend.onrender.com](https://medical-pos-backend.onrender.com) |
| 🔍 **API Health Check** | [https://medical-pos-backend.onrender.com/health](https://medical-pos-backend.onrender.com/health) |

> **Note:** The backend runs on Render's free tier and may take **~30 seconds** to wake up on first request.

---

## 📸 Overview

Health Care Surgical Mart is a comprehensive **Point of Sale and inventory management** system tailored for medical and surgical supply stores. It supports multi-tenant architecture, meaning multiple shop owners can manage their businesses independently on the same platform.

---

## ✨ Features

### 🛒 Sales & POS
- Real-time sales entry with product search and auto-complete
- Invoice generation and print-ready layouts
- Support for cash, due/credit, and online payment methods
- Customer-linked sales with contact info on invoices

### 📦 Inventory Management
- Product catalog with categories, SKUs, and stock levels
- Bulk product import via CSV
- Low stock alerts and stock reports
- Purchase tracking and supplier management

### 👥 Customer Management
- Customer profiles with address and contact info
- Sales history per customer
- Due payment tracking

### 📊 Financial Reporting
- Dashboard with revenue, expenses, and profit overview
- Detailed financial reports with date filters
- Expense tracking by category
- Purchase vs. sales analysis

### 🔄 Returns Management
- Product return processing
- Return history and refund tracking

### 🔔 Notifications & Communication
- SMS notifications via Twilio
- Email campaigns via SendGrid & Mailchimp
- In-app notification settings

### 🔐 Security & Auth
- Firebase Authentication (phone/email OTP)
- JWT-based API authorization
- Role-based access control
- Rate limiting, Helmet.js, and CORS protection

### ⚡ Performance
- Redis caching layer for fast data access
- Cache invalidation on data mutations
- Sentry error monitoring

---

## 🏗️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Styling |
| **React Router v6** | Client-side routing |
| **React Query** | Server state management |
| **React Hook Form** | Form handling |
| **Chart.js** | Data visualization |
| **Firebase** | Authentication & Hosting |
| **Lucide React** | Icons |
| **Sentry** | Error monitoring |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js ≥ 18** | Runtime |
| **Express.js** | Web framework |
| **MongoDB** | Primary database |
| **Redis (ioredis)** | Caching layer |
| **Firebase Admin SDK** | Auth verification |
| **JWT** | API authorization |
| **Twilio** | SMS notifications |
| **SendGrid** | Transactional email |
| **Multer** | File uploads |
| **PDFKit** | Invoice PDF generation |
| **Winston** | Logging |
| **Sentry** | Error tracking |

### Infrastructure
| Service | Usage |
|---------|-------|
| **Firebase Hosting** | Frontend deployment |
| **Render** | Backend deployment |
| **MongoDB Atlas** | Cloud database |
| **Redis Cloud / Upstash** | Managed Redis |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `>= 18.0.0`
- **npm** `>= 9.0.0`
- **MongoDB** (local or Atlas)
- **Redis** (local or cloud)
- **Firebase project** with Authentication enabled

### 1. Clone the Repository

```bash
git clone https://github.com/mahi8026/Health-Care-Surgical-Mart.git
cd Health-Care-Surgical-Mart
```

### 2. Install Dependencies

```bash
# Install all dependencies (server + client)
npm run install-all
```

Or manually:

```bash
cd server && npm install
cd ../client && npm install
```

### 3. Configure Environment Variables

**Server** — create `server/.env`:

```env
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/

# JWT
JWT_SECRET=your_jwt_secret_here

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

# Redis
REDIS_URL=redis://localhost:6379

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# SendGrid (Email)
SENDGRID_API_KEY=your_sendgrid_api_key
```

**Client** — create `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

### 4. Run Locally

```bash
# Terminal 1 — Start backend
cd server
npm run dev

# Terminal 2 — Start frontend
cd client
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:5000](http://localhost:5000)

---

## 📁 Project Structure

```
Health-Care-Surgical-Mart/
├── client/                   # React frontend (Vite)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Route-level pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Sales.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Purchases.jsx
│   │   │   ├── Returns.jsx
│   │   │   ├── FinancialReports.jsx
│   │   │   ├── StockReport.jsx
│   │   │   └── Settings.jsx
│   │   ├── contexts/         # React Context (Auth, etc.)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # Axios API service layer
│   │   └── utils/            # Helper utilities
│   └── public/
│
├── server/                   # Express.js backend
│   └── src/
│       ├── routes/           # API route handlers
│       ├── middleware/        # Auth, error, rate-limit
│       ├── models/           # MongoDB schemas
│       ├── services/         # Business logic
│       ├── utils/            # Helpers & initializers
│       └── server.js         # App entry point
│
├── database/                 # DB migrations & seeds
├── render.yaml               # Render deployment config
├── firebase.json             # Firebase hosting config
└── package.json              # Root scripts
```

---

## 📡 API Documentation

The backend exposes a REST API with the following key endpoints:

| Module | Base Path |
|--------|-----------|
| Auth | `POST /api/auth/login` |
| Dashboard | `GET /api/dashboard/stats` |
| Products | `/api/products` |
| Sales | `/api/sales` |
| Purchases | `/api/purchases` |
| Customers | `/api/customers` |
| Returns | `/api/returns` |
| Expenses | `/api/expenses` |
| Reports | `/api/reports` |
| Settings | `/api/settings` |

> Full Swagger API docs available at: `https://medical-pos-backend.onrender.com/api-docs`

---

## 🧪 Testing

```bash
# Run all backend tests
cd server
npm test

# Run with coverage report
npm run test:coverage
```

---

## 🚢 Deployment

### Frontend → Firebase Hosting

```bash
cd client
npm run deploy
```

### Backend → Render

Push to the `main` branch — Render auto-deploys via the `render.yaml` configuration.

---

## 🛡️ Security

- 🔐 Firebase Phone/Email OTP Authentication
- 🔑 JWT token validation on every protected route
- 🛡️ Helmet.js security headers
- 🚦 Rate limiting on all API endpoints
- 🌐 CORS restricted to allowed origins
- 🔒 Environment variables never committed to source

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 👨‍💻 Author

**Mahim** — [@mahi8026](https://github.com/mahi8026)

---

## 📄 License

This project is licensed under the **MIT License**.

---

<div align="center">

Made with ❤️ for the health care community

⭐ Star this repo if you found it helpful!

</div>
