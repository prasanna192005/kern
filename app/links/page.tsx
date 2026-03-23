"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  Trash2, 
  ExternalLink, 
  Pin, 
  Tag as TagIcon,
  PlusCircle,
  Link2,
  Globe,
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
import { Copy as CopyIcon } from "lucide-react";

export default function LinksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showMenu } = useContextMenu();
  
  const [links, setLinks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeTag, setActiveTag] = useState("All");
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: "add" | "edit"; link?: any }>({
    isOpen: false,
    mode: "add",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({ title: "", url: "", category: "General", description: "", projectId: "" });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, `users/${user.uid}/links`), orderBy("createdAt", "desc"));
      const unsubscribeLinks = onSnapshot(q, (snapshot) => {
        setLinks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      const pq = query(collection(db, `users/${user.uid}/projects`), orderBy("name", "asc"));
      const unsubscribeProjects = onSnapshot(pq, (snapshot) => {
        setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      return () => { unsubscribeLinks(); unsubscribeProjects(); };
    }
  }, [user]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.url) return;
    
    let formattedUrl = form.url;
    if (!formattedUrl.startsWith("http")) formattedUrl = "https://" + formattedUrl;

    if (modalState.mode === "add") {
      await addDoc(collection(db, `users/${user.uid}/links`), {
        ...form,
        url: formattedUrl,
        pinned: false,
        createdAt: serverTimestamp(),
      });
    } else if (modalState.mode === "edit" && modalState.link) {
      await updateDoc(doc(db, `users/${user.uid}/links`, modalState.link.id), {
        ...form,
        url: formattedUrl,
        updatedAt: serverTimestamp(),
      });
    }

    setForm({ title: "", url: "", category: "General", description: "", projectId: "" });
    setModalState({ isOpen: false, mode: "add" });
  };

  const togglePin = async (link: any) => {
    if (!user) return;
    await updateDoc(doc(db, `users/${user.uid}/links`, link.id), { pinned: !link.pinned });
  };

  const deleteLink = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/links`, id));
  };

  const filteredLinks = links.filter(l => {
    const matchesTag = activeTag === "All" || l.category === activeTag;
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         l.url.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesSearch;
  });

  const categories = ["All", ...Array.from(new Set(links.map(l => l.category)))];

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-8 lg:p-16 flex flex-col gap-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Resources</h1>
          <p className="text-zinc-500 text-sm font-medium">Curate your essential tools and links.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-zinc-950 border border-zinc-900 px-6 py-3.5 rounded-2xl flex items-center gap-4 w-80 transition-all focus-within:border-primary/50 shadow-glow shadow-primary/5">
            <Search size={18} className="text-zinc-600" />
            <input 
              type="text" 
              placeholder="Search resources..." 
              className="bg-transparent border-none outline-none text-base flex-1 font-bold text-white placeholder:text-zinc-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setForm({ title: "", url: "", category: "General", description: "", projectId: "" });
              setModalState({ isOpen: true, mode: "add" });
            }}
            className="bg-foreground text-background px-5 py-2.5 rounded-xl text-sm font-bold shadow-soft hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2"
          >
            <PlusCircle size={20} />
            Initialize Resource
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTag(cat)}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border",
              activeTag === cat 
                ? "bg-primary text-primary-foreground border-primary shadow-soft" 
                : "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-zinc-200"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredLinks.sort((a,b) => (a.pinned === b.pinned) ? 0 : a.pinned ? -1 : 1).map((link) => (
            <LinkCard 
              key={link.id} 
              link={link} 
              onTogglePin={() => togglePin(link)} 
              onDelete={() => deleteLink(link.id)} 
              onEdit={() => {
                setForm({ title: link.title, url: link.url, category: link.category || "General", description: link.description || "", projectId: link.projectId || "" });
                setModalState({ isOpen: true, mode: "edit", link });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                showMenu(e.clientX, e.clientY, [
                  { label: "Copy Link", icon: <CopyIcon size={14} />, onClick: () => navigator.clipboard.writeText(link.url) },
                  { label: "Edit Resource", icon: <Edit2 size={14} />, onClick: () => {
                    setForm({ title: link.title, url: link.url, category: link.category || "General", description: link.description || "", projectId: link.projectId || "" });
                    setModalState({ isOpen: true, mode: "edit", link });
                  } },
                  { label: link.pinned ? "Unpin Reference" : "Pin Reference", icon: <Pin size={14} />, onClick: () => togglePin(link) },
                  { label: "Delete Resource", icon: <Trash2 size={14} />, variant: "destructive", onClick: () => deleteLink(link.id) },
                ], link.title || "Link System");
              }}
            />
          ))}
        </AnimatePresence>

        {filteredLinks.length === 0 && (
          <div className="col-span-full py-32 text-center bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl">
            <Link2 size={40} className="mx-auto text-zinc-800 mb-4" />
            <p className="text-zinc-600 text-sm font-medium">No resources found.</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
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
              <h2 className="text-2xl font-bold mb-8 text-white">{modalState.mode === "add" ? "Add New Resource" : "Update Reference"}</h2>
              <form onSubmit={handleAddLink} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block font-mono">_resource_url</label>
                  <div className="flex items-center gap-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 focus-within:border-primary/50 transition-all">
                    <Globe size={18} className="text-zinc-700" />
                    <input 
                      required autoFocus
                      className="w-full bg-transparent border-none outline-none font-medium text-base text-white placeholder:text-zinc-800"
                      placeholder="e.g. workspace.io"
                      value={form.url}
                      onChange={e => setForm({...form, url: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block font-mono">_display_name</label>
                  <input 
                    required
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white placeholder:text-zinc-800"
                    placeholder="Clear and descriptive..."
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block font-mono">_tag_category</label>
                    <input 
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white placeholder:text-zinc-800"
                      placeholder="e.g. Reference"
                      value={form.category}
                      onChange={e => setForm({...form, category: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block font-mono">_associate_project</label>
                    <select 
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white appearance-none cursor-pointer"
                      value={form.projectId}
                      onChange={e => setForm({...form, projectId: e.target.value})}
                    >
                      <option value="">No Project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setModalState({ isOpen: false, mode: "add" })} className="flex-1 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded-2xl transition-all">Discard</button>
                  <button type="submit" className="flex-1 bg-primary text-white py-5 text-[11px] font-bold uppercase tracking-widest rounded-2xl shadow-glow transition-all">
                    {modalState.mode === "add" ? "Initialize_Save" : "Push_Update"}
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

function LinkCard({ link, onTogglePin, onDelete, onEdit, onContextMenu }: { link: any, onTogglePin: () => void, onDelete: () => void, onEdit: () => void, onContextMenu: (e: React.MouseEvent) => void }) {
  const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${new URL(link.url).hostname}`;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      onContextMenu={onContextMenu}
      className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800 hover:border-zinc-700 hover:shadow-xl transition-all group flex flex-col gap-5 relative overflow-hidden cursor-context-menu"
    >
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center p-2 shrink-0 shadow-sm overflow-hidden">
          <img src={faviconUrl} alt="" className="w-6 h-6 object-contain" onError={(e) => (e.currentTarget.src = "/globe.png")} />
        </div>
        <div className="flex items-center gap-2">
            {link.projectId && (
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest border border-primary/20">
                PROJ_LINK
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[9px] font-bold uppercase tracking-widest border border-zinc-700/50">
              {link.category || 'GENERAL'}
            </span>
            <button 
              onClick={onTogglePin}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                link.pinned ? "text-primary bg-primary/10" : "text-zinc-600 hover:text-primary opacity-0 group-hover:opacity-100"
              )}
            >
              <Pin size={14} className={link.pinned ? "fill-current text-primary" : ""} />
            </button>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-semibold text-sm text-zinc-100 line-clamp-1 group-hover:text-primary transition-colors leading-tight">
          {link.title || link.url}
        </h3>
        <p className="text-[11px] text-zinc-500 font-medium mt-1 truncate lowercase">
          {new URL(link.url).hostname}
        </p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-4">
          <a 
            href={link.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 hover:text-primary hover:underline transition-colors"
          >
            Open Link <ExternalLink size={12} />
          </a>
          <button 
            onClick={onEdit}
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
          >
            Edit
          </button>
        </div>
        <button 
          onClick={onDelete}
          className="p-1.5 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}
