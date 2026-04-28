
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Sky, Stars, Environment, MeshReflectorMaterial, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise, Scanline, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import Weapon from './Weapon';
import { Enemy, WeaponType, WEAPONS, AIState, Mission, MapTheme } from '../types';

interface GameWorldProps {
  isPaused: boolean;
  onHit: () => void;
  onKill: () => void;
  onFire: () => void;
  onVictory: () => void;
  enemiesRemaining: number;
  currentWeaponType: WeaponType;
  mission: Mission | null;
}

const THEME_CONFIG = {
  [MapTheme.CYBER]: { wall: '#111', neon: '#00ffff', floor: '#050505', sky: '#000810', mist: '#002233' },
  [MapTheme.INDUSTRIAL]: { wall: '#2a2a2a', neon: '#ff9900', floor: '#1a1a1a', sky: '#151515', mist: '#332211' },
  [MapTheme.ARCTIC]: { wall: '#e0e8f0', neon: '#0077ff', floor: '#f0f4f8', sky: '#a0c0ff', mist: '#ffffff' },
  [MapTheme.DESERT]: { wall: '#d2b48c', neon: '#ff4400', floor: '#c2b280', sky: '#ffccaa', mist: '#553300' },
  [MapTheme.VOLCANIC]: { wall: '#221100', neon: '#ff2200', floor: '#110000', sky: '#220000', mist: '#441100' },
};

const VFXManager = React.forwardRef((_, ref) => {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 2000;
  const particles = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const lives = new Float32Array(particleCount);
    return { pos, colors, velocities, lives };
  }, []);

  const triggerEffect = useCallback((position: THREE.Vector3, color: THREE.Color, count: number = 20, speed: number = 0.2) => {
    let triggered = 0;
    for (let i = 0; i < particleCount && triggered < count; i++) {
        if (particles.lives[i] <= 0) {
            particles.pos[i * 3] = position.x;
            particles.pos[i * 3 + 1] = position.y;
            particles.pos[i * 3 + 2] = position.z;
            particles.velocities[i * 3] = (Math.random() - 0.5) * speed;
            particles.velocities[i * 3 + 1] = (Math.random() - 0.5) * speed + (speed * 0.5);
            particles.velocities[i * 3 + 2] = (Math.random() - 0.5) * speed;
            particles.colors[i * 3] = color.r;
            particles.colors[i * 3 + 1] = color.g;
            particles.colors[i * 3 + 2] = color.b;
            particles.lives[i] = 1.0;
            triggered++;
        }
    }
  }, [particles]);

  React.useImperativeHandle(ref, () => ({ triggerEffect }));

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position;
    const colors = pointsRef.current.geometry.attributes.color;
    for (let i = 0; i < particleCount; i++) {
        if (particles.lives[i] > 0) {
            particles.lives[i] -= delta * 2;
            particles.pos[i * 3] += particles.velocities[i * 3];
            particles.pos[i * 3 + 1] += particles.velocities[i * 3 + 1];
            particles.pos[i * 3 + 2] += particles.velocities[i * 3 + 2];
            particles.velocities[i * 3 + 1] -= 0.01;
            positions.setXYZ(i, particles.pos[i * 3], particles.pos[i * 3 + 1], particles.pos[i * 3 + 2]);
            const alpha = Math.max(0, particles.lives[i]);
            colors.setXYZ(i, particles.colors[i * 3] * alpha, particles.colors[i * 3 + 1] * alpha, particles.colors[i * 3 + 2] * alpha);
        } else {
            positions.setXYZ(i, 0, -100, 0);
        }
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={particles.pos} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={particleCount} array={particles.colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.1} vertexColors transparent blending={THREE.AdditiveBlending} />
    </points>
  );
});

const useKeyboard = () => {
  const [keys, setKeys] = useState({ forward: false, backward: false, left: false, right: false, shift: false, jump: false });
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': setKeys(k => ({ ...k, forward: true })); break;
        case 'KeyS': setKeys(k => ({ ...k, backward: true })); break;
        case 'KeyA': setKeys(k => ({ ...k, left: true })); break;
        case 'KeyD': setKeys(k => ({ ...k, right: true })); break;
        case 'ShiftLeft': setKeys(k => ({ ...k, shift: true })); break;
        case 'Space': setKeys(k => ({ ...k, jump: true })); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': setKeys(k => ({ ...k, forward: false })); break;
        case 'KeyS': setKeys(k => ({ ...k, backward: false })); break;
        case 'KeyA': setKeys(k => ({ ...k, left: false })); break;
        case 'KeyD': setKeys(k => ({ ...k, right: false })); break;
        case 'ShiftLeft': setKeys(k => ({ ...k, shift: false })); break;
        case 'Space': setKeys(k => ({ ...k, jump: false })); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  return keys;
};

