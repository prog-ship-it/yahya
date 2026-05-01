
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, PlayerStats, Mission, WeaponType, WEAPONS, MapTheme, GameMode, Team } from './types';
import { generateMission } from './services/geminiService';
import { soundService } from './services/soundService';
import { multiplayerService } from './services/multiplayerService';
import HUD from './components/HUD';
import GameWorld from './components/GameWorld';
import MobileControls from './components/MobileControls';
import { Terminal, Shield, Play, RotateCcw, Award, AlertTriangle, Target, Trophy, Map as MapIcon, ChevronRight, Users, Hash, Swords, Flag, Zap } from 'lucide-react';

const TOTAL_ENEMIES_COUNT = 18;

const THEME_LABELS: Record<MapTheme, { label: string, desc: string, color: string }> = {
  [MapTheme.CYBER]: { label: 'NEON DISTRICT', desc: 'Rain-slicked streets and high-tech corporate spires.', color: 'text-cyan-400' },
  [MapTheme.INDUSTRIAL]: { label: 'FACTORUM SECTOR', desc: 'Gritty manufacturing plants and heavy machinery.', color: 'text-amber-500' },
  [MapTheme.ARCTIC]: { label: 'FROST OUTPOST', desc: 'Sub-zero research facilities buried in ice.', color: 'text-blue-300' },
  [MapTheme.DESERT]: { label: 'DUST WASTELAND', desc: 'Arid ruins and sun-scorched dunes.', color: 'text-orange-400' },
  [MapTheme.VOLCANIC]: { label: 'MAGMA RIFT', desc: 'Deep earth geothermal extractors surrounded by lava.', color: 'text-red-500' }
};

