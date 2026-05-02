
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Sky, Stars, Environment, MeshReflectorMaterial, ContactShadows, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise, Scanline, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import Weapon from './Weapon';
import { Enemy, WeaponType, WEAPONS, AIState, Mission, MapTheme, MultiplayerPlayer, GameMode, Team, Flag } from '../types';
import { multiplayerService } from '../services/multiplayerService';

interface GameWorldProps {
  isPaused: boolean;
  onHit: () => void;
  onKill: () => void;
  onFire: () => void;
  onVictory: () => void;
  enemiesRemaining: number;
  currentWeaponType: WeaponType;
  mission: Mission | null;
  isMultiplayer: boolean;
  playerName: string;
  mobileInput?: { x: number; y: number };
  gameMode?: GameMode;
  roomFlags?: Flag[];
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

const PlayerController: React.FC<{ 
  extractionReady: boolean; 
  onVictory: () => void; 
  mission: Mission | null; 
  isMultiplayer: boolean;
  mobileInput?: { x: number; y: number };
  gameMode?: GameMode;
  roomFlags?: Flag[];
}> = ({ extractionReady, onVictory, mission, isMultiplayer, mobileInput, gameMode, roomFlags }) => {
  const { camera, gl } = useThree();
  
  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  const keys = useKeyboard();
  const verticalVelocity = useRef(0);
  const isGrounded = useRef(true);
  const GROUND_Y = 1.8;
  const PLAYER_RADIUS = 0.8;
  const bobRef = useRef(0);
  const tiltRef = useRef(0);
  const lastEmitTime = useRef(0);

  // Check for flag pickups in CTF
  useEffect(() => {
    if (gameMode !== GameMode.CTF || !roomFlags || !isMultiplayer) return;

    const checkFlags = setInterval(() => {
      roomFlags.forEach(flag => {
        if (!flag.isHeld) {
          const dist = camera.position.distanceTo(new THREE.Vector3(...flag.position));
          if (dist < 3) {
            multiplayerService.flagAction('pickup', flag.id);
          }
        }
      });
    }, 500);

    return () => clearInterval(checkFlags);
  }, [gameMode, roomFlags, isMultiplayer, camera.position]);

  // Mobile Touch Rotation
  const lastTouch = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        // Only start rotation if touch is on the right half of the screen
        if (touch.clientX > window.innerWidth / 2) {
            lastTouch.current = { x: touch.clientX, y: touch.clientY };
        }
    };
    const handleTouchMove = (e: TouchEvent) => {
        if (!lastTouch.current) return;
        const touch = Array.from(e.touches).find(t => t.clientX > window.innerWidth / 2);
        if (!touch) return;

        const dx = touch.clientX - lastTouch.current.x;
        const dy = touch.clientY - lastTouch.current.y;
        
        lastTouch.current = { x: touch.clientX, y: touch.clientY };
        
        camera.rotation.y -= dx * 0.005;
        camera.rotation.x -= dy * 0.005;
        camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
    };
    const handleTouchEnd = (e: TouchEvent) => {
        if (e.touches.length === 0 || !Array.from(e.touches).some(t => t.clientX > window.innerWidth / 2)) {
            lastTouch.current = null;
        }
    };

