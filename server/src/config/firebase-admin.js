/**
 * Firebase Admin SDK Configuration
 * Used for server-side Firebase token verification
 * Updated for Firebase Admin SDK v14 compatibility
 */

const admin = require('firebase-admin');
const { logger } = require('./logging');

let isInitialized = false;

// Initialize Firebase Admin with service account credentials
// Check using admin.apps array (v14 compatible)
if (!admin.apps || admin.apps.length === 0) {
  try {
    // Try base64-encoded service account first (recommended for Render)
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (serviceAccountBase64) {
      try {
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(serviceAccountJson);

        admin.initializeApp({
          credential: admin.cert(serviceAccount),
        });
        isInitialized = true;
        logger.info('Firebase Admin SDK initialized successfully (base64 method)');
      } catch (parseError) {
        logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', parseError.message);
      }
    } else {
      // Fallback to individual environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn(
          'Firebase Admin SDK credentials not configured. Firebase authentication will not work. ' +
          'Set FIREBASE_SERVICE_ACCOUNT_BASE64 or (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) environment variables.'
        );
      } else {
        admin.initializeApp({
          credential: admin.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        isInitialized = true;
        logger.info('Firebase Admin SDK initialized successfully (individual vars method)');
      }
    }
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error.message);
    // Don't throw - allow server to start without Firebase
  }
}

// Export admin instance and initialization status
module.exports = admin;
module.exports.isFirebaseInitialized = () => {
  return isInitialized || (admin.apps && admin.apps.length > 0);
};
