import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  GOOGLE_REVIEWS_SUMMARY,
  hasPublishedGoogleReviews,
  HOME_HERO_FIVE_STAR_REVIEWS,
  HOME_HERO_REVIEW_CAROUSEL,
  HOME_HERO_REVIEW_MAX_CHARS,
  HOME_REVIEWS_SECTION,
  truncateReviewText,
  type GoogleReview
} from "../data/googleReviews";
import { GoogleReviewStars } from "./GoogleReviewStars";

const ROTATE_MS = 5200;

function formatReviewDate(review: GoogleReview): string | null {
  if (review.relativeTime) return review.relativeTime;
  if (!review.publishedAt) return null;
  const date = new Date(`${review.publishedAt}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
}

export function HomeHeroReviewCarousel() {
  const reviews = HOME_HERO_FIVE_STAR_REVIEWS;
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion || reviews.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % reviews.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [reduceMotion, reviews.length]);

  if (!hasPublishedGoogleReviews() || reviews.length === 0) return null;

  const review = reviews[activeIndex] ?? reviews[0];
  const { preview } = truncateReviewText(review.text, HOME_HERO_REVIEW_MAX_CHARS);
  const dateLabel = formatReviewDate(review);

  return (
    <div className="home-heroReviewCarouselWrap">
      <h2 className="home-heroReviewCarouselTitle">{HOME_HERO_REVIEW_CAROUSEL.heading}</h2>
      <aside className="home-heroReviewCarousel" aria-label="Google customer reviews">
      <div className="home-heroReviewCarouselHeader">
        <GoogleReviewStars
          rating={5}
          className="home-reviewsStars"
          label="5 out of 5 stars on Google"
        />
        <p className="home-heroReviewCarouselMeta">
          {GOOGLE_REVIEWS_SUMMARY.ratingValue.toFixed(1)} on Google
        </p>
      </div>

      <figure key={review.id} className="home-heroReviewCard">
        <blockquote className="home-heroReviewQuote">"{preview}"</blockquote>
        <figcaption className="home-heroReviewCaption">
          <cite className="home-heroReviewAuthor">{review.authorName}</cite>
          {dateLabel ? <span className="home-heroReviewWhen"> · {dateLabel}</span> : null}
        </figcaption>
      </figure>

      {reviews.length > 1 ? (
        <div className="home-heroReviewCarouselDots" role="tablist" aria-label="Choose a review">
          {reviews.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={`home-heroReviewCarouselDot${index === activeIndex ? " home-heroReviewCarouselDot--active" : ""}`}
              aria-selected={index === activeIndex}
              aria-label={`Review by ${item.authorName}`}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : null}

      <Link to="/reviews" className="home-heroReviewCarouselLink">
        {HOME_REVIEWS_SECTION.viewAllLabel}
      </Link>
      </aside>
    </div>
  );
}
