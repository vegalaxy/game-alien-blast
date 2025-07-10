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
  
  // Movement tracking - exactly like the reference
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
        video: true
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

  // Distance calculation - exactly like reference
  const distance2Points = useCallback((point1: any, point2: any) => {
    return Math.sqrt((point2.x - point1.x)**2 + (point2.y - point1.y)**2 + (point2.z - point1.z)**2);
  }, []);

  // Movement scale calculation - exactly like reference
  const getMovementScale = useCallback((point1: any, point2: any, scaleRatio: number) => {
    return {
      newX: (point2.x - point1.x) * scaleRatio,
      newY: (point2.y - point1.y) * scaleRatio
    };
  }, []);

  // Movement detection - exactly like reference
  const detectMovement = useCallback((newPoint: any, movementScale: number) => {
    if (!startPointRef.current || !startPointRef.current.x || !startPointRef.current.y) {
      startPointRef.current = { x: newPoint.x, y: newPoint.y };
      prevPointRef.current = { x: newPoint.x, y: newPoint.y };
      return prevPointRef.current;
    }
    
    const movement = getMovementScale(startPointRef.current, newPoint, movementScale);
    prevPointRef.current.x = startPointRef.current.x + movement.newX;
    prevPointRef.current.y = startPointRef.current.y + movement.newY;
    
    return {
      x: prevPointRef.current.x,
      y: prevPointRef.current.y
    };
  }, [getMovementScale]);

  // Mouth detection - exactly like reference
  const detectMouthOpen = useCallback((landmarks: any[]) => {
    return distance2Points(landmarks[0][13], landmarks[0][14]) > 0.02;
  }, [distance2Points]);

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
        
        // Use landmark 8 - exactly like the reference code
        const trackingPoint = landmarks[0][8]; // between eyes
        const movement = detectMovement(trackingPoint, movementScale);
        
        // Mirror camera - exactly like reference
        const newX = window.innerWidth - (movement.x * window.innerWidth);
        const newY = movement.y * window.innerHeight;
        
        // Convert back to normalized coordinates for our system
        const normalizedX = newX / window.innerWidth;
        const normalizedY = newY / window.innerHeight;
        
        setFaceData({
          x: normalizedX,
          y: normalizedY,
          isDetected: true,
          isMouthOpen: isOpenMouth
        });

        // Draw visualization - exactly like reference
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            // Draw the tracking point - exactly like reference
            ctx.beginPath();
            ctx.arc(trackingPoint.x * canvas.width, trackingPoint.y * canvas.height, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#30FF30';
            ctx.fill();
          }
        }
      } else {
        setFaceData(prev => ({ ...prev, isDetected: false, isMouthOpen: false }));
      }
    } catch (err) {
      console.error('Frame processing error:', err);
    }
  }, [faceLandmarker, detectMovement, detectMouthOpen]);

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
    
    // Reset movement tracking
    startPointRef.current = null;
    prevPointRef.current = null;
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