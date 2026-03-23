"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  CheckSquare, 
  Link as LinkIcon, 
  HardDrive, 
  StickyNote,
  Command as CommandIcon,
  Search,
  Zap,
  Clock,
  Layout,
  Globe,
  FileText,
  MousePointer2,
  Users
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const { signInWithGoogle } = useAuth();

  const features = [
    { title: "Command Palette", description: "Ctrl+K search across everything in plain language.", icon: Search, span: "lg:col-span-8" },
    { title: "Links & Resources", description: "Save, tag, and instantly find any URL.", icon: LinkIcon, span: "lg:col-span-4" },
    { title: "Tasks & Todos", description: "Priority, due dates, and project tags.", icon: CheckSquare, span: "lg:col-span-4" },
    { title: "Drive & Sheets", description: "All your Google links, organized and labeled.", icon: HardDrive, span: "lg:col-span-8" },
    { title: "Notes", description: "Quick thoughts tied to projects.", icon: StickyNote, span: "lg:col-span-4" },
    { title: "Projects", description: "Group everything under one project.", icon: Layout, span: "lg:col-span-4" },
    { title: "Persistent", description: "Everything saved, always there when you come back.", icon: Clock, span: "lg:col-span-4" },
    { title: "Fast", description: "Keyboard-first, no unnecessary clicks.", icon: Zap, span: "lg:col-span-12" },
  ];

  const problems = [
    { title: "20+ Browser Tabs", description: "Important links lost in a sea of tabs you can't close.", icon: Globe },
    { title: "Buried Files", description: "Google Drive files lost deep in folders and search results.", icon: FileText },
    { title: "Scattered Todos", description: "Tasks spread across notes apps, WhatsApp, and sticky notes.", icon: MousePointer2 },
  ];

  const personas = [
    { title: "Freelancers", description: "Managing multiple clients without the chaos.", icon: Users },
    { title: "Developers", description: "Keeping tools, docs, and tasks in one keystroke.", icon: Zap },
    { title: "Students", description: "Juggling assignments, resources, and deadlines effortlessly.", icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden bg-mesh font-body text-foreground selection:bg-primary/30">
      {/* TopNavBar */}
      <nav className="flex justify-between items-center w-full px-12 py-8 z-50 bg-transparent font-sans tracking-tighter uppercase text-sm fixed top-0">
        <div className="text-2xl font-bold tracking-[-0.05em] text-foreground">KERN</div>
        <div className="hidden md:flex items-center gap-12 text-outline">
          <a className="font-medium hover:text-foreground transition-all duration-300" href="#features">FEATURES</a>
          <a className="font-medium hover:text-foreground transition-all duration-300" href="#how-it-works">HOW IT WORKS</a>
          <button 
            onClick={signInWithGoogle}
            className="px-6 py-2 bg-foreground text-background font-black tracking-widest text-[10px] hover:bg-primary transition-colors duration-500"
          >
            SIGN_IN
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-start justify-center pl-12 lg:pl-32 pr-12 overflow-hidden prismatic-glow">
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] border-[0.5px] border-outline-variant/30 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[0.5px] border-outline-variant/20 rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col items-start text-left gap-12 max-w-[1400px]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 rounded-full border border-outline-variant/30 flex items-center justify-center bg-zinc-950/50 backdrop-blur-2xl shadow-soft"
          >
            <CommandIcon size={32} className="text-primary" />
          </motion.div>

          <div className="space-y-8">
            <motion.h1 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[6rem] lg:text-[10rem] font-black tracking-tighter text-foreground leading-[0.85] mb-4 font-sans kern-headline"
            >
              EVERYTHING<br/>
              YOU WORK WITH.<br/>
              ONE PLACE.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xl lg:text-2xl font-medium text-outline max-w-2xl leading-relaxed"
            >
              Kern is your personal command center — one place for every link, task, file, and thought. Built for people with too many tabs open.
            </motion.p>
          </div>

          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="group bg-foreground text-background px-12 py-6 rounded-2xl font-black text-xl flex items-center gap-6 hover:bg-primary shadow-soft transition-all active:scale-95"
            onClick={signInWithGoogle}
          >
            <div className="flex items-center gap-4">
              <img 
                alt="Google" 
                className="w-6 h-6 flex-shrink-0" 
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              />
              <span>GET EARLY ACCESS</span>
            </div>
            <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
          </motion.button>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-zinc-950/50 py-40 px-12 lg:px-32 border-y border-zinc-900">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-24 space-y-4">
            <span className="text-primary font-black uppercase tracking-[0.3em] text-xs">01 // THE_PROBLEM</span>
            <h2 className="text-5xl lg:text-7xl font-black tracking-tighter text-white">Stop juggling. Start working.</h2>
            <p className="text-outline text-xl max-w-xl">Every morning you waste 15 minutes just finding things before you can start working.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {problems.map((problem, i) => (
              <motion.div 
                key={problem.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 pb-12 rounded-3xl border border-white/5 bg-zinc-900/30 flex flex-col gap-8 group hover:border-accent/40 transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-accent transition-all">
                  <problem.icon size={28} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-black tracking-tight text-white uppercase">{problem.title}</h3>
                  <p className="text-outline leading-relaxed">{problem.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works / 3-Step Section */}
      <section id="how-it-works" className="py-40 px-12 lg:px-32">
        <div className="max-w-[1400px] mx-auto text-center space-y-24">
          <div className="space-y-4">
            <span className="text-accent font-black uppercase tracking-[0.3em] text-xs">02 // WORKFLOW</span>
            <h2 className="text-5xl lg:text-8xl font-black tracking-tighter text-white">How it works.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start relative">
             <div className="flex flex-col items-center gap-12 group">
               <div className="w-24 h-24 rounded-full border-2 border-primary/20 flex items-center justify-center text-4xl font-black text-primary group-hover:bg-primary group-hover:text-black transition-all">1</div>
               <div className="space-y-4">
                 <h3 className="text-3xl font-black text-white">SAVE</h3>
                 <p className="text-outline max-w-xs mx-auto">URLs, Drive files, Sheets, Forms, Docs — anything you use.</p>
               </div>
             </div>
             <div className="flex flex-col items-center gap-12 group">
               <div className="w-24 h-24 rounded-full border-2 border-accent/20 flex items-center justify-center text-4xl font-black text-accent group-hover:bg-accent group-hover:text-black transition-all">2</div>
               <div className="space-y-4">
                 <h3 className="text-3xl font-black text-white">ORGANIZE</h3>
                 <p className="text-outline max-w-xs mx-auto">Tag by project, priority, or category. Everything in order.</p>
               </div>
             </div>
             <div className="flex flex-col items-center gap-12 group">
               <div className="w-24 h-24 rounded-full border-2 border-white/20 flex items-center justify-center text-4xl font-black text-white group-hover:bg-white group-hover:text-black transition-all">3</div>
               <div className="space-y-4">
                 <h3 className="text-3xl font-black text-white">FIND INSTANTLY</h3>
                 <p className="text-outline max-w-xs mx-auto">One search. One keystroke. Find it exactly when you need it.</p>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-40 px-12 lg:px-32 border-t border-zinc-900 bg-zinc-950/30">
        <div className="max-w-[1400px] mx-auto space-y-24">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
            <div className="space-y-4">
              <span className="text-primary font-black uppercase tracking-[0.3em] text-xs">03 // CORE_SYSTEM</span>
              <h2 className="text-5xl lg:text-8xl font-black tracking-tighter text-white leading-[0.9]">Everything you actually need Daily.</h2>
            </div>
            <p className="text-outline text-xl max-w-md lg:text-right pb-4">It's not a project management tool. It's a command center that connects your tools.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {features.map((feature, i) => (
              <motion.div 
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={cn(feature.span, "p-12 lg:p-16 rounded-[2.5rem] border border-white/5 bg-zinc-900/20 backdrop-blur-3xl flex flex-col justify-between gap-12 group hover:border-primary/30 transition-all min-h-[400px]")}
              >
                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-primary group-hover:text-black transition-all duration-500">
                  <feature.icon size={32} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-3xl font-black tracking-tighter text-white uppercase">{feature.title}</h3>
                  <p className="text-outline text-lg font-bold max-w-md leading-snug">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Magic Moment: Ctrl+K Spotlight */}
      <section className="py-60 px-12 lg:px-32 bg-primary text-black overflow-hidden relative">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center relative z-10">
          <div className="space-y-8">
            <span className="font-black uppercase tracking-[0.4em] text-sm opacity-50">THE_MAGIC_MOMENT</span>
            <h2 className="text-6xl lg:text-9xl font-black tracking-tighter leading-[0.85]">One Keystroke Away.</h2>
            <p className="text-2xl font-black max-w-lg leading-tight">Press Ctrl+K anywhere in the app. Type anything in plain English. Find it instantly.</p>
            <div className="pt-8">
               <div className="inline-flex items-center gap-4 bg-black/10 px-8 py-4 rounded-full border border-black/10">
                 <kbd className="font-sans font-black text-2xl">Ctrl</kbd>
                 <span className="text-2xl font-black">+</span>
                 <kbd className="font-sans font-black text-2xl">K</kbd>
               </div>
            </div>
          </div>
          <div className="relative">
             <div className="aspect-video bg-black rounded-3xl border-[12px] border-black/20 shadow-2xl flex flex-col p-8 gap-6 justify-center">
                <div className="flex items-center gap-4 bg-zinc-900/50 p-6 rounded-2xl border border-white/5 mx-auto w-full max-w-md">
                   <Search className="text-primary" />
                   <span className="text-zinc-500 font-bold italic tracking-tight">type "attendance sheet"...</span>
                </div>
                <div className="flex flex-col gap-2 max-w-md mx-auto w-full opacity-40">
                   <div className="h-10 bg-zinc-800 rounded-xl w-full" />
                   <div className="h-10 bg-zinc-800 rounded-xl w-2/3" />
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Who it's For */}
      <section className="py-40 px-12 lg:px-32">
        <div className="max-w-[1400px] mx-auto space-y-24">
           <div className="text-center space-y-4">
             <span className="text-accent font-black uppercase tracking-[0.3em] text-xs">04 // ECOSYSTEM</span>
             <h2 className="text-5xl lg:text-8xl font-black tracking-tighter text-white">Built for you.</h2>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
             {personas.map((persona, i) => (
               <div key={persona.title} className="p-12 rounded-[2.5rem] bg-zinc-900/20 border border-white/5 flex flex-col gap-8 text-center group hover:bg-zinc-900/40 transition-all">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 mx-auto flex items-center justify-center text-zinc-600 group-hover:bg-accent group-hover:text-black transition-all">
                    <persona.icon size={36} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl font-black text-white">{persona.title}</h3>
                    <p className="text-outline text-lg">{persona.description}</p>
                  </div>
               </div>
             ))}
           </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="py-60 flex flex-col items-center justify-center gap-16 border-t border-zinc-900 bg-zinc-950 px-12 text-center">
         <div className="space-y-4">
           <h2 className="text-5xl lg:text-[8rem] font-black tracking-tighter text-white leading-none">Stop juggling. <br/> Start using Kern.</h2>
           <p className="text-outline text-2xl font-medium tracking-tight mt-12">Get early access to the workspace that actually works.</p>
         </div>
         
         <button 
           onClick={signInWithGoogle}
           className="group bg-primary text-black px-12 py-6 rounded-2xl font-black text-2xl flex items-center gap-6 hover:scale-105 transition-all shadow-xl shadow-primary/20"
         >
           GET EARLY ACCESS
           <ArrowRight size={32} className="group-hover:translate-x-2 transition-transform" />
         </button>

         <div className="pt-40 w-full flex flex-col md:flex-row justify-between items-center gap-12 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-700">
           <div className="flex items-center gap-6">
             <CommandIcon size={24} />
             <span>© 2024 KERN MONOLITH</span>
           </div>
           <div className="flex gap-12">
             <a href="#" className="hover:text-foreground">PRIVACY</a>
             <a href="#" className="hover:text-foreground">TERMS</a>
             <a href="#" className="hover:text-foreground">SECURITY</a>
           </div>
           <div className="text-zinc-800">KERN_STABLE_v1.5.0</div>
         </div>
      </footer>
    </div>
  );
}
