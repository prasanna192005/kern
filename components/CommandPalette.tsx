"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Search, 
  LayoutDashboard, 
  CheckSquare, 
  Link as LinkIcon, 
  HardDrive, 
  StickyNote, 
  LogOut, 
  FileText, 
  Table, 
  Presentation, 
  ArrowRight,
  Folder,
  Database,
  Plus,
  CloudDownload,
  Trash2,
  Edit3,
  ExternalLink,
  Mic
} from "lucide-react";
import { 
  collection,
  query,
  addDoc,
  serverTimestamp,
  where,
  getDocs,
  limit,
  doc,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { useHistory } from "@/hooks/useHistory";

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  
  const { user, logOut, gdriveToken, signInWithGoogleDrive } = useAuth();
  const { showToast } = useToast();
  const { logInteraction } = useHistory();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const isOpenRef = useRef(isOpen);
  const isListeningRef = useRef(isListening);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSelectedIndex(0);
      setConfirmingId(null);
      // If opened via wake word, we might want to start listening for command immediately
    }
  }, [isOpen]);

  // --- Simplified Voice Logic ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        if (!isOpenRef.current || !isListeningRef.current) return;
        
        const results = event.results;
        const fullTranscript = Array.from(results)
          .map((result: any) => result[0].transcript)
          .join("");
        setQueryText(fullTranscript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        if (event.error === "aborted" || event.error === "no-speech") {
          setIsListening(false);
          return;
        }
        console.error("Speech Recognition Error:", event.error);
        if (event.error === "not-allowed") {
          showToast("Microphone Permission Denied", "error");
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    if (isListening && isOpen) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    } else {
      try {
        recognitionRef.current.stop();
        if (isListening) setIsListening(false);
      } catch (e) {}
    }

    return () => {
      recognitionRef.current?.stop();
    };
    // Stable dependency array to satisfy React Rules of Hooks
  }, [isListening, isOpen]);

  const startListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    
    setIsListening(true);
    setQueryText("");
  };

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
      let uiProjects: any[] = [];
      let uiTodos: any[] = [];
      let uiLinks: any[] = [];
      let uiDrive: any[] = [];
      
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

      // Add: Suggest connecting GDrive for deep search if not connected
      if (!gdriveToken && q.length > 1) {
        smartResults.push({
          id: "connect-gdrive-deep",
          title: `Connect Google Drive to enable Deep Search for "${q}"`,
          icon: Database,
          category: "Integration",
          action: () => { signInWithGoogleDrive(); setIsOpen(false); }
        });
      }

      // Action: Add Todo
      if ((q.startsWith("todo ") || q.startsWith("task ") || q.length > 3) && !q.includes(".") && !q.includes("@")) {
        const title = q.replace(/todo |task /i, "");
        smartResults.push({ id: "s-todo", title: `New Task: ${title}`, icon: CheckSquare, category: "Action", action: () => handleAction("todo", title) });
      }

      // Action: Save Link
      if ((q.startsWith("http") || q.includes(".")) && smartResults.length === 0 && !q.includes("@")) {
        smartResults.push({ id: "s-link", title: `Save to Vault: ${q}`, icon: LinkIcon, category: "Action", action: () => handleAction("link", q) });
      }

      const filteredNav = defaultNav.filter(n => n.title.toLowerCase().includes(q));

      try {
        const [pSnap, tSnap, lSnap, dSnap, nSnap] = await Promise.all([
           getDocs(query(collection(db, `users/${user.uid}/projects`), limit(100))),
           getDocs(query(collection(db, `users/${user.uid}/todos`), limit(100))),
           getDocs(query(collection(db, `users/${user.uid}/links`), limit(100))),
           getDocs(query(collection(db, `users/${user.uid}/drive`), limit(100))),
           getDocs(query(collection(db, `users/${user.uid}/notes`), limit(100))),
        ]);

        const projectResults = pSnap.docs.map(doc => ({ 
           id: doc.id, 
           title: doc.data().name, 
           icon: Folder, 
           category: "Projects", 
           action: () => { router.push(`/projects/${doc.id}`); setIsOpen(false); } 
        }));

        const todoResults = tSnap.docs.map(doc => ({ 
           id: doc.id, 
           title: doc.data().title, 
           icon: CheckSquare, 
           category: "Tasks", 
           action: () => { router.push("/todos"); setIsOpen(false); } 
        }));

        const linkResults = lSnap.docs.map(doc => ({ 
           id: doc.id, 
           title: doc.data().title, 
           icon: LinkIcon, 
           category: "Vault", 
           action: () => { 
              logInteraction({ title: doc.data().title, url: doc.data().url, category: "Vault" });
              window.open(doc.data().url, '_blank'); 
              setIsOpen(false); 
           } 
        }));

        const driveResultsRaw = dSnap.docs.map(doc => {
           const data = doc.data();
           const Icon = data.type === "Sheet" ? Table : data.type === "Form" ? Database : data.type === "Slide" ? Presentation : FileText;
           return { 
              id: doc.id, 
              title: data.title, 
              icon: Icon, 
              category: "Local Archive", 
              action: () => { 
                 logInteraction({ title: data.title, url: data.url, category: "Drive", type: data.type });
                 window.open(data.url, '_blank'); 
                 setIsOpen(false); 
              },
              raw: { ...data, id: doc.id, collection: "drive" }
           };
        });
         
         const noteResults = nSnap.docs.map(doc => ({
            id: doc.id,
            title: doc.data().content.substring(0, 50),
            icon: StickyNote,
            category: "Knowledge",
            action: () => { router.push("/notes"); setIsOpen(false); }
         }));

         const allLocalPool = [...projectResults, ...todoResults, ...linkResults, ...driveResultsRaw, ...noteResults];
        const lowerQ = q.toLowerCase();

        // --- @Mention Suggestions ---
        const lastAtIndex = q.lastIndexOf("@");
        if (lastAtIndex !== -1) {
          const mentionQuery = q.substring(lastAtIndex + 1).split(" ")[0].toLowerCase();
          
          if (mentionQuery.length >= 0) {
            allLocalPool
              .filter(item => item.title.toLowerCase().includes(mentionQuery))
              .slice(0, 5)
              .forEach(item => {
                smartResults.push({
                  id: `mention-${item.id}`,
                  title: `INSERT: @${item.title}`,
                  icon: item.icon,
                  category: "Suggestions",
                  action: () => {
                    const before = q.substring(0, lastAtIndex);
                    const after = q.substring(lastAtIndex + 1 + mentionQuery.length);
                    const newQuery = before + "@" + item.title + " " + after;
                    setQueryText(newQuery);
                    setTimeout(() => inputRef.current?.focus(), 10);
                  }
                });
              });
          }
        }

        // --- NLP Smart Commands ---
        // Matcher for Delete
        if (lowerQ.startsWith("delete ") || lowerQ.startsWith("del ")) {
          const target = lowerQ.replace(/delete |del /i, "").replace(/@/g, "").trim();
          if (target.length > 1) {
            const bestMatch = allLocalPool.find(item => item.title.toLowerCase().includes(target));
            if (bestMatch) {
              const isConfirming = confirmingId === `nlp-del-${bestMatch.id}`;
              smartResults.push({
                id: `nlp-del-${bestMatch.id}`,
                title: isConfirming ? `⚠️ ARE YOU SURE? (Click to delete ${bestMatch.title})` : `CONFIRM DELETE: ${bestMatch.title}`,
                icon: Trash2,
                category: "Calculated Action",
                action: () => {
                  if (isConfirming) {
                    handleAction("delete_res", bestMatch.id, { 
                      collection: bestMatch.category === "Projects" ? "projects" : 
                                 bestMatch.category === "Tasks" ? "todos" : 
                                 bestMatch.category === "Vault" ? "links" : 
                                 bestMatch.category === "Knowledge" ? "notes" : "drive",
                      name: bestMatch.title
                    });
                    setConfirmingId(null);
                  } else {
                    setConfirmingId(`nlp-del-${bestMatch.id}`);
                  }
                }
              });
            }
          }
        }

        // Matcher for Rename
        if (lowerQ.startsWith("rename ") && lowerQ.includes(" to ")) {
          const parts = lowerQ.replace("rename ", "").split(" to ");
          const target = parts[0].replace(/@/g, "").trim();
          const newName = parts[1].replace(/@/g, "").trim();
          if (target.length > 1 && newName.length > 1) {
            const bestMatch = allLocalPool.find(item => item.title.toLowerCase().includes(target));
            if (bestMatch) {
              smartResults.push({
                id: `nlp-ren-${bestMatch.id}`,
                title: `RENAME: "${bestMatch.title}" → "${newName}"`,
                icon: Edit3,
                category: "Calculated Action",
                action: () => handleAction("rename_res", bestMatch.id, { 
                  collection: bestMatch.category === "Projects" ? "projects" : 
                             bestMatch.category === "Tasks" ? "todos" : 
                             bestMatch.category === "Vault" ? "links" : "drive",
                  newName 
                })
              });
            }
          }
        }

        // Update UI states
        uiProjects = projectResults.filter(p => p.title.toLowerCase().includes(q));
        uiTodos = todoResults.filter(t => t.title.toLowerCase().includes(q));
        uiLinks = linkResults.filter(l => l.title.toLowerCase().includes(q));
        uiDrive = driveResultsRaw.filter(d => d.title.toLowerCase().includes(q));

        if (gdriveToken && q.length > 2) {
          try {
            const gResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${q}' and trashed = false&fields=files(id, name, mimeType, webViewLink)&pageSize=5`, {
              headers: { Authorization: `Bearer ${gdriveToken}` }
            });
            const gData = await gResponse.json();
            if (gData.files) {
              const deepResults = gData.files.map((file: any) => {
                let Icon = FileText;
                if (file.mimeType.includes("spreadsheet")) Icon = Table;
                if (file.mimeType.includes("presentation")) Icon = Presentation;
                if (file.mimeType.includes("folder")) Icon = Folder;
                return {
                  id: file.id,
                  title: file.name,
                  icon: Icon,
                  category: "Deep Search findings",
                  action: () => { 
                    logInteraction({ title: file.name, url: file.webViewLink, category: "Deep Search findings", type: file.mimeType });
                    window.open(file.webViewLink, '_blank'); 
                    setIsOpen(false); 
                  },
                  source: "gdrive",
                  raw: file
                };
              });
              uiDrive = [...uiDrive, ...deepResults];
            }
          } catch (ge) {
            console.error("GDrive search failed", ge);
          }
        }
      } catch (e: any) {
        console.error("Global search failed", e);
      }

      setResults([...smartResults, ...filteredNav, ...uiProjects, ...uiTodos, ...uiLinks, ...uiDrive]);
    };

    const timer = setTimeout(searchEverything, 150);
    return () => clearTimeout(timer);
  }, [queryText, isOpen, user, router, gdriveToken, confirmingId]);

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
            title: meta.title || content.split("/").filter(Boolean).pop()?.split("?")[0] || `New ${meta.type}`,
            url: content,
            type: meta.type,
            projectTag: "Inbox",
            createdAt: serverTimestamp(),
         });
         if (!meta.title) {
            router.push("/drive");
         } else {
             showToast(`"${meta.title}" synced to local archive`, "success");
         }
       } else if (type === "delete_res") {
          await deleteDoc(doc(db, `users/${user.uid}/${meta.collection}`, content));
          showToast(`Deleted: ${meta.name}`, "error");
       } else if (type === "rename_res") {
          const field = (meta.collection === "todos" || meta.collection === "links" || meta.collection === "drive") ? "title" : "name";
          await updateDoc(doc(db, `users/${user.uid}/${meta.collection}`, content), {
             [field]: meta.newName,
             updatedAt: serverTimestamp()
          });
          showToast(`Renamed to "${meta.newName}"`, "success");
       } else if (type === "move_res") {
          await updateDoc(doc(db, `users/${user.uid}/${meta.collection}`, content), {
             projectId: meta.targetId,
             projectTag: meta.targetName,
             updatedAt: serverTimestamp()
          });
          showToast(`Moved to ${meta.targetName}`, "success");
       } else if (type === "update_field") {
          await updateDoc(doc(db, `users/${user.uid}/${meta.collection}`, content), {
             [meta.field]: meta.value,
             updatedAt: serverTimestamp()
          });
          showToast(`Updated ${meta.field} to ${meta.value}`, "success");
       }
       setIsOpen(false);
       setQueryText("");
    } catch (e) {
      console.error(e);
      showToast("Action failed", "error");
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
            <div className="flex items-center px-8 py-6 gap-4 border-b border-zinc-800/50">
              <Search className={cn("text-zinc-500 transition-colors", isListening && "text-primary")} size={20} />
              <input 
                ref={inputRef}
                type="text"
                placeholder={isListening ? "Listening for command..." : "Type a command or use @ to mention items..."}
                className={cn(
                  "w-full bg-transparent border-none outline-none text-xl font-medium tracking-tight text-white placeholder:text-zinc-700 transition-all",
                  isListening && "text-primary italic animate-pulse"
                )}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={startListening}
                  className={cn(
                    "p-2.5 rounded-xl transition-all border relative group",
                    isListening ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
                  )}
                >
                  {isListening ? (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <Mic size={18} />
                    </motion.div>
                  ) : (
                    <Mic size={18} />
                  )}
                  {isListening && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="max-h-[460px] overflow-y-auto custom-scrollbar p-3">
              {results.length > 0 ? (
                Object.entries(groupedResults).map(([category, items]: [string, any]) => (
                  <div key={category} className="mb-4 last:mb-0">
                    <div className="px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 py-1">{category}</div>
                    {items.map((item: any) => {
                      const isSelected = results.indexOf(item) === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => item.action()}
                          className={cn(
                             "w-full flex items-center px-4 py-3 gap-4 rounded-xl transition-all text-left cursor-pointer group relative",
                             isSelected ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-zinc-400 hover:bg-zinc-800/40 hover:text-white"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            isSelected ? "bg-white/20" : "bg-zinc-800 group-hover:bg-zinc-700"
                          )}>
                             <item.icon size={16} className={cn(isSelected ? "text-white" : "text-zinc-400 group-hover:text-zinc-200")} />
                          </div>
                          <span className="font-medium text-sm truncate flex-1">{item.title}</span>
                          
                          <div className={cn(
                             "flex items-center gap-2 opacity-0 transition-all duration-200 group-hover:opacity-100", 
                             isSelected && "opacity-100"
                          )}>
                             <ArrowRight size={14} className={cn("opacity-40", isSelected && "translate-x-1")} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <p className="text-zinc-500 text-sm font-medium">No results found for "{queryText}"</p>
                  <p className="text-zinc-700 text-xs mt-1">Try @-mentions or a simpler query</p>
                </div>
              )}
            </div>

            <div className="px-8 py-3 bg-zinc-950/50 border-t border-zinc-800/50 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-[10px] text-zinc-400 font-mono">↑↓</kbd>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-[10px] text-zinc-400 font-mono">Enter</kbd>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Execute</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-[10px] text-zinc-400 font-mono">@</kbd>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Mention</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
