import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { projectAPI } from '../../api/index.js';

export function ProjectMenu({ projectId, projectName, project, triggerButton, onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isDeleting, setIsDeleting] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 160;
      
      // Position menu to the left of the button to avoid overflow
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - menuWidth
      });
    }
  }, [isOpen]);

  const handleEdit = () => {
    if (onEdit && project) {
      onEdit(project);
    }
    setIsOpen(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${projectName}"?`)) {
      setIsOpen(false);
      return;
    }

    setIsDeleting(true);

    try {
      await projectAPI.delete(projectId);
      
      // Call onDelete callback to remove project from dashboard state
      if (onDelete) {
        onDelete(projectId);
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to delete project:', error);
      
      // Display user-friendly error messages
      let errorMessage = 'Something went wrong. Please try again.';
      
      if (error.message.includes('not found')) {
        errorMessage = 'Project not found';
      } else if (error.message.includes('Network error')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      alert(`Failed to delete project: ${errorMessage}`);
      setIsOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={triggerButton.className}
        aria-label={triggerButton.ariaLabel}
      >
        {triggerButton.icon}
      </button>

      {isOpen && createPortal(
        <>
          <div className="project-menu-backdrop" onClick={() => setIsOpen(false)} />
          <div
            className="project-menu-dropdown"
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`
            }}
          >
            <button 
              className="project-menu-option" 
              onClick={handleEdit} 
              disabled={isDeleting}
              aria-label="Edit project"
            >
              <FaEdit />
              <span>Edit</span>
            </button>
            <button 
              className="project-menu-option delete" 
              onClick={handleDelete} 
              disabled={isDeleting}
              aria-label={isDeleting ? "Deleting project" : "Delete project"}
            >
              {isDeleting ? (
                <>
                  <span className="spinner-small" aria-hidden="true"></span>
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <FaTrash />
                  <span>Delete</span>
                </>
              )}
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}