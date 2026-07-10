import { renderBrandIcon } from '@/lib/brand-icon'

export const runtime = 'edge'
export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return renderBrandIcon(size.width, { rounded: false })
}
