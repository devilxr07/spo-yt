/**
 * Toast Notification System
 * Provides beautiful, animated toast notifications
 */

class ToastManager {
  constructor(containerId = 'toast-container') {
    this.container = document.getElementById(containerId);
    this.toasts = [];
    this.defaultDuration = 5000; // 5 seconds
  }

  /**
   * Show a success toast
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   * @param {number} duration - Duration in ms
   */
  success(title, message = '', duration = this.defaultDuration) {
    return this.show('success', title, message, duration);
  }

  /**
   * Show an error toast
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   * @param {number} duration - Duration in ms
   */
  error(title, message = '', duration = this.defaultDuration) {
    return this.show('error', title, message, duration);
  }

  /**
   * Show a warning toast
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   * @param {number} duration - Duration in ms
   */
  warning(title, message = '', duration = this.defaultDuration) {
    return this.show('warning', title, message, duration);
  }

  /**
   * Show an info toast
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   * @param {number} duration - Duration in ms
   */
  info(title, message = '', duration = this.defaultDuration) {
    return this.show('info', title, message, duration);
  }

  /**
   * Show a toast notification
   * @param {string} type - Toast type (success, error, warning, info)
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   * @param {number} duration - Duration in ms
   * @returns {Object} Toast element reference
   */
  show(type, title, message = '', duration = this.defaultDuration) {
    const toast = this.createToast(type, title, message);
    
    // Add to container
    this.container.appendChild(toast);
    this.toasts.push({ element: toast, id: toast.dataset.toastId });

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast.dataset.toastId);
      }, duration);
    }

    return { id: toast.dataset.toastId, element: toast };
  }

  /**
   * Create toast DOM element
   * @param {string} type
   * @param {string} title
   * @param {string} message
   * @returns {HTMLElement}
   */
  createToast(type, title, message) {
    const toast = document.createElement('div');
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    toast.className = `toast ${type}`;
    toast.dataset.toastId = toastId;
    
    const icon = this.getIcon(type);
    
    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="currentColor">
        ${icon}
      </svg>
      <div class="toast-content">
        <div class="toast-title">${this.escapeHtml(title)}</div>
        ${message ? `<div class="toast-message">${this.escapeHtml(message)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close toast">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;

    // Add close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.remove(toastId);
    });

    return toast;
  }

  /**
   * Get SVG icon for toast type
   * @param {string} type
   * @returns {string}
   */
  getIcon(type) {
    const icons = {
      success: '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>',
      error: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>',
      warning: '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>',
      info: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>'
    };
    return icons[type] || icons.info;
  }

  /**
   * Remove a toast by ID
   * @param {string} toastId
   */
  remove(toastId) {
    const toastIndex = this.toasts.findIndex(t => t.id === toastId);
    if (toastIndex === -1) return;

    const toast = this.toasts[toastIndex].element;
    
    // Add removing animation
    toast.classList.add('removing');
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.toasts.splice(toastIndex, 1);
    }, 250); // Match CSS animation duration
  }

  /**
   * Remove all toasts
   */
  clearAll() {
    this.toasts.forEach(toast => {
      this.remove(toast.id);
    });
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize global toast manager
window.toastManager = new ToastManager();

// Convenience functions
window.showToast = (type, title, message, duration) => {
  return window.toastManager.show(type, title, message, duration);
};

window.showSuccessToast = (title, message, duration) => {
  return window.toastManager.success(title, message, duration);
};

window.showErrorToast = (title, message, duration) => {
  return window.toastManager.error(title, message, duration);
};

window.showWarningToast = (title, message, duration) => {
  return window.toastManager.warning(title, message, duration);
};

window.showInfoToast = (title, message, duration) => {
  return window.toastManager.info(title, message, duration);
};

/**
 * Unified toast notification function for module imports
 * @param {string} type - 'success', 'error', 'warning', 'info'
 * @param {string} title 
 * @param {string} message 
 * @param {number} duration 
 */
export function showToastNotification(type, title, message, duration) {
  return window.toastManager.show(type, title, message, duration);
}

// Export for module usage
export { ToastManager };
