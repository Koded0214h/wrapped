import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, ExtrudeGeometry, Group, LatheGeometry, MeshPhysicalMaterial, Shape, SphereGeometry, TubeGeometry, Vector2, Vector3 } from 'three'

/* ── Materials and shapes shared by every emoji ─────────────────────────────── */

const gloss = (color: string, extra: Partial<ConstructorParameters<typeof MeshPhysicalMaterial>[0]> = {}) => new MeshPhysicalMaterial({ color: new Color(color), roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.18, ...extra })

function heartGeometry(size: number, depth: number) {
  const shape = new Shape()
  shape.moveTo(25, 25)
  shape.bezierCurveTo(25, 25, 20, 0, 0, 0)
  shape.bezierCurveTo(-30, 0, -30, 35, -30, 35)
  shape.bezierCurveTo(-30, 55, -10, 77, 25, 95)
  shape.bezierCurveTo(60, 77, 80, 55, 80, 35)
  shape.bezierCurveTo(80, 35, 80, 0, 50, 0)
  shape.bezierCurveTo(35, 0, 25, 25, 25, 25)
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 9, bevelSize: 8, bevelSegments: 8, curveSegments: 24 })
  geometry.center()
  geometry.rotateZ(Math.PI)
  geometry.scale(size / 110, size / 110, size / 110)
  return geometry
}

/** Paints a vertical gradient into a geometry's vertex colours: the soft top-lit look of 3D emoji. */
function gradient<T extends BufferGeometry>(geometry: T, top: string, bottom: string, from: number, to: number) {
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const a = new Color(top), b = new Color(bottom), c = new Color()
  for (let i = 0; i < position.count; i++) {
    c.copy(b).lerp(a, Math.min(1, Math.max(0, (position.getY(i) - from) / (to - from))))
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/** A flame: a teardrop that narrows to a flicking tip. */
function flameGeometry(width: number, height: number, top: string, bottom: string) {
  const points: Vector2[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    points.push(new Vector2(Math.max(0.0005, width * Math.sin(Math.PI * Math.pow(t, 0.62)) * Math.pow(1 - t, 0.35)), -height * 0.42 + t * height))
  }
  return gradient(new LatheGeometry(points, 36), top, bottom, height * 0.5, -height * 0.4)
}

/** A tear stream that runs down the face from under an eye, hugging the sphere. */
function streamGeometry(side: number) {
  const points = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6
    const x = side * (0.17 + t * 0.12), y = 0.03 - t * 0.43
    return new Vector3(x, y, Math.sqrt(Math.max(0, 0.262 - x * x - y * y)))
  })
  return new TubeGeometry(new CatmullRomCurve3(points), 32, 0.05, 12)
}

function useKit() {
  return useMemo(() => ({
    face: gloss('#ffffff', { vertexColors: true, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new Color('#fff4c2') }),
    faceGeometry: gradient(new SphereGeometry(0.5, 56, 40), '#ffe66b', '#f59f1b', 0.45, -0.5),
    lit: gloss('#ffffff', { vertexColors: true, roughness: 0.25, clearcoat: 1 }),
    stream: gloss('#4fc3ff', { roughness: 0.05, clearcoat: 1, transmission: 0.25, thickness: 0.2, ior: 1.33 }),
    streams: [streamGeometry(-1), streamGeometry(1)],
    flameOuterGeometry: flameGeometry(0.42, 1.0, '#ff2e1a', '#ff9a1a'),
    flameInnerGeometry: flameGeometry(0.25, 0.66, '#ffc22e', '#fff6b0'),
    flameLickGeometry: flameGeometry(0.14, 0.5, '#ff4a1f', '#ff9f1c'),
    faceWarm: gloss('#ffbb2e'),
    dark: gloss('#3b1d0e', { roughness: 0.4 }),
    mouth: gloss('#5b2410', { roughness: 0.5 }),
    tongue: gloss('#ff6f7d'),
    white: gloss('#ffffff'),
    tear: gloss('#58c4ff', { roughness: 0.08, clearcoat: 1, transmission: 0.2, ior: 1.33 }),
    red: gloss('#ff2d55', { roughness: 0.2 }),
    blush: new MeshPhysicalMaterial({ color: '#ff6f61', transparent: true, opacity: 0.4, roughness: 0.6 }),
    lens: gloss('#16161c', { roughness: 0.08, clearcoat: 1, metalness: 0.2 }),
    bone: gloss('#f3efe6', { roughness: 0.45, clearcoat: 0.3 }),
    heart: gradient(heartGeometry(0.95, 26), '#ff6b8a', '#d4002a', 0.4, -0.45),
    eyeHeart: heartGeometry(0.2, 18)
  }), [])
}
type Kit = ReturnType<typeof useKit>

