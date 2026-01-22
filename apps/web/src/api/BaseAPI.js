/**
 * BaseAPI - Base class for all API interactions
 * Provides common HTTP request functionality with error handling
 */
class BaseAPI {
  /**
   * @param {string} baseURL - Base URL for API requests (from PUBLIC_API_BASE_URL)
   */
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  /**
   * Generic request method supporting GET, POST, PUT, DELETE
   * @param {string} endpoint - API endpoint (relative to baseURL)
   * @param {Object} options - Fetch options
   * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE)
   * @param {Object} options.body - Request body (will be JSON stringified)
   * @param {Object} options.headers - Additional headers
   * @returns {Promise<any>} Parsed JSON response
   * @throws {Error} User-friendly error messages based on status codes
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: options.signal, // Support AbortController signal
      ...options,
    };

    // Don't stringify body if it's FormData
    if (options.body && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    } else if (options.body instanceof FormData) {
      // Remove Content-Type header for FormData (browser sets it with boundary)
      delete config.headers['Content-Type'];
      config.body = options.body;
    }

    try {
      const response = await fetch(url, config);

      // Handle different HTTP status codes
      if (!response.ok) {
        await this.handleError(response);
      }

      // Parse JSON response
      const data = await response.json();
      return data;
    } catch (error) {
      // Handle abort errors
      if (error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      // Network errors or JSON parsing errors
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error('Network error. Please check your connection.');
      }
      // Re-throw errors from handleError
      throw error;
    }
  }

  /**
   * Handle HTTP error responses with descriptive messages
   * @param {Response} response - Fetch response object
   * @throws {Error} User-friendly error message
   */
  async handleError(response) {
    let errorMessage = '';

    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || '';
    } catch {
      // If response body is not JSON, use status text
      errorMessage = response.statusText;
    }

    switch (response.status) {
      case 400:
        throw new Error(`Validation error: ${errorMessage}`);
      case 404:
        throw new Error('Project not found');
      case 500:
        throw new Error('Something went wrong. Please try again.');
      default:
        throw new Error(`Error: ${errorMessage || 'Something went wrong'}`);
    }
  }
}

export default BaseAPI;