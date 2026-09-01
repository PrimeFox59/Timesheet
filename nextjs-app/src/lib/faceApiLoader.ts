import { apiUrl } from './api';

declare global {
  interface Window {
    faceapi: any;
  }
}

let modelsLoadingPromise: Promise<boolean> | null = null;
let scriptLoadingPromise: Promise<any> | null = null;

const ONLINE_MODEL_URLS = [
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'
];

/**
 * Load face-api.min.js script dynamically in browser
 */
export function loadFaceApiScript(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is undefined'));
  if (window.faceapi) return Promise.resolve(window.faceapi);
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    // Check if script element already exists
    const existingScript = document.getElementById('face-api-script') as HTMLScriptElement;
    if (existingScript) {
      if (window.faceapi) {
        resolve(window.faceapi);
        return;
      }
      existingScript.addEventListener('load', () => resolve(window.faceapi));
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'face-api-script';
    script.src = apiUrl('/vendor/face-api.min.js');
    script.async = true;
    script.onload = () => {
      if (window.faceapi) {
        resolve(window.faceapi);
      } else {
        reject(new Error('faceapi object not found on window after script load'));
      }
    };
    script.onerror = (err) => {
      // Fallback: try loading from CDN if local vendor script fails
      console.warn('Local face-api.min.js failed to load, trying CDN fallback...', err);
      const cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
      cdnScript.async = true;
      cdnScript.onload = () => resolve(window.faceapi);
      cdnScript.onerror = (cdnErr) => reject(cdnErr);
      document.head.appendChild(cdnScript);
    };

    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Load Neural Network weights for TinyFaceDetector, FaceLandmark68Net, FaceRecognitionNet
 */
export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    const faceapi = await loadFaceApiScript();
    if (!faceapi) return false;

    // Check if already loaded
    if (
      faceapi.nets.tinyFaceDetector.isLoaded &&
      faceapi.nets.faceLandmark68Net.isLoaded &&
      faceapi.nets.faceRecognitionNet.isLoaded
    ) {
      return true;
    }

    // 1. Try local models path first
    const localModelUrl = apiUrl('/models');
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(localModelUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(localModelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(localModelUrl)
      ]);
      console.log('✅ Face AI Neural Models loaded successfully from local static assets!');
      return true;
    } catch (localErr) {
      console.warn('⚠️ Local model loading failed, trying fallback CDN...', localErr);
    }

    // 2. Try online CDN fallbacks if local fails
    for (const cdnUrl of ONLINE_MODEL_URLS) {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(cdnUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(cdnUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(cdnUrl)
        ]);
        console.log(`✅ Face AI Neural Models loaded from CDN: ${cdnUrl}`);
        return true;
      } catch (cdnErr) {
        console.warn(`CDN model loading failed from ${cdnUrl}:`, cdnErr);
      }
    }

    return false;
  })();

  return modelsLoadingPromise;
}
