import { Link } from "react-router-dom";
import logoUrl from "../assets/logo.png";
import { Seo } from "../seo/Seo";

export function SellYourRidePage() {
  return (
    <div className="sell-ride">
      <Seo
        title="Sell your ride"
        description="List your motorcycle, ATV, sled, trailer, RV, or other powersports unit. Temptation Motorsports helps buyers who need financing while you keep control of your sale."
        path="/sell-your-ride"
      />
      <div className="sell-ride-layout">
        <div className="sell-ride-brandColumn">
          <header className="sell-ride-brandHeader">
            <h1 className="page-title sell-ride-title">Sell your ride</h1>
          </header>
          <div className="sell-ride-logoWrap">
            <img
              src={logoUrl}
              alt="Temptation Motorsports"
              className="sell-ride-logo"
              width={640}
              height={320}
              decoding="async"
            />
          </div>
        </div>

        <div className="sell-ride-panel">
          <div className="sell-ride-body">
            <section className="sell-ride-seoBlurb" aria-labelledby="sell-ride-seo-heading">
              <h2 id="sell-ride-seo-heading" className="sell-ride-seoBlurbTitle">
                List jet skis, quads, sleds, and bikes
              </h2>
              <p className="sell-ride-seoBlurbText">
                Private sellers use this path to reach riders who may need financing through our team. You keep control of
                your price and your ad while we help qualified buyers get funded.
              </p>
            </section>
            <p>
              Start by sending us good photos, the odometer reading, and any other relevant info about your ride. Tell
              us clearly what you want for it. That number is your floor, and we work from there with buyers who need
              financing.
            </p>
            <p>
              Your ad stays in your control. You can take the listing down whenever you want, or leave it up and add
              that financing is available. If someone messages you about financing, point them our way and we will take it
              from there while you keep running the sale on your terms.
            </p>
            <p>
              When a financed deal is pending on your unit, your entry in our inventory is updated to show a{" "}
              <span className="sell-ride-statusPending">pending</span> status so you can see where things stand at a
              glance. We email you as the file moves, and we are building a customer portal where you will get steady
              updates on your unit in one place once that is live.
            </p>
            <p>
              When we put a financed deal together on your unit, you receive a cheque in hand for the amount we agreed
              on during negotiations. No moving the goalposts after the fact.
            </p>
            <p className="sell-ride-applyCta">
              <Link to="/sell-your-ride/apply" className="btn btn-primary">
                Sell your ride with us
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
