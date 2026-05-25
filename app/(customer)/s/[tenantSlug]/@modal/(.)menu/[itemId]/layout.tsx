import { ItemDetailModal } from "@/components/customer/ItemDetailModal";

/**
 * Hoists the modal chrome to a layout so it stays mounted across the
 * `loading.tsx` → `page.tsx` transition. Without this, both files wrap
 * their own `<ItemDetailModal>` and React unmounts/remounts the modal
 * on transition — the open animation runs twice.
 */
export default function InterceptedItemModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ItemDetailModal>{children}</ItemDetailModal>;
}
