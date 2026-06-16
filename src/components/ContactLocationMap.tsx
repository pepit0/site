import { CONTACT_LOCATION_MAP } from "../data/aboutContactCopy";
import { getContactMapEmbedUrl } from "../lib/businessPublic";

type ContactLocationMapProps = {
  /** Renders inside the Reach us card without a separate section heading. */
  embedded?: boolean;
};

export function ContactLocationMap({ embedded = false }: ContactLocationMapProps) {
  const embedSrc = getContactMapEmbedUrl();

  const frame = (
    <div className={`contact-pageMapFrame${embedded ? " contact-pageMapFrame--embedded" : ""}`}>
      <iframe
        src={embedSrc}
        title={CONTACT_LOCATION_MAP.iframeTitle}
        className="contact-pageMapIframe"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );

  if (embedded) {
    return (
      <div className="contact-pageReachMapInner">
        <h2 className="company-pageSectionHeading contact-pageMapHeading">{CONTACT_LOCATION_MAP.heading}</h2>
        {frame}
      </div>
    );
  }

  return (
    <section className="contact-pageMapSection" aria-labelledby="contact-map-heading">
      <h2 id="contact-map-heading" className="company-pageSectionHeading">
        {CONTACT_LOCATION_MAP.heading}
      </h2>
      {frame}
    </section>
  );
}
