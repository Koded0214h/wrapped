import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { NeutralToneMapping, SRGBColorSpace } from 'three'

/** WebGL can be missing or blocked (old phones, some privacy settings). Then the section keeps its static art. */
export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

type Props = {
  children: ReactNode
  className?: string
  label: string
  fallback: ReactNode
  camera?: { position: [number, number, number]; fov?: number }
  /** Called with the canvas wrapper so a scene can read pointer positions relative to it. */
  onPointer?: (x: number, y: number) => void
}

/** A canvas that only renders while it is on screen. */
export function Stage({ children, className = '', label, fallback, camera = { position: [0, 0, 6], fov: 35 }, onPointer }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [supported] = useState(webglAvailable)
  useEffect(() => {
    const node = host.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '120px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <div ref={host} className={`stage ${className}`} role="img" aria-label={label}
    onPointerMove={onPointer && ((event) => { const box = event.currentTarget.getBoundingClientRect(); onPointer((event.clientX - box.left) / box.width * 2 - 1, -((event.clientY - box.top) / box.height * 2 - 1)) })}>
    {supported ? <SceneBoundary fallback={fallback}>
      <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 2]} shadows camera={camera} gl={{ antialias: true, alpha: true, toneMapping: NeutralToneMapping, outputColorSpace: SRGBColorSpace }}>
        <Suspense fallback={null}>
          <StudioLight />
          {children}
        </Suspense>
      </Canvas>
    </SceneBoundary> : fallback}
  </div>
}

/** Soft studio light built from shapes, so nothing is downloaded. */
export function StudioLight() {
  return <>
    <ambientLight intensity={0.45} />
    <hemisphereLight args={['#fff4e6', '#5a3a2a', 0.55]} />
    <directionalLight position={[4, 6, 5]} intensity={2.1} color="#fff1df" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
    <directionalLight position={[-5, 2, -3]} intensity={1.1} color="#ffb48a" />
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2.2} color="#fff6ea" position={[0, 4, 4]} scale={[8, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.4} color="#ffd0b0" position={[-5, 1, 2]} scale={[3, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.1} color="#ffe9a8" position={[5, 0, 1]} scale={[3, 5, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={1.6} color="#ffffff" position={[2, 3, 6]} scale={2} target={[0, 0, 0]} />
    </Environment>
  </>
}
