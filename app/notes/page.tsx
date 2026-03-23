"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  StickyNote, 
  Search, 
  Trash2, 
  Clock, 
  Maximize2,
  X,
  Tag,
  PlusCircle,
  Hash,
  Copy,
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
import { useToast } from "@/context/ToastContext";
import { useKeyboardActions } from "@/hooks/useKeyboardActions";
import { useContextMenu } from "@/context/ContextMenuContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function NotesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showMenu, hideMenu } = useContextMenu();
  
  const [notes, setNotes] = useState<any[]>([]);
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: "add" | "edit"; note?: any }>({
    isOpen: false,
    mode: "add",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  
  const [form, setForm] = useState({ content: "", projectTag: "" });
  const { showToast } = useToast();
  const [hoveredNote, setHoveredNote] = useState<any>(null);

  const deleteNoteFunc = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/notes`, id));
      showToast("Knowledge Purged", "error");
    } catch (e) {
      showToast("Purge Failure", "error");
    }
  };

  useKeyboardActions({
    onCopy: () => {
      if (hoveredNote) {
        navigator.clipboard.writeText(hoveredNote.content);
        showToast("Knowledge Copied to Clipboard", "success");
      }
    },
    onDelete: () => {
      if (hoveredNote) deleteNoteFunc(hoveredNote.id);
    }
  });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, `users/${user.uid}/notes`), orderBy("updatedAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.content) return;
    
    if (modalState.mode === "add") {
      await addDoc(collection(db, `users/${user.uid}/notes`), {
        ...form,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (modalState.mode === "edit" && modalState.note) {
      await updateDoc(doc(db, `users/${user.uid}/notes`, modalState.note.id), {
        ...form,
        updatedAt: serverTimestamp(),
      });
    }

    setForm({ content: "", projectTag: "" });
    setModalState({ isOpen: false, mode: "add" });
    showToast(modalState.mode === "add" ? "Thought Initialized" : "Document Updated", "success");
  };

  const deleteNote = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/notes`, id));
    showToast("Knowledge Purged", "error");
  };

  const duplicateNote = async (note: any) => {
    if (!user || !note) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/notes`), {
        content: note.content,
        projectTag: note.projectTag || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("Thought Duplicated", "success");
    } catch (e) {
      showToast("Duplication Failure", "error");
    }
  };

  const handleNoteContextMenu = (e: React.MouseEvent, note: any) => {
    e.preventDefault();
    showMenu(e.clientX, e.clientY, [
      { 
        label: "Edit Reference", 
        icon: <Edit2 size={14} />, 
        onClick: () => {
          setForm({ content: note.content, projectTag: note.projectTag || "" });
          setIsPreview(false);
          setModalState({ isOpen: true, mode: "edit", note });
        }
      },
      { label: "Duplicate Thought", icon: <Copy size={14} />, onClick: () => duplicateNote(note) },
      { label: "Purge Record", icon: <Trash2 size={14} />, onClick: () => deleteNoteFunc(note.id), variant: "destructive" },
    ], note.projectTag || "General Thought");
  };

  const filteredNotes = notes.filter(note => 
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.projectTag?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-8 lg:p-16 flex flex-col gap-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Knowledge Base</h1>
          <p className="text-zinc-500 text-sm font-medium">Quick thoughts and detailed brainstorming.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-zinc-950 border border-zinc-900 px-6 py-3.5 rounded-2xl flex items-center gap-4 w-80 transition-all focus-within:border-primary/50 shadow-glow shadow-primary/5">
            <Search size={18} className="text-zinc-600" />
            <input 
              type="text" 
              placeholder="Search knowledge..." 
              className="bg-transparent border-none outline-none text-base flex-1 font-bold text-white placeholder:text-zinc-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setForm({ content: "", projectTag: "" });
              setIsPreview(false);
              setModalState({ isOpen: true, mode: "add" });
            }}
            className="bg-foreground text-background px-5 py-2.5 rounded-xl text-sm font-bold shadow-soft hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2"
          >
            <PlusCircle size={20} />
            Initialize Thought
          </button>
        </div>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredNotes.map(note => (
            <motion.div 
              key={note.id}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              onMouseEnter={() => setHoveredNote(note)}
              onMouseLeave={() => setHoveredNote(null)}
               onClick={() => {
                 setForm({ content: note.content, projectTag: note.projectTag || "" });
                 setIsPreview(false);
                 setModalState({ isOpen: true, mode: "edit", note });
               }}
               onContextMenu={(e) => handleNoteContextMenu(e, note)}
               className="bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 hover:border-zinc-700 hover:shadow-xl transition-all group flex flex-col min-h-[200px] cursor-pointer relative"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-900">
                   <Hash size={12} className="text-primary" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                     {note.projectTag || 'General'}
                   </span>
                </div>
              </div>
              
              <div className="flex-1">
                 <div className="text-zinc-400 leading-relaxed text-sm line-clamp-5 font-medium markdown-content prose prose-invert prose-sm">
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {note.content}
                   </ReactMarkdown>
                 </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-zinc-800/50 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-zinc-600">
                   <Clock size={14} />
                   <span className="text-[10px] font-bold uppercase tracking-widest">
                     {note.updatedAt ? new Date(note.updatedAt.toDate()).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'recently'}
                   </span>
                 </div>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setForm({ content: note.content, projectTag: note.projectTag || "" });
                     setModalState({ isOpen: true, mode: "edit", note });
                   }}
                   className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                 >
                   Edit Reference
                 </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredNotes.length === 0 && (
          <div className="col-span-full py-32 text-center bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl">
            <StickyNote size={40} className="mx-auto text-zinc-800 mb-4" />
            <p className="text-zinc-600 text-sm font-medium">No notes created yet.</p>
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
              className="bg-zinc-900 max-w-2xl w-full p-10 rounded-[2.5rem] shadow-2xl relative border border-zinc-800 z-10"
            >
              <button onClick={() => setModalState({ isOpen: false, mode: "add" })} className="absolute top-8 right-8 text-zinc-700 hover:text-white transition-colors"><X size={24} /></button>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">{modalState.mode === "add" ? "Initialize Note" : "Update Document"}</h2>
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 mr-12">
                   <button 
                     type="button" 
                     onClick={() => setIsPreview(false)}
                     className={cn("px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", !isPreview ? "bg-primary text-white" : "text-zinc-500")}
                   >Edit</button>
                   <button 
                     type="button" 
                     onClick={() => setIsPreview(true)}
                     className={cn("px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", isPreview ? "bg-primary text-white" : "text-zinc-500")}
                   >Preview</button>
                </div>
              </div>
              <form onSubmit={handleSaveNote} className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4 block font-mono">_content</label>
                  {isPreview ? (
                    <div className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-8 py-8 min-h-[350px] overflow-y-auto markdown-content prose prose-invert prose-blue max-w-none">
                       <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <textarea 
                      required autoFocus
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-8 py-8 outline-none focus:border-primary/50 transition-all font-medium text-lg leading-relaxed text-white min-h-[350px] resize-none placeholder:text-zinc-800"
                      placeholder="Support markdown... # Header, **bold**, [link](url)"
                      value={form.content}
                      onChange={e => setForm({...form, content: e.target.value})}
                    />
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 block font-mono">_project_tag</label>
                    <input 
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-5 py-3.5 outline-none focus:border-primary/50 transition-all font-bold text-xs text-white uppercase tracking-widest placeholder:text-zinc-800"
                      placeholder="e.g. MARKETING"
                      value={form.projectTag}
                      onChange={e => setForm({...form, projectTag: e.target.value.toUpperCase()})}
                    />
                  </div>
                  {modalState.mode === "edit" && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (confirm("Permanently erase this record?")) {
                          deleteNote(modalState.note.id);
                          setModalState({ isOpen: false, mode: "add" });
                        }
                      }}
                      className="mt-6 p-4 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    className="flex-1 bg-primary text-white py-5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-glow shadow-primary/10 transition-all"
                  >
                    {modalState.mode === "add" ? "Commit_Changes" : "Push_Updates"}
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
