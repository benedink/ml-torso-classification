import { useState, useMemo } from 'react';
import { Activity, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, PieChart, Trash2 } from 'lucide-react';
import { BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DetectionResult } from './CameraFeed';

interface DetectionResultsProps {
  results: DetectionResult[];
  onRemoveResult?: (id: string) => void;
  onClearHistory?: () => void;
}

const COLORS = {
  'ALLOWED': '#10b981',
  'NOT ALLOWED': '#ef4444'
};

export function DetectionResults({ results, onRemoveResult, onClearHistory }: DetectionResultsProps) {
  const [selectedResult, setSelectedResult] = useState<DetectionResult | null>(null);

  const stats = useMemo(() => {
    const allDetections = results.flatMap(r => r.detections || []);
    
    const allowed = allDetections.filter((d) => d.status === 'ALLOWED').length;
    
    const violations = allDetections.filter((d) => d.status === 'NOT ALLOWED').length;

    const avgConfidence = results.length > 0
      ? results.reduce((acc, r) => acc + r.confidence, 0) / results.length
      : 0;

    // Count by Status for Pie Chart
    const statusCounts = {
      'ALLOWED': allowed,
      'NOT ALLOWED': violations
    };

    const pieData = Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value
    }));

    // Rejection Reasons Breakdown
    const rejectionCounts: Record<string, number> = {};
    allDetections.filter(d => d.status === 'NOT ALLOWED').forEach(d => {
      let reason = d.reason.toLowerCase();
      if (reason.includes('dress')) reason = 'dress';
      else if (reason.includes('sleeveless')) reason = 'sleeveless';
      else if (reason.includes('violation')) reason = 'violation';
      else if (reason.includes('civilian shirt')) reason = 'civilian shirt';
      else if (reason.includes('dark')) reason = 'dark garment';
      else if (reason.includes('white')) reason = 'not white enough';
      
      rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
    });

    const rejectionData = Object.entries(rejectionCounts).map(([name, value]) => ({
      name,
      count: value
    })).sort((a, b) => b.count - a.count);

    return {
      total: results.length,
      totalPeople: allDetections.length,
      allowed,
      violations,
      avgConfidence,
      pieData,
      rejectionData,
      complianceRate: allDetections.length > 0 ? (allowed / allDetections.length) * 100 : 0
    };
  }, [results]);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-[#272757] to-[#505081] text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-xs sm:text-sm opacity-90">Total Scans</p>
              <p className="text-2xl sm:text-4xl font-bold">{stats.total}</p>
            </div>
          </div>
          <div className="text-xs opacity-75 hidden sm:block">{stats.totalPeople} people detected</div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-xs sm:text-sm opacity-90">Allowed</p>
              <p className="text-2xl sm:text-4xl font-bold">{stats.allowed}</p>
            </div>
          </div>
          <div className="text-xs opacity-75 hidden sm:block">
            {stats.complianceRate.toFixed(1)}% rate
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <XCircle className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-xs sm:text-sm opacity-90">Not Allowed</p>
              <p className="text-2xl sm:text-4xl font-bold">{stats.violations}</p>
            </div>
          </div>
          <div className="text-xs opacity-75 hidden sm:block">Non-compliant</div>
        </div>

        <div className="bg-gradient-to-br from-[#505081] to-[#0F0E47] text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-xs sm:text-sm opacity-90">Avg Confidence</p>
              <p className="text-2xl sm:text-4xl font-bold">{(stats.avgConfidence * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div className="text-xs opacity-75 hidden sm:block">Model score</div>
        </div>
      </div>

      {/* Charts Section */}
      {results.length > 0 ? (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Status Distribution */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-[#505081]" />
              Allowed vs Not Allowed
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          {/* Rejection Reasons */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:col-span-1">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              Top Rejection Reasons
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.rejectionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {stats.rejectionData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="font-bold text-red-600">{item.name}</span>
                  <span className="text-gray-700">-</span>
                  <span className="font-medium">{item.count} times</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Detections Table */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:col-span-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600" />
              All Detected People
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 py-1 text-left font-semibold">Person #</th>
                    <th className="px-2 py-1 text-left font-semibold">Date & Time</th>
                    <th className="px-2 py-1 text-left font-semibold">Status</th>
                    <th className="px-2 py-1 text-left font-semibold">Confidence</th>
                    <th className="px-2 py-1 text-left font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {results.flatMap((r, i) =>
                    (r.detections || []).map((det, j) => (
                      <tr key={i + '-' + j} className="border-b last:border-b-0">
                        <td className="px-2 py-1">{det.person_index + 1}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{r.timestamp.toLocaleString()}</td>
                        <td className={`px-2 py-1 font-bold ${det.status === 'ALLOWED' ? 'text-green-600' : 'text-red-600'}`}>{det.status}</td>
                        <td className="px-2 py-1">{(det.confidence * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1">{det.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#505081]" />
                Previous Scans History
              </h3>
              {results.length > 0 && onClearHistory && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs sm:text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear History
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {results.slice().reverse().map((result) => {
              const isViolation = (result.detections || []).some((d) => d.status === 'NOT ALLOWED');
              const isAllowed = !isViolation && (result.detections || []).length > 0;

              return (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => setSelectedResult(result)}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                      <div
                        className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 mt-1 sm:mt-0 ${
                          isAllowed ? 'bg-green-500' :
                          isViolation ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-gray-600 font-medium truncate">
                            {result.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {result.detections?.map((det, idx) => (
                            <div
                              key={idx}
                              className={`rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium ${
                                det.status === 'ALLOWED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              <div>Person {det.person_index + 1}: {det.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center justify-end gap-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-0.5 sm:mb-1 hidden sm:block">Confidence</div>
                          <div
                            className={`text-sm sm:text-lg font-bold ${
                              result.confidence > 0.8 ? 'text-green-600' :
                              result.confidence > 0.6 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}
                          >
                            {(result.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                        {onRemoveResult && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveResult(result.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                onRemoveResult(result.id);
                              }
                            }}
                            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-lg px-4 sm:px-6 py-8 sm:py-12 text-center">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 mb-3 sm:mb-4" />
          <p className="text-gray-400 font-medium text-base sm:text-lg">No detections yet</p>
          <p className="text-gray-400 text-xs sm:text-sm mt-2">Start the camera or upload an image to begin</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedResult && (
        <div
          onClick={() => setSelectedResult(null)}
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-3 sm:p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="bg-gradient-to-r from-[#272757] to-[#505081] px-4 sm:px-6 py-4 sm:py-5 text-white">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-2xl font-bold">Detection Details</h3>
                  <p className="text-xs sm:text-sm text-[#8686AC] mt-1 truncate">{selectedResult.timestamp.toLocaleString()}</p>
                </div>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {selectedResult.imageData && (
                <img
                  src={selectedResult.imageData}
                  alt="Detection"
                  className="w-full rounded-lg mb-4 sm:mb-6 border-2 border-gray-200"
                />
              )}

              <div className="space-y-4 sm:space-y-5">
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="text-xs sm:text-sm font-semibold text-gray-600 mb-2">Confidence Score</div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2.5 sm:h-3">
                      <div
                        className={`h-2.5 sm:h-3 rounded-full ${
                          selectedResult.confidence > 0.8 ? 'bg-green-500' :
                          selectedResult.confidence > 0.6 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${selectedResult.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-gray-800 flex-shrink-0">
                      {(selectedResult.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs sm:text-sm font-semibold text-gray-600 mb-2 sm:mb-3">Classification Result</div>
                  <div className="space-y-3">
                    {selectedResult.detections?.map((det, idx) => (
                      <div key={idx} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-gray-500 uppercase">Person #{det.person_index + 1}</span>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            det.status === 'ALLOWED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {det.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">{det.reason}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(det.confidence * 100).toFixed(1)}% confidence
                        </div>
                        {det.boundingBox && (
                          <div className="text-xs text-gray-500 mt-1">
                            Box: [{det.boundingBox.x},{det.boundingBox.y},{det.boundingBox.width},{det.boundingBox.height}]
                          </div>
                        )}
                        {det.details?.confidence_source && (
                          <div className="text-xs text-gray-500 mt-1">
                            Confidence source: {det.details.confidence_source}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
