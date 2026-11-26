import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { BoxGeometry, Color, Group, MathUtils, MeshStandardMaterial, Vector2, type Texture } from 'three'
import { faceCount, makeBackTexture, makeFaceTextures } from './cardArt'

const W = 0.92
const H = W * 16 / 9
const D = 0.0082
const N = 24
const LOOP = 11
const HALF = N / 2
const FEATURED = 12

const easeInOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
const between = (t: number, start: number, end: number) => easeInOut(MathUtils.clamp((t - start) / (end - start), 0, 1))
/** A falling card: accelerates, lands, and settles with a tiny rebound. */
const fall = (t: number, start: number, end: number) => {
  const p = MathUtils.clamp((t - start) / (end - start), 0, 1)
  return p < .82 ? (p / .82) ** 2 : 1 + Math.sin((p - .82) / .18 * Math.PI) * 0.04
}
const jitter = (i: number) => (Math.sin(i * 91.7) * 43758.5453) % 1

/** After a riffle the two halves alternate: bottom half takes the even places, top half the odd ones. */
const slotAfterRiffle = (i: number) => i < HALF ? i * 2 : (i - HALF) * 2 + 1

type CardUniforms = { uBend: { value: number }; uBendX: { value: number } }

/**
 * Paper card material: bends in the vertex shader (along its length and across its width)
 * and cuts rounded corners in the fragment shader, so one subdivided box reads as a real card.
 */
