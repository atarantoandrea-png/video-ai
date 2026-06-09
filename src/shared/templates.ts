import type { TransitionPreset } from './projectSchema'

/**
 * Reel "Modelli" — one-click styles applied to the WHOLE timeline (every video clip):
 * a colour look + a transition between consecutive clips. Reuses the look library and
 * the transition engine, so both preview and export are already faithful.
 */
export interface ReelTemplate {
  id: string
  label: string
  /** look id from shared/looks.ts (or null = clear the look). */
  look: string | null
  /** transition between consecutive clips (or null = no transition). */
  transition: TransitionPreset | null
  transDur: number
}

export const REEL_TEMPLATES: ReelTemplate[] = [
  { id: 'clean', label: 'Pulito', look: null, transition: 'fade', transDur: 0.3 },
  { id: 'cinema', label: 'Cinema', look: 'cinema', transition: 'fade', transDur: 0.45 },
  { id: 'dynamic', label: 'Dinamico', look: 'punch', transition: 'zoomin', transDur: 0.3 },
  { id: 'vintage', label: 'Vintage', look: 'vintage', transition: 'fade', transDur: 0.45 },
  { id: 'bw', label: 'Bianco e nero', look: 'bw', transition: 'fade', transDur: 0.35 },
  { id: 'dreamy', label: 'Sognante', look: 'dreamy', transition: 'splith', transDur: 0.5 },
  { id: 'sunset', label: 'Tramonto', look: 'sunset', transition: 'wiperight', transDur: 0.4 },
  { id: 'teal', label: 'Teal & Orange', look: 'teal', transition: 'slideleft', transDur: 0.35 }
]
