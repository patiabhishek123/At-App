type ToastProps = {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

export function Toast({ message, type, onClose }: ToastProps) {
  return (
    <div
      className={`fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${
        type === 'success'
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
      role="status"
    >
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button className="text-xs font-semibold opacity-70 hover:opacity-100" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
