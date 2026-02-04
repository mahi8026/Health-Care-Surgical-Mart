# Bulk Product Import Module - Complete Guide

## Overview

The Bulk Product Catalog Automation Module enables enterprise-level mass product management for Health Care Surgical Mart. Import hundreds or thousands of products at once using CSV or Excel files.

## Features

### ✨ Core Capabilities

- **Mass Import**: Upload CSV or Excel files with product data
- **Template Download**: Pre-formatted template with sample data
- **Real-time Progress**: Visual progress bar during import
- **Error Handling**: Detailed error reporting with row numbers
- **Validation**: Comprehensive data validation before import
- **Duplicate Detection**: Prevents duplicate SKU entries
- **Bulk Export**: Export existing products to CSV
- **Bulk Update**: Update multiple products at once
- **Bulk Delete**: Delete multiple products by SKU

### 🔒 Security Features

- File type validation (CSV, XLSX, XLS only)
- File size limit (10MB maximum)
- Shop-level data isolation (multi-tenant)
- Authentication required
- Automatic file cleanup after processing

## File Format

### Required Columns

| Column        | Type   | Required | Description         | Example                 |
| ------------- | ------ | -------- | ------------------- | ----------------------- |
| name          | String | Yes      | Product name        | Surgical Gloves         |
| sku           | String | Yes      | Unique product code | SG-001                  |
| category      | String | Yes      | Product category    | Medical Supplies        |
| purchasePrice | Number | Yes      | Cost price          | 50                      |
| sellingPrice  | Number | Yes      | Selling price       | 75                      |
| unit          | String | Yes      | Unit of measurement | Box                     |
| minStockLevel | Number | No       | Minimum stock alert | 10                      |
| description   | String | No       | Product description | Sterile surgical gloves |

### Sample CSV Template

```csv
name,sku,category,purchasePrice,sellingPrice,unit,minStockLevel,description
Surgical Gloves,SG-001,Medical Supplies,50,75,Box,10,Sterile surgical gloves
Bandage Roll,BR-002,Medical Supplies,15,25,Roll,20,Cotton bandage roll
Syringe 5ml,SY-003,Instruments,5,10,Piece,50,Disposable syringe
Stethoscope,ST-004,Instruments,500,750,Piece,5,Professional stethoscope
Blood Pressure Monitor,BP-005,Equipment,1200,1800,Piece,3,Digital BP monitor
```

## Usage Guide

### 1. Download Template

1. Navigate to **Products** page
2. Click **Bulk Import** button
3. Click **Download Template** button
4. Save the CSV file to your computer

### 2. Prepare Your Data

1. Open the template in Excel or any spreadsheet software
2. Fill in your product data following the format
3. Ensure all required fields are filled
4. Validate data:
   - SKUs must be unique
   - Prices must be positive numbers
   - Selling price ≥ Purchase price
   - Units should be consistent (Box, Piece, Roll, etc.)
5. Save as CSV or Excel file

### 3. Import Products

1. Click **Bulk Import** button on Products page
2. Click **Upload** area or drag and drop your file
3. Review the selected file name
4. Click **Import Products** button
5. Wait for the import to complete
6. Review the results:
   - **Imported**: Successfully added products
   - **Failed**: Products with errors
   - **Total**: Total rows processed

### 4. Handle Errors

If errors occur:

1. Review the error messages (includes row numbers)
2. Fix the issues in your file
3. Re-import the corrected file
4. Only failed rows need to be re-imported

## API Endpoints

### POST /api/bulk-products/bulk-import

Import products from CSV or Excel file.

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Body: FormData with 'file' field
- Authentication: Required (JWT token)

**Response:**

```json
{
  "success": true,
  "message": "Import completed: 45 products imported, 2 failed",
  "data": {
    "totalRows": 47,
    "successCount": 45,
    "errorCount": 2,
    "errors": [
      "Row 12: Product with SKU SG-001 already exists",
      "Row 25: Valid selling price is required"
    ],
    "imported": [
      { "name": "Surgical Gloves", "sku": "SG-001" },
      { "name": "Bandage Roll", "sku": "BR-002" }
    ]
  }
}
```

### GET /api/bulk-products/bulk-export

Export all products to CSV file.

**Request:**

- Method: GET
- Authentication: Required (JWT token)

**Response:**

- Content-Type: text/csv
- File download with all products

### PUT /api/bulk-products/bulk-update

Update multiple products at once.

**Request:**

```json
{
  "updates": [
    {
      "sku": "SG-001",
      "sellingPrice": 80,
      "minStockLevel": 15
    },
    {
      "sku": "BR-002",
      "purchasePrice": 18,
      "sellingPrice": 28
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Bulk update completed: 2 products updated, 0 failed",
  "data": {
    "totalRows": 2,
    "successCount": 2,
    "errorCount": 0,
    "errors": []
  }
}
```

### POST /api/bulk-products/bulk-delete

Delete multiple products by SKU.

**Request:**

```json
{
  "skus": ["SG-001", "BR-002", "SY-003"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Bulk delete completed: 3 products deleted, 0 failed",
  "data": {
    "totalRows": 3,
    "successCount": 3,
    "errorCount": 0,
    "errors": []
  }
}
```

