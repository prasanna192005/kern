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
  Mic,
  User
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<any>(null);
  const [avatarError, setAvatarError] = useState(false);
  
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
      setHoveredItem(null);
      setAvatarError(false);
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

        const projectResults = pSnap.docs.map(doc => {
          const data = doc.data();
          return { 
             id: doc.id, 
             title: data.name, 
             icon: Folder, 
             category: "Projects", 
             action: () => { router.push(`/projects/${doc.id}`); setIsOpen(false); },
             raw: { ...data, id: doc.id, collection: "projects" }
          };
        });

        const todoResults = tSnap.docs.map(doc => {
          const data = doc.data();
          return { 
             id: doc.id, 
             title: data.title, 
             icon: CheckSquare, 
             category: "Tasks", 
             action: () => { router.push("/todos"); setIsOpen(false); },
             raw: { ...data, id: doc.id, collection: "todos" }
          };
        });

        const linkResults = lSnap.docs.map(doc => {
          const data = doc.data();
          return { 
             id: doc.id, 
             title: data.title, 
             icon: LinkIcon, 
             category: "Vault", 
             action: () => { 
                logInteraction({ title: data.title, url: data.url, category: "Vault" });
                window.open(data.url, '_blank'); 
                setIsOpen(false); 
             },
             raw: { ...data, id: doc.id, collection: "links" }
          };
        });

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
         
         const noteResults = nSnap.docs.map(doc => {
           const data = doc.data();
           return {
              id: doc.id,
              title: data.content.substring(0, 50),
              icon: StickyNote,
              category: "Knowledge",
              action: () => { router.push("/notes"); setIsOpen(false); },
              raw: { ...data, id: doc.id, collection: "notes" }
           };
         });

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
            const gResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${q}' and trashed = false&fields=files(id, name, mimeType, webViewLink, thumbnailLink, iconLink, size, modifiedTime, lastModifyingUser)&pageSize=5`, {
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
            className="bg-zinc-900/95 backdrop-blur-3xl w-full max-w-[600px] rounded-2xl shadow-2xl pointer-events-auto border border-zinc-800/50 flex flex-col relative z-10"
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
                          onMouseEnter={() => {
                            setSelectedIndex(results.indexOf(item));
                            if (hoveredItem?.id !== item.id) {
                              setHoveredItem(item);
                              setAvatarError(false);
                            }
                          }}
                          onMouseLeave={() => setHoveredItem(null)}
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
                             {item.source === "gdrive" && (
                               <div className="flex items-center gap-2 mr-2">
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     const mime = item.raw.mimeType;
                                     let type = "Doc";
                                     if (mime.includes("spreadsheet")) type = "Sheet";
                                     else if (mime.includes("presentation")) type = "Slide";
                                     else if (mime.includes("folder")) type = "Folder";
                                     handleAction("drive", item.raw.webViewLink, { title: item.title, type });
                                   }}
                                   className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all border border-zinc-700/50"
                                   title="Add to Central Drive"
                                 >
                                   + Drive
                                 </button>
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handleAction("link", item.raw.webViewLink);
                                   }}
                                   className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all border border-zinc-700/50"
                                   title="Save to Vault"
                                 >
                                   + Vault
                                 </button>
                               </div>
                             )}
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

            {/* Universal Preview Panel */}
            <AnimatePresence>
              {hoveredItem && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col w-full lg:w-96 lg:absolute lg:left-full lg:ml-4 lg:top-0 lg:h-full bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] mt-4 lg:mt-0 group/preview"
                >
                  {/* Subtle Inner Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                  
                  <div className="p-8 h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center border border-white/5 shadow-inner">
                        <hoveredItem.icon size={24} className="text-primary drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">{hoveredItem.category}</p>
                        <h3 className="text-base font-black text-white leading-tight break-words">{hoveredItem.title}</h3>
                      </div>
                    </div>

                    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent opacity-30" />

                    {/* Dynamic Content Preview */}
                    <div className="flex-1 text-xs text-zinc-400 space-y-6">
                      {hoveredItem.category === "Knowledge" && hoveredItem.raw && (
                        <div className="markdown-content text-[11px] max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {hoveredItem.raw.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {hoveredItem.category === "Vault" && hoveredItem.raw && (
                        <div className="space-y-6">
                          <div className="p-3 rounded-2xl bg-zinc-900/30 border border-white/5 font-mono text-[10px] text-primary/80 truncate italic">
                            {hoveredItem.raw.url}
                          </div>
                          {hoveredItem.raw.notes && (
                            <div className="space-y-2">
                               <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Attached Intelligence</p>
                               <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 shadow-inner">
                                 <p className="italic text-zinc-400 leading-relaxed line-clamp-6">{hoveredItem.raw.notes}</p>
                               </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                            <ExternalLink size={14} /> Global Link Protocol
                          </div>
                        </div>
                      )}

                      {hoveredItem.category === "Deep Search findings" && hoveredItem.raw && (
                        <div className="space-y-6">
                          {hoveredItem.raw.thumbnailLink ? (
                            <div className="w-full aspect-video rounded-2xl bg-zinc-900/50 border border-white/5 overflow-hidden relative shadow-2xl">
                              <img src={hoveredItem.raw.thumbnailLink.replace("=s220", "=s800")} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                            </div>
                          ) : (
                            <div className="w-full aspect-video rounded-2xl bg-zinc-900/20 border border-white/5 flex flex-col items-center justify-center gap-3 shadow-inner relative overflow-hidden">
                               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.1)_0%,transparent_70%)]" />
                               <hoveredItem.icon size={48} className="text-zinc-800 opacity-50" />
                               <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">No Visual Preview</span>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 flex flex-col gap-2 transition-colors hover:bg-zinc-900/50">
                              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Modified</span>
                              <span className="text-xs font-bold text-zinc-300">{new Date(hoveredItem.raw.modifiedTime).toLocaleDateString()}</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 flex flex-col gap-2 transition-colors hover:bg-zinc-900/50">
                              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Format</span>
                              <span className="text-xs font-bold text-zinc-300 truncate uppercase">{hoveredItem.raw.mimeType.split(".").pop() || "Binary"}</span>
                            </div>
                          </div>
                          
                          {hoveredItem.raw.lastModifyingUser && (
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900/50 to-transparent border border-white/5 flex items-center gap-3 shadow-inner">
                               <div className="relative w-8 h-8 flex-shrink-0">
                                 {hoveredItem.raw.lastModifyingUser.photoLink && !avatarError ? (
                                   <img 
                                      src={hoveredItem.raw.lastModifyingUser.photoLink} 
                                      alt="" 
                                      className="w-full h-full rounded-full border border-white/10" 
                                      onError={() => setAvatarError(true)}
                                   />
                                 ) : (
                                   <div className="w-full h-full rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
                                     <User size={14} className="text-zinc-500" />
                                   </div>
                                 )}
                                 <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-950 shadow-sm" />
                               </div>
                               <div className="min-w-0">
                                 <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Contributed By</p>
                                 <p className="text-xs font-bold text-zinc-300 truncate">{hoveredItem.raw.lastModifyingUser.displayName}</p>
                               </div>
                            </div>
                          )}
                        </div>
                      )}

                      {hoveredItem.category === "Tasks" && hoveredItem.raw && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className={cn(
                              "inline-flex px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                              hoveredItem.raw.priority === "High" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                              "bg-primary/10 text-primary border-primary/20"
                            )}>
                              {hoveredItem.raw.priority} Priority
                            </div>
                            <span className="text-[10px] font-bold text-zinc-600">ID: {hoveredItem.id.substring(0, 8)}</span>
                          </div>
                          
                          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Scope</p>
                            <p className="text-sm font-bold text-zinc-200">{hoveredItem.raw.category || "General Objective"}</p>
                          </div>

                          {hoveredItem.raw.notes && (
                            <div className="space-y-2">
                               <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Requirement Notes</p>
                               <p className="p-4 rounded-2xl bg-zinc-900/20 border border-white/5 text-zinc-400 italic leading-relaxed shadow-inner">{hoveredItem.raw.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-6 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span>Preview Protocol v1.2</span>
                      </div>
                      <span className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-help">
                        Reference Hash <ArrowRight size={10}/>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
