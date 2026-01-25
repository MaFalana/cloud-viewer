import BaseAPI from './BaseAPI.js';

/**
 * ProjectAPI - Handles all project-related API operations
 * Extends BaseAPI for CRUD operations on projects
 */
class ProjectAPI extends BaseAPI {
  /**
   * Get all projects with pagination, sorting, and filtering
   * @param {Object} params - Query parameters
   * @param {number} params.offset - Number of records to skip (default: 0)
   * @param {number} params.limit - Maximum records to return (default: 50)
   * @param {string} params.sortBy - Field to sort by (name, client, created_at, updated_at)
   * @param {string} params.sortOrder - Sort order (asc, desc)
   * @param {string} params.name - Filter by project name
   * @param {string} params.client - Filter by client name
   * @param {string} params.tags - Filter by tags (comma-separated)
   * @returns {Promise<Array>} Array of project objects
   */
  async getAll({ offset = 0, limit = 50, sortBy, sortOrder, name, client, tags } = {}) {
    const params = new URLSearchParams();
    
    // Note: API uses 'skip' parameter, not 'offset'
    params.append('skip', offset.toString());
    params.append('limit', limit.toString());
    
    if (sortBy) params.append('sort_by', sortBy);
    if (sortOrder) params.append('sort_order', sortOrder);
    if (name) params.append('name', name);
    if (client) params.append('client', client);
    if (tags) params.append('tags', tags);

    const response = await this.request(`/projects/?${params.toString()}`);
    
    // Handle both response formats: array directly or wrapped in Projects property
    return Array.isArray(response) ? { Projects: response } : response;
  }

  /**
   * Get a single project by ID
   * @param {string} id - Project ID
   * @returns {Promise<Object>} Project object
   */
  async getById(id) {
    return await this.request(`/projects/${id}`);
  }

  /**
   * Create a new project
   * @param {Object} data - Project data
   * @param {string} data.id - Unique project identifier (required)
   * @param {string} data.name - Project name
   * @param {string} data.client - Client name
   * @param {Object} data.crs - Coordinate reference system (required)
   * @param {string} data.crs._id - EPSG code (e.g., "EPSG:26916")
   * @param {string} data.crs.name - CRS name
   * @param {string} data.crs.proj4 - Proj4 string
   * @param {string} data.date - Project date (ISO format)
   * @param {Array<string>} data.tags - Project tags
   * @param {string} data.description - Project description
   * @returns {Promise<Object>} Created project object
   */
  async create({ id, name, client, crs, date, tags, description }) {
    const formData = new FormData();
    
    // Required fields
    formData.append('id', id);
    if (crs) {
      // Handle both _id and id field names
      const crsId = crs._id || crs.id;
      formData.append('crs_id', crsId.toString());
      formData.append('crs_name', crs.name);
      if (crs.proj4) {
        formData.append('crs_proj4', crs.proj4);
      }
    }
    
    // Optional fields
    if (name) formData.append('name', name);
    if (client) formData.append('client', client);
    if (date) formData.append('date', date);
    if (tags && tags.length > 0) {
      tags.forEach(tag => formData.append('tags', tag));
    }
    if (description) formData.append('description', description);

    return await this.request('/projects/upload', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Update project metadata
   * @param {string} id - Project ID
   * @param {Object} updates - Fields to update
   * @param {string} updates.name - Project name
   * @param {string} updates.client - Client name
   * @param {string} updates.date - Project date
   * @param {Array<string>} updates.tags - Project tags
   * @param {string} updates.description - Project description
   * @returns {Promise<Object>} Updated project object
   */
  async update(id, { name, client, date, tags, description }) {
    const formData = new FormData();
    
    // Only append fields that are defined
    if (name !== undefined) formData.append('name', name);
    if (client !== undefined) formData.append('client', client);
    if (date !== undefined) formData.append('date', date);
    if (description !== undefined) formData.append('description', description);
    
    // Tags can be sent as comma-separated string or JSON array
    if (tags !== undefined && tags.length > 0) {
      formData.append('tags', tags.join(','));
    }

    return await this.request(`/projects/${id}/update`, {
      method: 'PUT',
      body: formData,
    });
  }

  /**
   * Delete a project and all associated files
   * @param {string} id - Project ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async delete(id) {
    return await this.request(`/projects/${id}/delete`, {
      method: 'DELETE',
    });
  }

  /**
   * Delete multiple projects in batch (max 100 per request)
   * @param {Array<string>} ids - Array of project IDs to delete
   * @param {Object} options - Deletion options
   * @param {boolean} options.cancelJobs - Cancel active jobs before deletion (default: true)
   * @returns {Promise<Object>} Batch deletion results
   */
  async bulkDelete(ids, { cancelJobs = true } = {}) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Project IDs array is required');
    }
    
    if (ids.length > 100) {
      throw new Error('Maximum 100 projects per batch. Use bulkDeleteAll for larger batches.');
    }

    // Optionally cancel jobs first
    if (cancelJobs) {
      const { jobAPI } = await import('./index.js');
      await Promise.allSettled(
        ids.map(id => jobAPI.cancelAllForProject(id).catch(() => {}))
      );
    }

    return await this.request('/projects/delete', {
      method: 'DELETE',
      body: ids,
    });
  }

  /**
   * Delete large number of projects in chunks of 100
   * @param {Array<string>} ids - Array of project IDs to delete
   * @param {Function} onProgress - Callback for progress updates
   * @returns {Promise<Object>} Combined deletion results
   */
  async bulkDeleteAll(ids, onProgress) {
    const CHUNK_SIZE = 100;
    const chunks = [];
    
    // Split into chunks of 100
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }
    
