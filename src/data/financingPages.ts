/** SEO / AEO / GEO landing pages for powersports financing. User-facing copy ~3rd grade reading level. */

import { SITE_CONTACT } from "./preapprovalCopy";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

export type FinancingFaqItem = {
  question: string;
  answer: string;
};

export type FinancingExpertiseSection = {
  heading: string;
  body: string;
};

export type FinancingPageDef = {
  slug: string;
  path: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  tagline: string;
  intro: readonly string[];
  expertiseSections: readonly FinancingExpertiseSection[];
  highlights: readonly string[];
  faq: readonly FinancingFaqItem[];
  navLabel: string;
  serviceName: string;
};

export const FINANCING_HUB: FinancingPageDef = {
  slug: "",
  path: "/financing",
  seoTitle: "Powersports & motorsports financing Canada",
  seoDescription:
    "Powersports and motorsports financing for ATV, motorcycle, snowmobile, side-by-side, boat, jet ski, trailer, and auto loans across Canada. Edmonton / Sherwood Park, Alberta. Good credit, bad credit, or no credit. Free online application.",
  h1: "Powersports and motorsports financing in Canada",
  tagline: "One team in Edmonton. Many ride types. Help in every province.",
  intro: [
    "Temptation Motorsports helps Canadians pay for recreation rides and vehicles through simple powersports financing and motorsports financing. We are in Sherwood Park near Edmonton and work with buyers coast to coast.",
    "Pick a topic page below for details on ATV, motorcycle, snowmobile, side-by-side, boat, jet ski, trailer, or auto financing. Or start the free form now and we will call you."
  ],
  expertiseSections: [
    {
      heading: "How our financing process works",
      body:
        "You fill out a short form at temptmotorsports.com/apply. Tell us what you want, what you can pay, and how to reach you. A person on our team reads it and calls you. We do not auto-decline from a computer score. We talk through options in plain words."
    },
    {
      heading: "Why we built separate guides for each ride type",
      body:
        "A boat loan and an ATV loan are not the same deal. Different seasons, prices, and lenders fit different rides. Each page on this site answers questions for that ride only so you get clear answers, not generic copy."
    }
  ],
  highlights: [
    "Human review on every application",
    "Topic pages for each major ride category",
    "Free form, about two minutes",
    "Calls usually within one business day"
  ],
  faq: [
    {
      question: "What can I finance through Temptation Motorsports?",
      answer:
        "ATVs, motorcycles, snowmobiles, side-by-sides, boats, jet skis, trailers, autos, and many RVs. Use the topic links on this page for ride-specific details."
    },
    {
      question: "Do you only finance buyers in Alberta?",
      answer:
        "No. We are Alberta-based but help buyers in BC, Saskatchewan, Ontario, Quebec, and every province. Shipping is common for many ride types."
    },
    {
      question: "How do I start?",
      answer:
        "Go to temptmotorsports.com/apply or call us at " +
        SITE_CONTACT.phoneDisplay +
        ". The online form is free and takes about two minutes."
    },
    {
      question: "Will the first form hurt my credit?",
      answer:
        "No hard credit check when you first apply. You can choose a soft check on the last step if you want us to move faster."
    },
    {
      question: "Can bad credit still get approved?",
      answer:
        "Often yes. See our bad credit financing page for how we review thin files, past bumps, and co-signer options."
    }
  ],
  navLabel: "All financing",
  serviceName: "Powersports and motorsports financing"
};

function page(
  def: Omit<FinancingPageDef, "path"> & { slug: string }
): FinancingPageDef {
  return { ...def, path: `/financing/${def.slug}` };
}

