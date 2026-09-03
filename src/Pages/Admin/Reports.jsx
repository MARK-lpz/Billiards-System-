import { useState } from "react";
import "../../styles/Admin/Reports.css";
import DailyReport from "../../Elements/Admin/DailyReport";
import MonthlyReport from "../../Elements/Admin/MonthlyReport";
import YearlySalesReport from "../../Elements/Admin/YearlySalesReport";
import ReservationReport from "../../Elements/Admin/ReservatioReport";
import InventoryReport from "../../Elements/Admin/InventoryReport";

export default function Reports({ transactions, reservations, products }) {
  const [tab, setTab] = useState("daily");
  const currentDate = new Date();
  const currentYear = String(currentDate.getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  const dailyTx = transactions.filter(t => t.date === today);
  const dailyTotal = dailyTx.reduce((s, t) => s + t.total, 0);
  const monthlyTx = transactions;
  const monthlyTotal = monthlyTx.reduce((s, t) => s + t.total, 0);
  const availableYears = [...new Set([
    currentYear,
    ...transactions.map((transaction) => String(transaction.date || "").slice(0, 4)).filter(Boolean),
  ])].sort((first, second) => Number(second) - Number(first));
  const yearlyTransactions = transactions.filter(
    (transaction) => String(transaction.date || "").slice(0, 4) === selectedYear
  );

  const tabs = [
    { key: "daily", label: "Daily Sales", icon: "bi-calendar-day" },
    { key: "monthly", label: "Monthly Sales", icon: "bi-calendar-month" },
    { key: "yearly", label: "Yearly Sales", icon: "bi-calendar-range" },
    { key: "reservation", label: "Reservations", icon: "bi-calendar-check" },
    { key: "inventory", label: "Stock Report", icon: "bi-box-seam" },
  ];

  const renderReport = () => {
    switch (tab) {
      case "daily":
        return <DailyReport transactions={dailyTx} total={dailyTotal} />;
      case "monthly":
        return <MonthlyReport transactions={monthlyTx} total={monthlyTotal} />;
      case "yearly":
        return (
          <YearlySalesReport
            transactions={yearlyTransactions}
            year={selectedYear}
            years={availableYears}
            onYearChange={setSelectedYear}
          />
        );
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
