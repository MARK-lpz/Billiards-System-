import { useState } from "react";
import "../styles/Employeedashboard.css";
import Sidebar from "../Elements/Sidebar";
import Notification from "../Elements/Notification";
import Menu from "../Elements/Menu";

const notifications = [
  { id: 1, message: "Your shift starts in 30 minutes", time: "5 min ago", unread: true },
  { id: 2, message: "Table 3 needs cleaning", time: "15 min ago", unread: true },
  { id: 3, message: "Break time scheduled", time: "1 hour ago", unread: false },
];

export default function EmployeeDashboard({ onLogout }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");

  return (
    <div className="dashboard-layout">
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

      <main className="main-content">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Employee Dashboard</h1>
            <p className="page-subtitle">Welcome back! Manage your tasks and view your schedule</p>
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
              <Notification notifications={notifications} />
              <Menu 
                onLogout={onLogout}
                onProfile={() => setActiveNav('profile')}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="employee-stats">
          <div className="stat-card-employee">
            <div className="stat-icon-wrapper stat-blue">
              <i className="bi bi-clock-history"></i>
            </div>
            <div className="stat-content">
              <p className="stat-label">Hours Today</p>
              <p className="stat-value">6.5 hrs</p>
            </div>
          </div>

          <div className="stat-card-employee">
            <div className="stat-icon-wrapper stat-green">
              <i className="bi bi-check-circle"></i>
            </div>
            <div className="stat-content">
              <p className="stat-label">Tasks Completed</p>
              <p className="stat-value">12</p>
            </div>
          </div>

          <div className="stat-card-employee">
            <div className="stat-icon-wrapper stat-orange">
              <i className="bi bi-list-task"></i>
            </div>
            <div className="stat-content">
              <p className="stat-label">Pending Tasks</p>
              <p className="stat-value">5</p>
            </div>
          </div>

          <div className="stat-card-employee">
            <div className="stat-icon-wrapper stat-purple">
              <i className="bi bi-calendar-check"></i>
            </div>
            <div className="stat-content">
              <p className="stat-label">Next Shift</p>
              <p className="stat-value">Tomorrow</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="employee-content-grid">
          {/* Left Column */}
          <div className="employee-left-column">
            {/* Current Tasks */}
            <div className="content-card">
              <div className="card-header">
                <h2 className="card-title">Current Tasks</h2>
                <button className="view-all-btn">View All</button>
              </div>
              <div className="task-list">
                <div className="task-item">
                  <div className="task-checkbox">
                    <input type="checkbox" id="task1" />
                    <label htmlFor="task1"></label>
                  </div>
                  <div className="task-info">
                    <p className="task-name">Clean Table 5</p>
                    <span className="task-time">Due: 2:30 PM</span>
                  </div>
                  <span className="task-priority priority-high">High</span>
                </div>

                <div className="task-item">
                  <div className="task-checkbox">
                    <input type="checkbox" id="task2" />
                    <label htmlFor="task2"></label>
                  </div>
                  <div className="task-info">
                    <p className="task-name">Restock supplies</p>
                    <span className="task-time">Due: 3:00 PM</span>
                  </div>
                  <span className="task-priority priority-medium">Medium</span>
                </div>

                <div className="task-item">
                  <div className="task-checkbox">
                    <input type="checkbox" id="task3" />
                    <label htmlFor="task3"></label>
                  </div>
                  <div className="task-info">
                    <p className="task-name">Check equipment</p>
                    <span className="task-time">Due: 4:00 PM</span>
                  </div>
                  <span className="task-priority priority-low">Low</span>
                </div>

                <div className="task-item completed">
                  <div className="task-checkbox">
                    <input type="checkbox" id="task4" checked />
                    <label htmlFor="task4"></label>
                  </div>
                  <div className="task-info">
                    <p className="task-name">Setup Tables 1-4</p>
                    <span className="task-time">Completed</span>
                  </div>
                  <span className="task-priority priority-done">Done</span>
                </div>
              </div>
            </div>

            {/* Active Tables */}
            <div className="content-card">
              <div className="card-header">
                <h2 className="card-title">Active Tables</h2>
                <span className="badge">8 Active</span>
              </div>
              <div className="active-tables-grid">
                <div className="mini-table-card occupied">
                  <span className="table-number">T1</span>
                  <span className="table-status">Occupied</span>
                </div>
                <div className="mini-table-card occupied">
                  <span className="table-number">T2</span>
                  <span className="table-status">Occupied</span>
                </div>
                <div className="mini-table-card available">
                  <span className="table-number">T3</span>
                  <span className="table-status">Available</span>
                </div>
                <div className="mini-table-card occupied">
                  <span className="table-number">T4</span>
                  <span className="table-status">Occupied</span>
                </div>
                <div className="mini-table-card reserved">
                  <span className="table-number">T5</span>
                  <span className="table-status">Reserved</span>
                </div>
                <div className="mini-table-card available">
                  <span className="table-number">T6</span>
                  <span className="table-status">Available</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="employee-right-column">
            {/* Today's Schedule */}
            <div className="content-card">
              <div className="card-header">
                <h2 className="card-title">Today's Schedule</h2>
              </div>
              <div className="schedule-list">
                <div className="schedule-item current">
                  <div className="schedule-time">
                    <i className="bi bi-clock"></i>
                    <span>2:00 PM - 6:00 PM</span>
                  </div>
                  <p className="schedule-task">Floor Service</p>
                  <span className="schedule-badge current-badge">Current</span>
                </div>

                <div className="schedule-item">
                  <div className="schedule-time">
                    <i className="bi bi-clock"></i>
                    <span>6:00 PM - 6:30 PM</span>
                  </div>
                  <p className="schedule-task">Break Time</p>
                </div>

                <div className="schedule-item">
                  <div className="schedule-time">
                    <i className="bi bi-clock"></i>
                    <span>6:30 PM - 10:00 PM</span>
                  </div>
                  <p className="schedule-task">Closing Duties</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="content-card">
              <div className="card-header">
                <h2 className="card-title">Quick Actions</h2>
              </div>
              <div className="quick-actions-grid">
                <button className="action-btn">
                  <i className="bi bi-clock-history"></i>
                  <span>Clock In/Out</span>
                </button>
                <button className="action-btn">
                  <i className="bi bi-clipboard-check"></i>
                  <span>Report Issue</span>
                </button>
                <button className="action-btn">
                  <i className="bi bi-person-plus"></i>
                  <span>Request Break</span>
                </button>
                <button className="action-btn">
                  <i className="bi bi-calendar2-week"></i>
                  <span>View Schedule</span>
                </button>
              </div>
            </div>

            {/* Performance */}
            <div className="content-card">
              <div className="card-header">
                <h2 className="card-title">This Week</h2>
              </div>
              <div className="performance-stats">
                <div className="performance-item">
                  <span className="performance-label">Total Hours</span>
                  <span className="performance-value">32.5 hrs</span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">Tasks Completed</span>
                  <span className="performance-value">67</span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">Attendance</span>
                  <span className="performance-value">100%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}