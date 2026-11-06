import type { Member } from '../analysis/types'

type CharacterSize = 'xs' | 'sm' | 'md' | 'lg'
type Props = { member: Pick<Member, 'id' | 'name'>; size?: CharacterSize; className?: string }

function hashId(value: string) {
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

export function characterStyleFor(memberId: string) {
  const hash = hashId(memberId)
  return { hair: hash % 5, face: (hash >>> 3) % 3, outfit: (hash >>> 6) % 3, accessory: (hash >>> 9) % 4 }
}

export function MemberCharacter({ member, size = 'sm', className = '' }: Props) {
  const style = characterStyleFor(member.id)
  const faceY = style.face === 0 ? 22 : style.face === 1 ? 21 : 23
  return <span className={`member-character member-character--${size} ${className}`.trim()} role="img" aria-label={`${member.name} character`}>
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle className="member-character__backdrop" cx="32" cy="32" r="31" />
      <path className={`member-character__outfit member-character__outfit--${style.outfit}`} d="M12 63c1-14 8-22 20-22s19 8 20 22H12Z" />
      <path className="member-character__neck" d="M26 37h12v11H26z" />
      <rect className="member-character__face" x="19" y={faceY} width="26" height="25" rx={style.face === 2 ? 9 : 12} />
      {style.hair === 0 && <path className="member-character__hair" d="M18 28c0-12 6-18 15-18 10 0 15 7 14 20-5-6-13-8-24-5l-5 3Z" />}
      {style.hair === 1 && <><circle className="member-character__hair" cx="20" cy="18" r="8"/><circle className="member-character__hair" cx="44" cy="18" r="8"/><path className="member-character__hair" d="M18 27c2-12 8-17 15-17 9 0 14 6 14 19-9-6-18-7-29-2Z"/></>}
      {style.hair === 2 && <path className="member-character__hair" d="M17 29c1-14 7-20 17-20 8 0 13 4 15 13-8-3-16-2-23 3l-9 4Z" />}
      {style.hair === 3 && <path className="member-character__hair" d="M18 27c0-10 5-17 14-17 10 0 16 6 16 18l-5-5-4 3-5-5-5 5-5-4-6 5Z" />}
      {style.hair === 4 && <><path className="member-character__hair" d="M18 28c0-12 6-18 15-18 10 0 15 7 14 20-5-5-14-8-24-5l-5 3Z"/><path className="member-character__accent" d="M17 19h31v6H17z"/></>}
      <circle className="member-character__eye" cx="27" cy="32" r="1.6" />
      <circle className="member-character__eye" cx="37" cy="32" r="1.6" />
      {style.accessory === 0 && <><rect className="member-character__glasses" x="22" y="28" width="9" height="7" rx="3"/><rect className="member-character__glasses" x="33" y="28" width="9" height="7" rx="3"/><path className="member-character__glasses-line" d="M31 31h2"/></>}
      {style.accessory === 1 && <circle className="member-character__accent" cx="47" cy="35" r="2.4" />}
      <path className="member-character__mouth" d={style.face === 1 ? 'M28 39c3 2 5 2 8 0' : style.face === 2 ? 'M29 40h6' : 'M28 38c2 4 6 4 8 0'} />
      {style.outfit === 1 && <path className="member-character__accent-line" d="M26 47l6 7 6-7" />}
      {style.outfit === 2 && <circle className="member-character__accent" cx="32" cy="51" r="3" />}
    </svg>
  </span>
}
