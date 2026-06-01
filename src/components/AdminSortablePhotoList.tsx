import { useState, type DragEvent } from "react";

export type SortablePhotoItem = {
  id: string;
  src: string;
  label?: string;
};

export type AdminSortablePhotoListProps = {
  items: SortablePhotoItem[];
  onReorder: (orderedIds: string[]) => void | Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  busy?: boolean;
  removingId?: string | null;
  variant?: "chip" | "tile";
  emptyMessage?: string;
};

function reorderIds(ids: string[], from: number, to: number): string[] {
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (!item) return ids;
  next.splice(to, 0, item);
  return next;
}

function isRemoveButtonTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button"));
}

export function AdminSortablePhotoList({
  items,
  onReorder,
  onRemove,
  busy = false,
  removingId = null,
  variant = "chip",
  emptyMessage
}: AdminSortablePhotoListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return emptyMessage ? <span className="sell-ride-applyMuted">{emptyMessage}</span> : null;
  }

  const canDrag = items.length > 1 && !busy;

  const finishDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragStart = (event: DragEvent, index: number) => {
    if (!canDrag || isRemoveButtonTarget(event.target)) {
      event.preventDefault();
      return;
    }
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (event: DragEvent, index: number) => {
    if (!canDrag || dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (index !== dragIndex) setOverIndex(index);
  };

  const handleDrop = async (event: DragEvent, dropIndex: number) => {
    event.preventDefault();
    if (!canDrag || dragIndex === null || dragIndex === dropIndex) {
      finishDrag();
      return;
    }
    const orderedIds = reorderIds(
      items.map((item) => item.id),
      dragIndex,
      dropIndex
    );
    finishDrag();
    await onReorder(orderedIds);
  };

  const containerClass =
    variant === "tile"
      ? "sell-ride-applyReviewGrid admin-sortablePhotoGrid"
      : "admin-invPhotoRow admin-sortablePhotoRow";

  return (
    <>
      {canDrag ? (
        <p className="sell-ride-applyHint admin-sortablePhotoHint">Drag photos to reorder. The first photo is the listing cover.</p>
      ) : null}
      <div className={containerClass} role="list" aria-label="Photos — drag to reorder">
        {items.map((item, index) => {
          const itemBusy = busy || removingId === item.id;
          const dragging = dragIndex === index;
          const over = overIndex === index && dragIndex !== index;
          const itemClass = `admin-sortablePhotoItem${dragging ? " admin-sortablePhotoItemDragging" : ""}${
            over ? " admin-sortablePhotoItemOver" : ""
          }`;

          if (variant === "tile") {
            return (
              <figure
                key={item.id}
                role="listitem"
                draggable={canDrag && !itemBusy}
                className={`admin-queuePhotoFigure sell-ride-applyReviewFigure ${itemClass}`}
                aria-grabbed={dragging}
                aria-label={`Photo ${index + 1} of ${items.length}${index === 0 ? ", cover" : ""}`}
                onDragStart={(event) => handleDragStart(event, index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={(event) => void handleDrop(event, index)}
                onDragEnd={finishDrag}
              >
                {index === 0 ? <span className="admin-sortablePhotoCover">Cover</span> : null}
                <img src={item.src} alt="" className="sell-ride-applyReviewImg" referrerPolicy="no-referrer" draggable={false} />
                {onRemove ? (
                  <button
                    type="button"
                    className="admin-queuePhotoRemove"
                    aria-label="Remove photo"
                    disabled={itemBusy}
                    onClick={() => void onRemove(item.id)}
                  >
                    ×
                  </button>
                ) : null}
                {item.label ? <figcaption className="sell-ride-applyReviewCaption">{item.label}</figcaption> : null}
              </figure>
            );
          }

          return (
            <span
              key={item.id}
              role="listitem"
              draggable={canDrag && !itemBusy}
              className={`admin-invPhotoChip ${itemClass}`}
              aria-grabbed={dragging}
              aria-label={`Photo ${index + 1} of ${items.length}${index === 0 ? ", cover" : ""}`}
              onDragStart={(event) => handleDragStart(event, index)}
              onDragOver={(event) => handleDragOver(event, index)}
              onDrop={(event) => void handleDrop(event, index)}
              onDragEnd={finishDrag}
            >
              {index === 0 ? <span className="admin-sortablePhotoCover admin-sortablePhotoCoverChip">Cover</span> : null}
              <img
                className="admin-invThumb"
                src={item.src}
                alt=""
                referrerPolicy="no-referrer"
                draggable={false}
              />
              {onRemove ? (
                <button
                  type="button"
                  className="btn btn-secondary admin-invMiniBtn"
                  disabled={itemBusy}
                  onClick={() => void onRemove(item.id)}
                >
                  Remove
                </button>
              ) : null}
            </span>
          );
        })}
      </div>
    </>
  );
}
