import { useEffect, useRef, useState } from "react";
import { eventMediaUrl } from "../../utils/eventMedia";

/**
 * A tournament's pictures and videos, one at a time over the page: arrows (or
 * the arrow keys) move between them, Escape or the backdrop closes it, and
 * focus goes back to `returnFocus` (the picture clicked), since a click does
 * not focus a button in every browser.
 */
export default function EventMediaViewer({ title, media = [], startAt = 0, returnFocus = null, onClose }) {
  const [index, setIndex] = useState(() => Math.min(Math.max(startAt, 0), Math.max(media.length - 1, 0)));
  const closeButton = useRef(null);
  const count = media.length;
  const item = media[index];

  const go = (step) => setIndex((current) => (current + step + count) % count);

  useEffect(() => {
    const opener = returnFocus || document.activeElement;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener !== document.body) opener.focus();
    };
  }, [returnFocus]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" && count > 1) setIndex((current) => (current + 1) % count);
      else if (event.key === "ArrowLeft" && count > 1) setIndex((current) => (current - 1 + count) % count);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [count, onClose]);

  if (!item) return null;

  return (
    <div className="event-viewer" role="dialog" aria-modal="true" aria-label={`${title}: pictures and videos`} onClick={onClose}>
      <div className="event-viewer-frame" onClick={(event) => event.stopPropagation()}>
        <div className="event-viewer-head">
          <strong>{title}</strong>
          {count > 1 && (
            <span>
              {index + 1} / {count}
            </span>
          )}
          <button ref={closeButton} type="button" className="event-viewer-close" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>

        <div className="event-viewer-stage">
          {item.type === "video" ? (
            <video key={item.id} src={eventMediaUrl(item)} controls playsInline preload="metadata" />
          ) : (
            <img key={item.id} src={eventMediaUrl(item)} alt={`${title}, picture ${index + 1} of ${count}`} />
          )}
          {count > 1 && (
            <>
              <button type="button" className="event-viewer-nav is-prev" onClick={() => go(-1)} aria-label="Previous">
                <i className="bi bi-chevron-left" aria-hidden="true"></i>
              </button>
              <button type="button" className="event-viewer-nav is-next" onClick={() => go(1)} aria-label="Next">
                <i className="bi bi-chevron-right" aria-hidden="true"></i>
              </button>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="event-viewer-thumbs">
            {media.map((entry, position) => (
              <button
                key={entry.id}
                type="button"
                className={position === index ? "is-active" : ""}
                onClick={() => setIndex(position)}
                aria-label={`Show ${entry.type === "video" ? "video" : "picture"} ${position + 1}`}
                aria-current={position === index ? "true" : undefined}
              >
                {entry.type === "video" ? (
                  <video src={eventMediaUrl(entry)} muted playsInline preload="metadata" aria-hidden="true" />
                ) : (
                  <img src={eventMediaUrl(entry)} alt="" loading="lazy" />
                )}
                {entry.type === "video" && <i className="bi bi-play-fill" aria-hidden="true"></i>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
