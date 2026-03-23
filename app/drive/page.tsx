"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  Trash2, 
  Copy as CopyIcon, 
  ExternalLink,
  PlusCircle,
  FolderOpen,
  Check,
  FileText,
  Table,
  Presentation,
  Database,
  Link as LinkIconAlt,
  Edit2
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { useContextMenu } from "@/context/ContextMenuContext";
import { useToast } from "@/context/ToastContext";
import { useLinking } from "@/context/LinkingContext";
import { useKeyboardActions } from "@/hooks/useKeyboardActions";
import { useHistory } from "@/hooks/useHistory";

const typeStyles = {
  Sheet: { color: "#16A34A", icon: Table, bg: "rgba(22, 163, 74, 0.1)" },
  Form: { color: "#9333EA", icon: Database, bg: "rgba(147, 51, 234, 0.1)" },
  Doc: { color: "#2563EB", icon: FileText, bg: "rgba(37, 99, 235, 0.1)" },
  Slide: { color: "#EAB308", icon: Presentation, bg: "rgba(234, 179, 8, 0.1)" },
  Folder: { color: "#71717a", icon: FolderOpen, bg: "rgba(113, 113, 122, 0.1)" },
  Link: { color: "#4F46E5", icon: LinkIconAlt, bg: "rgba(79, 70, 229, 0.1)" },
};

