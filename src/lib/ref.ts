/**
 * A short, stable, opaque reference for a negotiation, derived from its **immutable
 * id** — never the editable title, so it never changes. Pure JS (FNV-1a 32-bit) so
 * it computes identically on the server (operator /usage view) and the client (each
 * participant's view), giving everyone the same shared code to refer to.
 */
export function negotiationRef(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
