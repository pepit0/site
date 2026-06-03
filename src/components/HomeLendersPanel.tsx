import { HOME_LENDERS, HOME_LENDERS_TAGLINE } from "../data/homeLenders";

export function HomeLendersPanel() {
  return (
    <aside className="home-lenders" aria-label="Lending partners">
      <p className="home-lendersTagline">{HOME_LENDERS_TAGLINE}</p>
      <ul className="home-lendersLogos">
        {HOME_LENDERS.map((lender) => (
          <li key={lender.name} className="home-lendersItem">
            <img
              className={`home-lendersLogo${lender.logoClassName ? ` ${lender.logoClassName}` : ""}`}
              src={lender.logoSrc}
              alt={`${lender.name} lending partner`}
              width={lender.logoClassName ? 72 : 32}
              height={32}
              loading="lazy"
              decoding="async"
            />
            <span className="home-lendersName">{lender.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