export default function DrivePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showMenu } = useContextMenu();
  const { logInteraction } = useHistory();
  
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: "add" | "edit"; item?: any }>({
    isOpen: false,
    mode: "add",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { copyRef } = useLinking();
  const [hoveredFile, setHoveredFile] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const deleteFileFunc = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/drive`, id));
      showToast("Resource Terminated", "error");
    } catch (e) {
      showToast("Termination Failure", "error");
    }
  };

  const renameFile = async (item: any) => {
    if (!user || !item) return;
    const newTitle = prompt("Enter new record identity:", item.title || "");
    if (newTitle) {
      try {
        await updateDoc(doc(db, `users/${user.uid}/drive`, item.id), { title: newTitle });
        showToast("Record Updated", "success");
      } catch (e) {
        showToast("Update Failure", "error");
      }
    }
  };

  useKeyboardActions({
    onCopy: () => {
      if (hoveredFile) {
        copyRef({ id: hoveredFile.id, type: "drive", title: hoveredFile.title });
        showToast("Reference Copied to Clipboard", "success");
      }
    },
    onRename: () => {
      if (hoveredFile) renameFile(hoveredFile);
    },
    onDelete: () => {
      if (hoveredFile) deleteFileFunc(hoveredFile.id);
    }
  });

  const [form, setForm] = useState({ title: "", url: "", projectTag: "General", type: "Doc", notes: "", projectId: "" });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, `users/${user.uid}/drive`), orderBy("createdAt", "desc"));
      const unsubscribeDrive = onSnapshot(q, (snapshot) => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      const pq = query(collection(db, `users/${user.uid}/projects`), orderBy("name", "asc"));
      const unsubscribeProjects = onSnapshot(pq, (snapshot) => {
        setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      return () => { unsubscribeDrive(); unsubscribeProjects(); };
    }
  }, [user]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.url) return;
    
    if (modalState.mode === "add") {
      await addDoc(collection(db, `users/${user.uid}/drive`), {
        ...form,
        createdAt: serverTimestamp(),
      });
    } else if (modalState.mode === "edit" && modalState.item) {
      await updateDoc(doc(db, `users/${user.uid}/drive`, modalState.item.id), {
        ...form,
        updatedAt: serverTimestamp(),
      });
    }

    setForm({ title: "", url: "", projectTag: "General", type: "Doc", notes: "", projectId: "" });
    setModalState({ isOpen: false, mode: "add" });
    showToast(modalState.mode === "add" ? "Resource Initialized" : "Metadata Updated", "success");
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast("URL Copied to Clipboard", "success");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/drive`, id));
  };

  const handleInlineSave = async (id: string) => {
    if (!user || !editValue.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateDoc(doc(db, `users/${user.uid}/drive`, id), { title: editValue.trim() });
      setEditingId(null);
      showToast("Drive record updated inline", "success");
    } catch (e) {
      showToast("Inline update failed", "error");
    }
  };

  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.projectTag?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by Project Tag
  const groups = filteredItems.reduce((acc: any, curr) => {
    const tag = curr.projectTag || "General";
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(curr);
    return acc;
  }, {});

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-8 lg:p-16 flex flex-col gap-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Central Drive</h1>
          <p className="text-zinc-500 text-sm font-medium">Access all your project essential files and folders.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-zinc-950 border border-zinc-900 px-6 py-3.5 rounded-2xl flex items-center gap-4 w-80 transition-all focus-within:border-primary/50 shadow-glow shadow-primary/5">
            <Search size={18} className="text-zinc-600" />
            <input 
              type="text" 
              placeholder="Search drive resources..." 
              className="bg-transparent border-none outline-none text-base flex-1 font-bold text-white placeholder:text-zinc-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setForm({ title: "", url: "", projectTag: "General", type: "Doc", notes: "", projectId: "" });
              setModalState({ isOpen: true, mode: "add" });
            }}
            className="bg-foreground text-background px-5 py-2.5 rounded-xl text-sm font-bold shadow-soft hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2"
          >
            <PlusCircle size={20} />
            Initialize Drive_Sync
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-12">
        {Object.entries(groups).map(([tag, groupItems]: [string, any]) => (
          <div key={tag} className="flex flex-col gap-6">
             <div className="flex items-center gap-4 px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                   {tag}
                </h3>
                <div className="h-px bg-zinc-800/50 flex-1" />
             </div>

             <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-zinc-800">
                  {groupItems.map((item: any) => (
                    <div 
                      key={item.id} 
                      onContextMenu={(e) => {
                        e.preventDefault();
                        showMenu(e.clientX, e.clientY, [
                          { label: "Copy Resource URL", icon: <CopyIcon size={14} />, onClick: () => navigator.clipboard.writeText(item.url) },
                          { label: "Edit Metadata", icon: <Edit2 size={14} />, onClick: () => {
                             setForm({ title: item.title, url: item.url, projectTag: item.projectTag || "General", type: item.type || "Doc", notes: item.notes || "", projectId: item.projectId || "" });
                             setModalState({ isOpen: true, mode: "edit", item });
                          } },
                          { label: "Terminate Reference", icon: <Trash2 size={14} />, variant: "destructive", onClick: () => deleteItem(item.id) },
                        ], item.title || "Resource");
                      }}
                      className="flex items-center gap-6 px-8 py-5 hover:bg-zinc-900/40 transition-colors group cursor-context-menu"
                      onMouseEnter={() => setHoveredFile(item)}
                      onMouseLeave={() => setHoveredFile(null)}
                    >
                       <TypeIcon type={item.type || "Doc"} />
                       <div className="flex-1 min-w-0">
                          {editingId === item.id ? (
                            <input 
                              autoFocus
                              className="w-full bg-zinc-950 border border-primary/30 rounded-lg px-3 py-1 text-base font-semibold text-white outline-none focus:border-primary transition-all"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleInlineSave(item.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              onBlur={() => handleInlineSave(item.id)}
                            />
                          ) : (
                            <h4 
                              onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditValue(item.title); }}
                              className="font-semibold text-base text-zinc-100 truncate cursor-text hover:text-primary/80 transition-colors"
                            >
                              {item.title}
                            </h4>
                          )}
                          {item.notes && <p className="text-xs text-zinc-500 mt-1">{item.notes}</p>}
                          <p className="text-[10px] text-zinc-500 font-medium mt-1 truncate opacity-60 font-mono">{item.url}</p>
                       </div>
                       
                       <div className="flex items-center gap-3 shrink-0">
                          <button 
                            onClick={() => copyToClipboard(item.url, item.id)}
                            className="p-2 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all flex items-center gap-2"
                          >
                             {copiedId === item.id ? <Check size={14} className="text-primary" /> : <CopyIcon size={14} />}
                             <span className="text-[10px] font-bold uppercase tracking-widest">{copiedId === item.id ? "Copied" : "Copy"}</span>
                          </button>
                                                    <a 
                             href={item.url} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             onClick={() => logInteraction({ title: item.title, url: item.url, category: "Drive", type: item.type })}
                             className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-700/50"
                           >
                             <ExternalLink size={16} />
                           </a>

                          <button 
                            onClick={() => {
                               setForm({ title: item.title, url: item.url, projectTag: item.projectTag || "General", type: item.type || "Doc", notes: item.notes || "", projectId: item.projectId || "" });
                               setModalState({ isOpen: true, mode: "edit", item });
                            }}
                            className="p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all font-bold text-[10px] uppercase tracking-widest"
                          >
                             Edit
                          </button>

                          <button 
                            onClick={() => deleteFileFunc(item.id)}
                            className="p-2.5 rounded-lg hover:bg-red-500/10 text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="py-32 text-center bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl">
            <FolderOpen size={40} className="mx-auto text-zinc-800 mb-4" />
            <p className="text-zinc-600 text-sm font-medium">No resources linked yet.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalState.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalState({ isOpen: false, mode: "add" })}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-zinc-900 max-w-lg w-full p-10 rounded-[2.5rem] shadow-2xl relative border border-zinc-800 z-10"
            >
              <h2 className="text-2xl font-bold mb-8 text-white">{modalState.mode === "add" ? "Initialize Resource" : "Update Reference"}</h2>
              <form onSubmit={handleAddItem} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 block font-mono">_resource_title</label>
                  <input 
                    required autoFocus
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-base text-white placeholder:text-zinc-800"
                    placeholder="e.g. Project Roadmap"
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 block font-mono">_resource_url</label>
                  <input 
                    required
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white placeholder:text-zinc-800"
                    placeholder="e.g. drive.google.com/..."
                    value={form.url}
                    onChange={e => setForm({...form, url: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 block font-mono">_file_type</label>
                    <select 
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white appearance-none cursor-pointer"
                      value={form.type}
                      onChange={e => setForm({...form, type: e.target.value})}
                    >
                      <option value="Doc">Document</option>
                      <option value="Sheet">Spreadsheet</option>
                      <option value="Slide">Presentation</option>
                      <option value="Form">Form</option>
                      <option value="Folder">Folder</option>
                      <option value="Link">Web Link</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 block font-mono">_associate_project</label>
                    <select 
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white appearance-none cursor-pointer"
                      value={form.projectId}
                      onChange={e => {
                        const p = projects.find(proj => proj.id === e.target.value);
                        setForm({...form, projectId: e.target.value, projectTag: p ? p.name.toUpperCase() : "GENERAL"});
                      }}
                    >
                      <option value="">No Project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 block font-mono">_quick_notes</label>
                  <textarea 
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white min-h-[100px] resize-none placeholder:text-zinc-800"
                    placeholder="Brief description..."
                    value={form.notes}
                    onChange={e => setForm({...form, notes: e.target.value})}
                  />
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setModalState({ isOpen: false, mode: "add" })} className="flex-1 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded-2xl transition-all">Discard</button>
                  <button type="submit" className="flex-1 bg-primary text-white py-5 text-[11px] font-bold uppercase tracking-widest rounded-2xl shadow-glow transition-all">
                    {modalState.mode === "add" ? "Push_Resource" : "Push_Updates"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  const style = typeStyles[type as keyof typeof typeStyles] || typeStyles.Doc;
  const Icon = style.icon;
  
  return (
    <div 
      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-zinc-800 transition-all duration-300 group-hover:scale-110 shadow-lg"
      style={{ 
        backgroundColor: style.bg,
        borderColor: `${style.color}33`
      }}
    >
      <Icon size={22} style={{ color: style.color }} />
    </div>
  );
}
