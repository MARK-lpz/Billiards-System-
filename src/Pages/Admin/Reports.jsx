import { useState } from "react";
import "../../styles/Admin/Reports.css";
import SalesReport from "../../Elements/Admin/SalesReport";
import ReservationReport from "../../Elements/Admin/ReservatioReport";
import InventoryReport from "../../Elements/Admin/InventoryReport";

export default function Reports({ transactions, reservations, products }) {
  const [tab, setTab] = useState("sales");

  // Daily, monthly and yearly sales are one report; its period is picked inside it.
  const tabs = [
    { key: "sales", label: "Sales Report", icon: "bi-graph-up" },
    { key: "reservation", label: "Reservations", icon: "bi-calendar-check" },
    { key: "inventory", label: "Stock Report", icon: "bi-box-seam" },
  ];

  const renderReport = () => {
    switch (tab) {
      case "sales":
        return <SalesReport transactions={transactions} />;
      case "reservation":
        return <ReservationReport reservations={reservations} />;
      case "inventory":
        return <InventoryReport products={products} />;
      default:
        return null;
    }
  };

  return (
    <div className="reports-container">
      {/* Header */}
      <div className="reports-header">
        <h1 className="reports-title">Sales & Stock Reports</h1>
        <p className="reports-subtitle">View sales, reservations, and current stock reports</p>
      </div>

      {/* Tab Navigation */}
      <div className="reports-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`reports-tab-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <i className={`bi ${t.icon} me-2`}></i>
            {t.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      {renderReport()}
    </div>
  );
}
