import { useEffect } from "react";

export default function Modal(props: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all"
        aria-label="Close"
        onClick={props.onClose}
      />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl animate-fade-in">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
          <div className="text-lg font-semibold text-white">{props.title}</div>
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white/70 hover:bg-white/10"
            onClick={props.onClose}
          >
            ✕
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{props.children}</div>
      </div>
    </div>
  );
}