## Validation Rules

### Product Name

- Required field
- Cannot be empty
- Trimmed of whitespace

### SKU (Stock Keeping Unit)

- Required field
- Must be unique within shop
- Cannot be empty
- Trimmed of whitespace
- Case-sensitive

### Category

- Required field
- Cannot be empty
- Trimmed of whitespace

### Purchase Price

- Required field
- Must be a valid number
- Must be positive (> 0)

### Selling Price

- Required field
- Must be a valid number
- Must be positive (> 0)
- Must be ≥ Purchase Price

### Unit

- Required field
- Cannot be empty
- Common values: Box, Piece, Roll, Bottle, Strip, Vial, Pack

### Minimum Stock Level

- Optional field
- Must be a valid integer if provided
- Defaults to 0 if not provided

### Description

- Optional field
- Trimmed of whitespace

## Error Messages

### Common Errors

| Error                                                     | Cause             | Solution                             |
| --------------------------------------------------------- | ----------------- | ------------------------------------ |
| "No file uploaded"                                        | File not selected | Select a CSV or Excel file           |
| "Invalid file type"                                       | Wrong file format | Use only CSV or Excel files          |
| "No products found in file"                               | Empty file        | Add product data to file             |
| "Row X: Product name is required"                         | Missing name      | Add product name                     |
| "Row X: SKU is required"                                  | Missing SKU       | Add unique SKU                       |
| "Row X: Valid purchase price is required"                 | Invalid price     | Enter valid number                   |
| "Row X: Selling price cannot be less than purchase price" | Price mismatch    | Increase selling price               |
| "Row X: Product with SKU XXX already exists"              | Duplicate SKU     | Use different SKU or update existing |

## Best Practices

### Data Preparation

1. **Use the template**: Always start with the downloaded template
2. **Validate data**: Check all data before importing
3. **Unique SKUs**: Ensure all SKUs are unique
4. **Consistent units**: Use standard units (Box, Piece, etc.)
5. **Backup first**: Export existing products before bulk operations

### Import Strategy

1. **Test with small batch**: Import 5-10 products first
2. **Review results**: Check for errors before importing more
3. **Fix errors**: Correct issues and re-import failed rows
4. **Verify data**: Check imported products in the system

### Performance Tips

1. **Batch size**: Import 100-500 products at a time for best performance
2. **File size**: Keep files under 5MB for faster processing
3. **Network**: Use stable internet connection
4. **Browser**: Use modern browsers (Chrome, Firefox, Edge)

## Troubleshooting

### Import Fails Completely

**Problem**: Import doesn't start or fails immediately

**Solutions**:

1. Check file format (CSV or Excel only)
2. Verify file size (under 10MB)
3. Ensure you're logged in
4. Check internet connection
5. Try different browser

### Some Products Fail to Import

**Problem**: Partial import with errors

**Solutions**:

1. Review error messages carefully
2. Check row numbers mentioned in errors
3. Fix data issues in original file
4. Re-import only failed rows

### Duplicate SKU Errors

**Problem**: "Product with SKU XXX already exists"

**Solutions**:

1. Use different SKUs for new products
2. Export existing products to check SKUs
3. Use bulk update instead of import for existing products

### Price Validation Errors

**Problem**: "Selling price cannot be less than purchase price"

**Solutions**:

1. Verify purchase and selling prices
2. Ensure selling price ≥ purchase price
3. Check for decimal point errors

## Technical Details

### File Processing

- **CSV Parsing**: Uses `csv-parser` library
- **Excel Parsing**: Uses `xlsx` library
- **File Storage**: Temporary storage in `server/uploads/bulk/`
- **Cleanup**: Automatic file deletion after processing

### Database Operations

- **Transaction**: Each product import is atomic
- **Validation**: Pre-import validation prevents bad data
- **Stock Creation**: Automatic stock entry creation
- **Multi-tenant**: Shop-level data isolation

### Performance

- **Concurrent Processing**: Products processed sequentially for data integrity
- **Memory Efficient**: Streaming for large files
- **Progress Tracking**: Real-time progress updates
- **Error Collection**: All errors collected and reported

## Security Considerations

### File Upload Security

- File type whitelist (CSV, XLSX, XLS only)
- File size limit (10MB)
- Virus scanning recommended (not included)
- Temporary file storage with cleanup

### Data Security

- Authentication required for all operations
- Shop-level data isolation
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Access Control

- Only authenticated users can import
- Shop admins and staff with permissions
- Audit logging recommended (not included)

## Future Enhancements

### Planned Features

- [ ] Image upload with products
- [ ] Barcode generation
- [ ] Supplier information import
- [ ] Category auto-creation
- [ ] Duplicate handling options (skip/update/error)
- [ ] Import scheduling
- [ ] Email notifications on completion
- [ ] Import history and rollback
- [ ] Advanced validation rules
- [ ] Custom field mapping

## Support

For issues or questions:

- Check error messages carefully
- Review this guide
- Contact technical support
- Create issue in repository

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Module**: Bulk Product Import  
**System**: Health Care Surgical Mart POS
