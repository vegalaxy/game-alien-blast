import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onCameraStart: () => void;
  onFrameProcess: (movementScale: number) => void;
  isGameRunning: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  onCameraStart,
  onFrameProcess,
  isGameRunning
}) => {
  const [movementScale, setMovementScale] = useState(4); // Slightly higher default for better control
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    onCameraStart();
  }, [onCameraStart]);

  useEffect(() => {
    onFrameProcess(movementScale);
  }, [movementScale, onFrameProcess]);

  return (
    <div className="fixed bottom-4 right-4 w-60 bg-black/20 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden" style={{ zIndex: 10 }}>
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-32 object-cover scale-x-[-1]"
        />
        <canvas
          ref={canvasRef}
          width={720}
          height={480}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
        >
          <Settings size={16} className="text-white" />
        </button>
      </div>

      {showSettings && (
        <div className="p-4 bg-black/40 backdrop-blur-sm">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/80 mb-1">
                Sensitivity: {movementScale}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={movementScale}
                onChange={(e) => setMovementScale(parseInt(e.target.value))}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-white/60 mt-1">
                <span>1</span>
                <span>8</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-2 bg-black/40 backdrop-blur-sm">
        <div className="text-xs text-white/80 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>Move head to aim crosshair</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
            <span>Open mouth wide to fire</span>
          </div>
        </div>
      </div>
    </div>
  );
};