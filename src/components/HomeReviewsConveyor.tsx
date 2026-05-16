import { useEffect, useState } from "react";
import type { HomeFakeReview } from "../data/homeFakeReviews";
import { HOME_FAKE_REVIEWS } from "../data/homeFakeReviews";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function StarRow({ rating }: { rating: HomeFakeReview["rating"] }) {
  return (
    <div className="home-reviewsStars" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)));
        return (
          <span key={i} className="home-reviewsStarSlot">
            <span className="home-reviewsStarBg">★</span>
            {fill > 0 ? (
              <span className="home-reviewsStarFg" style={{ width: `${fill * 100}%` }}>
                ★
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function ReviewCard({ review }: { review: HomeFakeReview }) {
  return (
    <article className="home-reviewsCard">
      <StarRow rating={review.rating} />
      <p className="home-reviewsQuote">&ldquo;{review.quote}&rdquo;</p>
      <footer className="home-reviewsCaption">
        <span className="home-reviewsAuthor">{review.author}</span>
        {review.tag ? <span className="home-reviewsTag">{review.tag}</span> : null}
      </footer>
    </article>
  );
}

export function HomeReviewsConveyor() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="home-reviewsBelt">
      {!reducedMotion ? (
        <div className="home-reviewsViewport" aria-hidden>
          <div className="home-reviewsTrack">
            {HOME_FAKE_REVIEWS.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
            {HOME_FAKE_REVIEWS.map((r) => (
              <ReviewCard key={`${r.id}-dup`} review={r} />
            ))}
          </div>
        </div>
      ) : (
        <div className="home-reviewsStatic">
          {HOME_FAKE_REVIEWS.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
}
