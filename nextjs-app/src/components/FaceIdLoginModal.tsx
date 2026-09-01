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
  Activity,
  UserX
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
  onClose: () => void;
  onSuccess: (user: UserSessionData) => void;
}

type ScanStatus = 'idle' | 'scanning' | 'searching' | 'unrecognized' | 'no_face' | 'success' | 'error';

interface FaceDetectionResult {
  hasFace: boolean;
  confidence: number;
  skinRatio: number;
  featureVector: number[];
}

export default function FaceIdLoginModal({ isOpen, onClose, onSuccess }: FaceIdLoginModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Non-blocking continuous loop refs
  const isLoopActiveRef = useRef<boolean>(false);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef<boolean>(false);
  const scanLoopWorkerRef = useRef<() => Promise<void>>(async () => {});

  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Memulai kamera AI Face ID...');
  const [progress, setProgress] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Stop camera stream & clear timers
  const stopCamera = useCallback(() => {
    isLoopActiveRef.current = false;
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // REAL COMPUTER VISION FACE DETECTION ENGINE (Runs in Canvas)
  // Analyzes skin chrominance cluster (YCbCr + RGB), facial luminance gradient & bilateral symmetry
  const analyzeFacePresence = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number): FaceDetectionResult => {
    // Define central oval region of interest (ROI)
    const roiW = Math.round(width * 0.58);
    const roiH = Math.round(height * 0.72);
    const roiX = Math.round((width - roiW) / 2);
    const roiY = Math.round((height - roiH) / 2);

    const imgData = ctx.getImageData(roiX, roiY, roiW, roiH);
    const pixels = imgData.data;

    let skinPixels = 0;
    let topSkin = 0;
    let bottomSkin = 0;
    let leftSkin = 0;
    let rightSkin = 0;
    let luminanceVarianceSum = 0;
    let lastLum = 0;

    const sampleStep = 2; // High performance subsampling
    let samplesCount = 0;

    for (let y = 0; y < roiH; y += sampleStep) {
      for (let x = 0; x < roiW; x += sampleStep) {
        samplesCount++;
        const idx = (y * roiW + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        luminanceVarianceSum += Math.abs(lum - lastLum);
        lastLum = lum;

        // Human skin chrominance model (YCbCr transform)
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
          if (y < roiH * 0.5) topSkin++;
          else bottomSkin++;

          if (x < roiW * 0.5) leftSkin++;
          else rightSkin++;
        }
      }
    }

    const skinRatio = skinPixels / Math.max(1, samplesCount);
    const symmetry = rightSkin > 0 ? leftSkin / rightSkin : 0;
    const isSymmetric = symmetry >= 0.32 && symmetry <= 3.1;
    const isHumanFacePresent = (
      skinRatio >= 0.16 && skinRatio <= 0.88 &&
      topSkin > 0 && bottomSkin > 0 &&
      isSymmetric &&
      luminanceVarianceSum > 2000 // Ensure not a flat single-color background
    );

    // Extract 8x8 normalized facial vector
    const vector: number[] = [];
    const cellW = roiW / 8;
    const cellH = roiH / 8;
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        const cellData = ctx.getImageData(
          Math.round(roiX + gx * cellW),
          Math.round(roiY + gy * cellH),
          Math.max(1, Math.round(cellW)),
          Math.max(1, Math.round(cellH))
        );
        let cellLum = 0;
        const clen = cellData.data.length;
        for (let i = 0; i < clen; i += 4) {
          cellLum += 0.299 * cellData.data[i] + 0.587 * cellData.data[i + 1] + 0.114 * cellData.data[i + 2];
        }
        vector.push(Math.round(cellLum / (clen / 4 || 1)));
      }
    }

    return {
      hasFace: isHumanFacePresent,
      confidence: isHumanFacePresent ? Math.min(0.96, 0.65 + skinRatio * 0.35) : 0,
      skinRatio,
      featureVector: vector
    };
  }, []);

  // Capture current video frame as Base64 JPEG & detect face presence
  const captureAndDetect = useCallback((): { frameData: string; detection: FaceDetectionResult } | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const detection = analyzeFacePresence(ctx, canvas.width, canvas.height);
    const frameData = canvas.toDataURL('image/jpeg', 0.85);

    return { frameData, detection };
  }, [analyzeFacePresence]);

  // CORE CONTINUOUS SCAN LOOP WORKER
  const runScanCycle = useCallback(async () => {
    if (!isLoopActiveRef.current || isExecutingRef.current) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      if (isLoopActiveRef.current) {
        loopTimeoutRef.current = setTimeout(() => {
          scanLoopWorkerRef.current();
        }, 200);
      }
      return;
    }

    isExecutingRef.current = true;

    try {
      const result = captureAndDetect();

      if (!result) {
        setScanStatus('searching');
        setStatusMessage('Menyiapkan kamera...');
      } else if (!result.detection.hasFace) {
        // 1. TIDAK ADA WAJAH DI DALAM OVAL (misal: dinding, ruangan kosong, atau kepala menoleh)
        // REJECT -> JANGAN LOGIN! Tetap di loop pemindaian mencari wajah!
        setScanStatus('no_face');
        setStatusMessage('Tidak ada wajah terdeteksi. Posisikan wajah Anda tepat di dalam lingkaran oval...');
        setProgress(100);
      } else {
        // 2. WAJAH MANUSIA TERDETEKSI DI DALAM OVAL -> KIRIM KE SERVER UNTUK VERIFIKASI BIOMETRIK
        setScanStatus('scanning');
        setStatusMessage('Wajah terdeteksi! Memverifikasi kecocokan data biometrik...');
        setProgress(80);

        const res = await fetch(apiUrl('/api/auth/face-login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: result.frameData,
            has_face_detected: true,
            confidence: result.detection.confidence,
            feature_vector: result.detection.featureVector
          })
        });

        const data = await res.json();

        if (data.success && data.user) {
          // MATCH FOUND -> STOP LOOP & AUTO-LOGIN
          isLoopActiveRef.current = false;
          setScanStatus('success');
          setStatusMessage(`Wajah Dikenali: ${data.user.username} (${data.user.id})`);
          setProgress(100);

          setTimeout(() => {
            onSuccess(data.user);
            onClose();
          }, 1100);
          return;
        } else {
          // NOT MATCHED WITH REGISTERED USER -> KEEP SCANNING CONTINUOUSLY!
          setScanStatus('unrecognized');
          setStatusMessage(data.message || 'Wajah tidak cocok dengan akun terdaftar. Mencari ulang...');
          setProgress(100);
        }
      }
    } catch {
      setScanStatus('unrecognized');
      setStatusMessage('Koneksi tertunda, scanning ulang otomatis...');
    } finally {
      isExecutingRef.current = false;
    }

    // CONTINUOUS RECURSION (Scan ulang terus-menerus tanpa henti!)
    if (isLoopActiveRef.current) {
      loopTimeoutRef.current = setTimeout(() => {
        if (isLoopActiveRef.current) {
          scanLoopWorkerRef.current();
        }
      }, 450);
    }
  }, [captureAndDetect, onClose, onSuccess]);

  // Keep worker ref synced
  useEffect(() => {
    scanLoopWorkerRef.current = runScanCycle;
  }, [runScanCycle]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setScanStatus('idle');
    setStatusMessage('Memulai koneksi kamera...');
    setProgress(20);
    isLoopActiveRef.current = true;

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
          setProgress(40);
          setScanStatus('searching');
          
          // Langsung jalankan continuous scan loop otomatis
          if (isLoopActiveRef.current) {
            setTimeout(() => {
              scanLoopWorkerRef.current();
            }, 300);
          }
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka kamera.';
      setCameraError(msg);
      setScanStatus('error');
      setStatusMessage('Gagal membuka kamera.');
      isLoopActiveRef.current = false;
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
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
    }
    isLoopActiveRef.current = true;
    scanLoopWorkerRef.current();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[420px] rounded-3xl bg-slate-900/95 border border-slate-700/60 shadow-2xl p-6 text-white space-y-5 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Hidden Canvas for Frame Extraction & CV Detection */}
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
                className={`absolute w-[68%] h-[82%] rounded-[50%] border-2 pointer-events-none transition-all duration-300 flex items-center justify-center ${
                  scanStatus === 'success'
                    ? 'border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.85)] scale-105'
                    : scanStatus === 'scanning'
                    ? 'border-orange-500 shadow-[0_0_25px_rgba(255,107,0,0.65)] animate-pulse'
                    : scanStatus === 'no_face'
                    ? 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                    : 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                }`}
              >
                {/* Horizontal Laser Scanning Line (Sweeps up/down continuously during search) */}
                {scanStatus !== 'success' && !cameraError && (
                  <div className="absolute inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-pulse opacity-85" />
                )}
              </div>

              {/* Center Status Icon Overlay Badge */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {(scanStatus === 'unrecognized' || scanStatus === 'no_face') && (
                  <div className="w-16 h-16 rounded-full bg-rose-600/75 backdrop-blur-md border border-rose-400/80 flex items-center justify-center shadow-[0_0_30px_rgba(225,29,72,0.7)] animate-in zoom-in-75 duration-150">
                    {scanStatus === 'no_face' ? (
                      <UserX className="w-8 h-8 text-white stroke-[2.5]" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-white stroke-[2.5]" />
                    )}
                  </div>
                )}

                {scanStatus === 'scanning' && (
                  <div className="w-16 h-16 rounded-full bg-orange-600/75 backdrop-blur-md border border-orange-400/80 flex items-center justify-center shadow-[0_0_30px_rgba(255,107,0,0.7)] animate-spin duration-700">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                )}

                {scanStatus === 'success' && (
                  <div className="w-20 h-20 rounded-full bg-emerald-600/90 backdrop-blur-md border-2 border-emerald-300 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.95)] animate-in zoom-in-90 duration-300">
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
                    : (scanStatus === 'unrecognized' || scanStatus === 'no_face')
                    ? 'bg-rose-500 animate-pulse'
                    : 'bg-slate-400'
                }`} 
              />
              <span className={`truncate ${
                scanStatus === 'success'
                  ? 'text-emerald-400 font-bold'
                  : (scanStatus === 'unrecognized' || scanStatus === 'no_face')
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
              className={`h-full rounded-full transition-all duration-200 ${
                scanStatus === 'success'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : scanStatus === 'scanning'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                  : 'bg-gradient-to-r from-rose-500 to-pink-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Continuous Scanning Active Indicator Badge */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-orange-400 font-bold pt-1">
            <Activity className="w-3.5 h-3.5 animate-pulse text-orange-400" />
            <span>AI Real Face Scanner (Memvalidasi keberadaan wajah asli)</span>
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="space-y-2.5 pt-1">
          
          {/* Main Primary Action Button */}
          <button
            type="button"
            onClick={handleManualTrigger}
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
              onClick={handleManualTrigger}
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
