import { useState } from "react";
import "../../styles/Admin/Reports.css";
import DailyReport from "../../Elements/Admin/DailyReport";
import MonthlyReport from "../../Elements/Admin/MonthlyReport";
import ReservationReport from "../../Elements/Admin/ReservationReport";
import InventoryReport from "../../Elements/Admin/InventoryReport";

export default function Reports({ transactions, reservations, products }) {
  const [tab, setTab] = useState("daily");
  const today = "2026-03-08";

  const dailyTx = transactions.filter(t => t.date === today);
  const dailyTotal = dailyTx.reduce((s, t) => s + t.total, 0);
  const monthlyTx = transactions;
  const monthlyTotal = monthlyTx.reduce((s, t) => s + t.total, 0);

  const tabs = [
    { key: "daily", label: "Daily Sales", icon: "bi-calendar-day" },
    { key: "monthly", label: "Monthly Sales", icon: "bi-calendar-month" },
    { key: "reservation", label: "Reservations", icon: "bi-calendar-check" },
    { key: "inventory", label: "Inventory", icon: "bi-box-seam" },
  ];

  const renderReport = () => {
    switch (tab) {
      case "daily":
        return <DailyReport transactions={dailyTx} total={dailyTotal} />;
      case "monthly":
        return <MonthlyReport transactions={monthlyTx} total={monthlyTotal} />;
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
        <h1 className="reports-title">Reports & Analytics</h1>
        <p className="reports-subtitle">View sales, reservations, and inventory reports</p>
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