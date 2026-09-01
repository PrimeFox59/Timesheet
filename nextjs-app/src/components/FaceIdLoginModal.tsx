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
  Zap,
  Target
} from 'lucide-react';

export interface UserSessionData {
  id: string;
  username: string;
  role: string;
  grade?: string;
  preferred_areas?: string;
  preferred_shift?: string;
  number_of_areas?: number;
  phone?: string;
  email?: string;
  avatar?: string;
}

interface FaceIdLoginModalProps {
  isOpen: boolean;
  mode?: 'login' | 'register';
  userId?: string;
  onClose: () => void;
  onSuccess: (user: UserSessionData | { avatarUrl: string }) => void;
}

type ScanStage = 'searching' | 'tracking' | 'locked' | 'verifying' | 'success' | 'unrecognized' | 'error';

interface FaceTrackingData {
  hasFace: boolean;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  confidence: number;
}

export default function FaceIdLoginModal({ 
  isOpen, 
  mode = 'login', 
  userId,
  onClose, 
  onSuccess 
}: FaceIdLoginModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Animation & Loop refs
  const isRunningRef = useRef<boolean>(false);
  const animFrameIdRef = useRef<number | null>(null);
  const stableFramesCountRef = useRef<number>(0);
  const isVerifyingRef = useRef<boolean>(false);
  const currentStageRef = useRef<ScanStage>('searching');

  // UI States
  const [stage, setStage] = useState<ScanStage>('searching');
  const [statusMessage, setStatusMessage] = useState<string>('Mencari wajah dalam frame...');
  const [progress, setProgress] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [laserPos, setLaserPos] = useState<number>(50);

  // Sync ref with stage
  useEffect(() => {
    currentStageRef.current = stage;
  }, [stage]);

  // Stop camera & cancel animation frame
  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
    isVerifyingRef.current = false;
    stableFramesCountRef.current = 0;

    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // REAL-TIME OPTICAL FACE TRACKER (Canvas Image Processing)
  const trackFaceInFrame = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number): FaceTrackingData => {
    const roiW = Math.round(width * 0.60);
    const roiH = Math.round(height * 0.75);
    const roiX = Math.round((width - roiW) / 2);
    const roiY = Math.round((height - roiH) / 2);

    const imgData = ctx.getImageData(roiX, roiY, roiW, roiH);
    const pixels = imgData.data;

    let skinPixels = 0;
    let sumX = 0;
    let sumY = 0;
    let leftSkin = 0;
    let rightSkin = 0;
    let topSkin = 0;
    let bottomSkin = 0;
    let lumVariance = 0;
    let lastLum = 0;

    const step = 3;
    let totalSamples = 0;

    for (let y = 0; y < roiH; y += step) {
      for (let x = 0; x < roiW; x += step) {
        totalSamples++;
        const idx = (y * roiW + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        lumVariance += Math.abs(lum - lastLum);
        lastLum = lum;

        // Standard Human Skin Chrominance Model (YCbCr + RGB)
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        const isSkin = (
          r > 55 && g > 35 && b > 20 &&
          r > g && (r - g) >= 10 &&
          Math.abs(r - g) <= 140 &&
          cb >= 75 && cb <= 135 &&
          cr >= 130 && cr <= 180
        );

        if (isSkin) {
          skinPixels++;
          sumX += x;
          sumY += y;

          if (x < roiW * 0.5) leftSkin++;
          else rightSkin++;

          if (y < roiH * 0.5) topSkin++;
          else bottomSkin++;
        }
      }
    }

    const skinRatio = skinPixels / Math.max(1, totalSamples);
    const symmetry = rightSkin > 0 ? leftSkin / rightSkin : 0;
    const isSymmetric = symmetry >= 0.30 && symmetry <= 3.3;

    const isFaceDetected = (
      skinRatio >= 0.15 && skinRatio <= 0.88 &&
      topSkin > 0 && bottomSkin > 0 &&
      isSymmetric &&
      lumVariance > 2000
    );

    if (!isFaceDetected || skinPixels === 0) {
      return { hasFace: false, centerX: width / 2, centerY: height / 2, width: 0, height: 0, confidence: 0 };
    }

    const avgX = roiX + (sumX / skinPixels);
    const avgY = roiY + (sumY / skinPixels);

    return {
      hasFace: true,
      centerX: avgX,
      centerY: avgY,
      width: roiW,
      height: roiH,
      confidence: Math.min(0.98, 0.60 + skinRatio * 0.4)
    };
  }, []);

  // Capture frame as Base64 JPEG
  const getSnapshot = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // TRIGGER STAGE 4: RECORD & VERIFY BIOMETRIC
  const executeBiometricRecord = useCallback(async () => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    setStage('verifying');
    setStatusMessage(mode === 'register' ? 'Menyimpan profil wajah biometrik...' : 'Memverifikasi kecocokan wajah...');
    setProgress(100);

    const snapshot = getSnapshot();
    if (!snapshot) {
      isVerifyingRef.current = false;
      setStage('searching');
      return;
    }

    try {
      if (mode === 'register') {
        // MODE REGISTER: Simpan avatar ke profil user
        const res = await fetch(apiUrl('/api/user/settings'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            user_id: userId,
            avatar: snapshot
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setStage('success');
          setStatusMessage('Face ID Berhasil Didaftarkan!');
          setTimeout(() => {
            onSuccess({ avatarUrl: snapshot });
            onClose();
          }, 1100);
          return;
        } else {
          setStage('unrecognized');
          setStatusMessage('Gagal menyimpan Face ID. Silakan coba lagi.');
        }
      } else {
        // MODE LOGIN: Verifikasi dengan database
        const res = await fetch(apiUrl('/api/auth/face-login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: snapshot,
            has_face_detected: true,
            confidence: 0.95
          })
        });

        const data = await res.json();

        if (data.success && data.user) {
          setStage('success');
          setStatusMessage(`Wajah Dikenali: ${data.user.username}!`);
          setTimeout(() => {
            onSuccess(data.user);
            onClose();
          }, 1100);
          return;
        } else {
          setStage('unrecognized');
          setStatusMessage(data.message || 'Wajah tidak cocok dengan akun terdaftar.');
        }
      }
    } catch {
      setStage('unrecognized');
      setStatusMessage('Koneksi terganggu. Mengulang pemindaian...');
    } finally {
      isVerifyingRef.current = false;
    }

    // Jeda 1.2 detik lalu kembali ke Stage 1 (Detect & Track kembali secara mulus)
    setTimeout(() => {
      if (isRunningRef.current && currentStageRef.current !== 'success') {
        stableFramesCountRef.current = 0;
        setStage('searching');
        setStatusMessage('Mencari wajah dalam frame...');
        setProgress(0);
      }
    }, 1200);
  }, [getSnapshot, mode, onClose, onSuccess, userId]);

  // MAIN REAL-TIME TRACKING & LOCKING LOOP (30 FPS requestAnimationFrame)
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!isRunningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Animate laser scanning line smoothly
      const laserCycle = (Math.sin(time / 400) + 1) / 2; // 0 to 1
      setLaserPos(Math.round(15 + laserCycle * 70)); // 15% to 85%

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0 && !isVerifyingRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx && time - lastTime > 60) { // Check every 60ms (~16 FPS optical tracker)
          lastTime = time;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const tracking = trackFaceInFrame(ctx, canvas.width, canvas.height);

          if (currentStageRef.current !== 'verifying' && currentStageRef.current !== 'success') {
            if (!tracking.hasFace) {
              // STAGE 1: TIDAK ADA WAJAH
              stableFramesCountRef.current = Math.max(0, stableFramesCountRef.current - 1);
              if (stableFramesCountRef.current === 0) {
                setStage('searching');
                setStatusMessage('Posisikan wajah Anda di dalam lingkaran oval...');
                setProgress(0);
              }
            } else {
              // STAGE 2: WAJAH TERDETEKSI -> MULAI TRACKING & ISI PROGRESS STABILITY
              stableFramesCountRef.current += 1;
              const framesRequired = 6; // ~350ms stable face hold
              const currentPct = Math.min(95, Math.round((stableFramesCountRef.current / framesRequired) * 95));

              if (stableFramesCountRef.current < framesRequired) {
                setStage('tracking');
                setStatusMessage(`Face detected! Scanning AI biometrics (${currentPct}%)...`);
                setProgress(currentPct);
              } else {
                // STAGE 3: TARGET LOCKED! -> TRIGGER STAGE 4 RECORD/VERIFY
                setStage('locked');
                setStatusMessage('Target Locked! Mengambil sampel biometrik (100%)...');
                setProgress(100);
                executeBiometricRecord();
              }
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    if (isOpen) {
      animFrameIdRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isOpen, trackFaceInFrame, executeBiometricRecord]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setStage('searching');
    setStatusMessage('Memulai koneksi kamera...');
    setProgress(0);
    isRunningRef.current = true;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Akses kamera tidak didukung di browser ini.');
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
          setStatusMessage('Posisikan wajah Anda di dalam lingkaran oval...');
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka kamera.';
      setCameraError(msg);
      setStage('error');
      setStatusMessage('Gagal membuka kamera.');
      isRunningRef.current = false;
    }
  }, [facingMode, stopCamera]);

  // Modal open / close lifecycle
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isOpen) {
      timer = setTimeout(() => {
        startCamera();
      }, 0);
    } else {
      stopCamera();
    }

    return () => {
      if (timer) clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleManualTrigger = () => {
    executeBiometricRecord();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[420px] rounded-3xl bg-slate-900/95 border border-slate-700/60 shadow-2xl p-6 text-white space-y-5 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Hidden Canvas for Optical Tracking Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Header Section */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[#FF6B00] shadow-md shadow-orange-500/10">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-white">
                  {mode === 'register' ? 'AI Face ID Registration' : 'AI Face ID Login'}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                <Zap className="w-3 h-3 text-orange-400" />
                {mode === 'register' ? 'Scan and register biometric face profile' : 'Instant face verification in 1-2 seconds'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleFacingMode}
              title="Ganti Kamera"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              title="Tutup"
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
                Coba Lagi
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

              {/* Viewfinder 4 Corner Brackets */}
              <div className={`absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 rounded-tl-lg pointer-events-none transition-colors duration-300 ${
                stage === 'success' ? 'border-emerald-400' : stage === 'locked' ? 'border-amber-400' : 'border-[#FF6B00]'
              }`} />
              <div className={`absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg pointer-events-none transition-colors duration-300 ${
                stage === 'success' ? 'border-emerald-400' : stage === 'locked' ? 'border-amber-400' : 'border-[#FF6B00]'
              }`} />
              <div className={`absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 rounded-bl-lg pointer-events-none transition-colors duration-300 ${
                stage === 'success' ? 'border-emerald-400' : stage === 'locked' ? 'border-amber-400' : 'border-[#FF6B00]'
              }`} />
              <div className={`absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 rounded-br-lg pointer-events-none transition-colors duration-300 ${
                stage === 'success' ? 'border-emerald-400' : stage === 'locked' ? 'border-amber-400' : 'border-[#FF6B00]'
              }`} />

              {/* Top & Bottom Alignment Marks */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#FF6B00] rounded-full shadow-lg pointer-events-none" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#FF6B00] rounded-full shadow-lg pointer-events-none" />

              {/* CENTER OVAL FACE TARGET & TRACKING FRAME */}
              <div 
                className={`absolute w-[68%] h-[82%] rounded-[50%] border-2 pointer-events-none transition-all duration-200 flex items-center justify-center ${
                  stage === 'success'
                    ? 'border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.9)] scale-105'
                    : stage === 'locked' || stage === 'verifying'
                    ? 'border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.8)] scale-[1.02]'
                    : stage === 'tracking'
                    ? 'border-[#FF6B00] shadow-[0_0_25px_rgba(255,107,0,0.7)]'
                    : stage === 'unrecognized'
                    ? 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                    : 'border-slate-500/40 shadow-[0_0_15px_rgba(148,163,184,0.2)]'
                }`}
              >
                {/* Horizontal Laser Scanning Bar (Sweeps across the face during tracking) */}
                {(stage === 'tracking' || stage === 'locked') && (
                  <div 
                    className="absolute inset-x-3 h-[3px] bg-gradient-to-r from-transparent via-[#FF6B00] to-transparent shadow-[0_0_12px_#FF6B00] pointer-events-none transition-all duration-75"
                    style={{ top: `${laserPos}%` }}
                  />
                )}
              </div>

              {/* HUD OVERLAY BADGE */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {stage === 'locked' && (
                  <div className="w-16 h-16 rounded-full bg-amber-500/80 backdrop-blur-md border border-amber-300 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.8)] animate-in zoom-in-90 duration-150">
                    <Target className="w-8 h-8 text-white stroke-[2.5] animate-spin duration-1000" />
                  </div>
                )}

                {stage === 'unrecognized' && (
                  <div className="w-16 h-16 rounded-full bg-rose-600/75 backdrop-blur-md border border-rose-400/80 flex items-center justify-center shadow-[0_0_30px_rgba(225,29,72,0.7)] animate-in zoom-in-75 duration-150">
                    <AlertCircle className="w-8 h-8 text-white stroke-[2.5]" />
                  </div>
                )}

                {stage === 'success' && (
                  <div className="w-20 h-20 rounded-full bg-emerald-600/90 backdrop-blur-md border-2 border-emerald-300 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.95)] animate-in zoom-in-90 duration-300">
                    <CheckCircle2 className="w-10 h-10 text-white stroke-[2.5]" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Status Line & 4-Stage Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 truncate pr-2">
              <span 
                className={`w-2 h-2 rounded-full shrink-0 ${
                  stage === 'success'
                    ? 'bg-emerald-500 animate-ping'
                    : stage === 'locked' || stage === 'verifying'
                    ? 'bg-amber-400 animate-pulse'
                    : stage === 'tracking'
                    ? 'bg-orange-500 animate-pulse'
                    : stage === 'unrecognized'
                    ? 'bg-rose-500 animate-pulse'
                    : 'bg-slate-400'
                }`} 
              />
              <span className={`truncate ${
                stage === 'success'
                  ? 'text-emerald-400 font-bold'
                  : stage === 'locked' || stage === 'verifying'
                  ? 'text-amber-300 font-bold'
                  : stage === 'tracking'
                  ? 'text-orange-400 font-medium'
                  : stage === 'unrecognized'
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
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-150 ${
                stage === 'success'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : stage === 'locked' || stage === 'verifying'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                  : stage === 'tracking'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                  : 'bg-gradient-to-r from-rose-500 to-pink-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 4-Stage Subtitle Description */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium pt-1">
            {stage === 'searching' && <span>Menunggu wajah masuk ke dalam lingkaran oval...</span>}
            {stage === 'tracking' && <span className="text-orange-400 font-bold">Wajah terdeteksi! Tahan posisi stabil untuk mengunci...</span>}
            {stage === 'locked' && <span className="text-amber-400 font-bold">Target Terkunci! Mengambil rekaman biometrik...</span>}
            {stage === 'verifying' && <span className="text-amber-300 font-bold">Memvalidasi data biometrik dengan sistem...</span>}
            {stage === 'success' && <span className="text-emerald-400 font-bold">Autentikasi Berhasil!</span>}
            {stage === 'unrecognized' && <span className="text-rose-400 font-bold">Wajah tidak cocok. Mengulang deteksi otomatis...</span>}
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="space-y-2.5 pt-1">
          
          {/* Main Primary Action Button */}
          <button
            type="button"
            onClick={handleManualTrigger}
            disabled={stage === 'success' || !!cameraError}
            className="w-full py-3 rounded-2xl text-xs sm:text-sm font-extrabold btn-orange text-white shadow-xl hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <Camera className="w-4 h-4" />
            <span>{mode === 'register' ? 'Capture & Save Face ID' : 'Scan & Login Now'}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
          </button>

          {/* Secondary Action Buttons Row */}
          <div className="flex items-center gap-2">
            
            <button
              type="button"
              onClick={startCamera}
              disabled={stage === 'success' || !!cameraError}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${stage === 'tracking' || stage === 'locked' ? 'animate-spin' : ''}`} />
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
