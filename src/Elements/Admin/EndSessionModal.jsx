import { useEffect, useState } from "react";
import "../../styles/Admin/PoolTables.css";
import { formatHoursLabel } from "../../utils/reservations";
import { formatPeso, getPlayedMinutes } from "../../utils/tableSession";
import { countWaitingItems, getTableOrders } from "../../utils/tableOrders";

// One table's part of the bill: its time, its orders, and what was paid before.
function BillRows({ charge }) {
  return (
    <>
      <div className="pool-end-bill-row">
        <span>
          Table time
          <small>
            {formatHoursLabel(charge.bookedMinutes)} × {formatPeso(charge.rate)}/hr
          </small>
        </span>
        <strong>{formatPeso(charge.sessionTotal)}</strong>
      </div>
      {charge.orders.length > 0 && <div className="pool-end-bill-heading">Orders</div>}
      {charge.orders.map((line) => (
        <div key={line.id} className="pool-end-bill-row">
          <span>
            {line.name} ×{line.qty}
          </span>
          <strong>{formatPeso(line.price * line.qty)}</strong>
        </div>
      ))}
      {charge.prepaid && (
        <div className="pool-end-bill-row is-credit">
          <span>Paid online (GCash)</span>
          <strong>-{formatPeso(charge.prepaid.amount)}</strong>
        </div>
      )}
      {/* Paid in Sales / POS while the customer kept playing */}
      {charge.payments.map((payment) => (
        <div key={payment.transactionId} className="pool-end-bill-row is-credit">
          <span>
            Paid while playing
            <small>
              Receipt #{String(payment.transactionId).slice(-5)} · {payment.method === "cash" ? "Cash" : "GCash"}
            </small>
          </span>
          <strong>-{formatPeso(payment.amount)}</strong>
        </div>
      ))}
    </>
  );
}

/**
 * The first step of ending a session: the whole bill (table time and what was
 * ordered at the table) and how the customer pays. The admin's Pool Tables, the
 * employee dashboard and the time's up pop-up all end sessions through it.
 * `charge` is worked out for when End Session was pressed, so it is what is paid.
 *
 * Other playing tables can join the receipt (`joined`, from `candidates`). Each
 * ends too, or keeps playing with its bill so far paid.
 */
