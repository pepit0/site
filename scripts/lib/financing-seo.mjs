/**
 * Build-time financing page metadata for prerender (keep in sync with src/data/financingPages.ts intro[0]).
 */

export const FINANCING_PRERENDER_PAGES = [
  {
    path: "/financing",
    title: "Powersports financing guides Canada",
    description:
      "Powersports and motorsports financing for ATV, motorcycle, snowmobile, side-by-side, boat, jet ski, trailer, and auto loans across Canada. Edmonton / Sherwood Park, Alberta. Good credit, bad credit, or no credit. Free online application.",
    h1: "Powersports and motorsports financing in Canada",
    intro:
      "Temptation Motorsports helps Canadians pay for recreation rides and vehicles through simple powersports financing and motorsports financing. We are in Sherwood Park near Edmonton and work with buyers coast to coast.",
    serviceName: "Powersports and motorsports financing"
  },
  {
    path: "/financing/atv-financing",
    title: "ATV financing Canada, bad credit OK",
    description:
      "ATV financing and quad loans across Canada. Edmonton-based help for good credit, bad credit, and no credit. Free application. Shipping available nationwide.",
    h1: "ATV financing in Canada",
    intro:
      "ATV financing through Temptation Motorsports covers sport quads, utility machines, and many used units shipped outside Alberta.",
    serviceName: "ATV financing"
  },
  {
    path: "/financing/motorcycle-financing",
    title: "Motorcycle financing Canada, all credit welcome",
    description:
      "Motorcycle financing and bike loans in Canada. Bad credit and no credit OK. Free online application from Temptation Motorsports in Edmonton. Nationwide help.",
    h1: "Motorcycle financing in Canada",
    intro:
      "Motorcycle financing is one of our busiest categories because bike prices and insurance vary so much by class and engine size.",
    serviceName: "Motorcycle financing"
  },
  {
    path: "/financing/snowmobile-financing",
    title: "Snowmobile financing Canada, sled loans",
    description:
      "Snowmobile financing and sled loans across Canada. Edmonton-based powersports financing. Bad credit welcome. Apply free online with Temptation Motorsports.",
    h1: "Snowmobile financing in Canada",
    intro:
      "Snowmobile financing has a tight season. The best sleds move fast once the first snow hits Alberta and BC.",
    serviceName: "Snowmobile financing"
  },
  {
    path: "/financing/side-by-side-financing",
    title: "Side-by-side financing Canada, UTV loans",
    description:
      "Side-by-side and UTV financing across Canada. Can-Am, Polaris, and more. Bad credit welcome. Free application from Temptation Motorsports in Edmonton. Nationwide shipping.",
    h1: "Side-by-side financing in Canada",
    intro:
      "Side-by-side financing covers everything from ranch mules to high-horsepower sport UTVs. Prices swing wider here than on most ATVs.",
    serviceName: "Side-by-side financing"
  },
  {
    path: "/financing/boat-financing",
    title: "Boat financing Canada, all credit welcome",
    description:
      "Boat financing and marine loans across Canada. Edmonton-based help for good credit, bad credit, and no credit. Free application. Nationwide help from Temptation Motorsports.",
    h1: "Boat financing in Canada",
    intro:
      "Boat financing sits in the marine lane, not the powersports lane. Lenders ask about the hull, motor hours, and where you keep the boat.",
    serviceName: "Boat financing"
  },
  {
    path: "/financing/jet-ski-financing",
    title: "Jet ski financing Canada, PWC loans",
    description:
      "Jet ski and PWC financing across Canada. Personal watercraft loans for all credit types. Free online application. Temptation Motorsports, Edmonton, nationwide help.",
    h1: "Jet ski financing in Canada",
    intro:
      "Jet ski financing covers personal watercraft with jet drives. These are not the same paperwork as boat loans even though both sit on water.",
    serviceName: "Jet ski financing"
  },
  {
    path: "/financing/trailer-financing",
    title: "Trailer financing Canada, utility and toy hauler loans",
    description:
      "Trailer financing in Canada. Utility trailers, toy haulers, and powersports trailers. Bad credit welcome. Free application from Temptation Motorsports in Edmonton.",
    h1: "Trailer financing in Canada",
    intro:
      "Trailer financing is its own category. Lenders care about axle count, GVWR, and whether the trailer hauls vehicles or just cargo.",
    serviceName: "Trailer financing"
  },
  {
    path: "/financing/auto-financing",
    title: "Auto financing Canada, car loans bad credit OK",
    description:
      "Auto financing and car loans in Canada. Trucks, SUVs, and cars. Good credit, bad credit, or no credit. Free online application from Temptation Motorsports in Edmonton.",
    h1: "Auto financing in Canada",
    intro:
      "Auto financing is separate from our powersports desk but handled by the same team. Daily drivers, work trucks, and family SUVs use automotive lender networks.",
    serviceName: "Auto financing"
  },
  {
    path: "/financing/powersports-financing-bad-credit",
    title: "Bad credit powersports financing Canada",
    description:
      "Powersports financing with bad credit or no credit in Canada. ATV, motorcycle, sled, boat, jet ski, trailer, and auto loans. Free application. Temptation Motorsports in Edmonton, nationwide shipping.",
    h1: "Powersports financing with bad credit",
    intro:
      "Bad credit powersports financing is what this page is for. Past late pays, collections, or thin history do not auto-stop your file here.",
    serviceName: "Bad credit powersports financing"
  },
  {
    path: "/financing/alberta",
    title: "Powersports financing Alberta, Edmonton and province-wide",
    description:
      "ATV, motorcycle, snowmobile, side-by-side, boat, jet ski, trailer, and auto financing in Alberta. Sherwood Park / Edmonton dealership serving Alberta and Canada-wide shipping. Apply free.",
    h1: "Powersports financing in Alberta",
    intro:
      "Alberta powersports financing is our home market. We are in Sherwood Park inside the Edmonton metro with buyers visiting from Fort McMurray, Red Deer, and Calgary every month.",
    serviceName: "Alberta powersports financing"
  },
  {
    path: "/financing/british-columbia",
    title: "Powersports financing British Columbia, BC wide",
    description:
      "ATV, motorcycle, snowmobile, side-by-side, boat, and jet ski financing in British Columbia. Vancouver, Kelowna, and BC riders. Edmonton-based team, free application, shipping available.",
    h1: "Powersports financing in British Columbia",
    intro:
      "British Columbia powersports financing is a big part of what we do even though our office is in Alberta. BC buyers call us for boats, jet skis, sleds, and trail machines every week.",
    serviceName: "British Columbia powersports financing"
  },
  {
    path: "/financing/saskatchewan",
    title: "Powersports financing Saskatchewan, province-wide",
    description:
      "ATV, motorcycle, snowmobile, side-by-side, and auto financing in Saskatchewan. Regina, Saskatoon, and rural SK buyers. Free application from Temptation Motorsports in Edmonton.",
    h1: "Powersports financing in Saskatchewan",
    intro:
      "Saskatchewan powersports financing is close to our Alberta home base. SK buyers drive to Edmonton or ask us to ship ATVs, UTVs, and sleds east regularly.",
    serviceName: "Saskatchewan powersports financing"
  }
];

export function buildFinancialServiceJsonLd({ serviceName, description, siteOrigin, path, phoneTel = "+15872055773" }) {
  return {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    name: `Temptation Motorsports ${serviceName}`,
    description,
    url: `${siteOrigin}${path}`,
    telephone: phoneTel,
    areaServed: { "@type": "Country", name: "Canada" },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Sherwood Park",
      addressRegion: "AB",
      addressCountry: "CA"
    }
  };
}
