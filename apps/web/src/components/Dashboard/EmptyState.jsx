import { FaPlus, FaSearch } from 'react-icons/fa';
import '../../styles/empty-state.css';

export function EmptyState({ type = 'no-projects', onCreateProject }) {
  if (type === 'no-projects') {
    return (
      <div className="empty-state-container" role="status">
        <div className="empty-state-icon">
          <FaPlus />
        </div>
        <h2 className="empty-state-title">No Projects Yet</h2>
        <button 
          className="empty-state-cta" 
          onClick={onCreateProject}
          aria-label="Create new project"
        >
          <FaPlus />
          <span>New Project</span>
        </button>
      </div>
    );
  }

  if (type === 'no-search-results') {
    return (
      <div className="empty-state-container" role="status">
        <div className="empty-state-icon">
          <FaSearch />
        </div>
        <h2 className="empty-state-title">No Results Found</h2>
      </div>
    );
  }

  return null;
}