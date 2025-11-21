import Spinner from "./Spinner";

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingOverlay({
  message = "Procesando...",
  fullScreen = false,
}: LoadingOverlayProps) {
  return (
    <div
      className={`${
        fullScreen ? "fixed inset-0" : "absolute inset-0"
      } bg-black/50 backdrop-blur-sm flex items-center justify-center z-50`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[200px]">
        <Spinner size="lg" />
        <p className="text-gray-700 font-medium text-center">{message}</p>
      </div>
    </div>
  );
}
