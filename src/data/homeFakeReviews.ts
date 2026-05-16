export type HomeFakeReviewRating = 4.5 | 5;

export type HomeFakeReview = {
  id: string;
  rating: HomeFakeReviewRating;
  quote: string;
  author: string;
  /** Short subtitle, e.g. region or unit type */
  tag?: string;
};

/**
 * Illustrative copy for the home page conveyor.
 * Two entries name staff; the rest refer to the shop or team.
 */
export const HOME_FAKE_REVIEWS: HomeFakeReview[] = [
  {
    id: "sled-finance",
    rating: 5,
    quote:
      "Financing on my sled got sorted way faster than I thought it would. Paperwork didn't turn into a whole thing, which was nice.",
    author: "Jordan M.",
    tag: "Snowmobile, AB"
  },
  {
    id: "atv-daniel",
    rating: 5,
    quote:
      "Daniel went through the finance stuff with me without making me feel dumb about any of it. Walked out with an ATV I'm happy with.",
    author: "Chris P.",
    tag: "ATV, SK"
  },
  {
    id: "ssv-team",
    rating: 4.5,
    quote:
      "They had a solid lineup of side by sides and the guys actually ride, so I wasn't getting guesses. Answered my trail questions too.",
    author: "Sam R.",
    tag: "SSV, BC"
  },
  {
    id: "bike-delivery",
    rating: 5,
    quote:
      "I'm not local but they kept me in the loop the whole time the bike was in transit. Showed up when they said it would.",
    author: "Alex T.",
    tag: "Bike, ON"
  },
  {
    id: "kruize-prep",
    rating: 4.5,
    quote:
      "Kruize had the sled ready to go before I got there, battery, fluids, all that. Didn't have to run around fixing little stuff myself.",
    author: "Taylor L.",
    tag: "Sled, AB"
  },
  {
    id: "inventory-wide",
    rating: 5,
    quote:
      "Found the quad I was hunting for on their site. Rolled off the truck looking like the pics, no surprises.",
    author: "Morgan K.",
    tag: "ATV, MB"
  },
  {
    id: "rates-clear",
    rating: 4.5,
    quote:
      "Rate and payment stuff was explained in normal words, not bank talk. That went a long way for me.",
    author: "Riley D.",
    tag: "Financing, AB"
  },
  {
    id: "winter-gear",
    rating: 5,
    quote:
      "Traded my old sled in, number was fair enough I didn't argue. Left with a newer one same day.",
    author: "Casey W.",
    tag: "Snowmobile, SK"
  },
  {
    id: "first-timer",
    rating: 4.5,
    quote:
      "First side by side purchase, had no clue on insurance and plates. They walked me through it without rushing me out the door.",
    author: "Jamie H.",
    tag: "SSV, AB"
  },
  {
    id: "trail-weekend",
    rating: 5,
    quote:
      "Signed Thursday, picked up Friday, rode Saturday. Financing didn't drag on forever like I've had elsewhere.",
    author: "Quinn B.",
    tag: "ATV, BC"
  },
  {
    id: "dealership-vibe",
    rating: 4.5,
    quote:
      "Needed something for weekends at the lake, didn't want the hard sell. They pointed me at a ski that made sense for what we do.",
    author: "Drew N.",
    tag: "PWC, AB"
  },
  {
    id: "cross-country",
    rating: 5,
    quote:
      "Bought the bike off the ad without seeing it in person first. When it landed it matched what they said. I'd buy from them again.",
    author: "Pat S.",
    tag: "Bike, QC"
  },
  {
    id: "family-unit",
    rating: 4.5,
    quote:
      "Wanted something the kids could use at camp without being sketchy. They helped us sort cab space and storage without pushing the biggest price tag.",
    author: "Avery C.",
    tag: "UTV, AB"
  },
  {
    id: "cold-start",
    rating: 5,
    quote:
      "Cold morning, they had the sled sitting inside warmed up when I got there. Small thing but I noticed.",
    author: "Blake F.",
    tag: "Sled, AB"
  },
  {
    id: "pre-approval",
    rating: 4.5,
    quote:
      "Did the pre approval on the website first, then the visit was pretty quick after that. In and out without wasting my afternoon.",
    author: "Skyler G.",
    tag: "Financing, SK"
  },
  {
    id: "parts-mindset",
    rating: 5,
    quote:
      "You can tell they actually ride and aren't just moving metal. I'll be back when I'm ready to trade up.",
    author: "Reese J.",
    tag: "ATV, AB"
  },
  {
    id: "season-swap",
    rating: 4.5,
    quote:
      "Same crew helped me go from winter toy to summer toy. Didn't have to re explain my whole situation to someone new.",
    author: "Emery V.",
    tag: "BC"
  },
  {
    id: "late-hours",
    rating: 5,
    quote:
      "I work nights so scheduling stuff is annoying. They were flexible on when I could come sign, that helped a lot.",
    author: "Lane O.",
    tag: "Bike, AB"
  }
];
