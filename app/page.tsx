"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckSquare, 
  Link as LinkIcon, 
  Plus, 
  ChevronRight,
  LayoutDashboard,
  Zap,
  StickyNote,
  ArrowUpRight,
  Search,
  HardDrive
} from "lucide-react";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  where,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import LandingPage from "@/components/LandingPage";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [recentTodos, setRecentTodos] = useState<any[]>([]);
  const [todoStats, setTodoStats] = useState({ total: 0, done: 0 });
  const [pinnedLinks, setPinnedLinks] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [recentDrive, setRecentDrive] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quickInput, setQuickInput] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todosQ = query(collection(db, `users/${user.uid}/todos`), orderBy("createdAt", "desc"), limit(20));
      const unsubTodos = onSnapshot(todosQ, (s) => {
        const all = s.docs.map(d => ({id: d.id, ...(d.data() as any)}));
        setRecentTodos(all.filter(t => t.status !== "Done").slice(0, 5));
        const todayTasks = all.filter(t => t.createdAt?.toDate() >= startOfDay);
        setTodoStats({ 
          total: todayTasks.length, 
          done: todayTasks.filter(t => t.status === "Done").length 
        });
      });

      const linksQ = query(collection(db, `users/${user.uid}/links`), where("pinned", "==", true), limit(6));
      const unsubLinks = onSnapshot(linksQ, (s) => setPinnedLinks(s.docs.map(d => ({id: d.id, ...d.data()}))));

      const notesQ = query(collection(db, `users/${user.uid}/notes`), orderBy("updatedAt", "desc"), limit(3));
      const unsubNotes = onSnapshot(notesQ, (s) => setRecentNotes(s.docs.map(d => ({id: d.id, ...d.data()}))));

      const driveQ = query(collection(db, `users/${user.uid}/drive`), orderBy("createdAt", "desc"), limit(3));
      const unsubDrive = onSnapshot(driveQ, (s) => setRecentDrive(s.docs.map(d => ({id: d.id, ...d.data()}))));

      return () => { unsubTodos(); unsubLinks(); unsubNotes(); unsubDrive(); };
    }
  }, [user]);

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickInput.trim()) return;
    setIsCapturing(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/todos`), {
        title: quickInput,
        status: "Todo",
        priority: "Medium",
        createdAt: serverTimestamp(),
      });
      setQuickInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleTodoDone = async (todo: any) => {
    if (!user) return;
    await updateDoc(doc(db, `users/${user.uid}/todos`, todo.id), { status: "Done" });
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <div className="fixed inset-0 bg-mesh opacity-20 pointer-events-none" />
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-accent/5 blur-[150px] -mr-64 -mt-64 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 blur-[150px] -ml-64 -mb-64 pointer-events-none" />
      
      <div className="p-8 lg:p-12 pt-16 lg:pt-20 flex flex-col gap-10 relative z-10">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-3">
            <motion.div 
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary flex items-center gap-3"
            >
              <span className="w-12 h-0.5 bg-primary" /> System_Online
            </motion.div>
            <div className="space-y-1">
              <h2 className="text-4xl lg:text-5xl font-black tracking-tighter text-white leading-[0.9]">
                Welcome back, <br/>
                <span className="text-primary italic font-black">
                  {user?.displayName?.split(" ")[0] || "User"}
                </span>
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mt-2 flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {todoStats.total > 0 ? `${todoStats.done} / ${todoStats.total} tasks_commited` : "no_tasks_scheduled"}
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:items-end">
             <div className="text-3xl lg:text-5xl font-semibold tracking-tight text-zinc-100 tabular-nums">
               {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}<span className="text-zinc-500 text-xl lg:text-2xl ml-1">:{currentTime.getSeconds().toString().padStart(2, '0')}</span>
             </div>
             <div className="text-[11px] font-medium uppercase tracking-widest text-zinc-500 mt-1">
               {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
             </div>
          </div>
        </header>

        {/* Quick Capture Bar */}
        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleQuickCapture}
          className="relative group"
        >
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Plus size={18} className="text-zinc-600 group-focus-within:text-primary transition-colors" />
          </div>
          <input 
            type="text"
            placeholder="Initialize new objective..."
            className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-2xl py-5 pl-16 pr-6 text-xl font-bold tracking-tight text-white placeholder:text-zinc-800 outline-none focus:border-primary focus:bg-zinc-900/60 transition-all backdrop-blur-sm"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            disabled={isCapturing}
          />
          <div className="absolute inset-y-0 right-8 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-700 font-mono">
             EXEC_COMMAND <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">[ ENTER ]</span>
          </div>
        </motion.form>

        {/* Professional Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 auto-rows-[140px] lg:auto-rows-[160px] gap-6">
          
          {/* VAULT: Resource Links (Left Side) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-6 lg:row-span-2 glass-card rounded-3xl p-8 flex flex-col gap-8 border border-zinc-800/80"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Pinned Resources</h2>
              <span className="text-[10px] font-black tabular-nums text-accent">{pinnedLinks.length} items</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
               {pinnedLinks.slice(0, 6).map((link, i) => (
                 <a 
                   key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                   className="glass-card rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:border-primary/30 transition-all group overflow-hidden"
                 >
                    <div className="w-10 h-10 rounded-xl bg-zinc-950/50 border border-zinc-800/50 flex items-center justify-center group-hover:bg-primary/5 transition-all">
                       <img src={`https://www.google.com/s2/favicons?sz=64&domain=${new URL(link.url).hostname}`} alt="" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700 group-hover:text-zinc-400 truncate w-full text-center transition-all">{link.title}</span>
                 </a>
               ))}
               {!pinnedLinks.length && (
                  <div className="col-span-full py-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-800">No pinned items</div>
               )}
            </div>
          </motion.div>

          {/* TASKS Block (Right Side) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-6 lg:row-span-3 glass-card rounded-3xl p-8 flex flex-col gap-6 overflow-hidden border border-zinc-800/80"
          >
            <div className="flex items-center justify-between">
                <div className="space-y-4 flex-1">
                   <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                     <Zap size={14} className="text-primary fill-primary" /> _active_tasks
                   </h2>
                   <div className="flex items-center gap-6 max-w-sm">
                      <div className="flex-1 h-3 rounded-full bg-zinc-950 overflow-hidden border border-zinc-900 shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${todoStats.total > 0 ? (todoStats.done / todoStats.total) * 100 : 0}%` }}
                          className="h-full bg-primary" 
                        />
                      </div>
                     <span className="text-xs font-black tabular-nums text-white">
                       {todoStats.done} / {todoStats.total}
                     </span>
                   </div>
                </div>
                <Link href="/todos" className="w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center hover:scale-105 transition-all shadow-soft group">
                   <Plus size={24} className="group-hover:text-primary transition-colors" />
                </Link>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar-hidden">
               {recentTodos.length > 0 ? (
                 recentTodos.map((todo, i) => (
                   <motion.div 
                     key={todo.id}
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: 0.2 + i * 0.05 }}
                     onClick={() => toggleTodoDone(todo)}
                     className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/10 border border-zinc-800/30 hover:bg-zinc-800/20 hover:border-zinc-700/50 transition-all cursor-pointer group/item"
                   >
                      <div className="w-5 h-5 rounded-full border border-zinc-800 flex items-center justify-center group-hover/item:border-primary transition-all shrink-0">
                         <div className="w-1.5 h-1.5 rounded-full bg-transparent group-hover/item:bg-primary" />
                      </div>
                      <span className="flex-1 text-base font-semibold text-zinc-400 group-hover/item:text-white transition-colors">{todo.title}</span>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          todo.priority === "High" ? "bg-red-500" :
                          todo.priority === "Medium" ? "bg-secondary" :
                          "bg-accent"
                        )} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-outline group-hover/item:text-foreground transition-colors">
                          {todo.priority === "Low" ? "Chromatic" : todo.priority}
                        </span>
                      </div>
                   </motion.div>
                 ))
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 py-12">
                   <CheckSquare size={48} className="opacity-10 mb-4" />
                   <p className="text-sm font-medium">All tasks completed.</p>
                 </div>
               )}
            </div>
          </motion.div>

          {/* RECENT DRIVE FILES (Left Side, below Vault) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-6 lg:row-span-1 glass-card rounded-2xl p-6 flex flex-col gap-4 border border-zinc-800/80"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Recent Drive</h2>
              <Link href="/drive" className="text-[9px] font-black uppercase tracking-widest text-accent hover:underline">View All</Link>
            </div>
            <div className="space-y-2">
              {recentDrive.length > 0 ? recentDrive.map(file => (
                <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/20 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <HardDrive size={14} className="text-zinc-600 group-hover:text-zinc-400" />
                  </div>
                  <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 truncate flex-1">{file.title}</span>
                </a>
              )) : (
                <div className="py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-800">No recent files</div>
              )}
            </div>
          </motion.div>

          {/* NOTES ARCHIVE (Bottom) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-12 lg:row-span-1 glass-card rounded-3xl p-8 flex items-center gap-12 overflow-hidden border border-zinc-800/80"
          >
            <div className="shrink-0">
               <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Archive_Notes</h2>
               <Link href="/notes" className="text-2xl font-bold text-foreground hover:text-secondary transition-colors flex items-center gap-2 group italic tracking-tight">
                 Vault <ArrowUpRight size={20} className="text-outline group-hover:text-secondary transition-all" />
               </Link>
            </div>
            
            <div className="flex-1 flex gap-6">
               {recentNotes.map((note) => (
                 <div key={note.id} className="flex-1 p-6 rounded-2xl bg-zinc-900/20 border border-zinc-800/50 hover:border-zinc-700 transition-all min-w-[280px]">
                    <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                       {note.content}
                    </p>
                 </div>
               ))}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
