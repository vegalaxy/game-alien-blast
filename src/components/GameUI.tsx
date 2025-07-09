import React from 'react';
import { Crosshair, Zap, Star } from 'lucide-react';

interface GameUIProps {
  score: number;
  level: number;
  isGameRunning: boolean;
  faceDetected: boolean;
  mouthOpen: boolean;
}

export const GameUI: React.FC<GameUIProps> = ({
  score,
  level,
  isGameRunning,
  faceDetected,
  mouthOpen
}) => {
  if (!isGameRunning) return null;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {/* Score and level display */}
      <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/20">
        <div className="text-white space-y-1">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="font-semibold">Score: {score}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
            <span className="font-semibold">Level: {level}</span>
          </div>
        </div>
      </div>

      {/* Status indicators */}
      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/20">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${faceDetected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-white text-sm">Face Detection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${mouthOpen ? 'bg-pink-400' : 'bg-gray-400'}`}></div>
            <span className="text-white text-sm">Firing</span>
          </div>
        </div>
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <Crosshair className="w-8 h-8 text-white/60" />
      </div>

      {/* Instructions overlay */}
      {!faceDetected && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-lg p-4 border border-white/20 text-center">
          <div className="text-white">
            <div className="font-semibold mb-2">Position your face in the camera view</div>
            <div className="text-sm text-white/80">Move your head to aim • Open your mouth to fire</div>
          </div>
        </div>
      )}
    </div>
  );
};