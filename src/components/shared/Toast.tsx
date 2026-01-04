interface ToastProps {
  message: string;
  id: number;
}

export function Toast({ message, id }: ToastProps) {
  return (
    <div
      className="fixed bottom-6 left-6 z-50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
      key={id}
    >
      <div className="glass-card rounded-xl px-4 py-2 shadow-lg">
        <p className="text-white text-sm whitespace-nowrap">{message}</p>
      </div>
    </div>
  );
}
