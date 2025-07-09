export interface Player {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface Projectile {
  x: number;
  y: number;
  radius: number;
  color: string;
  velocity: { x: number; y: number };
}

export interface Enemy {
  x: number;
  y: number;
  radius: number;
  color: string;
  velocity: { x: number; y: number };
}

export interface Particle {
  x: number;
  y: number;
  radius: number;
  color: string;
  velocity: { x: number; y: number };
  alpha: number;
}

export interface GameState {
  isRunning: boolean;
  score: number;
  level: number;
  player: Player;
  projectiles: Projectile[];
  enemies: Enemy[];
  particles: Particle[];
}

export interface FaceDetectionResult {
  x: number;
  y: number;
  isDetected: boolean;
  isMouthOpen: boolean;
}