import { useState, useEffect } from 'react';
import { CameraFeed, DetectionResult } from './components/CameraFeed';
import ImageUpload from './components/ImageUpload';
import { DetectionResults } from './components/DetectionResults';
import { DetectionStatusPanel } from './components/DetectionStatusPanel';
import { Monitor, BarChart3, Shield, X, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'detectionHistory';

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'results'>('monitor');
  const [detectionHistory, setDetectionHistory] = useState<DetectionResult[]>([]);
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const restored = parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp)
          }));
          setDetectionHistory(restored);
        }
      } catch (err) {
        console.log('Failed to load detection history:', err);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(detectionHistory));
  }, [detectionHistory]);

  const handleDetection = (result: DetectionResult) => {
    setDetectionHistory(prev => [...prev, result]);
    setCurrentDetection(result);
  };

  const removeDetection = (id: string) => {
    setDetectionHistory(prev => prev.filter(item => item.id !== id));
    setCurrentDetection(prev => (prev?.id === id ? null : prev));
  };

  const clearAllDetections = () => {
    if (window.confirm('Clear all detection history? This cannot be undone.')) {
      setDetectionHistory([]);
      setCurrentDetection(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-gradient-to-r from-[#0F0E47] to-[#272757] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white rounded-full p-2 sm:p-3 shadow-md flex-shrink-0">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-[#272757]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-white leading-tight">
                School Uniform Compliance Detection System
              </h1>
              <p className="text-xs sm:text-sm text-[#8686AC] mt-0.5 sm:mt-1 hidden sm:block">
                AI-Powered Upper Garment Classification & Monitoring
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-6">
          <div className="flex gap-2 sm:gap-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 border-b-3 transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'monitor'
                  ? 'border-[#505081] text-[#272757] bg-[#8686AC]/10'
                  : 'border-transparent text-gray-600 hover:text-[#272757] hover:bg-gray-50'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <span className="font-medium text-sm sm:text-base">Monitor</span>
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 border-b-3 transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'results'
                  ? 'border-[#505081] text-[#272757] bg-[#8686AC]/10'
                  : 'border-transparent text-gray-600 hover:text-[#272757] hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium text-sm sm:text-base">Analytics</span>
              {detectionHistory.length > 0 && (
                <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-[#505081] text-white text-xs font-semibold rounded-full">
                  {detectionHistory.length}
                </span>
              )}
            </button>
            {detectionHistory.length > 0 && (
              <button
                onClick={clearAllDetections}
                className="flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 text-red-600 hover:text-red-700 hover:bg-red-50 transition-all border-b-3 border-transparent"
                title="Clear all detection history"
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-medium text-xs sm:text-sm hidden sm:inline">Clear History</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className={activeTab === 'monitor' ? 'block' : 'hidden'}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#272757] to-[#505081] px-4 sm:px-6 py-3 sm:py-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                    <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
                    Live Camera Feed
                  </h2>
                </div>
                <div className="p-4 sm:p-6">
                  <CameraFeed onDetection={handleDetection} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#505081] to-[#272757] px-4 sm:px-6 py-3 sm:py-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                    Upload Image for Detection
                  </h2>
                </div>
                <div className="p-4 sm:p-6">
                  <ImageUpload onUpload={handleDetection} />
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <DetectionStatusPanel detection={currentDetection} />

              <div className="bg-white rounded-xl shadow-lg overflow-hidden sticky top-6">
                <div className="bg-gradient-to-r from-[#0F0E47] to-[#272757] px-6 py-4">
                  <h2 className="text-lg font-semibold text-white">Detection History</h2>
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  <div className="space-y-3">
                    {detectionHistory.length === 0 ? (
                      <div className="text-center py-8">
                        <Shield className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-400 text-sm">No detections yet</p>
                        <p className="text-gray-400 text-xs mt-1">Start camera or upload image</p>
                      </div>
                    ) : (
                      detectionHistory.slice().reverse().map((result) => {
                        const detections = result.detections || [];
                        const isViolation = detections.some((d) => d.status === 'NOT ALLOWED');

                        return (
                          <div
                            key={result.id}
                            className={`p-3 rounded-lg border-l-4 shadow-sm ${
                              isViolation ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] text-gray-600 font-medium">
                                {result.timestamp.toLocaleTimeString()}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  result.confidence > 0.8 ? 'bg-green-100 text-green-700' :
                                  result.confidence > 0.6 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {(result.confidence * 100).toFixed(0)}%
                                </span>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeDetection(result.id);
                                  }}
                                  className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              {detections.map((det, idx) => (
                                <span
                                  key={idx}
                                  className={`text-xs font-semibold ${
                                    det.status === 'NOT ALLOWED' ? 'text-red-700' : 'text-green-700'
                                  }`}
                                >
                                  Person {det.person_index + 1}: {det.status} - {det.reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={activeTab === 'results' ? 'block' : 'hidden'}>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#505081] to-[#0F0E47] px-4 sm:px-6 py-3 sm:py-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-white">Detection Analytics & Statistics</h2>
            </div>
            <div className="p-4 sm:p-6">
              <DetectionResults
                results={detectionHistory}
                onRemoveResult={removeDetection}
                onClearHistory={clearAllDetections}
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gradient-to-r from-[#0F0E47] to-[#272757] text-white mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-center">
            <div className="flex items-center gap-2 sm:gap-3 text-center">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-[#8686AC] flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm sm:text-base">School Uniform Compliance System</p>
                <p className="text-xs sm:text-sm text-[#8686AC]">Powered by AI Deep Learning Technology</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
