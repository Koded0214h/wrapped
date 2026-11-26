import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, RoundedBox } from '@react-three/drei'
import {
  CanvasTexture, CatmullRomCurve3, Color, DoubleSide, Group, InstancedMesh, LatheGeometry, MathUtils, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, Object3D, RepeatWrapping, SphereGeometry, SRGBColorSpace, TorusGeometry, TubeGeometry, Vector2, Vector3
} from 'three'
import { fabric, goldMaterial } from './materials'
import { paintFace, paintHairCap, type Expression } from './faceArt'
import { friendMessages } from './messages'

const BEAT = 2.7
const INTRO = 2.3
const UP = new Vector3(0, 1, 0)
const scratch = { a: new Vector3(), b: new Vector3(), c: new Vector3() }

/* ── Geometry helpers ─────────────────────────────────────────────────────── */

/** Puts a mesh built along +Y between two points. */
function place(mesh: Object3D | null, from: Vector3, to: Vector3) {
  if (!mesh) return
  mesh.position.copy(from).add(to).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(UP, scratch.a.copy(to).sub(from).normalize())
}

/** Two-bone reach: where the elbow (or knee) sits so both bones keep their length. */
function solveJoint(start: Vector3, end: Vector3, first: number, second: number, pole: Vector3, out: Vector3) {
  const toEnd = scratch.b.copy(end).sub(start)
  const distance = MathUtils.clamp(toEnd.length(), 0.001, first + second - 0.001)
  toEnd.normalize()
  const along = (first * first - second * second + distance * distance) / (2 * distance)
  const height = Math.sqrt(Math.max(0, first * first - along * along))
  const bend = scratch.c.copy(pole).sub(start)
  bend.sub(toEnd.clone().multiplyScalar(bend.dot(toEnd))).normalize()
  return out.copy(start).addScaledVector(toEnd, along).addScaledVector(bend, height)
}

/** A limb segment that tapers from one radius to another, centred on its length (for `place`). */
function taper(length: number, from: number, to: number, bulge = 0) {
  const points: Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const radius = MathUtils.lerp(from, to, t) + Math.sin(t * Math.PI) * bulge
    const cap = Math.sin(Math.min(1, t * 7) * Math.PI / 2) * Math.sin(Math.min(1, (1 - t) * 7) * Math.PI / 2)
    points.push(new Vector2(radius * Math.sqrt(cap) + 0.0005, -length / 2 + t * length))
  }
  return new LatheGeometry(points, 28)
}

const gaussAt = (point: Vector3, x: number, y: number, z: number, size: number) => Math.exp(-((point.x - x) ** 2 + (point.y - y) ** 2 + (point.z - z) ** 2) / size)

const HEAD = { x: 0.232, y: 0.3, z: 0.262 }

/** A smooth head: an ellipsoid with a gently narrowing jaw. Its UVs stay put, so the painted face follows the shape. */
function headGeometry() {
  const geometry = new SphereGeometry(1, 96, 72)
  const position = geometry.attributes.position
  const v = new Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    const jaw = MathUtils.smoothstep(-v.y, 0.15, 1)
    v.set(v.x * HEAD.x * (1 - 0.34 * jaw), v.y * HEAD.y * (1 + 0.04 * jaw), v.z * HEAD.z * (1 - 0.1 * jaw) + (v.z > 0 ? 0.03 * jaw * v.z : 0))
    position.setXYZ(i, v.x, v.y, v.z)
  }
  geometry.computeVertexNormals()
  return geometry
}

