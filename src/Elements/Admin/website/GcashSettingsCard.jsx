import { useRef, useState } from "react";
import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";
import { uploadEventMedia } from "../../../utils/eventMedia";
import { formatMobile, gcashQrUrl } from "../../../utils/siteSettings";
import { isValidSmsNumber, sanitizePhoneInput } from "../../../utils/phone";

// The QR is a picture customers scan: no GIFs or videos.
const QR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const isQrPicture = (file) => QR_TYPES.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name || "");

/**
 * The GCash account customers pay into: the QR from the hall's GCash app
 * (Receive, then Download QR), the account name they check before sending, and
 * the number (optional). Online payment is on only once the QR and the name
 * are saved; until then the website takes no paid bookings or registrations.
 */
export default function GcashSettingsCard({ setLogs }) {
  const draft = useSiteSectionDraft({
    section: "gcash",
    label: "GCash",
    fieldLabels: { accountName: "account name", number: "GCash number", qr: "QR picture" },
    setLogs,
  });
  const { accountName, number, qr } = draft.draft;
  // { progress } while uploading, { error } when it failed.
  const [upload, setUpload] = useState(null);
  const uploading = upload?.progress !== undefined;
  const fileInput = useRef(null);
  const numberWarning = number && !isValidSmsNumber(number) ? "Enter the 11-digit GCash number, 09XXXXXXXXX." : "";
  const ready = draft.saved.ready;

  const pickQr = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isQrPicture(file)) {
      setUpload({ error: "Use a PNG, JPG or WebP picture of the QR." });
      return;
    }
    setUpload({ progress: 0 });
    try {
      // Uploaded as it is: scaling or recompressing a QR can make it harder to scan.
      const media = await uploadEventMedia(file, (progress) => setUpload({ progress })).promise;
      draft.update("qr", { path: media.path, type: "image" });
      setUpload(null);
    } catch (error) {
      setUpload({ error: error.message });
    }
  };

  return (
    <SiteCard
      icon="bi-phone"
      title="GCash"
      description="The account customers pay into when they book a table or join a paid tournament online."
      chip={ready ? { tone: "on", label: "Online payment on" } : { tone: "off", label: "Online payment off" }}
      draft={draft}
    >
      {!ready && (
        <p className="website-note warning">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
          Until the QR and the account name are saved, the website takes no online bookings or paid tournament
          registrations.
        </p>
      )}

      <div className="website-gcash">
        <div className="website-qr">
          {qr ? (
            <img src={gcashQrUrl({ qr })} alt="The GCash QR customers will scan" />
          ) : (
            <div className="website-qr-empty">
              <i className="bi bi-qr-code" aria-hidden="true"></i>
              No QR yet
            </div>
          )}
          <div className="website-qr-actions">
            <button type="button" className="website-btn secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <i className="bi bi-upload" aria-hidden="true"></i>
              {qr ? "Replace QR" : "Upload QR"}
            </button>
            <input ref={fileInput} type="file" accept={QR_TYPES.join(",")} onChange={pickQr} hidden />
            {qr && (
              <button type="button" className="website-btn ghost" onClick={() => draft.update("qr", null)}>
                Remove
              </button>
            )}
          </div>
          {uploading && <p className="website-hint">Uploading... {upload.progress}%</p>}
          {upload?.error && <p className="website-hint error">{upload.error}</p>}
          <p className="website-hint">In the GCash app: Receive, then Download QR. Upload that picture here.</p>
        </div>

        <div className="website-fields">
          <label className="website-field">
            Account name
            <input
              type="text"
              value={accountName || ""}
              maxLength={60}
              placeholder="As GCash shows it, e.g. JU** D** C."
              onChange={(event) => draft.update("accountName", event.target.value)}
            />
            <em>Customers check this name before they send.</em>
          </label>
          <label className="website-field">
            <span>
              GCash number <span className="website-optional">(optional)</span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={number || ""}
              maxLength={11}
              placeholder="09XXXXXXXXX"
              onChange={(event) => draft.update("number", sanitizePhoneInput(event.target.value))}
            />
            {numberWarning ? <em className="error">{numberWarning}</em> : <em>Lets customers send without scanning.</em>}
          </label>

          <div className="website-preview" aria-label="What customers see">
            <span className="website-preview-label">Customers see</span>
            <p>
              Pay to <strong>{accountName?.trim() || "(account name)"}</strong>
              {number && isValidSmsNumber(number) ? ` · ${formatMobile(number)}` : ""}
            </p>
          </div>
        </div>
      </div>
    </SiteCard>
  );
}
