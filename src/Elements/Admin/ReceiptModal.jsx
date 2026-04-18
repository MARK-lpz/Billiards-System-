export default function ReceiptModal({ receipt, onClose }) {
  const fmtPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content receipt-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-check-circle me-2"></i>
                Payment Successful
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <div className="receipt-header">
                <i className="bi bi-circle receipt-icon"></i>
                <div className="receipt-business-name">Break & Chill</div>
                <div className="receipt-business-type">Billiard Hall • Official Receipt</div>
                <div className="receipt-date">{receipt.date} • {receipt.time}</div>
              </div>

              <div className="receipt-items">
                {receipt.items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="receipt-item">
                    <span>
                      {item.name} × {item.qty}
                      {item.isExtra ? " (Extra)" : ""}
                    </span>
                    <span>{fmtPeso(item.price * item.qty)}</span>
                  </div>
                ))}

                {receipt.discAmt > 0 && (
                  <div className="receipt-item">
                    <span>{receipt.discLabel}</span>
                    <span>-{fmtPeso(receipt.discAmt)}</span>
                  </div>
                )}

                <div className="receipt-total">
                  <span>TOTAL</span>
                  <span>{fmtPeso(receipt.total)}</span>
                </div>

                <div className="receipt-payment-method">
                  Payment: {receipt.method === "cash" ? <><i className="bi bi-cash ms-1"></i> Cash</> : <><i className="bi bi-phone ms-1"></i> eWallet</>}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-success w-100" onClick={onClose}>
                <i className="bi bi-check-circle me-2"></i>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