const TacticalMap: React.FC<{ extractionReady: boolean; mission: Mission | null }> = ({ extractionReady, mission }) => {
  const theme = mission ? THEME_CONFIG[mission.mapTheme] : THEME_CONFIG[MapTheme.CYBER];
  const obstacles = mission?.obstaclePositions || [];

  return (
    <group>
      {/* Walls */}
      <mesh position={[0, 10, -100]}><boxGeometry args={[200, 20, 2]} /><meshStandardMaterial color={theme.wall} /></mesh>
      <mesh position={[0, 10, 100]}><boxGeometry args={[200, 20, 2]} /><meshStandardMaterial color={theme.wall} /></mesh>
      <mesh position={[-100, 10, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[200, 20, 2]} /><meshStandardMaterial color={theme.wall} /></mesh>
      <mesh position={[100, 10, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[200, 20, 2]} /><meshStandardMaterial color={theme.wall} /></mesh>
      
      {/* Dynamic Obstacles */}
      {obstacles.map((pos, i) => {
        const isBig = i % 3 === 0;
        return (
          <group key={i} position={[pos[0], isBig ? 10 : 1, pos[2]]}>
            <mesh>
              <boxGeometry args={isBig ? [5, 20, 5] : [8, 2, 2]} />
              <meshStandardMaterial color={isBig ? theme.wall : "#222"} />
            </mesh>
            {isBig && (
              <mesh position={[0, 0, 2.6]}>
                <boxGeometry args={[2, 18, 0.2]} />
                <meshStandardMaterial color={theme.neon} emissive={theme.neon} emissiveIntensity={2} />
              </mesh>
            )}
          </group>
        );
      })}

      {extractionReady && (
        <group position={[0, 0.1, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[4, 5, 32]} /><meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={5} transparent opacity={0.5} /></mesh>
          <pointLight color="#10b981" intensity={10} distance={15} />
        </group>
      )}
    </group>
  );
};

const PlayerController: React.FC<{ extractionReady: boolean; onVictory: () => void; mission: Mission | null }> = ({ extractionReady, onVictory, mission }) => {
  const { camera } = useThree();
  const keys = useKeyboard();
  const verticalVelocity = useRef(0);
  const isGrounded = useRef(true);
  const GROUND_Y = 1.8;
  const PLAYER_RADIUS = 0.8;
  const bobRef = useRef(0);
  const tiltRef = useRef(0);

  const checkCollision = (newPos: THREE.Vector3) => {
    if (!mission) return false;
    
    // Check dynamic obstacles
    for (let i = 0; i < mission.obstaclePositions.length; i++) {
        const [ox, oy, oz] = mission.obstaclePositions[i];
        const isBig = i % 3 === 0;
        const width = isBig ? 5 : 8;
        const depth = isBig ? 5 : 2;
        
        const halfWidth = width / 2;
        const halfDepth = depth / 2;

        if (newPos.x + PLAYER_RADIUS > ox - halfWidth &&
            newPos.x - PLAYER_RADIUS < ox + halfWidth &&
            newPos.z + PLAYER_RADIUS > oz - halfDepth &&
            newPos.z - PLAYER_RADIUS < oz + halfDepth) {
            return true;
        }
    }
    return false;
  };

  useFrame((state, delta) => {
    const moveSpeed = keys.shift ? 14 : 8;
    const direction = new THREE.Vector3(Number(keys.right) - Number(keys.left), 0, Number(keys.backward) - Number(keys.forward)).normalize();
    
    // View Bobbing & Sway
    if (direction.length() > 0 && isGrounded.current) {
      bobRef.current += delta * (keys.shift ? 18 : 12);
    } else {
      bobRef.current = THREE.MathUtils.lerp(bobRef.current, 0, 0.1);
    }
    
    const bobAmount = 0.05;
    const bobY = Math.sin(bobRef.current) * bobAmount;
    
    // Camera Tilt on Strafing
    const targetTilt = (Number(keys.left) - Number(keys.right)) * 0.05;
    tiltRef.current = THREE.MathUtils.lerp(tiltRef.current, targetTilt, 0.1);
    camera.rotation.z = tiltRef.current;

    if (direction.length() > 0) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
        
        const moveVector = new THREE.Vector3()
            .add(forward.clone().multiplyScalar(-direction.z * moveSpeed * delta))
            .add(right.clone().multiplyScalar(direction.x * moveSpeed * delta));

        // Try moving X
        const nextPosX = camera.position.clone().add(new THREE.Vector3(moveVector.x, 0, 0));
        if (!checkCollision(nextPosX)) {
            camera.position.x = nextPosX.x;
        }

        // Try moving Z
        const nextPosZ = camera.position.clone().add(new THREE.Vector3(0, 0, moveVector.z));
        if (!checkCollision(nextPosZ)) {
            camera.position.z = nextPosZ.z;
        }
    }
    if (keys.jump && isGrounded.current) {
      verticalVelocity.current = 12;
      isGrounded.current = false;
    }
    
    const baseY = isGrounded.current ? GROUND_Y : camera.position.y;
    
    if (!isGrounded.current) {
      verticalVelocity.current -= 30 * delta;
      camera.position.y += verticalVelocity.current * delta;
      if (camera.position.y <= GROUND_Y) {
        camera.position.y = GROUND_Y;
        verticalVelocity.current = 0;
        isGrounded.current = true;
      }
    } else {
      camera.position.y = GROUND_Y + bobY;
    }

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -95, 95);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -95, 95);
    if (extractionReady && new THREE.Vector2(camera.position.x, camera.position.z).length() < 5) onVictory();
  });
  return null;
};

