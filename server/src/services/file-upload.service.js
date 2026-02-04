/**
 * File Upload Service
 * Handles file uploads for receipts and other attachments
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { logger } = require("../config/logging");
const { createError } = require("../config/error-handling");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../uploads");
const receiptsDir = path.join(uploadsDir, "receipts");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create shop-specific directory
    const shopDir = path.join(receiptsDir, req.user.shopId);
    if (!fs.existsSync(shopDir)) {
      fs.mkdirSync(shopDir, { recursive: true });
    }
    cb(null, shopDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `${timestamp}-${random}-${name}${ext}`;
    cb(null, filename);
  },
});

// File filter for receipts
const receiptFileFilter = (req, file, cb) => {
  // Allowed file types for receipts
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
        "Invalid file type. Only JPEG, PNG, GIF, WebP, and PDF files are allowed.",
      ),
      false,
    );
  }
};

// Configure multer for receipt uploads
const receiptUpload = multer({
  storage: storage,
  fileFilter: receiptFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files per upload
  },
});

/**
 * Process uploaded files and return file information
 * @param {Array} files - Array of uploaded files from multer
 * @param {string} shopId - Shop ID for URL generation
 * @returns {Array} Array of file information objects
 */
function processUploadedFiles(files, shopId) {
  if (!files || files.length === 0) {
    return [];
  }

  return files.map((file) => ({
    filename: file.originalname,
    url: `/api/expenses/receipts/${shopId}/${file.filename}`,
    uploadDate: new Date(),
    size: file.size,
    mimetype: file.mimetype,
    storedFilename: file.filename,
  }));
}

/**
 * Delete uploaded file
 * @param {string} shopId - Shop ID
 * @param {string} filename - Stored filename
 * @returns {Promise<boolean>} Success status
 */
async function deleteUploadedFile(shopId, filename) {
  try {
    const filePath = path.join(receiptsDir, shopId, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Deleted file: ${filePath}`);
      return true;
    }

    logger.warn(`File not found for deletion: ${filePath}`);
    return false;
  } catch (error) {
    logger.error(`Error deleting file: ${error.message}`);
    return false;
  }
}

/**
 * Get file path for serving
 * @param {string} shopId - Shop ID
 * @param {string} filename - Stored filename
 * @returns {string|null} File path or null if not found
 */
function getFilePath(shopId, filename) {
  const filePath = path.join(receiptsDir, shopId, filename);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  return null;
}

/**
 * Validate file size and type before upload
 * @param {Object} file - File object
 * @returns {Object} Validation result
 */
function validateFile(file) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/pdf",
    "image/webp",
  ];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File size exceeds 10MB limit",
    };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error:
        "Invalid file type. Only JPEG, PNG, GIF, WebP, and PDF files are allowed.",
    };
  }

  return { valid: true };
}

/**
 * Clean up old files (optional maintenance function)
 * @param {number} daysOld - Delete files older than this many days
 */
async function cleanupOldFiles(daysOld = 365) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const shopDirs = fs.readdirSync(receiptsDir);

    for (const shopDir of shopDirs) {
      const shopPath = path.join(receiptsDir, shopDir);

      if (fs.statSync(shopPath).isDirectory()) {
        const files = fs.readdirSync(shopPath);

        for (const file of files) {
          const filePath = path.join(shopPath, file);
          const stats = fs.statSync(filePath);

          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            logger.info(`Cleaned up old file: ${filePath}`);
          }
        }
      }
    }
  } catch (error) {
    logger.error(`Error during file cleanup: ${error.message}`);
  }
}

module.exports = {
  receiptUpload,
  processUploadedFiles,
  deleteUploadedFile,
  getFilePath,
  validateFile,
  cleanupOldFiles,
};
