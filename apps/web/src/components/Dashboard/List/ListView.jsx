import { FaEllipsis } from "react-icons/fa6";
import { GoArrowUpRight } from 'react-icons/go';
import { useState, useEffect } from "react";
import { CgSpinner } from "react-icons/cg";
import { IoAlertCircle } from "react-icons/io5";
import '../../../styles/list.css';
import '../../../styles/project-menu.css';
import '../../../styles/project-modal.css';
import { ProjectMenu } from '../ProjectMenu';
import { ProcessingIndicator } from '../ProcessingIndicator';
import { jobAPI, projectAPI } from '../../../api/index.js';

function TableRow({ project, isSelected, onSelect, onEditProject, onDeleteProject }) {
  const [activeJob, setActiveJob] = useState(null);
  
  const formattedDate = new Date(project.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Fetch active jobs for this project
  useEffect(() => {
    let isMounted = true;
    let pollingInterval = null;

    const fetchActiveJob = async () => {
      try {
        const jobs = await jobAPI.getByProject(project._id);
        const active = jobs.find(job => 
          job.status === 'pending' || 
          job.status === 'processing' || 
          job.status === 'failed'
        );
        
        if (isMounted) {
          setActiveJob(active || null);
          
          // Start polling if there's an active job
          if (active && (active.status === 'pending' || active.status === 'processing')) {
            if (!pollingInterval) {
              pollingInterval = setInterval(fetchActiveJob, 2000);
            }
          } else {
            // Stop polling if no active job
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch jobs for project:', project._id, error);
      }
    };

    fetchActiveJob();

    return () => {
      isMounted = false;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [project._id]);

  return (
    <tr className="table-row">
      <td className="table-cell-checkbox">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onSelect(project._id)}
          aria-label={`Select ${project.name}`}
        />
      </td>
      <td className="table-cell-id">{project._id}</td>
      <td className="table-cell-name">{project.name}</td>
      <td className="table-cell-client">{project.client}</td>
      <td className="table-cell-tags">
        {project.tags && project.tags.length > 0 ? (
          <div className="table-tags">
            {project.tags.map((tag, index) => (
              <span key={index} className="table-tag">{tag}</span>
            ))}
          </div>
        ) : (
          <span className="table-empty">—</span>
        )}
      </td>
      <td className="table-cell-date">{formattedDate}</td>
      <td className="table-cell-status">
        {activeJob ? (
          <ProcessingIndicator job={activeJob} size="small" />
        ) : (
          <span className="table-empty">—</span>
        )}
      </td>
      <td className="table-cell-actions">
        <div className="table-actions-group">
          <a 
            href={`${basePath}/${project._id}`}
            className="table-view-btn"
            aria-label="Open viewer"
          >
            <GoArrowUpRight />
          </a>
          <ProjectMenu
            projectId={project._id}
            projectName={project.name}
            project={project}
            onEdit={onEditProject}
            onDelete={onDeleteProject}
            triggerButton={{
              className: "table-menu-btn",
              ariaLabel: "More options",
              icon: <FaEllipsis />
            }}
          />
        </div>
      </td>
    </tr>
  );
}

export function ListView({ basePath = '', projects, onEditProject, onDeleteProject }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(projects.map(p => p._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    
    if (!confirm(`Delete ${count} project${count > 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }
    
    setIsDeleting(true);
    setShowDeleteModal(true);
    setDeleteProgress({ current: 0, total: count, deleted: 0, failed: 0 });
    
    try {
      const idsArray = Array.from(selectedIds);
      
      const results = await projectAPI.bulkDeleteAll(idsArray, (progress) => {
        setDeleteProgress(progress);
      });
      
      // Clear selection
      setSelectedIds(new Set());
      
      // Keep modal open to show final results
      setDeleteProgress({
        ...deleteProgress,
        completed: true,
        deleted: results.deleted_count,
        failed: results.failed_count,
        failedList: results.failed
      });
      
      // Refresh the list by calling onDeleteProject for each deleted ID
      results.deleted.forEach(id => {
        if (onDeleteProject) onDeleteProject(id);
      });
      
    } catch (error) {
      console.error('Bulk delete failed:', error);
      setDeleteProgress({
        ...deleteProgress,
        completed: true,
        error: error.message
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteProgress(null);
  };

  const allSelected = projects.length > 0 && selectedIds.size === projects.length;

  return (
    <div className="list-view-container">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-selection-count">
            {selectedIds.size} project{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <button
            className="bulk-delete-btn"
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
          <button
            className="bulk-clear-btn"
            onClick={() => setSelectedIds(new Set())}
            disabled={isDeleting}
          >
            Clear Selection
          </button>
        </div>
      )}
      

      <table className="list-table">
        <thead>
          <tr>
            <th className="table-header-checkbox">
              <input 
                type="checkbox" 
                checked={allSelected}
                onChange={handleSelectAll}
                aria-label="Select all"
              />
            </th>
            <th className="table-header">ID</th>
            <th className="table-header">Name</th>
            <th className="table-header">Client</th>
            <th className="table-header">Tags</th>
            <th className="table-header">Date</th>
            <th className="table-header">Status</th>
            <th className="table-header-actions"></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <TableRow 
              key={project._id} 
              project={project}
              isSelected={selectedIds.has(project._id)}
              onSelect={handleSelect}
              onEditProject={onEditProject}
              onDeleteProject={onDeleteProject}
            />
          ))}
        </tbody>
      </table>

      {/* Delete Modal */}
      {showDeleteModal && deleteProgress && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>
                {deleteProgress.completed ? 'Deletion Complete' : 'Deleting Projects'}
              </h2>
            </div>
            
            <div className="modal-body">
              {!deleteProgress.completed ? (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <CgSpinner style={{ width: '48px', height: '48px', animation: 'spin 1s linear infinite', color: 'var(--hwc-red)', margin: '0 auto' }} />
                  <p style={{ marginTop: '1.5rem', color: 'var(--hdr-fg)', fontSize: '1rem' }}>
                    Deleting {deleteProgress.total} project{deleteProgress.total !== 1 ? 's' : ''}...
                  </p>
                </div>
              ) : deleteProgress.error ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <IoAlertCircle style={{ width: '48px', height: '48px', color: '#fca5a5' }} />
                  <p style={{ marginTop: '1rem', color: 'var(--hdr-fg)' }}>
                    {deleteProgress.error}
                  </p>
                </div>
              ) : (
                <div style={{ padding: '1rem' }}>
                  <p style={{ color: 'var(--hdr-fg)', marginBottom: '1rem' }}>
                    Successfully deleted {deleteProgress.deleted} project{deleteProgress.deleted !== 1 ? 's' : ''}.
                  </p>
                  {deleteProgress.failed > 0 && (
                    <>
                      <p style={{ color: '#fca5a5', marginBottom: '0.5rem' }}>
                        Failed to delete {deleteProgress.failed} project{deleteProgress.failed !== 1 ? 's' : ''}:
                      </p>
                      <div style={{ maxHeight: '200px', overflow: 'auto', fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
                        {deleteProgress.failedList?.map((f, i) => (
                          <div key={i} style={{ padding: '0.25rem 0' }}>
                            {f.id}: {f.error}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {deleteProgress.completed && (
              <div className="modal-footer">
                <button className="btn-primary" onClick={handleCloseDeleteModal}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}