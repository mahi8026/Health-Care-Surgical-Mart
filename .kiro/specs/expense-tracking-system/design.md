# Design Document: Expense Tracking System

## Overview

The Expense Tracking System is a full-stack web application built on a multi-tenant architecture that enables medical store businesses to manage their expenses comprehensively. The system consists of:

- **Frontend**: React-based SPA with React Query for data management
- **Backend**: Node.js/Express REST API with MongoDB Atlas
- **Storage**: Cloud-based file storage for receipts and documents
- **Authentication**: JWT + Firebase for user authentication
- **Database**: MongoDB with tenant-specific databases

The system supports CRUD operations for expenses and categories, advanced filtering, bulk operations, recurring expenses, receipt attachments, and comprehensive reporting.

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Expenses    │  │   Add        │  │  Categories  │      │
│  │  Page        │  │   Expense    │  │  Page        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │  React Query    │                        │
│                   │  (Data Layer)   │                        │
│                   └────────┬────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Service   │
                    │   (HTTP Client) │
                    └────────┬────────┘
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                   Server Layer                                 │
│                   ┌────────▼────────┐                         │
│                   │  Express Router │                         │
│                   └────────┬────────┘                         │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│  ┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼──────┐      │
│  │  Expenses   │  │   Categories    │  │   File     │      │
│  │  Routes     │  │   Routes        │  │   Upload   │      │
│  └──────┬──────┘  └────────┬────────┘  └─────┬──────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                  │
│                   ┌────────▼────────┐                         │
│                   │  Auth Middleware│                         │
│                   │  RBAC           │                         │
│                   └────────┬────────┘                         │
└────────────────────────────┼──────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                   Data Layer                                   │
│                   ┌────────▼────────┐                         │
│                   │  Shop Database  │                         │
│                   │  Selector       │                         │
│                   └────────┬────────┘                         │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│  ┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼──────┐      │
│  │  expenses   │  │ expenseCategories│ │   users    │      │
│  │  collection │  │   collection    │  │ collection │      │
│  └─────────────┘  └─────────────────┘  └────────────┘      │
│                                                               │
│                   MongoDB Atlas (Multi-tenant)                │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                   Storage Layer                                │
│                   ┌────────────────┐                          │
│                   │  Cloud Storage │                          │
│                   │  (Receipts)    │                          │
│                   └────────────────┘                          │
└───────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Architecture

The system uses a database-per-tenant approach:

- Each shop has its own MongoDB database
- Database selection happens at the middleware layer based on authenticated user's shopId
- Collections (expenses, expenseCategories, users) exist in each shop database
- File storage is organized by shopId to maintain isolation

### Authentication Flow

```
1. User logs in → Firebase Authentication
2. Backend validates Firebase token
3. Backend issues JWT with shopId and permissions
4. All subsequent requests include JWT
5. Middleware validates JWT and extracts shopId
6. Middleware selects appropriate shop database
7. RBAC middleware checks permissions
8. Request proceeds to route handler
```

## Components and Interfaces

### Frontend Components

#### ExpensesPage Component

- **Purpose**: Main expense list view with filtering, sorting, and bulk operations
- **State Management**: React Query for server state, local state for UI
- **Key Features**:
  - Expense list with table/card view toggle
  - Advanced filtering panel
  - Summary statistics cards
  - Bulk selection and deletion
  - Edit expense modal
  - Export functionality
- **Dependencies**: ExpenseFilters, ExpenseList, ExpenseExport, ExpenseForm

#### AddExpensePage Component

- **Purpose**: Create new expenses with receipt uploads
- **State Management**: Local state for form and file uploads
- **Key Features**:
  - Expense form with validation
  - Multi-file receipt upload
  - Upload progress indication
  - File preview and removal
  - Quick tips sidebar
- **Dependencies**: ExpenseForm, LoadingSpinner

#### ExpenseCategories Component

- **Purpose**: Manage expense categories
- **State Management**: Local state with API service
- **Key Features**:
  - Category CRUD operations
  - Search and filtering
  - Summary statistics
  - Delete confirmation
  - Active/inactive status toggle
- **Dependencies**: CategoryModal, LoadingSpinner

#### ExpenseForm Component

