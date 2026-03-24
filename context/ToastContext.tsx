"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X, RotateCcw } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  onUndo?: () => void;
  undoLabel?: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: { onUndo?: () => void; undoLabel?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((
    message: string,
    type: ToastType = "success",
    options?: { onUndo?: () => void; undoLabel?: string }
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, onUndo: options?.onUndo, undoLabel: options?.undoLabel }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000); // 5s for undo window
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUndo = (toast: Toast) => {
    toast.onUndo?.();
    removeToast(toast.id);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className="pointer-events-auto"
            >
              <div className={cn(
                "glass-card flex items-center gap-4 px-6 py-4 min-w-[300px] border shadow-2xl backdrop-blur-2xl",
                toast.onUndo ? "border-amber-500/20" : "border-white/10"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-glow",
                  toast.type === "success" ? "bg-primary/20 text-primary shadow-primary/20" :
                  toast.type === "error" ? "bg-red-500/20 text-red-500 shadow-red-500/20" :
                  "bg-accent/20 text-accent shadow-accent/20"
                )}>
                  {toast.type === "success" && <CheckCircle2 size={20} />}
                  {toast.type === "error" && <AlertCircle size={20} />}
                  {toast.type === "info" && <Info size={20} />}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-0.5">
                    {toast.onUndo ? "Action_Taken" : "System_Alert"}
                  </p>
                  <p className="text-sm font-bold text-white leading-tight">{toast.message}</p>
                </div>
                {toast.onUndo && (
                  <button
                    onClick={() => handleUndo(toast)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-all shrink-0"
                  >
                    <RotateCcw size={11} />
                    {toast.undoLabel || "Undo"}
                  </button>
                )}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
