
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, PlayerStats, Mission, WeaponType, WEAPONS, MapTheme } from './types';
import { generateMission } from './services/geminiService';
import { soundService } from './services/soundService';
import { multiplayerService } from './services/multiplayerService';
import HUD from './components/HUD';
import GameWorld from './components/GameWorld';
import { Terminal, Shield, Play, RotateCcw, Award, AlertTriangle, Target, Trophy, Map as MapIcon, ChevronRight, Users, Hash } from 'lucide-react';

const TOTAL_ENEMIES_COUNT = 18;

const THEME_LABELS: Record<MapTheme, { label: string, desc: string, color: string }> = {
  [MapTheme.CYBER]: { label: 'NEON DISTRICT', desc: 'Rain-slicked streets and high-tech corporate spires.', color: 'text-cyan-400' },
  [MapTheme.INDUSTRIAL]: { label: 'FACTORUM SECTOR', desc: 'Gritty manufacturing plants and heavy machinery.', color: 'text-amber-500' },
  [MapTheme.ARCTIC]: { label: 'FROST OUTPOST', desc: 'Sub-zero research facilities buried in ice.', color: 'text-blue-300' },
  [MapTheme.DESERT]: { label: 'DUST WASTELAND', desc: 'Arid ruins and sun-scorched dunes.', color: 'text-orange-400' },
  [MapTheme.VOLCANIC]: { label: 'MAGMA RIFT', desc: 'Deep earth geothermal extractors surrounded by lava.', color: 'text-red-500' }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [showThemeSelect, setShowThemeSelect] = useState(false);
  const [showMultiplayerLobby, setShowMultiplayerLobby] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [mission, setMission] = useState<Mission | null>(null);
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    ammo: WEAPONS[WeaponType.PISTOL].ammoCapacity,
    maxAmmo: WEAPONS[WeaponType.PISTOL].ammoCapacity,
    score: 0,
    kills: 0,
    currentWeapon: WeaponType.PISTOL
  });

  const startNewGame = async (selectedTheme?: MapTheme) => {
    setGameState(GameState.LOADING);
    setShowThemeSelect(false);
    setShowMultiplayerLobby(false);
    
    if (isMultiplayer) {
      multiplayerService.connect();
      multiplayerService.joinRoom(roomId || 'GLOBAL', playerName || 'Agent');
      
      // Wait for room state
      multiplayerService.onRoomState(async (state) => {
        if (state.mission) {
          setMission(state.mission);
        } else {
          const newMission = await generateMission(selectedTheme);
          setMission(newMission);
          // Sync with others (server will spawn enemies if I'm the first, otherwise it should handle it)
          // For simplicity, let's just let the joiner use their own generated mission if none exists
          multiplayerService.syncMission(newMission, []);
        }
        setGameState(GameState.MISSION_BRIEF);
        soundService.playMissionStart();
      });
    } else {
      const newMission = await generateMission(selectedTheme);
      setMission(newMission);
      setGameState(GameState.MISSION_BRIEF);
      soundService.playMissionStart();
    }

    setStats({
      health: 100,
      ammo: WEAPONS[WeaponType.PISTOL].ammoCapacity,
      maxAmmo: WEAPONS[WeaponType.PISTOL].ammoCapacity,
      score: 0,
      kills: 0,
      currentWeapon: WeaponType.PISTOL
    });
  };

  const switchWeapon = useCallback((type: WeaponType) => {
    if (stats.currentWeapon === type) return;
    soundService.playReload(); // Reuse reload sound for switching
    setStats(prev => ({
      ...prev,
      currentWeapon: type,
      ammo: WEAPONS[type].ammoCapacity,
      maxAmmo: WEAPONS[type].ammoCapacity
    }));
  }, [stats.currentWeapon]);

  const handleFire = useCallback(() => {
    setStats(prev => {
      if (prev.ammo <= 0) return prev;
      soundService.playShoot();
      return { ...prev, ammo: prev.ammo - 1 };
    });
  }, []);

  const handleKill = useCallback(() => {
    soundService.playEnemyHit();
    setStats(prev => ({
      ...prev,
      score: prev.score + 500,
      kills: prev.kills + 1
    }));
  }, []);

  const handleHit = useCallback(() => {
    soundService.playHurt();
    setStats(prev => {
      const newHealth = Math.max(0, prev.health - 5);
      if (newHealth === 0) setGameState(GameState.GAMEOVER);
      return { ...prev, health: newHealth };
    });
  }, []);

  const handleVictory = useCallback(() => {
    setGameState(GameState.VICTORY);
  }, []);

  // Keyboard weapon switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      if (e.key === '1') switchWeapon(WeaponType.PISTOL);
      if (e.key === '2') switchWeapon(WeaponType.RIFLE);
      if (e.key === '3') switchWeapon(WeaponType.SHOTGUN);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, switchWeapon]);

  // Reload mechanic
  useEffect(() => {
    if (stats.ammo === 0 && gameState === GameState.PLAYING) {
      soundService.playReload();
      const timer = setTimeout(() => {
        setStats(prev => ({ ...prev, ammo: prev.maxAmmo }));
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [stats.ammo, gameState]);

  return (
    <div className="w-full h-screen bg-neutral-950 text-white overflow-hidden select-none">
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black p-6">
          {!showThemeSelect && !showMultiplayerLobby ? (
            <div className="flex flex-col items-center animate-in fade-in duration-700">
              <div className="mb-8 flex flex-col items-center">
                <div className="flex items-center gap-3 text-cyan-400 mb-2">
                  <Shield className="w-8 h-8" />
                  <span className="text-sm tracking-[0.5em] font-light uppercase">United Galactic Alliance</span>
                </div>
                <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-white drop-shadow-2xl">
                  GEMINI<span className="text-cyan-500">STRIKE</span>
                </h1>
              </div>
              <div className="max-w-md w-full space-y-4">
                <div className="space-y-2 mb-6 group">
                  <label className="text-[10px] uppercase tracking-[0.3em] text-white/30 group-focus-within:text-cyan-400 transition-colors block text-center">Neural Signature (Callsign)</label>
                  <input 
                    type="text" 
                    placeholder="ENTER CODENAME..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                    maxLength={12}
                    className="w-full bg-white/5 border border-white/10 px-4 py-4 font-mono text-center text-cyan-400 focus:border-cyan-500 focus:bg-cyan-500/5 outline-none transition-all tracking-[0.2em] uppercase"
                  />
                </div>

                <button 
                  onClick={() => {
                    setIsMultiplayer(false);
                    setShowThemeSelect(true);
                  }}
                  disabled={!playerName.trim()}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 disabled:grayscale text-black font-bold py-4 rounded-sm flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  SOLO OPERATION
                </button>
                <button 
                  onClick={() => {
                    setIsMultiplayer(true);
                    setShowMultiplayerLobby(true);
                  }}
                  disabled={!playerName.trim()}
                  className="w-full bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-white font-bold py-4 rounded-sm flex items-center justify-center gap-2 transition-all"
                >
                  <Users className="w-5 h-5" />
                  MULTIPLAYER SQUAD
                </button>
                <div className="text-[10px] text-white/30 text-center uppercase tracking-widest mt-4">
                  Neural stability at 98.4% // Tactical sync enabled
                </div>
              </div>
            </div>
          ) : showMultiplayerLobby ? (
            <div className="max-w-md w-full animate-in slide-in-from-bottom-8 duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center gap-2 text-cyan-500 mb-2">
                        <Users className="w-5 h-5" />
                        <span className="text-xs tracking-[0.3em] font-bold uppercase">Squad Formation Protocol</span>
                    </div>
                    <h2 className="text-4xl font-black italic tracking-tight">ENLIST YOUR TEAM</h2>
                </div>

                <div className="space-y-6 bg-slate-900/60 p-8 border border-white/5">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-cyan-400/50 block">Identity Confirmed</label>
                        <div className="w-full bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 font-mono text-cyan-400">
                            {playerName}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-white/40 block">Tactical Frequency (Room ID)</label>
                        <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input 
                                type="text" 
                                placeholder="ALPHA-7..."
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                className="w-full bg-black/40 border border-white/10 pl-11 pr-4 py-3 font-mono text-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                            />
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setShowThemeSelect(true)}
                        disabled={!playerName || !roomId}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-black font-bold py-4 rounded-sm flex items-center justify-center gap-2 transition-all mt-4"
                    >
                        INITIALIZE DEPLOYMENT
                    </button>
                    
                    <button 
                        onClick={() => setShowMultiplayerLobby(false)}
                        className="w-full text-[10px] text-white/40 hover:text-white uppercase tracking-[0.3em] transition-colors pt-2"
                    >
                        ABORT PROTOCOL
                    </button>
                </div>
            </div>
          ) : (
            <div className="max-w-4xl w-full animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex flex-col items-center mb-10">
                <div className="flex items-center gap-2 text-cyan-500 mb-2">
                  <MapIcon className="w-5 h-5" />
                  <span className="text-xs tracking-[0.3em] font-bold uppercase">Map Selection Protocol</span>
                </div>
                <h2 className="text-4xl font-black italic tracking-tight">CHOOSE DEPLOYMENT ZONE</h2>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(THEME_LABELS) as MapTheme[]).map((theme) => {
                  const config = THEME_LABELS[theme];
                  return (
                    <button
                      key={theme}
                      onClick={() => startNewGame(theme)}
                      className="group relative text-left bg-slate-900/40 border border-white/5 p-6 hover:border-cyan-500/50 hover:bg-slate-800/60 transition-all overflow-hidden"
                    >
                      <div className={`text-xs font-black tracking-widest mb-1 ${config.color}`}>
                        {theme}
                      </div>
                      <div className="text-xl font-black mb-2 flex items-center justify-between">
                        {config.label}
                        <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all text-cyan-500" />
                      </div>
                      <div className="text-sm text-white/50 italic leading-snug">
                        {config.desc}
                      </div>
                      <div className="absolute top-0 right-0 w-16 h-16 opacity-5 pointer-events-none transform translate-x-4 translate-y-[-4px]">
                        <Shield className="w-full h-full" />
                      </div>
                    </button>
                  );
                })}
                
                <button
                  onClick={() => startNewGame()}
                  className="group relative text-left bg-cyan-500/10 border border-cyan-500/20 p-6 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all flex flex-col justify-center items-center"
                >
                  <div className="text-cyan-400 text-3xl font-black italic mb-2">RANDOM</div>
                  <div className="text-xs text-cyan-400/60 font-medium tracking-widest text-center">
                    LET COMMAND DECIDE YOUR FATE
                  </div>
                </button>
              </div>

              <div className="mt-10 flex justify-center">
                <button 
                  onClick={() => setShowThemeSelect(false)}
                  className="text-[10px] text-white/40 hover:text-white uppercase tracking-[0.3em] transition-colors"
                >
                  &larr; BACK TO TERMINAL
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === GameState.LOADING && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <Terminal className="w-12 h-12 text-cyan-500 animate-pulse mb-4" />
          <div className="text-xl font-mono text-cyan-500 tracking-widest">CONNECTING TO GEMINI TACTICAL NETWORK...</div>
          <div className="mt-8 w-64 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
        </div>
      )}

      {gameState === GameState.MISSION_BRIEF && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-8">
          <div className="max-w-3xl w-full border border-cyan-500/30 p-12 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <AlertTriangle className="text-amber-500 w-12 h-12 opacity-20" />
            </div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-2 h-12 bg-cyan-500"></div>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-500/70 font-bold mb-1">Combat Intelligence Report</div>
                <h2 className="text-4xl font-black tracking-tight">{mission?.title}</h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="space-y-6">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Deployment Zone</div>
                  <div className="text-lg font-mono">{mission?.location}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Threat Assessment</div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-red-900/30 border border-red-500/50 text-red-400 text-xs font-bold rounded-sm">
                      {mission?.difficulty.toUpperCase()}
                    </span>
                    <div className="text-sm font-mono text-white/70">LVL {mission?.threatLevel}</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Mission Objectives</div>
                <p className="text-white/80 leading-relaxed italic text-lg">"{mission?.objective}"</p>
              </div>
            </div>
            <button 
              onClick={() => setGameState(GameState.PLAYING)}
              className="group relative w-full overflow-hidden bg-white text-black font-black py-4 tracking-widest hover:bg-cyan-500 transition-colors"
            >
              CONFIRM DEPLOYMENT
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.PLAYING && (
        <>
          <GameWorld 
            isPaused={false} 
            onHit={handleHit} 
            onKill={handleKill} 
            onFire={handleFire}
            onVictory={handleVictory}
            enemiesRemaining={TOTAL_ENEMIES_COUNT - stats.kills}
            currentWeaponType={stats.currentWeapon}
            mission={mission}
            isMultiplayer={isMultiplayer}
            playerName={playerName}
          />
          <HUD
            stats={stats}
            mission={mission}
            totalEnemies={TOTAL_ENEMIES_COUNT}
            roomId={isMultiplayer ? roomId : 'SOLO'}
            playerName={playerName}
          />
          <div className="fixed top-8 left-1/2 -translate-x-1/2 text-[10px] text-white/20 uppercase tracking-[0.5em] pointer-events-none text-center">
            WASD TO MOVE // SPACE TO JUMP // 1, 2, 3 TO SWITCH WEAPONS<br/>
            MOUSE TO AIM // LEFT CLICK TO FIRE
          </div>
        </>
      )}

      {gameState === GameState.VICTORY && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-950/90 backdrop-blur-3xl p-6">
          <Trophy className="w-24 h-24 text-emerald-400 mb-6 animate-pulse" />
          <h2 className="text-7xl font-black italic tracking-tighter mb-2">MISSION ACCOMPLISHED</h2>
          <p className="text-white/60 mb-12 tracking-widest">EXTRACTION SUCCESSFUL // SECTOR SECURED</p>
          <div className="flex gap-4 mb-12">
            <div className="bg-black/50 p-6 rounded text-center min-w-[150px] border border-emerald-500/20">
              <Award className="w-6 h-6 mx-auto mb-2 text-amber-500" />
              <div className="text-xs text-white/40 uppercase mb-1">Final Score</div>
              <div className="text-3xl font-black">{stats.score}</div>
            </div>
            <div className="bg-black/50 p-6 rounded text-center min-w-[150px] border border-emerald-500/20">
              <Target className="w-6 h-6 mx-auto mb-2 text-cyan-400" />
              <div className="text-xs text-white/40 uppercase mb-1">Total Kills</div>
              <div className="text-3xl font-black">{stats.kills}</div>
            </div>
          </div>
          <div className="flex gap-4 mb-12">
            <button 
              onClick={() => {
                setGameState(GameState.MENU);
                setShowThemeSelect(true);
              }} 
              className="bg-emerald-500 text-black font-black px-12 py-4 tracking-widest flex items-center gap-2 hover:bg-white transition-all transform hover:scale-105"
            >
              <Play className="w-5 h-5 fill-current" />
              NEXT MISSION
            </button>
            <button onClick={() => {
              setGameState(GameState.MENU);
              setShowThemeSelect(false);
            }} className="bg-white/10 text-white font-black px-12 py-4 tracking-widest flex items-center gap-2 hover:bg-white/20 transition-all">
              RETURN TO COMMAND
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.GAMEOVER && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-3xl p-6">
          <AlertTriangle className="w-24 h-24 text-white mb-6 animate-bounce" />
          <h2 className="text-7xl font-black italic tracking-tighter mb-2">TACTICAL FAILURE</h2>
          <p className="text-white/60 mb-12 tracking-widest">NEURAL LINK SEVERED // UNIT DECOMMISSIONED</p>
          <button 
            onClick={() => {
              setGameState(GameState.MENU);
              setShowThemeSelect(true);
            }} 
            className="bg-white text-black font-black px-12 py-4 tracking-widest flex items-center gap-2 hover:bg-cyan-400 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
            RE-DEPLOY UNIT
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
