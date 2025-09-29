import { useToast } from '../context/ToastContext';

const Toaster = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => dismissToast(toast.id)}>×</button>
        </div>
      ))}
    </div>
  );
};

export default Toaster;
