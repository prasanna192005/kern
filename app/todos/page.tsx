"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  LayoutGrid, 
  List,
  PlusCircle,
  Tag,
  Edit2,
  Copy,
  Move,
  FileText
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
import { useLinking } from "@/context/LinkingContext";
import { useKeyboardActions } from "@/hooks/useKeyboardActions";
import { useContextMenu } from "@/context/ContextMenuContext";

const priorityColors = {
  High: "bg-red-500/10 text-red-500 border-red-500/20",
  Medium: "bg-primary/10 text-primary border-primary/20",
  Low: "bg-accent/10 text-accent border-accent/20",
};

export default function TodosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { copyRef } = useLinking();
  const { showMenu, hideMenu } = useContextMenu();
  
  const [todos, setTodos] = useState<any[]>([]);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: "add" | "edit"; todo?: any }>({
    isOpen: false,
    mode: "add",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hoveredTodo, setHoveredTodo] = useState<any>(null);

  const [form, setForm] = useState({ title: "", category: "Work", priority: "Medium", dueDate: "" });

  const deleteTodoFunc = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/todos`, id));
      showToast("Objective Terminated", "error");
    } catch (e) {
      showToast("Termination Failure", "error");
    }
  };

  const renameTodo = async (todo: any) => {
    if (!user || !todo) return;
    const newTitle = prompt("Re-initialize objective ID:", todo.title || "");
    if (newTitle) {
      try {
        await updateDoc(doc(db, `users/${user.uid}/todos`, todo.id), { title: newTitle });
        showToast("Objective Identity Updated", "success");
      } catch (e) {
        showToast("Update Failure", "error");
      }
    }
  };

  const duplicateTodo = async (todo: any) => {
    if (!user || !todo) return;
    try {
      const { id, ...todoData } = todo;
      await addDoc(collection(db, `users/${user.uid}/todos`), {
        ...todoData,
        title: `${todo.title} (Copy)`,
        createdAt: serverTimestamp(),
        status: todo.status || "Todo"
      });
      showToast("Objective Duplicated", "success");
    } catch (e) {
      showToast("Duplication Failure", "error");
    }
  };

  const createNoteFromTask = async (todo: any) => {
    if (!user || !todo) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/notes`), {
        content: `# Note for Task: ${todo.title}\n\n- Project: ${todo.category || 'General'}\n- Priority: ${todo.priority}\n\n[Add details here]`,
        projectTag: todo.category?.toUpperCase() || "GENERAL",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("Note Created from Task", "success");
      router.push("/notes");
    } catch (e) {
      showToast("Note Creation Failure", "error");
    }
  };

  const moveToProject = async (todo: any) => {
    if (!user || !todo) return;
    const newProject = prompt("Reassign to Project Scopes:", todo.category || "");
    if (newProject !== null) {
      try {
        await updateDoc(doc(db, `users/${user.uid}/todos`, todo.id), { category: newProject });
        showToast("Project Scope Updated", "success");
      } catch (e) {
        showToast("Move Failure", "error");
      }
    }
  };

  const handleTodoContextMenu = (e: React.MouseEvent, todo: any) => {
    e.preventDefault();
    showMenu(e.clientX, e.clientY, [
      { 
        label: "Edit Objective", 
        icon: <Edit2 size={14} />, 
        onClick: () => {
          setForm({ title: todo.title, category: todo.category || "Work", priority: todo.priority || "Medium", dueDate: todo.dueDate || "" });
          setModalState({ isOpen: true, mode: "edit", todo });
        }
      },
      { label: "Duplicate", icon: <Copy size={14} />, onClick: () => duplicateTodo(todo) },
      { label: "Move to Project", icon: <Move size={14} />, onClick: () => moveToProject(todo) },
      { label: "Create Note", icon: <FileText size={14} />, onClick: () => createNoteFromTask(todo) },
      { label: "Delete", icon: <Trash2 size={14} />, onClick: () => deleteTodoFunc(todo.id), variant: "destructive" },
    ], todo.title);
  };

  useKeyboardActions({
    onCopy: () => {
       if (hoveredTodo) {
         copyRef({ id: hoveredTodo.id, type: "link", title: hoveredTodo.title }); // Reusing link type for simplicity or I should add 'todo'
         showToast("Objective Reference Copied", "success");
       }
    },
    onRename: () => {
       if (hoveredTodo) renameTodo(hoveredTodo);
    },
    onDelete: () => {
       if (hoveredTodo) deleteTodoFunc(hoveredTodo.id);
    }
  });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, `users/${user.uid}/todos`), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title) return;
    
    if (modalState.mode === "add") {
      await addDoc(collection(db, `users/${user.uid}/todos`), {
        ...form,
        status: "Todo",
        createdAt: serverTimestamp(),
      });
    } else if (modalState.mode === "edit" && modalState.todo) {
      await updateDoc(doc(db, `users/${user.uid}/todos`, modalState.todo.id), {
        ...form,
        updatedAt: serverTimestamp(),
      });
    }

    setForm({ title: "", category: "Work", priority: "Medium", dueDate: "" });
    setModalState({ isOpen: false, mode: "add" });
    showToast(modalState.mode === "add" ? "Objective Initialized" : "Identity Updated", "success");
  };

  const toggleStatus = async (todo: any) => {
    if (!user) return;
    const nextStatus = todo.status === "Done" ? "Todo" : "Done";
    await updateDoc(doc(db, `users/${user.uid}/todos`, todo.id), { status: nextStatus });
    showToast(nextStatus === "Done" ? "Task Commited" : "Task Re-initialized", "info");
  };

  const handleInlineSave = async (id: string) => {
    if (!user || !editValue.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateDoc(doc(db, `users/${user.uid}/todos`, id), { title: editValue.trim() });
      setEditingId(null);
      showToast("Objective Identity updated inline", "success");
    } catch (e) {
      showToast("Inline update failed", "error");
    }
  };

  const updateTodoStatus = async (id: string, status: string) => {
    if (!user) return;
    await updateDoc(doc(db, `users/${user.uid}/todos`, id), { status });
  };

  const deleteTodo = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/todos`, id));
  };

  const filteredTodos = todos.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-8 lg:p-16 flex flex-col gap-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Active Tasks</h1>
          <p className="text-zinc-500 text-sm font-medium">Manage your workload and priorities.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 rounded-xl flex items-center gap-3 w-72 transition-all">
            <Search size={16} className="text-zinc-500" />
            <input 
              type="text" 
              placeholder="Filter tasks..." 
              className="bg-transparent border-none outline-none text-sm flex-1 font-medium text-zinc-300 placeholder:text-zinc-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-900 shadow-soft">
            <button 
              onClick={() => setView("kanban")}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                view === "kanban" ? "bg-primary text-primary-foreground" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <LayoutGrid size={16} /> Kanban
            </button>
            <button 
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                view === "list" ? "bg-primary text-primary-foreground" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <List size={16} /> List
            </button>
          </div>
          
          <button 
            onClick={() => {
               setForm({ title: "", category: "Work", priority: "Medium", dueDate: "" });
               setModalState({ isOpen: true, mode: "add" });
            }}
            className="bg-foreground text-background px-5 py-2.5 rounded-xl text-sm font-bold shadow-soft hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2"
          >
            <PlusCircle size={18} />
            Add Task
          </button>
        </div>
      </header>

      {/* Kanban View */}
      {view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {["Todo", "In Progress", "Done"].map((status) => (
            <div key={status} className="flex flex-col gap-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {status} <span className="ml-2 px-1.5 py-0.5 rounded-full bg-zinc-900 text-zinc-500 text-[10px]">{todos.filter(t => t.status === status).length}</span>
                </h3>
              </div>
              
              <div className="flex flex-col gap-4 min-h-[500px] bg-zinc-950/20 rounded-2xl p-2 border border-dashed border-zinc-900/50">
                <AnimatePresence mode="popLayout">
                  {filteredTodos.filter(t => t.status === status).map((todo) => (
                    <TodoCard 
                      key={todo.id} 
                      todo={todo} 
                      onToggle={() => toggleStatus(todo)} 
                      onDelete={() => deleteTodoFunc(todo.id)} 
                      onMouseEnter={() => setHoveredTodo(todo)}
                      onMouseLeave={() => setHoveredTodo(null)}
                      onEdit={() => {
                        setForm({ title: todo.title, category: todo.category || "Work", priority: todo.priority || "Medium", dueDate: todo.dueDate || "" });
                        setModalState({ isOpen: true, mode: "edit", todo });
                      }}
                      onStatusChange={(newStatus) => updateTodoStatus(todo.id, newStatus)}
                      onContextMenu={(e) => handleTodoContextMenu(e, todo)}
                      isEditing={editingId === todo.id}
                      editValue={editingId === todo.id ? editValue : todo.title}
                      onStartEdit={() => {
                        setEditingId(todo.id);
                        setEditValue(todo.title);
                      }}
                      onEditChange={setEditValue}
                      onSave={() => handleInlineSave(todo.id)}
                      onCancel={() => setEditingId(null)}
                    />
                  ))}
                </AnimatePresence>
                <button 
                  onClick={() => setModalState({ isOpen: true, mode: "add" })}
                  className="w-full py-4 rounded-xl border border-dashed border-zinc-800 text-zinc-600 hover:text-primary hover:border-primary/30 transition-all group flex items-center justify-center gap-2"
                >
                  <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">Add Item</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="divide-y divide-zinc-800">
            <AnimatePresence mode="popLayout">
              {filteredTodos.map((todo) => (
                <TodoRow 
                  key={todo.id} 
                  todo={todo} 
                  onToggle={() => toggleStatus(todo)} 
                  onDelete={() => deleteTodoFunc(todo.id)} 
                  onMouseEnter={() => setHoveredTodo(todo)}
                  onMouseLeave={() => setHoveredTodo(null)}
                  onEdit={() => {
                    setForm({ title: todo.title, category: todo.category || "Work", priority: todo.priority || "Medium", dueDate: todo.dueDate || "" });
                    setModalState({ isOpen: true, mode: "edit", todo });
                  }}
                    onContextMenu={(e: React.MouseEvent) => handleTodoContextMenu(e, todo)}
                    isEditing={editingId === todo.id}
                    editValue={editingId === todo.id ? editValue : todo.title}
                    onStartEdit={() => {
                      setEditingId(todo.id);
                      setEditValue(todo.title);
                    }}
                    onEditChange={setEditValue}
                    onSave={() => handleInlineSave(todo.id)}
                    onCancel={() => setEditingId(null)}
                  />
              ))}
            </AnimatePresence>
          </div>
          {filteredTodos.length === 0 && (
            <div className="py-24 text-center">
              <CheckCircle2 size={40} className="mx-auto text-zinc-800 mb-4" />
              <p className="text-zinc-600 text-sm font-medium">No tasks found.</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {modalState.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh]">
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
              <h2 className="text-2xl font-bold mb-8 text-white">{modalState.mode === "add" ? "Create New Task" : "Edit Task Reference"}</h2>
              <form onSubmit={handleAddTodo} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block font-mono">_title</label>
                  <input 
                    required autoFocus
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-base text-white placeholder:text-zinc-800"
                    placeholder="Fast execution, no placeholders..."
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block font-mono">_scope</label>
                    <input 
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white placeholder:text-zinc-800"
                      placeholder="e.g. Work"
                      value={form.category}
                      onChange={e => setForm({...form, category: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block font-mono">_priority</label>
                    <select 
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white appearance-none cursor-pointer"
                      value={form.priority}
                      onChange={e => setForm({...form, priority: e.target.value})}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block font-mono">_deadline</label>
                  <input 
                    type="date"
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all font-medium text-sm text-white"
                    value={form.dueDate}
                    onChange={e => setForm({...form, dueDate: e.target.value})}
                  />
                </div>
                <div className="flex gap-4 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setModalState({ isOpen: false, mode: "add" })}
                    className="flex-1 py-5 rounded-2xl font-bold text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition-all text-[11px] uppercase tracking-widest"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-primary text-white font-bold py-5 rounded-2xl shadow-glow transition-all text-[11px] uppercase tracking-widest"
                  >
                    {modalState.mode === "add" ? "Initialize_Task" : "Push_Changes"}
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

function TodoCard({ 
  todo, onToggle, onDelete, onEdit, onStatusChange, onMouseEnter, onMouseLeave, onContextMenu,
  isEditing, editValue, onStartEdit, onEditChange, onSave, onCancel 
}: { 
  todo: any, onToggle: () => void, onDelete: () => void, onEdit: () => void, onStatusChange: (status: string) => void, onMouseEnter?: () => void, onMouseLeave?: () => void, onContextMenu: (e: React.MouseEvent) => void,
  isEditing: boolean, editValue: string, onStartEdit: () => void, onEditChange: (val: string) => void, onSave: () => void, onCancel: () => void
}) {
  const isDone = todo.status === "Done";
  
  return (
    <motion.div 
      layout
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, info) => {
        if (info.offset.x > 100) {
           if (todo.status === "Todo") onStatusChange("In Progress");
           else if (todo.status === "In Progress") onStatusChange("Done");
        } else if (info.offset.x < -100) {
           if (todo.status === "Done") onStatusChange("In Progress");
           else if (todo.status === "In Progress") onStatusChange("Todo");
        }
      }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
      className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all group cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-4">
        <button 
          onClick={onToggle}
          className={cn(
            "mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
            isDone ? "bg-primary border-primary text-white" : "border-zinc-700 text-transparent hover:border-primary"
          )}
        >
          {isDone && <CheckCircle2 size={14} strokeWidth={3} />}
        </button>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input 
              autoFocus
              className="w-full bg-zinc-950 border border-primary/30 rounded-lg px-3 py-1 text-base font-semibold text-white outline-none focus:border-primary transition-all"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
                if (e.key === "Escape") onCancel();
              }}
              onBlur={onSave}
            />
          ) : (
            <p 
              onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
              className={cn(
                "text-base font-semibold leading-tight transition-all cursor-text hover:text-primary/80",
                isDone ? "text-zinc-600 line-through" : "text-zinc-100"
              )}
            >
              {todo.title}
            </p>
          )}
          <div className="flex items-center gap-3 mt-4">
             <span className={cn(
               "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border",
               (priorityColors as any)[todo.priority] || priorityColors.Medium
             )}>
                {todo.priority}
             </span>
             {todo.category && (
               <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-800 font-mono">
                 {todo.category}
               </span>
             )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-white transition-all shrink-0"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TodoRow({ 
  todo, onToggle, onDelete, onEdit, onMouseEnter, onMouseLeave, onContextMenu,
  isEditing, editValue, onStartEdit, onEditChange, onSave, onCancel
}: { 
  todo: any, onToggle: () => void, onDelete: () => void, onEdit: () => void, onMouseEnter?: () => void, onMouseLeave?: () => void, onContextMenu: (e: React.MouseEvent) => void,
  isEditing: boolean, editValue: string, onStartEdit: () => void, onEditChange: (val: string) => void, onSave: () => void, onCancel: () => void
}) {
  const isDone = todo.status === "Done";
  
  return (
    <motion.div 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
      className="flex items-center gap-6 px-8 py-5 hover:bg-zinc-900/40 transition-colors group"
    >
      <button 
        onClick={onToggle}
        className={cn(
          "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
          isDone ? "bg-primary border-primary text-white" : "border-zinc-700 text-transparent hover:border-primary"
        )}
      >
        {isDone && <CheckCircle2 size={14} strokeWidth={3} />}
      </button>
      
      {isEditing ? (
        <input 
          autoFocus
          className="flex-1 bg-zinc-950 border border-primary/30 rounded-lg px-4 py-1 text-base font-semibold text-white outline-none focus:border-primary transition-all"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          onBlur={onSave}
        />
      ) : (
        <p 
          onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
          className={cn(
            "flex-1 text-base font-semibold transition-all truncate cursor-text hover:text-primary/80",
            isDone ? "text-zinc-600 line-through" : "text-zinc-100"
          )}
        >
          {todo.title}
        </p>
      )}
      
      <div className="flex items-center gap-8 shrink-0">
        <span className={cn(
          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border w-20 text-center",
          (priorityColors as any)[todo.priority] || priorityColors.Medium
        )}>
          {todo.priority}
        </span>
        
        <div className="flex items-center gap-2 text-zinc-600 min-w-[100px]">
          <Calendar size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-white transition-all shrink-0"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all hover:scale-110"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
