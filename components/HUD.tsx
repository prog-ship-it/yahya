
import React from 'react';
import { Shield, Target, Zap, MapPin, Swords } from 'lucide-react';
import { PlayerStats, Mission, WEAPONS, WeaponType } from '../types';

interface HUDProps {
  stats: PlayerStats;
  mission: Mission | null;
  totalEnemies: number;
  roomId?: string;
  playerName?: string;
  isMobile?: boolean;
}

const HUD: React.FC<HUDProps> = ({ stats, mission, totalEnemies, roomId, playerName, isMobile }) => {
  const healthColor = stats.health > 50 ? 'bg-emerald-500' : stats.health > 20 ? 'bg-amber-500' : 'bg-red-600';
  const enemiesRemaining = totalEnemies - stats.kills;
  const isExtractionReady = enemiesRemaining <= 0;
  const weapon = WEAPONS[stats.currentWeapon];

  return (
    <div className={`fixed inset-0 pointer-events-none p-4 md:p-8 flex flex-col justify-between font-mono text-white overflow-hidden transition-all duration-500 ${isMobile ? 'pb-36' : ''}`}>
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-2 md:p-4 rounded shadow-2xl max-w-[150px] md:max-w-xs">
          <h2 className="text-[8px] md:text-xs uppercase tracking-widest text-white/50 mb-0.5 md:mb-1">Active Mission</h2>
          <div className="text-xs md:text-xl font-bold text-cyan-400 truncate">{mission?.title || "SYSTEM INITIALIZING..."}</div>
          <div className="hidden md:block text-[10px] text-white/70 mt-1">{mission?.objective}</div>
          
          <div className="mt-1 md:mt-3 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isExtractionReady ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[8px] md:text-[10px] uppercase tracking-tighter">
              {isExtractionReady ? 'EXTRACT AT CENTER' : `HOSTILES: ${enemiesRemaining}`}
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:gap-4">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 p-1 md:p-4 rounded text-right min-w-[60px] md:min-w-[120px]">
            <h2 className="text-[8px] md:text-xs uppercase tracking-widest text-white/50 mb-0.5 md:mb-1">Score</h2>
            <div className="text-xs md:text-2xl font-bold text-white tracking-tighter">{stats.score.toLocaleString()}</div>
          </div>
          <div className="bg-black/60 backdrop-blur-md border border-white/10 p-1 md:p-4 rounded text-right min-w-[60px] md:min-w-[120px]">
            <h2 className="text-[8px] md:text-xs uppercase tracking-widest text-white/50 mb-0.5 md:mb-1">Kills</h2>
            <div className="text-xs md:text-2xl font-bold text-white tracking-tighter">{stats.kills}</div>
          </div>
          {roomId && (
            <div className="bg-cyan-500/10 backdrop-blur-md border border-cyan-500/30 p-1 md:p-4 rounded text-right min-w-[60px] md:min-w-[120px]">
              <h2 className="text-[8px] md:text-xs uppercase tracking-widest text-cyan-400/70 mb-0.5 md:mb-1">Squad</h2>
              <div className="text-xs md:text-2xl font-bold text-cyan-400 tracking-tighter truncate max-w-[50px] md:max-w-none">#{roomId}</div>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Weapon Selection Indicators */}
      <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 md:gap-4">
        {[WeaponType.PISTOL, WeaponType.RIFLE, WeaponType.SHOTGUN].map((type) => (
          <div key={type} className={`p-1.5 md:p-3 border-r-2 md:border-r-4 transition-all ${stats.currentWeapon === type ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/5 bg-black/40'}`}>
            <div className="text-[8px] md:text-[10px] text-white/40 uppercase mb-0.5 md:mb-1">[{type === WeaponType.PISTOL ? '1' : type === WeaponType.RIFLE ? '2' : '3'}]</div>
            <div className={`text-[10px] md:text-xs font-bold ${stats.currentWeapon === type ? 'text-white' : 'text-white/20'}`}>
              {WEAPONS[type].name.split(' ')[1]}
            </div>
          </div>
        ))}
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute w-1 h-1 bg-white rounded-full"></div>
            <div className="absolute w-[2px] h-3 bg-cyan-400 -top-2"></div>
            <div className="absolute w-[2px] h-3 bg-cyan-400 -bottom-2"></div>
            <div className="absolute h-[2px] w-3 bg-cyan-400 -left-2"></div>
            <div className="absolute h-[2px] w-3 bg-cyan-400 -right-2"></div>
        </div>
      </div>

      {/* Extraction Marker */}
      {isExtractionReady && (
        <div className="absolute left-1/2 top-[40%] -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
           <MapPin className="text-emerald-500 w-8 h-8" />
           <span className="bg-black/80 px-2 py-1 text-[10px] rounded border border-emerald-500/50">EXTRACTION POINT</span>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="flex justify-between items-end gap-4 md:gap-0">
        {/* Health */}
        <div className="w-32 md:w-64">
          <div className="flex items-center gap-2 mb-1 md:mb-2">
            <Shield className="w-3 h-3 md:w-4 md:h-4 text-cyan-400" />
            <span className="text-[8px] md:text-sm font-bold tracking-widest truncate">TACTICAL INTEGRITY</span>
            <span className="ml-auto text-[10px] md:text-sm">{stats.health}%</span>
          </div>
          <div className="h-1.5 md:h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
            <div 
              className={`h-full transition-all duration-300 ${healthColor}`}
              style={{ width: `${stats.health}%` }}
            ></div>
          </div>
        </div>

        {/* Current Weapon Details */}
        <div className="flex items-end gap-4 md:gap-12">
           <div className="text-right pb-1 hidden sm:block">
             <div className="text-xs text-cyan-400 font-black tracking-widest mb-1 italic uppercase">{weapon.name}</div>
             <div className="text-[8px] md:text-[10px] text-white/40 uppercase tracking-tighter">Output // Mode: {weapon.automatic ? 'AUTO' : 'SEMI'}</div>
           </div>
           
           <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-0.5 md:mb-1 text-white/60">
                <Zap className="w-2 md:w-3 h-2 md:h-3" />
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest">Battery</span>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-6xl font-black text-white italic tracking-tighter">{stats.ammo}</span>
                <span className="text-xs md:text-2xl font-bold text-white/30">/ {stats.maxAmmo}</span>
            </div>
          </div>
        </div>
      </div>

      {stats.health < 30 && (
        <div className="absolute inset-0 pointer-events-none animate-pulse border-[24px] border-red-900/20 shadow-[inset_0_0_100px_rgba(220,38,38,0.3)]"></div>
      )}
    </div>
  );
};

export default HUD;
