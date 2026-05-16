/**
 * File Upload Service with Google Cloud Storage Support
 * Handles file uploads for receipts, invoices, imports, and product images
 * Falls back to local storage if GCS is not configured
 * 
 * @version 2.0.0
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { logger } = require("../config/logging");
const { createError } = require("../config/error-handling");

// ============================================
// Firebase Storage Configuration (Free on Spark Plan)
// ============================================

let firebaseBucket = null;
let useGCS = false;

/**
 * Initialize Firebase Storage via firebase-admin SDK.
 * Uses the same service account as Firebase Auth — no extra billing required.
 * Free tier: 5 GB storage, 1 GB/day downloads (Firebase Spark plan).
 */
function initializeGCS() {
  try {
    const admin = require('./firebase-admin');

    // Firebase Admin must be initialized with storageBucket
    if (!admin.apps || admin.apps.length === 0) {
      logger.warn('Firebase Admin not initialized — file uploads will use local storage');
      return false;
    }

    firebaseBucket = admin.storage().bucket();

    if (!firebaseBucket) {
      logger.warn('Firebase Storage bucket not available — falling back to local storage');
      return false;
    }

    logger.info(`Firebase Storage initialized → bucket: ${firebaseBucket.name}`);
    return true;
  } catch (error) {
    logger.warn(`Firebase Storage unavailable (${error.message}) — using local storage fallback`);
    return false;
  }
}

// Initialize on module load
useGCS = initializeGCS();


// ============================================
// Local Storage Configuration (Fallback)
// ============================================

// Ensure uploads directory exists for local fallback
const uploadsDir = path.join(__dirname, "../../uploads");
const receiptsDir = path.join(uploadsDir, "receipts");
const invoicesDir = path.join(uploadsDir, "invoices");
const importsDir = path.join(uploadsDir, "imports");
const productsDir = path.join(uploadsDir, "products");

// Create directories if they don't exist
[uploadsDir, receiptsDir, invoicesDir, importsDir, productsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// Multer Configuration
// ============================================

/**
 * Configure multer storage (local temp storage)
 * Files are temporarily stored locally, then uploaded to GCS if enabled
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use temp directory for GCS uploads, or final directory for local storage
    const tempDir = path.join(uploadsDir, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `${timestamp}-${random}-${name}${ext}`;
    cb(null, filename);
  },
});

/**
 * File filter for receipts and invoices
 */
const receiptFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/pdf",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      createError.badRequest(
        "Invalid file type. Only JPEG, PNG, GIF, WebP, and PDF files are allowed."
      ),
      false
    );
  }
};

/**
 * File filter for CSV/Excel imports
 */
const importFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith(".csv")) {
    cb(null, true);
  } else {
    cb(
      createError.badRequest(
        "Invalid file type. Only CSV and Excel files are allowed."
      ),
      false
    );
  }
};

/**
 * File filter for product images
 */
const productImageFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      createError.badRequest(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
      ),
      false
    );
  }
};

// Configure multer for different upload types
const receiptUpload = multer({
  storage: storage,
  fileFilter: receiptFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files per upload
  },
});

const importUpload = multer({
  storage: storage,
  fileFilter: importFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Single file upload
  },
});

const productImageUpload = multer({
  storage: storage,
  fileFilter: productImageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Single image upload
  },
});

// ============================================
// GCS Upload Functions
// ============================================

/**
 * Upload a Buffer directly to GCS (used for generated PDFs, no temp file needed)
 * @param {Buffer} buffer - File content as Buffer
 * @param {string} gcsFolder - GCS folder (receipts, invoices, imports, products)
 * @param {string} shopId - Shop ID for organization
 * @param {string} filename - Filename including extension
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadBufferToGCS(buffer, gcsFolder, shopId, filename) {
  if (!useGCS || !firebaseBucket) {
    throw new Error("Firebase Storage is not initialized");
  }

  const gcsPath = `${gcsFolder}/${shopId}/${filename}`;
  const file = firebaseBucket.file(gcsPath);

  await file.save(buffer, {
    metadata: {
      contentType: "application/pdf",
      cacheControl: "public, max-age=31536000",
    },
  });

  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${firebaseBucket.name}/${gcsPath}`;
  logger.info(`Buffer uploaded to Firebase Storage: ${gcsPath}`);
  return publicUrl;
}

/**
 * Save a Buffer to local storage (fallback when GCS is not configured)
 * @param {Buffer} buffer - File content as Buffer
 * @param {string} folder - Local folder (receipts, invoices, imports, products)
 * @param {string} shopId - Shop ID
 * @param {string} filename - Filename including extension
 * @returns {string} Local URL path
 */
