import { useRef, useState } from "react";
import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";
import { prepareImage, uploadEventMedia } from "../../../utils/eventMedia";
import {
  DEFAULT_SITE_SETTINGS,
  SHOWCASE_SLIDES_MAX,
  SLIDE_POSITIONS,
  SLIDE_TEXT_MAX_LENGTH,
  SLIDE_TITLE_MAX_LENGTH,
  slidePictureUrl,
} from "../../../utils/siteSettings";

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const isPhoto = (file) => PHOTO_TYPES.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name || "");
// The showcase is about 1000px wide; a smaller photo looks soft on a computer.
const SHARP_WIDTH = 1000;

const newSlideId = () => `slide-${Math.random().toString(36).slice(2, 10)}`;
const oneLine = (text) => text.replace(/\s*\n\s*/g, " ");

// "title", "title and photo", "title, text and photo"
const listWords = (words) => (words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0]);

const SLIDE_FIELDS = { title: "title", text: "text", image: "photo", position: "photo focus" };
const same = (first, second) => JSON.stringify(first ?? null) === JSON.stringify(second ?? null);

// For the Audit Trail: what changed, slide by slide ("slide 2 photo changed; 1 slide added").
const describeSlides = (saved, draft) => {
  const before = saved?.slides || [];
  const after = draft?.slides || [];
  const beforeById = new Map(before.map((slide) => [slide.id, slide]));
  const afterIds = new Set(after.map((slide) => slide.id));
  const phrases = [];

  const added = after.filter((slide) => !beforeById.has(slide.id)).length;
  const removed = before.filter((slide) => !afterIds.has(slide.id)).length;
  if (added) phrases.push(`${added} slide${added === 1 ? "" : "s"} added`);
  if (removed) phrases.push(`${removed} slide${removed === 1 ? "" : "s"} removed`);

  after.forEach((slide, index) => {
    const old = beforeById.get(slide.id);
    if (!old) return;
    const fields = Object.keys(SLIDE_FIELDS).filter((field) => !same(old[field], slide[field]));
    if (fields.length) phrases.push(`slide ${index + 1} ${listWords(fields.map((field) => SLIDE_FIELDS[field]))} changed`);
  });

  const keptBefore = before.filter((slide) => afterIds.has(slide.id)).map((slide) => slide.id);
  const keptAfter = after.filter((slide) => beforeById.has(slide.id)).map((slide) => slide.id);
  if (keptBefore.join() !== keptAfter.join()) phrases.push("order changed");
  return phrases;
};

// How the slide looks on the website, cropped as a computer (2:1) or a phone (4:5) shows it.
function SlidePreview({ slide, shape }) {
  const picture = slidePictureUrl(slide);
  return (
    <figure className={`website-slide-shot is-${shape}`}>
      <div className="website-slide-frame">
        {picture ? (
          <img src={picture} alt="" style={{ objectPosition: slide.position }} />
        ) : (
          <div className="website-slide-felt" aria-hidden="true"></div>
        )}
        <div className="website-slide-caption">
          <strong>{slide.title.trim() || "(title)"}</strong>
          {slide.text.trim() && <span>{slide.text}</span>}
        </div>
      </div>
      <figcaption>{shape === "wide" ? "Computer" : "Phone"}</figcaption>
    </figure>
  );
}

/**
 * The hall's own slides in the showcase at the top of the home page: a title,
 * a line of text and a photo each (no photo: the table's felt). Open
 * tournaments with a poster get their slides on their own and show first.
 * Photos are made smaller before upload, which also drops the camera's details
 * (such as where it was taken).
 */
