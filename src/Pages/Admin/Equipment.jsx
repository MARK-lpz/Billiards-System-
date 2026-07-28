import { useState } from "react";
import "../../styles/Admin/Equipments.css";
import EquipmentModal from "../../Elements/Admin/EquipmentModal";
import { useNotifications } from "../../Elements/Global/useNotifications";

const todayString = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const emptyEquipmentForm = {
  name: "",
  type: "Cue Stick",
  condition: "good",
  previousMaintenance: "",
  lastMaintenance: "",
  status: "active",
};

export default function Equipment({ equipment, setEquipment }) {
  const { addNotification } = useNotifications();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyEquipmentForm);
  const [editId, setEditId] = useState(null);

  const save = () => {
    if (editId) {
      setEquipment(prev => prev.map(e => e.id === editId ? { ...e, ...form } : e));
      addNotification({ message: `${form.name} equipment details updated.` });
    } else {
      setEquipment(prev => [...prev, { id: Date.now(), ...form }]);
      addNotification({ message: `${form.name} registered as equipment.` });
    }
    setModal(null);
    setEditId(null);
  };

  const recordMaintenanceToday = (id) => {
    const equipmentItem = equipment.find((item) => item.id === id);
    setEquipment((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              previousMaintenance: item.lastMaintenance || item.previousMaintenance || "",
              lastMaintenance: todayString(),
              condition: "good",
              status: "active",
            }
          : item
      )
    );
    addNotification({ message: `Maintenance recorded today for ${equipmentItem?.name || "equipment"}.` });
  };

  const markDamaged = (id) => {
    const equipmentItem = equipment.find((item) => item.id === id);
    setEquipment(prev => prev.map(e => 
      e.id === id ? { ...e, condition: "damaged", status: "repair" } : e
    ));
    addNotification({ message: `${equipmentItem?.name || "Equipment"} marked damaged.` });
  };

  const condIcon = { 
    good: "bi-check-circle-fill", 
    fair: "bi-exclamation-triangle-fill", 
    damaged: "bi-x-circle-fill" 
  };

  const stats = {
    active: equipment.filter(e => e.status === "active").length,
    repair: equipment.filter(e => e.status === "repair").length,
    damaged: equipment.filter(e => e.condition === "damaged").length,
  };

  return (
    <div className="equipment-container">
      {/* Header */}
      <div className="equipment-header">
        <div>
          <h1 className="equipment-title">Equipment Monitoring</h1>
          <p className="equipment-subtitle">Track billiard equipment condition and maintenance</p>
        </div>
        <button 
          className="btn btn-success equipment-add-btn" 
          onClick={() => { 
            setForm(emptyEquipmentForm); 
            setEditId(null); 
            setModal("form"); 
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Register Equipment
        </button>
      </div>

      {/* Summary Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card equipment-stat-card equipment-stat-green">
            <div className="card-body">
              <div className="equipment-stat-value">{stats.active}</div>
              <div className="equipment-stat-label">Active</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card equipment-stat-card equipment-stat-red">
            <div className="card-body">
              <div className="equipment-stat-value">{stats.repair}</div>
              <div className="equipment-stat-label">For Repair</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card equipment-stat-card equipment-stat-yellow">
            <div className="card-body">
              <div className="equipment-stat-value">{stats.damaged}</div>
              <div className="equipment-stat-label">Damaged</div>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="equipment-grid">
        {equipment.map(e => {
          const conditionClass = e.condition === "good" ? "good" : e.condition === "fair" ? "fair" : "damaged";
          const statusClass = e.status === "repair" ? "repair" : "";
          
          return (
            <div key={e.id} className={`card equipment-card ${statusClass}`}>
              <div className="card-body">
                {/* Header */}
                <div className="equipment-card-header">
                  <div>
                    <h6 className="equipment-name">{e.name}</h6>
                    <p className="equipment-type">{e.type}</p>
                  </div>
                  <span className={`badge equipment-badge-${e.status}`}>
                    {e.status}
                  </span>
                </div>

                {/* Info Grid */}
                <div className="equipment-info-grid">
                  <div className="equipment-info-box">
                    <div className="equipment-info-label">Condition</div>
                    <div className={`equipment-condition equipment-condition-${conditionClass}`}>
                      <i className={`bi ${condIcon[e.condition]}`}></i>
                      <span>{e.condition}</span>
                    </div>
                  </div>
                  <div className="equipment-info-box">
                    <div className="equipment-info-label">Previous Maintenance</div>
                    <div className="equipment-maintenance">
                      {e.previousMaintenance || "Not recorded"}
                    </div>
                  </div>
                  <div className="equipment-info-box">
                    <div className="equipment-info-label">Latest Maintenance</div>
                    <div className="equipment-maintenance">
                      {e.lastMaintenance || "Not recorded"}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="equipment-actions">
                  <button 
                    className="btn btn-sm btn-success" 
                    onClick={() => recordMaintenanceToday(e.id)}
                  >
                    <i className="bi bi-calendar-check me-1"></i>
                    Record Today
                  </button>
                  <button 
                    className="btn btn-sm btn-danger" 
                    onClick={() => markDamaged(e.id)}
                  >
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Mark Damaged
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-secondary" 
                    onClick={() => { 
                      setForm(e); 
                      setEditId(e.id); 
                      setModal("form"); 
                    }}
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Equipment Modal */}
      {modal === "form" && (
        <EquipmentModal
          form={form}
          setForm={setForm}
          editId={editId}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