function saveBufferToLocalStorage(buffer, folder, shopId, filename) {
  const folderMap = {
    receipts: receiptsDir,
    invoices: invoicesDir,
    imports: importsDir,
    products: productsDir,
  };

  const baseDir = folderMap[folder] || invoicesDir;
  const shopDir = path.join(baseDir, shopId);

  if (!fs.existsSync(shopDir)) {
    fs.mkdirSync(shopDir, { recursive: true });
  }

  const finalPath = path.join(shopDir, filename);
  fs.writeFileSync(finalPath, buffer);

  logger.info(`Buffer saved to local storage: ${finalPath}`);
  return `/api/files/${folder}/${shopId}/${filename}`;
}

/**
 * Upload a PDF Buffer to GCS invoices/ folder, falling back to local storage.
 * This is the primary entry point for generated invoice PDFs.
 * @param {Buffer} pdfBuffer - PDF content as Buffer
 * @param {string} shopId - Shop ID
 * @param {string} saleId - Sale ID (used in filename)
 * @returns {Promise<{ url: string, storage: string }>}
 */
async function uploadInvoicePDF(pdfBuffer, shopId, saleId) {
  const timestamp = Date.now();
  const filename = `invoice-${saleId}-${timestamp}.pdf`;

  if (useGCS) {
    try {
      const url = await uploadBufferToGCS(pdfBuffer, "invoices", shopId, filename);
      return { url, storage: "gcs", filename };
    } catch (error) {
      logger.error(`GCS upload failed for invoice, falling back to local: ${error.message}`);
      // Fall through to local storage
    }
  }

  // Local storage fallback
  const url = saveBufferToLocalStorage(pdfBuffer, "invoices", shopId, filename);
  logger.warn("Invoice PDF saved to local storage (GCS not configured or failed)");
  return { url, storage: "local", filename };
}

/**
 * Upload file to Google Cloud Storage
 * @param {string} localFilePath - Path to local file
 * @param {string} gcsFolder - GCS folder (receipts, invoices, imports, products)
 * @param {string} shopId - Shop ID for organization
 * @param {string} filename - Filename
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadToGCS(localFilePath, gcsFolder, shopId, filename) {
  if (!useGCS || !firebaseBucket) {
    throw new Error("Firebase Storage is not initialized");
  }

  try {
    const gcsPath = `${gcsFolder}/${shopId}/${filename}`;

    await firebaseBucket.upload(localFilePath, {
      destination: gcsPath,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    const file = firebaseBucket.file(gcsPath);
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${firebaseBucket.name}/${gcsPath}`;
    logger.info(`File uploaded to Firebase Storage: ${gcsPath}`);
    return publicUrl;
  } catch (error) {
    logger.error(`Failed to upload file to Firebase Storage: ${error.message}`);
    throw error;
  }
}

/**
 * Delete file from Google Cloud Storage
 * @param {string} gcsFolder - GCS folder
 * @param {string} shopId - Shop ID
 * @param {string} filename - Filename
 * @returns {Promise<boolean>} Success status
 */
async function deleteFromGCS(gcsFolder, shopId, filename) {
  if (!useGCS || !firebaseBucket) {
    return false;
  }

  try {
    const gcsPath = `${gcsFolder}/${shopId}/${filename}`;
    const file = firebaseBucket.file(gcsPath);
    await file.delete();
    logger.info(`File deleted from Firebase Storage: ${gcsPath}`);
    return true;
  } catch (error) {
    if (error.code === 404) {
      logger.warn(`File not found in Firebase Storage: ${gcsFolder}/${shopId}/${filename}`);
      return false;
    }
    logger.error(`Failed to delete file from Firebase Storage: ${error.message}`);
    return false;
  }
}

