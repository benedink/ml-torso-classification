import { useRef, useEffect, useState } from 'react';
import { Camera, StopCircle, PlayCircle } from 'lucide-react';

interface CameraFeedProps {
  onDetection?: (result: DetectionResult) => void;
}

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionEvidenceBox {
  type: string;
  label: string;
  confidence: number;
  box: DetectionBox;
}

export interface DetectionDetails {
  has_logo?: boolean;
  logo_conf?: number;
  ocr_match?: boolean;
  ocr_conf?: number;
  clip_label?: string;
  clip_conf?: number;
  roboflow_class?: string;
  roboflow_conf?: number;
  white_ratio?: number;
  classification_source?: string;
  confidence_source?: string;
}

export interface PersonDetection {
  person_index: number;
  stage: string;
  reason: string;
  confidence: number;
  status: 'ALLOWED' | 'NOT ALLOWED';
  boundingBox?: DetectionBox;
  type?: string; // e.g. 'logo', 'org_text', 'shape', etc
  evidenceBoxes?: DetectionEvidenceBox[];
  details?: DetectionDetails;
}

export interface DetectionResult {
  id: string;
  timestamp: Date;
  confidence: number;
  detectedObjects: string[]; // Still used for compatibility (reasons)
  imageData?: string;
  detections?: PersonDetection[];
}

export function mapBackendDetections(data: any): PersonDetection[] {
  if (Array.isArray(data?.detections)) {
    return data.detections
      .map((d: any) => ({
        ...d,
        status: d.status === 'ALLOWED' ? 'ALLOWED' : 'NOT ALLOWED',
      }))
      .sort((a, b) => a.person_index - b.person_index);
  }

  return [
    ...((data?.allowed || []).map((d: any) => ({ ...d, status: 'ALLOWED' as const }))),
    ...((data?.not_allowed || []).map((d: any) => ({ ...d, status: 'NOT ALLOWED' as const }))),
  ].sort((a, b) => a.person_index - b.person_index);
}

export function summarizeDetectionConfidence(detections: PersonDetection[]): number {
  if (detections.length === 0) {
    return 0;
  }

  const totalConfidence = detections.reduce((sum, detection) => {
    return sum + (detection.confidence || 0);
  }, 0);

  return totalConfidence / detections.length;
}

