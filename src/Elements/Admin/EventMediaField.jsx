import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_EVENT_MEDIA_LIMITS,
  EVENT_MEDIA_ACCEPT,
  eventMediaUrl,
  fetchEventMediaLimits,
  formatMegabytes,
  getMediaKind,
  prepareImage,
  uploadEventMedia,
} from "../../utils/eventMedia";

// Each upload's key; kept outside the component, like other ids made on the fly.
let uploadCount = 0;
const nextUploadKey = () => `upload-${(uploadCount += 1)}`;

const UNUSABLE = "can't be used. Use JPG, PNG, WebP or GIF pictures, or MP4 or WebM videos.";

/**
 * Promo pictures and videos in the tournament form. Files upload as soon as
 * they are picked (with progress); the first finished one is the cover, and
 * any other can be made the cover or removed. `media` is the saved list,
 * changed through `setMedia(update)`; `uploads` (owned by the form) are the
 * ones still on their way, so Save can wait for them.
 */
export default function EventMediaField({ media = [], setMedia, uploads = [], setUploads }) {
  const [limits, setLimits] = useState(DEFAULT_EVENT_MEDIA_LIMITS);
  // What went wrong with the last files picked (too many, or a kind that can't be used).
  const [notice, setNotice] = useState([]);
  const running = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    fetchEventMediaLimits()
      .then((next) => {
        if (!cancelled) setLimits(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Closing the form stops uploads still running and frees their previews.
  useEffect(() => {
    const live = running.current;
    return () => {
      live.forEach(({ abort, preview }) => {
        abort?.();
        URL.revokeObjectURL(preview);
      });
      live.clear();
    };
  }, []);

  const inFlight = uploads.filter((upload) => upload.status !== "error").length;
  const room = limits.perEvent - media.length - inFlight;

  const updateUpload = (key, changes) =>
    setUploads((previous) => previous.map((upload) => (upload.key === key ? { ...upload, ...changes } : upload)));

  const dropUpload = (key) => {
    const entry = running.current.get(key);
    if (entry) URL.revokeObjectURL(entry.preview);
    running.current.delete(key);
    setUploads((previous) => previous.filter((upload) => upload.key !== key));
  };

  const send = async (key, file, kind) => {
    let ready = file;
    if (kind === "image") ready = await prepareImage(file);

    const max = kind === "image" ? limits.imageMaxBytes : limits.videoMaxBytes;
    if (ready.size > max) {
      updateUpload(key, {
        status: "error",
        message: `${file.name} is ${formatMegabytes(ready.size)}. ${kind === "image" ? "Pictures" : "Videos"} can be up to ${formatMegabytes(max)}.`,
      });
      return;
    }

    const { promise, abort } = uploadEventMedia(ready, (progress) => updateUpload(key, { status: "uploading", progress }));
    const entry = running.current.get(key);
    if (!entry) {
      abort();
      return;
    }
    entry.abort = abort;
    updateUpload(key, { status: "uploading", progress: 0 });

    try {
      const saved = await promise;
      setMedia((previous) => [...previous, saved]);
      dropUpload(key);
    } catch (error) {
      if (running.current.has(key)) updateUpload(key, { status: "error", message: `${file.name}: ${error.message}` });
    }
  };

  const pick = (fileList) => {
    const problems = [];
    const accepted = [];
    let skipped = 0;
    [...fileList].forEach((file) => {
      const kind = getMediaKind(file);
      if (!kind) problems.push(`${file.name} ${UNUSABLE}`);
      else if (!file.size) problems.push(`${file.name} is empty.`);
      else if (accepted.length >= room) skipped += 1;
      else accepted.push({ file, kind });
    });
    if (skipped) {
      problems.push(
        `Only ${limits.perEvent} pictures or videos per tournament, so ${skipped} ${skipped === 1 ? "was" : "were"} not added.`
      );
    }
    setNotice(problems);

    const started = accepted.map(({ file, kind }) => {
      const key = nextUploadKey();
      const preview = URL.createObjectURL(file);
      running.current.set(key, { preview, abort: null });
      return { key, file, kind, preview };
    });
    if (!started.length) return;
    setUploads((previous) => [
      ...previous,
      ...started.map(({ key, file, kind, preview }) => ({ key, name: file.name, kind, preview, status: "preparing", progress: 0 })),
    ]);
    started.forEach(({ key, file, kind }) => send(key, file, kind));
  };

  const makeCover = (id) =>
    setMedia((previous) => {
      const chosen = previous.find((item) => item.id === id);
      return chosen ? [chosen, ...previous.filter((item) => item.id !== id)] : previous;
    });

  const remove = (id) => setMedia((previous) => previous.filter((item) => item.id !== id));

  return (
    <div className="event-media-field">
      <div className="event-media-head">
        <span className="form-label" id="event-media-label">
          Promo pictures &amp; videos
        </span>
        <span className="event-media-count">
          {media.length} of {limits.perEvent}
        </span>
      </div>
      <p className="event-media-hint">
        The first one is the cover on the website&apos;s slideshow and Tournaments page. Pictures up to{" "}
        {formatMegabytes(limits.imageMaxBytes)}, videos (MP4, WebM) up to {formatMegabytes(limits.videoMaxBytes)}.
      </p>

      <div className="event-media-grid" aria-labelledby="event-media-label">
        {media.map((item, index) => (
          <figure key={item.id} className={`event-media-tile ${index === 0 ? "is-cover" : ""}`}>
            {item.type === "video" ? (
              <video src={eventMediaUrl(item)} muted playsInline preload="metadata" aria-label={`Video ${index + 1}`} />
            ) : (
              <img src={eventMediaUrl(item)} alt={`Picture ${index + 1}`} />
            )}
            {item.type === "video" && <i className="bi bi-play-circle-fill event-media-play" aria-hidden="true"></i>}
            {index === 0 && <span className="event-media-cover">Cover</span>}
            <div className="event-media-actions">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => makeCover(item.id)}
                  aria-label={`Make ${item.type} ${index + 1} the cover`}
                  title="Make this the cover"
                >
                  <i className="bi bi-star-fill"></i>
                </button>
              )}
              <button
                type="button"
                className="is-remove"
                onClick={() => remove(item.id)}
                aria-label={`Remove ${item.type} ${index + 1}`}
                title="Remove"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          </figure>
        ))}

        {uploads.map((upload) => (
          <figure key={upload.key} className={`event-media-tile is-${upload.status}`}>
            {upload.kind === "video" ? (
              <video src={upload.preview} muted playsInline preload="metadata" aria-hidden="true" />
            ) : (
              <img src={upload.preview} alt="" />
            )}
            {upload.status === "error" ? (
              <div className="event-media-error" role="alert">
                <span>{upload.message}</span>
                <button type="button" onClick={() => dropUpload(upload.key)} aria-label={`Dismiss ${upload.name}`}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            ) : (
              <div className="event-media-progress" role="status">
                <span>{upload.status === "preparing" ? "Preparing…" : `Uploading ${upload.progress}%`}</span>
                <span className="event-media-bar">
                  <span style={{ width: `${upload.status === "preparing" ? 4 : upload.progress}%` }}></span>
                </span>
              </div>
            )}
          </figure>
        ))}

        {room > 0 && (
          <label className="event-media-add">
            <input
              id="event-media-input"
              type="file"
              accept={EVENT_MEDIA_ACCEPT}
              multiple
              onChange={(event) => {
                pick(event.target.files || []);
                event.target.value = "";
              }}
            />
            <i className="bi bi-cloud-arrow-up" aria-hidden="true"></i>
            <span>Add pictures or videos</span>
          </label>
        )}
      </div>

      {notice.length > 0 && (
        <div className="form-field-error event-media-notice" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
          <span>{notice.join(" ")}</span>
        </div>
      )}
    </div>
  );
}