// ============================================
// Local Storage Functions (Fallback)
// ============================================

/**
 * Move file to local storage directory
 * @param {string} tempFilePath - Temporary file path
 * @param {string} folder - Local folder (receipts, invoices, imports, products)
 * @param {string} shopId - Shop ID
 * @param {string} filename - Filename
 * @returns {string} Local URL
 */
function moveToLocalStorage(tempFilePath, folder, shopId, filename) {
  const folderMap = {
    receipts: receiptsDir,
    invoices: invoicesDir,
    imports: importsDir,
    products: productsDir,
  };

  const baseDir = folderMap[folder] || receiptsDir;
  const shopDir = path.join(baseDir, shopId);

  // Create shop directory if it doesn't exist
  if (!fs.existsSync(shopDir)) {
    fs.mkdirSync(shopDir, { recursive: true });
  }

  const finalPath = path.join(shopDir, filename);

  // Move file from temp to final location
  fs.renameSync(tempFilePath, finalPath);

  logger.info(`File moved to local storage: ${finalPath}`);

  // Return local URL
  return `/api/files/${folder}/${shopId}/${filename}`;
}

/**
 * Delete file from local storage
 * @param {string} folder - Local folder
 * @param {string} shopId - Shop ID
 * @param {string} filename - Filename
 * @returns {boolean} Success status
 */
function deleteFromLocalStorage(folder, shopId, filename) {
  const folderMap = {
    receipts: receiptsDir,
    invoices: invoicesDir,
    imports: importsDir,
    products: productsDir,
  };

  const baseDir = folderMap[folder] || receiptsDir;
  const filePath = path.join(baseDir, shopId, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`File deleted from local storage: ${filePath}`);
      return true;
    }

    logger.warn(`File not found in local storage: ${filePath}`);
    return false;
  } catch (error) {
    logger.error(`Failed to delete file from local storage: ${error.message}`);
    return false;
  }
}

// ============================================
// Unified Upload/Delete Functions
// ============================================

/**
 * Process uploaded files and upload to GCS or local storage
 * @param {Array} files - Array of uploaded files from multer
 * @param {string} shopId - Shop ID
 * @param {string} folder - Folder type (receipts, invoices, imports, products)
 * @returns {Promise<Array>} Array of file information objects
 */
async function processUploadedFiles(files, shopId, folder = "receipts") {
  if (!files || files.length === 0) {
    return [];
  }

  const processedFiles = [];

  for (const file of files) {
    try {
      let fileUrl;

      if (useGCS) {
        // Upload to GCS
        fileUrl = await uploadToGCS(file.path, folder, shopId, file.filename);

        // Delete temp file after successful GCS upload
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          logger.warn(`Failed to delete temp file: ${file.path}`);
        }
      } else {
        // Move to local storage
        fileUrl = moveToLocalStorage(file.path, folder, shopId, file.filename);
      }

      processedFiles.push({
        filename: file.originalname,
        url: fileUrl,
        uploadDate: new Date(),
        size: file.size,
        mimetype: file.mimetype,
        storedFilename: file.filename,
        storage: useGCS ? "gcs" : "local",
      });
    } catch (error) {
      logger.error(`Failed to process file ${file.originalname}: ${error.message}`);

      // Clean up temp file on error
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        logger.warn(`Failed to clean up temp file: ${file.path}`);
      }

      throw error;
    }
  }

  return processedFiles;
}

/**
 * Delete uploaded file from GCS or local storage
 * @param {string} shopId - Shop ID
 * @param {string} filename - Stored filename
 * @param {string} folder - Folder type (receipts, invoices, imports, products)
 * @returns {Promise<boolean>} Success status
 */
async function deleteUploadedFile(shopId, filename, folder = "receipts") {
  try {
    if (useGCS) {
      return await deleteFromGCS(folder, shopId, filename);
    } else {
      return deleteFromLocalStorage(folder, shopId, filename);
    }
  } catch (error) {
    logger.error(`Error deleting file: ${error.message}`);
    return false;
  }
}

