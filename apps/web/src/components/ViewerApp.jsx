import { useState, useEffect } from 'react';
import { HwcHeader } from '@hwc/header';
import { HwcMap, ImageOrthoLayer } from '@hwc/map';
import { HwcPotree, PotreeControls, PotreePanel } from '@hwc/potree';
import { projectAPI } from '../api/index.js';
import '../styles/viewer.css';

export function ViewerApp({ mapTilerKey }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('3d');
  const [viewers, setViewers] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [baseLayer, setBaseLayer] = useState('satellite');

  // Fetch project data on mount
  useEffect(() => {
    const fetchProject = async () => {
      // Extract project ID from URL
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const projectId = pathParts[pathParts.length - 1];
      
      if (!projectId) {
        setError('No project ID provided');
        setLoading(false);
        return;
      }

      try {
        const projectData = await projectAPI.getById(projectId);
        
        // API returns cloud as a string URL, not an object
        if (!projectData.cloud) {
          throw new Error('No point cloud data available for this project');
        }
        
        // Normalize the data structure - convert cloud string to object if needed
        const normalizedProject = {
          ...projectData,
          cloud: typeof projectData.cloud === 'string' 
            ? { url: projectData.cloud }
            : projectData.cloud
        };
        
        setProject(normalizedProject);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, []);

  // Loading state
  if (loading) {
    return (
      <>
        <HwcHeader title="Loading..." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - var(--header-h))', color: 'white', background: '#1a1c20' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>Loading project...</div>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <HwcHeader title="Error" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - var(--header-h))', color: 'white', background: '#1a1c20' }}>
          <div style={{ textAlign: 'center' }}>
            <h1>Error Loading Project</h1>
            <p style={{ color: '#fca5a5', marginBottom: '1rem' }}>{error}</p>
            <a href="/" style={{ color: '#ee2f27', textDecoration: 'underline' }}>Return to Dashboard</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HwcHeader title={project.name} />
      
      <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - var(--header-h))' }}>
        {/* Mode Toggle (2D/3D) */}
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === '2d' ? 'active' : ''}`}
            onClick={() => setMode('2d')}
            aria-label="2D view"
            title="2D Map View"
          >
            2D
          </button>
          <button
            className={`mode-btn ${mode === '3d' ? 'active' : ''}`}
            onClick={() => setMode('3d')}
            aria-label="3D view"
            title="3D Point Cloud View"
          >
            3D
          </button>
        </div>

        {/* Layer Toggles - visible in both 2D and 3D modes */}
        <div className="viewer-layer-toggles">
          <button
            className="viewer-layer-btn"
            onClick={() => setBaseLayer('streets')}
            aria-checked={baseLayer === 'streets'}
            aria-label="Streets view"
            title="Streets Map"
          >
            <img src="/assets/streets.png" alt="Streets" />
            <span className="active-dot" />
          </button>
          <button
            className="viewer-layer-btn"
            onClick={() => setBaseLayer('satellite')}
            aria-checked={baseLayer === 'satellite'}
            aria-label="Satellite view"
            title="Satellite Imagery"
          >
            <img src="/assets/satellite.png" alt="Satellite" />
            <span className="active-dot" />
          </button>
        </div>

        {/* 2D Mode */}
        {mode === '2d' && (
          <HwcMap
            items={[]} // No markers in viewer mode
            initialCenter={[project.location.lat, project.location.lon]}
            initialZoom={18}
            baseLayer={baseLayer}
            onBaseLayerChange={setBaseLayer}
            mapTilerKey={mapTilerKey}
            fitBoundsOnLoad={!project.ortho} // Only fit to center if no ortho (ortho will fit to its bounds)
            showControls={true}
            showAttribution={true}
          >
            {/* Add ortho overlay if available */}
            {project.ortho?.url && (
              <ImageOrthoLayer
                url={project.ortho.url}
                bounds={project.ortho.bounds || null}
                pointCloudBounds={project.cloud?.bounds}
                crs={project.crs}
                opacity={0.9}
              />
            )}
          </HwcMap>
        )}

        {/* 3D Mode */}
        {mode === '3d' && (
          <>
            <HwcPotree
              pointCloudUrl={`https://hwctopodot.blob.core.windows.net/hwc-potree/${project._id}/metadata.json`} //{project.cloud?.url}
              name={project.name}
              location={project.location}
              crs={project.crs}
              baseLayer={baseLayer}
              mapTilerKey={mapTilerKey}
              onViewerReady={setViewers}
            />

            {viewers && (
              <>
                <PotreeControls
                  potreeViewer={viewers.potreeViewer}
                  cesiumViewer={viewers.cesiumViewer}
                />
                
                <PotreePanel
                  potreeViewer={viewers.potreeViewer}
                  cesiumViewer={viewers.cesiumViewer}
                  isOpen={isPanelOpen}
                  onToggle={() => setIsPanelOpen(!isPanelOpen)}
                  position="left"
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
