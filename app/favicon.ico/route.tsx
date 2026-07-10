import { renderBrandIcon } from '@/lib/brand-icon'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export async function GET() {
  return renderBrandIcon(size.width)
}
