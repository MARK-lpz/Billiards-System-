import { useSiteSettings } from "../Global/useSiteSettings";
import { facebookLinkKind } from "../../utils/siteSettings";
import { formatOpeningHours } from "../../utils/reservations";

/**
 * The public pages' footer: the hall's name, its line (Admin > Website, blank
 * until the server answers so the old one never flashes first), the hours and
 * the Facebook link once it is set.
 */
export default function GuestFooter() {
  const { settings, loaded, failed } = useSiteSettings();
  const { footer, hours, business } = settings;
  const facebook = business.facebookUrl ? facebookLinkKind(business.facebookUrl) : null;

  return (
    <footer className="guest-template-footer">
      <span className="guest-footer-mark">
        Break &amp; Chill <small>Billiard Hall</small>
      </span>
      {footer.tagline && (
        <span className={`guest-footer-tagline ${loaded || failed ? "" : "is-loading"}`}>{footer.tagline}</span>
      )}
      <span className="guest-footer-end">
        <span className="guest-footer-hours">Open {formatOpeningHours(hours)}</span>
        {facebook && (
          <a className="guest-footer-social" href={business.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label={facebook.label}>
            <i className={`bi ${facebook.icon}`} aria-hidden="true"></i>
          </a>
        )}
      </span>
    </footer>
  );
}
