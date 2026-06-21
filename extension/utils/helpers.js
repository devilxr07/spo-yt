/**
 * Helper Utilities for Playlist Migrator Extension
 * Provides common functions used across the extension
 */

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique ID
 * @returns {string}
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Format seconds to MM:SS
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Sanitize filename for safe download
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Escape CSV field properly
 * @param {string} field
 * @returns {string}
 */
export function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Calculate ETA based on progress
 * @param {number} completed - Number of completed items
 * @param {number} total - Total number of items
 * @param {number} elapsedMs - Elapsed time in milliseconds
 * @returns {string} Formatted ETA string
 */
export function calculateETA(completed, total, elapsedMs) {
  if (completed === 0 || total === 0) {
    return '--:--';
  }
  
  const remaining = total - completed;
  const avgTimePerItem = elapsedMs / completed;
  const estimatedRemainingMs = remaining * avgTimePerItem;
  
  const minutes = Math.floor(estimatedRemainingMs / 60000);
  const seconds = Math.floor((estimatedRemainingMs % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Check if URL is a Spotify playlist
 * @param {string} url
 * @returns {boolean}
 */
export function isSpotifyPlaylist(url) {
  return /^https:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]+/.test(url);
}

/**
 * Extract playlist ID from Spotify URL
 * @param {string} url
 * @returns {string|null}
 */
export function extractSpotifyPlaylistId(url) {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Debounce function execution
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function execution
 * @param {Function} func
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Retry a promise with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Create a promise that resolves after a delay
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if element is visible
 * @param {Element} element
 * @returns {boolean}
 */
export function isElementVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/**
 * Get text content safely
 * @param {Element|null} element
 * @param {string} fallback
 * @returns {string}
 */
export function getSafeTextContent(element, fallback = '') {
  if (!element) return fallback;
  const text = element.textContent?.trim();
  return text || fallback;
}

/**
 * Parse time string to seconds
 * @param {string} timeStr - Time string like "3:45" or "3:45:12"
 * @returns {number}
 */
export function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  
  const parts = timeStr.split(':').map(p => parseInt(p, 10) || 0);
  
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
}

/**
 * Compare two strings for similarity (simple Levenshtein distance)
 * @param {string} str1
 * @param {string} str2
 * @returns {number} Similarity score 0-1
 */
export function stringSimilarity(str1, str2) {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1
 * @param {string} str2
 * @returns {number}
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Log with timestamp for debugging
 * @param {string} message
 * @param {any} data
 */
export function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data || '');
}

/**
 * Storage helper for Chrome storage
 */
export const storage = {
  /**
   * Get value from storage
   * @param {string} key
   * @returns {Promise<any>}
   */
  async get(key) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], result => {
        resolve(result[key]);
      });
    });
  },
  
  /**
   * Set value in storage
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },
  
  /**
   * Remove value from storage
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) {
    return new Promise(resolve => {
      chrome.storage.local.remove([key], resolve);
    });
  },
  
  /**
   * Clear all storage
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise(resolve => {
      chrome.storage.local.clear(resolve);
    });
  }
};

// Export all utilities
window.helpers = {
  sleep,
  generateId,
  formatDuration,
  sanitizeFilename,
  escapeCSVField,
  calculateETA,
  isSpotifyPlaylist,
  extractSpotifyPlaylistId,
  debounce,
  throttle,
  retryWithBackoff,
  delay,
  isElementVisible,
  getSafeTextContent,
  parseTimeToSeconds,
  stringSimilarity,
  debugLog,
  storage
};

// Export for module usage
export {
  sleep,
  generateId,
  formatDuration,
  sanitizeFilename,
  escapeCSVField,
  calculateETA,
  isSpotifyPlaylist,
  extractSpotifyPlaylistId,
  debounce,
  throttle,
  retryWithBackoff,
  delay,
  isElementVisible,
  getSafeTextContent,
  parseTimeToSeconds,
  stringSimilarity,
  debugLog,
  storage
};