export const FINANCING_TOPIC_PAGES: FinancingPageDef[] = [
  page({
    slug: "atv-financing",
    seoTitle: "ATV financing Canada, bad credit OK",
    seoDescription:
      "ATV financing and quad loans across Canada. Edmonton-based help for good credit, bad credit, and no credit. Free application. Shipping available nationwide.",
    h1: "ATV financing in Canada",
    tagline: "Trail quads, utility ATVs, and youth models. We match the loan to the ride.",
    intro: [
      "ATV financing through Temptation Motorsports covers sport quads, utility machines, and many used units shipped outside Alberta.",
      "Ranch, trail, and hunting buyers use different loan lengths and down payments. Tell us how you ride on the form. We call you with numbers that fit your quad and your budget."
    ],
    expertiseSections: [
      {
        heading: "New vs used ATV loans",
        body:
          "New ATVs often qualify for longer terms from lenders who know the brand. Used quads may need a shorter term or a larger down payment depending on year and hours. We price both every week."
      },
      {
        heading: "Shipping an ATV to your province",
        body:
          "Many buyers are not near Edmonton. If we find the right quad in another market, we can often arrange transport. Ask about freight when we call so it is in your monthly plan from day one."
      }
    ],
    highlights: [
      "Sport, utility, and youth quads",
      "Private-sale and dealer units considered",
      "Rural and urban buyers welcome",
      "Pair a trailer loan on the same call"
    ],
    faq: [
      {
        question: "Can I get ATV financing with bad credit in Canada?",
        answer:
          "Yes. We see bruised credit often on ATV deals. Income, down payment, and the unit itself all matter. Apply free and we will give you a straight answer on the phone."
      },
      {
        question: "What down payment do ATVs usually need?",
        answer:
          "It varies by price and lender. Some programs allow little or zero down. Higher-risk files may need 10 to 20 percent. We quote yours before you commit."
      },
      {
        question: "Do you finance two-up or side-by-side sized ATVs?",
        answer:
          "Yes for many models. Very large UTV-style units may fit better on our side-by-side financing page. Tell us the exact model and we will place it correctly."
      },
      {
        question: "Can I bundle gear or a plow in the loan?",
        answer:
          "Sometimes. Accessories may ride inside the same note if the lender allows. List extras on the form so we include them in the quote."
      },
      {
        question: "How long are ATV loan terms in Canada?",
        answer:
          "Common terms run from 36 to 84 months depending on age and amount. We explain what length keeps your payment sane for your income."
      }
    ],
    navLabel: "ATV financing",
    serviceName: "ATV financing"
  }),
  page({
    slug: "motorcycle-financing",
    seoTitle: "Motorcycle financing Canada, all credit welcome",
    seoDescription:
      "Motorcycle financing and bike loans in Canada. Bad credit and no credit OK. Free online application from Temptation Motorsports in Edmonton. Nationwide help.",
    h1: "Motorcycle financing in Canada",
    tagline: "Cruisers, sport bikes, and dirt bikes. Loans built around how you ride.",
    intro: [
      "Motorcycle financing is one of our busiest categories because bike prices and insurance vary so much by class and engine size.",
      "Commuter bikes, weekend cruisers, and off-road machines go to different lenders. Share your license class and budget on the form. We call with programs that match your bike, not a generic auto loan."
    ],
    expertiseSections: [
      {
        heading: "Street bike vs dirt bike lending",
        body:
          "On-road motorcycles usually need proof of insurance before funding. Off-road bikes may follow powersports programs with different rules. We know which path fits your unit before we submit anything."
      },
      {
        heading: "Buying from a private seller",
        body:
          "Private-sale motorcycle financing is possible when the title is clean and the lender accepts the seller. Send photos and the VIN on the form. We tell you early if that seller setup will work."
      }
    ],
    highlights: [
      "Harley, Japanese, and European brands",
      "First-time rider files welcome",
      "Co-signer options explained on the call",
      "Used bike values checked before you buy"
    ],
    faq: [
      {
        question: "Can I finance a motorcycle with bad credit?",
        answer:
          "Yes. Thin credit and old late pays are common on bike apps. We look at stability of income and the bike value together."
      },
      {
        question: "Do I need a motorcycle license before I apply?",
        answer:
          "You can apply before you test. Final funding usually needs a valid class license and insurance. We outline that timeline when we call."
      },
      {
        question: "Are motorcycle loan rates higher than car rates?",
        answer:
          "Often slightly higher because bikes are specialty collateral. Term length and down payment move the rate more than the logo on the tank."
      },
      {
        question: "Can I finance a project or custom bike?",
        answer:
          "Custom builds are harder to finance. Mostly-stock bikes with clear titles are easiest. Describe the build on the form and we will be honest about options."
      },
      {
        question: "What if the bike I want is in another province?",
        answer:
          "We help buyers locate units nationwide. Out-of-province purchases need extra title steps. We walk you through those on the call."
      }
    ],
    navLabel: "Motorcycle financing",
    serviceName: "Motorcycle financing"
  }),
  page({
    slug: "snowmobile-financing",
    seoTitle: "Snowmobile financing Canada, sled loans",
    seoDescription:
      "Snowmobile financing and sled loans across Canada. Edmonton-based powersports financing. Bad credit welcome. Apply free online with Temptation Motorsports.",
    h1: "Snowmobile financing in Canada",
    tagline: "Mountain sleds, trail machines, and touring models. Beat the winter rush.",
    intro: [
      "Snowmobile financing has a tight season. The best sleds move fast once the first snow hits Alberta and BC.",
      "Apply early if you know your budget. We hold files, search inventory, and lock terms when the right Ski-Doo, Polaris, or Arctic Cat appears. Bad credit files still get a human review."
    ],
    expertiseSections: [
      {
        heading: "Timing your sled loan",
        body:
          "Late fall and early winter are busiest. Lenders and inventory both tighten in January. Starting in summer or early fall gives you more choice and calmer phone wait times."
      },
      {
        heading: "Trail vs mountain sled pricing",
        body:
          "Mountain sleds cost more and may need stronger income on the file. Trail touring models often fit smaller payments. Tell us where you ride so we do not over- or under-shoot the loan amount."
      }
    ],
    highlights: [
      "Seasonal sourcing across Canada",
      "Used sleds with logged hours OK",
      "Pair trailer financing for sled decks",
      "Alberta and BC buyers especially active"
    ],
    faq: [
      {
        question: "When should I apply for snowmobile financing?",
        answer:
          "As soon as you know your max payment. Early apps beat the November rush and give us time to hunt the right year and model."
      },
      {
        question: "Can I finance a used snowmobile?",
        answer:
          "Yes. Age and mileage caps depend on the lender. We know which banks still fund 5 to 10 year old sleds."
      },
      {
        question: "Do you finance snowmobiles for Ontario and Quebec riders?",
        answer:
          "Yes. We are in Alberta but fund sleds for eastern buyers when the unit and file fit lender rules."
      },
      {
        question: "Can I include a sled trailer in the loan?",
        answer:
          "Often yes on the same application. See our trailer financing page for toy hauler details or mention both on the form."
      },
      {
        question: "What happens if I miss a payment on a sled loan?",
        answer:
          "Call us before you miss. Lenders have hardship steps. We would rather rework the plan early than see a repossession."
      }
    ],
    navLabel: "Snowmobile financing",
    serviceName: "Snowmobile financing"
  }),
  page({
    slug: "side-by-side-financing",
    seoTitle: "Side-by-side financing Canada, UTV loans",
    seoDescription:
      "Side-by-side and UTV financing across Canada. Can-Am, Polaris, and more. Bad credit welcome. Free application from Temptation Motorsports in Edmonton. Nationwide shipping.",
    h1: "Side-by-side financing in Canada",
    tagline: "Work UTVs, sport side-by-sides, and family four-seaters.",
    intro: [
      "Side-by-side financing covers everything from ranch mules to high-horsepower sport UTVs. Prices swing wider here than on most ATVs.",
      "Can-Am, Polaris, Yamaha, and Honda each use different lender tiers. Send the exact model and seat count on the form. We match you to a program that funds that class of machine."
    ],
    expertiseSections: [
      {
        heading: "Work vs recreation UTV loans",
        body:
          "Farm and commercial buyers sometimes qualify for different docs than weekend trail riders. Tell us if the unit is for work so we use the right lender packet."
      },
      {
        heading: "Four-seat family UTVs",
        body:
          "Four-seater side-by-sides cost more and often need longer terms. Include passenger use and towing plans when we call so the payment fits family use."
      }
    ],
    highlights: [
      "Can-Am Defender, Maverick, and more",
      "Polaris Ranger and RZR programs",
      "Commercial and personal use",
      "Roll cage units with clean titles"
    ],
    faq: [
      {
        question: "Can I get side-by-side financing with bad credit?",
        answer:
          "Yes. UTV loans are larger, so down payment helps weak files. We quote what the lender needs before you sign."
      },
      {
        question: "Do lenders finance lifted or modified UTVs?",
        answer:
          "Mild accessories are OK on many programs. Major lift kits and engine swaps can block funding. Describe mods on the form."
      },
      {
        question: "Is side-by-side financing the same as ATV financing?",
        answer:
          "Not always. Higher loan amounts and different collateral classes apply. That is why this page is separate from our ATV guide."
      },
      {
        question: "Can I finance a UTV for my business?",
        answer:
          "Sometimes through business or personal credit depending on structure. We ask a few extra questions on the call for GST and business name deals."
      },
      {
        question: "Are UTVs available for shipping outside Alberta?",
        answer:
          "Yes when inventory or sourcing finds the unit. Freight is quoted upfront so it is not a surprise at delivery."
      }
    ],
    navLabel: "Side-by-side financing",
    serviceName: "Side-by-side financing"
  }),
  page({
    slug: "boat-financing",
    seoTitle: "Boat financing Canada, all credit welcome",
    seoDescription:
      "Boat financing and marine loans across Canada. Edmonton-based help for good credit, bad credit, and no credit. Free application. Nationwide help from Temptation Motorsports.",
    h1: "Boat financing in Canada",
    tagline: "Fishing rigs, pontoons, and runabouts. Marine loans with clear steps.",
    intro: [
      "Boat financing sits in the marine lane, not the powersports lane. Lenders ask about the hull, motor hours, and where you keep the boat.",
      "Alberta lakes, BC coast, and Ontario cottage country buyers all use different storage setups. Share marina, trailer, or yard storage on the form. We call with marine lenders who fund your type of hull."
    ],
    expertiseSections: [
      {
        heading: "Pontoon vs fiberglass boat loans",
        body:
          "Pontoons often have slower depreciation and easier approvals. Fiberglass sport boats may need bigger down payments. We send your file to the right marine desk."
      },
      {
        heading: "Trailers and motors on the same note",
        body:
          "Some deals include the trailer and outboard in one loan. Others split them. We map the bill of sale before you pay the seller."
      }
    ],
    highlights: [
      "Outboard and sterndrive boats",
      "Freshwater focus for most files",
      "Survey or inspection when required",
      "Coastal and lake buyers nationwide"
    ],
    faq: [
      {
        question: "Can I finance a boat with bad credit?",
        answer:
          "Yes if the boat value and your income support the payment. Marine lenders are stricter on debt ratios than some ATV banks."
      },
      {
        question: "Do I need a marine survey for a used boat?",
        answer:
          "Older or high-value used boats often need a survey. We tell you before you put a deposit on a seller's dock."
      },
      {
        question: "Are boat loan terms shorter than car loans?",
        answer:
          "Often yes. Many marine notes run 10 to 15 years on new boats and less on older hulls. We show the payment at each length."
      },
      {
        question: "Can I finance a boat that lives on a trailer only?",
        answer:
          "Yes. Trailer-kept boats are common in Alberta and the Prairies. Storage address goes on the lender form."
      },
      {
        question: "Do you finance jet boats under boat financing?",
        answer:
          "Some jet boats go here. Personal jet skis usually go on our jet ski financing page instead."
      }
    ],
    navLabel: "Boat financing",
    serviceName: "Boat financing"
  }),
  page({
    slug: "jet-ski-financing",
    seoTitle: "Jet ski financing Canada, PWC loans",
    seoDescription:
      "Jet ski and PWC financing across Canada. Personal watercraft loans for all credit types. Free online application. Temptation Motorsports, Edmonton, nationwide help.",
    h1: "Jet ski financing in Canada",
    tagline: "Sea-Doo, Yamaha WaveRunner, and Kawasaki Jet Ski models.",
    intro: [
      "Jet ski financing covers personal watercraft with jet drives. These are not the same paperwork as boat loans even though both sit on water.",
      "PWCs are shorter, tow on a small trailer, and often pair with a second ski for family use. Tell us if you want one or two units. We structure the loan for singles, couples, or family pairs."
    ],
    expertiseSections: [
      {
        heading: "New PWC promotions vs used savings",
        body:
          "Manufacturers sometimes run payment promos on new Sea-Doo or Yamaha models. Used skis save upfront but may have shorter terms. We compare both on the call."
      },
      {
        heading: "Life jackets, covers, and trailers",
        body:
          "Lenders may allow soft goods and a PWC trailer in the advance. List them on the form so your first summer is not a surprise expense."
      }
    ],
    highlights: [
      "Two-stroke and four-stroke PWCs",
      "Supercharged models when lenders allow",
      "Lake and river riders",
      "Alberta summer pickup or ship"
    ],
    faq: [
      {
        question: "Is jet ski financing different from boat financing?",
        answer:
          "Yes. PWCs use personal watercraft programs with different caps and terms than fiberglass boats."
      },
      {
        question: "Can I finance two jet skis together?",
        answer:
          "Often yes on one loan if the lender allows multiple units. Tell us you want a pair on the form."
      },
      {
        question: "Do I need a boater license for financing?",
        answer:
          "Funding rules vary by province. We remind you of local card requirements but the loan focuses on credit and income."
      },
      {
        question: "Can I finance a used PWC with high hours?",
        answer:
          "Hours and year matter. Well-maintained low-hour used skis fund easier. Send hours and service history if you have them."
      },
      {
        question: "Where do you ship jet skis in Canada?",
        answer:
          "Any province when sourcing finds the unit. Many Alberta buyers pick up near Edmonton to save freight."
      }
    ],
    navLabel: "Jet ski financing",
    serviceName: "Jet ski financing"
  }),
  page({
    slug: "trailer-financing",
    seoTitle: "Trailer financing Canada, utility and toy hauler loans",
    seoDescription:
      "Trailer financing in Canada. Utility trailers, toy haulers, and powersports trailers. Bad credit welcome. Free application from Temptation Motorsports in Edmonton.",
    h1: "Trailer financing in Canada",
    tagline: "Utility, enclosed, flatdeck, and toy hauler trailers.",
    intro: [
      "Trailer financing is its own category. Lenders care about axle count, GVWR, and whether the trailer hauls vehicles or just cargo.",
      "Some buyers finance a trailer alone. Others add it to an ATV or side-by-side deal. Tell us the load you plan to carry. We size the loan to the trailer, not the truck pulling it."
    ],
    expertiseSections: [
      {
        heading: "Toy hauler trailers for powersports",
        body:
          "Toy haulers with living space cost more and may need proof you can insure the unit. We use lenders who fund living-quarter trailers when the file fits."
      },
      {
        heading: "Standalone utility trailers",
        body:
          "Small open utility trailers often fund quickly with lower amounts. Enclosed cargo trailers for work may need business use details on the app."
      }
    ],
    highlights: [
      "Bumper pull and gooseneck when allowed",
      "Aluminum and steel frames",
      "Add to a ride purchase or solo",
      "VIN and weight verified before fund"
    ],
    faq: [
      {
        question: "Can I finance a trailer without buying a vehicle from you?",
        answer:
          "Yes. Standalone trailer loans are common for haulers upgrading their deck or enclosed box."
      },
      {
        question: "Can a trailer loan roll into my ATV purchase?",
        answer:
          "Often yes on one combined note if the lender funds both collateral types. Mention both items on the form."
      },
      {
        question: "Do you finance homemade or shop-built trailers?",
        answer:
          "Rarely. Factory-built trailers with VIN plates fund best. We are upfront if a home build cannot be collateral."
      },
      {
        question: "What is GVWR and why does it matter?",
        answer:
          "Gross vehicle weight rating tells the lender how heavy the trailer can load. Higher GVWR usually means a bigger loan amount and stricter income check."
      },
      {
        question: "Are trailer loan terms shorter than car terms?",
        answer:
          "Many trailer notes run 36 to 84 months depending on price. We align term with how long you plan to keep the trailer."
      }
    ],
    navLabel: "Trailer financing",
    serviceName: "Trailer financing"
  }),
  page({
    slug: "auto-financing",
    seoTitle: "Auto financing Canada, car loans bad credit OK",
    seoDescription:
      "Auto financing and car loans in Canada. Trucks, SUVs, and cars. Good credit, bad credit, or no credit. Free online application from Temptation Motorsports in Edmonton.",
    h1: "Auto financing in Canada",
    tagline: "Cars, trucks, and SUVs for daily driving and work.",
    intro: [
      "Auto financing is separate from our powersports desk but handled by the same team. Daily drivers, work trucks, and family SUVs use automotive lender networks.",
      "If you tow a camper or haul bikes, tell us. Payment size and term change when the vehicle is also your tow rig. We ask about mileage and use so the loan fits real life."
    ],
    expertiseSections: [
      {
        heading: "Work truck vs commuter car files",
        body:
          "High-mileage work trucks are judged differently from low-mileage sedans. Lenders look at resale and use. We pick banks that fund commercial-looking trucks when needed."
      },
      {
        heading: "Auto plus powersports on one relationship",
        body:
          "Many customers finance a truck here and an ATV later. Keeping both with one team means one phone call for renewals and trade ups."
      }
    ],
    highlights: [
      "Sedans, SUVs, and light trucks",
      "Private sale and dealer purchases",
      "Trade-in talk on the phone",
      "Separate from marine and PWC rules"
    ],
    faq: [
      {
        question: "Does Temptation Motorsports sell cars or only finance them?",
        answer:
          "We focus on financing and sourcing. Tell us what you need and we help locate units or fund a seller you found."
      },
      {
        question: "Can I get a car loan with bad credit?",
        answer:
          "Yes. Auto subprime programs exist. Down payment and stable income help. We shop more than one lender."
      },
      {
        question: "How is auto financing different from ATV financing?",
        answer:
          "Different lender pools, different value guides, and different insurance rules. That is why this page stands alone."
      },
      {
        question: "Can I refinance a car loan with you?",
        answer:
          "Sometimes if the payoff and value work. Send your current balance and rate on the form notes."
      },
      {
        question: "Do you finance leases or only purchases?",
        answer:
          "We focus on purchase loans. Lease takeovers are case by case. Ask on the call."
      }
    ],
    navLabel: "Auto financing",
    serviceName: "Auto financing"
  }),
  page({
    slug: "powersports-financing-bad-credit",
    seoTitle: "Bad credit powersports financing Canada",
    seoDescription:
      "Powersports financing with bad credit or no credit in Canada. ATV, motorcycle, sled, boat, jet ski, trailer, and auto loans. Free application. Temptation Motorsports in Edmonton, nationwide shipping.",
    h1: "Powersports financing with bad credit",
    tagline: "Second-chance files reviewed by people, not just a score.",
    intro: [
      "Bad credit powersports financing is what this page is for. Past late pays, collections, or thin history do not auto-stop your file here.",
      "We submit to lenders who specialize in recreation and auto subprime. Down payment, co-signers, and picking the right unit price matter more than a perfect beacon."
    ],
    expertiseSections: [
      {
        heading: "Soft vs hard credit checks",
        body:
          "The first online form does not hard pull your credit. On the last step you can allow a soft inquiry. A hard pull happens later only when you agree to move forward with a specific lender."
      },
      {
        heading: "How to strengthen a weak file",
        body:
          "Stable job time, proof of address, a co-signer with strong credit, and a realistic unit price all help. We coach you on those levers before we submit."
      }
    ],
    highlights: [
      "No instant computer decline",
      "Co-signer and joint apps OK",
      "Honest talk if now is not the right time",
      "Paths for no credit young buyers"
    ],
    faq: [
      {
        question: "Can I get powersports financing with no credit history?",
        answer:
          "Yes. First-time borrowers need income proof and often a co-signer or down payment. We explain which combo fits your ride."
      },
      {
        question: "What credit score do I need?",
        answer:
          "There is no single cutoff. Scores in the 500s fund sometimes with down payment. Scores in the 700s get better rates. We quote real options, not guesses."
      },
      {
        question: "Will bankruptcy stop me?",
        answer:
          "Not always. Discharged bankruptcies may qualify after lenders see stability. Bring discharge papers to the call."
      },
      {
        question: "Should I pay collections before I apply?",
        answer:
          "Sometimes paying small collections helps. Large old debts may not move the needle. We review your report with you when you consent to a pull."
      },
      {
        question: "Which ride is easiest to approve with bad credit?",
        answer:
          "Lower-priced used ATVs and older motorcycles often fund first. Expensive boats and big UTVs need stronger files."
      }
    ],
    navLabel: "Bad credit financing",
    serviceName: "Bad credit powersports financing"
  }),
  page({
    slug: "alberta",
    seoTitle: "Powersports financing Alberta, Edmonton and province-wide",
    seoDescription:
      "ATV, motorcycle, snowmobile, side-by-side, boat, jet ski, trailer, and auto financing in Alberta. Sherwood Park / Edmonton dealership serving Alberta and Canada-wide shipping. Apply free.",
    h1: "Powersports financing in Alberta",
    tagline: "Sherwood Park team serving Edmonton, Calgary, and rural Alberta.",
    intro: [
      "Alberta powersports financing is our home market. We are in Sherwood Park inside the Edmonton metro with buyers visiting from Fort McMurray, Red Deer, and Calgary every month.",
      "Alberta GST applies on most deals. We explain tax on your quote before you sign. Rural acreage buyers and city commuters both get the same human review."
    ],
    expertiseSections: [
      {
        heading: "Edmonton vs Calgary buyer tips",
        body:
          "Edmonton buyers often pick up units locally. Calgary buyers may ask us to ship or meet halfway. Either way Alberta registration steps stay the same."
      },
      {
        heading: "Seasonal demand in Alberta",
        body:
          "ATV and side-by-side demand spikes in spring. Sleds spike in fall. Boat and PWC demand peaks in late spring. Apply off-season for shorter wait times."
      }
    ],
    highlights: [
      "Local inventory plus Canada-wide search",
      "Alberta GST spelled out on quotes",
      "Farm and acreage use welcome",
      "Phone support at " + SITE_CONTACT.phoneDisplay
    ],
    faq: [
      {
        question: "Where is Temptation Motorsports in Alberta?",
        answer:
          "Sherwood Park, part of the greater Edmonton area. Visit by appointment or start online at temptmotorsports.com/apply."
      },
      {
        question: "Do you finance buyers only in Edmonton?",
        answer:
          "No. Calgary, Lethbridge, Grande Prairie, and rural routes are normal for us. Shipping or pickup is planned on the call."
      },
      {
        question: "How does Alberta GST work on a financed ride?",
        answer:
          "GST is usually added to the purchase price and can roll into the loan when the lender allows. We show tax on your worksheet."
      },
      {
        question: "Can Alberta farmers finance work UTVs?",
        answer:
          "Yes. Tell us the unit is for farm use. Some lenders ask for acreage or business details."
      },
      {
        question: "Do you still help Alberta buyers who move out of province?",
        answer:
          "Funding happens before you move. Registration in your new province is your next step with local insurance."
      }
    ],
    navLabel: "Alberta financing",
    serviceName: "Alberta powersports financing"
  }),
  page({
    slug: "british-columbia",
    seoTitle: "Powersports financing British Columbia, BC wide",
    seoDescription:
      "ATV, motorcycle, snowmobile, side-by-side, boat, and jet ski financing in British Columbia. Vancouver, Kelowna, and BC riders. Edmonton-based team, free application, shipping available.",
    h1: "Powersports financing in British Columbia",
    tagline: "Vancouver to the Okanagan to the north. BC buyers welcome.",
    intro: [
      "British Columbia powersports financing is a big part of what we do even though our office is in Alberta. BC buyers call us for boats, jet skis, sleds, and trail machines every week.",
      "BC adds GST plus PST on many purchases. We show both on your quote before you sign. We ship to BC or help you pick up near Edmonton when that saves freight."
    ],
    expertiseSections: [
      {
        heading: "Lower Mainland vs Interior BC buyers",
        body:
          "Vancouver and Fraser Valley buyers often want delivery. Okanagan and Kamloops buyers may drive to Alberta for the right unit. We plan tax, freight, and insurance steps for your address on the call."
      },
      {
        heading: "Boats and PWCs are big in BC",
        body:
          "BC lake and coastal use drives strong boat and jet ski demand. Marine and PWC lenders ask extra questions about storage and insurance. We use the right desk for saltwater vs freshwater files."
      }
    ],
    highlights: [
      "GST and PST explained on BC quotes",
      "Boat, PWC, sled, and ATV programs",
      "Ship to Vancouver, Kelowna, and beyond",
      "Same human review as Alberta files"
    ],
    faq: [
      {
        question: "Do you finance powersports for BC residents if you are in Alberta?",
        answer:
          "Yes. We are in Sherwood Park near Edmonton and fund BC buyers when the unit and file fit lender rules. Many BC deals include shipping."
      },
      {
        question: "How do BC taxes work on a financed ATV or boat?",
        answer:
          "Most BC purchases need GST and PST. We add both to your worksheet and can roll them into the loan when the bank allows."
      },
      {
        question: "Can you ship a side-by-side to Vancouver or Victoria?",
        answer:
          "Often yes. Freight is quoted upfront. Island delivery may need extra ferry planning we talk through on the phone."
      },
      {
        question: "Do you finance mountain snowmobiles for BC riders?",
        answer:
          "Yes. BC mountain sleds are a specialty market. Tell us the model and riding zone so we match the loan to the machine."
      },
      {
        question: "What do I need to register a financed unit in BC?",
        answer:
          "After funding you insure and register with ICBC. We send lender paperwork you need for the BC registration office."
      }
    ],
    navLabel: "BC financing",
    serviceName: "British Columbia powersports financing"
  }),
  page({
    slug: "saskatchewan",
    seoTitle: "Powersports financing Saskatchewan, province-wide",
    seoDescription:
      "ATV, motorcycle, snowmobile, side-by-side, and auto financing in Saskatchewan. Regina, Saskatoon, and rural SK buyers. Free application from Temptation Motorsports in Edmonton.",
    h1: "Powersports financing in Saskatchewan",
    tagline: "Regina, Saskatoon, and farm country. SK buyers treated like neighbors.",
    intro: [
      "Saskatchewan powersports financing is close to our Alberta home base. SK buyers drive to Edmonton or ask us to ship ATVs, UTVs, and sleds east regularly.",
      "Farm and acreage use is normal on SK files. GST applies on most deals. We ask how you use the machine so the lender packet matches ranch or trail riding."
    ],
    expertiseSections: [
      {
        heading: "Regina and Saskatoon pickup vs delivery",
        body:
          "Many SK buyers save money picking up near Edmonton on a weekend run. Others want freight to Regina or Saskatoon. We quote both so you can choose."
      },
      {
        heading: "Work UTVs on Saskatchewan farms",
        body:
          "Ranch mules and cargo UTVs are popular in SK. Tell us the unit is for farm work when you apply. Some lenders want extra income or acreage notes on those files."
      }
    ],
    highlights: [
      "Short haul from Edmonton for many SK buyers",
      "Farm and trail units welcome",
      "GST shown clearly on quotes",
      "Snowmobile and ATV seasonal sourcing"
    ],
    faq: [
      {
        question: "Do you finance Saskatchewan buyers from Alberta?",
        answer:
          "Yes. Saskatchewan is a regular market for us. Regina, Saskatoon, Prince Albert, and rural SK routes are common."
      },
      {
        question: "Is shipping to Saskatchewan expensive?",
        answer:
          "SK freight is often lower than BC or northern routes because of distance from Edmonton. We quote exact freight before you commit."
      },
      {
        question: "Can I finance a farm side-by-side in Saskatchewan?",
        answer:
          "Yes. Work UTVs fund often with proof of income. Mention farm use on the form so we send the right lender package."
      },
      {
        question: "How does Saskatchewan tax work on financing?",
        answer:
          "GST applies on most powersports purchases. PST rules differ from BC. We show the tax line on your deal sheet before you sign."
      },
      {
        question: "Can I register an SK financed unit in my home province?",
        answer:
          "Yes. After funding you register with SGI. We provide the lien paperwork your registry agent needs."
      }
    ],
    navLabel: "Saskatchewan financing",
    serviceName: "Saskatchewan powersports financing"
  })
];

export const ALL_FINANCING_PAGES: FinancingPageDef[] = [FINANCING_HUB, ...FINANCING_TOPIC_PAGES];

export function getFinancingPageBySlug(slug: string | undefined): FinancingPageDef | null {
  if (!slug) return null;
  return FINANCING_TOPIC_PAGES.find((p) => p.slug === slug) ?? null;
}

export function financingFaqJsonLd(faq: readonly FinancingFaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

/** WebPage schema for AEO / GEO entity clarity. */
export function financingWebPageJsonLd(page: FinancingPageDef): Record<string, unknown> | null {
  if (!hasPublicSiteOrigin()) return null;

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.h1,
    description: page.seoDescription,
    url: absoluteUrl(page.path),
    isPartOf: {
      "@type": "WebSite",
      name: "Temptation Motorsports",
      url: absoluteUrl("/")
    },
    about: {
      "@type": "Thing",
      name: page.serviceName
    },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [
        ".financing-directAnswer",
        ".financing-expertiseBody",
        ".financing-faqQuestion",
        ".financing-faqAnswer"
      ]
    }
  };
}
