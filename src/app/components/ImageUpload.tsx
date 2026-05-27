import { useRef, useState, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { DetectionResult, PersonDetection } from './CameraFeed';

interface ImageUploadProps {
  onUpload?: (result: DetectionResult) => void;
}

export default function ImageUpload({ onUpload }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setPreviewImage(imageData);
      setIsProcessing(true);
      setDetectionResult(null);

      try {
        // Call backend API for detection
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/detect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Process API response: allowed and not_allowed arrays
        const allDetections: PersonDetection[] = [
          ...(data.allowed || []).map((d: any) => ({ ...d, status: 'ALLOWED' })),
          ...(data.not_allowed || []).map((d: any) => ({ ...d, status: 'NOT ALLOWED' }))
        ];

        if (allDetections.length === 0) {
          throw new Error('No people detected in image');
        }

        const firstDet = allDetections[0];
        const detectedObjects = allDetections.map(d => d.reason);
        const avgConfidence = allDetections.reduce((acc, d) => acc + d.confidence, 0) / allDetections.length;

        const result: DetectionResult = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date(),
          confidence: avgConfidence,
          detectedObjects,
          imageData,
          detections: allDetections,
          boundingBox: {
            x: 0.3,
            y: 0.2,
            width: 0.4,
            height: 0.5
          }
        };

        setDetectionResult(result);
        onUpload?.(result);
      } catch (error) {
        console.error('Detection error:', error);
        // Display backend error or fallback simply as "NOT ALLOWED"
        const mockReason = "NOT ALLOWED";
        const confidence = 0.0;

        const mockResult: DetectionResult = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date(),
          confidence,
          detectedObjects: [mockReason],
          imageData,
          detections: [{
            person_index: 0,
            stage: "System Error",
            reason: mockReason,
            confidence,
            status: 'NOT ALLOWED'
          }],
          boundingBox: {
            x: 0.3,
            y: 0.2,
            width: 0.4,
            height: 0.5
          }
        };

        setDetectionResult(mockResult);
        onUpload?.(mockResult);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsDataURL(file);
  };

  // Draw bounding box on preview
  useEffect(() => {
    if (canvasRef.current && previewImage && detectionResult && !isProcessing) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        if (ctx) {
          ctx.drawImage(img, 0, 0);

          const box = detectionResult.boundingBox;
          if (box) {
            const x = box.x * img.width;
            const y = box.y * img.height;
            const width = box.width * img.width;
            const height = box.height * img.height;

            // Determine color
            let color = '#10b981';
            const label = detectionResult.detectedObjects?.[0] || "";
            const lowLabel = label.toLowerCase();
            if (lowLabel.includes('civilian') || lowLabel.includes('violation') || lowLabel.includes('not white') || lowLabel.includes('error') || lowLabel.includes('not allowed')) {
              color = '#ef4444';
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            const labelText = `${label} (${(detectionResult.confidence * 100).toFixed(1)}%)`;
            ctx.font = 'bold 20px Arial';
            const textWidth = ctx.measureText(labelText).width;
            const padding = 12;

            ctx.fillStyle = color;
            ctx.fillRect(x, y - 40, textWidth + padding * 2, 40);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelText, x + padding, y - 12);
          }
        }
      };

      img.src = previewImage;
    }
  }, [previewImage, detectionResult, isProcessing]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const fakeEvent = {
        target: { files: [file] }
      } as ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const clearUpload = () => {
    setPreviewImage(null);
    setDetectionResult(null);
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!previewImage ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-3 border-dashed rounded-xl p-6 sm:p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#505081] bg-[#8686AC]/10 scale-105'
              : 'border-gray-300 hover:border-[#505081] hover:bg-[#8686AC]/5'
          }`}
        >
          <Upload className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 transition-colors ${
            isDragging ? 'text-[#505081]' : 'text-gray-400'
          }`} />
          <p className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
            {isDragging ? 'Drop image here' : 'Click to upload or drag and drop'}
          </p>
          <p className="text-xs sm:text-sm text-gray-500">PNG, JPG, JPEG up to 10MB</p>
          <p className="text-xs text-gray-400 mt-1 sm:mt-2">Image will be analyzed for uniform compliance</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden border-2 border-gray-700">
            {isProcessing ? (
              <>
                <img src={previewImage} alt="Preview" className="w-full h-auto opacity-50" />
                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4">
                  <div className="text-white text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3 sm:mb-4"></div>
                    <p className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Analyzing Image...</p>
                    <p className="text-xs sm:text-sm text-gray-300">AI model processing uniform classification</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <canvas ref={canvasRef} className="w-full h-auto" />
                <button
                  onClick={clearUpload}
                  className="absolute top-2 sm:top-3 right-2 sm:right-3 p-2 sm:p-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </>
            )}
          </div>

          {detectionResult && !isProcessing && (
            <div className={`rounded-xl p-4 sm:p-5 border-l-4 shadow-lg ${
              detectionResult.detections?.some(d => d.status === 'ALLOWED')
                ? 'bg-green-50 border-green-500'
                : 'bg-red-50 border-red-500'
            }`}>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-full flex-shrink-0 ${
                  detectionResult.detections?.some(d => d.status === 'ALLOWED')
                    ? 'bg-green-100'
                    : 'bg-red-100'
                }`}>
                  {detectionResult.detections?.some(d => d.status === 'ALLOWED') ? (
                    <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
                    {detectionResult.detectedObjects?.[0] || "No Objects Detected"}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                    Confidence: <span className="font-semibold">{(detectionResult.confidence * 100).toFixed(1)}%</span>
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        detectionResult.confidence > 0.8 ? 'bg-green-500' :
                        detectionResult.confidence > 0.6 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${detectionResult.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
