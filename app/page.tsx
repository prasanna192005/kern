"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/context/ToastContext";
import { useLinking } from "@/context/LinkingContext";
import { useKeyboardActions } from "@/hooks/useKeyboardActions";
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
  HardDrive,
  Copy as CopyIcon,
  Folder,
  Edit2,
  Trash2,
  Table,
  Database,
  FileText,
  Presentation,
  FolderOpen,
  Clock,
  History
} from "lucide-react";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  where,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useContextMenu } from "@/context/ContextMenuContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
const typeStyles = {
  Sheet: { color: "#16A34A", icon: Table, bg: "rgba(22, 163, 74, 0.1)" },
  Form: { color: "#9333EA", icon: Database, bg: "rgba(147, 51, 234, 0.1)" },
  Doc: { color: "#2563EB", icon: FileText, bg: "rgba(37, 99, 235, 0.1)" },
  Slide: { color: "#EAB308", icon: Presentation, bg: "rgba(234, 179, 8, 0.1)" },
  Folder: { color: "#71717a", icon: FolderOpen, bg: "rgba(113, 113, 122, 0.1)" },
  Link: { color: "#4F46E5", icon: LinkIcon, bg: "rgba(79, 70, 229, 0.1)" },
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showMenu } = useContextMenu();
  const [recentTodos, setRecentTodos] = useState<any[]>([]);
  const [todoStats, setTodoStats] = useState({ total: 0, done: 0 });
  const [pinnedLinks, setPinnedLinks] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [recentDrive, setRecentDrive] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
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

      const notesQ = query(collection(db, `users/${user.uid}/notes`), orderBy("updatedAt", "desc"), limit(2));
      const unsubNotes = onSnapshot(notesQ, (s) => setRecentNotes(s.docs.map(d => ({id: d.id, ...d.data()}))));

      const driveQ = query(collection(db, `users/${user.uid}/drive`), orderBy("createdAt", "desc"), limit(3));
      const unsubDrive = onSnapshot(driveQ, (s) => setRecentDrive(s.docs.map(d => ({id: d.id, ...d.data()}))));

      const historyQ = query(collection(db, `users/${user.uid}/history`), orderBy("timestamp", "desc"), limit(3));
      const unsubHistory = onSnapshot(historyQ, (s) => setRecentHistory(s.docs.map(d => ({id: d.id, ...d.data()}))));

      return () => { unsubTodos(); unsubLinks(); unsubNotes(); unsubDrive(); unsubHistory(); };
    }
  }, [user]);

  const { showToast } = useToast();
  const { copyRef } = useLinking();
  const [hoveredItem, setHoveredItem] = useState<any>(null);

  const deleteResource = async (item: any) => {
    if (!user || !item) return;
    try {
      const collectionName = 
        item.type === "link" ? "links" : 
        item.type === "drive" ? "drive" : 
        item.type === "todo" ? "todos" : "notes";
      await deleteDoc(doc(db, `users/${user.uid}/${collectionName}`, item.id));
      showToast(`${item.type === "todo" ? "Objective" : "Resource"} Terminated`, "error");
    } catch (e) {
      showToast("Termination Failure", "error");
    }
  };

  const renameResource = async (item: any) => {
    if (!user || !item || item.type === "todo" || item.type === "note") return;
    const newTitle = prompt(`Enter new identity for ${item.title}:`, item.title || "");
    if (newTitle) {
      try {
        const collectionName = item.type === "link" ? "links" : "drive";
        await updateDoc(doc(db, `users/${user.uid}/${collectionName}`, item.id), { title: newTitle });
        showToast("Identity Updated", "success");
      } catch (e) {
        showToast("Update Failure", "error");
      }
    }
  };

  useKeyboardActions({
    onCopy: () => {
      if (hoveredItem && (hoveredItem.type === "link" || hoveredItem.type === "drive")) {
        copyRef({ id: hoveredItem.id, type: hoveredItem.type, title: hoveredItem.title });
        showToast("Reference Copied to Clipboard", "success");
      }
    },
    onRename: () => {
      if (hoveredItem) renameResource(hoveredItem);
    },
    onDelete: () => {
      if (hoveredItem) deleteResource(hoveredItem);
    }
  });

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
      showToast("Objective Initialized", "success");
    } catch (e) {
      console.error(e);
      showToast("System Failure", "error");
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleTodoDone = async (todo: any) => {
    if (!user) return;
    await updateDoc(doc(db, `users/${user.uid}/todos`, todo.id), { status: "Done" });
    showToast("Task Commited", "info");
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
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-2 flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-primary shadow-glow" />
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
            <Plus size={18} className="text-zinc-700 group-focus-within:text-primary transition-colors" />
          </div>
          <input 
            type="text"
            placeholder="Initialize new objective..."
            className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-2xl py-5 pl-16 pr-6 text-xl font-bold tracking-tight text-white placeholder:text-zinc-400 outline-none focus:border-primary focus:bg-zinc-900/60 transition-all backdrop-blur-sm"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            disabled={isCapturing}
          />
          <div className="absolute inset-y-0 right-8 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-700 font-mono">
             EXEC_COMMAND <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">[ ENTER ]</span>
          </div>
        </motion.form>

        {/* Triple Block 6-6 Symmetric Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 auto-rows-[130px] lg:auto-rows-[150px] gap-6">
          
          {/* 1. PINNED RESOURCES (Vault Links) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-6 lg:row-span-1 glass-card rounded-3xl p-6 flex flex-col gap-4 border border-zinc-800/80 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Pinned Resources</h2>
              <span className="text-[10px] font-black tabular-nums text-accent bg-accent/10 px-2 py-0.5 rounded-full">{pinnedLinks.length} items</span>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
               {pinnedLinks.slice(0, 6).map((link, i) => (
                  <a 
                    key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    onMouseEnter={() => setHoveredItem({ ...link, type: "link" })}
                    onMouseLeave={() => setHoveredItem(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      showMenu(e.clientX, e.clientY, [
                        { label: "Rename Identity", icon: <Edit2 size={14} />, onClick: async () => {
                           const newTitle = prompt("Enter new identity name:", link.title || "");
                           if (newTitle && user) {
                              await updateDoc(doc(db, `users/${user.uid}/links`, link.id), { title: newTitle });
                              showToast("Identity Updated", "success");
                           }
                        } },
                        { label: "Copy Link", icon: <CopyIcon size={14} />, onClick: () => {
                           navigator.clipboard.writeText(link.url);
                           showToast("Link Copied", "success");
                        } },
                        { label: "Copy Reference to Project", icon: <Folder size={14} />, onClick: () => {
                           copyRef({ id: link.id, type: "link", title: link.title || "Untitled Link" });
                           showToast("Reference Copied to Clipboard", "success");
                        } },
                        { label: "Terminate Reference", icon: <Trash2 size={14} />, variant: "destructive", onClick: async () => {
                           if (user) {
                             await deleteDoc(doc(db, `users/${user.uid}/links`, link.id));
                             showToast("Resource Terminated", "error");
                           }
                        } },
                      ], link.title || "Vault Resource");
                    }}
                    className="glass-card rounded-xl p-3 flex flex-col items-center justify-center gap-2 border border-zinc-800/50 group overflow-hidden cursor-context-menu"
                  >
                     <div className="w-8 h-8 rounded-lg bg-zinc-950/50 border border-zinc-800/50 flex items-center justify-center">
                        <img src={`https://www.google.com/s2/favicons?sz=64&domain=${new URL(link.url).hostname}`} alt="" className="w-4 h-4 opacity-80" />
                     </div>
                  </a>
               ))}
            </div>
          </motion.div>

          {/* TASKS Block (Right Side, Parallel to all 3 left blocks) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-6 lg:row-span-3 glass-card rounded-3xl p-8 flex flex-col gap-6 overflow-hidden border border-zinc-800/80"
          >
            <div className="flex items-center justify-between">
                 <div className="space-y-4 flex-1">
                   <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                     <Zap size={14} className="text-primary fill-primary shadow-glow" /> _active_tasks
                   </h2>
                   <div className="flex items-center gap-6 max-w-sm">
                      <div className="flex-1 h-3 rounded-full bg-zinc-950/50 overflow-hidden border border-zinc-900 shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${todoStats.total > 0 ? (todoStats.done / todoStats.total) * 100 : 0}%` }}
                          className="h-full bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" 
                        />
                      </div>
                     <span className="text-sm font-black tabular-nums text-white">
                       {todoStats.done} <span className="text-zinc-600">/</span> {todoStats.total}
                     </span>
                   </div>
                </div>
                <Link href="/todos" className="w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center hover:scale-105 transition-all shadow-glow group">
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
                     onContextMenu={(e) => {
                       e.preventDefault();
                       showMenu(e.clientX, e.clientY, [
                         { label: todo.done ? "Mark Incomplete" : "Mark Completed", onClick: () => {
                            toggleTodoDone(todo);
                         } },
                         { label: "Terminate Objective", icon: <Trash2 size={14} />, variant: "destructive", onClick: async () => {
                            if (user) {
                               await deleteDoc(doc(db, `users/${user.uid}/todos`, todo.id));
                               showToast("Objective Terminated", "error");
                            }
                         } },
                       ], todo.title || "Task Objective");
                     }}
                     className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/10 border border-zinc-800/30 hover:bg-zinc-800/20 hover:border-zinc-700/50 transition-all cursor-pointer group/item cursor-context-menu"
                   >
                      <div className="w-5 h-5 rounded-full border border-zinc-800 flex items-center justify-center group-hover/item:border-primary transition-all shrink-0">
                         <div className="w-1.5 h-1.5 rounded-full bg-transparent group-hover/item:bg-primary" />
                      </div>
                      <span className="flex-1 text-base font-bold text-zinc-200 group-hover/item:text-white transition-colors">{todo.title}</span>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          todo.priority === "High" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                          todo.priority === "Medium" ? "bg-secondary shadow-[0_0_8px_rgba(var(--secondary-rgb),0.5)]" :
                          "bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]"
                        )} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover/item:text-foreground transition-colors">
                          {todo.priority === "Low" ? "Chromatic" : todo.priority}
                        </span>
                      </div>
                   </motion.div>
                 ))
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 py-12">
                   <p className="text-sm font-medium">All tasks completed.</p>
                 </div>
               )}
            </div>
          </motion.div>

          {/* 2. RECENT DRIVE (Left Side, Middle) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-6 lg:row-span-1 glass-card rounded-2xl p-6 flex flex-col gap-4 border border-zinc-800/80"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Recent Drive</h2>
              <Link href="/drive" className="text-[9px] font-black uppercase tracking-widest text-accent hover:text-white transition-colors">View System</Link>
            </div>
            <div className="space-y-2">
              {recentDrive.length > 0 ? recentDrive.map(file => (
                <a 
                  key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" 
                  onMouseEnter={() => setHoveredItem({ ...file, type: "drive" })}
                  onMouseLeave={() => setHoveredItem(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    showMenu(e.clientX, e.clientY, [
                      { label: "Rename Record", icon: <Edit2 size={14} />, onClick: async () => {
                         const newTitle = prompt("Enter new record name:", file.title || "");
                         if (newTitle && user) {
                            await updateDoc(doc(db, `users/${user.uid}/drive`, file.id), { title: newTitle });
                            showToast("Record Updated", "success");
                         }
                      } },
                      { label: "Copy File URL", icon: <CopyIcon size={14} />, onClick: () => {
                         navigator.clipboard.writeText(file.url);
                         showToast("Reference Copied", "success");
                      } },
                      { label: "Copy Reference to Project", icon: <Folder size={14} />, onClick: () => {
                         copyRef({ id: file.id, type: "drive", title: file.title || "Untitled File" });
                         showToast("Reference Copied to Clipboard", "success");
                      } },
                      { label: "Terminate Reference", icon: <Trash2 size={14} />, variant: "destructive", onClick: async () => {
                         if (user) {
                           await deleteDoc(doc(db, `users/${user.uid}/drive`, file.id));
                           showToast("File Reference Removed", "error");
                         }
                      } },
                    ], file.title || "Drive Resource");
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/20 transition-all group cursor-context-menu"
                >
                  <div 
                    className="w-8 h-8 rounded-lg border border-zinc-900 bg-zinc-950 flex items-center justify-center shrink-0"
                    style={{ 
                      backgroundColor: (typeStyles[file.type as keyof typeof typeStyles] || typeStyles.Doc).bg,
                      borderColor: `${(typeStyles[file.type as keyof typeof typeStyles] || typeStyles.Doc).color}22`
                    }}
                  >
                    {React.createElement((typeStyles[file.type as keyof typeof typeStyles] || typeStyles.Doc).icon, { 
                      size: 14, 
                      style: { color: (typeStyles[file.type as keyof typeof typeStyles] || typeStyles.Doc).color } 
                    })}
                  </div>
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-white truncate flex-1 tracking-tight">{file.title}</span>
                </a>
              )) : (
                <div className="py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-800">No recent files</div>
              )}
            </div>
          </motion.div>
          
          {/* 3. VAULT (Notes Archive, Left Side, Bottom) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-6 lg:row-span-1 glass-card rounded-3xl p-6 flex flex-col gap-4 border border-zinc-800/80 overflow-hidden"
          >
            <div className="flex items-center justify-between">
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 font-mono">Archive_Notes</h2>
               <Link href="/notes" className="text-[10px] font-black uppercase tracking-widest text-accent hover:underline flex items-center gap-1 group">
                 Vault <ArrowUpRight size={12} className="group-hover:text-secondary transition-all" />
               </Link>
            </div>
            
            <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar-hidden">
               {recentNotes.map((note) => (
                 <div 
                   key={note.id} 
                   onContextMenu={(e) => {
                     e.preventDefault();
                     showMenu(e.clientX, e.clientY, [
                       { label: "Copy Objective", icon: <CopyIcon size={14} />, onClick: () => {
                          navigator.clipboard.writeText(note.content);
                          showToast("Knowledge Copied", "success");
                       } },
                       { label: "Terminate Knowledge", icon: <Trash2 size={14} />, variant: "destructive", onClick: async () => {
                          if (user) {
                            await deleteDoc(doc(db, `users/${user.uid}/notes`, note.id));
                            showToast("Knowledge Purged", "error");
                          }
                       } },
                     ], "Knowledge Node");
                   }}
                   className="p-3 rounded-xl bg-zinc-900/20 border border-zinc-800/50 hover:border-zinc-700 transition-all cursor-context-menu"
                 >
                    <p className="text-[11px] font-bold text-zinc-400 line-clamp-1 group-hover:text-white">
                       {note.content}
                    </p>
                 </div>
               ))}
               {!recentNotes.length && (
                  <div className="py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-800">No recent notes</div>
               )}
            </div>
          </motion.div>

          {/* 4. ACTIVITY TIMELINE (Right Side, Below Tasks) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-6 lg:col-start-7 lg:row-span-1 glass-card rounded-2xl p-6 flex flex-col gap-4 border border-zinc-800/80 shadow-glow shadow-primary/0 hover:shadow-primary/5 transition-all"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Activity Timeline</h2>
              <Link href="/history" className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline">View All</Link>
            </div>
            <div className="flex flex-col gap-2">
              {recentHistory.length > 0 ? recentHistory.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-1.5 rounded-lg border border-transparent hover:border-zinc-800/50 transition-all group">
                   <div className="w-7 h-7 rounded-lg bg-zinc-950/50 flex items-center justify-center shrink-0 border border-zinc-900 group-hover:border-primary/30 transition-colors">
                      {item.category === "Vault" ? <LinkIcon size={12} className="text-zinc-600" /> : 
                       item.category === "Drive" ? <HardDrive size={12} className="text-zinc-600" /> :
                       <Search size={12} className="text-zinc-600" />}
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-zinc-300 truncate tracking-tight">{item.title}</p>
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600 mt-0.5">{item.category}</p>
                   </div>
                   <a href={item.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-500 hover:text-white">
                      <ArrowUpRight size={14} />
                   </a>
                </div>
              )) : (
                <div className="py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-800">No recent activity</div>
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