    const results = {
      deleted: [],
      failed: [],
      deleted_count: 0,
      failed_count: 0,
      total: ids.length
    };
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const chunkResult = await this.bulkDelete(chunk);
        
        results.deleted.push(...chunkResult.deleted);
        results.failed.push(...chunkResult.failed);
        results.deleted_count += chunkResult.deleted_count;
        results.failed_count += chunkResult.failed_count;
        
        // Report progress
        if (onProgress) {
          onProgress({
            current: (i + 1) * CHUNK_SIZE,
            total: ids.length,
            percent: Math.round(((i + 1) / chunks.length) * 100),
            deleted: results.deleted_count,
            failed: results.failed_count
          });
        }
      } catch (error) {
        // If a chunk fails entirely, mark all as failed
        chunk.forEach(id => {
          results.failed.push({ id, error: error.message });
          results.failed_count++;
        });
      }
    }
    
    return results;
  }

  /**
   * Upload point cloud file and start processing
   * @param {string} id - Project ID
   * @param {File} file - LAS/LAZ file
   * @param {Object} options - Upload options
   * @param {string} options.epsg - EPSG code for coordinate system
   * @param {Function} options.onUploadProgress - Callback for upload progress (0-100)
   * @param {Function} options.onJobProgress - Callback for job progress updates
   * @returns {Promise<Object>} Job object
   */
  async uploadPointCloud(id, file, { epsg, onUploadProgress, onJobProgress } = {}) {
    const formData = new FormData();
    formData.append('file', file);
    if (epsg) {
      // Remove "EPSG:" prefix if present, API expects just the number
      const epsgCode = epsg.toString().replace(/^EPSG:/i, '');
      formData.append('epsg', epsgCode);
    }

    // Use XMLHttpRequest for upload progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onUploadProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onUploadProgress(percent);
        }
      });

      // Handle completion
      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          try {
            const job = JSON.parse(xhr.responseText);
            
            // If job progress callback provided, start polling
            if (onJobProgress && job.job_id) {
              // Import JobAPI dynamically to avoid circular dependency
              const { jobAPI } = await import('./index.js');
              try {
                await jobAPI.pollJob(job.job_id, {
                  onProgress: onJobProgress,
                  interval: 2000,
                });
              } catch (pollError) {
                // Job polling failed, but upload succeeded
                console.error('Job polling failed:', pollError);
              }
            }
            
            resolve(job);
          } catch (error) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          // Handle error response
          try {
            const errorData = JSON.parse(xhr.responseText);
            const errorMessage = errorData.detail || errorData.message || 'Upload failed';
            
            if (xhr.status === 400) {
              reject(new Error(`Validation error: ${errorMessage}`));
            } else if (xhr.status === 404) {
              reject(new Error('Project not found'));
            } else if (xhr.status === 500) {
              reject(new Error('Something went wrong. Please try again.'));
            } else {
              reject(new Error(`Upload failed: ${errorMessage}`));
            }
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      });

      // Handle network errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error. Please check your connection.'));
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      xhr.open('POST', `${this.baseURL}/process/${id}/potree`);
      xhr.send(formData);

      // Store xhr for potential cancellation
      this._currentUpload = xhr;
    });
  }

  /**
   * Cancel current upload
   */
  cancelUpload() {
    if (this._currentUpload) {
      this._currentUpload.abort();
      this._currentUpload = null;
    }
  }

  /**
   * Upload orthophoto file for a project
   * @param {string} projectId - Project ID
   * @param {File} file - GeoTIFF file (.tif or .tiff)
   * @param {Object} options - Upload options
   * @param {Function} options.onUploadProgress - Callback for upload progress (0-100)
   * @param {Function} options.onJobProgress - Callback for job progress updates
   * @returns {Promise<Object>} Job object
   */
  async uploadOrtho(projectId, file, { onUploadProgress, onJobProgress } = {}) {
    const formData = new FormData();
    formData.append('file', file);

    // Use XMLHttpRequest for upload progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onUploadProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onUploadProgress(percent);
        }
      });

      // Handle completion
      xhr.addEventListener('load', async () => {
        if (xhr.status === 202) {
          try {
            const job = JSON.parse(xhr.responseText);
            
            // If job progress callback provided, start polling
            if (onJobProgress && job.job_id) {
              // Import JobAPI dynamically to avoid circular dependency
              const { jobAPI } = await import('./index.js');
              try {
                await jobAPI.pollJob(job.job_id, {
                  onProgress: onJobProgress,
                  interval: 2000,
                });
              } catch (pollError) {
                // Job polling failed, but upload succeeded
                console.error('Job polling failed:', pollError);
              }
            }
            
            resolve(job);
          } catch (error) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          // Handle error response
          try {
            const errorData = JSON.parse(xhr.responseText);
            const errorMessage = errorData.detail || errorData.message || 'Upload failed';
            
            if (xhr.status === 400) {
              reject(new Error(`Validation error: ${errorMessage}`));
            } else if (xhr.status === 404) {
              reject(new Error('Project not found'));
            } else if (xhr.status === 413) {
              reject(new Error('File too large (max 30GB)'));
            } else if (xhr.status === 500) {
              reject(new Error('Something went wrong. Please try again.'));
            } else {
              reject(new Error(`Upload failed: ${errorMessage}`));
            }
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      });

      // Handle network errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error. Please check your connection.'));
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      xhr.open('POST', `${this.baseURL}/projects/${projectId}/ortho`);
      xhr.send(formData);

      // Store xhr for potential cancellation
      this._currentOrthoUpload = xhr;
    });
  }

  /**
   * Cancel current ortho upload
   */
  cancelOrthoUpload() {
    if (this._currentOrthoUpload) {
      this._currentOrthoUpload.abort();
      this._currentOrthoUpload = null;
    }
  }
}

export default ProjectAPI;