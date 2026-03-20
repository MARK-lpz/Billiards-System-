import { useState } from "react";
import "../../styles/Admin/Dashboard.css";
import Sidebar from "../../Elements/Admin/Sidebar";
import Notification from "../../Elements/Global/Notification";
import Menu from "../../Elements/Global/Menu";
import EmployeeStats from "../../Elements/Employee/EmployeeStats";
import TaskList from "../../Elements/Admin/TaskList";
import ActiveTables from "../../Elements/Admin/ActiveTables";
import TodaySchedule from "../../Elements/Admin/Schedule";
import QuickActions from "../../Elements/Employee/QuickAction";
import WeeklyPerformance from "../../Elements/Admin/WeeklyPerformance";
import LoadingBar from "../../Elements/Global/Loading";
import QRGenerator from "./QrGenerator";

export default function Dashboard({ onLogout }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNavChange = (navId) => {
    setLoading(true);
    setTimeout(() => {
      setActiveNav(navId);
      setLoading(false);
    }, 300);
  };

  return (
    <>
      <LoadingBar loading={loading} />
      <div className="dashboard-layout">
        <Sidebar 
          activeNav={activeNav} 
          setActiveNav={setActiveNav}
          onNavChange={handleNavChange}
        />

        <main className="main-content">
          {activeNav === 'qr-generator' ? (
            <QRGenerator />
          ) : (
            <>
              <div className="page-header">
                <div className="page-header-text">
                  <h1 className="page-title">Admin Dashboard</h1>
                  <p className="page-subtitle">Welcome back! Manage your business operations</p>
                </div>
                
                <div className="header-right">
                  <div className="search-wrapper">
                    <i className="bi bi-search search-icon"></i>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search tasks or tables..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="header-icons">
                    <Notification />
                    <Menu 
                      onLogout={onLogout}
                      onProfile={() => handleNavChange('profile')}
                    />
                  </div>
                </div>
              </div>

              <EmployeeStats />

              <div className="employee-content-grid">
                <div className="employee-left-column">
                  <TaskList />
                  <ActiveTables />
                </div>

                <div className="employee-right-column">
                  <TodaySchedule />
                  <QuickActions />
                  <WeeklyPerformance />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}