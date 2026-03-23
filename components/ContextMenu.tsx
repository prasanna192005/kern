"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useContextMenu } from "@/context/ContextMenuContext";

export const ContextMenu = () => {
  const { menuState, hideMenu } = useContextMenu();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideMenu();
      }
    };
    if (menuState.visible) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuState.visible, hideMenu]);

  return (
    <AnimatePresence>
      {menuState.visible && (
        <motion.div
           ref={menuRef}
           initial={{ opacity: 0, scale: 0.95, y: 5 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 5 }}
           transition={{ duration: 0.1, ease: "easeOut" }}
           className="fixed z-[9999] min-w-[180px] bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-2.5 overflow-hidden"
           style={{ left: menuState.x, top: menuState.y }}
        >
          {menuState.title && (
            <div className="px-3 py-2 mb-1.5 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 truncate">{menuState.title}</span>
              <div className="h-0.5 w-6 bg-primary/30 mt-1 rounded-full" />
            </div>
          )}
          
          <div className="flex flex-col gap-0.5">
            {menuState.items.map((item, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  hideMenu();
                }}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all
                  ${item.variant === "destructive" 
                    ? "text-red-400 hover:bg-red-500/10" 
                    : "text-zinc-400 hover:bg-primary/10 hover:text-primary"}
                `}
              >
                {item.icon && <span className="opacity-60">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
