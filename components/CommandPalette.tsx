"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Search, LayoutDashboard, CheckSquare, Link as LinkIcon, HardDrive, 
  StickyNote, FileText, Table, Presentation, ArrowRight, Folder,
  Database, Trash2, Mic, Edit2, MoveRight, Zap, Sparkles, Copy
} from "lucide-react";
import { 
  collection, query, addDoc, serverTimestamp, limit,
  doc, deleteDoc, updateDoc, onSnapshot, getDoc
} from "firebase/firestore";
import Fuse from "fuse.js";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { useUndoStack } from "@/hooks/useUndoStack";

// ─── Frequency / Recency Scoring ────────────────────────────
const FREQ_KEY = "kern_cmd_freq";
const getFreqMap = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(FREQ_KEY) || "{}"); } catch { return {}; }
};
const bumpFreq = (id: string) => {
  try {
    const m = getFreqMap();
    m[id] = (m[id] || 0) + 1;
    localStorage.setItem(FREQ_KEY, JSON.stringify(m));
  } catch {}
};

// ─── Levenshtein Distance ────────────────────────────────────
const levenshtein = (a: string, b: string): number => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
};

// ─── Context Detector ────────────────────────────────────────
const detectContext = (q: string): string[] => {
  const lower = q.toLowerCase();
  if (/^(todo|task|create task)/.test(lower)) return ["Tasks"];
  if (/^(del|delete|remove)/.test(lower)) return ["Tasks", "Vault", "Drive", "Projects"];
  if (/^(link|vault|save)/.test(lower)) return ["Vault"];
  if (/^(move|rename)/.test(lower)) return ["Tasks", "Projects", "Drive"];
  if (/^(note)/.test(lower)) return ["Knowledge"];
  if (/^drive/.test(lower)) return ["Drive"];
  return [];
};

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [localPool, setLocalPool] = useState<any[]>([]);
  const [tabHint, setTabHint] = useState<string | null>(null); // ghost text
  
  const { user, gdriveToken, signInWithGoogleDrive, clearDriveToken } = useAuth();
  const { showToast } = useToast();
  const undoStack = useUndoStack();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isOpenRef = useRef(isOpen);
  const isListeningRef = useRef(isListening);
  const freqMap = useRef(getFreqMap());

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // ─── Real-time Listeners ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const collConfigs = [
      { coll: 'projects', icon: Folder,      category: "Projects"  },
      { coll: 'todos',    icon: CheckSquare,  category: "Tasks"     },
      { coll: 'links',    icon: LinkIcon,     category: "Vault"     },
      { coll: 'drive',    icon: FileText,     category: "Drive"     },
      { coll: 'notes',    icon: StickyNote,   category: "Knowledge" },
    ];
    const unsubs = collConfigs.map(({ coll, icon, category }) =>
      onSnapshot(query(collection(db, `users/${user.uid}/${coll}`), limit(150)), snap => {
        const items = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, icon, category,
            title: data.name || data.title || data.content?.substring(0, 50) || "Untitled",
            raw: { ...data, id: d.id, collection: coll }
          };
        });
        setLocalPool(prev => [...prev.filter(p => p.raw.collection !== coll), ...items]);
      })
    );
    return () => unsubs.forEach(fn => fn());
  }, [user]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setIsOpen(p => !p); }
      if (e.key === "Escape") { setIsOpen(false); setQueryText(""); }
      // Global Cmd+Z undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && !isOpenRef.current) {
        e.preventDefault();
        if (undoStack.canUndo()) {
          const peeked = undoStack.peek();
          const label = peeked?.type === "delete" ? "Restoring..." : peeked?.type === "rename" ? "Undoing rename..." : "Undoing move...";
          showToast(label, "info");
          undoStack.undo(user?.uid ?? "");
        }
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [undoStack, user]);

  useEffect(() => {
    if (isOpen) { inputRef.current?.focus(); setSelectedIndex(0); setConfirmingId(null); freqMap.current = getFreqMap(); }
    else { setQueryText(""); setTabHint(null); }
  }, [isOpen]);

  // ─── Voice ───────────────────────────────────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (!recognitionRef.current) {
      const r = new SR(); r.continuous = false; r.interimResults = true;
      r.onresult = (e: any) => { if (isOpenRef.current && isListeningRef.current) setQueryText(Array.from(e.results).map((x: any) => x[0].transcript).join("")); };
      r.onend = () => setIsListening(false);
      recognitionRef.current = r;
    }
    if (isListening && isOpen) recognitionRef.current.start();
    else recognitionRef.current.stop();
  }, [isListening, isOpen]);

  // ─── Execute Action ───────────────────────────────────────────
  const exec = async (act: any) => {
    if (!user || isProcessing) return;
    if (act._internal) { act._internal(); return; }

    // Bump frequency
    if (act.id) bumpFreq(act.id);
    setIsOpen(false);
    setQueryText("");
    setTabHint(null);
    setIsProcessing(true);

    try {
      switch (act.type) {
        case "nav":   router.push(act.path); break;
        case "open":  window.open(act.url, "_blank"); break;
        case "todo":
          await addDoc(collection(db, `users/${user.uid}/todos`), { title: act.payload, status: "Todo", priority: "Medium", createdAt: serverTimestamp() });
          showToast(`Task created: ${act.payload}`, "success"); break;
        case "link":
          await addDoc(collection(db, `users/${user.uid}/links`), { title: act.payload, url: act.payload.startsWith("http") ? act.payload : `https://${act.payload}`, category: "Inbox", createdAt: serverTimestamp() });
          showToast("Saved to Vault", "success"); break;
        case "delete": {
          // Capture full snapshot before deleting for undo
          const snap = await getDoc(doc(db, `users/${user.uid}/${act.collection}`, act.docId));
          const snapshot = snap.exists() ? snap.data() : {};
          await deleteDoc(doc(db, `users/${user.uid}/${act.collection}`, act.docId));
          undoStack.push({ type: "delete", collection: act.collection, docId: act.docId, snapshot });
          showToast(`Deleted`, "error", {
            onUndo: async () => {
              await undoStack.undo(user.uid);
              showToast("Restored", "success");
            },
            undoLabel: "Undo"
          });
          break;
        }
        case "rename": {
          const renField = act.collection === "projects" ? "name" : "title";
          const oldSnap = await getDoc(doc(db, `users/${user.uid}/${act.collection}`, act.docId));
          const oldValue = oldSnap.exists() ? (oldSnap.data()[renField] ?? "") : "";
          await updateDoc(doc(db, `users/${user.uid}/${act.collection}`, act.docId), { [renField]: act.newName, updatedAt: serverTimestamp() });
          undoStack.push({ type: "rename", collection: act.collection, docId: act.docId, field: renField, oldValue });
          showToast(`Renamed to "${act.newName}"`, "success", {
            onUndo: async () => {
              await undoStack.undo(user.uid);
              showToast(`Restored to "${oldValue}"`, "success");
            },
            undoLabel: "Undo"
          });
          break;
        }
        case "move": {
          const isDestProject = act.destCategory === "Projects";
          const moveField = act.collection === "drive" ? "projectTag" : "category";
          const oldSnap = await getDoc(doc(db, `users/${user.uid}/${act.collection}`, act.docId));
          const oldData = oldSnap.exists() ? oldSnap.data() : {};
          const oldValue = oldData[moveField] ?? "";
          const oldProjectId = oldData.projectId;
          const update: Record<string, any> = { updatedAt: serverTimestamp() };
          if (isDestProject && act.destId) {
            update.projectId = act.destId;
            update[moveField] = act.dest;
          } else {
            update[moveField] = act.dest;
          }
          await updateDoc(doc(db, `users/${user.uid}/${act.collection}`, act.docId), update);
          undoStack.push({ type: "move", collection: act.collection, docId: act.docId, field: moveField, oldValue, oldProjectId });
          showToast(`Moved to ${act.dest}`, "success", {
            onUndo: async () => {
              await undoStack.undo(user.uid);
              showToast(`Moved back`, "success");
            },
            undoLabel: "Undo"
          });
          break;
        }
        case "import_vault":
          await addDoc(collection(db, `users/${user.uid}/links`), { title: act.title, url: act.url, category: "Imported", createdAt: serverTimestamp() });
          showToast("Imported to Vault", "success"); break;
        case "import_drive":
          await addDoc(collection(db, `users/${user.uid}/drive`), { title: act.title, url: act.url, type: act.fileType || "Doc", createdAt: serverTimestamp() });
          showToast("Linked to Drive", "success"); break;
        case "frame": {
          setIsProcessing(true);
          try {
            const res = await fetch("/api/frame", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: act.payload, tone: act.tone }),
            });
            const data = await res.json();
            if (data.framed) {
              await navigator.clipboard.writeText(data.framed);
              showToast("Framed & Copied to Clipboard", "success", {
                onUndo: async () => {
                  await navigator.clipboard.writeText(act.payload);
                  showToast("Original text restored to clipboard", "success");
                },
                undoLabel: "Revert"
              });
            } else {
              showToast(data.error || "Framing failed", "error");
            }
          } catch (err) {
            showToast("AI Service unreachable", "error");
          } finally {
            setIsProcessing(false);
          }
          break;
        }
        default: {
          bumpFreq(act.id);
          const nav: Record<string, string> = { Projects: `/projects/${act.id}`, Tasks: "/todos", Knowledge: "/notes" };
          if (nav[act.category]) router.push(nav[act.category]);
          else if (act.raw?.url || act.raw?.webViewLink) window.open(act.raw.url || act.raw.webViewLink, "_blank");
        }
      }
    } catch { showToast("Action Failed", "error"); }
    finally { setIsProcessing(false); }
  };

  // ─── Fuzzy Matcher (Fuse.js + Levenshtein fallback) ──────────
  const fuzzySearch = useCallback((pool: any[], searchTerm: string, contextBias: string[]) => {
    if (!searchTerm) return pool;
    
    // Levenshtein typo tolerance
    const lev = (s: string) => levenshtein(s.toLowerCase(), searchTerm.toLowerCase());
    
    const fuse = new Fuse(pool, {
      includeScore: true,
      keys: ["title"],
      threshold: 0.45, // tolerant
      distance: 100,
    });

    const fuseResults = fuse.search(searchTerm);
    
    // Score = fuse score + frequency boost + context bias boost + recency
    return fuseResults.map(r => {
      const item = r.item;
      const fuseScore = 1 - (r.score || 0); // invert (higher = better)
      const freq = freqMap.current[item.id] || 0;
      const freqBoost = Math.min(freq / 20, 0.3); // up to +0.3
      const contextBoost = contextBias.includes(item.category) ? 0.2 : 0;
      const levScore = searchTerm.length > 3 && lev(item.title) <= 2 ? 0.15 : 0;
      return { ...item, _score: fuseScore + freqBoost + contextBoost + levScore };
    }).sort((a, b) => b._score - a._score);
  }, []);

  // ─── Smart Search Engine ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !user) return;

    const run = async () => {
      const raw = queryText;
      const q = raw.toLowerCase().trim();

      const navItems = [
        { id: "n1", type: "nav", path: "/",       title: "Dashboard", icon: LayoutDashboard, category: "Navigation" },
        { id: "n2", type: "nav", path: "/todos",   title: "Todos",     icon: CheckSquare,     category: "Navigation" },
        { id: "n3", type: "nav", path: "/drive",   title: "Drive",     icon: HardDrive,       category: "Navigation" },
        { id: "n4", type: "nav", path: "/links",   title: "Vault",     icon: LinkIcon,        category: "Navigation" },
        { id: "n5", type: "nav", path: "/notes",   title: "Notes",     icon: StickyNote,      category: "Navigation" },
      ];

      if (!q) { setResults(navItems); setTabHint(null); return; }

      const smart: any[] = [];
      const contextBias = detectContext(q);

      // ── 1. Cursor-aware @Mention with Fuzzy + Typo Tolerance ──
      const cursor = inputRef.current?.selectionStart ?? raw.length;
      const before = raw.slice(0, cursor);
      const atIdx = before.lastIndexOf("@");
      let activeMentionSuggestion: string | null = null;

      if (atIdx !== -1 && (atIdx === 0 || before[atIdx - 1] === " ")) {
        const part = before.slice(atIdx + 1);
        if (!part.includes(" ") && part.length > 0) {
          // Fuzzy search over localPool for mentions
          const fuseM = new Fuse(localPool, { includeScore: true, keys: ["title"], threshold: 0.5, distance: 100 });
          const mentionMatches = fuseM.search(part).slice(0, 6);

          mentionMatches.forEach((r, idx) => {
            const it = r.item;
            if (idx === 0) {
              // Tab hint: ghost-text for top result
              activeMentionSuggestion = it.title;
              setTabHint(it.title.slice(part.length));
            }
            smart.push({
              id: `m-${it.id}`, title: `@${it.title}`, category: "Suggestions", icon: it.icon,
              _contextLabel: it.category,
              _internal: () => {
                const b = raw.slice(0, atIdx), a = raw.slice(cursor);
                setQueryText(b + "@" + it.title + " " + a);
                setTabHint(null);
                setTimeout(() => inputRef.current?.focus(), 10);
              }
            });
          });
        } else {
          setTabHint(null);
        }
      } else {
        setTabHint(null);
      }

      // ── 2. Partial NLP Prompts (guide the user) ──────────────
      if (/^rename\s+@[\w\s]*$/i.test(raw) && !raw.includes(" to ")) {
        smart.push({ id: "hint-rename", title: `rename @ItemName to @NewName`, icon: Edit2, category: "Hint — type to complete", _internal: () => {} });
      }
      if (/^del(?:ete)?\s*$/i.test(raw) || /^del(?:ete)?\s+@?[\w]{1,2}$/.test(raw)) {
        smart.push({ id: "hint-del", title: `del @ItemName`, icon: Trash2, category: "Hint — type to complete", _internal: () => {} });
      }
      if (/^move\s+@[\w\s]*$/i.test(raw) && !raw.includes(" to ")) {
        smart.push({ id: "hint-move", title: `move @ItemName to CategoryName`, icon: MoveRight, category: "Hint — type to complete", _internal: () => {} });
      }

      // ── 3. NLP Commands ──────────────────────────────────────
      const renameMatch = q.match(/rename\s+@([\w\s]+?)\s+to\s+@([\w\s]+)/);
      if (renameMatch) {
        const source = localPool.find(it => it.title.toLowerCase().includes(renameMatch[1].trim()));
        if (source) {
          smart.push({ id: `ren-${source.id}`, type: "rename", docId: source.id, collection: source.raw.collection, newName: renameMatch[2].trim(), title: `Rename "${source.title}" → "${renameMatch[2].trim()}"`, icon: Edit2, category: "Action" });
        }
      }

      // Support: move @X to Category  AND  move @X to @ProjectName
      const moveMatch = q.match(/move\s+@([\w\s]+?)\s+to\s+@?([\w\s]+)/);
      if (moveMatch) {
        const source = localPool.find(it => it.title.toLowerCase().includes(moveMatch[1].trim()));
        const destRaw = moveMatch[2].trim();
        // Check if destination is a @mention to another item
        const destItem = localPool.find(it => it.title.toLowerCase().includes(destRaw));
        const destLabel = destItem ? destItem.title : destRaw;
        if (source) {
          smart.push({
            id: `mv-${source.id}`, type: "move", docId: source.id, collection: source.raw.collection,
            dest: destLabel, destId: destItem?.id, destCategory: destItem?.category,
            title: `Move "${source.title}" → ${destItem?.category === "Projects" ? `📁 ${destLabel}` : destItem ? `@${destLabel}` : destLabel}`,
            icon: MoveRight, category: "Action"
          });
        }
      }

      const linkMatch = q.match(/link\s+@([\w\s]+?)\s+to\s+@([\w\s]+)/);
      if (linkMatch) {
        const itemA = localPool.find(it => it.title.toLowerCase().includes(linkMatch[1].trim()));
        const itemB = localPool.find(it => it.title.toLowerCase().includes(linkMatch[2].trim()));
        if (itemA && itemB) {
          smart.push({ id: `lnk-${itemA.id}`, title: `Link "${itemA.title}" ↔ "${itemB.title}"`, icon: LinkIcon, category: "Action", _internal: () => { showToast(`Linked ${itemA.title} ↔ ${itemB.title}`, "success"); setIsOpen(false); } });
        }
      }

      const delMatch = q.match(/^del(?:ete)?\s+@?([\w\s]+)/);
      if (delMatch) {
        const target = delMatch[1].trim();
        // Fuzzy delete target
        const delFuse = new Fuse(localPool, { includeScore: true, keys: ["title"], threshold: 0.4 });
        const delMatches = delFuse.search(target);
        if (delMatches.length > 0) {
          const m = delMatches[0].item;
          const isConf = confirmingId === `d-${m.id}`;
          smart.push({
            id: `d-${m.id}`, type: isConf ? "delete" : undefined,
            docId: m.id, collection: m.raw.collection,
            title: isConf ? `⚠️ Confirm DELETE "${m.title}"?` : `Delete: "${m.title}"`,
            icon: Trash2, category: "Calculated Action",
            _internal: isConf ? undefined : () => setConfirmingId(`d-${m.id}`)
          });
        }
      }

      if (/^(todo|task)\s+.+/.test(q)) {
        const payload = q.replace(/^todo\s+|^task\s+/i, "").trim();
        smart.push({ id: "c-todo", type: "todo", payload, title: `Create Task: ${payload}`, icon: CheckSquare, category: "Action" });
      }

      if (/^notes?\s+.+/.test(q)) {
        const content = q.replace(/^notes?\s+/i, "").trim();
        smart.push({
          id: "c-note", title: `New Note: ${content}`, icon: StickyNote, category: "Action",
          _internal: async () => { setIsOpen(false); setQueryText(""); await addDoc(collection(db, `users/${user.uid}/notes`), { content, createdAt: serverTimestamp() }); showToast("Note saved", "success"); }
        });
      }

      const frameMatch = q.match(/^frame:\s*(?:(formal|casual|lowercase)\s+)?(.*)/i);
      if (frameMatch) {
        const tone = frameMatch[1]?.toLowerCase() || "balanced";
        const text = frameMatch[2]?.trim();
        if (text) {
          smart.push({ id: "c-frame", type: "frame", tone, payload: text, title: `AI Frame (${tone}): ${text}`, icon: Sparkles, category: "AI Logic" });
        }
      }

      if (/^https?:\/\//.test(q)) {
        const gType = q.includes("docs.google.com/document") ? "Doc" : q.includes("docs.google.com/spreadsheets") ? "Sheet" : q.includes("docs.google.com/presentation") ? "Slide" : null;
        const gIcon = gType === "Sheet" ? Table : gType === "Slide" ? Presentation : FileText;
        if (gType) smart.push({ id: "c-gsuite", type: "import_drive", url: q, title: `Link ${gType} to Drive`, fileType: gType, icon: gIcon, category: "Smart Integration" });
        else smart.push({ id: "c-url", type: "link", payload: q, title: `Add to Vault: ${q}`, icon: LinkIcon, category: "Action" });
      }

      if (!gdriveToken && q.length > 3 && !q.includes("@")) {
        smart.push({ id: "conn-drive", title: "Connect Google Drive for Deep Search", icon: Database, category: "Setup", _internal: () => { setIsOpen(false); signInWithGoogleDrive?.(); } });
      }

      // ── 4. Fuzzy-scored Local Results ────────────────────────
      const local = fuzzySearch(localPool, q, contextBias).slice(0, 40);

      // ── 5. Google Drive Deep Search ───────────────────────────
      let deep: any[] = [];
      if (gdriveToken && q.length > 2 && !q.includes("@") && !q.includes("http")) {
        try {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${q}' and trashed = false&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=5`, { headers: { Authorization: `Bearer ${gdriveToken}` } });
          if (res.status === 401) {
            // Token expired — clear it, prompt reconnect
            clearDriveToken();
            deep = [{ id: "gdrive-reconnect", title: "Drive session expired — click to reconnect", icon: Database, category: "Action Required", _internal: () => { setIsOpen(false); signInWithGoogleDrive?.(); } }];
          } else {
            const data = await res.json();
            if (data.files) deep = data.files.map((f: any) => ({ id: f.id, type: "open", url: f.webViewLink, title: f.name, icon: FileText, category: "Deep Search findings", raw: f }));
          }
        } catch {}
      }

      setResults([...smart, ...navItems.filter(n => n.title.toLowerCase().includes(q)), ...local, ...deep]);
    };

    const t = setTimeout(run, 10);
    return () => clearTimeout(t);
  }, [queryText, isOpen, user, gdriveToken, confirmingId, localPool, fuzzySearch]);

  // ─── Key Handler ─────────────────────────────────────────────
  const handleKey = (e: React.KeyboardEvent) => {
    // Tab → commit top @mention suggestion
    if (e.key === "Tab" && tabHint) {
      e.preventDefault();
      const topSuggestion = results.find(r => r.category === "Suggestions");
      if (topSuggestion) topSuggestion._internal();
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(p => (p + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(p => (p - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[selectedIndex]) exec(results[selectedIndex]); }
  };

  const groups = results.reduce((acc: any, cur) => {
    (acc[cur.category] = acc[cur.category] || []).push(cur); return acc;
  }, {});

  // Ghost text = what comes after the current cursor for tab completion
  const inputVal = queryText;
  const cursor = inputRef.current?.selectionStart ?? inputVal.length;
  const beforeCursor = inputVal.slice(0, cursor);
  const atIdx2 = beforeCursor.lastIndexOf("@");
  const currentPart = atIdx2 !== -1 ? beforeCursor.slice(atIdx2 + 1) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-xl pointer-events-auto" />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }} transition={{ duration: 0.15 }}
            className="bg-zinc-950/40 backdrop-blur-[50px] w-full max-w-[650px] rounded-[2.5rem] shadow-2xl pointer-events-auto border border-white/5 flex flex-col relative z-10 overflow-hidden"
          >
            {/* Input + Ghost text */}
            <div className="flex items-center px-10 py-8 gap-6 border-b border-white/[0.03]">
              <Search className={cn("text-zinc-600 transition-colors shrink-0", queryText && "text-primary")} size={22} />
              <div className="relative flex-1 min-w-0">
                {/* Ghost text overlay */}
                {tabHint && currentPart && (
                  <div aria-hidden className="absolute inset-0 flex items-center pointer-events-none">
                    <span className="text-xl font-bold tracking-tight text-transparent">{beforeCursor}</span>
                    <span className="text-xl font-bold tracking-tight text-zinc-700">{tabHint}</span>
                  </div>
                )}
                <input
                  ref={inputRef} type="text"
                  placeholder="Search, @mention, or: todo / del @X / rename @X to @Y..."
                  className="w-full bg-transparent border-none outline-none text-xl font-bold tracking-tight text-white placeholder:text-zinc-700 relative z-10"
                  value={queryText} onChange={e => setQueryText(e.target.value)} onKeyDown={handleKey}
                />
              </div>
              <button
                onClick={() => setIsListening(!isListening)}
                className={cn("w-11 h-11 rounded-2xl border transition-all flex items-center justify-center relative shrink-0", isListening ? "bg-red-500 border-red-400 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white")}
              >
                <Mic size={18} />
                {isListening && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative h-3 w-3 rounded-full bg-red-500 block" /></span>}
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar p-3">
              {results.length === 0 && <div className="p-10 text-center text-zinc-700 text-xs font-black uppercase tracking-widest">No results</div>}
              {Object.entries(groups).map(([cat, items]: [string, any]) => (
                <div key={cat} className="mb-4 last:mb-0">
                  <div className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2 font-mono">
                    {cat === "Hint — type to complete" ? "💡 tip" : `_ ${cat}`}
                  </div>
                  {items.map((it: any) => {
                    const sel = results.indexOf(it) === selectedIndex;
                    const isHint = it.category === "Hint — type to complete";
                    return (
                      <div
                        key={it.id} onClick={() => !isHint && exec(it)}
                        onMouseEnter={() => !isHint && setSelectedIndex(results.indexOf(it))}
                        className={cn("flex items-center px-6 py-3.5 gap-4 rounded-2xl transition-all group",
                          isHint ? "opacity-40 select-none cursor-default" :
                          sel ? "bg-primary text-primary-foreground shadow-lg cursor-pointer" : "text-zinc-500 hover:bg-white/[0.03] hover:text-white cursor-pointer")}
                      >
                        <it.icon size={17} className="shrink-0" />
                        <span className={cn("font-semibold text-sm truncate flex-1", isHint && "font-mono text-xs")}>{it.title}</span>
                        {it._contextLabel && <span className="text-[9px] font-black uppercase tracking-wider opacity-40">{it._contextLabel}</span>}
                        {it.category === "Deep Search findings" && (
                          <div className={cn("flex gap-2 opacity-0 group-hover:opacity-100", sel && "opacity-100")}>
                            <button onClick={e => { e.stopPropagation(); exec({ type: "import_vault", title: it.title, url: it.raw.webViewLink }); }} className="px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-white/10 text-[9px] font-black hover:bg-white/20">+Vault</button>
                            <button onClick={e => { e.stopPropagation(); exec({ type: "import_drive", title: it.title, url: it.raw.webViewLink, fileType: it.raw.mimeType?.includes("spreadsheet") ? "Sheet" : "Doc" }); }} className="px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-white/10 text-[9px] font-black hover:bg-white/20">+Drive</button>
                          </div>
                        )}
                        {!isHint && <ArrowRight size={13} className={cn("opacity-30 shrink-0", sel && "translate-x-1")} />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-10 py-2.5 bg-black/40 border-t border-white/[0.03] flex justify-between items-center">
              <div className="flex flex-wrap gap-4 text-[9px] text-zinc-700 font-black uppercase tracking-wider">
                <span><kbd className="px-1 py-0.5 rounded border border-zinc-800 bg-zinc-900 font-mono text-zinc-500">⏎</kbd> Run</span>
                {tabHint
                  ? <span className="text-primary"><kbd className="px-1 py-0.5 rounded border border-primary/30 bg-primary/10 font-mono text-primary">Tab</kbd> Complete @mention</span>
                  : <span><kbd className="px-1 py-0.5 rounded border border-zinc-800 bg-zinc-900 font-mono text-zinc-500">@</kbd> Mention</span>
                }
                <span className="text-zinc-800">rename @X to @Y · del @X · move @X to Y</span>
              </div>
              <div className="flex items-center gap-2">
                {localPool.length > 0 && <span className="text-[9px] text-zinc-800 font-black uppercase">{localPool.length} synced</span>}
                <Zap size={10} className="text-zinc-800" />
              </div>
              </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