/** z of a point on the face sphere (radius 0.5) so features sit on the surface. */
const onFace = (x: number, y: number, lift = 0) => Math.sqrt(Math.max(0, 0.25 - x * x - y * y)) + lift

function OpenEye({ kit, x, y = 0.1, big = false, look = 0 }: { kit: Kit; x: number; y?: number; big?: boolean; look?: number }) {
  const s = big ? 1.5 : 1
  return <group position={[x, y, onFace(x, y, -0.02)]} rotation={[-y * 1.6, x * 1.6, 0]}>
    <mesh material={big ? kit.white : kit.dark} scale={big ? [0.1 * s, 0.13 * s, 0.05] : [0.06, 0.085, 0.04]}><sphereGeometry args={[1, 20, 14]} /></mesh>
    {big && <mesh material={kit.dark} position={[look * 0.03, -0.01, 0.04]} scale={[0.1, 0.12, 0.04]}><sphereGeometry args={[1, 20, 14]} /></mesh>}
    <mesh material={kit.white} position={[0.025 * s, 0.03 * s, big ? 0.08 : 0.04]} scale={big ? 0.035 : 0.018}><sphereGeometry args={[1, 10, 8]} /></mesh>
    {big && <mesh material={kit.white} position={[-0.03, -0.05, 0.08]} scale={0.018}><sphereGeometry args={[1, 10, 8]} /></mesh>}
  </group>
}

/** A closed, happy eye: an arch. `down` flips it into a crying squeeze. */
function ArchEye({ kit, x, y = 0.1, down = false }: { kit: Kit; x: number; y?: number; down?: boolean }) {
  return <mesh material={kit.dark} position={[x, y, onFace(x, y, 0.005)]} rotation={[-y * 1.4, x * 1.6, down ? Math.PI : 0]}><torusGeometry args={[0.085, 0.024, 10, 24, Math.PI]} /></mesh>
}

function OpenMouth({ kit, y = -0.13, w = 0.27, h = 0.17, teeth = true }: { kit: Kit; y?: number; w?: number; h?: number; teeth?: boolean }) {
  return <group position={[0, y, onFace(0, y, -0.04)]} rotation={[-y * 1.2, 0, 0]}>
    <mesh material={kit.mouth} scale={[w, h, 0.07]}><sphereGeometry args={[1, 28, 18]} /></mesh>
    {teeth && <mesh material={kit.white} position={[0, h * 0.55, 0.035]} scale={[w * 0.78, h * 0.28, 0.05]}><sphereGeometry args={[1, 24, 12]} /></mesh>}
    <mesh material={kit.tongue} position={[0, -h * 0.45, 0.03]} scale={[w * 0.5, h * 0.35, 0.05]}><sphereGeometry args={[1, 20, 12]} /></mesh>
  </group>
}

function Smile({ kit, y = -0.13, r = 0.16 }: { kit: Kit; y?: number; r?: number }) {
  return <mesh material={kit.dark} position={[0, y + 0.04, onFace(0, y, 0.0)]} rotation={[-y * 1.2, 0, Math.PI]}><torusGeometry args={[r, 0.026, 10, 28, Math.PI]} /></mesh>
}

