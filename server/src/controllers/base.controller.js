/**
 * Base Controller
 * Provides common functionality for all controllers
 */

const { logger } = require('../config/logging');

class BaseController {
  /**
   * Send success response
   */
  sendSuccess(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Send error response
   */
  sendError(res, message = 'An error occurred', statusCode = 500, error = null) {
    const response = {
      success: false,
      message,
    };

    // Include error details in development
    if (process.env.NODE_ENV === 'development' && error) {
      response.error = error.message;
      response.stack = error.stack;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Handle async errors
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch((error) => {
        logger.error(`Controller error: ${error.message}`, {
          stack: error.stack,
          path: req.path,
          method: req.method,
        });
        this.sendError(res, error.message, 500, error);
      });
    };
  }

  /**
   * Validate required fields
   */
  validateRequired(data, requiredFields) {
    const missing = [];

    for (const field of requiredFields) {
      if (!data[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Build pagination object
   */
  buildPagination(page, limit, total) {
    return {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    };
  }
}

module.exports = BaseController;