const EnemyNPC: React.FC<{ 
  enemy: Enemy; 
  onHit: (id: string, pos: THREE.Vector3) => void; 
  onPlayerHurt: () => void;
  updateEnemyPosition: (id: string, pos: [number, number, number], state: AIState, target?: [number, number, number]) => void;
  obstaclePositions: [number, number, number][];
}> = ({ enemy, onHit, onPlayerHurt, updateEnemyPosition, obstaclePositions }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const lastFireTime = useRef(0);
  const lastStateChangeTime = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current || !enemy.isAlive) return;
    const t = state.clock.getElapsedTime();
    const playerPos = camera.position;
    const enemyPos = new THREE.Vector3(...enemy.position);
    const distToPlayer = enemyPos.distanceTo(playerPos);

    // AI State Machine Logic
    if (t - lastStateChangeTime.current > 4) {
      lastStateChangeTime.current = t;
      const rand = Math.random();
      
      let nextState = enemy.aiState || AIState.IDLE;
      let nextTarget = enemy.targetPosition;

      if (distToPlayer < 60) {
        if (rand < 0.4 && obstaclePositions.length > 0) {
          // Seek Cover
          const closestCover = obstaclePositions.reduce((prev, curr) => {
            const d1 = enemyPos.distanceTo(new THREE.Vector3(...prev));
            const d2 = enemyPos.distanceTo(new THREE.Vector3(...curr));
            return d1 < d2 ? prev : curr;
          });
          nextState = AIState.MOVING_TO_COVER;
          nextTarget = [...closestCover] as [number, number, number];
        } else if (rand < 0.8) {
          // Flanking maneuver
          const angle = (Math.random() - 0.5) * Math.PI; // +/- 90 degrees from player vector
          const flankDir = new THREE.Vector3().subVectors(enemyPos, playerPos).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          const flankPos = new THREE.Vector3().copy(enemyPos).add(flankDir.multiplyScalar(15));
          nextState = AIState.FLANKING;
          nextTarget = [flankPos.x, 0, flankPos.z];
        } else {
          nextState = AIState.ENGAGED;
        }
      } else {
        nextState = AIState.IDLE;
      }
      
      updateEnemyPosition(enemy.id, enemy.position, nextState, nextTarget);
    }

    // Movement execution
    if (enemy.targetPosition && (enemy.aiState === AIState.FLANKING || enemy.aiState === AIState.MOVING_TO_COVER)) {
      const target = new THREE.Vector3(...enemy.targetPosition);
      const moveDir = new THREE.Vector3().subVectors(target, enemyPos).normalize();
      const speed = enemy.type === 'tank' ? 2 : 5;
      
      if (enemyPos.distanceTo(target) > 1) {
        const newPos: [number, number, number] = [
          enemy.position[0] + moveDir.x * speed * delta,
          0,
          enemy.position[2] + moveDir.z * speed * delta
        ];
        updateEnemyPosition(enemy.id, newPos, enemy.aiState, enemy.targetPosition);
      } else if (enemy.aiState === AIState.MOVING_TO_COVER) {
        updateEnemyPosition(enemy.id, enemy.position, AIState.IN_COVER, undefined);
      } else {
        updateEnemyPosition(enemy.id, enemy.position, AIState.ENGAGED, undefined);
      }
    }

    // Aim and Fire
    groupRef.current.lookAt(playerPos.x, enemy.position[1] + 1.2, playerPos.z);
    
    // Fire frequency depends on state (suppressing fire vs careful shots)
    const fireInterval = enemy.aiState === AIState.IN_COVER ? 1.5 : 3.0;
    if (distToPlayer < 50 && t - lastFireTime.current > (fireInterval + Math.random() * 2)) {
      lastFireTime.current = t;
      const accuracy = enemy.type === 'tank' ? 0.4 : 0.7;
      if (Math.random() < accuracy) onPlayerHurt();
    }
  });

  if (!enemy.isAlive) return null;
  const armorColor = enemy.type === 'tank' ? '#333' : '#1a1a1a';
  const detailColor = enemy.aiState === AIState.IN_COVER ? '#00ffaa' : (enemy.type === 'tank' ? '#ffaa00' : '#ff3333');
  const scale = enemy.type === 'tank' ? 1.4 : 1.1;

  return (
    <group ref={groupRef} position={enemy.position} scale={[scale, scale, scale]}>
      <group onClick={(e) => { e.stopPropagation(); onHit(enemy.id, e.point); }}>
        {/* Torso with glowing core */}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.7, 0.9, 0.4]} />
          <meshStandardMaterial color={armorColor} metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.2, 0.22]}>
          <planeGeometry args={[0.3, 0.4]} />
          <meshBasicMaterial color={detailColor} transparent opacity={0.5} />
        </mesh>
        
        {/* Head with Visor */}
        <group position={[0, 1.85, 0]}>
          <mesh>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#0a0a0a" metalness={1} />
          </mesh>
          <mesh position={[0, 0, 0.16]}>
            <boxGeometry args={[0.3, 0.05, 0.05]} />
            <meshStandardMaterial color={detailColor} emissive={detailColor} emissiveIntensity={6} />
          </mesh>
        </group>

        {/* Heavy Shoulder Pads */}
        <mesh position={[-0.45, 1.6, 0]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial color={armorColor} />
        </mesh>
        <mesh position={[0.45, 1.6, 0]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial color={armorColor} />
        </mesh>

        {/* Arms */}
        <mesh position={[-0.45, 1.2, 0]}><boxGeometry args={[0.22, 0.7, 0.22]} /><meshStandardMaterial color={armorColor} /></mesh>
        <mesh position={[0.45, 1.2, 0]}><boxGeometry args={[0.22, 0.7, 0.22]} /><meshStandardMaterial color={armorColor} /></mesh>
        
        {/* Legs / Lower Chassis */}
        <mesh position={[-0.25, 0.4, 0]}><cylinderGeometry args={[0.1, 0.1, 0.8]} /><meshStandardMaterial color="#050505" /></mesh>
        <mesh position={[0.25, 0.4, 0]}><cylinderGeometry args={[0.1, 0.1, 0.8]} /><meshStandardMaterial color="#050505" /></mesh>

        {/* Futuristic Weapon */}
        <group position={[0.5, 1.1, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.07, 0.08, 0.9]} />
            <meshStandardMaterial color="#111" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.1, 0.1, 0.2]} />
            <meshStandardMaterial color={detailColor} emissive={detailColor} emissiveIntensity={2} />
          </mesh>
        </group>
      </group>
      <pointLight position={[0, 1.2, 0.3]} intensity={0.8} color={detailColor} distance={4} />
    </group>
  );
};

