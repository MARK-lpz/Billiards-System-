const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SalesOrderQueue({
  orderTickets = [],
  pendingItemsCount,
  servedItemsCount,
  onMarkTicketServed,
  onSetItemServed,
}) {
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
          {orderTickets.map((ticket) => {
            const pendingCount = ticket.items.filter((item) => !item.served).length;

            return (
              <div key={ticket.id} className={`order-ticket-card ${ticket.status === "served" ? "served" : "pending"}`}>
                <div className="order-ticket-header">
                  <div>
                    <div className="order-ticket-title">Order #{String(ticket.id).slice(-5)}</div>
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
                        onClick={() => onMarkTicketServed(ticket.id)}
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
                      onClick={() => onSetItemServed(ticket.id, item.id)}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
