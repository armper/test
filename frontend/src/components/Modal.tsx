import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

const Modal = ({ title, children, onClose }: ModalProps) => (
  <div className="modal-overlay" role="dialog" aria-modal="true">
    <div className="modal-content">
      <header className="modal-header">
        <h3>{title}</h3>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </div>
  </div>
);

export default Modal;