- **Purpose**: Reusable form for creating/editing expenses
- **Props**: expense (optional), onSubmit, onCancel, loading
- **Validation**: Client-side validation for all fields
- **Features**:
  - Category selection
  - Amount input with currency formatting
  - Date picker
  - Payment method selection
  - Vendor information fields
  - Tags input
  - Recurring expense configuration
  - Notes textarea

#### ExpenseFilters Component

- **Purpose**: Advanced filtering interface
- **Props**: filters, onFiltersChange, categories, filterOptions
- **Features**:
  - Date range picker
  - Multi-select for categories
  - Multi-select for payment methods
  - Amount range inputs
  - Vendor search
  - Tag multi-select
  - Recurring filter toggle
  - Sort options
  - Clear filters button

#### ExpenseList Component

- **Purpose**: Display expenses in table or card format
- **Props**: expenses, loading, pagination, onPageChange, onSort, onEdit, onDelete, onBulkDelete, selectedExpenses, onSelectionChange, viewMode, onViewModeChange
- **Features**:
  - Sortable columns
  - Row selection checkboxes
  - Pagination controls
  - Action buttons (edit, delete)
  - Bulk action toolbar
  - Empty state
  - Loading state

### Backend Routes

#### Expenses Routes (`/api/expenses`)

```javascript
GET    /                      // List expenses with filters and pagination
GET    /:id                   // Get single expense by ID
POST   /                      // Create new expense
PUT    /:id                   // Update expense
DELETE /:id                   // Delete expense
POST   /bulk-delete           // Delete multiple expenses
POST   /upload-receipt        // Upload receipt files
GET    /receipts/:shopId/:filename  // Serve receipt file
DELETE /receipts/:filename    // Delete receipt file
PUT    /:id/attachments       // Update expense attachments
GET    /filter-options        // Get available filter options
```

#### Expense Categories Routes (`/api/expense-categories`)

```javascript
GET    /                      // List categories
GET    /:id                   // Get single category by ID
POST   /                      // Create new category
PUT    /:id                   // Update category
DELETE /:id                   // Soft delete category (deactivate)
```

### Services

#### expenseService

- **Methods**:
  - `getExpenses(filters)`: Fetch expenses with filters
  - `getExpense(id)`: Fetch single expense
  - `create(data)`: Create new expense
  - `update(id, data)`: Update expense
  - `delete(id)`: Delete expense
  - `bulkDelete(ids)`: Delete multiple expenses
  - `getFilterOptions()`: Get available filter options
  - `uploadReceipt(file)`: Upload receipt file

#### expenseCategoryService

- **Methods**:
  - `getCategories()`: Fetch all categories
  - `getActiveCategories()`: Fetch active categories only
  - `getCategory(id)`: Fetch single category
  - `create(data)`: Create new category
  - `update(id, data)`: Update category
  - `delete(id)`: Delete category

#### apiService

- **Methods**:
  - `get(endpoint, params)`: HTTP GET request
  - `post(endpoint, data)`: HTTP POST request
  - `put(endpoint, data)`: HTTP PUT request
  - `delete(endpoint)`: HTTP DELETE request
  - `request(endpoint, options)`: Generic HTTP request
- **Features**:
  - Automatic JWT token inclusion
  - Error handling and transformation
  - Response normalization

#### fileUploadService

- **Methods**:
  - `receiptUpload`: Multer middleware for file uploads
  - `processUploadedFiles(files, shopId)`: Process and store uploaded files
  - `deleteUploadedFile(shopId, filename)`: Delete file from storage
  - `getFilePath(shopId, filename)`: Get file system path
- **Configuration**:
  - Supported formats: JPG, PNG, PDF
  - Max file size: 10MB
  - Max files per upload: 5
  - Storage organization: `/uploads/{shopId}/receipts/{filename}`

#### expenseNumberGenerator

- **Method**: `generateExpenseNumber(shopDb)`: Generate unique expense number
- **Format**: EXP-YYYY-NNN (e.g., EXP-2024-001)
- **Logic**:
  - Extract current year
  - Find highest number for current year
  - Increment and pad to 3 digits
  - Handle concurrent requests with database operations

## Data Models

### Expense Schema

