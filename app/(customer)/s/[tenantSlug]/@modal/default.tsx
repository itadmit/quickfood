/**
 * Default slot for the `@modal` parallel route. Returns null when no
 * interceptor is active, so the menu / item / checkout / etc. routes
 * render normally with the slot empty.
 */
export default function ModalDefault() {
  return null;
}
