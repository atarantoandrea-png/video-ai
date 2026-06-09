// ffprobe-static ships no TypeScript types; declare the minimal shape we use.
declare module 'ffprobe-static' {
  const ffprobe: { path: string; version?: string }
  export default ffprobe
}
