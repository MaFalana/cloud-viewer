import BaseAPI from './BaseAPI.js';

/**
 * JobAPI - Handles job status tracking and management
 * Extends BaseAPI for job-related operations
 */
class JobAPI extends BaseAPI {
  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job object with status and progress
   */
  async getById(jobId) {
    return await this.request(`/jobs/${jobId}`);
  }

  /**
   * Get all jobs for a specific project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Array of job objects
   */
  async getByProject(projectId) {
    return await this.request(`/jobs/project/${projectId}`);
  }

  /**
   * Cancel an active job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Cancellation confirmation
   */
  async cancel(jobId) {
    return await this.request(`/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Cancel all active jobs for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Cancellation results with counts
   */
  async cancelAllForProject(projectId) {
    return await this.request(`/jobs/project/${projectId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Poll job status until completion or failure
   * @param {string} jobId - Job ID
   * @param {Object} options - Polling options
   * @param {Function} options.onProgress - Callback for progress updates
   * @param {number} options.interval - Polling interval in milliseconds (default: 2000)
   * @returns {Promise<Object>} Final job object
   */
  async pollJob(jobId, { onProgress, interval = 2000 } = {}) {
    let isPolling = true;
    
    const poll = async () => {
      try {
        const job = await this.getById(jobId);
        
        // Call progress callback if provided
        if (onProgress) {
          onProgress(job);
        }

        // Check if job is complete
        if (job.status === 'completed') {
          isPolling = false;
          return job;
        }

        // Check if job failed
        if (job.status === 'failed') {
          isPolling = false;
          throw new Error(job.error_message || 'Job failed');
        }

        // Check if job was cancelled
        if (job.status === 'cancelled') {
          isPolling = false;
          throw new Error('Job was cancelled');
        }

        // Continue polling if still pending or processing
        if (job.status === 'pending' || job.status === 'processing') {
          await new Promise(resolve => setTimeout(resolve, interval));
          return poll();
        }

        // Unknown status
        isPolling = false;
        throw new Error(`Unknown job status: ${job.status}`);
      } catch (error) {
        isPolling = false;
        throw error;
      }
    };

    // Store polling state for potential cancellation
    this._isPolling = true;
    this._stopPolling = () => {
      isPolling = false;
      this._isPolling = false;
    };

    try {
      return await poll();
    } finally {
      this._isPolling = false;
      this._stopPolling = null;
    }
  }

  /**
   * Stop current polling operation
   */
  stopPolling() {
    if (this._stopPolling) {
      this._stopPolling();
    }
  }

  /**
   * Check if currently polling
   * @returns {boolean}
   */
  isPolling() {
    return this._isPolling || false;
  }
}

export default JobAPI;