export default function EndSessionModal({
  table,
  charge,
  joined = [],
  candidates = [],
  total,
  method,
  onMethodChange,
  onJoin,
  onUnjoin,
  onModeChange,
  onClose,
  onContinue,
}) {
  // The list of tables that can join, while it is open.
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const tableName = table.name || `Table ${table.id}`;
  const playedMinutes = getPlayedMinutes(table, charge.endTime);
  const waiting = [table, ...joined.map((entry) => entry.table)].reduce(
    (sum, entry) => sum + countWaitingItems(getTableOrders(entry)),
    0
  );
  const toPay = total > 0;
  const hasJoined = joined.length > 0;

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="end-session-title">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content pool-end-modal">
            <div className="modal-header">
              <h5 className="modal-title" id="end-session-title">
                <i className="bi bi-receipt me-2"></i>
                End Session · {tableName}
              </h5>
              <button type="button" className="pool-modal-close" aria-label="Close" onClick={onClose}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p className="pool-end-copy">
                {charge.customer} played {formatHoursLabel(playedMinutes)} of {formatHoursLabel(charge.bookedMinutes)}.
                {toPay
                  ? hasJoined
                    ? " The joined tables are paid on the same receipt."
                    : " Take the payment to end the session and free the table."
                  : " Everything is paid; ending the session frees the table and gives the receipt."}
              </p>

              <div className="pool-end-bill">
                {hasJoined && (
                  <div className="pool-end-section-head">
                    <span>
                      <strong>{tableName}</strong> · {charge.customer}
                    </span>
                    <span className="pool-end-section-due">{formatPeso(charge.amountDue)}</span>
                  </div>
                )}
                <BillRows charge={charge} />

                {joined.map((entry) => {
                  const name = entry.charge.tableName;
                  return (
                    <div key={entry.table.id} className="pool-end-section">
                      <div className="pool-end-section-head">
                        <span>
                          <strong>{name}</strong> · {entry.charge.customer}
                        </span>
                        <span className="pool-end-section-due">{formatPeso(entry.charge.amountDue)}</span>
                        <button
                          type="button"
                          className="pool-end-unjoin"
                          onClick={() => onUnjoin(entry.table.id)}
                          aria-label={`Take ${name} off this receipt`}
                          title="Take off this receipt"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                      <div className="pool-end-mode" role="group" aria-label={`What happens to ${name}`}>
                        <button
                          type="button"
                          className={entry.mode === "end" ? "active" : ""}
                          aria-pressed={entry.mode === "end"}
                          onClick={() => onModeChange(entry.table.id, "end")}
                        >
                          <i className="bi bi-stop-circle"></i>
                          End too
                        </button>
                        <button
                          type="button"
                          className={entry.mode === "keep" ? "active" : ""}
                          aria-pressed={entry.mode === "keep"}
                          onClick={() => onModeChange(entry.table.id, "keep")}
                        >
                          <i className="bi bi-play-circle"></i>
                          Keep playing
                        </button>
                      </div>
                      {entry.mode === "keep" && (
                        <p className="pool-end-mode-note">Pays {name}&apos;s bill so far; its time keeps running.</p>
                      )}
                      <BillRows charge={entry.charge} />
                    </div>
                  );
                })}

                <div className="pool-end-bill-total">
                  <span>{toPay ? "Total to pay" : "Left to pay"}</span>
                  <strong>{formatPeso(total)}</strong>
                </div>
              </div>

              {candidates.length > 0 && (
                <div className="pool-end-join">
                  <button
                    type="button"
                    className="pool-end-join-toggle"
                    aria-expanded={picking}
                    onClick={() => setPicking((open) => !open)}
                  >
                    <i className="bi bi-link-45deg"></i>
                    Join Table
                    <i className={`bi bi-chevron-${picking ? "up" : "down"}`}></i>
                  </button>
                  {picking && (
                    <div className="pool-end-join-list">
                      <p>Customers paying together? Add their table to this receipt.</p>
                      {candidates.map((entry) => (
                        <div key={entry.table.id} className="pool-end-join-option">
                          <span>
                            <strong>{entry.charge.tableName}</strong> · {entry.charge.customer}
                          </span>
                          <span className="pool-end-section-due">{formatPeso(entry.charge.amountDue)}</span>
                          <button
                            type="button"
                            className="pool-end-join-btn"
                            onClick={() => {
                              onJoin(entry.table);
                              setPicking(false);
                            }}
                          >
                            <i className="bi bi-plus-lg"></i>
                            Join
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {waiting > 0 && (
                <p className="form-blocked-note pool-end-waiting" role="status">
                  <i className="bi bi-hourglass-split" aria-hidden="true"></i>
                  <span>
                    {waiting} {waiting === 1 ? "item is" : "items are"} not marked served yet. They are still on the bill.
                  </span>
                </p>
              )}

              {toPay && (
                <div className="pool-end-methods" role="group" aria-label="Payment method">
                  <button
                    type="button"
                    className={`payment-method-btn ${method === "cash" ? "active" : ""}`}
                    aria-pressed={method === "cash"}
                    onClick={() => onMethodChange("cash")}
                  >
                    <i className="bi bi-cash me-2"></i>
                    Cash
                  </button>
                  <button
                    type="button"
                    className={`payment-method-btn ${method === "ewallet" ? "active" : ""}`}
                    aria-pressed={method === "ewallet"}
                    onClick={() => onMethodChange("ewallet")}
                  >
                    <i className="bi bi-phone me-2"></i>
                    GCash
                  </button>
                </div>
              )}

              <div className="pool-end-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className={`btn ${toPay ? "btn-success" : "btn-danger"}`} onClick={onContinue}>
                  <i className={`bi ${toPay ? "bi-credit-card" : "bi-stop-circle"} me-2`}></i>
                  {toPay ? `Pay ${formatPeso(total)}` : "End Session"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
