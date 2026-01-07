interface ProgressIndicatorProps {
  current: number
  total: number
  label?: string
  showNumbers?: boolean
}

export default function ProgressIndicator({
  current,
  total,
  label,
  showNumbers = true,
}: ProgressIndicatorProps) {
  const percentage = Math.min((current / total) * 100, 100)
  
  return (
    <div className="w-full">
      {(label || showNumbers) && (
        <div className="flex justify-between items-center mb-2 text-sm">
          {label && (
            <span className="text-mainframe font-semibold uppercase tracking-wide">
              {label}
            </span>
          )}
          {showNumbers && (
            <span className="text-gray-400 font-mono">
              {current}/{total}
            </span>
          )}
        </div>
      )}
      
      {/* Progress bar container */}
      <div className="h-3 bg-void-lighter rounded-full overflow-hidden border border-mainframe/20">
        {/* Progress fill */}
        <div
          className="h-full bg-gradient-to-r from-mainframe-dark to-mainframe transition-all duration-500 ease-out relative"
          style={{ width: `${percentage}%` }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-scan" />
        </div>
      </div>
      
      {/* Sector indicators */}
      <div className="flex justify-between mt-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              i < current
                ? 'bg-mainframe shadow-mainframe'
                : 'bg-void-lighter border border-mainframe/30'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

