import { io, Socket } from 'socket.io-client';
import { MultiplayerPlayer, MultiplayerRoom, Mission, Enemy, WeaponType } from '../types';

class MultiplayerService {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private onPlayerJoinedCb: ((player: MultiplayerPlayer) => void) | null = null;
  private onPlayerLeftCb: ((playerId: string) => void) | null = null;
  private onPlayerUpdatedCb: ((player: MultiplayerPlayer) => void) | null = null;
  private onRoomStateCb: ((state: MultiplayerRoom) => void) | null = null;
  private onMissionSyncedCb: ((data: { mission: Mission, enemies: Enemy[] }) => void) | null = null;
  private onEnemyUpdatedCb: ((enemy: Enemy) => void) | null = null;
  private onPlayerFiredCb: ((data: { playerId: string, weaponType: WeaponType }) => void) | null = null;

  connect() {
    if (this.socket) return;
    this.socket = io(window.location.origin);

    this.socket.on('player-joined', (player: MultiplayerPlayer) => {
      this.onPlayerJoinedCb?.(player);
    });

    this.socket.on('player-left', (playerId: string) => {
      this.onPlayerLeftCb?.(playerId);
    });

    this.socket.on('player-updated', (player: MultiplayerPlayer) => {
      this.onPlayerUpdatedCb?.(player);
    });

    this.socket.on('room-state', (state: MultiplayerRoom) => {
      this.onRoomStateCb?.(state);
    });

    this.socket.on('mission-synced', (data: { mission: Mission, enemies: Enemy[] }) => {
      this.onMissionSyncedCb?.(data);
    });

    this.socket.on('enemy-updated', (enemy: Enemy) => {
      this.onEnemyUpdatedCb?.(enemy);
    });

    this.socket.on('player-fired', (data: { playerId: string, weaponType: WeaponType }) => {
      this.onPlayerFiredCb?.(data);
    });
  }

  joinRoom(roomId: string, playerName: string) {
    this.roomId = roomId;
    this.socket?.emit('join-room', { roomId, playerName });
  }

  updatePlayer(player: Partial<MultiplayerPlayer>) {
    if (!this.roomId) return;
    this.socket?.emit('update-player', { roomId: this.roomId, player });
  }

  syncMission(mission: Mission, enemies: Enemy[]) {
    if (!this.roomId) return;
    this.socket?.emit('sync-mission', { roomId: this.roomId, mission, enemies });
  }

  enemyHit(enemyId: string, damage: number) {
    if (!this.roomId) return;
    this.socket?.emit('enemy-hit', { roomId: this.roomId, enemyId, damage });
  }

  fireWeapon(weaponType: WeaponType) {
    if (!this.roomId) return;
    this.socket?.emit('fire-weapon', { roomId: this.roomId, weaponType });
  }

  onPlayerJoined(cb: (player: MultiplayerPlayer) => void) { this.onPlayerJoinedCb = cb; }
  onPlayerLeft(cb: (playerId: string) => void) { this.onPlayerLeftCb = cb; }
  onPlayerUpdated(cb: (player: MultiplayerPlayer) => void) { this.onPlayerUpdatedCb = cb; }
  onRoomState(cb: (state: MultiplayerRoom) => void) { this.onRoomStateCb = cb; }
  onMissionSynced(cb: (data: { mission: Mission, enemies: Enemy[] }) => void) { this.onMissionSyncedCb = cb; }
  onEnemyUpdated(cb: (enemy: Enemy) => void) { this.onEnemyUpdatedCb = cb; }
  onPlayerFired(cb: (data: { playerId: string, weaponType: WeaponType }) => void) { this.onPlayerFiredCb = cb; }

  getSocketId() { return this.socket?.id; }
}

export const multiplayerService = new MultiplayerService();
