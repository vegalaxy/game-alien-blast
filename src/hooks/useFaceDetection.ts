import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FaceLandmarkerResult, FilesetResolver } from '@mediapipe/tasks-vision';
import { FaceDetectionResult } from '../types/game';

export const useFaceDetection = () => {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceData, setFaceData] = useState<FaceDetectionResult>({
    x: 0.5,
    y: 0.5,
    isDetected: false,
    isMouthOpen: false
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();
  
  // Mouth detection calibration
  const mouthBaselineRef = useRef<number | null>(null);
  const mouthHistoryRef = useRef<number[]>([]);
  const MOUTH_HISTORY_SIZE = 10;

  const initializeFaceDetection = useCallback(async () => {
    try {
      setIsLoading(true);
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      );
      
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        },
        runningMode: 'VIDEO',
        outputFaceBlendshapes: true,
        numFaces: 1
      });
      
      setFaceLandmarker(landmarker);
      setError(null);
    } catch (err) {
      setError('Failed to initialize face detection');
      console.error('Face detection error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 720, 
          height: 480,
          frameRate: { ideal: 30 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          if (playError instanceof DOMException && 
              (playError.name === 'AbortError' || 
               playError.message.includes('interrupted'))) {
            return;
          }
          throw playError;
        }
      }
    } catch (err) {
      setError('Failed to access camera');
      console.error('Camera error:', err);
    }
  }, []);

  const detectMouthOpen = useCallback((landmarks: any[]) => {
    if (!landmarks[0]) return false;
    
    // Use the most reliable mouth landmarks
    const upperLip = landmarks[0][13]; // Upper lip center
    const lowerLip = landmarks[0][14]; // Lower lip center
    
    if (!upperLip || !lowerLip) return false;
    
    const distance = Math.sqrt(
      (lowerLip.x - upperLip.x) ** 2 + 
      (lowerLip.y - upperLip.y) ** 2 + 
      (lowerLip.z - upperLip.z) ** 2
    );
    
    // Build baseline for closed mouth
    mouthHistoryRef.current.push(distance);
    if (mouthHistoryRef.current.length > MOUTH_HISTORY_SIZE) {
      mouthHistoryRef.current.shift();
    }
    
    if (mouthHistoryRef.current.length >= MOUTH_HISTORY_SIZE && mouthBaselineRef.current === null) {
      mouthBaselineRef.current = Math.min(...mouthHistoryRef.current);
    }
    
    if (mouthBaselineRef.current !== null) {
      return distance > mouthBaselineRef.current * 2.2; // More sensitive
    }
    
    return distance > 0.018; // Fallback threshold
  }, []);

  const processFrame = useCallback(async (movementScale: number = 4) => {
    if (!faceLandmarker || !videoRef.current) {
      return;
    }

    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      return;
    }

    try {
      const results = await faceLandmarker.detectForVideo(videoRef.current, Date.now());
      
      if (results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const isOpenMouth = detectMouthOpen([landmarks]);
        
        // SIMPLE APPROACH: Just use the nose bridge landmark directly
        // Landmark 6 is the nose bridge - right between the eyes
        const noseBridge = landmarks[6];
        
        if (noseBridge) {
          // Apply movement scaling and mirror for camera
          const scaledX = 0.5 + (noseBridge.x - 0.5) * movementScale;
          const scaledY = 0.5 + (noseBridge.y - 0.5) * movementScale;
          
          // Mirror X axis and clamp values
          const mirroredX = 1 - scaledX;
          
          setFaceData({
            x: Math.max(0, Math.min(1, mirroredX)),
            y: Math.max(0, Math.min(1, scaledY)),
            isDetected: true,
            isMouthOpen: isOpenMouth
          });

          // Draw visualization
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // Draw the nose bridge point (between eyes)
              ctx.beginPath();
              ctx.arc(
                noseBridge.x * canvas.width,
                noseBridge.y * canvas.height,
                8,
                0,
                2 * Math.PI
              );
              ctx.fillStyle = isOpenMouth ? '#ff0088' : '#00ff88';
              ctx.shadowColor = isOpenMouth ? '#ff0088' : '#00ff88';
              ctx.shadowBlur = 15;
              ctx.fill();
              ctx.shadowBlur = 0;
              
              // Draw crosshair at nose bridge
              ctx.strokeStyle = isOpenMouth ? '#ff0088' : '#00ff88';
              ctx.lineWidth = 2;
              ctx.beginPath();
              // Horizontal line
              ctx.moveTo(noseBridge.x * canvas.width - 10, noseBridge.y * canvas.height);
              ctx.lineTo(noseBridge.x * canvas.width + 10, noseBridge.y * canvas.height);
              // Vertical line
              ctx.moveTo(noseBridge.x * canvas.width, noseBridge.y * canvas.height - 10);
              ctx.lineTo(noseBridge.x * canvas.width, noseBridge.y * canvas.height + 10);
              ctx.stroke();
              
              // Status text
              ctx.font = '14px Arial';
              ctx.fillStyle = isOpenMouth ? '#ff0088' : '#00ff88';
              ctx.fillText(
                isOpenMouth ? 'FIRING!' : 'READY',
                10,
                canvas.height - 15
              );
            }
          }
        }
      } else {
        setFaceData(prev => ({ 
          ...prev, 
          isDetected: false,
          isMouthOpen: false 
        }));
        
        // Reset mouth calibration
        mouthBaselineRef.current = null;
        mouthHistoryRef.current = [];
      }
    } catch (err) {
      console.error('Frame processing error:', err);
    }
  }, [faceLandmarker, detectMouthOpen]);

  const startProcessingLoop = useCallback((movementScale: number = 4) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    const loop = async () => {
      await processFrame(movementScale);
      animationRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [processFrame]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Reset calibration
    mouthBaselineRef.current = null;
    mouthHistoryRef.current = [];
  }, []);

  useEffect(() => {
    initializeFaceDetection();
    return () => {
      stopCamera();
    };
  }, [initializeFaceDetection, stopCamera]);

  return {
    videoRef,
    canvasRef,
    faceData,
    isLoading,
    error,
    startCamera,
    stopCamera,
    startProcessingLoop,
    processFrame
  };
};