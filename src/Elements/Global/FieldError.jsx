/** The message under a form field that cannot be saved yet (styles in formErrors.css). */
export default function FieldError({ id, message }) {
  if (!message) return null;

  return (
    <div id={id} className="form-field-error" role="alert">
      <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
      <span>{message}</span>
    </div>
  );
}
