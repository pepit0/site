import { Link } from "react-router-dom";
import {
  formatBusinessAddressLines,
  formatBusinessAddressOneLine,
  getPublicBusinessProfile,
  type PublicBusinessProfile
} from "../lib/businessPublic";
import { contactMailtoHref } from "../data/aboutContactCopy";

type BusinessNapBlockProps = {
  profile?: PublicBusinessProfile;
  variant?: "full" | "compact" | "footer";
  showDirections?: boolean;
  className?: string;
};

export function BusinessNapBlock({
  profile = getPublicBusinessProfile(),
  variant = "full",
  showDirections = true,
  className = ""
}: BusinessNapBlockProps) {
  const addressLines = formatBusinessAddressLines(profile);
  const rootClass = `business-nap business-nap--${variant}${className ? ` ${className}` : ""}`;

  if (variant === "footer") {
    return (
      <address className={rootClass}>
        <span className="business-napLine">{formatBusinessAddressOneLine(profile)}</span>
        <a className="business-napLine business-napLink" href={`tel:${profile.phoneTel}`}>
          {profile.phoneDisplay}
        </a>
        <a className="business-napLine business-napLink" href={contactMailtoHref()}>
          {profile.email}
        </a>
      </address>
    );
  }

  if (variant === "compact") {
    return (
      <address className={rootClass}>
        <span className="business-napName">{profile.name}</span>
        {addressLines.map((line) => (
          <span key={line} className="business-napLine">
            {line}
          </span>
        ))}
        <a className="business-napLine business-napLink" href={`tel:${profile.phoneTel}`}>
          {profile.phoneDisplay}
        </a>
        <Link className="business-napLine business-napLink" to="/contact">
          Contact us
        </Link>
      </address>
    );
  }

  return (
    <address className={rootClass}>
      <span className="business-napName">{profile.name}</span>
      {addressLines.map((line) => (
        <span key={line} className="business-napLine">
          {line}
        </span>
      ))}
      {!profile.streetAddress ? (
        <span className="business-napHint">Visit by appointment. Call or apply online first.</span>
      ) : null}
      {profile.hoursLabel ? <span className="business-napLine">Hours: {profile.hoursLabel}</span> : null}
      <a className="business-napLine business-napLink" href={`tel:${profile.phoneTel}`}>
        {profile.phoneDisplay}
      </a>
      <a className="business-napLine business-napLink" href={contactMailtoHref()}>
        {profile.email}
      </a>
      {showDirections && profile.googleMapsUrl ? (
        <a
          className="business-napDirections btn btn-secondary"
          href={profile.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get directions
        </a>
      ) : null}
    </address>
  );
}
