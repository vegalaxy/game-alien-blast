import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { CameraView } from './components/CameraView';
import { GameOverDialog } from './components/GameOverDialog';
import { GameUI } from './components/GameUI';
import { useGameState } from './hooks/useGameState';
import { useFaceDetection } from './hooks/useFaceDetection';

function App() {
  const [isFirstGame, setIsFirstGame] = useState(true);
  const frameCountRef = useRef(0);
  const FRAMES_TO_FIRE = 6;

  const {
    gameState,
    startGame,
    endGame,
    updateGameState,
    createProjectile
  } = useGameState();

  const {
    videoRef,
    canvasRef,
    faceData,
    isLoading,
    error,
    startCamera,
    startProcessingLoop,
    processFrame
  } = useFaceDetection();

  const handleStartGame = useCallback(() => {
    setIsFirstGame(false);
    startGame();
  }, [startGame, startProcessingLoop]);

  const handleFrameProcess = useCallback((movementScale: number) => {
    processFrame(movementScale);
  }, [processFrame]);

  // Handle firing logic based on face data
  useEffect(() => {
    // Handle firing logic
    if (gameState.isRunning && faceData.isDetected) {
      if (faceData.isMouthOpen) {
        frameCountRef.current++;
        if (frameCountRef.current >= FRAMES_TO_FIRE) {
          const targetX = faceData.x * window.innerWidth;
          const targetY = faceData.y * window.innerHeight;
          createProjectile(targetX, targetY);
          frameCountRef.current = 0;
        }
      } else {
        frameCountRef.current = 0;
      }
    }
  }, [gameState.isRunning, faceData, createProjectile]);

  // Start face detection processing when camera is ready
  useEffect(() => {
    if (!isLoading && !error) {
      startProcessingLoop(3);
    }
  }, [isLoading, error, startProcessingLoop]);
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading Face Detection...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">Error: {error}</p>
          <p className="text-white">Please refresh the page and allow camera access</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background stars */}
      <div className="fixed inset-0 bg-gradient-to-b from-black via-purple-900/20 to-black">
        <div className="absolute inset-0 bg-[radial-gradient(white_1px,transparent_1px)] bg-[size:50px_50px] opacity-20"></div>
      </div>

      {/* Game Canvas */}
      <GameCanvas
        gameState={gameState}
        onGameStateUpdate={updateGameState}
        onGameEnd={endGame}
        facePosition={faceData}
        isGameRunning={gameState.isRunning}
      />

      {/* Camera View */}
      <CameraView
        videoRef={videoRef}
        canvasRef={canvasRef}
        onCameraStart={startCamera}
        onFrameProcess={handleFrameProcess}
        isGameRunning={gameState.isRunning}
      />

      {/* Game UI */}
      <GameUI
        score={gameState.score}
        level={gameState.level}
        isGameRunning={gameState.isRunning}
        faceDetected={faceData.isDetected}
        mouthOpen={faceData.isMouthOpen}
      />

      {/* Game Over Dialog */}
      <GameOverDialog
        score={gameState.score}
        level={gameState.level}
        isVisible={!gameState.isRunning}
        onStartGame={handleStartGame}
        isFirstGame={isFirstGame}
      />

      {/* Custom styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: linear-gradient(45deg, #8b5cf6, #06b6d4);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: linear-gradient(45deg, #8b5cf6, #06b6d4);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </div>
  );
}

export default App;