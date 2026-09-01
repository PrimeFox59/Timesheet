'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, X, CheckCircle2, AlertCircle, RefreshCw, 
  Sparkles, ShieldCheck, UserCheck, Zap, ScanFace, Lock, SwitchCamera
} from 'lucide-react';
import { extractFaceDescriptor, FaceDescriptorResult } from '@/lib/faceBiometrics';
import { apiUrl } from '@/lib/api';

interface FaceScannerModalProps {
  mode: 'login' | 'register';
  currentUser?: any; // Required in 'register' mode
  targetUserId?: string; // Optional target user ID for faster direct matching in login mode
  onClose: () => void;
  onSuccess: (userData?: any) => void;
}

export default function FaceScannerModal({
  mode,
  currentUser,
  targetUserId,
  onClose,
  onSuccess
}: FaceScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [scanStatus, setScanStatus] = useState<
    'initializing' | 'positioning' | 'scanning' | 'verifying' | 'success' | 'failed'
  >('initializing');
  const [statusMessage, setStatusMessage] = useState('Initializing AI Camera...');
  const [scanProgress, setScanProgress] = useState(0);
  const [recognizedUser, setRecognizedUser] = useState<any>(null);
  const [detectedSnapshot, setDetectedSnapshot] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  // Start Camera Stream
  const startCamera = async (targetFacing: 'user' | 'environment' = facingMode) => {
    stopCamera();
    setCameraError(null);
    setScanStatus('initializing');
    setStatusMessage('Accessing camera on your device...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: targetFacing
        },
        audio: false
      });

      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
          setScanStatus('positioning');
          setStatusMessage('Position your face inside the scanner frame');
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Failed to access camera. Please enable camera permissions in your browser settings.');
      setScanStatus('failed');
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  // Toggle Camera Front / Back (Flip Camera on Mobile Phones)
  const toggleCameraFacing = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
  };

  // Continuous AI Face Detection & Stability Loop
  useEffect(() => {
    if (scanStatus !== 'positioning' && scanStatus !== 'scanning' || isProcessing) return;

    let isMounted = true;
    let consecutiveFaceFrames = 0;
    const requiredFrames = 3; // Fast ~0.6-0.8s responsive auto-trigger

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || isProcessing) return;

      try {
        const result = await extractFaceDescriptor(videoRef.current, canvasRef.current || undefined);

        if (!isMounted || isProcessing) return;

        if (result.faceDetected && result.descriptor.length === 128) {
          consecutiveFaceFrames++;

          const progress = Math.min(100, Math.round((consecutiveFaceFrames / requiredFrames) * 100));
          setScanProgress(progress);
          setScanStatus('scanning');
          setStatusMessage(`Face detected! Scanning AI biometrics (${progress}%)...`);

          // Once face is detected steadily, verify immediately
          if (consecutiveFaceFrames >= requiredFrames) {
            clearInterval(interval);
            setIsProcessing(true);
            setScanStatus('verifying');
            setStatusMessage(mode === 'login' ? 'Verifying account credentials...' : 'Saving biometric facial profile...');
            handleProcessFace(result);
          }
        } else {
          consecutiveFaceFrames = Math.max(0, consecutiveFaceFrames - 1);
          setScanProgress(Math.round((consecutiveFaceFrames / requiredFrames) * 100));
          if (consecutiveFaceFrames === 0) {
            setScanStatus('positioning');
            setStatusMessage('Position your face inside the scanner frame');
          }
        }
      } catch (err) {
        console.error('Face descriptor loop error:', err);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [scanStatus, mode, isProcessing]);

  // Manual Trigger: Immediate Capture & Verify (Great for Mobile)
  const handleManualCapture = async () => {
    if (!videoRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      setScanProgress(100);
      setScanStatus('verifying');
      setStatusMessage('Scanning facial biometrics now...');

      const result = await extractFaceDescriptor(videoRef.current, canvasRef.current || undefined);
      if (result.descriptor.length === 128) {
        handleProcessFace(result);
      } else {
        setIsProcessing(false);
        setScanStatus('failed');
        setStatusMessage('Face not clearly detected. Please adjust lighting and try again.');
      }
    } catch (e) {
      setIsProcessing(false);
      setScanStatus('failed');
      setStatusMessage('Failed to capture face.');
    }
  };

  // Process Registration or Login
  const handleProcessFace = async (faceResult: FaceDescriptorResult) => {
    try {
      setDetectedSnapshot(faceResult.photoDataUrl || null);

      if (mode === 'register') {
        // Register Face ID
        const res = await fetch(apiUrl('/api/user/face-register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser?.id,
            face_descriptor: faceResult.descriptor,
            face_photo: faceResult.photoDataUrl
          })
        });

        const data = await res.json();
        if (data.success) {
          setScanStatus('success');
          setStatusMessage('✅ Face ID Successfully Registered!');
          setTimeout(() => {
            stopCamera();
            onSuccess(data.user);
          }, 1400);
        } else {
          setIsProcessing(false);
          setScanStatus('failed');
          setStatusMessage(data.error || 'Failed to register Face ID');
        }
      } else {
        // Login with Face ID
        const res = await fetch(apiUrl('/api/auth/face-login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            face_descriptor: faceResult.descriptor,
            target_user_id: targetUserId || currentUser?.id || undefined
          })
        });

        const data = await res.json();
        if (data.success && data.user) {
          setRecognizedUser(data.user);
          setScanStatus('success');
          setStatusMessage(`✅ Welcome, ${data.user.username}!`);
          setTimeout(() => {
            stopCamera();
            onSuccess(data.user);
          }, 1400);
        } else {
          setIsProcessing(false);
          setScanStatus('failed');
          setStatusMessage(data.error || 'Face does not match any registered account.');
        }
      }
    } catch (err: any) {
      console.error('Face auth processing error:', err);
      setIsProcessing(false);
      setScanStatus('failed');
      setStatusMessage('An error occurred while processing face data.');
    }
  };

  const handleRetry = () => {
    setIsProcessing(false);
    setScanProgress(0);
    setDetectedSnapshot(null);
    setScanStatus('positioning');
    setStatusMessage('Position your face inside the scanner frame');
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200 select-none">
      <div className="glass-card max-w-md w-full max-h-[92vh] overflow-y-auto rounded-3xl p-4 sm:p-6 space-y-3.5 shadow-2xl bg-slate-950/95 border border-slate-700/80 text-white relative flex flex-col items-center my-auto">
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#FF6B00]/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="w-full flex items-center justify-between pb-2.5 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-[#FF6B00] border border-orange-500/30 flex items-center justify-center font-bold">
              <ScanFace className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                <span>{mode === 'login' ? 'AI Face ID Login' : 'AI Face ID Registration'}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-orange-500/20 border border-orange-500/30 text-orange-400">
                  v2.0
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                {mode === 'login' ? 'Instant face verification in 1-2 seconds' : 'Scan and register biometric face profile'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Flip Camera Button (Front / Rear on Mobile) */}
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
              title="Flip Camera (Front/Rear)"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewport Area */}
        <div className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden bg-black border-2 border-slate-800 shadow-inner flex items-center justify-center">
          
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            // @ts-ignore
            webkit-playsinline="true"
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />

          {/* Hidden Canvas for computation */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Cyberpunk HUD Scanning Face Target Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3">
            
            {/* Oval Alignment Ring */}
            <div
              className={`w-48 h-60 sm:w-52 sm:h-64 rounded-[45%] border-2 transition-all duration-300 relative flex items-center justify-center ${
                scanStatus === 'success'
                  ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                  : scanStatus === 'scanning'
                  ? 'border-[#FF6B00] shadow-[0_0_20px_rgba(255,107,0,0.4)] scale-105'
                  : scanStatus === 'failed'
                  ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                  : 'border-white/30 border-dashed animate-pulse'
              }`}
            >
              {/* Top and Bottom Target Brackets */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#FF6B00] rounded-full" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#FF6B00] rounded-full" />

              {/* Moving Laser Scan Line (when scanning) */}
              {(scanStatus === 'scanning' || scanStatus === 'verifying') && (
                <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-[#FF6B00] to-transparent shadow-[0_0_12px_#FF6B00] animate-bounce duration-700" />
              )}

              {/* Success Overlay Indicator */}
              {scanStatus === 'success' && (
                <div className="w-16 h-16 rounded-full bg-emerald-500/30 backdrop-blur-md border border-emerald-400 text-emerald-300 flex items-center justify-center animate-in zoom-in-75 duration-200">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
              )}

              {/* Failed Overlay Indicator */}
              {scanStatus === 'failed' && (
                <div className="w-16 h-16 rounded-full bg-rose-500/30 backdrop-blur-md border border-rose-400 text-rose-300 flex items-center justify-center animate-in zoom-in-75 duration-200">
                  <AlertCircle className="w-10 h-10 text-rose-400" />
                </div>
              )}
            </div>

            {/* Corner Bracket Reticles */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#FF6B00]" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#FF6B00]" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#FF6B00]" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#FF6B00]" />
          </div>

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/95 p-5 flex flex-col items-center justify-center text-center text-rose-400 space-y-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-xs font-semibold">{cameraError}</p>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="mt-2 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar (0% to 100%) */}
        <div className="w-full space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 truncate max-w-[80%]">
              {scanStatus === 'scanning' ? (
                <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-ping shrink-0" />
              ) : scanStatus === 'success' ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
              )}
              <span className="truncate">{statusMessage}</span>
            </span>
            <span className="font-bold text-orange-400">{scanProgress}%</span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-200 ${
                scanStatus === 'success'
                  ? 'bg-emerald-500 shadow-[0_0_10px_#10B981]'
                  : scanStatus === 'failed'
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-orange-600 to-[#FF6B00] shadow-[0_0_10px_#FF6B00]'
              }`}
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full space-y-2 pt-1">
          {/* Quick Manual Scan Button for Smartphones */}
          {scanStatus !== 'success' && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleManualCapture}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05600] text-white text-xs font-extrabold hover:from-[#E05600] hover:to-[#C04600] transition flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>{mode === 'login' ? 'Scan & Login Now' : 'Capture & Save Face ID'}</span>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            {scanStatus === 'failed' ? (
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Scan</span>
              </button>
            ) : (
              <div className="text-[10px] text-slate-500 text-center flex-1">
                Auto-scans in 1s or tap button above.
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