function cardMaterial(uniforms: CardUniforms, options: ConstructorParameters<typeof MeshStandardMaterial>[0]) {
  const material = new MeshStandardMaterial(options)
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uHalf: { value: new Vector2(W / 2, H / 2) }, uRadius: { value: 0.065 } })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uBend;\nuniform float uBendX;\nuniform vec2 uHalf;\nvarying vec2 vCardXY;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float cardNy = position.y / uHalf.y;
        float cardNx = position.x / uHalf.x;
        objectNormal.y += 2.0 * uBend * position.y / (uHalf.y * uHalf.y) * objectNormal.z;
        objectNormal.x += 2.0 * uBendX * position.x / (uHalf.x * uHalf.x) * objectNormal.z;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vCardXY = position.xy;
        transformed.z += uBend * (1.0 - cardNy * cardNy) + uBendX * (1.0 - cardNx * cardNx);`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uHalf;\nuniform float uRadius;\nvarying vec2 vCardXY;')
      .replace('void main() {', `void main() {
        vec2 cardQ = abs(vCardXY) - (uHalf - uRadius);
        if (length(max(cardQ, 0.0)) + min(max(cardQ.x, cardQ.y), 0.0) - uRadius > 0.0) discard;`)
  }
  material.customProgramCacheKey = () => 'chat-wrapped-card'
  return material
}

/** Printed art keeps its colours: lit for shape and gloss, with the print added back as emission. */
const printed = (map: Texture | null, uniforms: CardUniforms) => cardMaterial(uniforms, { map, emissiveMap: map, emissive: new Color('#ffffff'), emissiveIntensity: map ? 0.5 : 0, color: map ? '#c8c8c8' : '#fbf4ea', roughness: 0.42, metalness: 0 })

type Card = { uniforms: CardUniforms; face: MeshStandardMaterial; materials: MeshStandardMaterial[] }

/**
 * The hero loop, all as a pure function of time so it is smooth at any frame rate:
 * a squared deck is cut, riffled together, bridged, squared, stood up, spread into a fan
 * with a domino turnover, one card is shown, and it all folds back down.
 */
export function DeckScene({ pointer, still = false, fixedTime }: { pointer: React.MutableRefObject<[number, number]>; still?: boolean; fixedTime?: number }) {
  const geometry = useMemo(() => new BoxGeometry(W, H, D, 8, 18, 1), [])
  const [faces, setFaces] = useState<Texture[]>([])
  useEffect(() => { let live = true; void makeFaceTextures().then((value) => { if (live) setFaces(value) }); return () => { live = false } }, [])
  const cards = useMemo<Card[]>(() => {
    const back = makeBackTexture()
    return Array.from({ length: N }, () => {
      const uniforms: CardUniforms = { uBend: { value: 0 }, uBendX: { value: 0 } }
      const edge = cardMaterial(uniforms, { color: '#f4ebdd', roughness: 0.85 })
      const face = printed(null, uniforms)
      const backMaterial = printed(back, uniforms)
      // Box faces: +x, -x, +y, -y, +z (back of the card), -z (the printed face)
      return { uniforms, face, materials: [edge, edge, edge, edge, backMaterial, face] }
    })
  }, [])
  useEffect(() => {
    if (!faces.length) return
    cards.forEach((card, index) => { card.face.map = card.face.emissiveMap = faces[index % faceCount]; card.face.emissiveIntensity = 0.5; card.face.color.set('#c8c8c8'); card.face.needsUpdate = true })
  }, [cards, faces])

  const rig = useRef<Group>(null)
  const deck = useRef<Group>(null)
  const nodes = useRef<(Group | null)[]>([])
  const round = useRef(-1)

  useFrame((state) => {
    const time = fixedTime ?? (still ? 7.8 : state.clock.elapsedTime)
    const t = time % LOOP
    const loop = Math.floor(time / LOOP)
    // A new card is featured each round; swap it while every card shows its back.
    if (loop !== round.current && faces.length && t < 5) {
      round.current = loop
      const index = slotOrder[FEATURED]
      cards[index].face.map = cards[index].face.emissiveMap = faces[(loop + 3) % faceCount]
      cards[index].face.needsUpdate = true
    }
    if (rig.current) {
      const [px, py] = pointer.current
      rig.current.rotation.y = MathUtils.lerp(rig.current.rotation.y, px * 0.3 + Math.sin(time * 0.35) * 0.08, 0.05)
      rig.current.rotation.x = MathUtils.lerp(rig.current.rotation.x, -py * 0.12, 0.05)
    }
    const up = between(t, 4.55, 5.25) * (1 - between(t, 10.25, 10.95))
    const tap = Math.sin(MathUtils.clamp((t - 4.42) / 0.16, 0, 1) * Math.PI) * 0.05
    if (deck.current) {
      deck.current.rotation.x = MathUtils.lerp(-1.2, -0.06, up)
      deck.current.rotation.z = MathUtils.lerp(0.22, 0, up)
      deck.current.position.y = MathUtils.lerp(-0.3, 0.05, up) + tap + Math.sin(time * 1.3) * 0.02
      deck.current.scale.setScalar(MathUtils.lerp(1.3, 1, up))
    }

    const cut = between(t, 0.8, 1.5)
    const hold = between(t, 1.2, 1.62)
    const push = between(t, 3.12, 3.62)
    const arch = between(t, 3.68, 4.02)
    const fan = between(t, 5.3, 6.05) * (1 - between(t, 9.85, 10.45))
    const feature = between(t, 7.0, 7.6) * (1 - between(t, 8.55, 9.0))

    cards.forEach((card, i) => {
      const node = nodes.current[i]
      if (!node) return
      const k = slotAfterRiffle(i)
      const top = i >= HALF
      const side = top ? 1 : -1
      const release = 1.7 + k * 0.052 + jitter(i) * 0.012
      const dropped = fall(t, release, release + 0.17)

      // Held in a half: the top half arcs over to the right, both inner edges lift.
      const heldZ = top ? MathUtils.lerp(i * D, (i - HALF) * D, cut) + Math.sin(cut * Math.PI) * 0.32 : i * D
      const heldX = side * 0.52 * cut
      let x = MathUtils.lerp(heldX, side * 0.29, dropped)
      let y = 0
      let z = MathUtils.lerp(heldZ + hold * 0.08, k * D, Math.min(1, dropped))
      let rotY = -side * 0.2 * hold * (1 - Math.min(1, dropped))
      let rotX = Math.sin(Math.min(1, dropped) * Math.PI) * 0.06
      let rotZ = 0
      let bendX = -0.05 * hold * (1 - Math.min(1, dropped)) + Math.sin(Math.min(1, dropped) * Math.PI) * 0.025
      x *= 1 - push * (t > release ? 1 : 0)
      // Before the cut nothing has moved; after the riffle every card sits in its new place.
      if (t < 0.8) { x = 0; z = i * D; rotY = 0; rotX = 0; bendX = 0 }
      if (t > 3.62) { x = 0; z = k * D; rotY = 0; rotX = 0; bendX = 0 }

      // The bridge: the deck arches, then the cards cascade flat from the top down.
      const cascade = between(t, 4.04 + (N - 1 - k) * 0.012, 4.2 + (N - 1 - k) * 0.012)
      let bend = 0.2 * arch * (1 - cascade)
      z += Math.sin(cascade * Math.PI) * 0.01 * (k / N)

      // The fan: cards swing round a point below the deck and spread out in depth.
      const angle = (k / (N - 1) - 0.5) * 1.5 * fan
      const radius = 1.2
      x += -Math.sin(angle) * radius
      y += Math.cos(angle) * radius - radius
      z += k * D * 0.9 * fan
      rotZ = angle
      // Domino turnover, left to right, then back right to left.
      const flipOpen = between(t, 6.0 + k * 0.035, 6.32 + k * 0.035)
      const flipShut = between(t, 9.0 + (N - 1 - k) * 0.028, 9.3 + (N - 1 - k) * 0.028)
      const flip = flipOpen * (1 - flipShut)
      rotY += flip * Math.PI
      bend += Math.sin(flip * Math.PI) * 0.06

      let scale = 1
      if (k === FEATURED) {
        x *= 1 - feature
        rotZ *= 1 - feature
        y += feature * 0.32
        z += feature * 1.35
        rotY += Math.sin(time * 1.4) * 0.08 * feature
        rotX += Math.sin(time * 1.1) * 0.05 * feature
        scale = 1 + feature * 0.18
      } else if (feature > 0) {
        y += Math.sin(time * 2 + k * 0.4) * 0.012 * feature
      }

      node.position.set(x, y, z)
      node.rotation.set(rotX, rotY, rotZ, 'ZYX')
      node.scale.setScalar(scale)
      card.uniforms.uBend.value = bend
      card.uniforms.uBendX.value = bendX
    })
  })

  return <group ref={rig}>
    <group ref={deck}>
      {cards.map((card, index) => <group key={index} ref={(node) => { nodes.current[index] = node }}>
        <mesh geometry={geometry} material={card.materials} castShadow receiveShadow />
      </group>)}
    </group>
    <ContactShadows position={[0, -1.55, 0]} opacity={0.38} scale={6} blur={2.8} far={3} color="#6b2e18" resolution={512} frames={still ? 1 : Infinity} />
  </group>
}

/** Card index for each post-riffle slot, so a slot can be traced back to its mesh. */
const slotOrder = Array.from({ length: N }, (_, slot) => Array.from({ length: N }, (_, i) => i).find((i) => slotAfterRiffle(i) === slot)!)
