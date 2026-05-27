import { CheckCircle, XCircle, AlertCircle, Scan } from 'lucide-react';
import type { DetectionResult } from './CameraFeed';

interface DetectionStatusPanelProps {
  detection: DetectionResult | null;
}

export function DetectionStatusPanel({ detection }: DetectionStatusPanelProps) {
  if (!detection) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#272757] to-[#505081] px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">Current Detection Status</h2>
        </div>
        <div className="p-6 sm:p-8 text-center">
          <Scan className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 mb-3 sm:mb-4" />
          <p className="text-gray-400 font-medium text-sm sm:text-base">No Active Detection</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">Waiting for detection...</p>
        </div>
      </div>
    );
  }

  // Use the detections array directly from backend
  const allDetections = detection.detections || [];
  const isViolation = allDetections.some(d => d.status === 'NOT ALLOWED');
  const isAllowed = !isViolation && allDetections.length > 0;
  
  let statusConfig = {
    icon: AlertCircle,
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-800',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    title: 'Detection Result',
    message: 'Processing detection data...'
  };

  if (isAllowed) {
    statusConfig = {
      icon: CheckCircle,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
      textColor: 'text-green-800',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      title: 'ALLOWED',
      message: 'Student is wearing proper school uniform'
    };
  } else if (isViolation) {
    statusConfig = {
      icon: XCircle,
      color: 'red',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
      textColor: 'text-red-800',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      title: 'NOT ALLOWED',
      message: 'Student is not wearing proper school uniform'
    };
  }

  const StatusIcon = statusConfig.icon;
  const averageConfidence = allDetections.length > 0
    ? allDetections.reduce((sum, det) => sum + det.confidence, 0) / allDetections.length
    : detection.confidence;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-[#272757] to-[#505081] px-4 sm:px-6 py-3 sm:py-4">
        <h2 className="text-base sm:text-lg font-semibold text-white">Current Detection Status</h2>
      </div>
      <div className={`p-4 sm:p-6 ${statusConfig.bgColor} border-l-4 ${statusConfig.borderColor}`}>
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`${statusConfig.iconBg} p-2 sm:p-3 rounded-full flex-shrink-0`}>
            <StatusIcon className={`w-6 h-6 sm:w-8 sm:h-8 ${statusConfig.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg sm:text-xl font-bold ${statusConfig.textColor} mb-1`}>
              {statusConfig.title}
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-gray-600">Average Person Confidence</span>
                  <span className={`text-sm font-bold ${statusConfig.textColor}`}>
                    {(averageConfidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 sm:h-2.5">
                  <div
                    className={`h-2 sm:h-2.5 rounded-full ${
                      averageConfidence > 0.8 ? 'bg-green-500' :
                      averageConfidence > 0.6 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${averageConfidence * 100}%` }}
                  />
                </div>
              </div>


              <div>
                <span className="text-xs font-semibold text-gray-600 block mb-2">Detected Persons & Classification</span>
                <div className="flex flex-col gap-2">
                  {allDetections.map((det, idx) => (
                    <div key={idx} className="bg-white bg-opacity-50 p-2 rounded border border-gray-100 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Person #{det.person_index + 1}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          det.status === 'ALLOWED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {det.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium">Reason:</span> <span>{det.reason}</span>
                        <span className="text-gray-700">|</span>
                        <span className="font-medium">Confidence:</span> <span>{(det.confidence * 100).toFixed(1)}%</span>
                      </div>
                      {det.details?.confidence_source && (
                        <div className="mt-1 text-[11px] text-gray-500">
                          Confidence source: {det.details.confidence_source}
                        </div>
                      )}
                      {det.evidenceBoxes && det.evidenceBoxes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {det.evidenceBoxes.map((evidence, evidenceIdx) => (
                            <span
                              key={evidenceIdx}
                              className="text-[10px] rounded-full bg-slate-100 text-slate-700 px-2 py-1 font-medium"
                            >
                              {evidence.type}: {evidence.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  Detected at {detection.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
