import { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import '../../styles/toast.css';

export function Toast({ message, type = 'info', duration = 4000, onClose }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <FaCheckCircle />,
    error: <FaExclamationCircle />,
    info: <FaInfoCircle />
  };

  return (
    <div className={`toast toast-${type}`} role="alert">
      <div className="toast-icon">{icons[type]}</div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={onClose} aria-label="Close notification">
        <IoClose />
      </button>
    </div>
  );
}