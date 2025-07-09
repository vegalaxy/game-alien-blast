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
        video: { width: 720, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          // Handle interrupted play() request (common in React StrictMode)
          if (playError instanceof DOMException && 
              (playError.name === 'AbortError' || 
               playError.message.includes('interrupted'))) {
            // This is expected behavior when component unmounts during play()
            // Safe to ignore this specific error
            return;
          }
          // Re-throw other play errors
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

    const movement = {
      newX: (newPoint.x - startPointRef.current.x) * movementScale,
      newY: (newPoint.y - startPointRef.current.y) * movementScale
    };

    prevPointRef.current = {
      x: startPointRef.current.x + movement.newX,
      y: startPointRef.current.y + movement.newY
    };

    return prevPointRef.current;
  }, []);

  const detectMouthOpen = useCallback((landmarks: any[]) => {
    if (!landmarks[0] || !landmarks[0][13] || !landmarks[0][14]) return false;
    
    const upperLip = landmarks[0][13];
    const lowerLip = landmarks[0][14];
    const distance = Math.sqrt(
      (lowerLip.x - upperLip.x) ** 2 + 
      (lowerLip.y - upperLip.y) ** 2 + 
      (lowerLip.z - upperLip.z) ** 2
    );
    
    return distance > 0.02;
  }, []);

  const processFrame = useCallback(async (movementScale: number = 3) => {
    if (!faceLandmarker || !videoRef.current) {
      return;
    }

    // Check if video dimensions are available before processing
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      return;
    }

    try {
      const results = await faceLandmarker.detectForVideo(videoRef.current, Date.now());
      
      if (results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks;
        const isOpenMouth = detectMouthOpen(landmarks);
        const centerPoint = landmarks[0][8]; // Point between eyes
        
        const movement = detectMovement(centerPoint, movementScale);
        const mirroredX = 1 - movement.x; // Mirror the camera
        
        setFaceData({
          x: mirroredX,
          y: movement.y,
          isDetected: true,
          isMouthOpen: isOpenMouth
        });

        // Draw face detection visualization
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            // Draw face point
            ctx.beginPath();
            ctx.arc(
              centerPoint.x * canvas.width,
              centerPoint.y * canvas.height,
              4,
              0,
              2 * Math.PI
            );
            ctx.fillStyle = isOpenMouth ? '#ff0088' : '#00ff88';
            ctx.fill();
          }
        }
      } else {
        setFaceData(prev => ({ ...prev, isDetected: false }));
      }
    } catch (err) {
      console.error('Frame processing error:', err);
    }
  }, [faceLandmarker, detectMovement, detectMouthOpen]);

  // Start processing loop with proper async handling
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