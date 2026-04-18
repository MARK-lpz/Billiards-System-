// CustomerManagement.jsx
import { useState } from "react";
import "../../styles/Employee/CustomerManagement.css";
import { fmt, LOYALTY_TIERS } from "../../Elements/Employee/constant.js";
import CustomerCard from "../../Elements/Employee/CustomerCard.jsx";
import CustomerModal from "../../Elements/Employee/CustomerModal.jsx";

export default function CustomerManagement({ customers = [], setCustomers }) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("All");
  const [modal, setModal] = useState(null);

  const handleSave = (data) => {
    if (data.id && customers.find((c) => c.id === data.id)) {
      setCustomers((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    } else {
      setCustomers((prev) => [...prev, data]);
    }
    setModal(null);
  };

  const handleDelete = (id) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    if (modal && modal.id === id) setModal(null);
  };

  const tiers = ["All", ...LOYALTY_TIERS.map((t) => t.tier).reverse()];

  const filtered = customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
    )
    .filter((c) => tierFilter === "All" || c.loyalty === tierFilter);

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalVisits = customers.reduce((s, c) => s + c.visits, 0);
  const goldCount = customers.filter((c) => c.loyalty === "Gold").length;

  return (
    <div className="cust-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Customer Management</h1>
          <p className="page-subtitle">Track players, loyalty tiers, and visit history</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="tm-stats-row">
        {[
          [totalCustomers, "var(--blue)", "Total Players"],
          [goldCount, "var(--yellow)", "Gold Members"],
          [totalVisits, "var(--muted)", "Total Visits"],
          [fmt(totalRevenue), "var(--green)", "Lifetime Value"],
        ].map(([v, c, l]) => (
          <div key={l} className="tm-stat-card">
            <div
              className="tm-stat-value"
              style={{ color: c, fontSize: typeof v === "string" ? 18 : 28 }}
            >
              {v}
            </div>
            <div className="tm-stat-label">{l}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="inv-controls" style={{ marginBottom: 16 }}>
        <input
          className="pos-input"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />

        <div className="inv-filter-pills">
          {tiers.map((t) => {
            const tierData = LOYALTY_TIERS.find((l) => l.tier === t);
            return (
              <button
                key={t}
                className={`cat-pill ${tierFilter === t ? "active" : ""}`}
                style={
                  tierFilter === t && tierData
                    ? { background: tierData.color, borderColor: tierData.color }
                    : {}
                }
                onClick={() => setTierFilter(t)}
              >
                {t}
              </button>
            );
          })}
        </div>

        <button className="cust-add-btn" onClick={() => setModal("add")}>
          + New Customer
        </button>
      </div>

      {/* Grid or Empty */}
      {filtered.length === 0 ? (
        <div className="track-empty">No customers match your search</div>
      ) : (
        <div className="cust-grid">
          {filtered.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onClick={setModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <CustomerModal
          customer={modal === "add" ? null : modal}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}