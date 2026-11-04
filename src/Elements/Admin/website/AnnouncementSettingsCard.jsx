import { useRef, useState } from "react";
import "../../../styles/Guest/Announcement.css";
import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";
import useClock from "../../Global/useClock";
import { ANNOUNCEMENT_MAX_LENGTH, isAnnouncementShowing } from "../../../utils/siteSettings";
import { eventMediaUrl, prepareImage, uploadEventMedia } from "../../../utils/eventMedia";
import { formatReservationDate } from "../../../utils/reservations";
import { readTextField } from "../../../utils/textField";

const dayInManila = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const isPhoto = (file) => PHOTO_TYPES.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name || "");
// The picture is about 500px wide on a computer; a smaller one looks soft.
const SHARP_WIDTH = 700;

// Where a saved announcement stands today.
const describeState = (announcement, today) => {
  if (!announcement.enabled || !String(announcement.message || "").trim()) return { tone: "off", label: "Off" };
  if (isAnnouncementShowing(announcement, today)) return { tone: "on", label: "Showing now" };
  if (announcement.startDate && announcement.startDate > today) {
    return { tone: "wait", label: `Starts ${formatReservationDate(announcement.startDate)}` };
  }
  return { tone: "off", label: "Ended" };
};

/**
 * The hall's announcement, e.g. "Closed on November 1 for the holiday", on the
 * website's Announcements page, the home page and the booking forms. It shows
 * while it is on and inside its dates; leave a date empty to have no limit on
 * that side. Its picture (optional) shows beside the announcements on the home
 * page; without one, a tournament's poster or the green felt does. Pictures are
 * made smaller before upload, which also drops the camera's details.
 */
export default function AnnouncementSettingsCard({ setLogs }) {
  const draft = useSiteSectionDraft({
    section: "announcement",
    label: "announcement",
    fieldLabels: { enabled: "on/off", message: "message", startDate: "first day", endDate: "last day", image: "picture" },
    setLogs,
  });
  const { enabled, message, startDate, endDate, image } = draft.draft;
  const today = dayInManila(useClock(60000));
  const text = message || "";
  // { progress } while uploading, { error } when it failed, { warning } when the picture is small.
  const [upload, setUpload] = useState(null);
  const uploading = upload?.progress !== undefined;
  const fileInput = useRef(null);

  const pickPicture = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isPhoto(file)) {
      setUpload({ error: "Use a JPG, PNG or WebP picture." });
      return;
    }
    setUpload({ progress: 0 });
    try {
      const ready = await prepareImage(file);
      const media = await uploadEventMedia(ready, (progress) => setUpload({ progress })).promise;
      draft.update("image", { path: media.path, type: "image" });
      setUpload(
        media.width && media.width < SHARP_WIDTH
          ? { warning: `This picture is only ${media.width}px wide, so it may look blurry on a computer. Use a bigger one if you have it.` }
          : null
      );
    } catch (error) {
      setUpload({ error: error.message });
    }
  };

  return (
    <SiteCard
      icon="bi-megaphone"
      title="Announcement"
      description="A short notice on the website, such as a holiday closing or a promo, with a picture if you like."
      chip={describeState(draft.saved, today)}
      draft={draft}
      blocked={uploading ? "Wait for the picture to finish uploading." : ""}
      previewDark
      preview={
        enabled && text.trim() ? (
          <>
            <div className="guest-announcement is-in-card">
              <i className="bi bi-megaphone-fill" aria-hidden="true"></i>
              <p>{text}</p>
            </div>
            {image && <img className="website-announcement-picture" src={eventMediaUrl(image)} alt="" />}
          </>
        ) : (
          <p className="website-preview-empty">Nothing: the announcement is off.</p>
        )
      }
    >
      <input ref={fileInput} type="file" accept={PHOTO_TYPES.join(",")} onChange={pickPicture} hidden />
      <div className="website-fields">
        <label className="website-switch">
          <input type="checkbox" checked={Boolean(enabled)} onChange={(event) => draft.update("enabled", event.target.checked)} />
          <span>Show it on the website</span>
        </label>
        <label className="website-field">
          Message
          <textarea
            rows={2}
            value={text}
            maxLength={ANNOUNCEMENT_MAX_LENGTH}
            placeholder="e.g. We are closed on November 1. See you on November 2!"
            onChange={(event) => draft.update("message", readTextField(event).replace(/\s*\n\s*/g, " "))}
          />
          <em>
            {text.length}/{ANNOUNCEMENT_MAX_LENGTH} characters
          </em>
        </label>
        <div className="website-fields-row">
          <label className="website-field">
            <span>
              First day <span className="website-optional">(optional)</span>
            </span>
            <input type="date" value={startDate || ""} onChange={(event) => draft.update("startDate", event.target.value)} />
          </label>
          <label className="website-field">
            <span>
              Last day <span className="website-optional">(optional)</span>
            </span>
            <input type="date" value={endDate || ""} min={startDate || undefined} onChange={(event) => draft.update("endDate", event.target.value)} />
          </label>
        </div>
        <div className="website-field">
          <span>
            Picture <span className="website-optional">(optional)</span>
          </span>
          <div className="website-slide-photo">
            <button type="button" className="website-btn secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <i className="bi bi-upload" aria-hidden="true"></i>
              {image ? "Replace picture" : "Upload picture"}
            </button>
            {image && (
              <button type="button" className="website-btn ghost" onClick={() => draft.update("image", null)} disabled={uploading}>
                Remove picture
              </button>
            )}
          </div>
          {uploading ? (
            <em>Uploading... {upload.progress}%</em>
          ) : upload?.error ? (
            <em className="error">{upload.error}</em>
          ) : upload?.warning ? (
            <em className="warning">{upload.warning}</em>
          ) : (
            <em>
              Shows beside the announcements on the home page.
              {image ? "" : " None yet: a tournament's poster or the green felt shows there."} JPG, PNG or WebP.
            </em>
          )}
        </div>
      </div>
    </SiteCard>
  );
}
