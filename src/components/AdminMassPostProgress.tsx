export type AdminMassPostProgressState = {
  completed: number;
  total: number;
  succeeded: number;
  failed: number;
  /** Stock # or short label for the row currently posting. */
  label?: string | null;
};

export type AdminMassPostProgressProps = AdminMassPostProgressState & {
  verb?: string;
  /** Overrides default "{verb} {completed} of {total}". */
  title?: string;
  /** Shown instead of succeeded/failed stats when set (including empty string). */
  detailLine?: string | null;
  okStatLabel?: string;
  failStatLabel?: string;
};

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

export function AdminMassPostProgress({
  completed,
  total,
  succeeded,
  failed,
  label,
  verb = "Posting",
  title,
  detailLine,
  okStatLabel = "posted",
  failStatLabel = "failed"
}: AdminMassPostProgressProps) {
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.min(100, Math.round((completed / safeTotal) * 100));
  const dashOffset = RING_C * (1 - pct / 100);
  const heading = title ?? `${verb} ${completed} of ${total}`;
  const showDetailLine = detailLine !== undefined;

  return (
    <div
      className="admin-massPostProgress"
      role="progressbar"
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={showDetailLine ? `${heading}. ${detailLine ?? ""}` : `${heading}, ${succeeded} ${okStatLabel}, ${failed} ${failStatLabel}`}
    >
      <div className="admin-massPostProgressRow">
        <div className="admin-massPostProgressRing" aria-hidden>
          <svg className="admin-massPostProgressSvg" viewBox="0 0 36 36">
            <circle className="admin-massPostProgressRingBg" cx="18" cy="18" r={RING_R} />
            <circle
              className="admin-massPostProgressRingFg"
              cx="18"
              cy="18"
              r={RING_R}
              strokeDasharray={RING_C}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="admin-massPostProgressPct">{pct}%</span>
        </div>
        <div className="admin-massPostProgressBody">
          <p className="admin-massPostProgressTitle">{heading}</p>
          {showDetailLine ? (
            detailLine ? <p className="admin-massPostProgressStats">{detailLine}</p> : null
          ) : (
            <p className="admin-massPostProgressStats">
              <span className="admin-massPostProgressStatOk">
                {succeeded} {okStatLabel}
              </span>
              {failed > 0 ? (
                <>
                  {" · "}
                  <span className="admin-massPostProgressStatFail">
                    {failed} {failStatLabel}
                  </span>
                </>
              ) : null}
            </p>
          )}
          {label ? <p className="admin-massPostProgressLabel">Current: #{label}</p> : null}
          <div className="admin-massPostProgressTrack">
            <div className="admin-massPostProgressFill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
