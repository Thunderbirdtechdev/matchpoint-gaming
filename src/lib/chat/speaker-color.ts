/**
 * Which colour a speaker gets in a chat room.
 *
 * Hashed from the author id rather than assigned by position, so a player is
 * the same colour in every room, on every reload, for everyone reading — the
 * whole point being that you learn "green is Kevin" once. Position-based
 * assignment would repaint the room every time an earlier message scrolled out
 * of the window.
 *
 * The id is a uuid, whose low bits are random, so a plain character sum spreads
 * evenly across the palette without needing anything cleverer.
 */

/** How many `--speaker-N` tokens exist in styles.css. */
export const SPEAKER_COLOR_COUNT = 8;

export function speakerColorIndex(authorId: string): number {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = (hash + authorId.charCodeAt(i) * (i + 1)) % 100_003;
  }
  return (hash % SPEAKER_COLOR_COUNT) + 1;
}

/** A CSS colour for this speaker, resolved from the theme's tokens. */
export function speakerColor(authorId: string): string {
  return `var(--speaker-${speakerColorIndex(authorId)})`;
}

/** Two letters for an avatar with no picture. */
export function speakerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
