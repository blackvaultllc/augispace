'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'

const BANNERS: Record<string, { src: string; alt: string }> = {
  '/approach': { src: '/augi-protection-network.png', alt: 'Four colleagues discuss a network graph on a large wall display in a dim office.' },
  '/careers': { src: '/augi-protection-network.png', alt: 'Four colleagues discuss a network graph on a large wall display in a dim office.' },
  '/compliance': { src: '/augi-diverse-protection.png', alt: 'A presenter points to a network diagram on a screen while a team listens around a table.' },
  '/plans': { src: '/augi-community-research.png', alt: 'Two analysts review a city map on a touch-screen table in an operations room.' },
  '/demo': { src: '/augi-signal-core.png', alt: 'A glowing sphere ringed by thin orbits against a field of stars.' },
}

export function InnerBanner() {
  const pathname = usePathname()
  const banner = pathname ? BANNERS[pathname] : undefined
  if (!banner) return null
  return (
    <figure className="inner-banner section-wrap">
      <Image src={banner.src} alt={banner.alt} width={1376} height={768} sizes="(max-width: 900px) 100vw, 1100px" />
      <figcaption>Illustrative image</figcaption>
    </figure>
  )
}