"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  LayoutDashboard, 
  Link as LinkIcon, 
  CheckSquare, 
  HardDrive, 
  StickyNote,
  Command as CommandIcon,
  ArrowRight,
  LogOut,
  FileText,
  Table,
  Presentation
} from "lucide-react";
import { 
  collection, 
  query, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  limit,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { user, logOut } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQueryText("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !user) return;

    const searchEverything = async () => {
      const q = queryText.toLowerCase().trim();
      
      const defaultNav = [
        { id: "go-dash", title: "Dashboard", icon: LayoutDashboard, category: "Navigation", action: () => { router.push("/"); setIsOpen(false); } },
        { id: "go-todos", title: "Todos", icon: CheckSquare, category: "Navigation", action: () => { router.push("/todos"); setIsOpen(false); } },
        { id: "go-links", title: "Links", icon: LinkIcon, category: "Navigation", action: () => { router.push("/links"); setIsOpen(false); } },
        { id: "go-drive", title: "Drive", icon: HardDrive, category: "Navigation", action: () => { router.push("/drive"); setIsOpen(false); } },
        { id: "go-notes", title: "Notes", icon: StickyNote, category: "Navigation", action: () => { router.push("/notes"); setIsOpen(false); } },
      ];

      if (!q) {
        setResults(defaultNav);
        return;
      }

      const smartResults: any[] = [];
      
      // Google Workspace Integration
      const isGoogleDoc = q.includes("docs.google.com/document");
      const isGoogleSheet = q.includes("docs.google.com/spreadsheets");
      const isGoogleSlide = q.includes("docs.google.com/presentation");

      if (isGoogleDoc || isGoogleSheet || isGoogleSlide) {
        const type = isGoogleDoc ? "Doc" : isGoogleSheet ? "Sheet" : "Slide";
        const icon = isGoogleDoc ? FileText : isGoogleSheet ? Table : Presentation;
        smartResults.push({ 
          id: "s-drive", 
          title: `Link ${type} to Central Drive`, 
          icon: icon, 
          category: "Smart Integration", 
          action: () => handleAction("drive", q, { type }) 
        });
      }

      // Action: Add Todo (only if not a link)
      if ((q.startsWith("todo ") || q.startsWith("task ") || q.length > 3) && !q.includes(".")) {
        const title = q.replace(/todo |task /i, "");
        smartResults.push({ id: "s-todo", title: `New Task: ${title}`, icon: CheckSquare, category: "Action", action: () => handleAction("todo", title) });
      }

      // Action: Save Link (if looks like a URL and not already a Google Doc action)
      if ((q.startsWith("http") || q.includes(".")) && smartResults.length === 0) {
        smartResults.push({ id: "s-link", title: `Save to Vault: ${q}`, icon: LinkIcon, category: "Action", action: () => handleAction("link", q) });
      }

      // Quick Command: Sign Out
      if (q.includes("sign out") || q.includes("logout") || q.includes("exit")) {
        smartResults.push({ id: "s-logout", title: "Terminate Session", icon: LogOut, category: "System", action: () => { setIsOpen(false); logOut(); } });
      }

      const filteredNav = defaultNav.filter(n => n.title.toLowerCase().includes(q));
      setResults([...smartResults, ...filteredNav]);
    };

    const timer = setTimeout(searchEverything, 150);
    return () => clearTimeout(timer);
  }, [queryText, isOpen, user, router]);

  const handleAction = async (type: string, content: string, meta?: any) => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    try {
      if (type === "todo") {
         await addDoc(collection(db, `users/${user.uid}/todos`), {
            title: content,
            status: "Todo",
            priority: "Medium",
            createdAt: serverTimestamp(),
         });
         router.push("/todos");
      } else if (type === "link") {
         await addDoc(collection(db, `users/${user.uid}/links`), {
            title: content.split("/").filter(Boolean).pop()?.split("?")[0] || "New Link",
            url: content.startsWith("http") ? content : `https://${content}`,
            category: "Inbox",
            pinned: false,
            createdAt: serverTimestamp(),
         });
         router.push("/links");
      } else if (type === "drive") {
         await addDoc(collection(db, `users/${user.uid}/drive`), {
            title: content.split("/").filter(Boolean).pop()?.split("?")[0] || `New ${meta.type}`,
            url: content,
            type: meta.type,
            projectTag: "Inbox",
            createdAt: serverTimestamp(),
         });
         router.push("/drive");
      }
      setIsOpen(false);
      setQueryText("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) results[selectedIndex].action();
    }
  };

  const groupedResults = results.reduce((acc: any, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl pointer-events-auto"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.99, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: -10 }}
            className="bg-zinc-900/95 backdrop-blur-3xl w-full max-w-[600px] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto border border-zinc-800/50 flex flex-col relative z-10"
          >
            <div className="flex items-center px-8 py-6 gap-4">
              <input 
                ref={inputRef}
                type="text"
                placeholder="Type a command or paste a link..."
                className="w-full bg-transparent border-none outline-none text-xl font-medium tracking-tight text-white placeholder:text-zinc-700"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-3">
              {results.length > 0 ? (
                Object.entries(groupedResults).map(([category, items]: [string, any]) => (
                  <div key={category} className="mb-4">
                    <div className="px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{category}</div>
                    {items.map((item: any) => {
                      const isSelected = results.indexOf(item) === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => item.action()}
                          className={cn(
                            "w-full flex items-center px-4 py-3 gap-4 rounded-xl transition-all text-left",
                            isSelected ? "bg-primary text-white" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                          )}
                        >
                          <item.icon size={18} />
                          <span className="font-medium text-sm capitalize">{item.title}</span>
                          <ArrowRight size={14} className={cn("ml-auto opacity-0 transition-all", isSelected && "opacity-40 translate-x-1")} />
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-zinc-700 text-sm font-medium">No results found</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
