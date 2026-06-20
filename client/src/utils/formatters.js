/**
 * Centralized Formatting Utilities
 * 
 * Eliminates duplicate formatting code across components
 * Ensures consistent display throughout the application
 */

/**
 * Format currency in Bangladeshi Taka
 * @param {number} amount - Amount to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, options = {}) => {
  const {
    locale = 'en-BD',
    currency = 'BDT',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    useSymbol = true
  } = options;

  const numAmount = Number(amount) || 0;

  if (useSymbol) {
    // Use "Tk" prefix for better print compatibility
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits
    }).format(numAmount);
    return `Tk ${formatted}`;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numAmount);
};

/**
 * Format date in localized format
 * @param {Date|string} date - Date to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '—';

  const {
    locale = 'en-US',
    year = 'numeric',
    month = 'short',
    day = '2-digit'
  } = options;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(locale, { year, month, day });
  } catch (error) {
    console.error('Date formatting error:', error);
    return '—';
  }
};

/**
 * Format date with time in localized format
 * @param {Date|string} date - Date to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (date, options = {}) => {
  if (!date) return '—';

  const {
    locale = 'en-BD',
    year = 'numeric',
    month = 'short',
    day = '2-digit',
    hour = '2-digit',
    minute = '2-digit',
    hour12 = false
  } = options;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString(locale, { 
      year, month, day, hour, minute, hour12 
    });
  } catch (error) {
    console.error('DateTime formatting error:', error);
    return '—';
  }
};

/**
 * Format time only
 * @param {Date|string} date - Date to extract time from
 * @param {object} options - Formatting options
 * @returns {string} Formatted time string
 */
export const formatTime = (date, options = {}) => {
  if (!date) return '—';

  const {
    locale = 'en-BD',
    hour = '2-digit',
    minute = '2-digit',
    second = undefined,
    hour12 = false
  } = options;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString(locale, { hour, minute, second, hour12 });
  } catch (error) {
    console.error('Time formatting error:', error);
    return '—';
  }
};

/**
 * Format number with locale-specific separators
 * @param {number} num - Number to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted number string
 */
export const formatNumber = (num, options = {}) => {
  const {
    locale = 'en-BD',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = options;

  const numValue = Number(num) || 0;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numValue);
};

/**
 * Format percentage
 * @param {number} value - Value to format as percentage
 * @param {object} options - Formatting options
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, options = {}) => {
  const {
    locale = 'en-BD',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = options;

  const numValue = Number(value) || 0;

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numValue / 100);
};

/**
 * Format phone number (Bangladesh format)
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
export const formatPhone = (phone) => {
  if (!phone) return '—';

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format: +880 1XXX-XXXXXX or 01XXX-XXXXXX
  if (cleaned.startsWith('880')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.startsWith('01')) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }

  return phone; // Return as-is if format not recognized
};

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Calculate days until expiry
 * @param {Date|string} expiryDate - Expiry date
 * @returns {number|null} Days until expiry (null if no date)
 */
export const daysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

/**
 * Get expiry status styling
 * @param {Date|string} expiryDate - Expiry date
 * @returns {object} Styling object with row, cell, badge, and label
 */
export const getExpiryStyle = (expiryDate) => {
  const days = daysUntilExpiry(expiryDate);

  if (days === null) {
    return {
      row: '',
      cell: 'text-gray-400',
      badge: 'bg-gray-100 text-gray-500',
      label: '—'
    };
  }

  if (days < 0) {
    return {
      row: 'bg-red-100',
      cell: 'text-red-700 font-semibold',
      badge: 'bg-red-600 text-white',
      label: `Expired ${Math.abs(days)}d ago`
    };
  }

  if (days <= 30) {
    return {
      row: 'bg-orange-50',
      cell: 'text-orange-700 font-semibold',
      badge: 'bg-orange-100 text-orange-700',
      label: `${days}d left`
    };
  }

  if (days <= 60) {
    return {
      row: 'bg-yellow-50',
      cell: 'text-yellow-700',
      badge: 'bg-yellow-100 text-yellow-700',
      label: `${days}d left`
    };
  }

  return {
    row: '',
    cell: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    label: `${days}d left`
  };
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Capitalize first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} Capitalized text
 */
export const capitalizeWords = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Format invoice number with padding
 * @param {number|string} invoiceNo - Invoice number
 * @param {number} padding - Minimum digits
 * @returns {string} Formatted invoice number
 */
export const formatInvoiceNumber = (invoiceNo, padding = 6) => {
  const num = String(invoiceNo);
  return num.padStart(padding, '0');
};

// Default exports for convenience
export default {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatPercent,
  formatPhone,
  formatFileSize,
  daysUntilExpiry,
  getExpiryStyle,
  truncateText,
  capitalizeWords,
  formatInvoiceNumber
};
