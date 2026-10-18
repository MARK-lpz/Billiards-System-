import "../../styles/Admin/Website.css";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import GcashSettingsCard from "../../Elements/Admin/website/GcashSettingsCard";
import BusinessSettingsCard from "../../Elements/Admin/website/BusinessSettingsCard";
import AnnouncementSettingsCard from "../../Elements/Admin/website/AnnouncementSettingsCard";
import HoursSettingsCard from "../../Elements/Admin/website/HoursSettingsCard";

/**
 * Admin > Website: what customers see on breakandchill.com that is not a
 * tournament (Events) or a table (Pool Tables). Each card saves on its own.
 * Saved to the server (api/site_settings.php), which the website reads.
 */
export default function Website({ reservations = [], setLogs }) {
  const { loaded, failed } = useSiteSettings();

  return (
    <div className="website-page">
      <div className="website-header">
        <h1 className="page-title">Website</h1>
        <p className="page-subtitle">
          What customers see on breakandchill.com. Tournaments are set in Events, and tables and rates in Pool Tables.
        </p>
      </div>

      {!loaded ? (
        <p className={`website-loading ${failed ? "error" : ""}`} role="status">
          {failed ? "Could not reach the server. Trying again every minute..." : "Loading the website settings..."}
        </p>
      ) : (
        <>
          <GcashSettingsCard setLogs={setLogs} />
          <AnnouncementSettingsCard setLogs={setLogs} />
          <BusinessSettingsCard setLogs={setLogs} />
          <HoursSettingsCard reservations={reservations} setLogs={setLogs} />
        </>
      )}
    </div>
  );
}
