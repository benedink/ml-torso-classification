import { useState, useMemo } from 'react';
import { Activity, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, PieChart } from 'lucide-react';
import { BarChart, Bar, PieChart as RechartsPie, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DetectionResult } from './CameraFeed';

interface DetectionResultsProps {
  results: DetectionResult[];
}

const COLORS = {
  'Allowed Uniform': '#10b981',
  'PE Uniform': '#3b82f6',
  'Civilian Clothing': '#ef4444',
  'Jacket/Hoodie': '#f59e0b',
  'No Torso Detected': '#6b7280'
};

export function DetectionResults({ results }: DetectionResultsProps) {
  const [selectedResult, setSelectedResult] = useState<DetectionResult | null>(null);

  const stats = useMemo(() => {
    const allDetections = results.flatMap(r => r.detections || []);
    
    const allowed = allDetections.filter(d => {
      const lowReason = (d.reason || "").toLowerCase();
      return lowReason.includes('official logo') || lowReason.includes('org text') || lowReason.includes('white uniform');
    }).length;
    
    const violations = allDetections.filter(d => {
      const lowReason = (d.reason || "").toLowerCase();
      return lowReason.includes('civilian') || lowReason.includes('violation') || lowReason.includes('not white') || lowReason.includes('dark') || lowReason.includes('not allowed');
    }).length;

    const noDetection = results.filter(r =>
      (r.detectedObjects || []).some(o => o.toLowerCase().includes('no torso'))
    ).length;
    const avgConfidence = results.length > 0
      ? results.reduce((acc, r) => acc + r.confidence, 0) / results.length
      : 0;

    // Count by class
    const classCounts: Record<string, number> = {};
    results.forEach(r => {
      r.detectedObjects?.forEach(obj => {
        classCounts[obj] = (classCounts[obj] || 0) + 1;
      });
    });

    // Prepare chart data
    const pieData = Object.entries(classCounts).map(([name, value]) => ({
      name,
      value
    }));

    const barData = Object.entries(classCounts).map(([name, value]) => ({
      name,
      count: value
    }));

    // Time-based data (group by hour)
    const timeData: Record<string, number> = {};
    results.forEach(r => {
      const hour = r.timestamp.getHours();
      const key = `${hour}:00`;
      timeData[key] = (timeData[key] || 0) + 1;
    });

    const lineData = Object.entries(timeData).map(([time, count]) => ({
      time,
      detections: count
    }));

    return {
      total: results.length,
      allowed,
      violations,
      noDetection,
      avgConfidence,
      pieData,
      barData,
      lineData,
      complianceRate: results.length > 0 ? (allowed / results.length) * 100 : 0
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
          <div className="text-xs opacity-75 hidden sm:block">All detections processed</div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-xs sm:text-sm opacity-90">Compliant</p>
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
              <p className="text-xs sm:text-sm opacity-90">Violations</p>
              <p className="text-2xl sm:text-4xl font-bold">{stats.violations}</p>
            </div>
          </div>
          <div className="text-xs opacity-75 hidden sm:block">Non-compliant</div>
        </div>

        <div className="bg-gradient-to-br from-[#505081] to-[#0F0E47] text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-xs sm:text-sm opacity-90">Confidence</p>
              <p className="text-2xl sm:text-4xl font-bold">{(stats.avgConfidence * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div className="text-xs opacity-75 hidden sm:block">Model score</div>
        </div>
      </div>

      {/* Charts Section */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Pie Chart */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-[#505081]" />
              Classification Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
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

          {/* Bar Chart */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              Detection Count by Class
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#505081" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detection Timeline */}
      {results.length > 0 && stats.lineData.length > 1 && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#505081]" />
            Detection Timeline
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="detections" stroke="#505081" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Results List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F0E47] to-[#272757] px-4 sm:px-6 py-3 sm:py-4">
          <h3 className="text-base sm:text-lg font-semibold text-white">Complete Detection Log</h3>
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 sm:px-6 py-8 sm:py-12 text-center">
              <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 mb-3 sm:mb-4" />
              <p className="text-gray-400 font-medium text-base sm:text-lg">No detections yet</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-2">Start the camera or upload an image to begin</p>
            </div>
          ) : (
            results.slice().reverse().map((result) => {
              const lowReasons = (result.detectedObjects || []).map(o => o.toLowerCase());
              const isAllowed = lowReasons.some(o => o.includes('official logo') || o.includes('org text') || o.includes('white uniform'));
              const isViolation = lowReasons.some(o => o.includes('civilian') || o.includes('violation') || o.includes('not white') || o.includes('dark'));

              return (
                <div
                  key={result.id}
                  onClick={() => setSelectedResult(result)}
                  className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                      <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 mt-1 sm:mt-0 ${
                        isAllowed ? 'bg-green-500' :
                        isViolation ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-gray-600 font-medium truncate">
                            {result.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {result.detectedObjects?.map((obj, idx) => (
                            <span
                              key={idx}
                              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium ${
                                obj === 'Allowed Uniform' ? 'bg-green-100 text-green-700' :
                                obj === 'PE Uniform' ? 'bg-blue-100 text-blue-700' :
                                obj === 'Civilian Clothing' || obj === 'Jacket/Hoodie' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {obj}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500 mb-0.5 sm:mb-1 hidden sm:block">Confidence</div>
                      <div className={`text-sm sm:text-lg font-bold ${
                        result.confidence > 0.8 ? 'text-green-600' :
                        result.confidence > 0.6 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {(result.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {selectedResult.detectedObjects?.map((obj, idx) => (
                      <span
                        key={idx}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-semibold shadow-md ${
                          obj === 'Allowed Uniform' ? 'bg-green-500 text-white' :
                          obj === 'PE Uniform' ? 'bg-blue-500 text-white' :
                          obj === 'Civilian Clothing' || obj === 'Jacket/Hoodie' ? 'bg-red-500 text-white' :
                          'bg-yellow-500 text-white'
                        }`}
                      >
                        {obj}
                      </span>
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