/** Normal map for box braids: alternating diagonal plaits along the length. */
function braidNormal() {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgb(128,128,255)'; ctx.fillRect(0, 0, 64, 64)
  for (let row = 0; row < 2; row++) {
    for (let side = 0; side < 2; side++) {
      const gradient = ctx.createLinearGradient(0, row * 32, 0, row * 32 + 32)
      gradient.addColorStop(0, side ? 'rgb(90,170,230)' : 'rgb(170,170,230)'); gradient.addColorStop(1, side ? 'rgb(170,90,230)' : 'rgb(90,90,230)')
      ctx.fillStyle = gradient
      const x0 = side * 32
      ctx.beginPath()
      ctx.moveTo(x0, row * 32 + (side ? 16 : 0)); ctx.lineTo(x0 + 32, row * 32 + (side ? 0 : 16)); ctx.lineTo(x0 + 32, row * 32 + (side ? 16 : 32)); ctx.lineTo(x0, row * 32 + (side ? 32 : 16)); ctx.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(2, 26)
  return texture
}

/** Knit texture for the jumpers: fine vertical ribs. */
function knitNormal() {
  const canvas = document.createElement('canvas')
  canvas.width = 32; canvas.height = 8
  const ctx = canvas.getContext('2d')!
  for (let x = 0; x < 32; x++) { const s = Math.sin(x / 32 * Math.PI * 8); ctx.fillStyle = `rgb(${128 + s * 60},128,255)`; ctx.fillRect(x, 0, 1, 8) }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(10, 1)
  return texture
}

function phoneScreen(accent: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 200; canvas.height = 400
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#efe7dc'; ctx.fillRect(0, 0, 200, 400)
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 200, 54)
  ctx.fillStyle = '#ffffffcc'; ctx.beginPath(); ctx.arc(30, 30, 13, 0, Math.PI * 2); ctx.fill()
  ctx.fillRect(52, 22, 80, 9); ctx.fillRect(52, 36, 50, 6)
  const bubbles: [number, number, number, boolean][] = [[70, 120, 34, false], [140, 96, 34, true], [190, 130, 46, false], [252, 110, 34, true], [302, 140, 34, false], [350, 90, 30, true]]
  for (const [y, w, h, mine] of bubbles) {
    ctx.fillStyle = mine ? '#d9fdd3' : '#ffffff'
    ctx.beginPath(); ctx.roundRect(mine ? 190 - w : 12, y, w, h, 10); ctx.fill()
    ctx.fillStyle = '#00000026'; ctx.fillRect(mine ? 200 - w : 22, y + 11, w - 24, 5); if (h > 34) ctx.fillRect(mine ? 200 - w : 22, y + 24, w - 50, 5)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/* ── One friend ───────────────────────────────────────────────────────────── */

type Look = { skin: string; sheen: string; lip: string; brow: string; top: string; bottom: string; accent: string; hair: 'afro' | 'braids'; side: -1 | 1; skirt?: boolean }
type Drive = { laugh: number; talk: number }

function useFriendKit(look: Look) {
  return useMemo(() => {
    const knit = knitNormal()
    return {
      skin: new MeshPhysicalMaterial({ color: look.skin, roughness: 0.48, sheen: 1, sheenColor: new Color(look.sheen), sheenRoughness: 0.38, clearcoat: 0.22, clearcoatRoughness: 0.5 }),
      skinShade: new MeshPhysicalMaterial({ color: new Color(look.skin).multiplyScalar(0.72), roughness: 0.55, sheen: 0.6, sheenColor: new Color(look.sheen) }),
      faces: Object.fromEntries((['neutral', 'blink', 'talk', 'laugh'] as Expression[]).map((expression) => [expression, paintFace({ skin: look.skin, lip: look.lip, brow: look.brow, radiusX: HEAD.x, radiusY: HEAD.y }, expression, look.side * 0.6)])) as Record<Expression, CanvasTexture>,
      hair: new MeshPhysicalMaterial({ color: '#17100c', roughness: 0.78, sheen: 0.5, sheenColor: new Color('#7a5440'), sheenRoughness: 0.55 }),
      braid: new MeshPhysicalMaterial({ color: '#1b120e', roughness: 0.6, normalMap: braidNormal(), normalScale: new Vector2(1.4, 1.4), sheen: 0.5, sheenColor: new Color('#8a6048') }),
      top: new MeshPhysicalMaterial({ color: look.top, roughness: 0.88, normalMap: knit, normalScale: new Vector2(0.5, 0.5), sheen: 0.7, sheenColor: new Color('#ffffff'), sheenRoughness: 0.8 }),
      bottom: fabric(look.bottom),
      sneaker: new MeshPhysicalMaterial({ color: '#fbf7f0', roughness: 0.55, clearcoat: 0.2 }),
      sole: new MeshPhysicalMaterial({ color: '#f1e6d6', roughness: 0.8 }),
      lace: new MeshStandardMaterial({ color: look.accent, roughness: 0.7 }),
      phone: new MeshPhysicalMaterial({ color: '#1d1b22', roughness: 0.2, metalness: 0.3, clearcoat: 1 }),
      screen: new MeshBasicMaterial({ map: phoneScreen(look.side < 0 ? '#1f8a50' : '#3360dd'), toneMapped: false }),
      head: headGeometry(),
      hairCap: new MeshStandardMaterial({ map: paintHairCap('#1a110d', '#4a3426'), alphaTest: 0.5, roughness: 0.7 }),
      headSkin: new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.5, sheen: 1, sheenColor: new Color(look.sheen), sheenRoughness: 0.4, clearcoat: 0.15, clearcoatRoughness: 0.5 }),
      upperArm: taper(0.3, 0.056, 0.046, 0.006),
      foreArm: taper(0.27, 0.045, 0.033, 0.004),
      thigh: taper(0.56, 0.118, 0.086, 0.01),
      shin: taper(0.62, look.skirt ? 0.058 : 0.084, look.skirt ? 0.04 : 0.078, look.skirt ? 0.012 : 0),
      torso: new LatheGeometry([[0.0005, 0], [0.19, 0.02], [0.212, 0.1], [0.2, 0.2], [0.172, 0.32], [0.176, 0.42], [0.19, 0.52], [0.198, 0.6], [0.188, 0.66], [0.14, 0.71], [0.07, 0.735], [0.0005, 0.74]].map(([x, y]) => new Vector2(x, y)), 48)
    }
  }, [look])
}
type FriendKit = ReturnType<typeof useFriendKit>

/** Coily afro: a soft base plus a few thousand tiny curls scattered over it. */
function AfroCurls({ kit }: { kit: FriendKit }) {
  const mesh = useMemo(() => {
    const candidates = 6200
    const instanced = new InstancedMesh(new TorusGeometry(0.021, 0.0088, 6, 10), kit.hair, candidates)
    const helper = new Object3D()
    const color = new Color()
    const light = new Color('#3a2a20')
    let placed = 0
    // Every candidate point over the whole sphere, so the curls cover the sides and back as well as the top.
    for (let i = 0; i < candidates; i++) {
      const y = 1 - (i / (candidates - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const a = i * 2.39996
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      // keep the face and the nape clear
      if ((z > 0.4 && y < 0.12) || y < -0.5) continue
      const lift = 1 + (Math.sin(i * 12.9) * 0.5 + 0.5) * 0.06
      helper.position.set(x * 0.375 * lift, y * 0.335 * lift, z * 0.345 * lift)
      helper.rotation.set(Math.sin(i * 1.7) * 3, Math.cos(i * 2.3) * 3, Math.sin(i * 0.7) * 3)
      helper.scale.setScalar(0.8 + (Math.sin(i * 7.1) * 0.5 + 0.5) * 0.7)
      helper.updateMatrix()
      instanced.setMatrixAt(placed, helper.matrix)
      instanced.setColorAt(placed, color.set('#17100c').lerp(light, (Math.sin(i * 3.3) * 0.5 + 0.5) * 0.5))
      placed++
    }
    instanced.count = placed
    instanced.castShadow = true
    return instanced
  }, [kit])
  return <group position={[0, 0.17, -0.13]}>
    <mesh material={kit.hair} scale={[0.37, 0.33, 0.34]}><sphereGeometry args={[1, 48, 32]} /></mesh>
    <primitive object={mesh} />
  </group>
}

/** Long box braids from parted rows on the scalp, falling down the back and a few over one shoulder. */
function Braids({ kit }: { kit: FriendKit }) {
  const tubes = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const row = Math.floor(i / 10)
    const a = Math.PI * (0.12 + (i % 10) / 9 * 0.76)
    const start = new Vector3(Math.cos(a) * 0.21 * (1 - row * 0.12), 0.2 - row * 0.09, -Math.sin(a) * 0.2 - 0.02)
    const front = i % 10 > 7 && row === 2
    const out = start.clone().setY(0).normalize()
    const mid = start.clone().add(out.multiplyScalar(0.1)).add(new Vector3(0, -0.22, 0))
    const end = front ? new Vector3(0.2 + (i % 3) * 0.03, -0.72, 0.16 + (i % 2) * 0.03) : new Vector3(start.x * 1.25, -0.78 - (i % 4) * 0.04, Math.min(-0.12, start.z * 1.1 - 0.06))
    const shoulder = front ? new Vector3(0.26, -0.38, 0.1) : new Vector3(mid.x * 1.1, -0.45, mid.z - 0.04)
    return { geometry: new TubeGeometry(new CatmullRomCurve3([start, mid, shoulder, end]), 40, 0.0165, 8), end }
  }), [])
  return <group>
    {/* a crown bun wound from braids */}
    {[0, 1, 2].map((ring) => <mesh key={ring} material={kit.braid} position={[0, 0.3 + ring * 0.035, -0.06]} rotation={[Math.PI / 2 - 0.25, 0, ring]}><torusGeometry args={[0.085 - ring * 0.022, 0.026, 14, 40]} /></mesh>)}
    {tubes.map(({ geometry, end }, index) => <group key={index}>
      <mesh geometry={geometry} material={kit.braid} castShadow />
      {index % 4 === 0 && <mesh material={goldMaterial} position={end}><cylinderGeometry args={[0.02, 0.02, 0.03, 12]} /></mesh>}
    </group>)}
  </group>
}

