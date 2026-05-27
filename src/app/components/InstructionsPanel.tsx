import { Info, Sun, User, Camera } from 'lucide-react';

export function InstructionsPanel() {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 sm:p-6 text-white">
        <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
          <Info className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Detection Guidelines</h3>
            <p className="text-xs sm:text-sm text-blue-100 mb-3 sm:mb-4">
              Follow these instructions to ensure accurate uniform compliance detection
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-3 sm:p-4">
            <Sun className="w-6 h-6 sm:w-8 sm:h-8 mb-2 text-yellow-300" />
            <h4 className="font-semibold mb-1 text-sm sm:text-base">Proper Lighting</h4>
            <p className="text-xs text-blue-100">
              Ensure adequate lighting for clear garment visibility and accurate color detection
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-3 sm:p-4">
            <User className="w-6 h-6 sm:w-8 sm:h-8 mb-2 text-green-300" />
            <h4 className="font-semibold mb-1 text-sm sm:text-base">Torso Visibility</h4>
            <p className="text-xs text-blue-100">
              Keep the upper body fully visible in frame for reliable garment classification
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-3 sm:p-4">
            <Camera className="w-6 h-6 sm:w-8 sm:h-8 mb-2 text-purple-300" />
            <h4 className="font-semibold mb-1 text-sm sm:text-base">Camera Position</h4>
            <p className="text-xs text-blue-100">
              Maintain a frontal view at chest level for optimal detection accuracy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
