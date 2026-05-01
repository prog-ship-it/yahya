
export enum GameState {
  MENU = 'MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  MISSION_BRIEF = 'MISSION_BRIEF',
  VICTORY = 'VICTORY'
}

export enum WeaponType {
  PISTOL = 'PISTOL',
  RIFLE = 'RIFLE',
  SHOTGUN = 'SHOTGUN',
  SMG = 'SMG',
  SNIPER = 'SNIPER',
  RAILGUN = 'RAILGUN'
}

export interface WeaponConfig {
  name: string;
  type: WeaponType;
  fireRate: number; // ms between shots
  ammoCapacity: number;
  damage: number;
  spread: number;
  projectiles: number;
  automatic: boolean;
}

export const WEAPONS: Record<WeaponType, WeaponConfig> = {
  [WeaponType.PISTOL]: {
    name: 'G-17 PLASMA PISTOL',
    type: WeaponType.PISTOL,
    fireRate: 250,
    ammoCapacity: 15,
    damage: 25,
    spread: 0.01,
    projectiles: 1,
    automatic: false
  },
  [WeaponType.RIFLE]: {
    name: 'V-40 ASSAULT DISRUPTOR',
    type: WeaponType.RIFLE,
    fireRate: 100,
    ammoCapacity: 35,
    damage: 15,
    spread: 0.04,
    projectiles: 1,
    automatic: true
  },
  [WeaponType.SHOTGUN]: {
    name: 'S-12 PULSE BREACHER',
    type: WeaponType.SHOTGUN,
    fireRate: 800,
    ammoCapacity: 8,
    damage: 12, // per projectile
    spread: 0.15,
    projectiles: 8,
    automatic: false
  },
  [WeaponType.SMG]: {
    name: 'K-9 NEURAL SHREDDER',
    type: WeaponType.SMG,
    fireRate: 60,
    ammoCapacity: 50,
    damage: 8,
    spread: 0.08,
    projectiles: 1,
    automatic: true
  },
  [WeaponType.SNIPER]: {
    name: 'X-1 COVERT LANCE',
    type: WeaponType.SNIPER,
    fireRate: 1500,
    ammoCapacity: 5,
    damage: 120,
    spread: 0.0,
    projectiles: 1,
    automatic: false
  },
  [WeaponType.RAILGUN]: {
    name: 'VOID-RAIL ACCELERATOR',
    type: WeaponType.RAILGUN,
    fireRate: 3000,
    ammoCapacity: 3,
    damage: 250,
    spread: 0.0,
    projectiles: 1,
    automatic: false
  }
};

export enum GameMode {
  COOP = 'COOP',
  TDM = 'TDM',
  FFA = 'FFA',
  CTF = 'CTF'
}

export enum Team {
  NONE = 'NONE',
  NEON = 'NEON',
  VOID = 'VOID'
}

export enum MapTheme {
  CYBER = 'CYBER',
  INDUSTRIAL = 'INDUSTRIAL',
  ARCTIC = 'ARCTIC',
  DESERT = 'DESERT',
  VOLCANIC = 'VOLCANIC'
}

export interface Mission {
  title: string;
  objective: string;
  location: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme';
  threatLevel: number;
  mapTheme: MapTheme;
  obstaclePositions: [number, number, number][];
}

export interface PlayerStats {
  health: number;
  ammo: number;
  maxAmmo: number;
  score: number;
  kills: number;
  currentWeapon: WeaponType;
}

export enum AIState {
  IDLE = 'IDLE',
  ENGAGED = 'ENGAGED',
  FLANKING = 'FLANKING',
  MOVING_TO_COVER = 'MOVING_TO_COVER',
  IN_COVER = 'IN_COVER'
}

export interface Enemy {
  id: string;
  position: [number, number, number];
  health: number;
  type: 'soldier' | 'drone' | 'tank';
  isAlive: boolean;
  aiState?: AIState;
  targetPosition?: [number, number, number];
}

export interface MultiplayerPlayer {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  health: number;
  currentWeapon: WeaponType;
  isFiring: boolean;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  flagId?: string | null;
}

export interface Flag {
  id: string;
  team: Team;
  position: [number, number, number];
  isHeld: boolean;
  heldBy?: string | null;
}

export interface MultiplayerRoom {
  id: string;
  players: Record<string, MultiplayerPlayer>;
  mission: Mission | null;
  enemies: Enemy[];
  gameMode: GameMode;
  scores: Record<Team | string, number>;
  flags: Flag[];
}