function Friend({ look, drive }: { look: Look; drive: React.MutableRefObject<Drive> }) {
  const kit = useFriendKit(look)
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const phone = useRef<Group>(null)
  const shown = useRef<Expression | null>(null)
  const arms = useRef<Record<string, Object3D | null>>({})
  const joint = useMemo(() => ({ elbow: new Vector3(), shoulder: new Vector3(), hand: new Vector3(), pole: new Vector3() }), [])
  const blink = useRef({ next: 1 + Math.random() * 2, until: 0 })
  const turn = -look.side * 0.3

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const { laugh, talk } = drive.current
    const bounce = laugh * Math.abs(Math.sin(time * 14)) * 0.035
    if (body.current) {
      body.current.position.y = bounce + Math.sin(time * 1.6 + look.side) * 0.005
      body.current.rotation.x = 0.08 - laugh * 0.14
      body.current.rotation.z = laugh * Math.sin(time * 7) * 0.025
    }
    if (head.current) {
      // The head stays nearly level when she laughs; the laugh shows in the face and a little shake.
      head.current.rotation.x = MathUtils.lerp(head.current.rotation.x, 0.16 - laugh * 0.16 - talk * 0.1 + Math.sin(time * 13) * 0.02 * laugh, 0.1)
      head.current.rotation.y = MathUtils.lerp(head.current.rotation.y, talk * look.side * -0.5 + laugh * look.side * -0.22, 0.08)
      head.current.rotation.z = laugh * Math.sin(time * 9) * 0.04
    }
    // Blinks every few seconds; swaps the painted face only when the expression changes.
    if (time > blink.current.next) { blink.current.until = time + 0.13; blink.current.next = time + 2 + Math.random() * 3 }
    const expression: Expression = laugh > 0.4 ? 'laugh' : talk > 0.5 ? 'talk' : time < blink.current.until ? 'blink' : 'neutral'
    if (expression !== shown.current) { shown.current = expression; kit.headSkin.map = kit.faces[expression]; kit.headSkin.needsUpdate = true }
    if (phone.current) {
      phone.current.position.set(0, 0.7 + laugh * 0.06, 0.42 - laugh * 0.05)
      phone.current.rotation.x = -0.78 + laugh * 0.3
    }
    for (const sideOfBody of [-1, 1] as const) {
      const tap = (1 - laugh) * Math.max(0, Math.sin(time * 13 + sideOfBody * 1.7)) * 0.012
      joint.shoulder.set(sideOfBody * 0.19, 0.78, -0.01)
      joint.hand.set(sideOfBody * 0.075, 0.66 + laugh * 0.06 + tap, 0.43 - laugh * 0.05)
      joint.pole.set(sideOfBody * 0.9, 0.3, -0.4)
      solveJoint(joint.shoulder, joint.hand, 0.3, 0.29, joint.pole, joint.elbow)
      place(arms.current[`upper${sideOfBody}`], joint.shoulder, joint.elbow)
      place(arms.current[`lower${sideOfBody}`], joint.elbow, joint.hand)
      arms.current[`elbow${sideOfBody}`]?.position.copy(joint.elbow)
    }
  })

  const legs = useMemo(() => [-1, 1].map((sideOfBody) => ({
    hip: new Vector3(sideOfBody * 0.11, 0.12, 0.04),
    knee: new Vector3(sideOfBody * 0.13, 0.17, 0.6),
    foot: new Vector3(sideOfBody * (0.14 + (sideOfBody === look.side ? 0.03 : 0)), -0.5, 0.7)
  })), [look.side])
  const legMaterial = look.skirt ? kit.skin : kit.bottom

  return <group rotation={[0, turn, 0]}>
    <group ref={body}>
      {legs.map(({ hip, knee, foot }, index) => <group key={index}>
        <mesh geometry={kit.thigh} material={legMaterial} ref={(node) => place(node, hip, knee)} castShadow />
        <mesh material={legMaterial} position={knee}><sphereGeometry args={[0.086, 24, 16]} /></mesh>
        <mesh geometry={kit.shin} material={legMaterial} ref={(node) => place(node, knee, foot)} castShadow />
        <group position={[foot.x, foot.y - 0.05, foot.z + 0.06]} rotation={[0, (index ? -1 : 1) * 0.08, 0]}>
          <RoundedBox args={[0.135, 0.095, 0.31]} radius={0.045} smoothness={4} material={kit.sneaker} castShadow />
          <RoundedBox args={[0.145, 0.032, 0.325]} radius={0.014} smoothness={3} material={kit.sole} position={[0, -0.045, 0.005]} />
          {[0, 1, 2].map((lace) => <mesh key={lace} material={kit.lace} position={[0, 0.043, 0.03 - lace * 0.035]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.006, 0.05, 4, 6]} /></mesh>)}
        </group>
      </group>)}
      <mesh material={kit.bottom} position={[0, 0.14, 0.03]} scale={[0.25, 0.14, 0.22]}><sphereGeometry args={[1, 32, 20]} /></mesh>
      {/* torso, bust, shoulders and a ribbed collar */}
      <mesh geometry={kit.torso} material={kit.top} position={[0, 0.06, 0]} scale={[1, 1, 0.66]} castShadow />
      {[-1, 1].map((sideOfBody) => <mesh key={`s${sideOfBody}`} material={kit.top} position={[sideOfBody * 0.185, 0.765, -0.01]}><sphereGeometry args={[0.064, 20, 14]} /></mesh>)}
      <mesh material={kit.top} position={[0, 0.79, -0.005]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.78, 1]}><torusGeometry args={[0.085, 0.022, 10, 32]} /></mesh>
      {[-1, 1].map((sideOfBody) => <group key={`a${sideOfBody}`}>
        <mesh geometry={kit.upperArm} material={kit.top} ref={(node) => { arms.current[`upper${sideOfBody}`] = node }} castShadow />
        <mesh material={kit.top} ref={(node) => { arms.current[`elbow${sideOfBody}`] = node }}><sphereGeometry args={[0.048, 16, 12]} /></mesh>
        <mesh geometry={kit.foreArm} material={kit.skin} ref={(node) => { arms.current[`lower${sideOfBody}`] = node }} castShadow />
      </group>)}
      {/* phone, held in two hands with the thumbs on the screen */}
      <group ref={phone}>
        <RoundedBox args={[0.13, 0.26, 0.016]} radius={0.016} smoothness={4} material={kit.phone} />
        <mesh material={kit.screen} position={[0, 0, 0.0085]}><planeGeometry args={[0.118, 0.244]} /></mesh>
        <pointLight position={[0, 0, 0.2]} intensity={0.35} distance={0.9} color="#d6ecff" />
        {[-1, 1].map((sideOfBody) => <group key={sideOfBody} position={[sideOfBody * 0.072, -0.03, -0.012]}>
          <RoundedBox args={[0.05, 0.085, 0.032]} radius={0.014} smoothness={3} material={kit.skin} />
          {[0, 1, 2, 3].map((finger) => <mesh key={finger} material={kit.skin} position={[-sideOfBody * 0.012, 0.03 - finger * 0.019, -0.016]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.0085, 0.04, 4, 8]} /></mesh>)}
          <mesh material={kit.skin} position={[-sideOfBody * 0.03, 0.03, 0.022]} rotation={[0.3, 0, sideOfBody * 0.9]}><capsuleGeometry args={[0.0095, 0.045, 4, 8]} /></mesh>
        </group>)}
      </group>
      {/* neck and head */}
      <mesh material={kit.skin} position={[0, 0.86, 0.0]}><cylinderGeometry args={[0.05, 0.062, 0.2, 24]} /></mesh>
      <group ref={head} position={[0, 1.08, 0.03]} scale={0.84}>
        <mesh geometry={kit.head} material={kit.headSkin} castShadow />
        {/* a small soft nose so the profile reads when she turns; the face itself is painted */}
        <mesh material={kit.skin} position={[0, -0.07, HEAD.z - 0.016]} scale={[1.2, 0.85, 0.5]}><sphereGeometry args={[0.03, 24, 16]} /></mesh>
        {[-1, 1].map((sideOfHead) => <group key={sideOfHead}>
          <mesh material={kit.skin} position={[sideOfHead * 0.226, -0.005, -0.02]} rotation={[0, sideOfHead * 0.4, 0]} scale={[0.4, 1, 0.75]}><sphereGeometry args={[0.055, 18, 14]} /></mesh>
          <mesh material={kit.skinShade} position={[sideOfHead * 0.234, -0.005, -0.005]} rotation={[0, sideOfHead * 0.4, 0]} scale={[0.2, 0.7, 0.45]}><sphereGeometry args={[0.05, 14, 10]} /></mesh>
          <mesh material={goldMaterial} position={[sideOfHead * 0.23, -0.085, -0.012]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[look.hair === 'afro' ? 0.05 : 0.032, 0.006, 10, 36]} /></mesh>
        </group>)}
        {/* a fitted cap with a painted hairline, under the afro or the braids */}
        <mesh geometry={kit.head} material={kit.hairCap} scale={1.018} />
        {look.hair === 'afro' ? <AfroCurls kit={kit} /> : <Braids kit={kit} />}
      </group>
    </group>
  </group>
}

