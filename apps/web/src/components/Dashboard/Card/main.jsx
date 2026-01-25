import { useState, useEffect } from 'react';
import '../../../styles/card.css';
import '../../../styles/project-menu.css';
import { FaEllipsisVertical } from "react-icons/fa6";
import { GoArrowUpRight } from 'react-icons/go';
import { ProjectMenu } from '../ProjectMenu';
import { ProcessingIndicator } from '../ProcessingIndicator';
import { jobAPI } from '../../../api/index.js';

export function HWCCard({ basePath = '', project, isSelected, onSelect, onEditProject, onDeleteProject }) {
    const [activeJob, setActiveJob] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    
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
            className="hwc-card"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Checkbox overlay - appears on hover */}
            {(isHovered || isSelected) && (
                <div className="card-checkbox-overlay">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onSelect(project._id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${project.name}`}
                    />
                </div>
            )}
            
            <div className="card-image">
                {project.thumbnail ? (
                    <img 
                        src={`https://hwctopodot.blob.core.windows.net/hwc-potree/${project._id}/thumbnail.png`} 
                        alt={project.name}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.style.background = 'var(--hwc-light-gray)';
                        }}
                    />
                ) : (
                    <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--hwc-medium-gray)'
                    }}>
                        No preview
                    </div>
                )}
                
                {/* Processing indicator overlay on image */}
                {activeJob && (
                    <div className="card-processing-overlay">
                        <ProcessingIndicator job={activeJob} size="small" />
                    </div>
                )}
            </div>
            
            <div className="card-content">
                <div className="card-header">
                    <h3 className="card-title">{project.name}</h3>
                    <div className="card-header-actions">
                        <a 
                            href={`${basePath}/${project._id}`}
                            className="card-view-btn"
                            aria-label="Open viewer"
                            onClick={(e) => e.stopPropagation()}
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
                                className: "card-menu-btn",
                                ariaLabel: "More options",
                                icon: <FaEllipsisVertical />
                            }}
                        />
                    </div>
                </div>
                
                <p className="card-id">{project._id}</p>
                <p className="card-client">{project.client}</p>
                <p className="card-date">{formattedDate}</p>
                
                {project.tags && project.tags.length > 0 && (
                    <div className="card-tags">
                        {project.tags.map((tag, index) => (
                            <span key={index} className="card-tag">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}