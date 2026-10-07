import { useState } from "react";
import Pagination from "../Global/Pagination";
import usePagination from "../Global/usePagination";

const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const SORT_OPTIONS = [
  { value: "latest", label: "Latest", icon: "bi-sort-down" },
  { value: "oldest", label: "Oldest", icon: "bi-sort-up" },
];

// "2026-10-07" and "02:30 PM" (or "14:30") as a moment in ms; 0 when unreadable.
const parseDateTime = (date, time) => {
  const day = new Date(`${date}T00:00:00`);
  if (Number.isNaN(day.getTime())) return 0;

  const clock = String(time || "").match(/(\d{1,2}):(\d{2})\s*([ap])?/i);
  if (clock) {
    const meridiem = clock[3]?.toLowerCase();
    const hours = meridiem ? (Number(clock[1]) % 12) + (meridiem === "p" ? 12 : 0) : Number(clock[1]);
    day.setHours(hours, Number(clock[2]));
  }
  return day.getTime();
};

// A sale's id is the moment it was paid. A served order's id is when it was
// sent, so it is placed by the time it was served instead.
const getSaleTime = (tx) => (Number(tx.id) > 1e12 ? Number(tx.id) : parseDateTime(tx.date, tx.time));
const getServedTime = (ticket) => parseDateTime(ticket.date, ticket.servedAt) || Number(ticket.id) || 0;

const ServedTicketCard = ({ ticket }) => {
  const ticketTotal = ticket.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="order-history-card completed-card">
      <div className="order-history-card-header">
        <span className="order-history-cashier">
          <i className="bi bi-bag-check me-2"></i>
          Served Order #{String(ticket.id).slice(-5)}
        </span>
        <span className="order-history-total">{fmtPeso(ticketTotal)}</span>
      </div>

      <div className="order-history-meta">
        <i className="bi bi-check-circle me-1"></i>
        Served {ticket.servedAt ? `at ${ticket.servedAt}` : ""}
        {ticket.date ? ` • ${ticket.date}` : ""}
      </div>

      <div className="order-history-items">
        {ticket.items.map((item) => (
          <span key={item.id} className="order-history-item-pill">
            {item.name} ×{item.qty}
          </span>
        ))}
      </div>
    </div>
  );
};

const TransactionCard = ({ tx, onViewReceipt }) => (
  <div className="order-history-card completed-card">
    <div className="order-history-card-header">
      <span className="order-history-cashier">
        <i className="bi bi-receipt me-2"></i>
        #{String(tx.id).slice(-5)}
      </span>

      <span className="order-history-header-side">
        <span className="order-history-total">{fmtPeso(tx.total)}</span>
        {onViewReceipt && (
          <button type="button" className="order-history-receipt-btn" onClick={() => onViewReceipt(tx)}>
            <i className="bi bi-receipt-cutoff"></i>
            Receipt
          </button>
        )}
      </span>
    </div>

    <div className="order-history-meta">
      <i className={`bi ${tx.method === "cash" ? "bi-cash" : "bi-phone"} me-1`}></i>
      {tx.method === "cash" ? "Cash" : "eWallet"}
      {tx.time ? ` • ${tx.time}` : ""}
      {tx.date ? ` • ${tx.date}` : ""}
    </div>

    {tx.discAmt > 0 && (
      <div className="order-history-discount">
        <i className="bi bi-tag me-1"></i>
        {tx.discLabel} • saved {fmtPeso(tx.discAmt)}
      </div>
    )}

    <div className="order-history-items">
      {tx.items?.map((item, index) => (
        <span
          key={`${tx.id}-${index}`}
          className={`order-history-item-pill ${item.isTableCharge ? "is-table" : ""}`}
        >
          {item.isTableCharge ? item.name : `${item.name} ×${item.qty}`}
        </span>
      ))}
    </div>
  </div>
);

export default function SalesTransactionHistory({ transactions = [], servedOrderTickets = [], onViewReceipt }) {
  const [sortOrder, setSortOrder] = useState("latest");

  // Served orders and paid sales are one list, in the order they happened.
  const entries = [
    ...servedOrderTickets.map((ticket) => ({ key: `served-${ticket.id}`, at: getServedTime(ticket), ticket })),
    ...transactions.map((tx) => ({ key: tx.id, at: getSaleTime(tx), tx })),
  ].sort((first, second) => (sortOrder === "latest" ? second.at - first.at : first.at - second.at));
  const pagination = usePagination(entries);

  const changeSort = (nextOrder) => {
    setSortOrder(nextOrder);
    pagination.goToPage(1);
  };

  return (
    <div className="order-history-layout order-history-layout--single">
      <div className="order-history-section">
        <div className="order-history-section-header completed">
          <span className="order-dot" style={{ background: "var(--green, #22c55e)" }} />
          <span>Transaction History ({entries.length})</span>

          {entries.length > 1 && (
            <div className="order-history-sort" role="group" aria-label="Sort transactions">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`order-history-sort-btn ${sortOrder === option.value ? "is-active" : ""}`}
                  aria-pressed={sortOrder === option.value}
                  onClick={() => changeSort(option.value)}
                >
                  <i className={`bi ${option.icon}`}></i>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="order-history-empty">No transactions yet.</div>
        ) : (
          <>
            {pagination.items.map((entry) =>
              entry.ticket ? (
                <ServedTicketCard key={entry.key} ticket={entry.ticket} />
              ) : (
                <TransactionCard key={entry.key} tx={entry.tx} onViewReceipt={onViewReceipt} />
              )
            )}
            <Pagination {...pagination} />
          </>
        )}
      </div>
    </div>
  );
}
