import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Source: packages/potree/1.8.2
const source = join(rootDir, 'packages/potree/1.8.2');

// Destination: apps/web/public/potree/1.8.2
const dest = join(rootDir, 'apps/web/public/potree/1.8.2');

function copyRecursive(src, dst) {
  mkdirSync(dst, { recursive: true });
  
  const entries = readdirSync(src);
  
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const dstPath = join(dst, entry);
    
    if (statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, dstPath);
    } else {
      copyFileSync(srcPath, dstPath);
    }
  }
}

console.log('Syncing Potree 1.8.2 files...');
copyRecursive(source, dest);
console.log('Synced Potree -> apps/web/public/potree/1.8.2');
