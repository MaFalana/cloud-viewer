import { useState } from 'react';
import { HWCCard } from './main';
import { projectAPI } from '../../../api/index.js';
import { CgSpinner } from 'react-icons/cg';
import { IoAlertCircle } from 'react-icons/io5';
import '../../../styles/card.css';
import '../../../styles/project-modal.css';

export function CardGrid({ basePath = '', projects, onEditProject, onDeleteProject }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(null);

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
    setDeleteProgress({ total: count, deleted: 0, failed: 0 });
    
    try {
      const idsArray = Array.from(selectedIds);
      const results = await projectAPI.bulkDeleteAll(idsArray, (progress) => {
        setDeleteProgress(progress);
      });
      
      setSelectedIds(new Set());
      
      setDeleteProgress({
        ...deleteProgress,
        completed: true,
        deleted: results.deleted_count,
        failed: results.failed_count,
        failedList: results.failed
      });
      
      results.deleted.forEach(id => {
        if (onDeleteProject) onDeleteProject(id);
      });
      
    } catch (error) {
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
    setDeleteProgress(null);
  };

  return (
    <div className="card-grid-container">
      {selectedIds.size > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-selection-count">
            {selectedIds.size} project{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <button className="bulk-delete-btn" onClick={handleBulkDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
          <button className="bulk-clear-btn" onClick={() => setSelectedIds(new Set())} disabled={isDeleting}>
            Clear Selection
          </button>
        </div>
      )}
      
      <div className="card-grid">
        {projects.map((project) => (
          <HWCCard 
            basePath={basePath}
            key={project._id} 
            project={project} 
            isSelected={selectedIds.has(project._id)}
            onSelect={handleSelect}
            onEditProject={onEditProject} 
            onDeleteProject={onDeleteProject} 
          />
        ))}
      </div>

      {deleteProgress && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{deleteProgress.completed ? 'Deletion Complete' : 'Deleting Projects'}</h2>
            </div>
            
            <div className="modal-body">
              {!deleteProgress.completed ? (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                  <div className="spinner" style={{ width: '48px', height: '48px', margin: '0 auto' }}></div>
                  <p style={{ marginTop: '1.5rem', color: 'var(--hdr-fg)', fontSize: '1rem' }}>
                    Deleting {deleteProgress.total} project{deleteProgress.total !== 1 ? 's' : ''}...
                  </p>
                </div>
              ) : deleteProgress.error ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <IoAlertCircle style={{ width: '48px', height: '48px', color: '#fca5a5' }} />
                  <p style={{ marginTop: '1rem', color: 'var(--hdr-fg)' }}>{deleteProgress.error}</p>
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
                          <div key={i} style={{ padding: '0.25rem 0' }}>{f.id}: {f.error}</div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {deleteProgress.completed && (
              <div className="modal-footer">
                <button className="btn-primary" onClick={handleCloseDeleteModal}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}