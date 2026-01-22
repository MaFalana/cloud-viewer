import { FaTimes } from 'react-icons/fa';
import { useState } from 'react';
import './project-filter-dropdown.css';

export function ProjectFilterDropdown({ filters, onFilter }) {
  const [clientInput, setClientInput] = useState(filters?.client || '');
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState(filters?.tags || []);

  const handleAddTag = () => {
    if (tagInput.trim() && !selectedTags.includes(tagInput.trim())) {
      const newTags = [...selectedTags, tagInput.trim()];
      setSelectedTags(newTags);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const newTags = selectedTags.filter(tag => tag !== tagToRemove);
    setSelectedTags(newTags);
  };

  const applyFilters = () => {
    onFilter({
      client: clientInput || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined
    });
  };

  const handleClearAll = () => {
    setClientInput('');
    setSelectedTags([]);
    onFilter({ client: undefined, tags: undefined });
  };

  const hasActiveFilters = filters?.client || (filters?.tags && filters.tags.length > 0);

  return (
    <div className="project-filter">
      <div className="project-filter__header">
        <span>Filters</span>
        {hasActiveFilters && (
          <button onClick={handleClearAll} className="project-filter__clear-btn" type="button">
            Clear All
          </button>
        )}
      </div>

      {/* Client Filter */}
      <div className="project-filter__section">
        <label htmlFor="filter-client">Client</label>
        <input
          id="filter-client"
          type="text"
          value={clientInput}
          onChange={(e) => setClientInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyFilters())}
          placeholder="Filter by client..."
          className="project-filter__input"
        />
      </div>

      {/* Tags Filter */}
      <div className="project-filter__section">
        <label htmlFor="filter-tags">Tags</label>
        <div className="project-filter__tag-input">
          <input
            id="filter-tags"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            placeholder="Add tag..."
            className="project-filter__input"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="project-filter__add-btn"
            disabled={!tagInput.trim()}
          >
            Add
          </button>
        </div>
        {selectedTags.length > 0 && (
          <div className="project-filter__tags-list">
            {selectedTags.map((tag) => (
              <span key={tag} className="project-filter__tag-item">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="project-filter__tag-remove"
                  aria-label={`Remove ${tag}`}
                >
                  <FaTimes />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Apply Button */}
      <div className="project-filter__actions">
        <button
          type="button"
          onClick={applyFilters}
          className="project-filter__apply-btn"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
