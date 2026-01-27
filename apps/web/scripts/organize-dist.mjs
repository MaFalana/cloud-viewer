import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, mkdir, rename, rm } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = join(__dirname, '..', 'dist');
const cloudViewerPath = join(distPath, 'cloud-viewer');

async function organizeDist() {
  try {
    console.log('Organizing dist folder for Azure Static Web Apps...');
    
    // Create cloud-viewer directory
    await mkdir(cloudViewerPath, { recursive: true });
    
    // Get all items in dist
    const items = await readdir(distPath, { withFileTypes: true });
    
    // Move everything except cloud-viewer into cloud-viewer/
    for (const item of items) {
      if (item.name !== 'cloud-viewer') {
        const sourcePath = join(distPath, item.name);
        const targetPath = join(cloudViewerPath, item.name);
        await rename(sourcePath, targetPath);
        console.log(`Moved ${item.name} to cloud-viewer/`);
      }
    }
    
    console.log('✓ Dist folder organized successfully');
  } catch (error) {
    console.error('Error organizing dist folder:', error);
    process.exit(1);
  }
}

organizeDist();
