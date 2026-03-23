"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { 
  Folder, 
  Plus, 
  Search, 
  LayoutDashboard, 
  ArrowUpRight,
  MoreVertical,
  Zap,
  CheckCircle2,
  Clock
} from "lucide-react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useContextMenu } from "@/context/ContextMenuContext";
import { Edit2, ExternalLink } from "lucide-react";

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [driveItems, setDriveItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", tag: "Active" });

  const { showMenu } = useContextMenu();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const pq = query(collection(db, `users/${user.uid}/projects`), orderBy("createdAt", "desc"));
      const unsubscribeProjects = onSnapshot(pq, (s) => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      const lq = query(collection(db, `users/${user.uid}/links`));
      const unsubscribeLinks = onSnapshot(lq, (s) => setLinks(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      const dq = query(collection(db, `users/${user.uid}/drive`));
      const unsubscribeDrive = onSnapshot(dq, (s) => setDriveItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      return () => { unsubscribeProjects(); unsubscribeLinks(); unsubscribeDrive(); };
    }
  }, [user]);

  const deleteProject = async (id: string) => {
    if (!user) return;
    if (confirm("Terminate project infrastructure? This action is irreversible.")) {
      await deleteDoc(doc(db, `users/${user.uid}/projects`, id));
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newProject.name.trim()) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/projects`), {
        ...newProject,
        createdAt: serverTimestamp(),
      });
      setNewProject({ name: "", description: "", tag: "Active" });
      setIsAdding(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-8 lg:p-12 pt-24 lg:pt-32 relative">
      <div className="fixed inset-0 bg-mesh opacity-10 pointer-events-none" />
      
      <header className="mb-16 flex flex-col lg:flex-row lg:items-end justify-between gap-8 relative z-10">
        <div className="space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary flex items-center gap-3">
            <span className="w-12 h-0.5 bg-primary" /> system_infrastructure
          </div>
          <h1 className="text-6xl lg:text-8xl font-black tracking-tighter text-white leading-none">
            Projects<span className="text-primary italic">.</span>
          </h1>
        </div>
        
        <button 
          onClick={() => setIsAdding(true)}
          className="h-14 px-8 bg-zinc-100 text-zinc-950 font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-primary transition-all flex items-center gap-3 shadow-soft group"
        >
          <Plus size={18} className="group-hover:scale-110 transition-transform" />
          Initialize_Project
        </button>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {projects.map((project, i) => {
          const projectLinks = links.filter(l => l.projectId === project.id);
          const projectDrive = driveItems.filter(d => d.projectId === project.id);
          const totalResources = projectLinks.length + projectDrive.length;

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-3xl p-8 border border-zinc-800/80 hover:border-zinc-700 transition-all group overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[40px] -mr-16 -mt-16 group-hover:bg-primary/10 transition-all" />
              
              <div className="flex items-start justify-between mb-8">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                  <Folder size={20} />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  project.tag === "Active" ? "border-primary/20 text-primary bg-primary/5" : "border-zinc-800 text-zinc-600"
                )}>
                  {project.tag}
                </div>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2 tracking-tight group-hover:text-primary transition-colors">{project.name}</h3>
              <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed mb-8">{project.description || "Experimental architecture and layout design for modular system."}</p>

              <div className="pt-6 border-t border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">{totalResources}</span>
                      <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Resources</span>
                   </div>
                   <div className="w-px h-6 bg-zinc-900" />
                   <div className="flex -space-x-2">
                    {projectLinks.slice(0, 3).map((l, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center overflow-hidden">
                        <img src={`https://www.google.com/s2/favicons?sz=64&domain=${new URL(l.url).hostname}`} alt="" className="w-3 h-3 grayscale" />
                      </div>
                    ))}
                  </div>
                </div>
                <button className="text-zinc-500 hover:text-white transition-colors">
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </motion.div>
          );
        })}

        {/* Empty State */}
        {projects.length === 0 && !isAdding && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-zinc-800">
             <div className="w-20 h-20 rounded-full border-2 border-dashed border-zinc-900 flex items-center justify-center mb-6">
               <Folder size={32} className="opacity-20" />
             </div>
             <p className="font-bold uppercase tracking-[0.3em] text-[11px]">awaiting_input</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsAdding(false)}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl p-10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32" />
            
            <h2 className="text-3xl font-black text-white italic tracking-tighter mb-8">Initialize_Project</h2>
            
            <form onSubmit={handleAddProject} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">Identity_Name</label>
                <input 
                  autoFocus
                  type="text"
                  placeholder="Kern Dashboard..."
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-4 text-white placeholder:text-zinc-800 outline-none focus:border-primary transition-all"
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">Description_String</label>
                <textarea 
                  placeholder="Primary workspace for editorial systems..."
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-4 text-white placeholder:text-zinc-800 outline-none focus:border-primary transition-all h-32 resize-none"
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 h-12 rounded-xl border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-900 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-2 px-8 h-12 bg-primary text-zinc-950 font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-white transition-all"
                >
                  Construct_System
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
