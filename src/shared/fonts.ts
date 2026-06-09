/**
 * Curated font list shared by the text panel (preview uses `css`) and the export
 * pipeline (main maps `css` → `file` so burned text matches the preview font).
 * Paths are standard macOS system fonts; main falls back if one is missing.
 */
export interface FontOption {
  label: string
  /** CSS font-family stack stored in TextStyle.fontFamily and used for preview. */
  css: string
  /** Absolute path to a .ttf/.ttc for ffmpeg drawtext on export. */
  file: string
}

export const FONTS: FontOption[] = [
  { label: 'Inter', css: 'Inter, -apple-system, sans-serif', file: '/System/Library/Fonts/SFNS.ttf' },
  { label: 'Helvetica', css: 'Helvetica, Arial, sans-serif', file: '/System/Library/Fonts/Helvetica.ttc' },
  { label: 'Arial', css: 'Arial, sans-serif', file: '/System/Library/Fonts/Supplemental/Arial.ttf' },
  { label: 'Arial Black', css: '"Arial Black", Arial, sans-serif', file: '/System/Library/Fonts/Supplemental/Arial Black.ttf' },
  { label: 'Avenir', css: 'Avenir, sans-serif', file: '/System/Library/Fonts/Avenir.ttc' },
  { label: 'Avenir Next', css: '"Avenir Next", sans-serif', file: '/System/Library/Fonts/Avenir Next.ttc' },
  { label: 'Futura', css: 'Futura, sans-serif', file: '/System/Library/Fonts/Supplemental/Futura.ttc' },
  { label: 'Gill Sans', css: '"Gill Sans", sans-serif', file: '/System/Library/Fonts/Supplemental/GillSans.ttc' },
  { label: 'Impact', css: 'Impact, fantasy', file: '/System/Library/Fonts/Supplemental/Impact.ttf' },
  { label: 'Trebuchet', css: '"Trebuchet MS", sans-serif', file: '/System/Library/Fonts/Supplemental/Trebuchet MS.ttf' },
  { label: 'Verdana', css: 'Verdana, sans-serif', file: '/System/Library/Fonts/Supplemental/Verdana.ttf' },
  { label: 'Georgia', css: 'Georgia, serif', file: '/System/Library/Fonts/Supplemental/Georgia.ttf' },
  { label: 'Times', css: '"Times New Roman", Times, serif', file: '/System/Library/Fonts/Supplemental/Times New Roman.ttf' },
  { label: 'Courier', css: '"Courier New", monospace', file: '/System/Library/Fonts/Supplemental/Courier New.ttf' },
  { label: 'Marker Felt', css: '"Marker Felt", fantasy', file: '/System/Library/Fonts/Supplemental/MarkerFelt.ttc' },
  { label: 'Chalkboard', css: '"Chalkboard SE", sans-serif', file: '/System/Library/Fonts/Supplemental/Chalkboard.ttc' },
  { label: 'Snell (corsivo)', css: '"Snell Roundhand", cursive', file: '/System/Library/Fonts/Supplemental/SnellRoundhand.ttc' },
  { label: 'Noteworthy', css: 'Noteworthy, cursive', file: '/System/Library/Fonts/Supplemental/Noteworthy.ttc' }
]

/** Resolve a stored CSS font-family back to its export font file (or undefined). */
export function fontFileForCss(css: string): string | undefined {
  return FONTS.find((f) => f.css === css)?.file
}
