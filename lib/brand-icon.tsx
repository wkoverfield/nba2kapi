import { ImageResponse } from 'next/og'

// Google's css2 endpoint serves TTF (which satori can consume, unlike woff2)
// only to old user agents.
const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&text=2k'
const LEGACY_UA = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534.30'

let fontPromise: Promise<ArrayBuffer | null> | null = null

function loadDisplayFont(): Promise<ArrayBuffer | null> {
  fontPromise ??= (async () => {
    try {
      const css = await (
        await fetch(FONT_CSS_URL, { headers: { 'User-Agent': LEGACY_UA } })
      ).text()
      const url = css.match(/src:\s*url\((.+?)\)/)?.[1]
      if (!url) return null
      return await (await fetch(url)).arrayBuffer()
    } catch {
      // Icon still renders in satori's default font if Google is unreachable.
      return null
    }
  })()
  return fontPromise
}

/**
 * The favicon/app-icon tile: paper-palette "2k" monogram matching the
 * nba2kapi wordmark. `rounded: false` for apple-icon (iOS masks corners).
 */
export async function renderBrandIcon(px: number, { rounded = true } = {}) {
  const font = await loadDisplayFont()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1918',
          borderRadius: rounded ? Math.round(px * 0.22) : 0,
          color: '#faf9f5',
          fontFamily: 'Bricolage Grotesque',
          fontSize: Math.round(px * 0.62),
          fontWeight: 800,
          letterSpacing: '-0.04em',
        }}
      >
        2k
      </div>
    ),
    {
      width: px,
      height: px,
      fonts: font
        ? [{ name: 'Bricolage Grotesque', data: font, weight: 800, style: 'normal' }]
        : undefined,
    }
  )
}
