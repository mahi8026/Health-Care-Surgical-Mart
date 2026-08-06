/**
 * Shared shop-user resolution for auth routes.
 *
 * Resolves the shop for a given email via three strategies:
 *   1. user_shop_index (O(1) lookup)
 *   2. shops collection ownerEmail match
 *   3. scan each shop's users collection
 *
 * IMPORTANT: The per-shop database name is NOT derived from the business
 * `shops.shopId` slug alone. In the production layout the shop database is
 * `shop_<ObjectId>` (named after the shop document's _id), and user docs
 * store that same value in `user.shopId`. In the bootstrap layout it is
 * `shop_<shopId>` (named after the business slug). Both layouts must be
 * checked, otherwise the resolver silently looks in the wrong database and
 * reports the user as "not found".
 */

const { getShopDatabase, getSystemDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const { logger } = require('../config/logging');

/**
 * The database-suffix candidates for a shop document, in preference order:
 * the document _id (production layout) then the business shopId slug.
 */
function shopDatabaseCandidates(shop) {
  const candidates = [];
  if (shop?._id) {
    candidates.push(shop._id.toString());
  }
  if (shop?.shopId && !candidates.includes(shop.shopId)) {
    candidates.push(shop.shopId);
  }
  return candidates;
}

/**
 * Find a shop document by either its business shopId or its _id string.
 */
function findShopById(systemDb, id) {
  try {
    return systemDb.collection('shops').findOne({
      $or: [{ shopId: id }, { _id: new ObjectId(id) }],
    });
  } catch {
    // Not a valid ObjectId — try the business shopId only
    return systemDb.collection('shops').findOne({ shopId: id });
  }
}

/**
 * Look for the user across every candidate database for the shop.
 * Returns the first match; the canonical shopId returned is the one stored
 * on the user document (what gets embedded in the JWT and used by
 * getShopDatabase for all subsequent API calls).
 */
async function findUserInShopCandidates(shop, email) {
  for (const candidate of shopDatabaseCandidates(shop)) {
    let shopDb;
    try {
      shopDb = getShopDatabase(candidate);
    } catch (error) {
      logger.warn('Invalid shop database candidate skipped', {
        candidate,
        error: error.message,
      });
      continue;
    }
    const user = await shopDb.collection('users').findOne({ email });
    if (user) {
      return { user, shop, shopDb, shopId: user.shopId || candidate };
    }
  }
  return null;
}

/**
 * Resolve a user's shop and load the user document.
 * @param {string} email - normalized (lowercase) email
 * @param {string|null} explicitShopId - optional explicit shop selection
 * @param {object} [opts]
 * @param {string} [opts.noShopMessage] - error message when the email maps to no shop
 * @returns {Promise<{user, shop, shopDb, shopId}>} on success (user may be null if the
 *   shop is found but the user does not exist in it)
 * @returns {Promise<{error: {statusCode, message}}>} on failure
 */
async function resolveShopUser(email, explicitShopId = null, opts = {}) {
  const systemDb = getSystemDatabase();
  const noShopMessage =
    opts.noShopMessage || 'Shop not found for this email. Please contact support.';

  let shop = null;
  let matched = null;

  if (explicitShopId) {
    shop = await findShopById(systemDb, explicitShopId);
    if (!shop) {
      return { error: { statusCode: 404, message: 'Shop not found' } };
    }
    matched = await findUserInShopCandidates(shop, email);
    if (matched) {
      return finish(matched);
    }
  } else {
    // Strategy 1: user_shop_index (O(1) lookup)
    try {
      const userShopMapping = await systemDb
        .collection('user_shop_index')
        .findOne({ email, isActive: true });

      if (userShopMapping) {
        const indexedShop = await findShopById(systemDb, userShopMapping.shopId);
        if (indexedShop) {
          matched = await findUserInShopCandidates(indexedShop, email);
          if (matched) {
            return finish(matched);
          }
        }
      }
    } catch (indexError) {
      logger.warn('Failed to query user_shop_index, falling back to shop loop', {
        email,
        error: indexError.message,
      });
    }

    // Strategies 2 & 3: ownerEmail match, then scan each shop's users
    const shops = await systemDb
      .collection('shops')
      .find({ status: 'Active' })
      .toArray();

    const ownerShop = shops.find((s) => s.ownerEmail === email);
    if (ownerShop) {
      matched = await findUserInShopCandidates(ownerShop, email);
      if (matched) {
        return finish(matched);
      }
      // Owner exists in the shops collection even without a user doc
      shop = ownerShop;
    } else {
      for (const candidateShop of shops) {
        matched = await findUserInShopCandidates(candidateShop, email);
        if (matched) {
          return finish(matched);
        }
      }
    }
  }

  function finish(result) {
    if (result.shop && result.shop.status !== 'Active') {
      return {
        error: {
          statusCode: 403,
          message: `Shop is ${result.shop.status.toLowerCase()}. Please contact support.`,
        },
      };
    }
    return result;
  }

  if (matched) {
    return finish(matched);
  }

  if (!shop) {
    return { error: { statusCode: 400, message: noShopMessage } };
  }

  if (shop.status !== 'Active') {
    return {
      error: {
        statusCode: 403,
        message: `Shop is ${shop.status.toLowerCase()}. Please contact support.`,
      },
    };
  }

  const candidates = shopDatabaseCandidates(shop);
  const shopId = candidates[0] || null;
  let shopDb = null;
  if (shopId) {
    try {
      shopDb = getShopDatabase(shopId);
    } catch {
      shopDb = null;
    }
  }

  return { user: null, shop, shopDb, shopId };
}

module.exports = { resolveShopUser };