function Tear({ kit, x, y = -0.02 }: { kit: Kit; x: number; y?: number }) {
  return <group position={[x, y, onFace(x, y, 0.02)]} rotation={[0, 0, x > 0 ? -0.5 : 0.5]}>
    <mesh material={kit.tear}><sphereGeometry args={[0.075, 20, 14]} /></mesh>
    <mesh material={kit.tear} position={[0, 0.08, 0]}><coneGeometry args={[0.072, 0.13, 20]} /></mesh>
  </group>
}

const Face = ({ kit, children }: { kit: Kit; children: React.ReactNode }) => <group><mesh geometry={kit.faceGeometry} material={kit.face} castShadow />{children}</group>

export const emojiKinds = ['joy', 'heartEyes', 'sob', 'cool', 'skull', 'heart', 'fire', 'eyes', 'pleading', 'blush'] as const
type Kind = typeof emojiKinds[number]

function EmojiModel({ kind, kit }: { kind: Kind; kit: Kit }) {
  switch (kind) {
    case 'joy': return <Face kit={kit}><ArchEye kit={kit} x={-0.17} /><ArchEye kit={kit} x={0.17} /><OpenMouth kit={kit} y={-0.14} w={0.28} h={0.18} /><Tear kit={kit} x={-0.36} /><Tear kit={kit} x={0.36} /></Face>
    case 'heartEyes': return <Face kit={kit}>
      {[-0.17, 0.17].map((x) => <mesh key={x} geometry={kit.eyeHeart} material={kit.red} position={[x, 0.11, onFace(x, 0.11, 0.0)]} rotation={[-0.15, x * 1.6, 0]} />)}
      <OpenMouth kit={kit} y={-0.16} w={0.22} h={0.12} />
    </Face>
    case 'sob': return <Face kit={kit}>
      {/* squeezed-shut eyes, worried brows, a wide wail and two rivers of tears */}
      {[-1, 1].map((side) => <group key={side}>
        <mesh material={kit.dark} position={[side * 0.17, 0.1, onFace(side * 0.17, 0.1, 0.008)]} rotation={[-0.15, side * 0.32, side * -0.18]}><torusGeometry args={[0.088, 0.024, 10, 28, Math.PI]} /></mesh>
        <mesh material={kit.dark} position={[side * 0.15, 0.24, onFace(side * 0.15, 0.24, 0.008)]} rotation={[-0.45, side * 0.3, Math.PI / 2 - side * 0.42]}><capsuleGeometry args={[0.018, 0.09, 6, 10]} /></mesh>
        <mesh geometry={kit.streams[side < 0 ? 0 : 1]} material={kit.stream} />
        <mesh material={kit.stream} position={[side * 0.3, -0.4, onFace(side * 0.3, -0.4, -0.02)]} scale={[1.3, 0.7, 0.8]}><sphereGeometry args={[0.07, 20, 14]} /></mesh>
      </group>)}
      <group position={[0, -0.17, onFace(0, -0.17, -0.045)]} rotation={[0.2, 0, 0]}>
        <mesh material={kit.mouth} scale={[0.25, 0.19, 0.08]}><sphereGeometry args={[1, 32, 20]} /></mesh>
        <mesh material={kit.white} position={[0, 0.13, 0.04]} scale={[0.2, 0.045, 0.05]}><sphereGeometry args={[1, 24, 12]} /></mesh>
        <mesh material={kit.tongue} position={[0, -0.1, 0.04]} scale={[0.14, 0.07, 0.05]}><sphereGeometry args={[1, 20, 12]} /></mesh>
      </group>
    </Face>
    case 'cool': return <Face kit={kit}>
      {[-0.17, 0.17].map((x) => <group key={x} position={[x, 0.1, onFace(x, 0.1, 0.0)]} rotation={[-0.15, x * 1.5, 0]}>
        <mesh material={kit.lens} scale={[0.155, 0.12, 0.045]}><sphereGeometry args={[1, 28, 18]} /></mesh>
        <mesh material={kit.white} position={[-0.05, 0.05, 0.04]} rotation={[0, 0, 0.6]} scale={[0.04, 0.012, 0.01]}><sphereGeometry args={[1, 8, 6]} /></mesh>
      </group>)}
      <mesh material={kit.lens} position={[0, 0.15, onFace(0, 0.15, 0.01)]}><boxGeometry args={[0.12, 0.03, 0.03]} /></mesh>
      <mesh material={kit.dark} position={[0.04, -0.13, onFace(0.04, -0.13, 0.0)]} rotation={[0.2, 0.05, Math.PI + 0.25]}><torusGeometry args={[0.14, 0.024, 10, 24, Math.PI * 0.8]} /></mesh>
    </Face>
    case 'skull': return <group>
      <mesh material={kit.bone} scale={[1, 1.05, 0.95]} castShadow><sphereGeometry args={[0.5, 40, 28]} /></mesh>
      <mesh material={kit.bone} position={[0, -0.32, 0.12]} scale={[0.62, 0.36, 0.55]}><sphereGeometry args={[0.5, 28, 18]} /></mesh>
      {[-0.17, 0.17].map((x) => <mesh key={x} material={kit.dark} position={[x, 0.04, onFace(x, 0.04, -0.03)]} rotation={[0, x * 1.6, 0]} scale={[0.13, 0.12, 0.06]}><sphereGeometry args={[1, 20, 14]} /></mesh>)}
      <mesh material={kit.dark} position={[0, -0.13, 0.47]} rotation={[Math.PI, 0, 0]} scale={[1, 1, 0.5]}><coneGeometry args={[0.05, 0.09, 3]} /></mesh>
      {[-0.12, -0.04, 0.04, 0.12].map((x) => <mesh key={x} material={kit.white} position={[x, -0.3, 0.38]} scale={[0.035, 0.05, 0.03]}><sphereGeometry args={[1, 10, 8]} /></mesh>)}
    </group>
    case 'heart': return <mesh geometry={kit.heart} material={kit.red} castShadow />
    case 'fire': return <group position={[0, -0.04, 0]}>
      <mesh geometry={kit.flameOuterGeometry} material={kit.lit} scale={[1, 1, 0.85]} castShadow />
      <mesh geometry={kit.flameLickGeometry} material={kit.lit} position={[-0.26, -0.05, 0]} rotation={[0, 0, 0.45]} scale={[1, 1, 0.8]} />
      <mesh geometry={kit.flameLickGeometry} material={kit.lit} position={[0.24, -0.12, 0]} rotation={[0, 0, -0.5]} scale={[0.85, 0.8, 0.8]} />
      <mesh geometry={kit.flameInnerGeometry} material={kit.lit} position={[0, -0.08, 0.2]} scale={[1, 1, 0.6]} />
    </group>
    case 'eyes': return <group>
      {[-0.22, 0.22].map((x) => <group key={x} position={[x, 0, 0]}>
        <mesh material={kit.white} scale={[0.24, 0.36, 0.26]} castShadow><sphereGeometry args={[1, 32, 24]} /></mesh>
        <mesh material={kit.dark} position={[0.08, 0.02, 0.2]} scale={[0.12, 0.17, 0.08]}><sphereGeometry args={[1, 24, 16]} /></mesh>
        <mesh material={kit.white} position={[0.12, 0.08, 0.27]} scale={0.03}><sphereGeometry args={[1, 10, 8]} /></mesh>
      </group>)}
    </group>
    case 'pleading': return <Face kit={kit}>
      <OpenEye kit={kit} x={-0.17} y={0.07} big look={0.3} /><OpenEye kit={kit} x={0.17} y={0.07} big look={-0.3} />
      {[-0.17, 0.17].map((x) => <mesh key={x} material={kit.dark} position={[x, 0.3, onFace(x, 0.3, 0)]} rotation={[-0.5, x * 1.5, x > 0 ? -0.35 : 0.35]}><torusGeometry args={[0.07, 0.018, 8, 16, Math.PI * 0.7]} /></mesh>)}
      <Smile kit={kit} y={-0.2} r={0.08} />
    </Face>
    case 'blush': return <Face kit={kit}>
      <ArchEye kit={kit} x={-0.17} y={0.08} /><ArchEye kit={kit} x={0.17} y={0.08} />
      {[-0.26, 0.26].map((x) => <mesh key={x} material={kit.blush} position={[x, -0.06, onFace(x, -0.06, 0.0)]} rotation={[0, x * 1.4, 0]} scale={[0.1, 0.06, 0.02]}><sphereGeometry args={[1, 16, 12]} /></mesh>)}
      <Smile kit={kit} y={-0.13} r={0.15} />
    </Face>
  }
}

