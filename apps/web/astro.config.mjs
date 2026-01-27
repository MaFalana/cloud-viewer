// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  // No base - Azure deploys from dist/cloud-viewer/ which becomes the root
  trailingSlash: 'ignore'
});