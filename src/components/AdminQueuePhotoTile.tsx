export type AdminQueuePhotoTileProps = {
  src: string;
  label?: string;
  onRemove?: () => void;
  removable?: boolean;
  busy?: boolean;
};

export function AdminQueuePhotoTile({ src, label, onRemove, removable = true, busy = false }: AdminQueuePhotoTileProps) {
  const showRemove = removable && onRemove != null;

  return (
    <figure className="admin-queuePhotoFigure sell-ride-applyReviewFigure">
      <img src={src} alt="" className="sell-ride-applyReviewImg" referrerPolicy="no-referrer" />
      {showRemove ? (
        <button
          type="button"
          className="admin-queuePhotoRemove"
          aria-label="Remove photo"
          disabled={busy}
          onClick={() => onRemove()}
        >
          ×
        </button>
      ) : null}
      {label ? <figcaption className="sell-ride-applyReviewCaption">{label}</figcaption> : null}
    </figure>
  );
}
