'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '@/lib/api';
import { loadFaceApiModels } from '@/lib/faceApiLoader';
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
  ShieldCheck,
  UserCheck,
  ChevronRight
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
  face_descriptor?: string;
  face_photo?: string;
  face_registered_at?: string;
}

interface FaceIdLoginModalProps {
  isOpen: boolean;
  mode?: 'login' | 'register';
  userId?: string;
  targetUserId?: string;
  onClose: () => void;
  onSuccess: (user: UserSessionData | any) => void;
}

interface RegisteredEmbedding {
  user_id: string;
  username: string;
  role: string;
  grade?: string;
  descriptor: number[];
  photo?: string;
}

export default function FaceIdLoginModal({ 
  isOpen, 
  mode = 'login', 
  userId,
  targetUserId,
  onClose, 
  onSuccess 
}: FaceIdLoginModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDetectingRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const consecutiveMatchCountRef = useRef<number>(0);
  const latestDetectionRef = useRef<any>(null);

  // States
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const [statusMessage, setStatusMessage] = useState<string>('Memuat AI Neural Models...');
  const [hasFaceDetected, setHasFaceDetected] = useState<boolean>(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredEmbedding[]>([]);
  const [matchedUser, setMatchedUser] = useState<RegisteredEmbedding | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [successResult, setSuccessResult] = useState<any>(null);

  // Stop camera and loops cleanly
  const stopCamera = useCallback(() => {
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isDetectingRef.current = false;
    isSubmittingRef.current = false;
    latestDetectionRef.current = null;
    consecutiveMatchCountRef.current = 0;
  }, []);

  // Fetch registered descriptors from server
  const fetchRegisteredDescriptors = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/face-descriptors'));
      const data = await res.json();
      if (data.success && Array.isArray(data.embeddings)) {
        setRegisteredUsers(data.embeddings);
        return data.embeddings;
      }
    } catch (e) {
      console.warn('Failed to fetch face descriptors:', e);
    }
    return [];
  }, []);

  // Authenticate matched user
  const handleAuthenticateUser = useCallback(async (target: RegisteredEmbedding, score: number) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsCapturing(true);
    setStatusMessage(`Memverifikasi autentikasi ${target.username}...`);

    try {
      const res = await fetch(apiUrl('/api/auth/face-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: target.user_id,
          descriptor: target.descriptor,
          confidence: score
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        setSuccessResult(data.user);
        setStatusMessage(`✅ Selamat datang, ${data.user.username}!`);
        setTimeout(() => {
          stopCamera();
          onSuccess(data.user);
        }, 1000);
      } else {
        isSubmittingRef.current = false;
        setIsCapturing(false);
        setStatusMessage(data.message || 'Verifikasi biometrik gagal.');
      }
    } catch (err: any) {
      isSubmittingRef.current = false;
      setIsCapturing(false);
      setStatusMessage('Gagal menghubungi server untuk autentikasi.');
    }
  }, [stopCamera, onSuccess]);

  // Register face biometric
  const handleRegisterFace = async () => {
    if (isCapturing || isSubmittingRef.current) return;
    const activeUserId = userId || targetUserId;
    if (!activeUserId) {
      setStatusMessage('User ID tidak valid.');
      return;
    }

    const video = videoRef.current;
    if (!video || !window.faceapi) {
      setStatusMessage('Kamera atau AI belum siap.');
      return;
    }

    setIsCapturing(true);
    isSubmittingRef.current = true;
    setStatusMessage('Mengambil sampel biometrik wajah & snapshot...');

    try {
      let detection = latestDetectionRef.current;

      // If not cached, do a fresh single detection
      if (!detection) {
        detection = await window.faceapi
          .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (!detection || !detection.descriptor) {
        setIsCapturing(false);
        isSubmittingRef.current = false;
        setStatusMessage('⚠️ Wajah tidak terdeteksi! Pastikan wajah terlihat jelas di kamera.');
        return;
      }

      // Snapshot photo from video frame
      const snapCanvas = document.createElement('canvas');
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;
      snapCanvas.width = 320;
      snapCanvas.height = Math.round((vHeight / vWidth) * 320);
      const snapCtx = snapCanvas.getContext('2d');
      if (snapCtx) {
        snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
      }
      const imageBase64 = snapCanvas.toDataURL('image/jpeg', 0.85);
      const descriptorArray = Array.from(detection.descriptor);

      const res = await fetch(apiUrl('/api/user/face-register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeUserId,
          descriptor: descriptorArray,
          image_base64: imageBase64
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        setSuccessResult(data.user);
        setStatusMessage('✅ Face ID Berhasil Didaftarkan!');
        setTimeout(() => {
          stopCamera();
          onSuccess(data.user);
        }, 1000);
      } else {
        setIsCapturing(false);
        isSubmittingRef.current = false;
        setStatusMessage(data.message || 'Gagal mendaftarkan wajah.');
      }
    } catch (err: any) {
      setIsCapturing(false);
      isSubmittingRef.current = false;
      setStatusMessage('Error pendaftaran: ' + (err.message || 'Koneksi terputus'));
    }
  };

  // Start Face Recognition Loop
  const startDetectionLoop = useCallback((activeDescriptors: RegisteredEmbedding[]) => {
    if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);

    loopIntervalRef.current = setInterval(async () => {
      if (isDetectingRef.current || isSubmittingRef.current) return;
      if (!videoRef.current || !canvasRef.current || !window.faceapi) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const faceapi = window.faceapi;

      if (video.paused || video.ended || video.readyState < 2) return;

      isDetectingRef.current = true;

      try {
        const displaySize = { 
          width: video.clientWidth || 320, 
          height: video.clientHeight || 320 
        };
        faceapi.matchDimensions(canvas, displaySize);

        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          latestDetectionRef.current = detection;
          setHasFaceDetected(true);

          const resizedDetection = faceapi.resizeResults(detection, displaySize);
          faceapi.draw.drawDetections(canvas, resizedDetection);
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);

          if (mode === 'login') {
            const inputDesc = detection.descriptor;
            let bestMatch: RegisteredEmbedding | null = null;
            let minDistance = 0.60;

            const candidates = targetUserId 
              ? activeDescriptors.filter(d => d.user_id.toLowerCase() === targetUserId.toLowerCase())
              : activeDescriptors;

            for (const candidate of candidates) {
              const distance = faceapi.euclideanDistance(inputDesc, candidate.descriptor);
              if (distance < minDistance) {
                minDistance = distance;
                bestMatch = candidate;
              }
            }

            if (bestMatch) {
              const score = Math.round((1 - minDistance) * 100);
              setMatchedUser(bestMatch);
              setMatchScore(score);
              setStatusMessage(`Wajah Cocok: ${bestMatch.username} (${score}%)`);

              consecutiveMatchCountRef.current += 1;
              if (consecutiveMatchCountRef.current >= 2) {
                handleAuthenticateUser(bestMatch, score);
              }
            } else {
              consecutiveMatchCountRef.current = 0;
              setMatchedUser(null);
              setMatchScore(0);
              setStatusMessage(
                candidates.length === 0 
                  ? 'Belum ada wajah terdaftar di database.' 
                  : 'Wajah terdeteksi (Mencocokkan...)'
              );
            }
          } else {
            setStatusMessage('✓ Wajah Terdeteksi! Klik "Simpan Biometrik Wajah" di bawah.');
          }
        } else {
          setHasFaceDetected(false);
          consecutiveMatchCountRef.current = 0;
          if (mode === 'login') {
            setMatchedUser(null);
            setMatchScore(0);
          }
          setStatusMessage('Posisikan wajah Anda tepat di depan kamera...');
        }
      } catch (err) {
        // Frame drop tolerance
      } finally {
        isDetectingRef.current = false;
      }
    }, 250);
  }, [mode, targetUserId, handleAuthenticateUser]);

  // Start Camera Stream & Neural Models
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setModelError(null);
    setIsLoadingModels(true);
    setStatusMessage('Memuat AI Neural Models (face-api.js)...');
    setSuccessResult(null);
    setMatchedUser(null);
    setHasFaceDetected(false);

    // 1. Load Neural Models
    const modelsReady = await loadFaceApiModels();
    if (!modelsReady) {
      setIsLoadingModels(false);
      setModelError('Gagal memuat AI Model Face Recognition. Periksa koneksi jaringan.');
      return;
    }
    setIsLoadingModels(false);

    // 2. Fetch descriptors if login mode
    let descriptors: RegisteredEmbedding[] = [];
    if (mode === 'login') {
      descriptors = await fetchRegisteredDescriptors();
    }

    // 3. Request Camera Stream
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Akses kamera tidak didukung di browser ini.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.warn('Autoplay prevented:', e));
          setStatusMessage('Kamera aktif. Arahkan wajah ke layar...');
          startDetectionLoop(descriptors);
        };
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka kamera.';
      setCameraError(msg);
      setStatusMessage('Gagal membuka kamera.');
    }
  }, [mode, facingMode, stopCamera, fetchRegisteredDescriptors, startDetectionLoop]);

  // Open / Close lifecycle
  useEffect(() => {
    if (isOpen) {
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

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[440px] rounded-3xl bg-slate-950/95 border border-slate-700/80 shadow-2xl p-5 sm:p-6 text-white space-y-4 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Glow Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#FF6B00]/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[#FF6B00] shadow-md shadow-orange-500/10">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                  {mode === 'register' ? 'AI Face ID Registration' : 'AI Face ID Login'}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 font-mono">
                  TensorFlow
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                <Zap className="w-3 h-3 text-orange-400" />
                {mode === 'register' ? 'Pemindaian 68 titik landmark neural' : 'Verifikasi biometrik 128-d instan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleFacingMode}
              title="Ganti Kamera"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50 cursor-pointer"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              title="Tutup"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700/50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewfinder Box */}
        <div className="relative w-full aspect-square max-w-[340px] mx-auto rounded-3xl overflow-hidden bg-black border-2 border-slate-700/80 shadow-2xl flex items-center justify-center group">
          
          {isLoadingModels ? (
            <div className="p-6 text-center space-y-3 z-10">
              <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-orange-300 font-bold leading-relaxed">{statusMessage}</p>
              <p className="text-[10px] text-slate-400">Memuat TinyFace &amp; ResNet-34 neural weights...</p>
            </div>
          ) : modelError || cameraError ? (
            <div className="p-6 text-center space-y-3 z-10">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
              <p className="text-xs text-rose-300 font-medium leading-relaxed">{modelError || cameraError}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition-all inline-flex items-center gap-1.5 cursor-pointer"
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
                className="w-full h-full object-cover transform scale-x-[-1]"
              />

              {/* Canvas Overlay for Detections & Landmarks */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none transform scale-x-[-1]"
              />

              {/* Status Badge Top Left */}
              <div className="absolute top-3 left-3 z-20">
                <span className="badge bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[10px] font-bold px-2.5 py-1 rounded-full text-slate-200 flex items-center gap-1.5 shadow">
                  <span className={`w-2 h-2 rounded-full ${hasFaceDetected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{hasFaceDetected ? 'FACE DETECTED' : 'SCANNING...'}</span>
                </span>
              </div>

              {/* Match Score Badge Top Right (Login mode) */}
              {mode === 'login' && matchedUser && (
                <div className="absolute top-3 right-3 z-20 animate-in zoom-in-95">
                  <span className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-1 rounded-full text-emerald-300 flex items-center gap-1 shadow">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Match {matchScore}%</span>
                  </span>
                </div>
              )}

              {/* Viewfinder Target Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className={`w-[200px] h-[250px] rounded-[100px] border-2 border-dashed transition-colors duration-300 ${
                  hasFaceDetected ? 'border-emerald-400/60 shadow-lg shadow-emerald-500/10' : 'border-orange-400/40 animate-pulse'
                }`} />
              </div>
            </>
          )}

          {/* Success Overlay Flash */}
          {successResult && (
            <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-2.5 z-30 animate-in fade-in zoom-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-xl shadow-emerald-900/50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-extrabold text-white">
                {mode === 'register' ? 'Pendaftaran Sukses!' : 'Autentikasi Berhasil!'}
              </h4>
              <p className="text-xs text-emerald-200 font-medium">
                {successResult.username} ({successResult.id})
              </p>
            </div>
          )}
        </div>

        {/* Results & Actions Section */}
        <div className="space-y-3">
          
          {/* Status Message Text */}
          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 text-center">
            <p className="text-xs font-semibold text-slate-200 leading-snug">
              {statusMessage}
            </p>
          </div>

          {/* Matched User Card (Login Mode) */}
          {mode === 'login' && matchedUser && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-3">
                {matchedUser.photo ? (
                  <img
                    src={matchedUser.photo}
                    alt={matchedUser.username}
                    className="w-10 h-10 rounded-xl object-cover border border-emerald-500/40 shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="text-xs font-extrabold text-white">{matchedUser.username}</div>
                  <div className="text-[10px] text-emerald-300 font-medium">ID: {matchedUser.user_id} • {matchedUser.role}</div>
                </div>
              </div>

              <button
                onClick={() => handleAuthenticateUser(matchedUser, matchScore)}
                disabled={isCapturing}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-emerald-950/40 cursor-pointer"
              >
                <span>Masuk</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Action Button for Register Mode */}
          {mode === 'register' && (
            <button
              onClick={handleRegisterFace}
              disabled={isCapturing || isLoadingModels || !!cameraError}
              className={`w-full py-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${
                hasFaceDetected 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40' 
                  : 'bg-gradient-to-r from-[#FF6B00] to-[#E05600] text-white hover:from-[#E05600] hover:to-[#C04600] shadow-orange-950/40'
              }`}
            >
              {isCapturing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan Biometrik Wajah...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>{hasFaceDetected ? 'Simpan Biometrik Wajah Sekarang' : 'Posisikan Wajah & Simpan'}</span>
                </>
              )}
            </button>
          )}

          {/* Fallback button for Login Mode if user wants manual trigger */}
          {mode === 'login' && !matchedUser && (
            <button
              onClick={() => {
                if (registeredUsers.length > 0) {
                  setStatusMessage('Mencocokkan wajah dengan seluruh data karyawan...');
                }
              }}
              disabled={isLoadingModels || !!cameraError}
              className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ScanFace className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Pindai Wajah Manual</span>
            </button>
          )}

        </div>

      </div>
    </div>
  );
}
