# Frontend Ortho Upload Implementation Plan

## Summary of Changes

Based on the API documentation and backend implementation, here are the key findings and required frontend updates:

### ✅ Backend Implementation (Complete)
1. **Public URLs** - All Azure Blob Storage URLs are now public and permanent (no SAS tokens)
2. **Ortho Upload Endpoint** - `POST /projects/{project_id}/ortho` is fully implemented
3. **Job Tracking** - Background processing with job status polling
4. **COG Conversion** - Automatic conversion to Cloud Optimized GeoTIFF
5. **Thumbnail Generation** - 512px wide PNG preview

### ❌ Frontend Implementation (Missing)

The frontend currently has **NO ortho upload functionality**. Here's what needs to be added:

## Required Frontend Changes

### 1. Update ProjectAPI.js
Add new method for ortho upload:

```javascript
/**
 * Upload orthophoto file for a project
 * @param {string} projectId - Project ID
 * @param {File} file - GeoTIFF file (.tif or .tiff)
 * @param {Object} options - Upload options
 * @param {Function} options.onUploadProgress - Callback for upload progress (0-100)
 * @param {Function} options.onJobProgress - Callback for job progress updates
 * @returns {Promise<Object>} Job object
 */
async uploadOrtho(projectId, file, { onUploadProgress, onJobProgress } = {}) {
  // Implementation similar to uploadPointCloud
  // POST to /projects/{projectId}/ortho
  // Track upload progress
  // Poll job status if callback provided
}
```

### 2. Update ProjectModal.jsx
Add ortho upload section alongside point cloud upload:

**Changes needed:**
- Add second file input for ortho files (.tif, .tiff)
- Add separate upload state for ortho
- Add ortho upload handler
- Display ortho upload progress separately
- Show ortho processing status in active jobs list
- Support uploading both point cloud AND ortho in same session

**UI Structure:**
```
┌─────────────────────────────────────┐
│ Point Cloud Upload (Optional)       │
│ [Drag & drop .las/.laz]             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Orthophoto Upload (Optional)        │
│ [Drag & drop .tif/.tiff]            │
│ Max 30GB                            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Active Jobs                         │
│ • Point Cloud: Processing... 45%    │
│ • Ortho: Converting to COG... 60%   │
└─────────────────────────────────────┘
```

### 3. Update ViewerApp.jsx
The viewer already supports ortho display via `ImageOrthoLayer`:

```jsx
{project.ortho?.url && (
  <ImageOrthoLayer
    url={project.ortho.url}
    bounds={project.ortho.bounds || null}
    crs={project.crs}
    opacity={0.9}
  />
)}
```

**This is already implemented!** ✅

### 4. Job Type Handling
Update job polling to handle both job types:
- `type: 'potree_conversion'` - Point cloud processing
- `type: 'ortho_conversion'` - Ortho processing

Display appropriate icons and messages for each type.

## API Endpoints Reference

### Upload Ortho
```
POST /projects/{project_id}/ortho
Content-Type: multipart/form-data

Body:
  file: <GeoTIFF file>

Response (202 Accepted):
{
  "message": "Ortho upload accepted for processing",
  "job_id": "uuid",
  "project_id": "PROJ-001",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Job Status
```
GET /jobs/{job_id}

Response:
{
  "_id": "uuid",
  "project_id": "PROJ-001",
  "type": "ortho_conversion",  // NEW: job type field
  "status": "processing",
  "progress_message": "Converting to COG",
  "created_at": "...",
  "updated_at": "..."
}
```

### Project with Ortho
```
GET /projects/{id}

Response:
{
  "_id": "PROJ-001",
  "name": "Highway Survey",
  "cloud": "https://storage.blob.core.windows.net/.../metadata.json",
  "thumbnail": "https://storage.blob.core.windows.net/.../thumbnail.png",
  "ortho": {
    "url": "https://storage.blob.core.windows.net/.../ortho/ortho.tif",
    "thumbnail": "https://storage.blob.core.windows.net/.../ortho/ortho_thumbnail.png",
    "bounds": [[south, west], [north, east]]
  }
}
```

## Key Differences from Point Cloud Upload

| Feature | Point Cloud | Ortho |
|---------|-------------|-------|
| Endpoint | `/process/{id}/potree` | `/projects/{id}/ortho` |
| File Types | .las, .laz | .tif, .tiff |
| Max Size | 30GB | 30GB |
| Job Type | `potree_conversion` | `ortho_conversion` |
| Output | Potree format + metadata.json | COG + thumbnail |
| Processing Steps | metadata → thumbnail → conversion → upload | validate → COG → thumbnail → upload |

## Implementation Priority

1. **High Priority** - Add `uploadOrtho()` method to ProjectAPI.js
2. **High Priority** - Add ortho upload UI to ProjectModal.jsx
3. **Medium Priority** - Update job display to show job type
4. **Low Priority** - Add ortho thumbnail preview in dashboard cards

## Testing Checklist

- [ ] Upload ortho for new project (create + upload)
- [ ] Upload ortho for existing project (edit mode)
- [ ] Upload both point cloud AND ortho in same session
- [ ] Cancel ortho upload mid-progress
- [ ] View ortho processing status in modal
- [ ] View ortho in 2D viewer after processing
- [ ] Handle upload errors (invalid file, too large, etc.)
- [ ] Verify public URLs work (no SAS tokens)

## Notes

- **No SAS URL refresh needed** - All URLs are now permanent and public
- **Ortho is optional** - Projects can have point cloud only, ortho only, or both
- **Viewer already supports ortho** - ImageOrthoLayer component is ready
- **Job polling works** - Existing job polling infrastructure can handle ortho jobs
