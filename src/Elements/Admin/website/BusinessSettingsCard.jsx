import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";

// A first look while typing; the server checks the links fully on Save.
const linkWarning = (url, example) =>
  url && !/^https:\/\//i.test(url) ? `Paste the whole link, starting with https:// (e.g. ${example}).` : "";

/**
 * Where the hall is and how to reach it, shown in Visit us on the website's
 * home page: the address, the Google Maps link (Open in Maps), a contact number
 * (Call) and the Facebook page or Messenger link (Message us). Each is optional.
 */
export default function BusinessSettingsCard({ setLogs }) {
  const draft = useSiteSectionDraft({
    section: "business",
    label: "business info",
    fieldLabels: { address: "address", mapsUrl: "Google Maps link", phone: "contact number", facebookUrl: "Facebook link" },
    setLogs,
  });
  const { address, mapsUrl, phone, facebookUrl } = draft.draft;
  const mapsWarning = linkWarning(mapsUrl, "https://maps.app.goo.gl/...");
  const facebookWarning = linkWarning(facebookUrl, "https://www.facebook.com/...");
  const filled = [address, mapsUrl, phone, facebookUrl].filter(Boolean).length;

  return (
    <SiteCard
      icon="bi-geo-alt"
      title="Business info"
      description="Shown in Visit us on the home page, so customers can find and reach the hall."
      chip={filled ? { tone: "on", label: `${filled} of 4 set` } : { tone: "off", label: "Not set" }}
      draft={draft}
    >
      <div className="website-fields website-fields-grid">
        <label className="website-field website-field-wide">
          Address
          <input
            type="text"
            value={address || ""}
            maxLength={200}
            placeholder="Street, barangay, city"
            onChange={(event) => draft.update("address", event.target.value)}
          />
        </label>
        <label className="website-field">
          Google Maps link
          <input
            type="url"
            value={mapsUrl || ""}
            placeholder="https://maps.app.goo.gl/..."
            onChange={(event) => draft.update("mapsUrl", event.target.value.trim())}
          />
          {mapsWarning ? <em className="error">{mapsWarning}</em> : <em>In Google Maps, open the hall, tap Share, then Copy link.</em>}
        </label>
        <label className="website-field">
          Contact number
          <input
            type="tel"
            value={phone || ""}
            maxLength={20}
            placeholder="0917 123 4567"
            onChange={(event) => draft.update("phone", event.target.value.replace(/[^0-9 +()-]/g, ""))}
          />
          <em>Mobile or landline. Customers can tap Call.</em>
        </label>
        <label className="website-field website-field-wide">
          Facebook page or Messenger link
          <input
            type="url"
            value={facebookUrl || ""}
            placeholder="https://www.facebook.com/... or https://m.me/..."
            onChange={(event) => draft.update("facebookUrl", event.target.value.trim())}
          />
          {facebookWarning ? <em className="error">{facebookWarning}</em> : <em>Customers can tap Message us.</em>}
        </label>
      </div>
    </SiteCard>
  );
}
