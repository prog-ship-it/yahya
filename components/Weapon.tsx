
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WeaponType } from '../types';

interface WeaponProps {
  isFiring: boolean;
  type: WeaponType;
}

const Weapon: React.FC<WeaponProps> = ({ isFiring, type }) => {
  const groupRef = useRef<THREE.Group>(null);
  const muzzleFlashRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const armRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Weapon and Arm sway
    const swayX = Math.sin(time * 1.5) * 0.008;
    const swayY = Math.cos(time * 2) * 0.008;
    
    // Base position (Bottom Right)
    groupRef.current.position.set(0.55 + swayX, -0.45 + swayY, -0.8);

    // Recoil and Muzzle Flash intensity based on type
    const recoilIntensity = type === WeaponType.SHOTGUN || type === WeaponType.RAILGUN ? 0.25 : type === WeaponType.SNIPER ? 0.35 : type === WeaponType.RIFLE ? 0.06 : 0.1;
    const recoilRot = type === WeaponType.SHOTGUN || type === WeaponType.RAILGUN ? 0.2 : type === WeaponType.SNIPER ? 0.4 : 0.08;

    if (isFiring) {
        groupRef.current.position.z += recoilIntensity;
        groupRef.current.rotation.x += recoilRot;
        if (muzzleFlashRef.current) {
            muzzleFlashRef.current.visible = true;
            const flashScale = type === WeaponType.RAILGUN ? 4 : type === WeaponType.SHOTGUN ? 2.5 : 1.2;
            muzzleFlashRef.current.scale.setScalar(flashScale + Math.random() * 0.5);
            muzzleFlashRef.current.rotation.z = Math.random() * Math.PI;
        }
    } else {
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.2);
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, -0.8, 0.2);
        if (muzzleFlashRef.current) muzzleFlashRef.current.visible = false;
    }

    // Shell ejection logic
    if (shellRef.current && isFiring) {
        shellRef.current.visible = true;
        shellRef.current.position.set(0.1, 0.05, -0.2);
    }
    if (shellRef.current && shellRef.current.visible) {
        shellRef.current.position.x += 0.12;
        shellRef.current.position.y += 0.08;
        shellRef.current.rotation.x += 0.8;
        if (shellRef.current.position.x > 1.2) shellRef.current.visible = false;
    }
  });

  return (
    <group ref={groupRef}>
      {/* PLAYER ARM & HAND */}
      <group position={[-0.1, -0.2, 0.4]}>
        {/* Forearm */}
        <mesh rotation={[Math.PI / 10, 0, 0]}>
          <boxGeometry args={[0.2, 0.2, 0.8]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.8} />
        </mesh>
        {/* Tactical Glove / Hand */}
        <mesh position={[0, 0.1, -0.4]}>
          <boxGeometry args={[0.18, 0.18, 0.22]} />
          <meshStandardMaterial color="#111" metalness={0.2} />
        </mesh>
        {/* Thumb Grip Detail */}
        <mesh position={[0.08, 0.15, -0.45]}>
          <boxGeometry args={[0.04, 0.1, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* WEAPON MODEL */}
      <group position={[0, 0, 0]}>
        {/* Grip */}
        <mesh position={[0, -0.15, 0.1]} rotation={[Math.PI / 8, 0, 0]}>
          <boxGeometry args={[0.12, 0.4, 0.15]} />
          <meshStandardMaterial color="#222" />
        </mesh>

        {/* Receiver / Main Body */}
        <mesh position={[0, 0.05, -0.1]}>
          <boxGeometry args={[
            type === WeaponType.SHOTGUN ? 0.22 : type === WeaponType.RIFLE ? 0.18 : 0.14,
            0.22,
            type === WeaponType.PISTOL ? 0.5 : 0.9
          ]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Weapon Details based on Type */}
        {type === WeaponType.RIFLE && (
          <group>
            {/* Extended Barrel */}
            <mesh position={[0, 0.05, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.8]} />
              <meshStandardMaterial color="#050505" metalness={1} />
            </mesh>
            {/* Holographic Sight Frame */}
            <mesh position={[0, 0.22, -0.1]}>
              <boxGeometry args={[0.1, 0.12, 0.15]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            {/* Holographic Reticle Glow */}
            <mesh position={[0, 0.24, -0.1]}>
              <planeGeometry args={[0.06, 0.06]} />
              <meshBasicMaterial color="#00ffff" transparent opacity={0.6} />
            </mesh>
            {/* Magazine */}
            <mesh position={[0, -0.3, -0.2]} rotation={[Math.PI / 10, 0, 0]}>
              <boxGeometry args={[0.12, 0.4, 0.2]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          </group>
        )}

        {type === WeaponType.SHOTGUN && (
          <group>
            {/* Heavy Twin Barrels */}
            <mesh position={[-0.05, 0.05, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.7]} />
              <meshStandardMaterial color="#050505" metalness={1} />
            </mesh>
            <mesh position={[0.05, 0.05, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.7]} />
              <meshStandardMaterial color="#050505" metalness={1} />
            </mesh>
            {/* Pump Handle / Heat Shield */}
            <mesh position={[0, -0.05, -0.5]}>
              <boxGeometry args={[0.24, 0.1, 0.6]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          </group>
        )}

        {type === WeaponType.PISTOL && (
          <group>
            {/* Slide Top */}
            <mesh position={[0, 0.16, -0.1]}>
              <boxGeometry args={[0.12, 0.05, 0.52]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.9} />
            </mesh>
            {/* Laser Sight Under-barrel */}
            <mesh position={[0, -0.08, -0.3]}>
              <boxGeometry args={[0.06, 0.06, 0.2]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0, -0.08, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.01]} />
              <meshBasicMaterial color="#ff0000" />
            </mesh>
          </group>
        )}

        {type === WeaponType.SMG && (
          <group>
            {/* Compact Body */}
            <mesh position={[0, 0.1, -0.2]}>
              <boxGeometry args={[0.16, 0.3, 0.6]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            {/* Short Barrel */}
            <mesh position={[0, 0.15, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.3]} />
              <meshStandardMaterial color="#000" />
            </mesh>
            {/* Magazine */}
            <mesh position={[0, -0.2, -0.1]}>
              <boxGeometry args={[0.1, 0.5, 0.1]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>
          </group>
        )}

        {type === WeaponType.SNIPER && (
          <group>
            {/* Long Body */}
            <mesh position={[0, 0.1, -0.1]}>
              <boxGeometry args={[0.18, 0.25, 1.2]} />
              <meshStandardMaterial color="#050505" />
            </mesh>
            {/* Sniper Barrel */}
            <mesh position={[0, 0.12, -1.2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 1.5]} />
              <meshStandardMaterial color="#000" />
            </mesh>
            {/* Scope */}
            <mesh position={[0, 0.3, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.4]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0, 0.3, -0.38]}>
              <planeGeometry args={[0.08, 0.08]} />
              <meshBasicMaterial color="#00ff00" transparent opacity={0.4} />
            </mesh>
          </group>
        )}

        {type === WeaponType.RAILGUN && (
          <group>
            {/* Futuristic Split Body */}
            <mesh position={[0, 0.2, -0.4]}>
              <boxGeometry args={[0.05, 0.4, 1.2]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[0, -0.1, -0.4]}>
              <boxGeometry args={[0.2, 0.2, 1.2]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            {/* Energy Core */}
            <mesh position={[0, 0.05, -0.4]}>
              <boxGeometry args={[0.1, 0.1, 1.0]} />
              <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={5} />
            </mesh>
            {/* Rail Side Panels */}
            <mesh position={[-0.1, 0.1, -0.4]}>
              <boxGeometry args={[0.02, 0.3, 1.1]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0.1, 0.1, -0.4]}>
              <boxGeometry args={[0.02, 0.3, 1.1]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          </group>
        )}

        {/* Global Battery / Magazine Glow (Common Futuristic Detail) */}
        <mesh position={[0, -0.05, 0.1]}>
          <boxGeometry args={[0.16, 0.08, 0.1]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* Shell Ejection Port */}
      <mesh ref={shellRef} visible={false}>
        <cylinderGeometry args={[0.012, 0.012, 0.05]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>
      
      {/* Volumetric Muzzle Flash */}
      <group ref={muzzleFlashRef} position={[0, 0.05, type === WeaponType.RIFLE ? -1.3 : type === WeaponType.SHOTGUN ? -1.1 : -0.6]} visible={false}>
        <mesh>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={1} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.6, 0.04, 0.04]} />
            <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.6, 0.04, 0.04]} />
            <meshBasicMaterial color="#ffffff" />
        </mesh>
        <pointLight intensity={30} color="#00ffff" distance={15} decay={2} />
      </group>
    </group>
  );
};

export default Weapon;