/**
 * Get file path for serving (local storage only)
 * @param {string} shopId - Shop ID
 * @param {string} filename - Stored filename
 * @param {string} folder - Folder type
 * @returns {string|null} File path or null if not found
 */
function getFilePath(shopId, filename, folder = "receipts") {
  if (useGCS) {
    // GCS files are served via public URL, not local path
    return null;
  }

  const folderMap = {
    receipts: receiptsDir,
    invoices: invoicesDir,
    imports: importsDir,
    products: productsDir,
  };

  const baseDir = folderMap[folder] || receiptsDir;
  const filePath = path.join(baseDir, shopId, filename);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  return null;
}

/**
 * Validate file size and type before upload
 * @param {Object} file - File object
 * @param {string} type - File type (receipt, import, product)
 * @returns {Object} Validation result
 */
function validateFile(file, type = "receipt") {
  const maxSizes = {
    receipt: 10 * 1024 * 1024, // 10MB
    import: 10 * 1024 * 1024, // 10MB
    product: 5 * 1024 * 1024, // 5MB
  };

  const allowedTypes = {
    receipt: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "application/pdf",
      "image/webp",
    ],
    import: [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    product: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  };

  const maxSize = maxSizes[type] || maxSizes.receipt;
  const allowed = allowedTypes[type] || allowedTypes.receipt;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
    };
  }

  if (!allowed.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowed.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Clean up old files (maintenance function)
 * Works for both GCS and local storage
 * @param {number} daysOld - Delete files older than this many days
 * @param {string} folder - Folder to clean (optional)
 */
async function cleanupOldFiles(daysOld = 365, folder = null) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    if (useGCS && gcsBucket) {
      // Clean up GCS files
      const folders = folder ? [folder] : ["receipts", "invoices", "imports", "products"];

      for (const folderName of folders) {
        const [files] = await gcsBucket.getFiles({ prefix: `${folderName}/` });

        for (const file of files) {
          const [metadata] = await file.getMetadata();
          const fileDate = new Date(metadata.timeCreated);

          if (fileDate < cutoffDate) {
            await file.delete();
            logger.info(`Cleaned up old GCS file: ${file.name}`);
          }
        }
      }
    } else {
      // Clean up local files
      const folders = folder
        ? [{ name: folder, dir: path.join(uploadsDir, folder) }]
        : [
            { name: "receipts", dir: receiptsDir },
            { name: "invoices", dir: invoicesDir },
            { name: "imports", dir: importsDir },
            { name: "products", dir: productsDir },
          ];

      for (const { name, dir } of folders) {
        if (!fs.existsSync(dir)) continue;

        const shopDirs = fs.readdirSync(dir);

        for (const shopDir of shopDirs) {
          const shopPath = path.join(dir, shopDir);

          if (fs.statSync(shopPath).isDirectory()) {
            const files = fs.readdirSync(shopPath);

            for (const file of files) {
              const filePath = path.join(shopPath, file);
              const stats = fs.statSync(filePath);

              if (stats.mtime < cutoffDate) {
                fs.unlinkSync(filePath);
                logger.info(`Cleaned up old local file: ${filePath}`);
              }
            }
          }
        }
      }
    }

    logger.info(`File cleanup completed for files older than ${daysOld} days`);
  } catch (error) {
    logger.error(`Error during file cleanup: ${error.message}`);
  }
}

/**
 * Get storage status
 * @returns {Object} Storage configuration status
 */
function getStorageStatus() {
  return {
    useGCS,
    storage: useGCS ? 'firebase' : 'local',
    bucketName: useGCS ? firebaseBucket?.name : null,
    fallbackToLocal: !useGCS,
  };
}

module.exports = {
  // Multer middleware
  receiptUpload,
  importUpload,
  productImageUpload,

  // File processing
  processUploadedFiles,
  deleteUploadedFile,
  getFilePath,
  validateFile,
  cleanupOldFiles,
  uploadInvoicePDF,

  // Storage status
  getStorageStatus,
  useGCS,
};
