# Test Data Seeding Scripts

## Overview
This directory contains scripts for seeding test data into the database.

## Available Scripts

### seed-test-data.js
Seeds 50 test products with stock entries into the database.

**What it creates:**
- 50 products across 3 categories:
  - Medical: 20 products (medicines, syrups, tablets)
  - Lab: 15 products (test strips, reagents, supplies)
  - Surgical: 15 products (masks, gloves, instruments)
- Stock entries for each product with random quantities (50-250 units)
- Products with various units: pcs, box, pack, bottle, strip, vial, ml, ltr, gm, kg

**How to run:**
```bash
# From the server directory
npm run seed:test

# Or directly with node
node src/scripts/seed-test-data.js
```

**Requirements:**
- MongoDB must be running
- A shop must already exist in the database
- Environment variables must be configured (.env file)

**What happens:**
1. Connects to MongoDB using MONGO_URI from .env
2. Finds the first shop in the database
3. Inserts 50 products into the shop's products collection
4. Creates corresponding stock entries with random quantities
5. Displays a summary of what was created

**Output Example:**
```
=== Test Data Summary ===
Shop: Health Care Surgical Mart
Products added: 50
Stock entries created: 50

Breakdown by category:
- Medical: 20 products
- Lab: 15 products
- Surgical: 15 products

Breakdown by unit:
- strip: 10 products
- bottle: 8 products
- box: 12 products
- pcs: 10 products
- pack: 3 products
- vial: 1 products
- ml: 2 products
- ltr: 2 products
- gm: 1 products
- kg: 1 products

✓ Test data seeded successfully!
```

## Notes
- The script is idempotent-safe (can be run multiple times)
- Each run creates new products with unique SKUs
- Products are marked as active by default
- Stock quantities are randomized between 50-250 units
- Low stock alerts are automatically set based on minStockLevel

## Troubleshooting

**Error: "No shop found!"**
- Solution: Create a shop first using the main seed script or through the application

**Error: "Connection refused"**
- Solution: Make sure MongoDB is running and MONGO_URI is correct in .env

**Error: "Duplicate key error"**
- Solution: SKUs are timestamped, so this shouldn't happen. If it does, wait a second and try again.
