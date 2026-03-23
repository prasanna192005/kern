"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
  items: MenuItem[];
  title?: string;
}

interface ContextMenuContextType {
  showMenu: (x: number, y: number, items: MenuItem[], title?: string) => void;
  hideMenu: () => void;
  menuState: ContextMenuState;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    x: 0,
    y: 0,
    visible: false,
    items: [],
  });

  const showMenu = (x: number, y: number, items: MenuItem[], title?: string) => {
    setMenuState({ x, y, visible: true, items, title });
  };

  const hideMenu = () => {
    setMenuState((prev) => ({ ...prev, visible: false }));
  };

  return (
    <ContextMenuContext.Provider value={{ showMenu, hideMenu, menuState }}>
      {children}
    </ContextMenuContext.Provider>
  );
};

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error("useContextMenu must be used within a ContextMenuProvider");
  return context;
};
