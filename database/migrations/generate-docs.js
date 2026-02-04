#!/usr/bin/env node

/**
 * Documentation Generator
 * Generates API documentation and project documentation
 */

const fs = require("fs");
const path = require("path");

console.log("📚 Generating project documentation...");

// Create docs directory if it doesn't exist
const docsDir = path.join(__dirname, "../docs");
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Generate API documentation placeholder
const apiDocs = `# API Documentation

## Authentication

### POST /api/auth/login
Login to the system

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123",
  "shopId": "shop_id_optional"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "role": "SHOP_ADMIN"
    }
  }
}
\`\`\`

## Products

### GET /api/products
Get all products for the authenticated shop

**Query Parameters:**
- \`page\` (optional): Page number (default: 1)
- \`limit\` (optional): Items per page (default: 50)
- \`search\` (optional): Search term

**Response:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "_id": "product_id",
      "name": "Product Name",
      "sku": "SKU123",
      "category": "Medical",
      "purchasePrice": 10.00,
      "sellingPrice": 15.00,
      "stock": {
        "quantity": 100,
        "isLowStock": false
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
\`\`\`

### POST /api/products
Create a new product

**Request Body:**
\`\`\`json
{
  "name": "Product Name",
  "sku": "SKU123",
  "brand": "Brand Name",
  "category": "Medical",
  "purchasePrice": 10.00,
  "sellingPrice": 15.00,
  "unit": "pcs",
  "minStockLevel": 10,
  "description": "Product description"
}
\`\`\`

## Sales

### POST /api/sales
Create a new sale

**Request Body:**
\`\`\`json
{
  "customerId": "customer_id_optional",
  "items": [
    {
      "productId": "product_id",
      "qty": 2,
      "unitPrice": 15.00
    }
  ],
  "grandTotal": 30.00,
  "cashPaid": 30.00,
  "bankPaid": 0.00,
  "notes": "Sale notes"
}
\`\`\`

## Error Responses

All endpoints may return error responses in this format:

\`\`\`json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}
\`\`\`

## Status Codes

- \`200\` - Success
- \`201\` - Created
- \`400\` - Bad Request
- \`401\` - Unauthorized
- \`403\` - Forbidden
- \`404\` - Not Found
- \`409\` - Conflict
- \`429\` - Too Many Requests
- \`500\` - Internal Server Error
`;

fs.writeFileSync(path.join(docsDir, "API.md"), apiDocs);

// Generate deployment guide
const deploymentGuide = `# Deployment Guide

## Production Deployment

### Prerequisites
- Node.js 18+ installed
- MongoDB Atlas cluster configured
- SSL certificate (recommended)
- Domain name configured

### Environment Setup

1. **Server Setup**
   \`\`\`bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 for process management
   npm install -g pm2
   \`\`\`

2. **Application Deployment**
   \`\`\`bash
   # Clone repository
   git clone <repository-url>
   cd medical-store-pos-system
   
   # Install dependencies
   npm ci --production
   
   # Copy environment file
   cp .env.example .env
   # Edit .env with production values
   \`\`\`

3. **Environment Configuration**
   \`\`\`env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
   JWT_SECRET=your_super_secure_jwt_secret_key_minimum_32_characters
   ALLOWED_ORIGINS=https://yourdomain.com
   LOG_LEVEL=warn
   \`\`\`

4. **Database Setup**
   \`\`\`bash
   # Seed production database
   npm run seed:prod
   \`\`\`

5. **Start Application**
   \`\`\`bash
   # Start with PM2
   pm2 start src/server.js --name "medical-pos"
   pm2 startup
   pm2 save
   \`\`\`

### Nginx Configuration

\`\`\`nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

### Monitoring Setup

\`\`\`bash
# Monitor with PM2
pm2 monit

# View logs
pm2 logs medical-pos

# Restart application
pm2 restart medical-pos
\`\`\`

## Docker Deployment

### Dockerfile
\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
\`\`\`

### Docker Compose
\`\`\`yaml
version: '3.8'

services:
  medical-pos:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
      - JWT_SECRET=your_jwt_secret
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
\`\`\`

## Security Checklist

- [ ] Strong JWT secret (32+ characters)
- [ ] HTTPS enabled with valid SSL certificate
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Environment variables secured
- [ ] Rate limiting configured
- [ ] CORS origins restricted
- [ ] Security headers enabled
- [ ] Regular security updates applied
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured
`;

fs.writeFileSync(path.join(docsDir, "DEPLOYMENT.md"), deploymentGuide);

console.log("✅ Documentation generated successfully!");
console.log("📁 Files created:");
console.log("  - docs/API.md");
console.log("  - docs/DEPLOYMENT.md");
