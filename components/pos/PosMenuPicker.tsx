"use client";

export function PosMenuPicker() {
  // TODO: categories + item grid wired in the menu-picker landing.
  // For now the register surface intentionally shows just the ticket on
  // the right while we get cash + queue flows working end-to-end.
  return (
    <div className="h-full grid place-items-center text-qf-mute p-8 text-center">
      <div>
        <div className="text-lg font-bold mb-2">תפריט יוצג כאן</div>
        <p className="text-sm">
          לחיוב חופשי, השתמשו בכפתור &quot;מספרים&quot; בכרטיסיה. תור הזמנות הקיוסק זמין בלשונית
          &quot;תור&quot;.
        </p>
      </div>
    </div>
  );
}