/* ── Room ─────────────────────────────────────────────────────────────────── */

function Couch() {
  const kit = useMemo(() => ({
    cover: new MeshPhysicalMaterial({ color: '#2f6f68', roughness: 0.92, sheen: 1, sheenColor: new Color('#8fd6c8'), sheenRoughness: 0.7 }),
    cushion: new MeshPhysicalMaterial({ color: '#357a72', roughness: 0.92, sheen: 1, sheenColor: new Color('#9ee0d2'), sheenRoughness: 0.7 }),
    pillow: fabric('#ffd23f'),
    pillowTwo: fabric('#ff8fb5'),
    button: new MeshStandardMaterial({ color: '#204f4a', roughness: 0.6 }),
    wood: new MeshPhysicalMaterial({ color: '#8a5a36', roughness: 0.45, clearcoat: 0.5 })
  }), [])
  return <group position={[0, -0.18, -0.15]}>
    <RoundedBox args={[3.4, 0.36, 1.16]} radius={0.14} smoothness={5} material={kit.cover} castShadow receiveShadow />
    <RoundedBox args={[3.4, 0.98, 0.34]} radius={0.16} smoothness={5} material={kit.cover} position={[0, 0.58, -0.46]} castShadow />
    {[-1, 1].map((side) => <RoundedBox key={side} args={[0.34, 0.7, 1.2]} radius={0.15} smoothness={5} material={kit.cover} position={[side * 1.78, 0.26, 0]} castShadow />)}
    {[-1, 1].map((side) => <RoundedBox key={`c${side}`} args={[1.58, 0.22, 1.0]} radius={0.1} smoothness={5} material={kit.cushion} position={[side * 0.8, 0.27, 0.06]} receiveShadow />)}
    {[-1, 1].map((side) => <group key={`b${side}`}>
      <RoundedBox args={[1.5, 0.68, 0.24]} radius={0.11} smoothness={5} material={kit.cushion} position={[side * 0.8, 0.72, -0.29]} rotation={[-0.12, 0, 0]} />
      {[-0.4, 0, 0.4].map((x) => <mesh key={x} material={kit.button} position={[side * 0.8 + x, 0.74, -0.165]}><sphereGeometry args={[0.018, 10, 8]} /></mesh>)}
    </group>)}
    <RoundedBox args={[0.54, 0.48, 0.17]} radius={0.12} smoothness={4} material={kit.pillow} position={[-1.38, 0.62, -0.08]} rotation={[-0.2, 0.3, 0.18]} />
    <RoundedBox args={[0.48, 0.44, 0.16]} radius={0.12} smoothness={4} material={kit.pillowTwo} position={[1.42, 0.6, -0.06]} rotation={[-0.2, -0.35, -0.2]} />
    {[[-1.65, 0.42], [1.65, 0.42], [-1.65, -0.42], [1.65, -0.42]].map(([x, z]) => <mesh key={`${x}${z}`} material={kit.wood} position={[x, -0.3, z]} rotation={[z > 0 ? 0.12 : -0.12, 0, x > 0 ? -0.12 : 0.12]}><cylinderGeometry args={[0.045, 0.028, 0.28, 14]} /></mesh>)}
  </group>
}

