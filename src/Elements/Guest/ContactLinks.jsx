import { telLink } from "../../utils/siteSettings";

/**
 * Big buttons to find and reach the hall: Open in Maps, Call and Message us,
 * for whichever the admin has set (Admin > Website), in a `className` row.
 * Nothing shows when none is set.
 */
export default function ContactLinks({ business, className }) {
  const links = [
    business.mapsUrl && { key: "maps", href: business.mapsUrl, icon: "bi-map", label: "Open in Maps", external: true },
    business.phone && { key: "call", href: telLink(business.phone), icon: "bi-telephone", label: "Call", external: false },
    business.facebookUrl && { key: "message", href: business.facebookUrl, icon: "bi-messenger", label: "Message us", external: true },
  ].filter(Boolean);
  if (links.length === 0) return null;

  return (
    <div className={className}>
      {links.map((link) => (
        <a
          key={link.key}
          className="guest-template-secondary"
          href={link.href}
          {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <i className={`bi ${link.icon}`} aria-hidden="true"></i>
          {link.label}
        </a>
      ))}
    </div>
  );
}
