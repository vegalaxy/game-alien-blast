import React from 'react';
import { Play, Trophy, Target } from 'lucide-react';

interface GameOverDialogProps {
  score: number;
  level: number;
  isVisible: boolean;
  onStartGame: () => void;
  isFirstGame: boolean;
}

export const GameOverDialog: React.FC<GameOverDialogProps> = ({
  score,
  level,
  isVisible,
  onStartGame,
  isFirstGame
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 20 }}>
      <div className="bg-gradient-to-br from-purple-900/90 to-blue-900/90 backdrop-blur-md rounded-2xl p-8 max-w-md w-full border border-white/20 shadow-2xl">
        <div className="text-center">
          {!isFirstGame && (
            <div className="mb-6">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Game Over!</h2>
            </div>
          )}
          
          <div className="mb-6">
            <div className="text-4xl font-bold text-white mb-2">{score}</div>
            <div className="text-white/80">Points</div>
            {level > 1 && (
              <div className="text-sm text-white/60 mt-1">Level {level} reached</div>
            )}
          </div>

          <div className="space-y-3 mb-8 text-sm text-white/80">
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-green-400" />
              <span>Move your head to aim the green dot</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-pink-400 rounded-full"></div>
              <span>Open your mouth to fire projectiles</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
              <span>Destroy UFOs to increase your score</span>
            </div>
          </div>

          <div className="text-xs text-white/60 mb-6">
            Make sure to allow camera access for the best experience
          </div>

          <button
            onClick={onStartGame}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
          >
            <Play size={20} />
            {isFirstGame ? 'Start Game' : 'Play Again'}
          </button>
        </div>
      </div>
    </div>
  );
};