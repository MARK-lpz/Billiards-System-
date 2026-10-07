import { useState } from "react";
import ConfirmDialog from "../Global/ConfirmDialog";
import Pagination from "../Global/Pagination";
import usePagination from "../Global/usePagination";

const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortId = (ticket) => String(ticket.id).slice(-5);

export default function SalesOrderQueue({
  orderTickets = [],
  pendingItemsCount,
  servedItemsCount,
  onMarkTicketServed,
  onSetItemServed,
}) {
  // Marking served asks first: a stray tap would otherwise close an order, and a
  // fully served order moves to history where it cannot be changed.
  const [confirmTarget, setConfirmTarget] = useState(null);
  // The counts above stay for every ticket; only the list below is paged.
  const pagination = usePagination(orderTickets);

  // Takes the target as an argument rather than reading `confirmTarget` from the
  // closure: the React Compiler narrows a closed-over `confirmTarget.type` into a
  // render-time check, which throws while the target is still null.
  const confirmServed = (target) => {
    if (target.type === "ticket") onMarkTicketServed(target.ticket.id);
    else onSetItemServed(target.ticket.id, target.item.id);
    setConfirmTarget(null);
  };

  const handleItemClick = (ticket, item) => {
    // Putting a served item back to pending only corrects a mistake, so it needs no question.
    if (item.served) {
      onSetItemServed(ticket.id, item.id);
      return;
    }
    setConfirmTarget({ type: "item", ticket, item });
  };

  const describeTarget = (target) => {
    const pendingItems = target.ticket.items.filter((item) => !item.served);

    if (target.type === "ticket") {
      return {
        title: "Mark Order as Served?",
        message: `Mark all ${pendingItems.length} pending ${pendingItems.length === 1 ? "item" : "items"} on Order #${shortId(target.ticket)} as served?`,
        detail: "The order moves to Transaction History and can no longer be changed.",
        confirmLabel: "Yes, Mark Served",
      };
    }

    const isLast = pendingItems.length === 1;
    return {
      title: "Mark Item as Served?",
      message: `Mark ${target.item.name} ×${target.item.qty} on Order #${shortId(target.ticket)} as served?`,
      detail: isLast ? "This is the last pending item, so the whole order moves to Transaction History." : "",
      confirmLabel: "Yes, Served",
    };
  };

  const dialog = confirmTarget ? describeTarget(confirmTarget) : null;

  return (
    <div className="order-queue-page">
      <div className="order-queue-stats">
        <div className="order-queue-stat order-queue-stat--pending">
          <span className="order-queue-stat-value">{pendingItemsCount}</span>
          <span className="order-queue-stat-label">Pending Items</span>
        </div>
        <div className="order-queue-stat order-queue-stat--served">
          <span className="order-queue-stat-value">{servedItemsCount}</span>
          <span className="order-queue-stat-label">Served Items</span>
        </div>
        <div className="order-queue-stat">
          <span className="order-queue-stat-value">{orderTickets.length}</span>
          <span className="order-queue-stat-label">Order Tickets</span>
        </div>
      </div>

      {orderTickets.length === 0 ? (
        <div className="order-history-empty">No order tickets yet. Send food or drink items from the running bill.</div>
      ) : (
        <div className="order-ticket-list">
          {pagination.items.map((ticket) => {
            const pendingCount = ticket.items.filter((item) => !item.served).length;
            const ticketTotal = ticket.items.reduce((sum, item) => sum + item.price * item.qty, 0);

            return (
              <div key={ticket.id} className={`order-ticket-card ${ticket.status === "served" ? "served" : "pending"}`}>
                <div className="order-ticket-header">
                  <div>
                    <div className="order-ticket-title">Order #{shortId(ticket)}</div>
                    <div className="order-ticket-meta">
                      Sent {ticket.createdAt} • {ticket.date}
                    </div>
                  </div>

                  <div className="order-ticket-actions">
                    <span className={`order-ticket-badge ${ticket.status}`}>
                      {ticket.status === "served" ? "All served" : `${pendingCount} pending`}
                    </span>
                    {ticket.status !== "served" && (
                      <button
                        type="button"
                        className="order-ticket-btn"
                        onClick={() => setConfirmTarget({ type: "ticket", ticket })}
                      >
                        Mark Ticket Served
                      </button>
                    )}
                  </div>
                </div>

                <div className="order-ticket-items">
                  {ticket.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`order-ticket-item ${item.served ? "served" : "pending"}`}
                      onClick={() => handleItemClick(ticket, item)}
                    >
                      <div>
                        <div className="order-ticket-item-name">
                          {item.name} ×{item.qty}
                        </div>
                        <div className="order-ticket-item-price">{fmtPeso(item.price * item.qty)}</div>
                      </div>
                      <span>{item.served ? "Served" : "Pending"}</span>
                    </button>
                  ))}
                </div>

                <div className="order-ticket-total">
                  <span>
                    {ticket.items.length} {ticket.items.length === 1 ? "item" : "items"}
                  </span>
                  <strong>Total {fmtPeso(ticketTotal)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination {...pagination} />

      {confirmTarget && dialog && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          detail={dialog.detail}
          confirmLabel={dialog.confirmLabel}
          cancelLabel="Not yet"
          confirmClassName="btn-success"
          icon="bi-check2-circle"
          onConfirm={() => confirmServed(confirmTarget)}
          onClose={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}
