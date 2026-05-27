import { useRef, useState, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { Upload, X, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { mapBackendDetections, requestDetection, summarizeDetectionConfidence, type DetectionResult, type PersonDetection } from './CameraFeed';

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const hasViolation = (detectionResult?.detections || []).some((d) => d.status === 'NOT ALLOWED');
  const allAllowed = (detectionResult?.detections || []).length > 0 && !hasViolation;

  const processFile = async (file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setPreviewImage(imageData);
      setIsProcessing(true);
      setDetectionResult(null);
      setUploadError(null);

      try {
        const data = await requestDetection(imageData);

        // Process API response: allowed and not_allowed arrays
        const allDetections = mapBackendDetections(data);

        if (allDetections.length === 0) {
          throw new Error('No people were detected in this image.');
        }

        const detectedObjects = allDetections.map(d => d.reason);
        const resultConfidence = summarizeDetectionConfidence(allDetections);

        const result: DetectionResult = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date(),
          confidence: resultConfidence,
          detectedObjects,
          imageData,
          detections: allDetections,
        };

        setDetectionResult(result);
        onUpload?.(result);
      } catch (error) {
        console.error('Detection error:', error);
        setDetectionResult(null);
        setUploadError(error instanceof Error ? error.message : 'Image analysis failed.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processFile(file);
    event.target.value = '';
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

          (detectionResult.detections || []).forEach((det) => {
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
              let color = det.status === 'NOT ALLOWED' ? '#ef4444' : '#10b981';
              if (type === 'logo') color = '#f59e0b';
              if (type === 'org_text') color = '#6366f1';

              ctx.strokeStyle = color;
              ctx.lineWidth = type === 'person' ? 4 : 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              const labelText = `P${det.person_index + 1} ${label} (${(confidence * 100).toFixed(1)}%)`;
              ctx.font = 'bold 18px Arial';
              const textWidth = ctx.measureText(labelText).width;
              const padding = 10;
              const labelY = Math.max(0, box.y - 32);

              ctx.fillStyle = color;
              ctx.fillRect(box.x, labelY, textWidth + padding * 2, 32);
              ctx.fillStyle = '#ffffff';
              ctx.fillText(labelText, box.x + padding, labelY + 21);
            });
          });
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
      void processFile(file);
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
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReupload = () => {
    fileInputRef.current?.click();
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

          {uploadError && !isProcessing && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {uploadError}
            </div>
          )}

          {detectionResult && !isProcessing && (
            <div className="space-y-3">
              <div className={`rounded-xl p-4 sm:p-5 border-l-4 shadow-lg ${
                allAllowed
                  ? 'bg-green-50 border-green-500'
                  : 'bg-red-50 border-red-500'
              }`}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`p-2 sm:p-3 rounded-full flex-shrink-0 ${
                    allAllowed
                      ? 'bg-green-100'
                      : 'bg-red-100'
                  }`}>
                    {allAllowed ? (
                      <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
                      {allAllowed ? 'All detected people are allowed' : 'One or more detected people are not allowed'}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                      Confidence: <span className="font-semibold">{(detectionResult.confidence * 100).toFixed(1)}%</span>
                    </p>
                    <div className="mb-3 flex flex-col gap-2">
                      {detectionResult.detections?.map((det, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium ${
                            det.status === 'ALLOWED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          Person {det.person_index + 1}: {det.status} - {det.reason}
                        </div>
                      ))}
                    </div>
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

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={clearUpload}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  Scan Another Image
                </button>
                <button
                  type="button"
                  onClick={handleReupload}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#505081] bg-white px-4 py-3 text-sm font-semibold text-[#272757] transition-colors hover:bg-[#8686AC]/10"
                >
                  <Upload className="h-4 w-4" />
                  Re-upload
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