function Plant() {
  const pot = useMemo(() => new MeshPhysicalMaterial({ color: '#ff5b36', roughness: 0.5, clearcoat: 0.4 }), [])
  const soil = useMemo(() => new MeshStandardMaterial({ color: '#3a2618', roughness: 1 }), [])
  const leaf = useMemo(() => new MeshPhysicalMaterial({ color: '#2f8a4f', roughness: 0.42, sheen: 0.5, sheenColor: new Color('#c4f5cf'), side: DoubleSide }), [])
  return <group>
    <mesh material={pot} castShadow><cylinderGeometry args={[0.24, 0.18, 0.44, 32]} /></mesh>
    <mesh material={soil} position={[0, 0.2, 0]}><cylinderGeometry args={[0.215, 0.215, 0.02, 24]} /></mesh>
    {Array.from({ length: 11 }, (_, index) => <mesh key={index} material={leaf} position={[Math.cos(index * 2.4) * 0.1, 0.5 + (index % 4) * 0.1, Math.sin(index * 2.4) * 0.1]} rotation={[Math.sin(index * 2.4) * 0.7, index * 2.4, Math.cos(index * 2.4) * 0.7]} scale={[0.45, 1, 0.08]} castShadow><sphereGeometry args={[0.3, 18, 12]} /></mesh>)}
  </group>
}

