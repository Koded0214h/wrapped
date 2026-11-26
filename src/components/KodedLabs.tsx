import { brand } from '../config/brand'

/** The KodedLabs KL monogram, drawn so it takes the surrounding text colour and survives image export. */
export function KodedMark() {
  return <svg className="koded-mark" viewBox="17 11 396 459" aria-hidden="true" focusable="false" fill="currentColor">
    <polygon points="17,11 90,53 90,378 17,330" />
    <polygon points="103,180 264,59 326,100 326,400 413,400 413,470 264,470 264,146 103,260" />
    <polygon points="105,272 162,235 251,310 251,470 199,436 199,355" />
  </svg>
}

export const credit = `A ${brand.studio} production`
