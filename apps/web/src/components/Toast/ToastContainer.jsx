import { createPortal } from 'react-dom';
import { Toast } from './Toast';

export function ToastContainer({ toasts, removeToast }) {
  return createPortal(
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>,
    document.body
  );
}