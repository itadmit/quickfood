/**
 * Minimal browser-window mockup of the QuickFood dashboard used on the
 * auth pages. Pure SVG/HTML, no images.
 */

import { cn } from "@/lib/cn";

interface Props {
  variant?: "kanban" | "menu";
  className?: string;
}

export function DashboardPreview({ variant = "kanban", className }: Props) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[520px] aspect-[4/3] rounded-2xl overflow-hidden shadow-xl bg-white border border-qf-line-dash",
        className,
      )}
      aria-hidden
    >
      {/* Browser chrome */}
      <div className="h-9 px-3 bg-qf-line-soft border-b border-qf-line-dash flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-qf-tomato/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-qf-yolk/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-(--qf-primary)/70" />
        </div>
        <div className="flex-1 grid place-items-center">
          <div
            className="text-[10px] text-qf-mute bg-white border border-qf-line-dash rounded-md px-3 py-0.5 font-mono"
            dir="ltr"
          >
            quickfood.app/dashboard/orders
          </div>
        </div>
      </div>

      {/* Dashboard body */}
      <div className="grid grid-cols-[1fr_70px] h-[calc(100%-2.25rem)]">
        <div className="p-3 space-y-2.5 overflow-hidden">
          {/* Topbar */}
          <div className="flex items-center justify-between gap-2">
            <div className="h-6 w-28 rounded-md bg-qf-line-soft border border-qf-line-dash" />
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-qf-line-soft" />
              <div className="h-5 w-5 rounded-full bg-(--qf-soft) border border-(--qf-line)" />
              <div className="h-5 w-5 rounded-full bg-(--qf-primary) text-white grid place-items-center text-[8px] font-bold">
                Q
              </div>
            </div>
          </div>

          {variant === "kanban" ? <KanbanGrid /> : <MenuGrid />}
        </div>

        {/* Sidebar */}
        <div className="bg-qf-line-soft/40 border-s border-qf-line-soft p-2 space-y-1.5">
          <div className="h-6 w-6 rounded-lg bg-(--qf-primary) mx-auto mb-2" />
          <SidebarItem active />
          <SidebarItem />
          <SidebarItem />
          <SidebarItem />
          <SidebarItem />
        </div>
      </div>
    </div>
  );
}

function KanbanGrid() {
  return (
    <div className="grid grid-cols-4 gap-1.5 h-full">
      <KanbanColumn label="חדשות" count={3} cards={3} />
      <KanbanColumn label="בהכנה" count={2} cards={2} accent />
      <KanbanColumn label="מוכנות" count={1} cards={1} />
      <KanbanColumn label="בדרך" count={2} cards={2} />
    </div>
  );
}

function KanbanColumn({
  label,
  count,
  cards,
  accent,
}: {
  label: string;
  count: number;
  cards: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-qf-line-soft/40 rounded-lg p-1.5 space-y-1.5 min-h-0">
      <div className="flex items-center justify-between text-[8px] text-qf-ink2 font-semibold">
        <span>{label}</span>
        <span
          className={cn(
            "rounded-md px-1 leading-none",
            accent ? "bg-(--qf-soft) text-(--qf-deep)" : "bg-white border border-qf-line-dash",
          )}
        >
          {count}
        </span>
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <KanbanCard key={i} accent={accent && i === 0} />
      ))}
    </div>
  );
}

function KanbanCard({ accent }: { accent?: boolean }) {
  return (
    <div
      className={cn(
        "bg-white rounded-md border p-1.5 space-y-1",
        accent ? "border-(--qf-line) ring-1 ring-(--qf-primary)/30" : "border-qf-line-dash",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="h-1.5 w-10 rounded-sm bg-qf-ink/70" />
        <div className="h-1.5 w-4 rounded-sm bg-(--qf-soft)" />
      </div>
      <div className="h-1 w-3/4 rounded-sm bg-qf-line-soft" />
      <div className="h-1 w-1/2 rounded-sm bg-qf-line-soft" />
      <div className="flex items-center justify-between pt-0.5">
        <div className="h-1.5 w-6 rounded-sm bg-qf-ink/40" />
        <div className="h-2.5 w-8 rounded-sm bg-(--qf-primary)" />
      </div>
    </div>
  );
}

function MenuGrid() {
  return (
    <div className="grid grid-cols-3 gap-1.5 h-full content-start">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-md border border-qf-line-dash p-1.5 space-y-1 aspect-[3/4]"
        >
          <div className="aspect-square rounded-sm bg-(--qf-soft)" />
          <div className="h-1 w-3/4 rounded-sm bg-qf-line-soft" />
          <div className="h-1 w-1/2 rounded-sm bg-qf-line-soft" />
        </div>
      ))}
    </div>
  );
}

function SidebarItem({ active }: { active?: boolean }) {
  return (
    <div
      className={cn(
        "h-7 rounded-md mx-auto",
        active ? "bg-(--qf-soft) w-full" : "bg-white border border-qf-line-dash w-8",
      )}
    />
  );
}
