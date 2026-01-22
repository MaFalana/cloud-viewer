import { CgSpinner } from 'react-icons/cg';
import { IoAlertCircle } from 'react-icons/io5';
import { FaCircleCheck } from 'react-icons/fa6';

/**
 * ProcessingIndicator Component
 * Displays the processing status of a job with appropriate icons and text
 * 
 * @param {Object} props
 * @param {Object|null} props.job - Job object with status and progress information
 * @param {string} props.size - Size variant: 'small', 'medium', or 'large' (default: 'medium')
 */
export function ProcessingIndicator({ job, size = 'medium' }) {
  // Return null if no active job
  if (!job) return null;

  const sizeClasses = {
    small: 'processing-indicator-small',
    medium: 'processing-indicator-medium',
    large: 'processing-indicator-large'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.medium;

  // Failed status
  if (job.status === 'failed') {
    return (
      <div className={`processing-indicator processing-failed ${sizeClass}`}>
        <IoAlertCircle className="processing-icon" />
        <span className="processing-text">Failed</span>
      </div>
    );
  }

  // Completed status (shown briefly)
  if (job.status === 'completed') {
    return (
      <div className={`processing-indicator processing-completed ${sizeClass}`}>
        <FaCircleCheck className="processing-icon" />
        <span className="processing-text">Completed</span>
      </div>
    );
  }

  // Processing or pending status
  if (job.status === 'processing' || job.status === 'pending') {
    return (
      <div className={`processing-indicator processing-active ${sizeClass}`}>
        <CgSpinner className="processing-icon processing-spinner" />
        <span className="processing-text">
          {job.progress_percent !== undefined && job.progress_percent !== null
            ? `${job.progress_percent}%`
            : 'Processing...'}
        </span>
      </div>
    );
  }

  // Unknown status - return null
  return null;
}