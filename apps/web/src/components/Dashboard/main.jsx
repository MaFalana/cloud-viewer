import { CardGrid } from "./Card/CardGrid";
import { ListView } from "./List/ListView";
import { HwcHeader } from "@hwc/header";
import { HwcMap } from "@hwc/map";
import { DashboardActions } from "./DashboardActions";
import { ProjectModal } from "./ProjectModal";
import { EmptyState } from "./EmptyState";
import { MapList } from "./MapList";
import { ToastContainer } from "../Toast/ToastContainer";
import { useToast } from "../Toast/useToast";
import { useState, useEffect, useRef } from "react";
import { projectAPI } from "../../api/index.js";

export function Dashboard({ basePath = '' }) {
    const [view, setView] = useState('map');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({ client: undefined, tags: undefined });
    const [currentSort, setCurrentSort] = useState({ sortBy: 'created_at', sortOrder: 'desc' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    
    // Map-specific state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [highlightedId, setHighlightedId] = useState(null);
    const [targetProject, setTargetProject] = useState(null);
    const [baseLayer, setBaseLayer] = useState('satellite');
    
    const { toasts, removeToast, showSuccess, showError, showInfo } = useToast();
    
    const LIMIT = 50;
    const searchTimeoutRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Auto-switch from map view on mobile
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768 && view === 'map') {
                setView('card');
            }
        };

        // Check on mount
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [view]);

    // Fetch projects on mount and when sort/search/filter changes
    useEffect(() => {
        fetchProjects(true);
        
        // Cleanup: abort pending requests on unmount or when dependencies change
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [currentSort.sortBy, currentSort.sortOrder, searchQuery, filters.client, filters.tags]);

    const fetchProjects = async (reset = false) => {
        if (loading && !reset) return;
        
        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();
        
        setLoading(true);
        if (reset) {
            setError(null);
        }

        try {
            const currentOffset = reset ? 0 : offset;
            const data = await projectAPI.getAll({
                offset: currentOffset,
                limit: LIMIT,
                sortBy: currentSort.sortBy,
                sortOrder: currentSort.sortOrder,
                name: searchQuery || undefined,
                client: filters.client,
                tags: filters.tags,
            });

            const newProjects = data.Projects || [];
            
            if (reset) {
                setProjects(newProjects);
                setOffset(newProjects.length);
            } else {
                setProjects(prev => [...prev, ...newProjects]);
                setOffset(prev => prev + newProjects.length);
            }
            
            setHasMore(newProjects.length === LIMIT);
            setError(null);
        } catch (err) {
            // Don't show error for cancelled requests
            if (err.message === 'Request cancelled') {
                return;
            }
            
            console.error('Failed to fetch projects:', err);
            if (err.message.includes('Network error')) {
                setError('Network error. Please check your connection.');
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleSearch = (query, immediate = false) => {
        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (immediate) {
            // Immediate search (e.g., on Enter key)
            setSearchQuery(query);
            setOffset(0);
        } else {
            // Debounced search (on typing)
            searchTimeoutRef.current = setTimeout(() => {
                setSearchQuery(query);
                setOffset(0);
            }, 300);
        }
    };

    const handleSort = (sortBy, sortOrder) => {
        setCurrentSort({ sortBy, sortOrder });
        setOffset(0);
    };

    const handleFilter = (newFilters) => {
        setFilters(newFilters);
        setOffset(0);
    };

    const handleCreateProject = () => {
        setEditingProject(null);
        setIsModalOpen(true);
    };

    const handleEditProject = (project) => {
        setEditingProject(project);
        setIsModalOpen(true);
    };

    const handleSaveProject = (projectData) => {
        // Refresh the project list after save
        fetchProjects(true);
    };

    const handleDeleteProject = (projectId) => {
        // Remove project from state immediately for better UX
        setProjects(prev => prev.filter(p => p._id !== projectId));
    };

    // Map-specific handlers
    const handleMarkerClick = (id, project) => {
        // Navigate directly to viewer instead of selecting
        window.location.href = `${basePath}/${id}`;
    };

    const handleSelect = (id) => {
        // Selection for MapList checkboxes only (bulk actions)
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleHover = (id) => {
        setHighlightedId(id);
    };

    const handleNavigate = (project) => {
        setTargetProject(project);
    };

    // Infinite scroll - detect when user scrolls near bottom
    useEffect(() => {
        const handleScroll = (e) => {
            const target = e.target;
            
            // Check if the scrollable element is near the bottom
            const scrollTop = target.scrollTop;
            const scrollHeight = target.scrollHeight;
            const clientHeight = target.clientHeight;
            
            const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
            
            if (isNearBottom && hasMore && !loading) {
                fetchProjects(false);
            }
        };

        // Throttle scroll events to 100ms
        let throttleTimeout = null;
        const throttledScroll = (e) => {
            if (throttleTimeout) return;
            
            throttleTimeout = setTimeout(() => {
                handleScroll(e);
                throttleTimeout = null;
            }, 100);
        };

        // Find all scrollable containers (card-grid-container, list-view-container, map-list-scroll)
        const scrollContainers = document.querySelectorAll('.card-grid-container, .list-view-container, .map-list-scroll');
        
        scrollContainers.forEach(container => {
            container.addEventListener('scroll', throttledScroll);
        });
        
        return () => {
            scrollContainers.forEach(container => {
                container.removeEventListener('scroll', throttledScroll);
            });
            if (throttleTimeout) clearTimeout(throttleTimeout);
        };
    }, [hasMore, loading, offset]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            <HwcHeader 
                title="Cloud Viewer"
                basePath={basePath}
                actions={
                    <DashboardActions
                        view={view}
                        onViewChange={setView}
                        onSearch={handleSearch}
                        onSort={handleSort}
                        currentSort={currentSort}
                        onFilter={handleFilter}
                        filters={filters}
                        onCreateProject={handleCreateProject}
                    />
                }
            />

            <div className="hwc-dashboard">
                {loading && projects.length === 0 && (
                    <div className="loading-spinner" role="status" aria-live="polite">
                        <div className="spinner" aria-label="Loading"></div>
                        <p>Loading projects...</p>
                    </div>
                )}

                {error && (
                    <div className="error-message" role="alert">
                        <p>{error}</p>
                        <button onClick={() => fetchProjects(true)} aria-label="Retry loading projects">Retry</button>
                    </div>
                )}

                {!loading && !error && projects.length === 0 && (
                    <EmptyState 
                        type={searchQuery ? 'no-search-results' : 'no-projects'}
                        onCreateProject={handleCreateProject}
                    />
                )}

                {projects.length > 0 && (
                    <>
                        {view === 'map' && (
                            <div className="map-wrapper">
                                <HwcMap 
                                    items={projects}
                                    highlightedId={highlightedId}
                                    targetItem={targetProject}
                                    onSelect={handleMarkerClick}
                                    onHover={handleHover}
                                    baseLayer={baseLayer}
                                    onBaseLayerChange={setBaseLayer}
                                    showControls={true}
                                    showAttribution={true}
                                    cluster={true}
                                    basePath={basePath}
                                />
                                <MapList
                                    basePath={basePath}
                                    projects={projects.filter(p => p.location?.lat && p.location?.lon)}
                                    selectedIds={selectedIds}
                                    highlightedId={highlightedId}
                                    onSelect={handleSelect}
                                    onHover={handleHover}
                                    onNavigate={handleNavigate}
                                    onEditProject={handleEditProject}
                                    onDeleteProject={handleDeleteProject}
                                />
                            </div>
                        )}
                        {view === 'card' && <CardGrid basePath={basePath} projects={projects} onEditProject={handleEditProject} onDeleteProject={handleDeleteProject} />}
                        {view === 'list' && <ListView basePath={basePath} projects={projects} onEditProject={handleEditProject} onDeleteProject={handleDeleteProject} />}
                        
                        {loading && projects.length > 0 && (
                            <div className="loading-more" role="status" aria-live="polite">
                                <div className="spinner-small" aria-label="Loading more"></div>
                                <span>Loading more projects...</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <ProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                project={editingProject}
                onSave={handleSaveProject}
                showToast={{ showSuccess, showError, showInfo }}
            />
            
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
}