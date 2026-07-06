'use client'

import { Canvas } from '@react-three/fiber'
import Court from './court'
import PlayerMesh from './player-mesh'
import BallMesh from './ball-mesh'
import GameLoop from './game-loop'
import Hud from './hud'

export default function PixelBasketball() {
  return (
    <div className="relative h-screen w-full">
      <Canvas
        dpr={0.55}
        camera={{ position: [0, 8, 14], fov: 50 }}
        gl={{ antialias: false }}
        shadows
      >
        <color attach="background" args={['#0f1d33']} />
        <fog attach="fog" args={['#0f1d33', 30, 60]} />

        {/* Night game lighting */}
        <ambientLight intensity={0.55} color="#b7c6e0" />
        <directionalLight
          position={[8, 14, 6]}
          intensity={1.35}
          color="#fff7e0"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-16}
          shadow-camera-far={40}
        />
        <directionalLight
          position={[-6, 10, -6]}
          intensity={0.35}
          color="#93b4e6"
        />
        {/* Rim spotlight glow */}
        <pointLight position={[0, 5, -9.4]} intensity={12} color="#ffedd5" distance={9} />

        <Court />
        {[0, 1, 2, 3, 4, 5].map((id) => (
          <PlayerMesh key={id} id={id} />
        ))}
        <BallMesh />
        <GameLoop />
      </Canvas>
      <Hud />
    </div>
  )
}
