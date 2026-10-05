import { useEffect } from "react";

/**
 * A blocking "are you sure?" step for actions that cannot be undone, so a
 * mis-click on a destructive button never goes straight through.
 * Styling comes from Modal.css, which App.jsx already loads for every page.
 */
export default function ConfirmDialog({
  title,
  message,
  detail = "",
  confirmLabel = "Yes, continue",
  cancelLabel = "Go back",
  // A destructive action stays red; a routine one, like marking an order
  // served, can pass "btn-success" and its own icon.
  confirmClassName = "btn-danger",
  icon = "bi-exclamation-triangle-fill",
  onConfirm,
  onClose,
}) {
  // Escape is the fastest way out of a dialog opened by accident.
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show" style={{ display: "flex" }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className={`bi ${icon}`} aria-hidden="true"></i>
                {title}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <p className="confirm-dialog-copy">{message}</p>
              {detail && (
                <p className={`confirm-dialog-detail ${confirmClassName === "btn-success" ? "success" : ""}`}>{detail}</p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {cancelLabel}
              </button>
              <button type="button" className={`btn ${confirmClassName}`} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
