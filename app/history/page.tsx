"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, 
  Trash2, 
  ExternalLink,
  History,
  Search,
  LayoutDashboard,
  HardDrive,
  LinkIcon,
  Filter
} from "lucide-react";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  limit,
  writeBatch,
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [history, setHistory] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, `users/${user.uid}/history`), 
        orderBy("timestamp", "desc"),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [user]);

  const deleteEntry = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/history`, id));
    showToast("Entry Removed", "info");
  };

  const clearHistory = async () => {
    if (!user || history.length === 0) return;
    if (!confirm("Are you sure you want to wipe your interaction history?")) return;

    try {
      const q = query(collection(db, `users/${user.uid}/history`));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      showToast("History Wiped", "error");
    } catch (e) {
      showToast("Failed to clear history", "error");
    }
  };

  const filteredHistory = history.filter(item => 
    filter === "All" || item.category === filter
  );

  const categories = ["All", "Vault", "Drive", "Deep Search findings"];

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-8 lg:p-16 flex flex-col gap-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-primary mb-2">
            <History size={20} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">System_Logs</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Interaction History</h1>
          <p className="text-zinc-500 text-sm font-medium">Tracing your journey through the workspace.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-900 rounded-xl p-1">
             {categories.map(cat => (
                <button
                   key={cat}
                   onClick={() => setFilter(cat)}
                   className={cn(
                      "px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                      filter === cat ? "bg-zinc-800 text-white shadow-soft" : "text-zinc-600 hover:text-zinc-400"
                   )}
                >
                   {cat === "Deep Search findings" ? "Deep" : cat}
                </button>
             ))}
          </div>
          <button 
            onClick={clearHistory}
            className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            Clear_Logs
          </button>
        </div>
      </header>

      <div className="max-w-4xl w-full mx-auto">
        <div className="relative border-l border-zinc-900 ml-4 pl-10 space-y-12 pb-20">
          <AnimatePresence mode="popLayout">
            {filteredHistory.map((item, index) => {
              const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date();
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

              return (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative group"
                >
                  {/* Timeline Dot */}
                  <div className="absolute -left-[45px] top-1.5 w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-primary group-hover:bg-primary transition-all duration-500 shadow-glow shadow-primary/0 group-hover:shadow-primary/20" />
                  
                  <div className="flex flex-col gap-2">
                     <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase font-mono">{dateString} at {timeString}</span>
                        <div className="h-px bg-zinc-900 flex-1" />
                        <span className={cn(
                           "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                           item.category === "Vault" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : 
                           item.category === "Drive" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                           "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                           {item.category}
                        </span>
                     </div>

                     <div className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-2xl flex items-center gap-6 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all group/card">
                        <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                           {item.category === "Vault" ? <LinkIcon size={20} className="text-indigo-400" /> : 
                            item.category === "Drive" ? <HardDrive size={20} className="text-emerald-400" /> :
                            <Search size={20} className="text-amber-400" />}
                        </div>

                        <div className="flex-1 min-w-0">
                           <h4 className="font-bold text-zinc-200 truncate group-hover/card:text-white transition-colors capitalize">{item.title}</h4>
                           <p className="text-xs text-zinc-500 truncate mt-1 opacity-60 font-mono tracking-tighter">{item.url}</p>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                           <a 
                             href={item.url} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-700/50"
                             title="Re-open Resource"
                           >
                              <ExternalLink size={16} />
                           </a>
                           <button 
                             onClick={() => deleteEntry(item.id)}
                             className="p-2.5 rounded-lg hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-all"
                             title="Delete from History"
                           >
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {history.length === 0 && (
            <div className="py-20 text-center opacity-40 italic text-zinc-600 text-sm">
               The timeline is currently empty. Start exploring to build your history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
