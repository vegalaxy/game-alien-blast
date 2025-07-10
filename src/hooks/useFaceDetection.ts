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
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const prevPointRef = useRef<{ x: number; y: number } | null>(null);
  
  // Mouth detection calibration
  const mouthBaselineRef = useRef<number | null>(null);
  const mouthHistoryRef = useRef<number[]>([]);
  const MOUTH_HISTORY_SIZE = 5;
  const MOUTH_THRESHOLD_MULTIPLIER = 1.8; // More sensitive threshold

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
          frameRate: { ideal: 30 } // Higher frame rate for better responsiveness
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

  const detectMovement = useCallback((newPoint: { x: number; y: number }, movementScale: number) => {
    if (!startPointRef.current) {
      startPointRef.current = { x: newPoint.x, y: newPoint.y };
      prevPointRef.current = { x: newPoint.x, y: newPoint.y };
      return prevPointRef.current;
    }

    // Apply smoothing to reduce jitter
    const smoothingFactor = 0.7;
    const movement = {
      newX: (newPoint.x - startPointRef.current.x) * movementScale,
      newY: (newPoint.y - startPointRef.current.y) * movementScale
    };

    const targetPoint = {
      x: startPointRef.current.x + movement.newX,
      y: startPointRef.current.y + movement.newY
    };

    // Smooth the movement
    prevPointRef.current = {
      x: prevPointRef.current.x * (1 - smoothingFactor) + targetPoint.x * smoothingFactor,
      y: prevPointRef.current.y * (1 - smoothingFactor) + targetPoint.y * smoothingFactor
    };

    return prevPointRef.current;
  }, []);

  const detectMouthOpen = useCallback((landmarks: any[]) => {
    if (!landmarks[0]) return false;
    
    // Use multiple mouth landmarks for better accuracy
    // Upper lip landmarks: 13, 14, 15
    // Lower lip landmarks: 17, 18, 19
    const upperLipCenter = landmarks[0][13]; // Upper lip center
    const lowerLipCenter = landmarks[0][14]; // Lower lip center
    const upperLipLeft = landmarks[0][12];   // Upper lip left
    const lowerLipLeft = landmarks[0][15];   // Lower lip left
    const upperLipRight = landmarks[0][16];  // Upper lip right
    const lowerLipRight = landmarks[0][17];  // Lower lip right
    
    if (!upperLipCenter || !lowerLipCenter || !upperLipLeft || !lowerLipLeft || !upperLipRight || !lowerLipRight) {
      return false;
    }
    
    // Calculate mouth opening using multiple points for better accuracy
    const centerDistance = Math.sqrt(
      (lowerLipCenter.x - upperLipCenter.x) ** 2 + 
      (lowerLipCenter.y - upperLipCenter.y) ** 2 + 
      (lowerLipCenter.z - upperLipCenter.z) ** 2
    );
    
    const leftDistance = Math.sqrt(
      (lowerLipLeft.x - upperLipLeft.x) ** 2 + 
      (lowerLipLeft.y - upperLipLeft.y) ** 2 + 
      (lowerLipLeft.z - upperLipLeft.z) ** 2
    );
    
    const rightDistance = Math.sqrt(
      (lowerLipRight.x - upperLipRight.x) ** 2 + 
      (lowerLipRight.y - upperLipRight.y) ** 2 + 
      (lowerLipRight.z - upperLipRight.z) ** 2
    );
    
    // Average the distances for more stable detection
    const avgDistance = (centerDistance + leftDistance + rightDistance) / 3;
    
    // Maintain a history for baseline calibration
    mouthHistoryRef.current.push(avgDistance);
    if (mouthHistoryRef.current.length > MOUTH_HISTORY_SIZE) {
      mouthHistoryRef.current.shift();
    }
    
    // Establish baseline (closed mouth) if we have enough samples
    if (mouthHistoryRef.current.length >= MOUTH_HISTORY_SIZE && mouthBaselineRef.current === null) {
      mouthBaselineRef.current = Math.min(...mouthHistoryRef.current);
    }
    
    // Use dynamic threshold based on baseline
    if (mouthBaselineRef.current !== null) {
      const threshold = mouthBaselineRef.current * MOUTH_THRESHOLD_MULTIPLIER;
      return avgDistance > threshold;
    }
    
    // Fallback to static threshold if baseline not established
    return avgDistance > 0.015;
  }, []);

  const getBetweenEyesPoint = useCallback((landmarks: any[]) => {
    if (!landmarks[0]) return null;
    
    // Use the correct MediaPipe face landmark indices for between eyes
    // These are the actual landmark indices from MediaPipe's 468-point face model
    const leftEyeInner = landmarks[0][133];   // Left eye inner corner
    const rightEyeInner = landmarks[0][362];  // Right eye inner corner
    const foreheadCenter = landmarks[0][9];   // Forehead center point
    const noseTip = landmarks[0][1];          // Nose tip
    
    if (!leftEyeInner || !rightEyeInner || !foreheadCenter) return null;
    
    // Calculate the point exactly between the inner eye corners
    // This gives us the precise horizontal center between the eyes
    const betweenEyes = {
      x: (leftEyeInner.x + rightEyeInner.x) / 2,
      y: (leftEyeInner.y + rightEyeInner.y) / 2, // Average Y position of inner eye corners
      z: (leftEyeInner.z + rightEyeInner.z) / 2
    };
    
    return betweenEyes;
  }, []);

  const processFrame = useCallback(async (movementScale: number = 3) => {
    if (!faceLandmarker || !videoRef.current) {
      return;
    }

    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      return;
    }

    try {
      const results = await faceLandmarker.detectForVideo(videoRef.current, Date.now());
      
      if (results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks;
        const isOpenMouth = detectMouthOpen(landmarks);
        const betweenEyesPoint = getBetweenEyesPoint(landmarks);
        
        if (betweenEyesPoint) {
          const movement = detectMovement(betweenEyesPoint, movementScale);
          const mirroredX = 1 - movement.x; // Mirror the camera
          
          setFaceData({
            x: Math.max(0, Math.min(1, mirroredX)), // Clamp to valid range
            y: Math.max(0, Math.min(1, movement.y)), // Clamp to valid range
            isDetected: true,
            isMouthOpen: isOpenMouth
          });

          // Draw face detection visualization
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // Draw face landmarks for debugging (optional)
              ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
              ctx.lineWidth = 1;
              
              // Draw face outline
              for (let i = 0; i < landmarks[0].length; i++) {
                const landmark = landmarks[0][i];
                ctx.beginPath();
                ctx.arc(
                  landmark.x * canvas.width,
                  landmark.y * canvas.height,
                  1,
                  0,
                  2 * Math.PI
                );
                ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
                ctx.fill();
              }
              
              // Draw between-eyes point (main tracking point)
              ctx.beginPath();
              ctx.arc(
                betweenEyesPoint.x * canvas.width,
                betweenEyesPoint.y * canvas.height,
                6,
                0,
                2 * Math.PI
              );
              ctx.fillStyle = isOpenMouth ? '#ff0088' : '#00ff88';
              ctx.shadowColor = isOpenMouth ? '#ff0088' : '#00ff88';
              ctx.shadowBlur = 10;
              ctx.fill();
              ctx.shadowBlur = 0;
              
              // Draw mouth status indicator
              ctx.font = '12px Arial';
              ctx.fillStyle = isOpenMouth ? '#ff0088' : '#00ff88';
              ctx.fillText(
                isOpenMouth ? 'FIRING' : 'READY',
                10,
                canvas.height - 10
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
        
        // Reset calibration when face is lost
        mouthBaselineRef.current = null;
        mouthHistoryRef.current = [];
      }
    } catch (err) {
      console.error('Frame processing error:', err);
    }
  }, [faceLandmarker, detectMovement, detectMouthOpen, getBetweenEyesPoint]);

  // Start processing loop with higher frequency for better responsiveness
  const startProcessingLoop = useCallback((movementScale: number = 3) => {
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