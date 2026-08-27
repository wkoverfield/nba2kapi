import { ImageResponse } from 'next/og'

// Bricolage Grotesque 800, subset to the "2k" glyphs (OFL). Bundled because
// satori needs raw TTF bytes and fetching Google Fonts at request time proved
// unreliable: an HTML error page in place of the font crashes rendering with
// "Unsupported OpenType signature".
const FONT_URL = new URL('./bricolage-grotesque-800-2k.ttf', import.meta.url)

let fontPromise: Promise<ArrayBuffer | null> | null = null

function loadDisplayFont(): Promise<ArrayBuffer | null> {
  fontPromise ??= fetch(FONT_URL)
    .then((res) => res.arrayBuffer())
    .catch(() => null) // Icon still renders in satori's default font.
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