const Scene: React.FC<GameWorldProps> = ({ isPaused, onHit, onKill, onFire, onVictory, enemiesRemaining, currentWeaponType, mission }) => {
  const vfxRef = useRef<any>(null);
  const { camera, scene } = useThree();
  const [isFiring, setIsFiring] = useState(false);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const lastShootTime = useRef(0);
  const mousePressed = useRef(false);
  const theme = mission ? THEME_CONFIG[mission.mapTheme] : THEME_CONFIG[MapTheme.CYBER];

  useEffect(() => {
    const list: Enemy[] = [];
    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const radius = 40 + Math.random() * 40;
        list.push({ 
          id: `e-${i}`, 
          position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius], 
          health: 100, 
          type: i % 5 === 0 ? 'tank' : 'soldier', 
          isAlive: true,
          aiState: AIState.IDLE 
        });
    }
    setEnemies(list);
  }, [mission]); // Re-spawn enemies if mission changes

  const updateEnemyPosition = useCallback((id: string, pos: [number, number, number], state: AIState, target?: [number, number, number]) => {
    setEnemies(prev => prev.map(e => e.id === id ? { ...e, position: pos, aiState: state, targetPosition: target } : e));
  }, []);

  const handleShoot = useCallback(() => {
    const config = WEAPONS[currentWeaponType];
    const now = performance.now();
    if (now - lastShootTime.current < config.fireRate) return;
    
    lastShootTime.current = now;
    onFire();
    setIsFiring(true);
    setTimeout(() => setIsFiring(false), 50);

    const raycaster = new THREE.Raycaster();
    for (let i = 0; i < config.projectiles; i++) {
        const spreadOffset = new THREE.Vector2(
            (Math.random() - 0.5) * config.spread,
            (Math.random() - 0.5) * config.spread
        );
        raycaster.setFromCamera(spreadOffset, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0) {
            const hit = intersects[0];
            if (vfxRef.current) {
                const isWall = !hit.object.parent?.userData?.enemyId;
                const hitColor = isWall ? new THREE.Color(theme.neon) : new THREE.Color(0xffaa00);
                vfxRef.current.triggerEffect(hit.point, hitColor, isWall ? 10 : 30, 0.2);
            }
        }
    }
  }, [camera, scene, onFire, currentWeaponType, theme]);

  useFrame(() => {
    if (mousePressed.current && !isPaused && WEAPONS[currentWeaponType].automatic) {
      handleShoot();
    }
  });

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => { 
        if (e.button === 0 && !isPaused) {
            mousePressed.current = true;
            if (!WEAPONS[currentWeaponType].automatic) handleShoot();
        }
    };
    const handleMouseUp = (e: MouseEvent) => { if (e.button === 0) mousePressed.current = false; };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleShoot, isPaused, currentWeaponType]);

  const handleEnemyHit = (id: string, pos: THREE.Vector3) => {
    setEnemies(prev => prev.map(e => {
        if (e.id === id) {
            onKill();
            if (vfxRef.current) vfxRef.current.triggerEffect(pos, new THREE.Color(0xff0000), 50, 0.4);
            return { ...e, isAlive: false };
        }
        return e;
    }));
  };

  return (
    <>
      <EffectComposer disableNormalPass>
        <Bloom 
          intensity={1.5} 
          luminanceThreshold={0.4} 
          luminanceSmoothing={0.9} 
          mipmapBlur 
        />
        <ChromaticAberration offset={new THREE.Vector2(0.001, 0.001)} />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
        <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
        <Scanline density={1.2} opacity={0.02} />
      </EffectComposer>

      <Sky sunPosition={[100, 20, 100]} />
      <Stars radius={150} depth={50} count={7000} factor={4} />
      <fog attach="fog" args={[theme.mist, 30, 250]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 15, 0]} intensity={4} color={theme.neon} />
      <Environment preset="city" />
      
      {/* Dynamic Flashlight */}
      <spotLight 
        position={camera.position} 
        angle={0.3} 
        penumbra={0.5} 
        intensity={2} 
        distance={40} 
        castShadow
        target-position={[
          camera.position.x + Math.sin(camera.rotation.y) * -10,
          camera.position.y + Math.sin(camera.rotation.x) * 10,
          camera.position.z + Math.cos(camera.rotation.y) * -10
        ]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={40}
          roughness={1}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color={theme.floor}
          metalness={0.5}
        />
      </mesh>
      
      <ContactShadows resolution={1024} scale={150} blur={2} opacity={0.5} far={10} color="#000000" />
      
      <TacticalMap extractionReady={enemiesRemaining <= 0} mission={mission} />
      <VFXManager ref={vfxRef} />
      {enemies.map(enemy => (
        <group key={enemy.id} userData={{ enemyId: enemy.id }}>
           <EnemyNPC 
             enemy={enemy} 
             onHit={handleEnemyHit} 
             onPlayerHurt={onHit} 
             updateEnemyPosition={updateEnemyPosition} 
             obstaclePositions={mission?.obstaclePositions || []}
           />
        </group>
      ))}
      {!isPaused && (
        <group>
          <PlayerController extractionReady={enemiesRemaining <= 0} onVictory={onVictory} mission={mission} />
          <Weapon isFiring={isFiring} type={currentWeaponType} />
          <PointerLockControls />
        </group>
      )}
    </>
  );
};

const GameWorld: React.FC<GameWorldProps> = (props) => {
  return (
    <div className="w-full h-full cursor-crosshair">
      <Canvas shadows camera={{ fov: 75, position: [0, 1.8, 10] }}>
        <Scene {...props} />
      </Canvas>
    </div>
  );
};

export default GameWorld;
