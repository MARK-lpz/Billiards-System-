import { useCallback, useRef, useState } from "react";
import "../../styles/Admin/Website.css";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import { WebsiteStaffContext, WebsiteTabsContext } from "../../Elements/Admin/website/WebsiteTabsContext";
import GcashSettingsCard from "../../Elements/Admin/website/GcashSettingsCard";
import AboutSettingsCard from "../../Elements/Admin/website/AboutSettingsCard";
import BusinessSettingsCard from "../../Elements/Admin/website/BusinessSettingsCard";
import AnnouncementSettingsCard from "../../Elements/Admin/website/AnnouncementSettingsCard";
import HoursSettingsCard from "../../Elements/Admin/website/HoursSettingsCard";
import ShowcaseSettingsCard from "../../Elements/Admin/website/ShowcaseSettingsCard";
import BookingStepsSettingsCard from "../../Elements/Admin/website/BookingStepsSettingsCard";
import FooterSettingsCard from "../../Elements/Admin/website/FooterSettingsCard";
import OnlineReservationsSwitch from "../../Elements/Admin/website/OnlineReservationsSwitch";

// One tab per part of the website; each card in it saves one section of the
// settings (`sections`, in the cards' order). About us holds the three the home
// page shows together: the words, the address and contacts, and the hours.
const SECTIONS = [
  { id: "gcash", label: "GCash", icon: "bi-phone", sections: ["gcash"], Cards: [GcashSettingsCard] },
  { id: "announcement", label: "Announcement", icon: "bi-megaphone", sections: ["announcement"], Cards: [AnnouncementSettingsCard] },
  {
    id: "about",
    label: "About us",
    icon: "bi-info-circle",
    sections: ["about", "business", "hours"],
    Cards: [AboutSettingsCard, BusinessSettingsCard, HoursSettingsCard],
  },
  { id: "showcase", label: "Slides", icon: "bi-images", sections: ["showcase"], Cards: [ShowcaseSettingsCard] },
  { id: "bookingSteps", label: "Booking steps", icon: "bi-list-ol", sections: ["bookingSteps"], Cards: [BookingStepsSettingsCard] },
  { id: "footer", label: "Footer", icon: "bi-layout-text-window-reverse", sections: ["footer"], Cards: [FooterSettingsCard] },
];

// The tab that holds `id`, a tab or a section ("hours" is in About us).
const tabOf = (shown, id) => shown.find((tab) => tab.id === id || tab.sections.includes(id))?.id;

// The tab last open, kept in this browser only: one for the admin
// ("adminWebsiteTab"), one for the employee.
const tabKey = (staff) => `${staff.toLowerCase()}WebsiteTab`;
const readTab = (staff, shown) => {
  try {
    return tabOf(shown, localStorage.getItem(tabKey(staff))) || shown[0].id;
  } catch {
    return shown[0].id;
  }
};

/**
 * Admin > Website: what customers see on breakandchill.online that is not a
 * tournament (Events) or a table (Pool Tables), one section per tab. Every
 * card stays mounted, so changes not saved yet survive a change of tab; the
 * tab shows a dot while its card has them. Saved to the server
 * (api/site_settings.php), which the website reads.
 *
 * The employee's Website page is this one with `only` the sections it sees
 * (the GCash details, to check only, and the slides it changes) and `staff`
 * "Employee", who the Audit Trail names. `openTab` opens a tab (the admin's bell, on a GCash change).
 * On the right of the tabs, on both: the Online reservations switch
 * (`bookings`: { open, status, updating, onChange }; closing asks why and until when first).
 */
export default function Website({ reservations = [], setLogs, only = null, staff = "Admin", openTab = null, bookings = null }) {
  const { loaded, failed } = useSiteSettings();
  const shown = only ? SECTIONS.filter((section) => only.includes(section.id)) : SECTIONS;
  const [active, setActive] = useState(() => tabOf(shown, openTab) || readTab(staff, shown));
  const [unsaved, setUnsaved] = useState({});
  const tabs = useRef({});

  const reportDirty = useCallback(
    (section, dirty) => setUnsaved((previous) => (Boolean(previous[section]) === dirty ? previous : { ...previous, [section]: dirty })),
    []
  );

  const choose = (id, focus = false) => {
    setActive(id);
    if (focus) tabs.current[id]?.focus();
    try {
      localStorage.setItem(tabKey(staff), id);
    } catch {
      // Storage may be blocked; the tab still opens.
    }
  };

  // Left and right arrows move along the tabs, as in any tab list.
  const moveWithKeys = (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = shown.findIndex((section) => section.id === active);
    choose(shown[(index + step + shown.length) % shown.length].id, true);
  };

  if (!loaded) {
    return (
      <div className="website-page">
        <p className={`website-loading ${failed ? "error" : ""}`} role="status">
          {failed ? "Could not reach the server. Trying again every minute..." : "Loading the website settings..."}
        </p>
      </div>
    );
  }

  return (
    <div className="website-page">
      <div className="website-head">
        <div className="website-tabs" role="tablist" aria-label="Website settings" onKeyDown={moveWithKeys}>
          {shown.map(({ id, label, icon, sections }) => (
            <button
              key={id}
              ref={(element) => {
                tabs.current[id] = element;
              }}
              type="button"
              role="tab"
              id={`website-tab-${id}`}
              aria-selected={active === id}
              aria-controls={`website-panel-${id}`}
              tabIndex={active === id ? 0 : -1}
              className={`website-tab ${active === id ? "active" : ""}`}
              onClick={() => choose(id)}
            >
              <i className={`bi ${icon}`} aria-hidden="true"></i>
              {label}
              {sections.some((section) => unsaved[section]) && (
                <span className="website-tab-dot" title="Not saved yet">
                  <span className="website-sr-only">(not saved yet)</span>
                </span>
              )}
            </button>
          ))}
        </div>
        {bookings && <OnlineReservationsSwitch {...bookings} staff={staff} setLogs={setLogs} />}
      </div>

      <WebsiteStaffContext.Provider value={staff}>
        <WebsiteTabsContext.Provider value={reportDirty}>
          {shown.map(({ id, sections, Cards }) => (
            <div
              key={id}
              role="tabpanel"
              id={`website-panel-${id}`}
              aria-labelledby={`website-tab-${id}`}
              className="website-panel"
              hidden={active !== id}
            >
              {Cards.map((Card, index) => (
                <Card key={sections[index]} reservations={reservations} setLogs={setLogs} />
              ))}
            </div>
          ))}
        </WebsiteTabsContext.Provider>
      </WebsiteStaffContext.Provider>
    </div>
  );
}
