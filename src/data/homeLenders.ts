/** Homepage lender trust strip — logos in public/lenders/ (Prefera bundled for cache + trim). */

import preferaLogoUrl from "../assets/lenders/prefera.png";

export const HOME_LENDERS_TAGLINE = "We work with certified lenders you can trust";

export type HomeLender = {
  name: string;
  logoSrc: string;
  /** Extra class on <img> (e.g. wide or blend fixes). */
  logoClassName?: string;
};

export const HOME_LENDERS: HomeLender[] = [
  { name: "National Bank", logoSrc: "/lenders/national-bank.png" },
  { name: "TD", logoSrc: "/lenders/td.png" },
  { name: "Santander", logoSrc: "/lenders/santander.png" },
  {
    name: "Prefera",
    logoSrc: preferaLogoUrl,
    logoClassName: "home-lendersLogo--prefera"
  },
  { name: "Lendcare", logoSrc: "/lenders/lendcare.png" }
];
