import { useState, useEffect } from 'react';
import { FaEllipsisVertical, FaChevronDown, FaChevronUp } from 'react-icons/fa6';
import { GoArrowUpRight } from 'react-icons/go';
import '../../styles/map-list.css';
import '../../styles/project-menu.css';
import { ProjectMenu } from './ProjectMenu';
import { ProcessingIndicator } from './ProcessingIndicator';
import { jobAPI } from '../../api/index.js';

function MapListItem({ basePath = '', project, isSelected, isHighlighted, onSelect, onNavigate, onHover, onEditProject, onDeleteProject }) {
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
    <div 
      className={`map-list-item ${isHighlighted ? 'highlighted' : ''}`}
      onMouseEnter={() => onHover(project._id)}
      onMouseLeave={() => onHover(null)}
    >
      <input 
        type="checkbox" 
        checked={isSelected}
        onChange={() => onSelect(project._id)}
        className="map-list-checkbox"
        aria-label={`Select ${project.name}`}
      />
      
      <div className="map-list-content" onClick={() => onNavigate(project)}>
        <div className="map-list-header-row">
          <div className="map-list-name">{project.name}</div>
          {activeJob && (
            <div className="map-list-status">
              <ProcessingIndicator job={activeJob} size="small" />
            </div>
          )}
        </div>
        <div className="map-list-date">{formattedDate}</div>
      </div>
      
      <a 
        href={`${basePath}/${project._id}`}
        className="map-list-nav-btn" 
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
          className: "map-list-menu-btn",
          ariaLabel: "More options",
          icon: <FaEllipsisVertical />
        }}
      />
    </div>
  );
}

export function MapList({ basePath = '', projects, selectedIds, onSelect, onNavigate, highlightedId, onHover, onEditProject, onDeleteProject }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    const selectedProjects = projects.filter(p => selectedIds.has(p._id));
    
    for (const project of selectedProjects) {
      try {
        await onDeleteProject(project._id);
      } catch (error) {
        console.error(`Failed to delete project ${project._id}:`, error);
      }
    }
    
    setIsDeleting(false);
    setShowDeleteModal(false);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === projects.length) {
      // Deselect all
      projects.forEach(p => onSelect(p._id));
    } else {
      // Select all
      projects.forEach(p => {
        if (!selectedIds.has(p._id)) {
          onSelect(p._id);
        }
      });
    }
  };

  return (
    <div className={`map-list-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="map-list-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="map-list-header-content">
          <h3>Projects</h3>
          <span className="map-list-count">{projects.length}</span>
        </div>
        <button className="map-list-toggle" aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
          {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
        </button>
      </div>
      
      {!isCollapsed && (
        <>
          {selectedIds.size > 0 && (
            <div className="map-bulk-actions">
              <span className="map-bulk-count">{selectedIds.size} selected</span>
              <button 
                className="map-bulk-btn map-bulk-delete"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Selected
              </button>
              <button 
                className="map-bulk-btn map-bulk-select-all"
                onClick={handleSelectAll}
              >
                {selectedIds.size === projects.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}
          
          <div className="map-list-scroll">
            {projects.map((project) => (
              <MapListItem
                key={project._id}
                basePath={basePath}
                project={project}
                isSelected={selectedIds.has(project._id)}
                isHighlighted={highlightedId === project._id}
                onSelect={onSelect}
                onNavigate={onNavigate}
                onHover={onHover}
                onEditProject={onEditProject}
                onDeleteProject={onDeleteProject}
              />
            ))}
          </div>
        </>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete {selectedIds.size} Project{selectedIds.size > 1 ? 's' : ''}?</h2>
            <p>This will permanently delete the selected project{selectedIds.size > 1 ? 's' : ''} and all associated files.</p>
            <div className="modal-actions">
              <button 
                className="btn-secondary" 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="btn-danger" 
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}