# Health Care Surgical Mart - Frontend

A modern, professional React frontend for the Health Care Surgical Mart POS system with comprehensive expense tracking capabilities.

## 🚀 Features

- **Modern React Architecture**: Built with React 18, Vite, and modern development practices
- **Expense Management**: Complete expense tracking with categories, receipts, and analytics
- **Professional UI**: Clean, responsive design with Tailwind CSS
- **Type Safety**: TypeScript-like prop validation and consistent interfaces
- **Performance Optimized**: Code splitting, caching, and bundle optimization
- **Accessibility**: WCAG compliant components and keyboard navigation
- **Testing Ready**: Comprehensive testing setup with Vitest and Testing Library

## 📁 Project Structure

```
client/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Basic UI components
│   │   ├── expense/        # Expense-specific components
│   │   └── index.js        # Centralized exports
│   ├── config/             # Configuration and constants
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Page components
│   ├── services/           # API services
│   ├── utils/              # Utility functions
│   └── styles/             # Global styles
├── public/                 # Static assets
├── tests/                  # Test files
└── docs/                   # Documentation
```

## 🛠️ Technology Stack

- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query + Context API
- **Routing**: React Router v6
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint + Prettier

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Backend server running on port 5000

### Installation

1. **Clone and navigate to client directory**

   ```bash
   cd client
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Configure your environment variables:

   ```env
   VITE_API_URL=http://localhost:5000
   VITE_APP_NAME=Health Care Surgical Mart
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 📜 Available Scripts

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Testing

- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier

## 🏗️ Architecture Overview

### Component Architecture

The frontend follows a layered component architecture:

1. **UI Components** (`components/ui/`)
   - Basic, reusable components (Button, Input, Modal)
   - No business logic, pure presentation
   - Consistent prop interfaces

2. **Feature Components** (`components/expense/`)
   - Domain-specific components
   - Compose UI components
   - Handle feature logic

3. **Page Components** (`pages/`)
   - Route-level components
   - Orchestrate feature components
   - Handle page state

### Service Layer

All API interactions are handled through service classes:

```javascript
// Example usage
import { expenseService } from "../services";

const expenses = await expenseService.getExpenses({
  category: "rent",
  startDate: "2024-01-01",
});
```

### Custom Hooks

Reusable logic is encapsulated in custom hooks:

```javascript
// Example usage
import { useApi, usePagination } from "../hooks";

const { execute, loading, error } = useApi();
const { currentPage, goToPage, pagination } = usePagination();
```

## 💼 Expense Management Features

### Core Features

- ✅ Expense creation and editing
- ✅ Category management
- ✅ Receipt uploads
- ✅ Recurring expenses
- ✅ Advanced filtering and search
- ✅ Bulk operations
- ✅ Financial analytics

### Expense Categories

- Pre-defined default categories
- Custom category creation
- Category-based filtering
- Soft delete with dependency checking

### File Uploads

- Receipt attachment support
- Multiple file formats (PDF, JPG, PNG)
- File size validation (5MB limit)
- Cloud storage integration

### Analytics

- Expense trends over time
- Category-wise distribution
- Month-over-month comparisons
- Expense ratio analysis

## 🎨 UI/UX Guidelines

### Design System

- **Colors**: Professional blue and gray palette
- **Typography**: Clean, readable font hierarchy
- **Spacing**: Consistent 4px grid system
- **Components**: Reusable, accessible components

### Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly interface
- Optimized for tablets and mobile devices

### Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast color schemes

## 🔧 Configuration

### Environment Variables

```env
# API Configuration
VITE_API_URL=http://localhost:5000
VITE_API_TIMEOUT=30000

# Application
VITE_APP_NAME=Health Care Surgical Mart
VITE_APP_VERSION=2.0.0

# Features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_FILE_UPLOAD=true
```

### Build Configuration

The project uses Vite for fast development and optimized builds:

- **Hot Module Replacement** for instant updates
- **Tree Shaking** for smaller bundles
- **Code Splitting** for better caching
- **Asset Optimization** for faster loading

## 🧪 Testing

### Testing Strategy

- **Unit Tests**: Component logic and utilities
- **Integration Tests**: Component interactions
- **E2E Tests**: Complete user workflows

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Test Structure

```
tests/
├── components/     # Component tests
├── hooks/          # Hook tests
├── services/       # Service tests
├── utils/          # Utility tests
└── e2e/           # End-to-end tests
```

## 📊 Performance

### Optimization Techniques

- **Code Splitting**: Route-based and component-based
- **Lazy Loading**: Dynamic imports for large components
- **Caching**: React Query for server state
- **Bundle Analysis**: Webpack Bundle Analyzer

### Performance Metrics

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.5s
- **Bundle Size**: < 500KB gzipped

## 🔒 Security

### Security Measures

- **Input Validation**: Client and server-side validation
- **XSS Protection**: Sanitized user inputs
- **CSRF Protection**: Token-based authentication
- **Secure Headers**: Content Security Policy

### Authentication

- JWT-based authentication
- Automatic token refresh
- Role-based access control
- Secure logout handling

## 🚀 Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Setup

1. Configure production environment variables
2. Set up CDN for static assets
3. Configure reverse proxy (nginx)
4. Set up SSL certificates

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 📚 Documentation

- [Architecture Guide](./FRONTEND_ARCHITECTURE.md)
- [Component Documentation](./docs/components.md)
- [API Integration Guide](./docs/api-integration.md)
- [Testing Guide](./docs/testing.md)

## 🤝 Contributing

### Development Workflow

1. Create feature branch from `main`
2. Follow coding standards and conventions
3. Write tests for new features
4. Update documentation as needed
5. Submit pull request with clear description

### Code Standards

- Use ESLint and Prettier configurations
- Follow React best practices
- Write meaningful commit messages
- Add JSDoc comments for complex functions

## 📝 License

This project is proprietary software for Health Care Surgical Mart.

## 🆘 Support

For technical support or questions:

- Create an issue in the project repository
- Contact the development team
- Check the documentation and FAQ

---

**Built with ❤️ for Health Care Surgical Mart**
