import { useId, type ReactNode } from 'react'
import type { Member } from '../analysis/types'

type CharacterSize = 'xs' | 'sm' | 'md' | 'lg'
type Props = { member: Pick<Member, 'id' | 'name'>; size?: CharacterSize; className?: string }

function hashId(value: string) {
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

// Skin: base, shadow, highlight, lip. Weighted toward deeper tones, which most of the audience shares.
const skins = [
  ['#4b2c1e', '#371f13', '#6d4532', '#3a1d16'],
  ['#5b3825', '#45291a', '#7e543b', '#43231b'],
  ['#6c432d', '#523220', '#8f6146', '#4e281f'],
  ['#7c4e35', '#613b27', '#a0704f', '#5a2e25'],
  ['#8e5b3c', '#71462d', '#b07a55', '#66372b'],
  ['#5f3a27', '#47291b', '#83593f', '#45241c'],
  ['#a26c47', '#835535', '#c28c64', '#763f33'],
  ['#c08a62', '#9f6f4b', '#dcab84', '#995a49']
] as const
const hairs = [
  ['#17100d', '#3a2a22'],
  ['#1e1410', '#46332a'],
  ['#2a1a12', '#5a3d2c'],
  ['#17100d', '#3a2a22'],
  ['#5e1d27', '#8f3442'],
  ['#9b6531', '#d39a52']
] as const

export const hairStyles = ['fade', 'afro', 'puffs', 'braids', 'locs', 'wrap', 'bald', 'bun', 'hightop', 'cornrows', 'curls', 'bob'] as const
type Hair = typeof hairStyles[number]
const bearded: Hair[] = ['fade', 'bald', 'hightop', 'curls', 'cornrows']

export function characterStyleFor(memberId: string) {
  const hash = hashId(memberId)
  const second = hashId(`${memberId}·look`)
  const hair = hash % hairStyles.length
  const style = hairStyles[hair]
  const longHair = style === 'braids' || style === 'locs' || style === 'bob'
  return {
    hair,
    skin: (hash >>> 4) % skins.length,
    // Dyed colours only on styles where they read naturally.
    hairColor: longHair || style === 'puffs' ? second % hairs.length : second % 3,
    face: (hash >>> 8) % 3,
    expression: (hash >>> 11) % 4,
    outfit: (hash >>> 14) % 5,
    accessory: (second >>> 5) % 5,
    facialHair: bearded.includes(style) ? (second >>> 9) % 4 : 0,
    tone: (second >>> 13) % 4
  }
}

const facePaths = [
  'M60 30C74.5 30 83 40.5 83 55.5C83 70 74 81.5 60 82.5C46 81.5 37 70 37 55.5C37 40.5 45.5 30 60 30Z',
  'M60 30C75 30 84 40 84 55C84 71 73.5 82 60 82C46.5 82 36 71 36 55C36 40 45 30 60 30Z',
  'M60 30C74 30 82.5 40.5 82.5 54.5C82.5 67.5 73 80 60 83C47 80 37.5 67.5 37.5 54.5C37.5 40.5 46 30 60 30Z'
]

function Braid({ x, top, bottom, width = 4.6, color, shine, bead }: { x: number; top: number; bottom: number; width?: number; color: string; shine: string; bead?: string }) {
  const ticks: ReactNode[] = []
  for (let y = top + 3; y < bottom - 2; y += 3.6) ticks.push(<path key={y} d={`M${x - width / 2 + .6} ${y}L${x + width / 2 - .6} ${y + 1.9}`} stroke={shine} strokeWidth=".9" strokeLinecap="round" opacity=".55" />)
  return <g>
    <rect x={x - width / 2} y={top} width={width} height={bottom - top} rx={width / 2} fill={color} />
    {ticks}
    {bead && <circle cx={x} cy={bottom + 1.2} r={width / 2 + .4} fill={bead} />}
  </g>
}

function Loc({ x, top, bottom, color, shine }: { x: number; top: number; bottom: number; color: string; shine: string }) {
  const knots: ReactNode[] = []
  for (let y = top + 4; y < bottom - 2; y += 6) knots.push(<ellipse key={y} cx={x} cy={y} rx="3.5" ry="2.6" fill={color} stroke={shine} strokeOpacity=".35" strokeWidth=".7" />)
  return <g><rect x={x - 3} y={top} width="6" height={bottom - top} rx="3" fill={color} />{knots}</g>
}

/** Scattered texture so coily hair reads as hair, not as a flat shape. */
function Coils({ cx, cy, r, color, count = 34 }: { cx: number; cy: number; r: number; color: string; count?: number }) {
  return <g opacity=".3">{Array.from({ length: count }, (_, index) => {
    const angle = index * 2.39996
    const distance = Math.sqrt((index + .5) / count) * r
    return <circle key={index} cx={cx + Math.cos(angle) * distance} cy={cy + Math.sin(angle) * distance} r={1.25 + (index % 3) * .35} fill="none" stroke={color} strokeWidth=".8" />
  })}</g>
}

export function MemberCharacter({ member, size = 'sm', className = '' }: Props) {
  const look = characterStyleFor(member.id)
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (name: string) => `mc${raw}${name}`
  const [skin, shade, light, lip] = skins[look.skin]
  const [hair, shine] = hairs[look.hairColor]
  const style = hairStyles[look.hair]
  const laughing = look.expression === 3
  const face = facePaths[look.face]

  const back: Partial<Record<Hair, ReactNode>> = {
    afro: <g><circle cx="60" cy="45" r="33" fill={hair} /><Coils cx={60} cy={42} r={30} color={shine} count={46} /></g>,
    puffs: <g>
      <circle cx="34" cy="29" r="14.5" fill={hair} /><Coils cx={34} cy={29} r={12.5} color={shine} count={16} />
      <circle cx="86" cy="29" r="14.5" fill={hair} /><Coils cx={86} cy={29} r={12.5} color={shine} count={16} />
    </g>,
    wrap: <g>
      <path className="member-character__wrap" d="M29 44C22 26 38 9 58 10C80 8 99 24 91 44C80 36 70 33 60 33C49 33 39 36 29 44Z" />
      <path className="member-character__wrap-fold" d="M37 22C48 15 66 13 82 20M33 32C46 24 70 22 88 31M58 10C64 16 66 25 64 33" />
      <g className="member-character__wrap-dots">{[[44, 20], [56, 16], [70, 18], [80, 26], [40, 31], [52, 25], [66, 26], [76, 34]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />)}</g>
    </g>,
    bun: <g><circle cx="60" cy="19" r="11" fill={hair} /><path d="M52 17C56 13 64 13 68 17" stroke={shine} strokeWidth="1.2" fill="none" opacity=".5" strokeLinecap="round" /></g>,
    hightop: <g><path d="M37.5 52L36.5 21C36.5 13 41 9.5 48 9.5L72 9.5C79 9.5 83.5 13 83.5 21L82.5 52Z" fill={hair} /><Coils cx={60} cy={24} r={18} color={shine} count={22} /></g>,
    bob: <path d="M33.5 54C31.5 33 43.5 21 60 21C76.5 21 88.5 33 86.5 54L88.5 85C81 90 74.5 88.5 72 84L48 84C45.5 88.5 39 90 31.5 85Z" fill={hair} />
  }

  const strands: Partial<Record<Hair, ReactNode>> = {
    braids: <g>
      {[33, 38.5, 44].map((x, index) => <Braid key={x} x={x} top={44 + index * 3} bottom={106 - index * 4} color={hair} shine={shine} bead={index === 1 ? 'var(--accent)' : undefined} />)}
      {[87, 81.5, 76].map((x, index) => <Braid key={x} x={x} top={44 + index * 3} bottom={106 - index * 4} color={hair} shine={shine} bead={index === 1 ? 'var(--accent)' : undefined} />)}
    </g>,
    locs: <g>
      {[33, 39.5].map((x, index) => <Loc key={x} x={x} top={42 + index * 4} bottom={98 - index * 3} color={hair} shine={shine} />)}
      {[87, 80.5].map((x, index) => <Loc key={x} x={x} top={42 + index * 4} bottom={98 - index * 3} color={hair} shine={shine} />)}
    </g>
  }

  const capHairline = 'M37 53C35.5 36 46 26.5 60 26.5C74 26.5 84.5 36 83 53C80.5 43.5 72.5 38 60 38C47.5 38 39.5 43.5 37 53Z'
  const front: Record<Hair, ReactNode> = {
    fade: <g>
      <path d="M36.5 54C35 36 45 24.5 60 24.5C75 24.5 85 36 83.5 54C82.6 48 81 44 78.5 41.5C74 38.6 68 37.4 60 37.6C52 37.4 46 38.6 41.5 41.5C39 44 37.4 48 36.5 54Z" fill={hair} />
      <path d="M44 31C49 27.5 55 26.5 61 26.6" stroke={shine} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".55" />
      <path d="M36.8 50L38.6 59M83.2 50L81.4 59" stroke={hair} strokeWidth="2.6" strokeLinecap="round" opacity=".85" />
    </g>,
    afro: <path d="M37.5 54C37 41 46 34.5 60 34.5C74 34.5 83 41 82.5 54C79.5 45 72 41 60 41C48 41 40.5 45 37.5 54Z" fill={hair} />,
    puffs: <g>
      <path d={capHairline} fill={hair} />
      <path d="M60 27L60 38" stroke={skin} strokeWidth="1.1" opacity=".8" />
      <ellipse cx="44" cy="35" rx="3.2" ry="2" fill="var(--accent-2)" transform="rotate(-38 44 35)" />
      <ellipse cx="76" cy="35" rx="3.2" ry="2" fill="var(--accent-2)" transform="rotate(38 76 35)" />
    </g>,
    braids: <g>
      <path d={capHairline} fill={hair} />
      <path d="M60 27L60 38M51 28.5C46 33 42 40 39.5 47M69 28.5C74 33 78 40 80.5 47M55.5 27.4C52 32 50 36 48.6 39.6M64.5 27.4C68 32 70 36 71.4 39.6" stroke={shine} strokeWidth=".95" fill="none" opacity=".55" strokeLinecap="round" />
    </g>,
    locs: <g>
      <path d={capHairline} fill={hair} />
      <Loc x={47} top={30} bottom={45} color={hair} shine={shine} />
      <Loc x={71} top={30} bottom={43} color={hair} shine={shine} />
    </g>,
    wrap: <g>
      <path className="member-character__wrap" d="M35.5 49C37 33 47 27 60 27C73 27 83 33 84.5 49C76.5 42.5 68.5 40 60 40C51.5 40 43.5 42.5 35.5 49Z" />
      <path className="member-character__wrap-fold" d="M38 44C46 37 54 35 60 35C67 35 75 37 82 44" />
    </g>,
    bald: <ellipse cx="53" cy="36" rx="7" ry="3.2" fill="#fff" opacity=".16" transform="rotate(-18 53 36)" />,
    bun: <g>
      <path d="M37 53C35.5 36 46 26.5 60 26.5C74 26.5 84.5 36 83 53C80 44 72 38.5 60 38.5C48 38.5 40 44 37 53Z" fill={hair} />
      <path d="M45 31C51 27.5 57 27 62 27.4" stroke={shine} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".5" />
      <path d="M39.6 47.5C38.2 49 38.4 51 40.2 51.4" stroke={hair} strokeWidth="1" fill="none" strokeLinecap="round" />
      <rect x="55" y="26.6" width="10" height="3.4" rx="1.7" fill="var(--accent-2)" />
    </g>,
    hightop: <path d="M37 54C36.5 44 39 40 42 39C48 37.6 54 37.4 60 37.4C66 37.4 72 37.6 78 39C81 40 83.5 44 83 54C81.5 47 79 43 75 42C70 41 50 41 45 42C41 43 38.5 47 37 54Z" fill={hair} />,
    cornrows: <g>
      <path d="M36.8 54C35.3 36 45.5 25 60 25C74.5 25 84.7 36 83.2 54C81.5 45 74 38.6 60 38.6C46 38.6 38.5 45 36.8 54Z" fill={hair} />
      {[-15, -9, -3, 3, 9, 15].map((offset) => <path key={offset} d={`M${60 + offset * 1.3} 39C${60 + offset * 1.1} 33.5 ${60 + offset * .85} 29.5 ${60 + offset * .55} 26.6`} stroke={shine} strokeWidth="1" fill="none" opacity=".6" strokeLinecap="round" />)}
    </g>,
    curls: <g>
      <path d="M37 53C35.5 37 45 27 60 27C75 27 84.5 37 83 53C80 44 72 39 60 39C48 39 40 44 37 53Z" fill={hair} />
      {[[40, 41, 6], [45, 33.5, 6.6], [53, 29, 6.8], [62, 27.6, 7], [71, 29.6, 6.8], [78, 35, 6.4], [81.5, 43, 5.6], [49, 38, 5.2], [58, 36, 5.4], [68, 36.6, 5.4], [75, 40.6, 5]].map(([x, y, r]) => <g key={`${x}${y}`}><circle cx={x} cy={y} r={r} fill={hair} /><path d={`M${x - r * .5} ${y - r * .1}A${r * .55} ${r * .55} 0 0 1 ${x + r * .35} ${y - r * .45}`} stroke={shine} strokeWidth=".9" fill="none" opacity=".6" strokeLinecap="round" /></g>)}
    </g>,
    bob: <g>
      <path d="M36.5 56C35.5 37 46 26 62 26C76 27 84.5 36 83.5 52C78 43 70.5 37 58.5 38.5C50 39.8 43 46 36.5 56Z" fill={hair} />
      <path d="M48 31C54 28 61 27.5 67 28.4" stroke={shine} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".5" />
    </g>
  }

  const outfits = [
    // crew neck tee
    <g key="crew"><path className="member-character__collar" d="M47.5 92.5Q60 103 72.5 92.5" /></g>,
    // hoodie with strings
    <g key="hoodie"><path className="member-character__hood" d="M37.5 98C39 87.5 49 88 60 92.6C71 88 81 87.5 82.5 98C76 101.5 69 101.5 60 102C51 101.5 44 101.5 37.5 98Z" /><path d="M54.5 101L53.6 115M65.5 101L66.4 115" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".85" /><circle cx="53.6" cy="116" r="1.3" fill="#fff" /><circle cx="66.4" cy="116" r="1.3" fill="#fff" /></g>,
    // open shirt collar
    <g key="shirt"><path d={`M51 91L60 102L69 91Z`} fill={skin} /><path className="member-character__shirt-collar" d="M46.5 90.5L60 101L52.5 106.5L44 95ZM73.5 90.5L60 101L67.5 106.5L76 95Z" /><circle cx="60" cy="110" r="1.1" fill="#fff" opacity=".8" /><circle cx="60" cy="117" r="1.1" fill="#fff" opacity=".8" /></g>,
    // embroidered native neckline
    <g key="native"><path className="member-character__collar" d="M47.5 92.5Q60 103 72.5 92.5" /><path className="member-character__embroidery" d="M48.5 96.5Q60 106 71.5 96.5M60 101.5L60 120M56.5 106L60 109.5L63.5 106M56.5 113L60 116.5L63.5 113" /></g>,
    // turtleneck
    <g key="turtle"><path className="member-character__turtle" d="M49 84.5L71 84.5L72.5 95.5Q60 100 47.5 95.5Z" /><path d="M49.5 88.5Q60 91 70.5 88.5M49 92Q60 95 71 92" stroke="#000" strokeOpacity=".14" strokeWidth="1" fill="none" /></g>
  ]

  const eyes = laughing
    ? <g className="member-character__lid"><path d="M45 57.4Q50.5 52.4 56 57.4" /><path d="M64 57.4Q69.5 52.4 75 57.4" /></g>
    : <g>
      <clipPath id={id('eyes')}><path d="M44.4 56.3Q50.5 51.2 56.6 56.3Q50.5 60.4 44.4 56.3ZM63.4 56.3Q69.5 51.2 75.6 56.3Q69.5 60.4 63.4 56.3Z" /></clipPath>
      <path d="M44.4 56.3Q50.5 51.2 56.6 56.3Q50.5 60.4 44.4 56.3ZM63.4 56.3Q69.5 51.2 75.6 56.3Q69.5 60.4 63.4 56.3Z" fill="#fbf5ee" />
      <g clipPath={`url(#${id('eyes')})`}>
        {[50.8, 69.8].map((x) => <g key={x}><circle cx={x} cy="56.1" r="3.3" fill="#3b2116" /><circle cx={x} cy="56.1" r="1.7" fill="#0e0806" /><circle cx={x + 1.2} cy="54.9" r=".95" fill="#fff" /></g>)}
      </g>
      <g className="member-character__lid"><path d="M43.8 56.2Q50.5 50.6 57.1 55.6" /><path d="M76.2 56.2Q69.5 50.6 62.9 55.6" /></g>
      {look.tone % 2 === 0 && <g className="member-character__lid"><path d="M56.8 55.4L58.9 53.8" /><path d="M63.2 55.4L61.1 53.8" /></g>}
      <path d="M46.5 58.4Q50.5 60.2 54.5 58.4M65.5 58.4Q69.5 60.2 73.5 58.4" stroke={shade} strokeWidth=".7" fill="none" opacity=".6" strokeLinecap="round" />
    </g>

  const browLift = look.expression === 2 ? -1.6 : 0
  const brows = <g fill={hair}>
    <path d={`M43.5 ${49.8 + browLift}C46 ${46.8 + browLift} 51 ${46 + browLift} 56.5 ${47.8 + browLift}L56.2 ${49.6 + browLift}C51 ${48.4 + browLift} 47 ${48.8 + browLift} 44 ${50.9 + browLift}Z`} />
    <path d="M76.5 49.8C74 46.8 69 46 63.5 47.8L63.8 49.6C69 48.4 73 48.8 76 50.9Z" />
  </g>

  const mouths = [
    // soft smile
    <g key="smile"><path d="M52.8 72.6Q56.5 71.2 60 72.3Q63.5 71.2 67.2 72.6Q60 74.4 52.8 72.6Z" fill={lip} /><path d="M53.4 73.1Q60 79.4 66.6 73.1Q60 75.3 53.4 73.1Z" fill={lip} opacity=".82" /><path d="M52.6 72.8Q60 75.8 67.4 72.8" stroke="#1e0e0a" strokeWidth=".95" fill="none" strokeLinecap="round" opacity=".75" /><ellipse cx="60" cy="76" rx="3" ry=".9" fill="#fff" opacity=".14" /></g>,
    // grin with teeth
    <g key="grin"><path d="M51.8 71.8Q60 73.6 68.2 71.8Q66.8 80.6 60 80.8Q53.2 80.6 51.8 71.8Z" fill="#3a130f" /><path d="M53 72.6Q60 74.3 67 72.6Q66 76 60 76.4Q54 76 53 72.6Z" fill="#fffaf3" /><ellipse cx="60" cy="78.6" rx="3.8" ry="1.7" fill="#cf5d66" /><path d="M51.8 71.8Q60 73.6 68.2 71.8Q66.8 80.6 60 80.8Q53.2 80.6 51.8 71.8Z" fill="none" stroke={lip} strokeWidth="1.5" strokeLinejoin="round" /></g>,
    // smirk
    <g key="smirk"><path d="M53.5 74Q59 75.8 67 71.6" stroke="#1e0e0a" strokeWidth="1.15" fill="none" strokeLinecap="round" opacity=".8" /><path d="M55 74.6Q60.5 78.6 65.6 73.6Q60.5 75.8 55 74.6Z" fill={lip} opacity=".85" /><path d="M66.6 70.8Q68 71.6 67.6 73" stroke={shade} strokeWidth=".8" fill="none" strokeLinecap="round" /></g>,
    // laughing
    <g key="laugh"><path d="M50.5 70.8Q60 73 69.5 70.8Q68.4 83 60 83.2Q51.6 83 50.5 70.8Z" fill="#3a130f" /><path d="M51.8 71.6Q60 73.6 68.2 71.6Q67.2 75.6 60 76Q52.8 75.6 51.8 71.6Z" fill="#fffaf3" /><ellipse cx="60" cy="80.4" rx="5" ry="2.3" fill="#cf5d66" /><path d="M50.5 70.8Q60 73 69.5 70.8Q68.4 83 60 83.2Q51.6 83 50.5 70.8Z" fill="none" stroke={lip} strokeWidth="1.6" strokeLinejoin="round" /></g>
  ]

  const facialHair = [
    null,
    <g key="beard" fill={hair}><path d="M37.6 57C37.6 72 46 84.6 60 85.4C74 84.6 82.4 72 82.4 57C80.6 65.5 76.6 71.6 70.6 74.4C66.4 70.4 53.6 70.4 49.4 74.4C43.4 71.6 39.4 65.5 37.6 57Z" opacity=".92" /><path d="M52.2 71.4C55 68.8 58 69.4 60 70.5C62 69.4 65 68.8 67.8 71.4C64.2 71 62 71.5 60 72.1C58 71.5 55.8 71 52.2 71.4Z" /></g>,
    <g key="goatee" fill={hair}><path d="M54 78.6Q60 85.6 66 78.6Q60 81.4 54 78.6Z" /><path d="M52.6 71.4C55.2 69 58 69.5 60 70.5C62 69.5 64.8 69 67.4 71.4C64 71.1 62 71.5 60 72C58 71.5 56 71.1 52.6 71.4Z" /></g>,
    <path key="stubble" d="M37.6 57C37.6 72 46 84.6 60 85.4C74 84.6 82.4 72 82.4 57C80.6 65.5 76.6 71.6 70.6 74.4C66.4 70.4 53.6 70.4 49.4 74.4C43.4 71.6 39.4 65.5 37.6 57Z" fill={hair} opacity=".26" />
  ]

  const accessories = [
    null,
    <g key="glasses" className="member-character__glasses"><circle cx="50.5" cy="56" r="7.2" /><circle cx="69.5" cy="56" r="7.2" /><path d="M57.7 55.6Q60 54 62.3 55.6M43.3 55L37.8 53.6M76.7 55L82.2 53.6" fill="none" /><path d="M46 52.4L49 50.6M65 52.4L68 50.6" stroke="#fff" strokeWidth="1.1" opacity=".55" strokeLinecap="round" /></g>,
    <g key="hoops" fill="none" stroke="#e7b548" strokeWidth="1.5"><circle cx="36.6" cy="68.4" r="3.6" /><circle cx="83.4" cy="68.4" r="3.6" /></g>,
    <g key="studs" fill="#f4d27a"><circle cx="36.8" cy="64.6" r="1.6" /><circle cx="83.2" cy="64.6" r="1.6" /></g>,
    null
  ]

  return <span className={`member-character member-character--${size} ${className}`.trim()} role="img" aria-label={`${member.name} character`}>
    <svg viewBox="11 9 98 98" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={id('round')}><circle cx="60" cy="60" r="60" /></clipPath>
        <radialGradient id={id('skin')} cx=".42" cy=".36" r=".78"><stop offset="0" stopColor={light} /><stop offset=".55" stopColor={skin} /><stop offset="1" stopColor={shade} /></radialGradient>
        <radialGradient id={id('glow')} cx=".3" cy=".22" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <linearGradient id={id('cloth')} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#000" stopOpacity=".2" /><stop offset=".35" stopColor="#fff" stopOpacity=".08" /><stop offset=".7" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".22" /></linearGradient>
      </defs>
      <g clipPath={`url(#${id('round')})`}>
        <circle className="member-character__backdrop" cx="60" cy="60" r="60" />
        <circle cx="60" cy="60" r="60" fill={`url(#${id('glow')})`} />
        <circle className="member-character__halo" cx="60" cy="54" r="40" />
        {back[style]}
        <path className={`member-character__outfit member-character__outfit--${look.tone}`} d="M7 124C9 104 27 94.5 47 92L73 92C93 94.5 111 104 113 124Z" />
        <path d="M7 124C9 104 27 94.5 47 92L73 92C93 94.5 111 104 113 124Z" fill={`url(#${id('cloth')})`} />
        <path d="M50 73L50 92Q60 99.5 70 92L70 73Z" fill={skin} />
        <path d="M50 77Q60 86.5 70 77L70 84Q60 92 50 84Z" fill={shade} opacity=".6" />
        {outfits[look.outfit]}
        {strands[style]}
        <ellipse cx="37" cy="58" rx="4.6" ry="7.2" fill={skin} />
        <path d="M37.8 53.6Q34.8 58 37.6 62.6" stroke={shade} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <ellipse cx="83" cy="58" rx="4.6" ry="7.2" fill={skin} />
        <path d="M82.2 53.6Q85.2 58 82.4 62.6" stroke={shade} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d={face} fill={`url(#${id('skin')})`} />
        <ellipse cx="46.5" cy="66" rx="4.6" ry="2.6" fill="#e5675b" opacity={laughing ? .3 : .17} />
        <ellipse cx="73.5" cy="66" rx="4.6" ry="2.6" fill="#e5675b" opacity={laughing ? .3 : .17} />
        <path d="M60 56.5L60 62.8" stroke={light} strokeWidth="1.5" strokeLinecap="round" opacity=".45" />
        <path d="M55.6 63.6C54 66.6 56.4 68.6 58.6 67.7M64.4 63.6C66 66.6 63.6 68.6 61.4 67.7" stroke={shade} strokeWidth="1.25" fill="none" strokeLinecap="round" />
        <path d="M57.8 68.2Q60 69.3 62.2 68.2" stroke={shade} strokeWidth="1" fill="none" strokeLinecap="round" opacity=".7" />
        <ellipse cx="60" cy="65.2" rx="2.1" ry="1.25" fill={light} opacity=".5" />
        {eyes}
        {brows}
        {facialHair[look.facialHair]}
        {mouths[look.expression]}
        {front[style]}
        {accessories[look.accessory]}
      </g>
    </svg>
  </span>
}
