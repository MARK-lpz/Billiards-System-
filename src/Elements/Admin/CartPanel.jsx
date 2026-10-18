import { useState } from "react";
import { createPortal } from "react-dom";
import ConfirmDialog from "../Global/ConfirmDialog";

// The pop-up is drawn at the app's theme wrapper: the cart is sticky, which makes
// it its own layer, so a pop-up inside it could end up under the product grid.
const getModalRoot = () => document.querySelector("#root > .dark, #root > .light") || document.body;

/**
 * The Running Bill: one bill at a time, as a table of Item, Qty and Amount, with
 * the total and the payment method under it. The trash button in its header
 * removes the whole transaction unpaid, after a check that says what happens
 * to each kind of line (`describeBillRemoval`).
 */
export default function CartPanel({
  cart,
  activeBill = null,
  total,
  method,
  waitingCount,
  unsyncedCount,
  stockAlert,
  savedBillsCount = 0,
  onUpdateQty,
  getQueuedQty = () => 0,
  onSetMethod,
  onProcessPayment,
  onEditBill,
  onCloseBill,
  describeBillRemoval = () => null,
  onRemoveBill,
}) {
  // A quantity being typed, until it is applied (or left empty while typing).
  const [qtyDrafts, setQtyDrafts] = useState({});
  // An item about to come off the bill, waiting for staff to confirm.
  const [removeTarget, setRemoveTarget] = useState(null);
  // The whole bill about to be removed (Remove Transaction), waiting for staff to confirm.
  const [removingBill, setRemovingBill] = useState(null);

  const askToRemove = (item, nextQty) => {
    const removing = item.qty - nextQty;
    const servedQty = Math.max(0, removing - getQueuedQty(item.id));
    setRemoveTarget({ item, nextQty, removing, servedQty });
  };

  // The minus button stays one tap while the item is still waiting; taking off
  // one that was already served asks first.
  const decreaseQty = (item) => {
    if (getQueuedQty(item.id) >= 1) {
      onUpdateQty(item.id, item.qty - 1);
      return;
    }
    askToRemove(item, item.qty - 1);
  };

  // Takes the target as an argument rather than reading `removeTarget` from the
  // closure: the React Compiler narrows a closed-over `removeTarget.item` into a
  // render-time check, which throws while the target is still null.
  const confirmRemove = (target) => {
    onUpdateQty(target.item.id, target.nextQty, { allowServed: true });
    setRemoveTarget(null);
  };

  const describeRemoval = (target) => {
    const { item, nextQty, removing, servedQty } = target;
    if (item.liveTable) {
      return {
        title: "Remove from Bill?",
        message: `Take ${item.name} off this bill?`,
        detail: `It stays unpaid on ${item.tableName} while they play. Add it again from Pool Table Bills, or it is paid when the session ends.`,
      };
    }

    if (item.isTableCharge) {
      const withOrders = cart.some((entry) => entry.fromTableCharge && entry.chargeId === item.chargeId);
      return {
        title: "Remove from Bill?",
        message: `Take ${item.name} off this bill?`,
        detail: `It stays unpaid and goes back to the Pool Table Bills list${
          withOrders ? ", with what was ordered at the table" : ""
        }.`,
      };
    }

    const waitingQty = removing - servedQty;
    const servedNote =
      servedQty > 0
        ? `${servedQty} already served, so ${servedQty === 1 ? "its" : "their"} stock is not returned and the customer is not charged for ${servedQty === 1 ? "it" : "them"}.`
        : "";
    const waitingNote =
      waitingQty > 0 ? `${waitingQty} still waiting ${waitingQty === 1 ? "is" : "are"} taken off the order queue and returned to stock.` : "";

    return {
      title: nextQty === 0 ? "Remove from Bill?" : "Remove a Served Item?",
      message:
        nextQty === 0
          ? `Remove ${item.name} ×${item.qty} from ${activeBill ? activeBill.label : "the running bill"}?`
          : `Take ${removing} ${item.name} off ${activeBill ? activeBill.label : "the running bill"}?`,
      detail: [waitingNote, servedNote].filter(Boolean).join(" "),
    };
  };

  const removal = removeTarget ? describeRemoval(removeTarget) : null;

  const fmtPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const fmtCount = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

  // What removing the whole bill does, line kind by line kind.
  const describeBillRemovalCheck = (bill) => {
    const effect = describeBillRemoval(bill.id) || { waiting: 0, served: [], tables: [] };
    return {
      message: `Remove the running bill for ${bill.label} (${fmtPeso(total)}) without payment?`,
      detail: [
        effect.waiting
          ? `${fmtCount(effect.waiting, "item")} still waiting ${effect.waiting === 1 ? "leaves" : "leave"} the Order Queue and ${effect.waiting === 1 ? "goes" : "go"} back to stock.`
          : "",
        effect.served.length
          ? `Already served, so not returned to stock and not charged: ${effect.served.map((item) => `${item.name} ×${item.qty}`).join(", ")}.`
          : "",
        effect.tables.length ? `${effect.tables.join(", ")} stays unpaid on Pool Table Bills.` : "",
        "This is recorded in the Audit Trail.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  };
  const billRemoval = removingBill ? describeBillRemovalCheck(removingBill) : null;

  // Takes the bill as an argument for the same React Compiler reason as confirmRemove.
  const confirmBillRemoval = (bill) => {
    onRemoveBill(bill.id);
    setRemovingBill(null);
  };

  // Once applied, the draft is dropped so the box shows the bill's own quantity
  // again; a kept draft went stale when + or − changed the quantity afterwards.
  const clearDraft = (item) =>
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });

  const commitQty = (item) => {
    const draft = qtyDrafts[item.id];
    if (draft === undefined) return;

    const parsedQty = Number.parseInt(draft, 10);
    onUpdateQty(item.id, Number.isNaN(parsedQty) ? item.qty : parsedQty);
    clearDraft(item);
  };

  const handleQtyChange = (item, value) => {
    if (value === "") {
      setQtyDrafts((prev) => ({ ...prev, [item.id]: value }));
      return;
    }

    const parsedQty = Number.parseInt(value, 10);
    if (Number.isNaN(parsedQty)) return;

    onUpdateQty(item.id, parsedQty);
    clearDraft(item);
  };

  // Table time and what came from a table's bill are one fixed quantity each;
  // an ended session's orders come off only with its table time.
  const isFixed = (item) => item.isTableCharge || item.fromTableCharge;
  const canRemove = (item) => !(item.fromTableCharge && !item.liveTable);

  return (
    <div className="cart-panel">
      <div className="card cart-card">
        <div className="card-body">
          <div className="cart-header">
            <i className="bi bi-receipt-cutoff"></i>
            <span className="cart-header-title">
              <span className="cart-header-label">Running Bill</span>
              <span className="cart-header-bill">{activeBill ? activeBill.label : "No bill yet"}</span>
            </span>
            {activeBill && (
              <button
                type="button"
                className="cart-bill-edit"
                onClick={onEditBill}
                aria-label={`Edit ${activeBill.label}`}
                title="Change who this bill is for"
              >
                <i className="bi bi-pencil"></i>
              </button>
            )}
            {activeBill && cart.length > 0 && onRemoveBill && (
              <button
                type="button"
                className="cart-bill-remove"
                onClick={() => setRemovingBill(activeBill)}
                aria-label={`Remove transaction: ${activeBill.label}`}
                title="Remove this transaction (unpaid)"
              >
                <i className="bi bi-trash3"></i>
              </button>
            )}
          </div>

          {(waitingCount > 0 || unsyncedCount > 0 || savedBillsCount > 0) && (
            <div className="cart-notes">
              {waitingCount > 0 && (
                <span>
                  <i className="bi bi-hourglass-split"></i>
                  {waitingCount} waiting to be served (Order Queue)
                </span>
              )}
              {unsyncedCount > 0 && (
                <span className="is-attention">
                  <i className="bi bi-arrow-repeat"></i>
                  {unsyncedCount} still syncing to inventory
                </span>
              )}
              {savedBillsCount > 0 && (
                <span>
                  <i className="bi bi-collection"></i>
                  {savedBillsCount} saved {savedBillsCount === 1 ? "bill" : "bills"} from before, shown after this one is paid
                </span>
              )}
            </div>
          )}

          {cart.length === 0 ? (
            <div className="cart-empty">
              <i className="bi bi-receipt"></i>
              {activeBill ? (
                <>
                  <p>Nothing on {activeBill.label} yet. Tap food or drinks to add them.</p>
                  <button type="button" className="cart-close-bill-btn" onClick={() => onCloseBill(activeBill.id)}>
                    <i className="bi bi-x-circle"></i>
                    Close This Bill
                  </button>
                </>
              ) : (
                <p>Tap an item, or Add to Bill from Pool Table Bills, to start the bill.</p>
              )}
            </div>
          ) : (
            <div className="cart-table" role="table" aria-label="Running bill items">
              <div className="cart-table-head" role="row">
                <span role="columnheader">Item</span>
                <span role="columnheader">Qty</span>
                <span role="columnheader">Amount</span>
                <span role="columnheader" aria-label="Remove"></span>
              </div>

              <div className="cart-items">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className={`cart-item ${isFixed(item) ? "cart-item--table" : ""}`}
                    role="row"
                  >
                    <span
                      className="cart-item-name"
                      role="cell"
                      title={[item.name, item.detail || `${fmtPeso(item.price)} each`].filter(Boolean).join(" · ")}
                    >
                      {isFixed(item) && (
                        <i className="bi bi-grid-3x3-gap-fill cart-item-origin" aria-label="From a pool table"></i>
                      )}
                      {item.name}
                    </span>

                    <span className="cart-item-qty" role="cell">
                      {isFixed(item) ? (
                        <span className="cart-item-session">{item.qty}</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => decreaseQty(item)}
                            aria-label={`One less ${item.name}`}
                          >
                            <i className="bi bi-dash"></i>
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            className="qty-input"
                            aria-label={`${item.name} quantity`}
                            value={qtyDrafts[item.id] ?? String(item.qty)}
                            onChange={(event) => handleQtyChange(item, event.target.value)}
                            onBlur={() => commitQty(item)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitQty(item);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => onUpdateQty(item.id, item.qty + 1)}
                            aria-label={`One more ${item.name}`}
                          >
                            <i className="bi bi-plus"></i>
                          </button>
                        </>
                      )}
                    </span>

                    <span className="cart-item-total" role="cell">
                      {fmtPeso(item.price * item.qty)}
                    </span>

                    <span role="cell">
                      {canRemove(item) && (
                        <button
                          type="button"
                          className="cart-item-remove"
                          onClick={() => askToRemove(item, 0)}
                          aria-label={`Remove ${item.name}`}
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      )}
                    </span>

                    {stockAlert?.productId === item.id && (
                      <div className="cart-stock-warning" role="alert">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        {stockAlert.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="cart-footer">
            <div className="cart-total">
              <span>Total</span>
              <span className="cart-total-amount">{fmtPeso(total)}</span>
            </div>

            <div className="payment-methods" role="group" aria-label="Payment method">
              <button
                type="button"
                className={`payment-method-btn ${method === "cash" ? "active" : ""}`}
                aria-pressed={method === "cash"}
                onClick={() => onSetMethod("cash")}
              >
                <i className="bi bi-cash"></i>
                Cash
              </button>

              <button
                type="button"
                className={`payment-method-btn ${method === "ewallet" ? "active" : ""}`}
                aria-pressed={method === "ewallet"}
                onClick={() => onSetMethod("ewallet")}
              >
                <i className="bi bi-phone"></i>
                GCash
              </button>
            </div>

            {method === "ewallet" && (
              <div className="gcash-qr-panel">
                <div className="gcash-qr-copy">
                  <strong>GCash QR Payment</strong>
                  <span>Let the customer scan before confirming payment.</span>
                </div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`GCash Break & Chill amount ${total.toFixed(2)}`)}`}
                  alt="GCash payment QR code"
                />
              </div>
            )}

            <button className="process-payment-btn" onClick={onProcessPayment} disabled={cart.length === 0}>
              <i className="bi bi-credit-card"></i>
              {cart.length ? `Pay ${fmtPeso(total)}` : "Pay"}
            </button>
          </div>
        </div>
      </div>

      {removingBill && billRemoval && createPortal(
        <ConfirmDialog
          title="Remove Transaction?"
          message={billRemoval.message}
          detail={billRemoval.detail}
          confirmLabel="Yes, Remove"
          cancelLabel="Keep it"
          icon="bi-trash3"
          onConfirm={() => confirmBillRemoval(removingBill)}
          onClose={() => setRemovingBill(null)}
        />,
        getModalRoot()
      )}

      {removeTarget && removal && createPortal(
        <ConfirmDialog
          title={removal.title}
          message={removal.message}
          detail={removal.detail}
          confirmLabel="Yes, Remove"
          cancelLabel="Keep it"
          onConfirm={() => confirmRemove(removeTarget)}
          onClose={() => setRemoveTarget(null)}
        />,
        getModalRoot()
      )}
    </div>
  );
}
