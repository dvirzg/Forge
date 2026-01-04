interface CompressionSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const QUALITY_LABELS = [
  'Lossless',
  'Near Lossless',
  'High Quality',
  'Medium Quality',
  'Low Quality',
];

export function CompressionSlider({
  value,
  onChange,
  disabled = false,
}: CompressionSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70">Quality Level</span>
        <span className="text-sm font-medium text-white">
          {QUALITY_LABELS[value]}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="4"
        step="1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-blue-500
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-all
          [&::-webkit-slider-thumb]:duration-200
          [&::-webkit-slider-thumb]:hover:scale-110
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-blue-500
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:transition-all
          [&::-moz-range-thumb]:duration-200
          [&::-moz-range-thumb]:hover:scale-110"
      />

      <div className="flex justify-between px-0.5">
        {QUALITY_LABELS.map((_label, index) => (
          <div
            key={index}
            className={`flex flex-col items-center transition-all duration-200 ${
              value === index ? 'opacity-100' : 'opacity-30'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                value === index ? 'bg-blue-500' : 'bg-white/40'
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
