interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
  variant?: 'default' | 'primary' | 'success';
}

export function ActionButton({
  onClick,
  disabled = false,
  children,
  className = '',
  title,
  variant = 'default',
}: ActionButtonProps) {
  const variantClasses = {
    default: '',
    primary: 'bg-blue-500/30',
    success: 'bg-green-500/30',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 disabled:opacity-50 hover:scale-105 ${variantClasses[variant]} ${className}`}
      title={title}
    >
      {children}
    </button>
  );
}
