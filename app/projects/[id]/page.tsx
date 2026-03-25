"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Folder, 
  ChevronLeft, 
  Search, 
  Link as LinkIcon, 
  HardDrive, 
  ExternalLink,
  Copy as CopyIcon,
  Trash2,
  Plus,
  ArrowUpRight,
  Edit2,
  Table,
  Database,
  FileText,
  Presentation,
  FolderOpen,
  RotateCcw
} from "lucide-react";
import { 
  collection, 
  query, 
  where,
  onSnapshot, 
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { useLinking } from "@/context/LinkingContext";
import { useContextMenu } from "@/context/ContextMenuContext";
import { useKeyboardActions } from "@/hooks/useKeyboardActions";
import { cn } from "@/lib/utils";

const typeStyles = {
  Sheet: { color: "#16A34A", icon: Table, bg: "rgba(22, 163, 74, 0.1)" },
  Form: { color: "#9333EA", icon: Database, bg: "rgba(147, 51, 234, 0.1)" },
  Doc: { color: "#2563EB", icon: FileText, bg: "rgba(37, 99, 235, 0.1)" },
  Slide: { color: "#EAB308", icon: Presentation, bg: "rgba(234, 179, 8, 0.1)" },
  Folder: { color: "#71717a", icon: FolderOpen, bg: "rgba(113, 113, 122, 0.1)" },
  Link: { color: "#4F46E5", icon: LinkIcon, bg: "rgba(79, 70, 229, 0.1)" },
};

export default function ProjectDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const { showMenu } = useContextMenu();
  const { activeRef, clearRef } = useLinking();
  
  const [project, setProject] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [driveItems, setDriveItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredResource, setHoveredResource] = useState<any>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // "vault" | "drive"

  useKeyboardActions({
    onCopy: () => {
      if (hoveredResource) {
        navigator.clipboard.writeText(hoveredResource.url);
        showToast("Permanent Link Copied", "success");
      }
    },
    onPaste: () => {
      if (activeRef) handleLinkResource();
    },
    onDelete: () => {
      if (hoveredResource) detachResource(hoveredResource);
    }
  });

  const detachResource = async (resource: any) => {
     if (!user || !resource) return;
     try {
       const collectionName = resource.type === "drive" ? "drive" : "links";
       await updateDoc(doc(db, `users/${user.uid}/${collectionName}`, resource.id), { projectId: null });
       showToast("Resource Detached", "info");
     } catch (e) {
       showToast("Detachment Failed", "error");
     }
  };

  const handleLinkResource = async () => {
    if (!user || !activeRef || !params.id) return;
    try {
      const collectionName = activeRef.type === "link" ? "links" : "drive";
      await updateDoc(doc(db, `users/${user.uid}/${collectionName}`, activeRef.id), {
        projectId: params.id
      });
      showToast(`${activeRef.title} linked to project`, "success");
      clearRef();
    } catch (e) {
      showToast("Linking Failed", "error");
    }
  };

  const onDragStart = (e: React.DragEvent, item: any, source: "vault" | "drive") => {
    e.dataTransfer.setData("application/json", JSON.stringify({ item, source }));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, target: "vault" | "drive") => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move"; // Explicitly set the cursor to 'move'
    setDragOverTarget(target);
  };

  const onDrop = async (e: React.DragEvent, target: "vault" | "drive") => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!user) return;

    try {
      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData) return;
      const { item, source } = JSON.parse(rawData);

      if (source === target) return; // same collection

      const sourceColl = source === "vault" ? "links" : "drive";
      const targetColl = target === "vault" ? "links" : "drive";

      // 1. Create in Target
      const newDocData: any = {
        title: item.title,
        url: item.url,
        projectId: params.id,
        createdAt: serverTimestamp(),
      };

      if (target === "drive") {
        newDocData.projectTag = project?.name?.toUpperCase() || "GENERAL";
        newDocData.type = "Link"; // Mark as Link when coming from Vault
      } else {
        newDocData.category = project?.name || "General";
      }

      await addDoc(collection(db, `users/${user.uid}/${targetColl}`), newDocData);

      // 2. Delete from Source
      await deleteDoc(doc(db, `users/${user.uid}/${sourceColl}`, item.id));

      showToast(`Moved to ${target === "vault" ? "Vault" : "Drive"}`, "success");
    } catch (error) {
      console.error("Drop failed:", error);
      showToast("Transfer Failed", "error");
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user && params.id) {
      // Sync Project Metadata
      const unsubProj = onSnapshot(doc(db, `users/${user.uid}/projects`, params.id as string), (d) => {
        if (d.exists()) {
          setProject({ id: d.id, ...d.data() });
        } else {
          router.push("/projects");
        }
        setIsLoading(false);
      });

      // Sync Linked Resources
      const lq = query(collection(db, `users/${user.uid}/links`), where("projectId", "==", params.id));
      const unsubLinks = onSnapshot(lq, (s) => setLinks(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      const dq = query(collection(db, `users/${user.uid}/drive`), where("projectId", "==", params.id));
      const unsubDrive = onSnapshot(dq, (s) => setDriveItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      return () => { unsubProj(); unsubLinks(); unsubDrive(); };
    }
  }, [user, params.id, router]);

  if (loading || isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-8 lg:p-12 pt-24 lg:pt-32 relative overflow-hidden">
      <div className="fixed inset-0 bg-mesh opacity-10 pointer-events-none" />
      
      <motion.button 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => router.push("/projects")}
        className="fixed top-12 left-8 lg:left-12 z-50 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 hover:text-primary transition-all group"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Return_to_Infrastructure
      </motion.button>

      {/* Header */}
      <header className="mb-20 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
           <div className="space-y-6 max-w-2xl">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-primary shadow-glow">
                  <Folder size={28} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Project_ID: {project.id.slice(0, 8)}</span>
                  <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-white italic">{project.name}<span className="text-primary">.</span></h1>
                </div>
              </div>
              <p className="text-lg text-zinc-400 font-medium leading-relaxed">{project.description || "Experimental architecture for modular systems. No further documentation provided."}</p>
           </div>

           <div className="flex gap-4">
             <div className="glass-card px-8 py-6 rounded-3xl border border-zinc-800 flex flex-col justify-between min-w-[160px]">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Resources</span>
                <span className="text-4xl font-black text-white tabular-nums">{links.length + driveItems.length}</span>
             </div>
             <div className="glass-card px-8 py-6 rounded-3xl border border-zinc-800 flex flex-col justify-between min-w-[160px]">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Hierarchy</span>
                <span className="text-4xl font-black text-primary italic uppercase tracking-tighter">{project.tag || "Active"}</span>
             </div>
           </div>
        </div>
      </header>

      {/* Linking Notifier */}
      <AnimatePresence>
        {activeRef && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[150] w-full max-w-xl px-6"
          >
            <div className="bg-zinc-950 border-2 border-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)] rounded-2xl p-6 flex flex-col gap-4 backdrop-blur-xl">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-glow">
                        {activeRef.type === "link" ? <LinkIcon size={20} /> : <HardDrive size={20} />}
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ready_to_Link</span>
                        <span className="text-sm font-bold text-white tracking-tight truncate max-w-[200px]">{activeRef.title}</span>
                     </div>
                  </div>
                  <div className="flex gap-3">
                     <button 
                       onClick={clearRef}
                       className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-900 transition-all"
                     >
                       Cancel
                     </button>
                     <button 
                       onClick={handleLinkResource}
                       className="px-6 py-2 bg-primary text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2"
                     >
                       <Plus size={14} />
                       Link_to_Infrastructure
                     </button>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
        
        {/* Linked Vault Resources */}
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
                 <LinkIcon size={14} className="text-primary" /> _vault_resources
              </h2>
              <span className="text-[10px] font-bold text-zinc-700">{links.length} objects</span>
           </div>

            <div 
              className={cn(
                "flex flex-col gap-3 p-4 rounded-3xl transition-all border-2 border-transparent relative",
                dragOverTarget === "vault" ? "bg-primary/10 border-primary/40 border-dashed scale-[1.01] shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]" : ""
              )}
              onDragOver={(e) => onDragOver(e, "vault")}
              onDrop={(e) => onDrop(e, "vault")}
              onDragLeave={() => setDragOverTarget(null)}
            >
              {links.map((link, i) => (
                <motion.a 
                  key={link.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  href={link.url} target="_blank" rel="noopener noreferrer"
                  draggable={true}
                  onDragStartCapture={(e: any) => onDragStart(e, link, "vault")}
                  onMouseEnter={() => setHoveredResource({ ...link, type: "link" })}
                  onMouseLeave={() => setHoveredResource(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    showMenu(e.clientX, e.clientY, [
                      { label: "Copy Deep Link", icon: <CopyIcon size={14} />, onClick: () => {
                         navigator.clipboard.writeText(link.url);
                         showToast("Permanent Link Copied", "success");
                      }},
                      { label: "Detach from Project", icon: <Trash2 size={14} />, variant: "destructive", onClick: async () => {
                         await updateDoc(doc(db, `users/${user.uid}/links`, link.id), { projectId: null });
                         showToast("Resource Detached", "info");
                      }}
                    ], link.title || "Untitled Resource");
                  }}
                  className="glass-card flex items-center gap-6 p-5 rounded-2xl border border-zinc-800/50 hover:border-primary/30 group transition-all cursor-grab active:cursor-grabbing"
                >
                  <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center group-hover:bg-primary/5 transition-all">
                    <img src={`https://www.google.com/s2/favicons?sz=64&domain=${new URL(link.url).hostname}`} alt="" className="w-6 h-6 transition-all" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors truncate">{link.title || "Unnamed Link"}</h3>
                    <p className="text-[10px] font-mono text-zinc-600 truncate">{new URL(link.url).hostname}</p>
                  </div>
                  <ArrowUpRight size={18} className="text-zinc-700 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </motion.a>
              ))}
              {links.length === 0 && (
                <div className="h-40 glass-card rounded-2xl flex items-center justify-center border-dashed border-zinc-900 border-2">
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800">no_vault_references</p>
                </div>
              )}
           </div>
        </div>

        {/* Linked Drive Records */}
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
                 <HardDrive size={14} className="text-secondary" /> _drive_records
              </h2>
              <span className="text-[10px] font-bold text-zinc-700">{driveItems.length} objects</span>
           </div>

            <div 
              className={cn(
                "flex flex-col gap-3 p-4 rounded-3xl transition-all border-2 border-transparent relative",
                dragOverTarget === "drive" ? "bg-secondary/10 border-secondary/40 border-dashed scale-[1.01] shadow-[0_0_20px_rgba(var(--secondary-rgb),0.2)]" : ""
              )}
              onDragOver={(e) => onDragOver(e, "drive")}
              onDrop={(e) => onDrop(e, "drive")}
              onDragLeave={() => setDragOverTarget(null)}
            >
              {driveItems.map((file, i) => (
                <motion.a 
                  key={file.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  href={file.url} target="_blank" rel="noopener noreferrer"
                  draggable={true}
                  onDragStartCapture={(e: any) => onDragStart(e, file, "drive")}
                  onMouseEnter={() => setHoveredResource({ ...file, type: "drive" })}
                  onMouseLeave={() => setHoveredResource(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    showMenu(e.clientX, e.clientY, [
                      { label: "Copy Reference URL", icon: <CopyIcon size={14} />, onClick: () => {
                         navigator.clipboard.writeText(file.url);
                         showToast("File URL Copied", "success");
                      }},
                      { label: "Detach from Project", icon: <Trash2 size={14} />, variant: "destructive", onClick: async () => {
                         await updateDoc(doc(db, `users/${user.uid}/drive`, file.id), { projectId: null });
                         showToast("Record Detached", "info");
                      }}
                    ], file.title || "Untitled Drive Item");
                  }}
                  className="glass-card flex items-center gap-6 p-5 rounded-2xl border border-zinc-800/50 hover:border-secondary/30 group transition-all cursor-grab active:cursor-grabbing"
                >
                  <div 
                    className="w-12 h-12 rounded-xl border border-zinc-900 bg-zinc-950 flex items-center justify-center shrink-0 group-hover:bg-zinc-900 transition-all"
                    style={{ 
                      backgroundColor: (typeStyles[file.type as keyof typeof typeStyles] || typeStyles.Doc).bg,
                      borderColor: `${(typeStyles[file.type as keyof typeof typeStyles] || typeStyles.Doc).color}33`
                    }}
                  >
                    {React.createElement((typeStyles[file.type as keyof typeof typeStyles] || typeStyles.Doc).icon, { 
                      size: 20, 
                      style: { color: (typeStyles[file.type as keyof typeof typeStyles] || typeStyles.Doc).color } 
                    })}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white group-hover:text-secondary transition-colors truncate">{file.title || "Unnamed File"}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Project_Resource</p>
                  </div>
                  <ExternalLink size={18} className="text-zinc-700 group-hover:text-white transition-all opacity-0 group-hover:opacity-100" />
                </motion.a>
              ))}
              {driveItems.length === 0 && (
                <div className="h-40 glass-card rounded-2xl flex items-center justify-center border-dashed border-zinc-900 border-2">
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800">no_drive_references</p>
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
