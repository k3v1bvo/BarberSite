/**
 * Helper utilities for parsing YouTube URLs, Embeds, and Timestamps
 */

export function parseYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const cleanUrl = url.trim()
  
  // Handles standard watch URLs: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = cleanUrl.match(/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/)
  if (watchMatch && watchMatch[1]) return watchMatch[1]

  // Handles short URLs: https://youtu.be/VIDEO_ID
  const shortMatch = cleanUrl.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (shortMatch && shortMatch[1]) return shortMatch[1]

  // Handles embed URLs: https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = cleanUrl.match(/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (embedMatch && embedMatch[1]) return embedMatch[1]

  // Handles shorts URLs: https://www.youtube.com/shorts/VIDEO_ID
  const shortsMatch = cleanUrl.match(/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1]

  // If raw 11-char ID passed
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl

  return null
}

export function getYouTubeEmbedUrl(url: string, startSeconds: number = 0, autoplay: boolean = false): string | null {
  const videoId = parseYouTubeVideoId(url)
  if (!videoId) return null

  let embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`
  if (startSeconds > 0) {
    embedUrl += `&start=${startSeconds}`
  }
  if (autoplay) {
    embedUrl += `&autoplay=1`
  }

  return embedUrl
}

export function parseTimestampToSeconds(input: string | number): number {
  if (typeof input === 'number') return Math.max(0, Math.floor(input))
  if (!input) return 0

  const str = String(input).trim()
  if (!str) return 0

  // Format MM:SS or HH:MM:SS
  if (str.includes(':')) {
    const parts = str.split(':').map(Number)
    if (parts.length === 2) {
      const [m, s] = parts
      return (m || 0) * 60 + (s || 0)
    } else if (parts.length === 3) {
      const [h, m, s] = parts
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
    }
  }

  // Raw seconds integer
  const parsed = parseInt(str, 10)
  return isNaN(parsed) ? 0 : Math.max(0, parsed)
}

export function formatSecondsToTimestamp(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0))
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60

  const pad = (n: number) => String(n).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}