```javascript
{
  _id: ObjectId,                    // Primary key
  expenseNumber: String,            // Unique: "EXP-YYYY-NNN"
  categoryId: ObjectId,             // Reference to expenseCategories
  categoryName: String,             // Denormalized for reporting
  amount: Double,                   // Minimum 0.01, max 2 decimals
  description: String,              // Max 1000 characters
  expenseDate: Date,                // Required
  paymentMethod: String,            // Enum: "cash", "bank", "card"
  vendor: {
    name: String,                   // Max 200 characters
    phone: String,                  // Max 20 characters
    email: String                   // Email format validation
  },
  attachments: [{
    filename: String,
    url: String,
    uploadDate: Date
  }],
  isRecurring: Boolean,
  recurringConfig: {
    frequency: String,              // Enum: "daily", "weekly", "monthly", "yearly"
    interval: Int,                  // Minimum 1
    startDate: Date,
    endDate: Date,
    nextDueDate: Date
  },
  tags: [String],                   // Array of tags
  notes: String,                    // Max 2000 characters
  createdBy: ObjectId,              // Reference to users
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `expenseNumber`: Unique index
- `expenseDate`: Descending index
- `categoryId`: Index
- `createdBy`: Index
- `paymentMethod`: Index
- `(expenseDate, amount)`: Compound index
- `(isRecurring, recurringConfig.nextDueDate)`: Compound index
- `tags`: Index
- `vendor.name`: Index

### Expense Category Schema

```javascript
{
  _id: ObjectId,                    // Primary key
  name: String,                     // Unique, 1-100 characters
  description: String,              // Max 500 characters
  type: String,                     // Enum: "Fixed", "Variable", "One-time"
  isActive: Boolean,                // Required
  isDefault: Boolean,               // System default category
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `name`: Unique index
- `type`: Index
- `isActive`: Index
- `isDefault`: Index

### Aggregation Pipeline Structure

For expense listing with joins:

```javascript
[
  { $match: matchQuery }, // Apply filters
  {
    $lookup: {
      // Join with categories
      from: "expenseCategories",
      localField: "categoryId",
      foreignField: "_id",
      as: "category",
    },
  },
  { $unwind: "$category" }, // Flatten category array
  {
    $lookup: {
      // Join with users
      from: "users",
      localField: "createdBy",
      foreignField: "_id",
      as: "createdByUser",
    },
  },
  { $unwind: "$createdByUser" }, // Flatten user array
  { $match: searchQuery }, // Apply search after joins
  { $sort: sortCriteria }, // Apply sorting
  { $skip: offset }, // Pagination offset
  { $limit: pageSize }, // Pagination limit
];
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Expense Number Uniqueness

_For any_ two expenses in the same Shop_Database, their expense numbers must be different.
**Validates: Requirements 2.1, 18.4**

### Property 2: Expense Number Format Consistency

_For any_ generated expense number, it must match the pattern EXP-YYYY-NNN where YYYY is a 4-digit year and NNN is a 3-or-more digit number.
**Validates: Requirements 2.1, 18.1**

### Property 3: Amount Precision Validation

_For any_ expense amount, when multiplied by 100 and rounded, it must equal the original amount multiplied by 100 (ensuring max 2 decimal places).
**Validates: Requirements 2.3**

### Property 4: Positive Amount Validation

_For any_ expense amount, it must be greater than zero.
**Validates: Requirements 2.4**

### Property 5: Future Date Validation for Non-Recurring Expenses

_For any_ non-recurring expense, the expense date must not be after the current date.
**Validates: Requirements 2.5**

### Property 6: Category Name Uniqueness

_For any_ two categories in the same Shop_Database, their names must be different (case-insensitive).
**Validates: Requirements 1.5, 1.9**

### Property 7: Category Deletion Protection

_For any_ category with associated expenses, deletion attempts must fail and the category must remain in the database.
**Validates: Requirements 1.6**

### Property 8: Vendor Email Format Validation

_For any_ vendor email provided, it must match the email regex pattern.
**Validates: Requirements 3.4**

### Property 9: File Size Validation

_For any_ uploaded file, its size must be less than or equal to 10MB (10485760 bytes).
**Validates: Requirements 4.2**

### Property 10: File Format Validation

_For any_ uploaded file, its MIME type must be one of: image/jpeg, image/jpg, image/png, or application/pdf.
**Validates: Requirements 4.1**

### Property 11: Recurring End Date Validation

_For any_ recurring expense with both start and end dates, the end date must be after the start date.
**Validates: Requirements 5.5**

### Property 12: Multi-Tenant Data Isolation

_For any_ user request for expenses, all returned expenses must have been created within that user's Shop_Database.
**Validates: Requirements 11.3**

### Property 13: Filter Application Consistency

_For any_ expense query with date range filter, all returned expenses must have expense dates within the specified range (inclusive).
**Validates: Requirements 6.1**

### Property 14: Category Filter Application

_For any_ expense query with category filter, all returned expenses must have categoryId matching one of the specified categories.
**Validates: Requirements 6.2**

### Property 15: Amount Range Filter Application

_For any_ expense query with amount range filter, all returned expenses must have amounts within the specified range (inclusive).
**Validates: Requirements 6.4**

### Property 16: Search Text Matching

_For any_ expense query with search text, all returned expenses must match the search text in at least one of: description, vendor name, vendor email, expense number, tags, notes, category name, or creator name (case-insensitive).
**Validates: Requirements 6.8**

### Property 17: Pagination Consistency

_For any_ paginated expense query, the total count of expenses across all pages must equal the total count returned in pagination metadata.
**Validates: Requirements 7.6**

### Property 18: Sort Order Consistency

_For any_ expense query with sort criteria, the returned expenses must be ordered according to the specified field and direction.
**Validates: Requirements 7.1, 7.2**

### Property 19: Bulk Delete ID Validation

_For any_ bulk delete operation, all provided IDs must be valid MongoDB ObjectIds.
**Validates: Requirements 8.3**

### Property 20: Bulk Delete Count Accuracy

_For any_ bulk delete operation, the returned deleted count must equal the number of expenses actually removed from the database.
**Validates: Requirements 8.5**

### Property 21: Summary Statistics Accuracy

_For any_ expense list view, the total amount in summary statistics must equal the sum of all expense amounts in the current filtered view.
**Validates: Requirements 9.2**

### Property 22: Current Month Calculation

_For any_ expense list view, expenses counted in "this month" summary must have expense dates in the current calendar month and year.
**Validates: Requirements 9.3**

### Property 23: Recurring Count Accuracy

_For any_ expense list view, the recurring count in summary statistics must equal the count of expenses where isRecurring is true.
**Validates: Requirements 9.4**

### Property 24: String Length Validation

_For any_ expense field with maximum length constraint (description: 1000, notes: 2000, vendor name: 200, vendor phone: 20), the provided value must not exceed the specified length.
**Validates: Requirements 2.7, 2.8, 3.2, 3.3**

### Property 25: Category String Length Validation

_For any_ category field with maximum length constraint (name: 100, description: 500), the provided value must be within the specified range.
**Validates: Requirements 1.3, 1.4**

### Property 26: Payment Method Validation

_For any_ expense, the payment method must be one of: "cash", "bank", or "card".
**Validates: Requirements 2.6**

### Property 27: Category Type Validation

_For any_ category, the type must be one of: "Fixed", "Variable", or "One-time".
**Validates: Requirements 1.1**

### Property 28: Recurring Frequency Validation

_For any_ recurring expense, the frequency must be one of: "daily", "weekly", "monthly", or "yearly".
**Validates: Requirements 5.2**

### Property 29: Recurring Interval Validation

_For any_ recurring expense, the interval must be at least 1.
**Validates: Requirements 5.3**

### Property 30: Active Category Validation

_For any_ expense creation, the specified category must exist and have isActive set to true.
**Validates: Requirements 2.9**

### Property 31: Attachment Array Integrity

_For any_ expense with attachments, each attachment must have filename, url, and uploadDate fields.
**Validates: Requirements 4.5**

### Property 32: Tag Array Type Validation

_For any_ expense with tags, all tags must be non-empty strings.
**Validates: Requirements 2.15**

### Property 33: Cross-Tenant File Access Prevention

_For any_ receipt file request, the user's shopId must match the shopId in the file path.
**Validates: Requirements 11.4**

### Property 34: Default Category Protection

_For any_ category marked as isDefault true, deletion attempts must fail.
**Validates: Requirements 19.3**

### Property 35: Expense Number Year Consistency

_For any_ expense created in year Y, the expense number must contain year Y in the format portion.
**Validates: Requirements 18.2**

### Property 36: Denormalized Category Name Consistency

_For any_ expense, the categoryName field must match the name of the category referenced by categoryId at the time of expense creation or update.
**Validates: Requirements 2.10**

### Property 37: Timestamp Update Consistency

_For any_ expense update operation, the updatedAt timestamp must be set to the current time.
**Validates: Requirements 2.12**

### Property 38: Creator Tracking

_For any_ expense, the createdBy field must reference a valid user ID from the users collection.
**Validates: Requirements 2.11**

### Property 39: Filter Options Limit

_For any_ filter options request, the returned vendors and tags arrays must contain at most 100 items each.
**Validates: Requirements 6.11**

### Property 40: Pagination Reset on Filter Change

_For any_ expense query where filters change, the page number must reset to 1.
**Validates: Requirements 7.7**

## Error Handling

### Validation Errors (400 Bad Request)

- Missing required fields
- Invalid data types or formats
- Out-of-range values
- String length violations
- Invalid enum values
- Business rule violations (e.g., future dates for non-recurring expenses)

### Not Found Errors (404 Not Found)

- Expense ID not found
- Category ID not found
- Receipt file not found
- No expenses match bulk delete IDs

### Conflict Errors (409 Conflict)

- Duplicate category name
- Cannot delete category with expenses

### Authorization Errors (403 Forbidden)

- Insufficient permissions for operation
- Cross-tenant file access attempt

### Authentication Errors (401 Unauthorized)

- Missing or invalid JWT token
- Expired token
- Invalid Firebase token

### File Upload Errors

- File too large (>10MB)
- Unsupported file format
- Upload failure to cloud storage
- Disk space issues

### Database Errors

- Connection failures
- Query timeouts
- Constraint violations
- Transaction failures

### Error Response Format

```javascript
{
  success: false,
  message: "Human-readable error message",
  error: {
    code: "ERROR_CODE",
    details: { /* Additional context */ }
  }
}
```

## Testing Strategy

### Unit Testing

Unit tests should focus on:

- Individual validation functions (amount precision, email format, date validation)
- Expense number generation logic
- Filter query building
- Data transformation functions
- Error handling for specific cases
- Edge cases (empty strings, null values, boundary values)

### Property-Based Testing

Property-based tests should verify universal properties across randomized inputs:

- Each correctness property listed above should have a corresponding property test
- Minimum 100 iterations per property test
- Use property-based testing library appropriate for the language (e.g., fast-check for JavaScript)
- Tag each test with: **Feature: expense-tracking-system, Property {number}: {property_text}**

**Example Property Test Structure:**

```javascript
// Feature: expense-tracking-system, Property 3: Amount Precision Validation
test("expense amounts must have maximum 2 decimal places", () => {
  fc.assert(
    fc.property(fc.double({ min: 0.01, max: 1000000 }), (amount) => {
      const rounded = Math.round(amount * 100) / 100;
      // If amount has more than 2 decimals, validation should fail
      if (amount !== rounded) {
        expect(() => validateAmount(amount)).toThrow();
      } else {
        expect(() => validateAmount(amount)).not.toThrow();
      }
    }),
    { numRuns: 100 },
  );
});
```

### Integration Testing

Integration tests should verify:

- API endpoint responses with various filter combinations
- Database operations with actual MongoDB instance
- File upload and retrieval flow
- Authentication and authorization middleware
- Multi-tenant data isolation
- Aggregation pipeline results

### End-to-End Testing

E2E tests should verify:

- Complete user workflows (create expense → upload receipt → view in list)
- Filter and search functionality
- Bulk operations
- Category management
- Cross-page navigation
- Error message display

### Testing Configuration

- **Unit tests**: Run on every commit
- **Property tests**: Run on every commit (100+ iterations each)
- **Integration tests**: Run before merge to main branch
- **E2E tests**: Run nightly and before releases
- **Test coverage target**: 80% for unit tests, 100% for property tests (all properties must be tested)

### Test Data Generation

For property-based tests, generate:

- Random expense amounts (0.01 to 1,000,000)
- Random dates (past, present, future)
- Random strings of various lengths
- Random arrays of tags
- Random vendor information
- Random category types
- Random payment methods
- Random file sizes and formats
- Random ObjectIds
- Random shop IDs for multi-tenant testing

### Mocking Strategy

- Mock external services (Firebase, cloud storage) in unit tests
- Use test database for integration tests
- Mock API responses in frontend component tests
- Use real services in E2E tests (staging environment)
