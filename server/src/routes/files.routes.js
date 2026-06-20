/**
 * File Serving Routes
 * Serves uploaded files from local storage (GCS files use public URLs)
 *
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth-multi-tenant');
const { getFilePath, useGCS } = require('../services/file-upload.service');
const { asyncHandler } = require('../config/error-handling');
const { createError } = require('../config/error-handling');
const { logger } = require('../config/logging');

/**
 * @swagger
 * /api/files/{folder}/{shopId}/{filename}:
 *   get:
 *     summary: Serve uploaded file from local storage
 *     description: Retrieve an uploaded file (receipt, invoice, import, product image) from local storage. GCS-hosted files use their public URLs directly. Requires authentication.
 *     tags: [Bulk Operations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folder
 *         required: true
 *         schema:
 *           type: string
 *           enum: [receipts, invoices, imports, products]
 *         description: File category folder
 *         example: "receipts"
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *         description: Shop ID (for path isolation)
 *         example: "shop_12345"
 *       - in: path
 *         name: filename
 *         required: true
 *         schema: { type: string }
 *         description: File name
 *         example: "receipt_20260510_001.jpg"
 *     responses:
 *       200:
 *         description: File served successfully
 *         content:
 *           image/jpeg:
 *             schema: { type: string, format: binary }
 *           image/png:
 *             schema: { type: string, format: binary }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Invalid folder or GCS redirect
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

/**
 * GET /api/files/:folder/:shopId/:filename
 * Serve files from local storage
 *
 * Folders: receipts, invoices, imports, products
 */
router.get(
  '/:folder/:shopId/:filename',
  authenticate,
  asyncHandler(async (req, res) => {
    const { folder, shopId, filename } = req.params;

    // Validate folder
    const allowedFolders = ['receipts', 'invoices', 'imports', 'products'];
    if (!allowedFolders.includes(folder)) {
      throw createError.badRequest(`Invalid folder: ${folder}`);
    }

    // Verify user has access to this shop's files
    if (req.user.role !== 'SUPER_ADMIN' && req.user.shopId !== shopId) {
      throw createError.forbidden("Access denied to this shop's files");
    }

    // If using GCS, files are served via public URLs
    if (useGCS) {
      throw createError.badRequest(
        'Files are stored in Google Cloud Storage. Use the public URL provided during upload.'
      );
    }

    // Get file path from local storage
    const filePath = getFilePath(shopId, filename, folder);

    if (!filePath) {
      throw createError.notFound('File not found');
    }

    // Serve file
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error(`Error serving file: ${err.message}`);
        if (!res.headersSent) {
          res.status(404).json({
            success: false,
            message: 'File not found',
          });
        }
      }
    });
  })
);

module.exports = router;
