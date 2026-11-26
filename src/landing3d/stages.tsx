import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import { Stage } from './Stage'
import { DeckScene } from './DeckScene'
import { FriendBubbles, FriendsScene } from './FriendsScene'
import { EmojiPit, type PitInput } from './EmojiPit'

/** Pulls the camera back on narrow screens so the whole scene stays in frame horizontally. */
function FitWidth({ width, height, distance }: { width: number; height: number; distance: number }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const size = useThree((state) => state.size)
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const halfFov = (camera.fov * Math.PI) / 360
    const forHeight = height / 2 / Math.tan(halfFov)
    const forWidth = width / 2 / (Math.tan(halfFov) * aspect)
    camera.position.z = Math.max(distance, forHeight, forWidth)
    camera.updateProjectionMatrix()
  }, [camera, distance, height, size.height, size.width, width])
  return null
}

export function HeroStage({ still, fallback }: { still: boolean; fallback: ReactNode }) {
  const pointer = useRef<[number, number]>([0, 0])
  return <Stage className="stage--hero" label="A deck of Chat Wrapped cards shuffles itself, fans out and shows one card" fallback={fallback} camera={{ position: [0, 0.3, 7], fov: 34 }} onPointer={(x, y) => { pointer.current = [x, y] }}>
    <FitWidth width={3.9} height={4.1} distance={7} />
    <DeckScene pointer={pointer} still={still} />
  </Stage>
}

export function FriendsStage({ still, fallback }: { still: boolean; fallback: ReactNode }) {
  const anchors = useRef<(HTMLDivElement | null)[]>([])
  const [beat, setBeat] = useState(-1)
  return <div className="friends-stage">
    <Stage className="stage--friends" label="Two friends on a couch laugh at their phones while messages pop up" fallback={fallback} camera={{ position: [0, 1.0, 7.4], fov: 32 }}>
      <FitWidth width={5.8} height={3.6} distance={7.4} />
      <FriendsScene still={still} onBeat={setBeat} anchors={anchors} />
    </Stage>
    <FriendBubbles beat={beat} anchors={anchors} />
  </div>
}

export function EmojiStage({ still, fallback, children }: { still: boolean; fallback: ReactNode; children?: ReactNode }) {
  const input = useRef<PitInput>({ pointer: null, bursts: [] })
  const [max] = useState(() => window.innerWidth < 700 ? 20 : 30)
  const at = (event: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const box = event.currentTarget.getBoundingClientRect()
    return [(event.clientX - box.left) / box.width * 2 - 1, -((event.clientY - box.top) / box.height * 2 - 1)]
  }
  return <div className="emoji-stage"
    onPointerMove={(event) => { input.current.pointer = at(event) }}
    onPointerLeave={() => { input.current.pointer = null }}
    onPointerDown={(event) => { if (!(event.target as HTMLElement).closest('button, a')) input.current.bursts.push(at(event)) }}>
    <Stage className="stage--emoji" label="Bouncy 3D emojis pile up at the bottom of the page; move or tap to toss them" fallback={fallback} camera={{ position: [0, 0, 10], fov: 30 }}>
      <EmojiPit input={input} still={still} max={max} />
    </Stage>
    {children}
  </div>
}