    const element = gl.domElement;
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);
    element.addEventListener('touchend', handleTouchEnd);
    return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [camera, gl]);

  const checkCollision = (newPos: THREE.Vector3) => {
    // Boundary checks (Walls are at +/- 100)
    const LIMIT = 98.5;
    if (Math.abs(newPos.x) > LIMIT || Math.abs(newPos.z) > LIMIT) return true;

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
    
    let directionX = Number(keys.right) - Number(keys.left);
    let directionZ = Number(keys.backward) - Number(keys.forward);

    if (mobileInput && (mobileInput.x !== 0 || mobileInput.y !== 0)) {
        directionX = mobileInput.x;
        directionZ = -mobileInput.y;
    }

    const direction = new THREE.Vector3(directionX, 0, directionZ);
    if (direction.length() > 1) direction.normalize();
    
    // View Bobbing & Sway
    if (direction.length() > 0.1 && isGrounded.current) {
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

    // Emit multiplayer position
    if (isMultiplayer) {
      const now = performance.now();
      if (now - lastEmitTime.current > 50) { // 20Hz update rate
        lastEmitTime.current = now;
        multiplayerService.updatePlayer({
          position: [camera.position.x, camera.position.y, camera.position.z],
          rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z]
        });
      }
    }
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
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const weaponRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  const { camera } = useThree();
  const lastFireTime = useRef(0);
  const lastStateChangeTime = useRef(0);
  const animTime = useRef(0);

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
          const angle = (Math.random() - 0.5) * Math.PI; 
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

    // Movement execution & Animation
    const isMoving = enemy.targetPosition && (enemy.aiState === AIState.FLANKING || enemy.aiState === AIState.MOVING_TO_COVER);
    if (isMoving) {
      const target = new THREE.Vector3(...enemy.targetPosition!);
      const moveDir = new THREE.Vector3().subVectors(target, enemyPos).normalize();
      const speed = enemy.type === 'tank' ? 2 : 5;
      
      const distToTarget = enemyPos.distanceTo(target);
      if (distToTarget > 1) {
        const nextX = enemy.position[0] + moveDir.x * speed * delta;
        const nextZ = enemy.position[2] + moveDir.z * speed * delta;
        
        // Basic collision for enemies
        const LIMIT = 98.5;
        let canMove = Math.abs(nextX) < LIMIT && Math.abs(nextZ) < LIMIT;
        
        if (canMove) {
          for (let i = 0; i < obstaclePositions.length; i++) {
            const [ox, , oz] = obstaclePositions[i];
            const isBig = i % 3 === 0;
            const hw = (isBig ? 5 : 8) / 2 + 0.6;
            const hd = (isBig ? 5 : 2) / 2 + 0.6;
            if (nextX > ox - hw && nextX < ox + hw && nextZ > oz - hd && nextZ < oz + hd) {
              canMove = false;
              break;
            }
          }
        }

        if (canMove) {
          const newPos: [number, number, number] = [nextX, 0, nextZ];
          updateEnemyPosition(enemy.id, newPos, enemy.aiState, enemy.targetPosition);
        } else {
          // If stuck, engage player or find new target
          updateEnemyPosition(enemy.id, enemy.position, AIState.ENGAGED, undefined);
        }
        
        // Advance animation
        animTime.current += delta * speed * 2;
      } else if (enemy.aiState === AIState.MOVING_TO_COVER) {
        updateEnemyPosition(enemy.id, enemy.position, AIState.IN_COVER, undefined);
      } else {
        updateEnemyPosition(enemy.id, enemy.position, AIState.ENGAGED, undefined);
      }
    } else {
      // Idle breathing
      animTime.current = THREE.MathUtils.lerp(animTime.current, 0, 0.05);
    }

    // Apply Animations
    const walkPhase = animTime.current;
    const isEngaged = enemy.aiState === AIState.ENGAGED || enemy.aiState === AIState.FLANKING;
    
    // Legs animation
    if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(walkPhase) * 0.7;
    if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(walkPhase + Math.PI) * 0.7;
    
    // Arms animation
    if (isEngaged && weaponRef.current) {
        // Aiming pose
        if (rightArmRef.current) {
            rightArmRef.current.rotation.x = -Math.PI / 2;
            rightArmRef.current.rotation.z = -0.2;
        }
        if (leftArmRef.current) {
            leftArmRef.current.rotation.x = -Math.PI / 2.5;
            leftArmRef.current.rotation.z = 0.5;
        }
        // Weapon positioning in engaged state
        weaponRef.current.position.set(0.3, 1.3, 0.6);
        weaponRef.current.rotation.set(Math.PI / 2, 0, 0);
    } else {
        // Relaxed or running pose
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(walkPhase + Math.PI) * 0.6;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(walkPhase) * 0.6;
        
        if (weaponRef.current) {
            weaponRef.current.position.set(0.5, 1.1, 0.4);
            weaponRef.current.rotation.set(Math.PI / 2, 0, 0);
        }
    }

    if (bodyRef.current) {
        bodyRef.current.position.y = Math.abs(Math.sin(walkPhase * 2)) * 0.15;
        bodyRef.current.rotation.y = Math.sin(walkPhase) * 0.05;
        
        // Lean forward when moving
        const targetLean = isMoving ? 0.25 : 0;
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, targetLean, 0.1);
    }

    // Aim and Fire
    groupRef.current.lookAt(playerPos.x, enemy.position[1] + 1.2, playerPos.z);
    
    // Weapon shake when moving
    if (weaponRef.current && isMoving) {
        weaponRef.current.position.y += Math.sin(walkPhase * 2) * 0.05;
        weaponRef.current.rotation.z += Math.sin(walkPhase) * 0.05;
    }

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
      <group ref={bodyRef} onClick={(e) => { e.stopPropagation(); onHit(enemy.id, e.point); }}>
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
        <mesh ref={leftArmRef} position={[-0.45, 1.2, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.22]} />
          <meshStandardMaterial color={armorColor} />
        </mesh>
        <mesh ref={rightArmRef} position={[0.45, 1.2, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.22]} />
          <meshStandardMaterial color={armorColor} />
        </mesh>
        
        {/* Legs / Lower Chassis */}
        <mesh ref={leftLegRef} position={[-0.25, 0.4, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.8]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
        <mesh ref={rightLegRef} position={[0.25, 0.4, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.8]} />
          <meshStandardMaterial color="#050505" />
        </mesh>

        {/* Futuristic Weapon */}
        <group ref={weaponRef} position={[0.5, 1.1, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Main Body */}
          <mesh>
            <boxGeometry args={[0.15, 0.8, 0.15]} />
            <meshStandardMaterial color="#111" metalness={0.8} />
          </mesh>
          {/* Barrel */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.4]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          {/* Glowing Accents */}
          <mesh position={[0, 0.2, 0.08]}>
            <boxGeometry args={[0.16, 0.3, 0.02]} />
            <meshStandardMaterial color={detailColor} emissive={detailColor} emissiveIntensity={4} />
          </mesh>
          {/* Stock */}
          <mesh position={[0, -0.45, 0.1]}>
            <boxGeometry args={[0.1, 0.2, 0.3]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
        </group>
      </group>
      <pointLight position={[0, 1.2, 0.3]} intensity={0.8} color={detailColor} distance={4} />
    </group>
  );
};

const FlagComponent: React.FC<{ flag: Flag; theme: any }> = ({ flag, theme }) => {
  const groupRef = useRef<THREE.Group>(null);
  const color = flag.team === Team.NEON ? '#00ffff' : '#ff0000';

  useFrame((state) => {
    if (groupRef.current) {
        groupRef.current.position.y += Math.sin(state.clock.getElapsedTime() * 2) * 0.005;
        groupRef.current.rotation.y += 0.02;
    }
  });

  if (flag.isHeld) return null; // Don't render on ground if held

  return (
    <group ref={groupRef} position={flag.position}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0.4, 2.5, 0]}>
        <boxGeometry args={[0.8, 0.6, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      <pointLight color={color} intensity={2} distance={5} />
    </group>
  );
};

const OtherPlayer: React.FC<{ player: MultiplayerPlayer; theme: any }> = ({ player, theme }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [isFiring, setIsFiring] = useState(false);
  const teamColor = player.team === Team.NEON ? '#00ffff' : player.team === Team.VOID ? '#ff3333' : '#333';
  
  useEffect(() => {
    const handleFired = ({ playerId }: { playerId: string }) => {
      if (playerId === player.id) {
        setIsFiring(true);
        setTimeout(() => setIsFiring(false), 50);
      }
    };
    multiplayerService.onPlayerFired(handleFired);
  }, [player.id]);

  useFrame(() => {
    if (groupRef.current) {
        groupRef.current.position.lerp(new THREE.Vector3(...player.position), 0.2);
        groupRef.current.rotation.y = player.rotation[1];
    }
  });

  if (player.health <= 0) return null;

  return (
    <group ref={groupRef}>
      {/* Name Tag */}
      <Html position={[0, 2.3, 0]} center distanceFactor={10}>
        <div className={`bg-black/80 backdrop-blur-sm border px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap uppercase tracking-tighter ${player.team === Team.VOID ? 'border-red-500/50 text-red-400' : 'border-cyan-500/50 text-cyan-400'}`}>
          {player.name}
        </div>
      </Html>
      {/* Player Body */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.6, 1.8, 0.3]} />
        <meshStandardMaterial color={player.team === Team.VOID ? '#2a1a1a' : '#1a2a2a'} metalness={0.8} />
      </mesh>
      {/* Armor details */}
      <mesh position={[0, 0.9, 0.16]}>
        <planeGeometry args={[0.4, 1.0]} />
        <meshBasicMaterial color={teamColor} transparent opacity={0.3} />
      </mesh>
      {/* Head with visor */}
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 1.75, 0.15]}>
        <boxGeometry args={[0.25, 0.05, 0.1]} />
        <meshStandardMaterial color={teamColor} emissive={teamColor} emissiveIntensity={5} />
      </mesh>
      {/* Flag Indicator */}
      {player.flagId && (
        <group position={[0, 2.5, 0]}>
           <mesh>
             <boxGeometry args={[0.4, 0.4, 0.4]} />
             <meshBasicMaterial color={player.flagId.includes('neon') ? '#00ffff' : '#ff0000'} wireframe />
           </mesh>
        </group>
      )}
      {/* Other player weapon */}
      <group position={[0.4, 0.9, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
         <mesh>
             <boxGeometry args={[0.1, 0.5, 0.1]} />
             <meshStandardMaterial color="#000" />
         </mesh>
         {isFiring && (
           <mesh position={[0, 0.3, 0]}>
             <sphereGeometry args={[0.15, 8, 8]} />
             <meshBasicMaterial color={theme.neon} transparent opacity={0.8} />
           </mesh>
         )}
      </group>
    </group>
  );
};