const MODE_LABELS: Record<GameMode, { label: string, desc: string, icon: any }> = {
  [GameMode.COOP]: { label: 'CO-OP EXFIL', desc: 'Work together to eliminate enemies and extract.', icon: Shield },
  [GameMode.TDM]: { label: 'TEAM DEATHMATCH', desc: 'NEON vs VOID. First team to limit wins.', icon: Swords },
  [GameMode.FFA]: { label: 'FREE FOR ALL', desc: 'Trust no one. Pure survival of the fittest.', icon: Target },
  [GameMode.CTF]: { label: 'CAPTURE THE FLAG', desc: 'Steal the enemy flag and return it to base.', icon: Flag }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [showThemeSelect, setShowThemeSelect] = useState(false);
  const [showMultiplayerLobby, setShowMultiplayerLobby] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState(localStorage.getItem('gemini_strike_player_name') || '');
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.COOP);
  const [roomScores, setRoomScores] = useState<Record<string, number>>({});
  const [roomFlags, setRoomFlags] = useState<any[]>([]);
  
  // Mobile Support
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMove, setMobileMove] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const checkMobile = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isHandheld = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmall = window.innerWidth < 1024;
      setIsMobile(isHandheld || (isSmall && isTouch));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem('gemini_strike_player_name', playerName);
  }, [playerName]);

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
      
      multiplayerService.onRoomState(async (state) => {
        setGameMode(state.gameMode || GameMode.COOP);
        setRoomScores(state.scores || {});
        setRoomFlags(state.flags || []);

        if (state.mission) {
          setMission(state.mission);
          setGameState(GameState.MISSION_BRIEF);
          soundService.playMissionStart();
        } else {
          multiplayerService.setGameMode(gameMode);
          const newMission = await generateMission(selectedTheme);
          setMission(newMission);
          
          const initialEnemies: any[] = [];
          if (gameMode === GameMode.COOP) {
            for (let i = 0; i < TOTAL_ENEMIES_COUNT; i++) {
              const angle = (i / TOTAL_ENEMIES_COUNT) * Math.PI * 2;
              const radius = 40 + Math.random() * 40;
              initialEnemies.push({ 
                id: `e-${i}`, 
                position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius], 
                health: 100, 
                type: i % 5 === 0 ? 'tank' : 'soldier', 
                isAlive: true,
                aiState: 'IDLE' 
              });
            }
          }
          
          multiplayerService.syncMission(newMission, initialEnemies);
          setGameState(GameState.MISSION_BRIEF);
          soundService.playMissionStart();
        }
      });

      multiplayerService.onModeUpdated(({ mode, flags }) => {
        setGameMode(mode);
        setRoomFlags(flags);
      });

      multiplayerService.onScoreUpdated((scores) => {
        setRoomScores(scores);
      });

      multiplayerService.onFlagsUpdated((flags) => {
        setRoomFlags(flags);
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
    soundService.playWeaponSwitch();
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
      const newHealth = Math.max(0, prev.health - 10);
      if (newHealth === 0) {
        if (!isMultiplayer) setGameState(GameState.GAMEOVER);
        // Multi handles respawn internally or via room updates
      }
      return { ...prev, health: newHealth };
    });
  }, [isMultiplayer]);

  const handleVictory = useCallback(() => {
    setGameState(GameState.VICTORY);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      if (e.key === '1') switchWeapon(WeaponType.PISTOL);
      if (e.key === '2') switchWeapon(WeaponType.RIFLE);
      if (e.key === '3') switchWeapon(WeaponType.SHOTGUN);
      if (e.key === '4') switchWeapon(WeaponType.SMG);
      if (e.key === '5') switchWeapon(WeaponType.SNIPER);
      if (e.key === '6') switchWeapon(WeaponType.RAILGUN);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, switchWeapon]);

  useEffect(() => {
    if (stats.ammo === 0 && gameState === GameState.PLAYING) {
      soundService.playReload();
      const weapon = WEAPONS[stats.currentWeapon];
      const reloadTime = stats.currentWeapon === WeaponType.RAILGUN ? 3000 : 1200;
      const timer = setTimeout(() => {
        setStats(prev => ({ ...prev, ammo: prev.maxAmmo }));
      }, reloadTime);
      return () => clearTimeout(timer);
    }
  }, [stats.ammo, gameState, stats.currentWeapon]);

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

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setIsMultiplayer(false);
                      setShowThemeSelect(true);
                    }}
                    disabled={!playerName.trim()}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 disabled:grayscale text-black font-bold py-4 rounded-sm flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    SOLO
                  </button>
                  <button 
                    onClick={() => {
                      setIsMultiplayer(true);
                      setShowMultiplayerLobby(true);
                    }}
                    disabled={!playerName.trim()}
                    className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-white font-bold py-4 rounded-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Users className="w-5 h-5" />
                    SQUAD
                  </button>
                </div>
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

                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 block">Engagement Protocol (Mode)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(MODE_LABELS) as GameMode[]).map((mode) => {
                          const config = MODE_LABELS[mode];
                          const Icon = config.icon;
                          const active = gameMode === mode;
                          return (
                            <button
                              key={mode}
                              onClick={() => setGameMode(mode)}
                              className={`flex flex-col items-center justify-center p-3 border transition-all ${
                                active 
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' 
                                : 'bg-black/40 border-white/10 text-white/40 hover:border-white/30'
                              }`}
                            >
                              <Icon className={`w-5 h-5 mb-1 ${active ? 'animate-pulse' : ''}`} />
                              <div className="text-[9px] font-black tracking-widest">{config.label}</div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-white/30 italic text-center px-4">
                        {MODE_LABELS[gameMode].desc}
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-8">
          <div className="max-w-3xl w-full border border-cyan-500/30 p-6 md:p-12 bg-slate-900/40 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 right-0 p-2 md:p-4">
              <AlertTriangle className="text-amber-500 w-8 h-8 md:w-12 md:h-12 opacity-20" />
            </div>
            <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-8">
              <div className="w-1.5 md:w-2 h-8 md:h-12 bg-cyan-500"></div>
              <div>
                <div className="text-[8px] md:text-xs uppercase tracking-[0.3em] text-cyan-500/70 font-bold mb-0.5 md:mb-1">Combat Intelligence Report</div>
                <h2 className="text-2xl md:text-4xl font-black tracking-tight">{mission?.title}</h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6 md:gap-12 mb-8 md:mb-12">
              <div className="space-y-4 md:space-y-6">
                <div>
                  <div className="text-[8px] md:text-[10px] uppercase tracking-widest text-white/40 mb-1 md:mb-2">Deployment Zone</div>
                  <div className="text-sm md:text-lg font-mono">{mission?.location}</div>
                </div>
                <div>
                  <div className="text-[8px] md:text-[10px] uppercase tracking-widest text-white/40 mb-1 md:mb-2">Threat Assessment</div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 md:px-3 py-0.5 md:py-1 bg-red-900/30 border border-red-500/50 text-red-400 text-[10px] font-bold rounded-sm">
                      {mission?.difficulty.toUpperCase()}
                    </span>
                    <div className="text-xs md:text-sm font-mono text-white/70">LVL {mission?.threatLevel}</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[8px] md:text-[10px] uppercase tracking-widest text-white/40 mb-1 md:mb-2">Mission Objectives</div>
                <p className="text-white/80 leading-relaxed italic text-sm md:text-lg">"{mission?.objective}"</p>
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
            mobileInput={isMobile ? mobileMove : undefined}
            gameMode={gameMode}
            roomFlags={roomFlags}
          />
          <HUD
            stats={stats}
            mission={mission}
            totalEnemies={TOTAL_ENEMIES_COUNT}
            roomId={isMultiplayer ? roomId : 'SOLO'}
            playerName={playerName}
            gameMode={gameMode}
            roomScores={roomScores}
            isMobile={isMobile}
          />
          {isMobile && (
            <MobileControls 
              onMove={setMobileMove}
              onFire={handleFire}
              onJump={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
                setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })), 100);
              }}
              onSwitchWeapon={() => {
                 const current = stats.currentWeapon;
                 const next = current === WeaponType.PISTOL ? WeaponType.RIFLE : current === WeaponType.RIFLE ? WeaponType.SHOTGUN : WeaponType.PISTOL;
                 setStats(prev => ({ 
                   ...prev, 
                   currentWeapon: next,
                   ammo: WEAPONS[next].ammoCapacity,
                   maxAmmo: WEAPONS[next].ammoCapacity
                 }));
                 soundService.playWeaponSwitch();
              }}
            />
          )}
          {!isMobile && (
            <>
              <div className="fixed top-8 left-1/2 -translate-x-1/2 text-[10px] text-white/20 uppercase tracking-[0.5em] pointer-events-none text-center">
                WASD TO MOVE // SPACE TO JUMP // 1, 2, 3 TO SWITCH WEAPONS<br/>
                MOUSE TO AIM // LEFT CLICK TO FIRE
              </div>
              <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-[10px] text-cyan-400/20 uppercase tracking-[1em] animate-pulse">
                  [ CLICK TO CAPTURE NEURAL LINK ]
                </div>
              </div>
            </>
          )}
        </>
      )}

      {gameState === GameState.VICTORY && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-950/90 backdrop-blur-3xl p-4 md:p-6 text-center">
          <Trophy className="w-12 h-12 md:w-24 md:h-24 text-emerald-400 mb-4 md:mb-6 animate-pulse" />
          <h2 className="text-3xl md:text-7xl font-black italic tracking-tighter mb-1 md:mb-2">MISSION ACCOMPLISHED</h2>
          <p className="text-[10px] md:text-base text-white/60 mb-8 md:mb-12 tracking-widest">EXTRACTION SUCCESSFUL // SECTOR SECURED</p>
          <div className="flex flex-col md:flex-row gap-4 mb-8 md:mb-12">
            <div className="bg-black/50 p-4 md:p-6 rounded text-center min-w-[120px] md:min-w-[150px] border border-emerald-500/20">
              <Award className="w-4 h-4 md:w-6 md:h-6 mx-auto mb-1 md:mb-2 text-amber-500" />
              <div className="text-[8px] md:text-xs text-white/40 uppercase mb-0.5 md:mb-1">Final Score</div>
              <div className="text-xl md:text-3xl font-black">{stats.score}</div>
            </div>
            <div className="bg-black/50 p-4 md:p-6 rounded text-center min-w-[120px] md:min-w-[150px] border border-emerald-500/20">
              <Target className="w-4 h-4 md:w-6 md:h-6 mx-auto mb-1 md:mb-2 text-cyan-400" />
              <div className="text-[8px] md:text-xs text-white/40 uppercase mb-0.5 md:mb-1">Total Kills</div>
              <div className="text-xl md:text-3xl font-black">{stats.kills}</div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-12 w-full max-w-xs md:max-w-none px-8 md:px-0">
            <button 
              onClick={() => {
                setGameState(GameState.MENU);
                setShowThemeSelect(true);
              }} 
              className="w-full md:w-auto bg-emerald-500 text-black font-black px-8 md:px-12 py-3 md:py-4 tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-all transform hover:scale-105"
            >
              <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
              NEXT MISSION
            </button>
            <button onClick={() => {
              setGameState(GameState.MENU);
              setShowThemeSelect(false);
            }} className="w-full md:w-auto bg-white/10 text-white font-black px-8 md:px-12 py-3 md:py-4 tracking-widest flex items-center justify-center gap-2 hover:bg-white/20 transition-all">
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
