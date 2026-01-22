import { FaRegMap, FaPlus } from "react-icons/fa"; 
import { IoGrid } from "react-icons/io5";
import { FaListUl } from "react-icons/fa6";
import { SearchBar, SortDropdown, ViewToggle } from '@hwc/ui';
import { ProjectFilterDropdown } from './ProjectFilterDropdown';
import './dashboard-actions.css';

export function DashboardActions({ 
  view, 
  onViewChange,
  onSearch, 
  onSort, 
  currentSort, 
  onFilter, 
  filters, 
  onCreateProject 
}) {
  const hasActiveFilters = filters?.client || (filters?.tags && filters.tags.length > 0);

  const sortOptions = [
    { label: 'Name (A-Z)', value: 'name', order: 'asc' },
    { label: 'Name (Z-A)', value: 'name', order: 'desc' },
    { label: 'Date (Newest)', value: 'date', order: 'desc' },
    { label: 'Date (Oldest)', value: 'date', order: 'asc' },
  ];

  const viewOptions = [
    { id: 'map', icon: <FaRegMap />, label: 'Map view' },
    { id: 'card', icon: <IoGrid />, label: 'Card view' },
    { id: 'list', icon: <FaListUl />, label: 'List view' },
  ];

  return (
    <>
      <button 
        className="dashboard-actions__create-btn" 
        onClick={onCreateProject} 
        aria-label="Create new project"
        type="button"
      >
        <FaPlus />
        <span>New Project</span>
      </button>

      <SortDropdown
        options={sortOptions}
        value={currentSort}
        onChange={onSort}
      />

      <SearchBar
        placeholder="Search projects..."
        onSearch={onSearch}
        showFilter={true}
        hasActiveFilters={hasActiveFilters}
        filterContent={
          <ProjectFilterDropdown 
            filters={filters}
            onFilter={onFilter}
          />
        }
      />

      <ViewToggle
        views={viewOptions}
        value={view}
        onChange={onViewChange}
        hideMobile={['map']}
      />
    </>
  );
}
