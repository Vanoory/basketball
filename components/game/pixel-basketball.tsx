'use client'

import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Court from './court'
import PlayerMesh from './player-mesh'
import BallMesh from './ball-mesh'
import GameLoop from './game-loop'
import Effects from './effects'
import Hud from './hud'
import { useHud } from '@/lib/game'

export default function PixelBasketball() {
  const mode = useHud((s) => s.mode)
  const map = useHud((s) => s.map)
  const started = useHud((s) => s.started)
  const park = map === 'park'
  const playerIds = Array.from(
    { length: mode === '5v5' ? 10 : 6 },
    (_, i) => i,
  )
  return (
    <div className="relative h-dvh w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 8, 14], fov: 50 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
        }}
        shadows
      >
        <color attach="background" args={[park ? '#7ec3e8' : '#0f1d33']} />
        <fog
          attach="fog"
          args={park ? ['#a5d5ee', 38, 75] : ['#0f1d33', 30, 60]}
        />

        {park ? (
          <>
            {/* Bright daytime park lighting */}
            <hemisphereLight
              args={['#dff1ff', '#4d8b3f', 0.85]}
              position={[0, 20, 0]}
            />
            <ambientLight intensity={0.5} color="#fdf6e3" />
            <directionalLight
              position={[-10, 18, 8]}
              intensity={2.1}
              color="#fff6d8"
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-left={-17}
              shadow-camera-right={17}
              shadow-camera-top={17}
              shadow-camera-bottom={-19}
              shadow-camera-far={45}
              shadow-bias={-0.0004}
            />
            <directionalLight
              position={[8, 10, -6]}
              intensity={0.4}
              color="#cfe8ff"
            />
          </>
        ) : (
          <>
            {/* Night game lighting */}
            <hemisphereLight
              args={['#b7c6e0', '#1e293b', 0.55]}
              position={[0, 20, 0]}
            />
            <ambientLight intensity={0.35} color="#b7c6e0" />
            <directionalLight
              position={[8, 14, 6]}
              intensity={1.6}
              color="#fff7e0"
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-left={-17}
              shadow-camera-right={17}
              shadow-camera-top={17}
              shadow-camera-bottom={-19}
              shadow-camera-far={40}
              shadow-bias={-0.0004}
            />
            <directionalLight
              position={[-6, 10, -6]}
              intensity={0.45}
              color="#93b4e6"
            />
            {/* Cool back rim light so players pop off the court */}
            <directionalLight
              position={[0, 6, 12]}
              intensity={0.3}
              color="#7da4dd"
            />
            {/* Rim spotlight glow */}
            <pointLight
              position={[0, 5, mode === '5v5' ? -11.9 : -9.4]}
              intensity={14}
              color="#ffedd5"
              distance={9}
            />
            {mode === '5v5' ? (
              <>
                {/* Second basket glow + midcourt wash on the full court */}
                <pointLight
                  position={[0, 5, 11.9]}
                  intensity={14}
                  color="#ffedd5"
                  distance={9}
                />
                <pointLight
                  position={[0, 6, 0]}
                  intensity={6}
                  color="#fde8c8"
                  distance={16}
                />
              </>
            ) : (
              // Warm court wash from the open half-court side
              <pointLight
                position={[0, 4, 4]}
                intensity={5}
                color="#fde8c8"
                distance={14}
              />
            )}
          </>
        )}

        <Court key={`${mode}-${map}`} mode={mode} map={map} />
        {started &&
          playerIds.map((id) => <PlayerMesh key={`${mode}-${id}`} id={id} />)}
        <BallMesh />
        <Effects />
        <GameLoop />
      </Canvas>
      <Hud />
    </div>
  )
}