/* ── Scene ────────────────────────────────────────────────────────────────── */

const bounceOut = (value: number) => {
  const n = 7.5625, d = 2.75
  let x = value
  if (x < 1 / d) return n * x * x
  if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75 }
  if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375 }
  x -= 2.625 / d
  return n * x * x + 0.984375
}
const drop = (elapsed: number, start: number, length = 0.8) => bounceOut(MathUtils.clamp((elapsed - start) / length, 0, 1))

/**
 * When the section first shows, the couch drops in, then each friend lands on it, then the plant pops up.
 * After that, bubbles rise from each phone in turn and the friend who reads one laughs.
 * The bubbles themselves are page HTML placed over the canvas.
 */
export function FriendsScene({ still = false, onBeat, anchors, fixedTime }: { still?: boolean; onBeat: (beat: number) => void; anchors: React.MutableRefObject<(HTMLDivElement | null)[]>; fixedTime?: number }) {
  const drives = [useRef<Drive>({ laugh: 0, talk: 0 }), useRef<Drive>({ laugh: 0, talk: 0 })]
  const lastBeat = useRef(-2)
  const points = useRef<(Object3D | null)[]>([])
  const world = useMemo(() => new Vector3(), [])
  const started = useRef<number | null>(null)
  const couch = useRef<Group>(null)
  const people = useRef<(Group | null)[]>([])
  const plant = useRef<Group>(null)

  useFrame((state) => {
    started.current ??= state.clock.elapsedTime
    const elapsed = still ? 99 : fixedTime ?? state.clock.elapsedTime - started.current
    if (couch.current) couch.current.position.y = (1 - drop(elapsed, 0, 0.9)) * 2.4
    people.current.forEach((person, index) => {
      if (!person) return
      // Falls from just inside the top of the frame, so nobody is cut off mid-air.
      person.position.y = (1 - drop(elapsed, 0.75 + index * 0.4, 0.75)) * 1.35
      // a little squash on landing
      const squash = Math.sin(MathUtils.clamp((elapsed - 0.95 - index * 0.4) / 0.35, 0, 1) * Math.PI) * 0.05
      person.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6)
      person.visible = elapsed > 0.72 + index * 0.4
    })
    if (plant.current) {
      const pop = MathUtils.clamp((elapsed - 1.7) / 0.45, 0, 1)
      plant.current.scale.setScalar(pop < 1 ? Math.sin(pop * Math.PI * 0.5) * (1 + Math.sin(pop * Math.PI) * 0.25) : 1)
      plant.current.visible = pop > 0
    }

    const chat = elapsed - INTRO
    const index = chat < 0 ? -1 : Math.floor(chat / BEAT)
    if (index !== lastBeat.current) { lastBeat.current = index; onBeat(index) }
    if (index >= 0) {
      const local = (chat % BEAT) / BEAT
      const sender = friendMessages[index % friendMessages.length].from
      const reader = 1 - sender
      drives[reader].current.laugh = MathUtils.lerp(drives[reader].current.laugh, local > 0.22 && local < 0.86 ? 1 : 0, 0.14)
      drives[sender].current.laugh = MathUtils.lerp(drives[sender].current.laugh, local > 0.45 && local < 0.8 ? 0.45 : 0, 0.08)
      drives[sender].current.talk = MathUtils.lerp(drives[sender].current.talk, local > 0.1 && local < 0.7 ? 1 : 0, 0.1)
      drives[reader].current.talk = MathUtils.lerp(drives[reader].current.talk, 0, 0.1)
    }
    points.current.forEach((point, which) => {
      const element = anchors.current[which]
      if (!point || !element) return
      point.getWorldPosition(world).project(state.camera)
      element.style.transform = `translate(${(world.x + 1) / 2 * state.size.width}px, ${(1 - world.y) / 2 * state.size.height}px)`
    })
  })
  const looks = useMemo<Look[]>(() => [
    { skin: '#4a2a1c', sheen: '#c98458', lip: '#6b2f33', brow: '#120a07', top: '#ff5b36', bottom: '#2f4f86', accent: '#ffd23f', hair: 'afro', side: -1 },
    { skin: '#7a4a2e', sheen: '#e2a274', lip: '#8a3f44', brow: '#1a0f0a', top: '#ffd23f', bottom: '#d8337a', accent: '#ff5b36', hair: 'braids', side: 1 }
  ], [])
  return <group position={[0, -0.55, 0]}>
    <group ref={couch}><Couch /></group>
    <group ref={plant} position={[2.3, -0.62, -0.45]}><Plant /></group>
    {looks.map((look, index) => <group key={index} position={[look.side * 0.8, 0.12, 0.05]}>
      <group ref={(node) => { people.current[index] = node }}><Friend look={look} drive={drives[index]} /></group>
      <object3D ref={(node) => { points.current[index] = node }} position={[look.side * 0.45, 1.85, 0.3]} />
    </group>)}
    <ContactShadows position={[0, -0.82, 0]} opacity={0.32} scale={9} blur={2.4} far={3} color="#3a2340" resolution={512} frames={still ? 1 : Infinity} />
  </group>
}

/** The overlay that pairs with FriendsScene: one anchor per friend, holding her latest bubble. */
export function FriendBubbles({ beat, anchors }: { beat: number; anchors: React.MutableRefObject<(HTMLDivElement | null)[]> }) {
  const message = friendMessages[Math.max(0, beat) % friendMessages.length]
  const previous = friendMessages[(Math.max(0, beat) + friendMessages.length - 1) % friendMessages.length]
  return <div className="friend-bubbles" aria-live="off">
    {[0, 1].map((index) => <div key={index} ref={(node) => { anchors.current[index] = node }} className={`friend-bubble-anchor friend-bubble-anchor--${index ? 'right' : 'left'}`}>
      {beat >= 0 && message.from === index && <div key={beat} className={`friend-bubble friend-bubble--${index ? 'right' : 'left'}`}>{message.text}</div>}
      {beat > 0 && previous.from === index && message.from !== index && <div key={`p${beat}`} className={`friend-bubble friend-bubble--${index ? 'right' : 'left'} is-old`}>{previous.text}</div>}
    </div>)}
  </div>
}
