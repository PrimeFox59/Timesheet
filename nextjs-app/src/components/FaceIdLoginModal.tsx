'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '@/lib/api';
import { 
  ScanFace, 
  Camera, 
  X, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  SwitchCamera,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface FaceIdLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

type ScanStatus = 'idle' | 'scanning' | 'searching' | 'unrecognized' | 'success' | 'error';

export default function FaceIdLoginModal({ isOpen, onClose, onSuccess }: FaceIdLoginModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing AI Face Camera...');
  const [progress, setProgress] = useState<number>(0);
  const [scanCount, setScanCount] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAutoScanActive, setIsAutoScanActive] = useState<boolean>(true);
  const [matchedUser, setMatchedUser] = useState<any>(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setScanStatus('idle');
    setStatusMessage('Starting camera feed...');
    setProgress(20);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.warn('Autoplay prevented:', e));
          setStatusMessage('Align your face inside the oval frame...');
          setProgress(40);
          setScanStatus('searching');
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(err.message || 'Unable to access camera. Please check camera permissions.');
      setScanStatus('error');
      setStatusMessage('Camera access failed.');
    }
  }, [facingMode, stopCamera]);

  // Capture current frame from video as Base64 JPEG
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // Perform single scan verification
  const executeScan = useCallback(async () => {
    const frameData = captureFrame();
    if (!frameData) {
      // If frame is not ready yet, retry in next cycle
      return false;
    }

    setScanStatus('scanning');
    setStatusMessage('Verifying biometric facial contours...');
    setProgress(75);

    try {
      const res = await fetch(apiUrl('/api/auth/face-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frameData })
      });

      const data = await res.json();

      if (data.success && data.user) {
        // SUCCESS: Face matched!
        setScanStatus('success');
        setStatusMessage(`Face Verified: ${data.user.username} (${data.user.id})`);
        setProgress(100);
        setMatchedUser(data.user);

        // Auto login callback after short celebration animation
        setTimeout(() => {
          onSuccess(data.user);
          onClose();
        }, 1200);

        return true;
      } else {
        // NOT RECOGNIZED: Update status, but CONTINUOUS LOOP will keep searching!
        setScanStatus('unrecognized');
        setStatusMessage('Face not recognized. Please position your face inside...');
        setProgress(100);
        setScanCount(prev => prev + 1);
        return false;
      }
    } catch (e: any) {
      console.error('Face recognition network error:', e);
      setScanStatus('unrecognized');
      setStatusMessage('Scanning network delay, retrying automatically...');
      setProgress(100);
      return false;
    }
  }, [captureFrame, onClose, onSuccess]);

  // CONTINUOUS AUTO-SCAN LOOP:
  // Automatically runs over and over until a face is found or user closes the modal
  useEffect(() => {
    if (!isOpen || !isAutoScanActive || scanStatus === 'success' || scanStatus === 'error' || cameraError) {
      return;
    }

    // Wait until video is playing
    if (scanStatus === 'idle') return;

    const delay = scanStatus === 'unrecognized' ? 650 : 800;

    scanTimerRef.current = setTimeout(async () => {
      if (isOpen && isAutoScanActive) {
        await executeScan();
      }
    }, delay);

    return () => {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, [isOpen, isAutoScanActive, scanStatus, cameraError, executeScan, scanCount]);

  // Modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      setIsAutoScanActive(true);
      setScanCount(0);
      setMatchedUser(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleManualRetry = () => {
    setScanStatus('searching');
    setStatusMessage('Scanning face now...');
    setProgress(50);
    executeScan();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[420px] rounded-3xl bg-slate-900/95 border border-slate-700/60 shadow-2xl p-6 text-white space-y-5 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Hidden Canvas for Frame Extraction */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Header Section */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[#FF6B00] shadow-md shadow-orange-500/10">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-white">AI Face ID Login</h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                <Zap className="w-3 h-3 text-orange-400" />
                Instant face verification in 1-2 seconds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleFacingMode}
              title="Switch Camera"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              title="Close"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewfinder Box */}
        <div className="relative w-full aspect-square max-w-[340px] mx-auto rounded-3xl overflow-hidden bg-black border-2 border-slate-700/60 shadow-2xl flex items-center justify-center group">
          
          {cameraError ? (
            <div className="p-6 text-center space-y-3 z-10">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
              <p className="text-xs text-rose-300 font-medium leading-relaxed">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition-all inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Live Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder 4 Corner Brackets (Orange) */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#FF6B00] rounded-tl-lg pointer-events-none" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#FF6B00] rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#FF6B00] rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#FF6B00] rounded-br-lg pointer-events-none" />

              {/* Top & Bottom Alignment Marks */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#FF6B00] rounded-full shadow-lg pointer-events-none" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#FF6B00] rounded-full shadow-lg pointer-events-none" />

              {/* Center Oval Face Guide Frame */}
              <div 
                className={`absolute w-[68%] h-[82%] rounded-[50%] border-2 pointer-events-none transition-all duration-500 flex items-center justify-center ${
                  scanStatus === 'success'
                    ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.8)] scale-105'
                    : scanStatus === 'scanning'
                    ? 'border-orange-500 shadow-[0_0_25px_rgba(255,107,0,0.6)] animate-pulse'
                    : 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                }`}
              >
                {/* Horizontal Laser Scanning Line (Sweeps up/down during search) */}
                {scanStatus !== 'success' && !cameraError && (
                  <div className="absolute inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-pulse opacity-80" />
                )}
              </div>

              {/* Center Status Icon Overlay Badge */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {scanStatus === 'unrecognized' && (
                  <div className="w-16 h-16 rounded-full bg-rose-600/75 backdrop-blur-md border border-rose-400/80 flex items-center justify-center shadow-[0_0_30px_rgba(225,29,72,0.7)] animate-in zoom-in-75 duration-200">
                    <AlertCircle className="w-8 h-8 text-white stroke-[2.5]" />
                  </div>
                )}

                {scanStatus === 'scanning' && (
                  <div className="w-16 h-16 rounded-full bg-orange-600/75 backdrop-blur-md border border-orange-400/80 flex items-center justify-center shadow-[0_0_30px_rgba(255,107,0,0.7)] animate-spin duration-1000">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                )}

                {scanStatus === 'success' && (
                  <div className="w-20 h-20 rounded-full bg-emerald-600/85 backdrop-blur-md border-2 border-emerald-300 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.9)] animate-in zoom-in-90 duration-300">
                    <CheckCircle2 className="w-10 h-10 text-white stroke-[2.5]" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Status Line & Continuous Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 truncate pr-2">
              <span 
                className={`w-2 h-2 rounded-full shrink-0 ${
                  scanStatus === 'success'
                    ? 'bg-emerald-500 animate-ping'
                    : scanStatus === 'scanning'
                    ? 'bg-orange-500 animate-pulse'
                    : scanStatus === 'unrecognized'
                    ? 'bg-rose-500 animate-pulse'
                    : 'bg-slate-400'
                }`} 
              />
              <span className={`truncate ${
                scanStatus === 'success'
                  ? 'text-emerald-400 font-bold'
                  : scanStatus === 'unrecognized'
                  ? 'text-rose-400 font-medium'
                  : 'text-slate-300'
              }`}>
                {statusMessage}
              </span>
            </div>
            
            <span className="text-xs font-mono font-bold text-orange-400 shrink-0">
              {progress}%
            </span>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                scanStatus === 'success'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : scanStatus === 'scanning'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                  : 'bg-gradient-to-r from-rose-500 to-pink-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Continuous Searching Micro-text */}
          {scanStatus === 'unrecognized' && (
            <p className="text-[11px] text-slate-400 text-center font-medium animate-pulse pt-0.5">
              🔄 Auto continuous scan active (searching until face matches...)
            </p>
          )}
        </div>

        {/* Action Buttons Section */}
        <div className="space-y-2.5 pt-1">
          
          {/* Main Primary Action Button */}
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={scanStatus === 'success' || !!cameraError}
            className="w-full py-3 rounded-2xl text-xs sm:text-sm font-extrabold btn-orange text-white shadow-xl hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <Camera className="w-4 h-4" />
            <span>Scan &amp; Login Now</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
          </button>

          {/* Secondary Action Buttons Row */}
          <div className="flex items-center gap-2">
            
            <button
              type="button"
              onClick={handleManualRetry}
              disabled={scanStatus === 'success' || !!cameraError}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanStatus === 'scanning' ? 'animate-spin' : ''}`} />
              <span>Retry Scan</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-5 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all"
            >
              Cancel
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
