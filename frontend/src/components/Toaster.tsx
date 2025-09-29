import { useToast } from '../context/ToastContext';

const Toaster = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span>{toast.text}</span>
          <div className="toast-actions">
            {toast.actions?.map((action) => (
              <button key={action.label} type="button" onClick={action.onClick}>
                {action.label}
              </button>
            ))}
            <button type="button" onClick={() => dismissToast(toast.id)}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Toaster;
