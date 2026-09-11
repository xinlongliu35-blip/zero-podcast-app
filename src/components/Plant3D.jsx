import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const Flower = ({ position, rotation, color }) => {
  const petals = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => ({
      rotation: [0, (i * Math.PI * 2) / 5, Math.PI / 3],
      scale: [0.15, 0.05, 0.25],
    }));
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* Stem */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1, 8]} />
        <meshStandardMaterial color="#B8B4AE" roughness={0.8} />
      </mesh>
      {/* Petals */}
      <group position={[0, 0.1, 0]}>
        {petals.map((p, i) => (
          <mesh key={i} rotation={p.rotation} scale={p.scale}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        ))}
        {/* Center */}
        <mesh>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#C8C4BE" roughness={1} />
        </mesh>
      </group>
    </group>
  );
};

const PlantScene = () => {
  const groupRef = useRef();
  
  const flowers = useMemo(() => [
    { pos: [0, 0.5, 0], rot: [0, 0, 0], col: '#E8E4DE' },
    { pos: [0.3, 0.4, 0.2], rot: [0.2, 0.5, 0.1], col: '#D8D4CE' },
    { pos: [-0.3, 0.35, -0.2], rot: [-0.1, -0.4, -0.2], col: '#C8C4BE' },
    { pos: [0.1, 0.45, -0.3], rot: [0.3, 2, 0.1], col: '#E8E4DE' },
    { pos: [-0.2, 0.3, 0.3], rot: [-0.2, -1.5, 0.2], col: '#D8D4CE' },
  ], []);

  return (
    <group ref={groupRef}>
      {/* Pot / Base */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[1.2, 1.0, 0.4, 32]} />
        <meshStandardMaterial color="#F5F2ED" roughness={0.3} />
      </mesh>
      
      {/* Plants cluster */}
      <group position={[0, 0, 0]}>
        {flowers.map((f, i) => (
          <Flower key={i} position={f.pos} rotation={f.rot} color={f.col} />
        ))}
      </group>
    </group>
  );
};

const Plant3D = () => {
  return (
    <div className="w-full h-full relative">
      <Canvas shadows dpr={[1, 2]} alpha>
        <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={45} />
        
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={0.8} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-5, 5, -5]} intensity={0.4} color="#FFFFFF" />
        
        <PlantScene />
        
        <ContactShadows 
          position={[0, -0.4, 0]} 
          opacity={0.2} 
          scale={10} 
          blur={2.5} 
          far={4} 
        />
        
        <OrbitControls 
          enableZoom={false} 
          autoRotate 
          autoRotateSpeed={0.5} 
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.5}
        />
      </Canvas>
      
      {/* UI Overlay Labels */}
      <div className="absolute top-4 right-4 bg-white border border-border-color rounded-2xl p-3 shadow-card flex flex-col items-center min-w-[60px]">
        <span className="text-[20px] font-black text-text-main leading-none">12</span>
        <span className="text-[8px] font-black text-text-gray uppercase tracking-widest mt-1">DAYS</span>
      </div>
      
      <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md border border-border-color rounded-xl px-3 py-1.5 shadow-sm">
        <span className="text-[10px] font-bold text-text-gray">植物状态: <span className="text-primary">繁茂生长中</span></span>
      </div>
    </div>
  );
};

export default Plant3D;
