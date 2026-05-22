"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Tiny native HTML5 drag-and-drop reorder helper.
 *
 * Usage:
 *   <DragList items={list} onReorder={setList}>
 *     {(item, i, dragProps) => (
 *       <div {...dragProps} className="...">
 *         <span {...dragProps.handleProps}>≡</span>
 *         {item.name}
 *       </div>
 *     )}
 *   </DragList>
 *
 * - The whole item is a drop target.
 * - Only the element wearing `dragProps.handleProps` is draggable.
 *   That way text inputs inside the row keep normal cursor + selection.
 * - During a drag, the source row dims and the hovered drop zone shows a
 *   2px caret on the leading edge in writing direction.
 */
export function DragList<T>({
  items,
  onReorder,
  getKey,
  children,
  className,
  rowClassName,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  /** Stable key per item (defaults to index — pass a real id if available). */
  getKey?: (item: T, index: number) => string | number;
  children: (
    item: T,
    index: number,
    dragProps: {
      handleProps: {
        draggable: true;
        onDragStart: (e: React.DragEvent) => void;
        onDragEnd: () => void;
        style: React.CSSProperties;
        "aria-label": string;
        title: string;
      };
      isDragging: boolean;
    },
  ) => React.ReactNode;
  className?: string;
  rowClassName?: string;
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onReorder(next);
  }

  return (
    <div className={className}>
      {items.map((item, i) => {
        const key = getKey ? getKey(item, i) : i;
        const isDragging = draggingIndex === i;
        const isDropTarget = dropAt === i && draggingIndex !== null && draggingIndex !== i;
        return (
          <div
            key={key}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggingIndex !== null && draggingIndex !== i) setDropAt(i);
            }}
            onDragLeave={() => {
              if (dropAt === i) setDropAt(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const fromStr = e.dataTransfer.getData("text/plain");
              const from = Number.parseInt(fromStr, 10);
              if (Number.isFinite(from) && from !== i) move(from, i);
              setDraggingIndex(null);
              setDropAt(null);
            }}
            className={cn(
              "relative transition-opacity",
              isDragging && "opacity-40",
              rowClassName,
            )}
          >
            {isDropTarget && (
              <div
                aria-hidden
                className="absolute inset-x-0 -top-px h-0.5 bg-(--qf-primary) rounded-full pointer-events-none"
              />
            )}
            {children(item, i, {
              handleProps: {
                draggable: true,
                onDragStart: (e) => {
                  e.dataTransfer.setData("text/plain", String(i));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingIndex(i);
                },
                onDragEnd: () => {
                  setDraggingIndex(null);
                  setDropAt(null);
                },
                style: { cursor: "grab" },
                "aria-label": "גרור לסידור מחדש",
                title: "גרור לסידור מחדש",
              },
              isDragging,
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Visual handle for the drag-list — six dots in a 3×2 grid, like Wolt/Notion. */
export function DragHandle({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className={cn("text-qf-mute shrink-0", className)}
      aria-hidden
    >
      <circle cx="4" cy="3" r="1.1" fill="currentColor" />
      <circle cx="4" cy="7" r="1.1" fill="currentColor" />
      <circle cx="4" cy="11" r="1.1" fill="currentColor" />
      <circle cx="10" cy="3" r="1.1" fill="currentColor" />
      <circle cx="10" cy="7" r="1.1" fill="currentColor" />
      <circle cx="10" cy="11" r="1.1" fill="currentColor" />
    </svg>
  );
}
