import React, { useEffect, useRef, useCallback } from 'react';
import { GameState, Enemy, Particle } from '../types/game';

interface GameCanvasProps {
  gameState: GameState;
  onGameStateUpdate: (updater: (prev: GameState) => GameState) => void;
  onGameEnd: () => void;
  facePosition: { x: number; y: number };
  isGameRunning: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  onGameStateUpdate,
  onGameEnd,
  facePosition,
  isGameRunning
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const enemySpawnRef = useRef<NodeJS.Timeout>();
  const gameStateRef = useRef(gameState);
  const facePositionRef = useRef(facePosition);

  // Keep refs updated
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    facePositionRef.current = facePosition;
  }, [facePosition]);

  const gameLevels = {
    1: 3000, 2: 2500, 3: 2000, 4: 1500, 5: 1200,
    6: 1000, 7: 800, 8: 600, 9: 500, other: 400
  };

  const spawnEnemy = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const radius = Math.random() * 20 + 10;
    let x, y;

    if (Math.random() < 0.5) {
      x = Math.random() < 0.5 ? -radius : canvas.width + radius;
      y = Math.random() * canvas.height;
    } else {
      x = Math.random() * canvas.width;
      y = Math.random() < 0.5 ? -radius : canvas.height + radius;
    }

    const angle = Math.atan2(
      canvas.height / 2 - y,
      canvas.width / 2 - x
    );

    const enemy: Enemy = {
      x,
      y,
      radius,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
      velocity: {
        x: Math.cos(angle) * 1,
        y: Math.sin(angle) * 1
      }
    };

    onGameStateUpdate(prev => ({
      ...prev,
      enemies: [...prev.enemies, enemy]
    }));
  }, [onGameStateUpdate]);

  const createParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        radius: Math.random() * 2,
        color,
        velocity: {
          x: (Math.random() - 0.5) * (Math.random() * 6),
          y: (Math.random() - 0.5) * (Math.random() * 6)
        },
        alpha: 1
      });
    }
    return particles;
  }, []);

  // Game update function that doesn't depend on changing state
  const updateGame = useCallback(() => {
    if (!canvasRef.current || !isGameRunning) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentGameState = gameStateRef.current;
    const currentFacePosition = facePositionRef.current;

    // Clear canvas with trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw player
    ctx.beginPath();
    ctx.arc(currentGameState.player.x, currentGameState.player.y, currentGameState.player.radius, 0, Math.PI * 2);
    ctx.fillStyle = currentGameState.player.color;
    ctx.shadowColor = currentGameState.player.color;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw face tracking point
    const faceX = currentFacePosition.x * canvas.width;
    const faceY = currentFacePosition.y * canvas.height;
    ctx.beginPath();
    ctx.arc(faceX, faceY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Update and draw particles
    onGameStateUpdate(prev => ({
      ...prev,
      particles: prev.particles.filter(particle => {
        particle.velocity.x *= 0.99;
        particle.velocity.y *= 0.99;
        particle.x += particle.velocity.x;
        particle.y += particle.velocity.y;
        particle.alpha -= 0.01;

        if (particle.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = particle.alpha;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
          ctx.fillStyle = particle.color;
          ctx.fill();
          ctx.restore();
          return true;
        }
        return false;
      })
    }));

    // Update and draw projectiles
    onGameStateUpdate(prev => ({
      ...prev,
      projectiles: prev.projectiles.filter(projectile => {
        projectile.x += projectile.velocity.x;
        projectile.y += projectile.velocity.y;

        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fillStyle = projectile.color;
        ctx.shadowColor = projectile.color;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Remove projectiles that are off screen
        return projectile.x > 0 && projectile.x < canvas.width &&
               projectile.y > 0 && projectile.y < canvas.height;
      })
    }));

    // Update and draw enemies
    onGameStateUpdate(prev => {
      const newEnemies = [];
      const newParticles = [...prev.particles];
      let newProjectiles = [...prev.projectiles];
      let newScore = prev.score;

      for (const enemy of prev.enemies) {
        enemy.x += enemy.velocity.x;
        enemy.y += enemy.velocity.y;

        // Check collision with player
        const distanceToPlayer = Math.hypot(
          prev.player.x - enemy.x,
          prev.player.y - enemy.y
        );
        
        if (distanceToPlayer < enemy.radius + prev.player.radius - 5) {
          onGameEnd();
          return prev;
        }

        // Check collision with projectiles
        let enemyHit = false;
        newProjectiles = newProjectiles.filter(projectile => {
          const distance = Math.hypot(
            projectile.x - enemy.x,
            projectile.y - enemy.y
          );

          if (distance < enemy.radius + projectile.radius) {
            enemyHit = true;
            // Create explosion particles
            newParticles.push(...createParticles(
              projectile.x,
              projectile.y,
              enemy.color,
              enemy.radius * 2
            ));

            if (enemy.radius > 15) {
              // Shrink enemy
              enemy.radius -= 8;
              newScore += 10;
            } else {
              // Remove enemy
              newScore += 20;
            }

            return false; // Remove projectile
          }
          return true;
        });

        if (!enemyHit || (enemyHit && enemy.radius > 15)) {
          // Draw enemy
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
          ctx.fillStyle = enemy.color;
          ctx.shadowColor = enemy.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;

          if (!enemyHit || (enemyHit && enemy.radius > 15)) {
            newEnemies.push(enemy);
          }
        }
      }

      // Update level based on score
      const newLevel = Math.min(9, Math.floor(newScore / 500) + 1);

      return {
        ...prev,
        enemies: newEnemies,
        projectiles: newProjectiles,
        particles: newParticles,
        score: newScore,
        level: newLevel
      };
    });

    // Draw score
    ctx.font = '20px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${currentGameState.score} | Level: ${currentGameState.level}`, 20, 30);

    if (isGameRunning) {
      animationRef.current = requestAnimationFrame(updateGame);
    }
  }, [isGameRunning, onGameStateUpdate, onGameEnd, createParticles]);

  // Start enemy spawning based on level
  useEffect(() => {
    if (!isGameRunning) return;

    if (enemySpawnRef.current) {
      clearInterval(enemySpawnRef.current);
    }

    const interval = gameLevels[gameState.level as keyof typeof gameLevels] || gameLevels.other;
    console.log('Starting enemy spawn with interval:', interval, 'for level:', gameState.level);
    enemySpawnRef.current = setInterval(spawnEnemy, interval);

    return () => {
      if (enemySpawnRef.current) {
        clearInterval(enemySpawnRef.current);
      }
    };
  }, [gameState.level, isGameRunning, spawnEnemy]);

  // Start game loop
  useEffect(() => {
    if (isGameRunning) {
      console.log('Game started, initializing game loop');
      updateGame();
    }

    return () => {
      console.log('Cleaning up game canvas');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (enemySpawnRef.current) {
        clearInterval(enemySpawnRef.current);
      }
    };
  }, [isGameRunning, updateGame]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        onGameStateUpdate(prev => ({
          ...prev,
          player: {
            ...prev.player,
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
          }
        }));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onGameStateUpdate]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 bg-black"
      style={{ zIndex: 1 }}
    />
  );
};