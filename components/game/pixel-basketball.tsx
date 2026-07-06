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
        dpr={0.4}
        camera={{ position: [0, 8, 14], fov: 50 }}
        gl={{ antialias: false }}
        shadows={false}
      >
        <color attach="background" args={['#1e3a5f']} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 12, 6]} intensity={1.1} />
        <directionalLight position={[-4, 8, -4]} intensity={0.35} />

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