/* ── A small sphere physics world: gravity, bouncy floor and walls, ball-to-ball impulses, and the pointer as a paddle ── */

/** Emojis roll in the screen plane and wobble; a spring keeps their faces toward the viewer. */
type Body = { active: boolean; position: Vector3; velocity: Vector3; roll: number; rollSpeed: number; tiltX: number; tiltY: number; tiltSpeedX: number; tiltSpeedY: number; radius: number; born: number }
const GRAVITY = -17
const FLOOR_BOUNCE = 0.66
const BALL_BOUNCE = 0.55
const DEPTH = 0.9

/** Pointer and clicks in canvas coordinates from -1 to 1; null when the pointer is outside. */
export type PitInput = { pointer: [number, number] | null; bursts: [number, number][] }

export function EmojiPit({ input, still = false, max = 36 }: { input: React.MutableRefObject<PitInput>; still?: boolean; max?: number }) {
  const kit = useKit()
  const viewport = useThree((state) => state.viewport)
  const groups = useRef<(Group | null)[]>([])
  const bodies = useMemo<Body[]>(() => Array.from({ length: max }, (_, index) => ({ active: false, position: new Vector3(0, 99, 0), velocity: new Vector3(), roll: 0, rollSpeed: 0, tiltX: 0, tiltY: 0, tiltSpeedX: 0, tiltSpeedY: 0, radius: 0.42 * (0.85 + ((index * 0.618) % 1) * 0.4), born: 0 })), [max])
  const clock = useRef({ nextDrop: 0.3, dropped: 0, time: 0 })
  const temp = useMemo(() => ({ normal: new Vector3(), relative: new Vector3() }), [])
  const paddle = useMemo(() => ({ position: new Vector3(), previous: new Vector3(), velocity: new Vector3(), active: false }), [])

  const bounds = () => ({ halfWidth: viewport.width / 2, floor: -viewport.height / 2 + 0.15, top: viewport.height / 2 })

  const spawn = (body: Body, at: Vector3, kick: Vector3) => {
    body.active = true
    body.position.copy(at)
    body.velocity.copy(kick)
    body.roll = (Math.random() - 0.5) * 1.2
    body.rollSpeed = (Math.random() - 0.5) * 6
    body.tiltX = (Math.random() - 0.5) * 1.2
    body.tiltY = (Math.random() - 0.5) * 1.6
    body.tiltSpeedX = body.tiltSpeedY = 0
    body.born = clock.current.time
  }
  const nextSlot = () => bodies.find((body) => !body.active) ?? [...bodies].sort((a, b) => a.born - b.born)[0]

  const step = (dt: number) => {
    const { halfWidth, floor } = bounds()
    const { position: pointer, velocity: pointerVelocity, active: pointerActive } = paddle
    for (const body of bodies) {
      if (!body.active) continue
      body.velocity.y += GRAVITY * dt
      body.velocity.multiplyScalar(1 - 0.08 * dt)
      body.position.addScaledVector(body.velocity, dt)
      const r = body.radius
      if (body.position.y - r < floor) {
        body.position.y = floor + r
        if (body.velocity.y < 0) body.velocity.y = -body.velocity.y * FLOOR_BOUNCE
        if (Math.abs(body.velocity.y) < 0.4) body.velocity.y = 0
        body.velocity.x *= 1 - 2.2 * dt
        body.velocity.z *= 1 - 2.2 * dt
        // Rolling: spin follows the ground speed.
        body.rollSpeed += (-body.velocity.x / r - body.rollSpeed) * 0.25
      }
      for (const [axis, limit] of [['x', halfWidth], ['z', DEPTH]] as const) {
        if (body.position[axis] - r < -limit) { body.position[axis] = -limit + r; body.velocity[axis] = Math.abs(body.velocity[axis]) * 0.7 }
        if (body.position[axis] + r > limit) { body.position[axis] = limit - r; body.velocity[axis] = -Math.abs(body.velocity[axis]) * 0.7 }
      }
      if (pointerActive) {
        temp.normal.copy(body.position).sub(pointer)
        temp.normal.z *= 0.3
        const distance = temp.normal.length()
        const reach = r + 0.75
        if (distance < reach && distance > 0.0001) {
          temp.normal.divideScalar(distance)
          body.position.addScaledVector(temp.normal, reach - distance)
          const closing = temp.relative.copy(body.velocity).sub(pointerVelocity).dot(temp.normal)
          if (closing < 0) body.velocity.addScaledVector(temp.normal, -closing * 1.6 + 1.5)
          body.rollSpeed += (temp.normal.y * pointerVelocity.x - temp.normal.x * pointerVelocity.y) * 0.5
          body.tiltSpeedY += pointerVelocity.x * 0.25
          body.tiltSpeedX -= pointerVelocity.y * 0.25
        }
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]
      if (!a.active) continue
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]
        if (!b.active) continue
        temp.normal.copy(b.position).sub(a.position)
        const distance = temp.normal.length()
        const overlap = a.radius + b.radius - distance
        if (overlap <= 0 || distance < 0.0001) continue
        temp.normal.divideScalar(distance)
        a.position.addScaledVector(temp.normal, -overlap / 2)
        b.position.addScaledVector(temp.normal, overlap / 2)
        const closing = temp.relative.copy(b.velocity).sub(a.velocity).dot(temp.normal)
        if (closing < 0) {
          const impulse = -(1 + BALL_BOUNCE) * closing / 2
          a.velocity.addScaledVector(temp.normal, -impulse)
          b.velocity.addScaledVector(temp.normal, impulse)
          a.rollSpeed += impulse * temp.normal.x * 1.2
          b.rollSpeed -= impulse * temp.normal.x * 1.2
          a.tiltSpeedY -= impulse * 0.25; b.tiltSpeedY += impulse * 0.25
          a.tiltSpeedX += impulse * temp.normal.y * 0.2; b.tiltSpeedX -= impulse * temp.normal.y * 0.2
        }
      }
    }
    for (const body of bodies) {
      if (!body.active) continue
      body.rollSpeed *= 1 - 0.9 * dt
      body.roll += body.rollSpeed * dt
      body.tiltSpeedX += (-26 * body.tiltX - 3.2 * body.tiltSpeedX) * dt
      body.tiltSpeedY += (-26 * body.tiltY - 3.2 * body.tiltSpeedY) * dt
      // Never far enough round to hide the face.
      body.tiltX = Math.max(-0.5, Math.min(0.5, body.tiltX + body.tiltSpeedX * dt))
      body.tiltY = Math.max(-0.6, Math.min(0.6, body.tiltY + body.tiltSpeedY * dt))
    }
  }

  // Reduced motion: settle a pile once, offscreen, and show it standing still.
  useEffect(() => {
    if (!still) return
    const { halfWidth, top } = bounds()
    bodies.forEach((body, index) => spawn(body, new Vector3(((index * 0.618) % 1 - 0.5) * halfWidth * 1.6, top + index * 0.4, ((index * 0.37) % 1 - 0.5)), new Vector3()))
    for (let tick = 0; tick < 900; tick++) step(1 / 120)
    bodies.forEach((body, index) => { const group = groups.current[index]; if (group) { group.visible = body.active; group.position.copy(body.position); group.rotation.set(body.tiltX, body.tiltY, body.roll) } })
  }, [still, viewport.width, viewport.height])

  useFrame((_, delta) => {
    if (still) return
    const dt = Math.min(delta, 1 / 30)
    const state = clock.current
    state.time += dt
    const { halfWidth, top } = bounds()
    if (state.dropped < max && state.time > state.nextDrop) {
      const slot = nextSlot()
      spawn(slot, new Vector3((Math.random() - 0.5) * halfWidth * 1.6, top + 1, (Math.random() - 0.5) * DEPTH), new Vector3((Math.random() - 0.5) * 2, -2, 0))
      state.dropped += 1
      state.nextDrop = state.time + 0.22
    }
    const ndc = input.current.pointer
    paddle.active = Boolean(ndc)
    if (ndc) {
      paddle.previous.copy(paddle.position)
      pointerToPlane(ndc[0], ndc[1], viewport.width, viewport.height, paddle.position)
      paddle.velocity.copy(paddle.position).sub(paddle.previous).divideScalar(Math.max(dt, 1 / 120)).clampLength(0, 14)
    }
    // A click throws a handful from where the pointer is.
    while (input.current.bursts.length) {
      const [bx, by] = input.current.bursts.shift()!
      const at = pointerToPlane(bx, by, viewport.width, viewport.height, new Vector3())
      for (let n = 0; n < 4; n++) spawn(nextSlot(), at.clone().add(new Vector3((Math.random() - 0.5) * 0.6, 0.3 + n * 0.5, (Math.random() - 0.5) * 0.4)), new Vector3((Math.random() - 0.5) * 6, 5 + Math.random() * 4, 0))
    }
    for (let substep = 0; substep < 3; substep++) step(dt / 3)
    bodies.forEach((body, index) => {
      const group = groups.current[index]
      if (!group) return
      group.visible = body.active
      group.position.copy(body.position)
      group.rotation.set(body.tiltX, body.tiltY, body.roll)
    })
  })

  return <group>
    {bodies.map((body, index) => <group key={index} ref={(node) => { groups.current[index] = node }} visible={false} scale={body.radius / 0.5}>
      <EmojiModel kind={emojiKinds[index % emojiKinds.length]} kit={kit} />
    </group>)}
    <ContactShadows position={[0, -viewport.height / 2 + 0.15, 0]} opacity={0.4} scale={[viewport.width * 1.2, 4]} blur={2} far={2.5} color="#7a3b12" resolution={512} frames={still ? 2 : Infinity} />
  </group>
}

/** Turns a pointer position in -1..1 (relative to the canvas) into a point on the emoji plane. */
export function pointerToPlane(x: number, y: number, viewportWidth: number, viewportHeight: number, out: Vector3) {
  return out.set(x * viewportWidth / 2, y * viewportHeight / 2, 0)
}


/** Every emoji in a row, facing the camera. Used to check the models. */
export function EmojiShowcase() {
  const kit = useKit()
  return <group>{emojiKinds.map((kind, index) => <group key={kind} position={[(index % 5 - 2) * 1.25, index < 5 ? 0.7 : -0.7, 0]}><EmojiModel kind={kind} kit={kit} /></group>)}</group>
}
