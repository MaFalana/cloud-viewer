import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaPlus } from 'react-icons/fa';
import { FaUpload, FaCircleCheck } from 'react-icons/fa6';
import { CgSpinner } from 'react-icons/cg';
import { IoAlertCircle } from 'react-icons/io5';
import { MdCancel } from 'react-icons/md';
import { projectAPI, jobAPI } from '../../api/index.js';
import crsOptions from '../../data/epsg/Indiana.json';
import '../../styles/project-modal.css';

export function ProjectModal({ isOpen, onClose, project = null, onSave, showToast }) {
  const [formData, setFormData] = useState({
    _id: '',
    name: '',
    client: '',
    date: new Date().toISOString().split('T')[0],
    tags: [],
    description: '',
    crs: null
  });
  
  const [tagInput, setTagInput] = useState('');
  const [crsSearch, setCrsSearch] = useState('');
  const [showCrsDropdown, setShowCrsDropdown] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const crsInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const orthoFileInputRef = useRef(null);
  
  // Point cloud upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingJob, setProcessingJob] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  
  // Ortho upload state
  const [selectedOrthoFile, setSelectedOrthoFile] = useState(null);
  const [isOrthoDragging, setIsOrthoDragging] = useState(false);
  const [isOrthoUploading, setIsOrthoUploading] = useState(false);
  const [orthoUploadProgress, setOrthoUploadProgress] = useState(0);
  const [orthoUploadError, setOrthoUploadError] = useState(null);
  
  // Active jobs state
  const [activeJobs, setActiveJobs] = useState([]);
  const [completedJobId, setCompletedJobId] = useState(null);
  const pollingIntervalRef = useRef(null);

  // Initialize form data when modal opens or project changes
  useEffect(() => {
    if (isOpen) {
      if (project) {
        // Edit mode
        setFormData({
          _id: project._id,
          name: project.name || '',
          client: project.client || '',
          date: project.date ? new Date(project.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          tags: project.tags || [],
          description: project.description || '',
          crs: project.crs || null
        });
        setCrsSearch(project.crs?.name || '');
        
        // Fetch active jobs for this project
        fetchActiveJobs();
      } else {
        // Create mode
        setFormData({
          _id: '',
          name: '',
          client: '',
          date: new Date().toISOString().split('T')[0],
          tags: [],
          description: '',
          crs: null
        });
        setCrsSearch('');
      }
      setHasChanges(false);
      setErrorMessage('');
      setIsSubmitting(false);
      setSelectedFile(null);
      setUploadError(null);
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress(0);
      setSelectedOrthoFile(null);
      setOrthoUploadError(null);
      setIsOrthoUploading(false);
      setOrthoUploadProgress(0);
    } else {
      // Clean up polling when modal closes
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen, project]);

  // Fetch active jobs for the project
  const fetchActiveJobs = async () => {
    if (!project) return;
    
    try {
      const jobs = await jobAPI.getByProject(project._id);
      const active = jobs.filter(job => 
        job.status === 'pending' || 
        job.status === 'processing' || 
        job.status === 'failed'
      );
      setActiveJobs(active);
      
      // Start polling if there are active jobs
      if (active.some(job => job.status === 'pending' || job.status === 'processing')) {
        startJobPolling();
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  // Start polling active jobs
  const startJobPolling = () => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(async () => {
      if (!project) return;
      
      try {
        const jobs = await jobAPI.getByProject(project._id);
        const active = jobs.filter(job => 
          job.status === 'pending' || 
          job.status === 'processing' || 
          job.status === 'failed'
        );
        
        // Check for newly completed jobs
        const previousActiveIds = activeJobs.map(j => j.job_id);
        const currentActiveIds = active.map(j => j.job_id);
        const completedIds = previousActiveIds.filter(id => !currentActiveIds.includes(id));
        
        if (completedIds.length > 0) {
          // Show completed indicator briefly
          setCompletedJobId(completedIds[0]);
          setTimeout(() => setCompletedJobId(null), 3000);
          
          // Refresh project data
          if (onSave) {
            const updatedProject = await projectAPI.getById(project._id);
            onSave(updatedProject);
          }
        }
        
        setActiveJobs(active);
        
        // Stop polling if no active jobs
        if (active.length === 0 || !active.some(job => job.status === 'pending' || job.status === 'processing')) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('Failed to poll jobs:', error);
      }
    }, 2000);
  };

  // Handle job cancellation
  const handleCancelJob = async (jobId) => {
    try {
      await jobAPI.cancel(jobId);
      // Refresh jobs list
      await fetchActiveJobs();
    } catch (error) {
      console.error('Failed to cancel job:', error);
      setErrorMessage('Failed to cancel job. Please try again.');
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, hasChanges]);

  // Handle click outside CRS dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (crsInputRef.current && !crsInputRef.current.contains(e.target)) {
        setShowCrsDropdown(false);
      }
    };
    
    if (showCrsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCrsDropdown]);

  // Cleanup on unmount: abort uploads and stop polling
  useEffect(() => {
    return () => {
      // Cancel any in-flight uploads
      if (isUploading) {
        projectAPI.cancelUpload();
      }
      if (isOrthoUploading) {
        projectAPI.cancelOrthoUpload();
      }
      
      // Stop polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      handleInputChange('tags', [...formData.tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const handleCrsSearch = (value) => {
    setCrsSearch(value);
    setShowCrsDropdown(true);
    setHasChanges(true);
  };

  const handleSelectCrs = (crs) => {
    handleInputChange('crs', crs);
    setCrsSearch(crs.name);
    setShowCrsDropdown(false);
  };

  const filteredCrsOptions = crsOptions.filter(crs => 
    crs.name.toLowerCase().includes(crsSearch.toLowerCase()) ||
    (crs._id || crs.id).toString().includes(crsSearch)
  );

  // File upload handlers
  const validateFile = (file) => {
    const validExtensions = ['.las', '.laz'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
      setErrorMessage('Invalid file type. Only .las and .laz files are accepted.');
      return false;
    }
    
    return true;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Defer validation and state update to avoid blocking UI
    setTimeout(() => {
      if (validateFile(file)) {
        setSelectedFile(file);
        setErrorMessage('');
      }
    }, 0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    // Defer validation and state update to avoid blocking UI
    setTimeout(() => {
      if (validateFile(file)) {
        setSelectedFile(file);
        setErrorMessage('');
      }
    }, 0);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (projectId = null) => {
    const targetProjectId = projectId || project?._id;
    
    if (!selectedFile || !targetProjectId) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setErrorMessage('');
    
    let uploadCompleteHandled = false;

    try {
      // Get EPSG code from project CRS (handle both _id and id)
      const epsg = formData.crs?._id || formData.crs?.id;

      await projectAPI.uploadPointCloud(targetProjectId, selectedFile, {
        epsg,
        onUploadProgress: (percent) => {
          setUploadProgress(percent);
        },
        onJobProgress: (job) => {
          // Only handle upload completion once
          if (uploadCompleteHandled) return;
          uploadCompleteHandled = true;
          
          // Job created - upload complete!
          // Close modal and let background processing continue
          setIsUploading(false);
          setSelectedFile(null);
          setUploadProgress(0);
          
          // Show success toast
          if (showToast) {
            showToast.showSuccess('Upload complete! Processing in background...');
          }
          
          // Refresh project list to show processing indicator
          if (onSave) {
            projectAPI.getById(targetProjectId).then(onSave);
          }
          
          // Close modal - processing will continue in background
          onClose();
        },
      });
    } catch (error) {
      setUploadError(error.message);
      setIsUploading(false);
      if (showToast) {
        showToast.showError(`Upload failed: ${error.message}`);
      }
    }
  };

  const handleCancelUpload = () => {
    projectAPI.cancelUpload();
    setIsUploading(false);
    setUploadProgress(0);
    setSelectedFile(null);
    setUploadError(null);
  };

  // Ortho file upload handlers
  const validateOrthoFile = (file) => {
    const validExtensions = ['.tif', '.tiff'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
      setErrorMessage('Invalid file type. Only .tif and .tiff files are accepted.');
      return false;
    }
    
    return true;
  };

  const handleOrthoFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && validateOrthoFile(file)) {
      setSelectedOrthoFile(file);
      setErrorMessage('');
    }
  };

  const handleOrthoDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOrthoDragging(true);
  };

  const handleOrthoDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOrthoDragging(false);
  };

  const handleOrthoDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOrthoDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    // Defer validation and state update to avoid blocking UI
    setTimeout(() => {
      if (validateOrthoFile(file)) {
        setSelectedOrthoFile(file);
        setErrorMessage('');
      }
    }, 0);
  };

  const handleOrthoBrowseClick = () => {
    orthoFileInputRef.current?.click();
  };

  const handleOrthoUpload = async (projectId = null) => {
    const targetProjectId = projectId || project?._id;
    
    if (!selectedOrthoFile || !targetProjectId) {
      return;
    }

    setIsOrthoUploading(true);
    setOrthoUploadProgress(0);
    setOrthoUploadError(null);
    setErrorMessage('');
    
    let uploadCompleteHandled = false;

    try {
      await projectAPI.uploadOrtho(targetProjectId, selectedOrthoFile, {
        onUploadProgress: (percent) => {
          setOrthoUploadProgress(percent);
        },
        onJobProgress: (job) => {
          // Only handle upload completion once
          if (uploadCompleteHandled) return;
          uploadCompleteHandled = true;
          
          // Job created - upload complete!
          setIsOrthoUploading(false);
          setSelectedOrthoFile(null);
          setOrthoUploadProgress(0);
          
          // Show success toast
          if (showToast) {
            showToast.showSuccess('Ortho upload complete! Processing in background...');
          }
          
          // Refresh project list to show processing indicator
          if (onSave) {
            projectAPI.getById(targetProjectId).then(onSave);
          }
          
          // Refresh active jobs
          fetchActiveJobs();
        },
      });
    } catch (error) {
      setOrthoUploadError(error.message);
      setIsOrthoUploading(false);
      if (showToast) {
        showToast.showError(`Ortho upload failed: ${error.message}`);
      }
    }
  };

  const handleCancelOrthoUpload = () => {
    projectAPI.cancelOrthoUpload();
    setIsOrthoUploading(false);
    setOrthoUploadProgress(0);
    setSelectedOrthoFile(null);
    setOrthoUploadError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    // Validate required fields
    if (!formData._id.trim()) {
      setErrorMessage('Project ID is required');
      return;
    }

    if (!formData.crs) {
      setErrorMessage('Coordinate Reference System is required');
      return;
    }

    setIsSubmitting(true);

    try {
      if (project) {
        // Update existing project
        // Update existing project
        await projectAPI.update(formData._id, {
          name: formData.name,
          client: formData.client,
          date: formData.date,
          tags: formData.tags,
          description: formData.description,
        });
        
        // Fetch the updated project to get latest data
        const updatedProject = await projectAPI.getById(formData._id);
        
        // Call onSave callback to refresh dashboard
        if (onSave) {
          onSave(updatedProject);
        }
        
        setHasChanges(false);
        onClose();
      } else {
        // Create new project
        const newProject = await projectAPI.create({
          id: formData._id,
          name: formData.name,
          client: formData.client,
          crs: formData.crs,
          date: formData.date,
          tags: formData.tags,
          description: formData.description,
        });
        
        // Extract project ID from response
        const projectId = newProject._id || newProject.id || formData._id;
        
        // Call onSave callback to refresh dashboard
        if (onSave) {
          onSave(newProject);
        }
        
        // If a file was selected, upload it after project creation
        if (selectedFile) {
          setHasChanges(false);
          // Start upload - modal will close when upload completes
          await handleUpload(projectId);
        } else {
          setHasChanges(false);
          onClose();
        }
        
        // If ortho file was selected, upload it after project creation
        if (selectedOrthoFile) {
          await handleOrthoUpload(projectId);
        }
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      
      // Display user-friendly error messages
      if (error.message.includes('Validation error')) {
        setErrorMessage(error.message);
      } else if (error.message.includes('not found')) {
        setErrorMessage('Project not found');
      } else if (error.message.includes('Network error')) {
        setErrorMessage('Network error. Please check your connection.');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{project ? 'Edit Project' : 'Create New Project'}</h2>
          <button className="modal-close-btn" onClick={handleClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Error Message */}
            {errorMessage && (
              <div className="error-banner">
                {errorMessage}
              </div>
            )}
            {/* ID Field */}
            <div className="form-group">
              <label htmlFor="project-id">
                Project ID <span className="required">*</span>
              </label>
              <input
                id="project-id"
                type="text"
                value={formData._id}
                onChange={(e) => handleInputChange('_id', e.target.value)}
                disabled={!!project}
                className="form-input"
                placeholder="Enter project ID"
                required
              />
            </div>

            {/* Name Field */}
            <div className="form-group">
              <label htmlFor="project-name">Project Name</label>
              <input
                id="project-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="form-input"
                placeholder="Enter project name"
              />
            </div>

            {/* Client Field */}
            <div className="form-group">
              <label htmlFor="project-client">Client</label>
              <input
                id="project-client"
                type="text"
                value={formData.client}
                onChange={(e) => handleInputChange('client', e.target.value)}
                className="form-input"
                placeholder="Enter client name"
              />
            </div>

            {/* Date Field */}
            <div className="form-group">
              <label htmlFor="project-date">Date</label>
              <input
                id="project-date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="form-input"
              />
            </div>

            {/* Tags Field */}
            <div className="form-group">
              <label htmlFor="project-tags">Tags</label>
              <div className="tags-input-container">
                <input
                  id="project-tags"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="form-input"
                  placeholder="Enter a tag"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="add-tag-btn"
                  aria-label="Add tag to project"
                >
                  <FaPlus />
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="tags-list">
                  {formData.tags.map((tag) => (
                    <span key={tag} className="tag-item">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="remove-tag-btn"
                        aria-label={`Remove ${tag}`}
                      >
                        <FaTimes />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* CRS Field */}
            <div className="form-group">
              <label htmlFor="project-crs">
                Coordinate Reference System {!project && <span className="required">*</span>}
              </label>
              <div className="crs-input-container" ref={crsInputRef}>
                <input
                  id="project-crs"
                  type="text"
                  value={crsSearch}
                  onChange={(e) => handleCrsSearch(e.target.value)}
                  onFocus={() => setShowCrsDropdown(true)}
                  className="form-input"
                  placeholder="Search by name or ID"
                />
                {showCrsDropdown && filteredCrsOptions.length > 0 && (
                  <div className="crs-dropdown">
                    {filteredCrsOptions.slice(0, 10).map((crs) => (
                      <button
                        key={crs._id || crs.id}
                        type="button"
                        className="crs-option"
                        onClick={() => handleSelectCrs(crs)}
                      >
                        <div className="crs-name">{crs.name}</div>
                        <div className="crs-id">ID: {crs._id || crs.id} • {crs.unit}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {formData.crs && (
                <div className="crs-selected">
                  Selected: {formData.crs.name} (ID: {formData.crs._id || formData.crs.id})
                </div>
              )}
            </div>

            {/* Description Field */}
            <div className="form-group">
              <label htmlFor="project-description">Description</label>
              <textarea
                id="project-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="form-textarea"
                placeholder="Enter project description"
                rows={4}
              />
            </div>

            {/* Upload Area - Available in both create and edit mode */}
            <div className="form-group">
              <label>Point Cloud Upload {!project && '(Optional)'}</label>
                
                {/* Show upload progress */}
                {isUploading && (
                  <div className="upload-progress-container" role="status" aria-live="polite">
                    <div className="upload-progress-header">
                      <CgSpinner className="spinner-icon" aria-label="Uploading" />
                      <span>Uploading {selectedFile?.name}...</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="upload-progress-footer">
                      <span>{uploadProgress}%</span>
                      <button 
                        type="button" 
                        onClick={handleCancelUpload}
                        className="cancel-upload-btn"
                        aria-label="Cancel upload"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Show processing status */}
                {isProcessing && processingJob && (
                  <div className="processing-status" role="status" aria-live="polite">
                    <CgSpinner className="spinner-icon" aria-label="Processing" />
                    <div className="processing-info">
                      <p className="processing-text">Processing point cloud...</p>
                      {processingJob.progress_percent !== undefined && (
                        <p className="processing-percent">{processingJob.progress_percent}%</p>
                      )}
                      {processingJob.current_step && (
                        <p className="processing-step">{processingJob.current_step}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Show upload error with retry */}
                {uploadError && (
                  <div className="upload-error" role="alert">
                    <p>{uploadError}</p>
                    <button 
                      type="button" 
                      onClick={handleUpload}
                      className="retry-upload-btn"
                      aria-label="Retry upload"
                    >
                      Retry Upload
                    </button>
                  </div>
                )}

                {/* Show upload area when not uploading/processing */}
                {!isUploading && !isProcessing && (
                  <div 
                    className={`upload-area ${isDragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <FaUpload className="upload-icon" />
                    <p className="upload-text">
                      {selectedFile ? selectedFile.name : 'Drag and drop LAS/LAZ file here'}
                    </p>
                    <button 
                      type="button" 
                      onClick={handleBrowseClick}
                      className="upload-browse-btn"
                      aria-label={selectedFile ? 'Change selected file' : 'Browse for file'}
                    >
                      {selectedFile ? 'Change File' : 'Or click to browse'}
                    </button>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept=".las,.laz"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    {selectedFile && !uploadError && (
                      <p className="upload-file-info">
                        Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                    {/* Only show manual upload button in edit mode */}
                    {selectedFile && !uploadError && project && (
                      <button 
                        type="button" 
                        onClick={() => handleUpload()}
                        className="start-upload-btn"
                        aria-label="Start uploading point cloud file"
                      >
                        Start Upload
                      </button>
                    )}
                    {/* In create mode, show info that upload will happen after creation */}
                    {selectedFile && !uploadError && !project && (
                      <p className="upload-info-text">
                        File will be uploaded after project creation
                      </p>
                    )}
                  </div>
                )}
            </div>

            {/* Ortho Upload Area - Available in both create and edit mode */}
            <div className="form-group">
              <label>Orthophoto Upload {!project && '(Optional)'}</label>
              <p className="form-help-text">Upload GeoTIFF (.tif/.tiff) file, max 30GB. Will be converted to Cloud Optimized GeoTIFF.</p>
                
                {/* Show ortho upload progress */}
                {isOrthoUploading && (
                  <div className="upload-progress-container" role="status" aria-live="polite">
                    <div className="upload-progress-header">
                      <CgSpinner className="spinner-icon" aria-label="Uploading" />
                      <span>Uploading {selectedOrthoFile?.name}...</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${orthoUploadProgress}%` }}
                      />
                    </div>
                    <div className="upload-progress-footer">
                      <span>{orthoUploadProgress}%</span>
                      <button 
                        type="button" 
                        onClick={handleCancelOrthoUpload}
                        className="cancel-upload-btn"
                        aria-label="Cancel ortho upload"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Show ortho upload error with retry */}
                {orthoUploadError && (
                  <div className="upload-error" role="alert">
                    <p>{orthoUploadError}</p>
                    <button 
                      type="button" 
                      onClick={handleOrthoUpload}
                      className="retry-upload-btn"
                      aria-label="Retry ortho upload"
                    >
                      Retry Upload
                    </button>
                  </div>
                )}

                {/* Show ortho upload area when not uploading */}
                {!isOrthoUploading && (
                  <div 
                    className={`upload-area ${isOrthoDragging ? 'dragging' : ''}`}
                    onDragOver={handleOrthoDragOver}
                    onDragLeave={handleOrthoDragLeave}
                    onDrop={handleOrthoDrop}
                  >
                    <FaUpload className="upload-icon" />
                    <p className="upload-text">
                      {selectedOrthoFile ? selectedOrthoFile.name : 'Drag and drop GeoTIFF file here'}
                    </p>
                    <button 
                      type="button" 
                      onClick={handleOrthoBrowseClick}
                      className="upload-browse-btn"
                      aria-label={selectedOrthoFile ? 'Change selected ortho file' : 'Browse for ortho file'}
                    >
                      {selectedOrthoFile ? 'Change File' : 'Or click to browse'}
                    </button>
                    <input 
                      ref={orthoFileInputRef}
                      type="file" 
                      accept=".tif,.tiff"
                      onChange={handleOrthoFileSelect}
                      style={{ display: 'none' }}
                    />
                    {selectedOrthoFile && !orthoUploadError && (
                      <p className="upload-file-info">
                        Size: {(selectedOrthoFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                    {/* Only show manual upload button in edit mode */}
                    {selectedOrthoFile && !orthoUploadError && project && (
                      <button 
                        type="button" 
                        onClick={() => handleOrthoUpload()}
                        className="start-upload-btn"
                        aria-label="Start uploading ortho file"
                      >
                        Start Upload
                      </button>
                    )}
                    {/* In create mode, show info that upload will happen after creation */}
                    {selectedOrthoFile && !orthoUploadError && !project && (
                      <p className="upload-info-text">
                        File will be uploaded after project creation
                      </p>
                    )}
                  </div>
                )}
            </div>

            {/* Active Jobs Display - Only show in edit mode */}
            {project && activeJobs.length > 0 && (
              <div className="form-group">
                <label>Active Jobs</label>
                <div className="active-jobs-list">
                  {activeJobs.map((job) => (
                    <div key={job.job_id} className={`job-item job-${job.status}`}>
                      <div className="job-icon">
                        {job.status === 'failed' && <IoAlertCircle />}
                        {(job.status === 'pending' || job.status === 'processing') && (
                          <CgSpinner className="spinner-icon" />
                        )}
                        {completedJobId === job.job_id && <FaCircleCheck />}
                      </div>
                      
                      <div className="job-info">
                        <div className="job-type-badge">
                          {job.type === 'ortho_conversion' ? 'Ortho' : 'Point Cloud'}
                        </div>
                        <div className="job-status-text">
                          {job.status === 'failed' && 'Failed'}
                          {job.status === 'pending' && 'Pending...'}
                          {job.status === 'processing' && (
                            job.progress_percent !== undefined 
                              ? `Processing... ${job.progress_percent}%`
                              : 'Processing...'
                          )}
                          {completedJobId === job.job_id && 'Completed'}
                        </div>
                        
                        {job.current_step && (
                          <div className="job-step">{job.current_step}</div>
                        )}
                        
                        {job.error_message && (
                          <div className="job-error">{job.error_message}</div>
                        )}
                      </div>
                      
                      {(job.status === 'pending' || job.status === 'processing') && (
                        <button
                          type="button"
                          onClick={() => handleCancelJob(job.job_id)}
                          className="job-cancel-btn"
                          aria-label="Cancel job"
                        >
                          <MdCancel />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              onClick={handleClose} 
              className="btn-secondary" 
              disabled={isSubmitting || isUploading || isProcessing || isOrthoUploading}
              aria-label="Cancel and close modal"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isSubmitting || isUploading || isProcessing || isOrthoUploading}
              aria-label={isSubmitting ? 'Saving project' : (project ? 'Update project' : 'Create project')}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-small" aria-hidden="true"></span>
                  {project ? 'Updating...' : (
                    (selectedFile || selectedOrthoFile) ? 'Creating & Uploading...' : 'Creating...'
                  )}
                </>
              ) : (
                project ? 'Update Project' : (
                  (selectedFile || selectedOrthoFile) ? 'Create & Upload' : 'Create Project'
                )
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}