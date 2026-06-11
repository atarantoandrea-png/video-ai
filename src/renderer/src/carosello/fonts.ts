/**
 * Cross-platform font list for the carousel editor. Unlike the video editor
 * (which maps to macOS system font FILES for ffmpeg), the carousel renders text
 * in the renderer (Chromium canvas/DOM) and exports via <canvas>, so we only need
 * CSS stacks. These are "core web fonts" available on BOTH macOS and Windows.
 * Brand fonts can be bundled later via @font-face without changing this contract.
 */
export interface CFont {
  label: string
  css: string
}

export const CFONTS: CFont[] = [
  { label: 'Sistema', css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { label: 'Arial Black', css: '"Arial Black", "Arial Bold", Gadget, sans-serif' },
  { label: 'Impact', css: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
  { label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', css: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet', css: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { label: 'Times', css: '"Times New Roman", Times, serif' },
  { label: 'Courier', css: '"Courier New", Courier, monospace' }
]
