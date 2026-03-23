"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Link as LinkIcon, 
  CheckSquare, 
  HardDrive, 
  StickyNote,
  User,
  LogOut,
  Command as CommandIcon,
  Folder
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "dashboard", href: "/", icon: LayoutDashboard },
  { name: "tasks", href: "/todos", icon: CheckSquare },
  { name: "links", href: "/links", icon: LinkIcon },
  { name: "drive", href: "/drive", icon: HardDrive },
  { name: "projects", href: "/projects", icon: Folder },
  { name: "notes", href: "/notes", icon: StickyNote },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logOut } = useAuth();

  if (!user) return null;

  return (
    <nav className="fixed left-0 top-0 h-full w-20 lg:w-64 flex flex-col py-10 bg-zinc-950 border-r border-zinc-900 z-[100] transition-all duration-500">
      {/* Hardware Logo Segment */}
      <div className="px-6 lg:px-10 mb-16">
        <Link href="/" className="flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center shrink-0 bg-zinc-900 group-hover:border-primary transition-all duration-500">
            <CommandIcon size={18} className="text-white group-hover:text-primary transition-colors" />
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="font-bold text-xl tracking-tight text-zinc-100 leading-none">Kern</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600 mt-1">Workspace</span>
          </div>
        </Link>
      </div>

      {/* Primary Navigation System */}
      <div className="flex-1 flex flex-col gap-2 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-zinc-500 hover:text-white hover:bg-zinc-900/50"
              )}
            >
              <Icon size={20} className={cn("shrink-0 transition-all duration-500", isActive ? "text-primary scale-110" : "text-zinc-600 group-hover:text-white")} />
              <span className="hidden lg:block font-bold text-xs uppercase tracking-widest">{item.name}</span>
              {isActive && (
                <motion.div 
                  layoutId="nav-glow"
                  className="absolute left-0 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_15px_rgba(209,255,0,0.8)]"
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* User / Authentication Cluster */}
      <div className="mt-auto px-4 py-8 border-t border-zinc-900/50">
        <div className="px-2 flex items-center gap-4 group cursor-pointer" onClick={logOut}>
          <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800 shrink-0 bg-zinc-900 flex items-center justify-center transition-all group-hover:border-zinc-700 shadow-soft">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                className="w-full h-full object-cover transition-opacity opacity-70 group-hover:opacity-100" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-zinc-500 font-bold text-xs uppercase">{user.displayName ? user.displayName[0] : <User size={18} />}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 hidden lg:block">
            <p className="text-sm font-bold truncate text-white leading-none tracking-tight">
              {user.displayName ? user.displayName.split(" ")[0] : "User"}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 group-hover:text-red-500/80 transition-colors mt-1.5 font-mono">
              [ Terminate_Session ]
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
