import { useState, useCallback, useRef } from 'react';
import { GameState, Player, Projectile, Enemy, Particle } from '../types/game';

const INITIAL_PLAYER: Player = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  radius: 20,
  color: '#ffffff'
};

const INITIAL_STATE: GameState = {
  isRunning: false,
  score: 0,
  level: 1,
  player: INITIAL_PLAYER,
  projectiles: [],
  enemies: [],
  particles: []
};

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const animationRef = useRef<number>();
  const enemySpawnRef = useRef<NodeJS.Timeout>();

  const resetGame = useCallback(() => {
    setGameState({
      ...INITIAL_STATE,
      player: {
        ...INITIAL_PLAYER,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      }
    });
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState(prev => ({ 
      ...prev, 
      isRunning: true,
      score: 0,
      level: 1
    }));
  }, [resetGame]);

  const endGame = useCallback(() => {
    setGameState(prev => ({ ...prev, isRunning: false }));
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (enemySpawnRef.current) {
      clearInterval(enemySpawnRef.current);
    }
  }, []);

  const updateGameState = useCallback((updater: (prev: GameState) => GameState) => {
    setGameState(updater);
  }, []);

  const createProjectile = useCallback((targetX: number, targetY: number) => {
    setGameState(prev => {
      const angle = Math.atan2(
        targetY - prev.player.y,
        targetX - prev.player.x
      );
      const velocity = {
        x: Math.cos(angle) * 6,
        y: Math.sin(angle) * 6
      };
      
      const newProjectile: Projectile = {
        x: prev.player.x,
        y: prev.player.y,
        radius: 5,
        color: '#00ff88',
        velocity
      };

      return {
        ...prev,
        projectiles: [...prev.projectiles, newProjectile],
        score: Math.max(0, prev.score - 1)
      };
    });
  }, []);

  return {
    gameState,
    setGameState,
    startGame,
    endGame,
    resetGame,
    updateGameState,
    createProjectile,
    animationRef,
    enemySpawnRef
  };
};