export default function TaskList() {
  return (
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
            <input type="checkbox" id="task4" checked readOnly />
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
  );
}