export async function requestDetection(image: string) {
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000') as string;

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image })
    });
  } catch (error) {
    throw new Error(`Could not reach the backend at ${apiUrl}. Start the Flask server and try again.`);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || `Detection request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export function CameraFeed({ onDetection }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectionActive, setDetectionActive] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  // Remove currentBoundingBox, use allDetections state for overlays
  const [allDetections, setAllDetections] = useState<PersonDetection[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      const currentStream = videoRef.current.srcObject as MediaStream | null;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setDetectionActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Ensure video plays once metadata is loaded
        if (videoRef.current.readyState >= 2) {
          // metadata already loaded
          videoRef.current.play().catch(err => {
            console.log('Play failed:', err);
          });
        } else {
          // wait for metadata
          const handleLoadedMetadata = () => {
            videoRef.current?.play().catch(err => {
              console.log('Play failed:', err);
            });
            videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        }
      }

      setError(null);
      setDetectionError(null);
      setIsStreaming(true);
    } catch (err) {
      setError('Camera access denied or not available');
      setIsStreaming(false);
      setDetectionActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    let detectionInterval: number | null = null;

    if (detectionActive && isStreaming) {
      detectionInterval = window.setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          const ctx = canvas.getContext('2d');

          if (ctx && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            // Convert canvas to base64 and send to backend
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

            // Call backend API
            requestDetection(imageBase64)
              .then(data => {
                // Process API response: allowed and not_allowed arrays
                const allDetections = mapBackendDetections(data);

                setAllDetections(allDetections);
                setDetectionError(null);

                if (allDetections.length > 0) {
                  const detectedObjects = allDetections.map(d => d.reason);
                  const resultConfidence = summarizeDetectionConfidence(allDetections);

                  const result: DetectionResult = {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date(),
                    confidence: resultConfidence,
                    detectedObjects,
                    imageData: imageBase64,
                    detections: allDetections
                  };

                  onDetection?.(result);
                }
              })
              .catch(err => {
                console.log('Detection API error:', err);
                setAllDetections([]);
                setDetectionError(err instanceof Error ? err.message : 'Detection request failed.');
              });
          }
        }
      }, 3000);
    } else {
      setAllDetections([]);
    }

    return () => {
      if (detectionInterval) {
        window.clearInterval(detectionInterval);
      }
    };
  }, [detectionActive, isStreaming, onDetection]);

  // Handle overlay rendering for all detections
  useEffect(() => {
    if (overlayCanvasRef.current && videoRef.current) {
      const canvas = overlayCanvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const renderOverlay = () => {
          if (!isStreaming) return;

          canvas.width = video.offsetWidth;
          canvas.height = video.offsetHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          allDetections.forEach(det => {
            const boxes = [
              ...(det.boundingBox
                ? [{
                    box: det.boundingBox,
                    type: 'person',
                    label: `${det.status}: ${det.reason}`,
                    confidence: det.confidence,
                  }]
                : []),
              ...((det.evidenceBoxes || [])
                .filter((evidence) => evidence.type !== 'garment')
                .map((evidence) => ({
                  box: evidence.box,
                  type: evidence.type,
                  label: evidence.label,
                  confidence: evidence.confidence,
                }))),
            ];

            boxes.forEach(({ box, type, label, confidence }) => {
              const scaleX = canvas.width / video.videoWidth;
              const scaleY = canvas.height / video.videoHeight;
              const x = box.x * scaleX;
              const y = box.y * scaleY;
              const width = box.width * scaleX;
              const height = box.height * scaleY;

              let color = det.status === 'NOT ALLOWED' ? '#ef4444' : '#10b981';
              if (type === 'logo') color = '#f59e0b';
              if (type === 'org_text') color = '#6366f1';

              ctx.strokeStyle = color;
              ctx.lineWidth = type === 'person' ? 3 : 2;
              ctx.strokeRect(x, y, width, height);

              const labelText = `P${det.person_index + 1} ${label} (${(confidence * 100).toFixed(1)}%)`;
              ctx.font = 'bold 14px Arial';
              const textWidth = ctx.measureText(labelText).width;
              const labelHeight = 24;
              const labelY = Math.max(0, y - labelHeight);

              ctx.fillStyle = color;
              ctx.fillRect(x, labelY, textWidth + 10, labelHeight);
              ctx.fillStyle = '#ffffff';
              ctx.fillText(labelText, x + 5, labelY + 16);
            });
          });

          requestAnimationFrame(renderOverlay);
        };

        const animationId = requestAnimationFrame(renderOverlay);
        return () => cancelAnimationFrame(animationId);
      }
    }
  }, [allDetections, isStreaming]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden aspect-video border-2 border-gray-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ display: isStreaming && !error ? 'block' : 'none', width: '100%', height: '100%' }}
          className="object-cover"
        />

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-400">
            <div className="text-center">
              <Camera className="w-16 h-16 mx-auto mb-2 opacity-50" />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        ) : !isStreaming ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Camera className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Camera Offline</p>
              <p className="text-sm mt-2">Click "Start Camera" to begin</p>
            </div>
          </div>
        ) : (
          <>
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
            {detectionActive && (
              <div className="absolute top-2 sm:top-4 right-2 sm:right-4 flex flex-col gap-2">
                <div className="bg-red-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-lg flex items-center gap-2 font-semibold text-xs sm:text-sm">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-full animate-pulse"></span>
                  LIVE DETECTION
                </div>
              </div>
            )}
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 bg-black bg-opacity-60 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs">
              Live Feed
            </div>
            {detectionError && (
              <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 max-w-[70%] rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-lg">
                {detectionError}
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex flex-wrap gap-3">
        {!isStreaming ? (
          <button
            onClick={startCamera}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all text-sm sm:text-base"
          >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            Start Camera
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all text-sm sm:text-base"
          >
            <StopCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            Stop Camera
          </button>
        )}

        <button
          disabled={!isStreaming}
          onClick={() => setDetectionActive(!detectionActive)}
          className={`flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all text-sm sm:text-base ${
            !isStreaming
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : detectionActive
              ? 'bg-red-100 text-red-600 border-2 border-red-600 hover:bg-red-200'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {detectionActive ? (
            <>
              <StopCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              Stop Detection
            </>
          ) : (
            <>
              <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              Start Detection
            </>
          )}
        </button>
      </div>
    </div>
  );
}
