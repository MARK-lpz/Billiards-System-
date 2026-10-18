import { useCallback, useRef, useState } from "react";
import "../../styles/Admin/Website.css";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import { WebsiteTabsContext } from "../../Elements/Admin/website/WebsiteTabsContext";
import GcashSettingsCard from "../../Elements/Admin/website/GcashSettingsCard";
import BusinessSettingsCard from "../../Elements/Admin/website/BusinessSettingsCard";
import AnnouncementSettingsCard from "../../Elements/Admin/website/AnnouncementSettingsCard";
import HoursSettingsCard from "../../Elements/Admin/website/HoursSettingsCard";
import ShowcaseSettingsCard from "../../Elements/Admin/website/ShowcaseSettingsCard";
import BookingStepsSettingsCard from "../../Elements/Admin/website/BookingStepsSettingsCard";
import FooterSettingsCard from "../../Elements/Admin/website/FooterSettingsCard";

// One tab per section of the website's settings; `id` is the section's name.
const SECTIONS = [
  { id: "gcash", label: "GCash", icon: "bi-phone", Card: GcashSettingsCard },
  { id: "announcement", label: "Announcement", icon: "bi-megaphone", Card: AnnouncementSettingsCard },
  { id: "business", label: "Business info", icon: "bi-geo-alt", Card: BusinessSettingsCard },
  { id: "hours", label: "Opening hours", icon: "bi-clock", Card: HoursSettingsCard },
  { id: "showcase", label: "Slides", icon: "bi-images", Card: ShowcaseSettingsCard },
  { id: "bookingSteps", label: "Booking steps", icon: "bi-list-ol", Card: BookingStepsSettingsCard },
  { id: "footer", label: "Footer", icon: "bi-layout-text-window-reverse", Card: FooterSettingsCard },
];

// The tab last open, kept in this browser only.
const TAB_KEY = "adminWebsiteTab";
const readTab = () => {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return SECTIONS.some((section) => section.id === saved) ? saved : SECTIONS[0].id;
  } catch {
    return SECTIONS[0].id;
  }
};

/**
 * Admin > Website: what customers see on breakandchill.com that is not a
 * tournament (Events) or a table (Pool Tables), one section per tab. Every
 * card stays mounted, so changes not saved yet survive a change of tab; the
 * tab shows a dot while its card has them. Saved to the server
 * (api/site_settings.php), which the website reads.
 */
export default function Website({ reservations = [], setLogs }) {
  const { loaded, failed } = useSiteSettings();
  const [active, setActive] = useState(readTab);
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
      localStorage.setItem(TAB_KEY, id);
    } catch {
      // Storage may be blocked; the tab still opens.
    }
  };

  // Left and right arrows move along the tabs, as in any tab list.
  const moveWithKeys = (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = SECTIONS.findIndex((section) => section.id === active);
    choose(SECTIONS[(index + step + SECTIONS.length) % SECTIONS.length].id, true);
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
      <div className="website-tabs" role="tablist" aria-label="Website settings" onKeyDown={moveWithKeys}>
        {SECTIONS.map(({ id, label, icon }) => (
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
            {unsaved[id] && (
              <span className="website-tab-dot" title="Not saved yet">
                <span className="website-sr-only">(not saved yet)</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <WebsiteTabsContext.Provider value={reportDirty}>
        {SECTIONS.map((section) => {
          const { id, Card } = section;
          return (
            <div key={id} role="tabpanel" id={`website-panel-${id}`} aria-labelledby={`website-tab-${id}`} hidden={active !== id}>
              <Card reservations={reservations} setLogs={setLogs} />
            </div>
          );
        })}
      </WebsiteTabsContext.Provider>
    </div>
  );
}