export default function ShowcaseSettingsCard({ setLogs }) {
  const draft = useSiteSectionDraft({
    section: "showcase",
    label: "showcase slides",
    fieldLabels: { slides: "slides" },
    describe: describeSlides,
    setLogs,
  });
  const slides = draft.draft.slides || [];
  // Per slide id: { progress } while uploading, { error } when it failed, { warning } when the photo is small.
  const [uploads, setUploads] = useState({});
  const fileInput = useRef(null);
  const pickingFor = useRef(null);
  const missingTitle = slides.findIndex((slide) => !slide.title.trim());
  const savedCount = draft.saved.slides?.length || 0;
  const ownPhotos = (draft.saved.slides || []).filter((slide) => slide.image).length;
  const isDefault = same(draft.saved.slides, DEFAULT_SITE_SETTINGS.showcase.slides);

  const setUpload = (id, value) => setUploads((previous) => ({ ...previous, [id]: value }));
  const changeSlides = (change) => draft.update("slides", (current = []) => change(current));
  const updateSlide = (id, values) =>
    changeSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, ...values } : slide)));
  const moveSlide = (index, step) =>
    changeSlides((current) => {
      const next = [...current];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  const removeSlide = (id) => changeSlides((current) => current.filter((slide) => slide.id !== id));
  const addSlide = () =>
    changeSlides((current) => [...current, { id: newSlideId(), title: "", text: "", image: null, position: "center" }]);

  const choosePhoto = (id) => {
    pickingFor.current = id;
    fileInput.current?.click();
  };

  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    const id = pickingFor.current;
    event.target.value = "";
    if (!file || !id) return;
    if (!isPhoto(file)) {
      setUpload(id, { error: "Use a JPG, PNG or WebP photo." });
      return;
    }
    setUpload(id, { progress: 0 });
    try {
      const ready = await prepareImage(file);
      const media = await uploadEventMedia(ready, (progress) => setUpload(id, { progress })).promise;
      updateSlide(id, { image: { path: media.path, type: "image" } });
      setUpload(
        id,
        media.width && media.width < SHARP_WIDTH
          ? { warning: `This photo is only ${media.width}px wide, so it may look blurry on a computer. Use a bigger one if you have it.` }
          : null
      );
    } catch (error) {
      setUpload(id, { error: error.message });
    }
  };

  return (
    <SiteCard
      icon="bi-images"
      title="Showcase slides"
      description="The big pictures at the top of the home page, each with a title and a line of text. Tournaments with a poster show before these, on their own."
      chip={{ tone: "on", label: `${savedCount} slide${savedCount === 1 ? "" : "s"}${ownPhotos ? `, ${ownPhotos} with own photo` : ""}` }}
      draft={draft}
      blocked={missingTitle >= 0 ? `Give slide ${missingTitle + 1} a title to save.` : ""}
    >
      <input ref={fileInput} type="file" accept={PHOTO_TYPES.join(",")} onChange={pickPhoto} hidden />

      <ol className="website-slides">
        {slides.map((slide, index) => {
          const number = index + 1;
          const upload = uploads[slide.id];
          const uploading = upload?.progress !== undefined;

          return (
            <li key={slide.id} className="website-slide">
              <div className="website-slide-head">
                <h3>Slide {number}</h3>
                <div className="website-slide-tools">
                  <button
                    type="button"
                    className="website-icon-btn"
                    onClick={() => moveSlide(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move slide ${number} up`}
                    title="Move up"
                  >
                    <i className="bi bi-arrow-up" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    className="website-icon-btn"
                    onClick={() => moveSlide(index, 1)}
                    disabled={index === slides.length - 1}
                    aria-label={`Move slide ${number} down`}
                    title="Move down"
                  >
                    <i className="bi bi-arrow-down" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    className="website-icon-btn danger"
                    onClick={() => removeSlide(slide.id)}
                    disabled={slides.length === 1}
                    aria-label={`Remove slide ${number}`}
                    title={slides.length === 1 ? "The showcase keeps at least one slide" : "Remove"}
                  >
                    <i className="bi bi-trash" aria-hidden="true"></i>
                  </button>
                </div>
              </div>

              <div className="website-slide-body">
                <div className="website-fields">
                  <label className="website-field">
                    Title
                    <input
                      type="text"
                      value={slide.title}
                      maxLength={SLIDE_TITLE_MAX_LENGTH}
                      placeholder="e.g. Play. Compete. Unwind."
                      aria-invalid={!slide.title.trim()}
                      onChange={(event) => updateSlide(slide.id, { title: event.target.value })}
                    />
                    {!slide.title.trim() ? (
                      <em className="error">A title is needed.</em>
                    ) : (
                      <em>
                        {slide.title.length}/{SLIDE_TITLE_MAX_LENGTH} characters
                      </em>
                    )}
                  </label>
                  <label className="website-field">
                    <span>
                      Text <span className="website-optional">(optional)</span>
                    </span>
                    <textarea
                      rows={3}
                      value={slide.text}
                      maxLength={SLIDE_TEXT_MAX_LENGTH}
                      placeholder="One or two short sentences."
                      onChange={(event) => updateSlide(slide.id, { text: oneLine(event.target.value) })}
                    />
                    <em>
                      {slide.text.length}/{SLIDE_TEXT_MAX_LENGTH} characters
                    </em>
                  </label>

                  <div className="website-fields-row">
                    <div className="website-field">
                      Photo
                      <div className="website-slide-photo">
                        <button
                          type="button"
                          className="website-btn secondary"
                          onClick={() => choosePhoto(slide.id)}
                          disabled={uploading}
                        >
                          <i className="bi bi-upload" aria-hidden="true"></i>
                          {slide.image ? "Replace photo" : "Upload photo"}
                        </button>
                        {slide.image && (
                          <button type="button" className="website-btn ghost" onClick={() => updateSlide(slide.id, { image: null })}>
                            Remove photo
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
                        <em>{slide.image ? "Its own photo." : "None yet: it shows the green felt."} JPG, PNG or WebP.</em>
                      )}
                    </div>
                    <label className="website-field">
                      Keep in view
                      <select value={slide.position} onChange={(event) => updateSlide(slide.id, { position: event.target.value })}>
                        {SLIDE_POSITIONS.map((position) => (
                          <option key={position.value} value={position.value}>
                            {position.label}
                          </option>
                        ))}
                      </select>
                      <em>The part of the photo kept where the slide crops it.</em>
                    </label>
                  </div>
                </div>

                {/* Fields on the left, what customers see on the right, as on every card */}
                <aside className="website-slide-previews" aria-label={`What customers see for slide ${number}`}>
                  <span className="website-preview-label">Customers see</span>
                  <div className="website-slide-shots">
                    <SlidePreview slide={slide} shape="wide" />
                    <SlidePreview slide={slide} shape="phone" />
                  </div>
                </aside>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="website-slides-add">
        <button type="button" className="website-btn secondary" onClick={addSlide} disabled={slides.length >= SHOWCASE_SLIDES_MAX}>
          <i className="bi bi-plus-lg" aria-hidden="true"></i>
          Add slide
        </button>
        <span className="website-hint">
          {slides.length >= SHOWCASE_SLIDES_MAX
            ? `That is the most: ${SHOWCASE_SLIDES_MAX} slides.`
            : `Up to ${SHOWCASE_SLIDES_MAX} slides. They show in this order.`}
        </span>
        {!isDefault && (
          <button type="button" className="website-btn ghost" onClick={() => draft.update("slides", DEFAULT_SITE_SETTINGS.showcase.slides)}>
            <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
            Put back the original slides
          </button>
        )}
      </div>
    </SiteCard>
  );
}
