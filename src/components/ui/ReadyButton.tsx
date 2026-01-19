interface ReadyButtonProps {
  onClick: () => void
  label?: string
  disabled?: boolean
  variant?: 'mainframe' | 'glitch' | 'solid'
  size?: 'normal' | 'large'
}

export default function ReadyButton({
  onClick,
  label = "I'm Ready",
  disabled = false,
  variant = 'solid',
  size = 'large',
}: ReadyButtonProps) {
  const baseClasses = 'btn font-display uppercase tracking-wider transition-all duration-300'
  
  const variantClasses = {
    mainframe: 'btn-mainframe',
    glitch: 'btn-glitch',
    solid: 'btn-solid',
  }
  
  const sizeClasses = {
    normal: 'text-lg px-6 py-4',
    large: 'text-xl px-10 py-5',
  }
  
  const disabledClasses = disabled 
    ? 'opacity-50 cursor-not-allowed' 
    : 'hover:scale-105 active:scale-95'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabledClasses}
      `}
    >
      {label}
    </button>
  )
}


