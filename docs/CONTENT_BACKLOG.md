# Content backlog — human-written copy

Pages flagged for **real editorial content** (not auto-generated). Add copy in the relevant `src/data/*Copy.ts` file when ready.

## High priority

### `/reviews` — [`ReviewsPage.tsx`](../src/pages/ReviewsPage.tsx)

- **Gap:** ~40 words of original copy (hero + summary note); rest is synced Google review text.
- **Write:**
  - 2–3 paragraphs on who you serve and what customers mention (financing, inventory, shipping).
  - Invite readers to leave a Google review.
  - Link to `/apply` and `/inventory`.

### `/sell-your-ride` — [`SellYourRidePage.tsx`](../src/pages/SellYourRidePage.tsx)

- **Gap:** ~99 words (lede + bullet list in [`sellRideCopy.ts`](../src/data/sellRideCopy.ts)).
- **Write:**
  - Step-by-step seller process (list → photos → buyer → cheque).
  - Seller FAQ and timeline expectations.
  - Brief comparison vs selling privately.
  - Strong CTA to `/sell-your-ride/apply`.

## Medium priority

### `/sell-your-ride/apply` — [`SellYourRideApplyPage.tsx`](../src/pages/SellYourRideApplyPage.tsx)

- **Gap:** Form-first page with minimal intro.
- **Write:** What to prepare (photos, price, contact), privacy note, what happens after submit.

### `/payment-calculator` — [`PaymentCalculatorPage.tsx`](../src/pages/PaymentCalculatorPage.tsx)

- **Gap:** One-sentence tagline in [`paymentCalculatorCopy.ts`](../src/data/paymentCalculatorCopy.ts) plus the widget.
- **Write:** Estimate vs real approval, province tax note, when to apply.

### `/faq` — [`FaqPage.tsx`](../src/pages/FaqPage.tsx)

- **Gap:** FAQ answers exist; intro is one sentence.
- **Write:** Optional expanded intro on who the FAQ is for and link clusters to financing, inventory, sell-your-ride.

## Lower priority (generally adequate)

| Page | Notes |
|------|--------|
| `/about` | Multiple sections in `aboutContactCopy.ts` |
| `/contact` | Hero, reasons list, map |
| `/financing/*` | Topic pages with FAQ blocks |
| `/inventory` | List page with sourcing blurb; category intros optional later |

## Implemented (data-driven, not human backlog)

- **`/inventory/{id}`** — Unit-specific listing paragraphs from [`inventoryUnitPageCopy.ts`](../src/lib/inventoryUnitPageCopy.ts) (year, make, model, category, stock, odometer, status, price, photo count). No trim/engine/condition until those fields exist on `inventory_units_public`.
