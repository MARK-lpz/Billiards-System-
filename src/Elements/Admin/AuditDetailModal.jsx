const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return String(value);
};

const buildContextFields = (log) => {
  if (log.type === "reservation") {
    return [
      { label: "Customer", value: log.customer?.current?.name || log.customer?.previous?.name },
      { label: "Table", value: log.reservation?.tableName || log.table?.name },
      {
        label: "Schedule",
        value:
          log.reservation?.date && log.reservation?.time
            ? `${log.reservation.date} ${log.reservation.time}`
            : null,
      },
      { label: "Status", value: log.reservation?.currentStatus || log.table?.currentStatus },
    ];
  }

  if (log.type === "issue") {
    return [
      { label: "Issue Type", value: log.issue?.type || log.issueType },
      { label: "Table", value: log.issue?.table || log.issueTable },
      { label: "Severity", value: log.issue?.severity || log.severity },
    ];
  }

  if (log.type === "sale") {
    return [
      {
        label: "Total",
        value: log.payment?.total ? `â‚±${Number(log.payment.total).toFixed(2)}` : null,
      },
      { label: "Method", value: log.payment?.method },
      { label: "Cashier", value: log.staff },
    ];
  }

  if (log.type === "table") {
    return [
      { label: "Table", value: log.table?.name },
      { label: "Status", value: log.table?.currentStatus },
    ];
  }

  return [];
};

const DetailFields = ({ fields }) => {
  const visible = fields.filter((field) => field.value !== null && field.value !== undefined && field.value !== "");
  if (!visible.length) return null;

  return (
    <div className="audit-detail-fields">
      {visible.map((field) => (
        <div key={field.label} className="audit-detail-field">
          <span className="audit-detail-field-name">{field.label}</span>
          <strong className="audit-detail-field-value">{formatValue(field.value)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function AuditDetailModal({ log, onClose }) {
  if (!log) return null;

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show" style={{ display: "flex" }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(event) => event.stopPropagation()}>
          <div className="modal-content audit-detail-modal">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">Audit Entry Details</h5>
                <p className="audit-detail-subtitle">Review the tracked change and related context.</p>
              </div>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>

            <div className="modal-body audit-detail-body">
              <div className="audit-detail-fields audit-detail-fields--summary">
                <div className="audit-detail-field">
                  <span className="audit-detail-field-name">Action</span>
                  <strong className="audit-detail-field-value">{log.action}</strong>
                </div>
                <div className="audit-detail-field">
                  <span className="audit-detail-field-name">Staff</span>
                  <strong className="audit-detail-field-value">{log.staff}</strong>
                </div>
                <div className="audit-detail-field">
                  <span className="audit-detail-field-name">Timestamp</span>
                  <strong className="audit-detail-field-value">{log.date} {log.time}</strong>
                </div>
              </div>

              <div className="audit-detail-section">
                <span className="audit-detail-label">Detail</span>
                <p className="audit-detail-copy">{log.detail}</p>
              </div>

              <DetailFields fields={buildContextFields(log)} />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
