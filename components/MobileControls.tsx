import React, { useState, useEffect, useRef } from 'react';
import { Crosshair, ArrowUp, Zap, SwitchCamera } from 'lucide-react';

interface MobileControlsProps {
  onMove: (vector: { x: number; y: number }) => void;
  onFire: () => void;
  onJump: () => void;
  onSwitchWeapon: () => void;
}

const MobileControls: React.FC<MobileControlsProps> = ({ onMove, onFire, onJump, onSwitchWeapon }) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [isMounting, setIsMounting] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setIsMounting(true);
  }, []);

  const handleJoystickStart = (e: React.TouchEvent) => {
    setJoystickActive(true);
    handleJoystickMove(e);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickActive && e.type !== 'touchstart') return;
    
    const touch = e.touches[0];
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = rect.width / 2;
    
    if (distance > maxDistance) {
      dx *= maxDistance / distance;
      dy *= maxDistance / distance;
    }
    
    setJoystickPos({ x: dx, y: dy });
    onMove({ x: dx / maxDistance, y: -dy / maxDistance });
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  if (!isMounting) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] font-mono select-none">
      {/* Joystick area */}
      <div 
        className="absolute bottom-8 left-8 w-32 h-32 md:w-48 md:h-48 bg-white/5 border border-white/10 rounded-full flex items-center justify-center pointer-events-auto touch-none"
        ref={joystickRef}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
      >
        <div 
          className="w-12 h-12 md:w-16 md:h-16 bg-cyan-500/30 border border-cyan-500/50 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]"
          style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
        />
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-4 items-end pointer-events-auto">
        <div className="flex gap-4">
          <button 
            onTouchStart={(e) => { e.preventDefault(); onSwitchWeapon(); }}
            className="w-14 h-14 md:w-20 md:h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center active:bg-white/20 transition-colors"
          >
            <SwitchCamera className="text-white w-6 h-6 md:w-8 md:h-8" />
          </button>
          <button 
            onTouchStart={(e) => { e.preventDefault(); onJump(); }}
            className="w-14 h-14 md:w-20 md:h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center active:bg-white/20 transition-colors"
          >
            <ArrowUp className="text-white w-6 h-6 md:w-8 md:h-8" />
          </button>
        </div>
        <button 
          onTouchStart={(e) => { e.preventDefault(); onFire(); }}
          className="w-20 h-20 md:w-28 md:h-28 bg-red-600/20 border border-red-600/50 rounded-full flex items-center justify-center active:bg-red-600/40 shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all transform active:scale-90"
        >
          <Zap className="text-red-500 w-10 h-10 md:w-14 md:h-14 fill-current" />
        </button>
      </div>

      {/* Crosshair Button (for easy fire) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden">
         {/* Touch visualization for aiming */}
      </div>
    </div>
  );
};

export default MobileControls;
