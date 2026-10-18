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
  const name = accountName?.trim() || "";

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
      preview={
        qr && name ? (
          <div className="website-gcash-preview">
            <img src={gcashQrUrl({ qr })} alt="The GCash QR customers will scan" />
            <p>
              Pay to <strong>{name}</strong>
            </p>
            {number && isValidSmsNumber(number) && (
              <p>
                GCash number <strong>{formatMobile(number)}</strong>
              </p>
            )}
          </div>
        ) : (
          <p className="website-preview-empty">
            &ldquo;Online payment is not available yet. Please pay at the hall.&rdquo; Bookings and paid tournament sign-ups
            wait until the QR and the account name are saved.
          </p>
        )
      }
    >
      {!ready && (
        <p className="website-note warning">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
          Until the QR and the account name are saved, the website takes no online bookings or paid tournament
          registrations.
        </p>
      )}

      <div className="website-fields">
        <div className="website-field">
          QR picture
          <div className="website-upload">
            <div className="website-thumb is-qr">
              {qr ? <img src={gcashQrUrl({ qr })} alt="" /> : <i className="bi bi-qr-code" aria-hidden="true"></i>}
            </div>
            <div className="website-upload-side">
              <div className="website-inline-actions">
                <button type="button" className="website-btn secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
                  <i className="bi bi-upload" aria-hidden="true"></i>
                  {qr ? "Replace QR" : "Upload QR"}
                </button>
                {qr && (
                  <button type="button" className="website-btn ghost" onClick={() => draft.update("qr", null)}>
                    Remove
                  </button>
                )}
              </div>
              <input ref={fileInput} type="file" accept={QR_TYPES.join(",")} onChange={pickQr} hidden />
              {uploading ? (
                <em>Uploading... {upload.progress}%</em>
              ) : upload?.error ? (
                <em className="error">{upload.error}</em>
              ) : (
                <em>In the GCash app: Receive, then Download QR. Upload that picture here.</em>
              )}
            </div>
          </div>
        </div>
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
      </div>
    </SiteCard>
  );
}