const Scene: React.FC<GameWorldProps> = ({ isPaused, onHit, onKill, onFire, onVictory, enemiesRemaining, currentWeaponType, mission, isMultiplayer, playerName, mobileInput, gameMode, roomFlags }) => {
  const vfxRef = useRef<any>(null);
  const { camera, scene } = useThree();
  const [isFiring, setIsFiring] = useState(false);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [otherPlayers, setOtherPlayers] = useState<Record<string, MultiplayerPlayer>>({});
  const lastShootTime = useRef(0);
  const mousePressed = useRef(false);
  const theme = mission ? THEME_CONFIG[mission.mapTheme] : THEME_CONFIG[MapTheme.CYBER];

  useEffect(() => {
    if (isMultiplayer) {
        multiplayerService.onPlayerJoined((p) => {
            setOtherPlayers(prev => ({ ...prev, [p.id]: p }));
        });
        multiplayerService.onPlayerLeft((id) => {
            setOtherPlayers(prev => {
                const n = { ...prev };
                delete n[id];
                return n;
            });
        });
        multiplayerService.onPlayerUpdated((p) => {
            // Handle local respawn if we were dead and health is now full
            const socketId = multiplayerService.getSocketId();
            if (p.id === socketId) {
                // If we respawned, we might want to do something locally
            } else {
                setOtherPlayers(prev => ({ ...prev, [p.id]: p }));
            }
        });
        multiplayerService.onRoomState((state) => {
            const others = { ...state.players };
            delete others[multiplayerService.getSocketId() || ''];
            setOtherPlayers(others);
            if (state.enemies && state.enemies.length > 0) {
                setEnemies(state.enemies);
            }
        });
        multiplayerService.onEnemyUpdated((enemy) => {
            setEnemies(prev => {
                const existing = prev.find(e => e.id === enemy.id);
                if (existing?.isAlive && !enemy.isAlive) {
                    onKill();
                }
                return prev.map(e => e.id === enemy.id ? enemy : e);
            });
        });
    }
  }, [isMultiplayer, onKill]);

  useEffect(() => {
    if (isMultiplayer) return;
    if (gameMode !== GameMode.COOP && !isMultiplayer) return;
    
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
    camera.position.set(0, 1.8, 10);
    camera.rotation.set(0, 0, 0);
  }, [mission, camera, isMultiplayer, gameMode]);

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

    if (isMultiplayer) {
      multiplayerService.fireWeapon(currentWeaponType);
    }

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
            
            // Check if we hit a player
            let hitPlayerId: string | null = null;
            let current = hit.object;
            while(current.parent) {
                if (current.userData?.playerId) {
                    hitPlayerId = current.userData.playerId;
                    break;
                }
                current = current.parent;
            }

            if (hitPlayerId && isMultiplayer) {
                multiplayerService.playerHit(hitPlayerId, config.damage);
                if (vfxRef.current) vfxRef.current.triggerEffect(hit.point, new THREE.Color(0x00ffff), 20, 0.3);
            } else if (vfxRef.current) {
                const isWall = !hit.object.parent?.userData?.enemyId;
                const hitColor = isWall ? new THREE.Color(theme.neon) : new THREE.Color(0xffaa00);
                vfxRef.current.triggerEffect(hit.point, hitColor, isWall ? 10 : 30, 0.2);
            }
        }
    }
  }, [camera, scene, onFire, currentWeaponType, theme, isMultiplayer]);

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
    if (isMultiplayer) {
      multiplayerService.enemyHit(id, WEAPONS[currentWeaponType].damage);
      // VFX only locallay, actual death synced from server
      if (vfxRef.current) vfxRef.current.triggerEffect(pos, new THREE.Color(0xff0000), 50, 0.4);
      return;
    }
    setEnemies(prev => prev.map(e => {
        if (e.id === id) {
            onKill();
            if (vfxRef.current) vfxRef.current.triggerEffect(pos, new THREE.Color(0xff0000), 50, 0.4);
            return { ...e, isAlive: false };
        }
        return e;
    }));
  };

  // Sync enemies killed remotely to local HUD
  useEffect(() => {
    const aliveCount = enemies.filter(e => e.isAlive).length;
    // This is approximate but helps HUD
    if (enemies.length > 0 && enemiesRemaining > aliveCount) {
        // Someone killed something
    }
  }, [enemies, enemiesRemaining]);

  return (
    <>
      <EffectComposer disableNormalPass>
        <Bloom 
          intensity={mobileInput ? 0.8 : 1.5} 
          luminanceThreshold={mobileInput ? 0.9 : 0.4} 
          luminanceSmoothing={0.9} 
          mipmapBlur 
        />
        {!mobileInput && <ChromaticAberration offset={new THREE.Vector2(0.001, 0.001)} />}
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
        {!mobileInput && <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />}
        {!mobileInput && <Scanline density={1.2} opacity={0.02} />}
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
      {Object.values(otherPlayers).map(player => (
        <group key={player.id} userData={{ playerId: player.id }}>
          <OtherPlayer player={player} theme={theme} />
        </group>
      ))}
      {roomFlags?.map(flag => (
        <FlagComponent key={flag.id} flag={flag} theme={theme} />
      ))}
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
          <PlayerController 
            extractionReady={enemiesRemaining <= 0} 
            onVictory={onVictory} 
            mission={mission} 
            isMultiplayer={isMultiplayer}
            mobileInput={mobileInput}
            gameMode={gameMode}
            roomFlags={roomFlags}
          />
          <Weapon isFiring={isFiring} type={currentWeaponType} />
          {!mobileInput ? <PointerLockControls /> : null}
        </group>
      )}
    </>
  );
};

const GameWorld: React.FC<GameWorldProps> = (props) => {
  return (
    <div className="w-full h-full cursor-crosshair touch-none">
      <Canvas shadows camera={{ fov: 75, position: [0, 1.8, 10] }}>
        <Scene {...props} />
      </Canvas>
    </div>
  );
};

export default GameWorld;
