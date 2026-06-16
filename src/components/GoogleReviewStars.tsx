type GoogleReviewStarsProps = {
  rating: number;
  className?: string;
  label?: string;
};

export function GoogleReviewStars({ rating, className, label }: GoogleReviewStarsProps) {
  const clamped = Math.min(5, Math.max(0, rating));
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className={className ?? "home-reviewsStars"} role="img" aria-label={label ?? `${clamped} out of 5 stars`}>
      {stars.map((star) => {
        const fill = Math.min(1, Math.max(0, clamped - (star - 1)));
        return (
          <span key={star} className="home-reviewsStarSlot" aria-hidden>
            <span className="home-reviewsStarBg">★</span>
            <span className="home-reviewsStarFg" style={{ width: `${fill * 100}%` }}>
              ★
            </span>
          </span>
        );
      })}
    </div>
  );
}
