import ProjectAPI from './ProjectAPI.js';
import JobAPI from './JobAPI.js';

// Get API base URL from environment variable
// In Astro, public env vars are available via import.meta.env
// Fallback to process.env for Node.js environments (testing)
const API_BASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env?.PUBLIC_API_BASE_URL) ||
  'http://localhost:8000';

// Create singleton instances
export const projectAPI = new ProjectAPI(API_BASE_URL);
export const jobAPI = new JobAPI(API_BASE_URL);

// Export classes for custom instantiation if needed
export { ProjectAPI, JobAPI };

// Export default object with all API instances
export default {
  projectAPI,
  jobAPI,
};