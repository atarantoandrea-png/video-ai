/** Custom scheme used to stream local media files to the renderer safely
 *  (file:// can't be loaded from an http origin with webSecurity on). */
export const MEDIA_SCHEME = 'media'

/** Build a media:// URL the renderer can use as a <video>/<img> src. */
export function mediaUrl(absPath: string): string {
  return `${MEDIA_SCHEME}://f/?p=${encodeURIComponent(absPath)}`
}
