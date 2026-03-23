"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = React.useState(0);

  const slides = [
    {
      label: "Identity Gate",
      title: <>DEEP<br/>SYSTEM<br/><span className="text-outline-variant opacity-40">ACCESS</span></>,
      description: "Authenticate to enter your personal command center. Every link, task, file, and thought — unified in one keystroke."
    },
    {
      label: "The Problem",
      title: <>STOP<br/>JUGGLING<br/><span className="text-outline-variant opacity-40">TABS</span></>,
      description: "20+ browser tabs, buried Google Drive files, and scattered todos. Kern brings everything into one clean dark workspace."
    },
    {
      label: "The Workflow",
      title: <>SAVE.<br/>ORGANIZE.<br/><span className="text-outline-variant opacity-40">FIND.</span></>,
      description: "Save any link, manage tasks, and write notes. Then press Ctrl+K to find anything instantly in plain English."
    }
  ];

  useEffect(() => {
    if (user && !loading) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background text-foreground font-body selection:bg-primary selection:text-primary-foreground flex flex-col overflow-hidden relative">
      {/* TopNavBar */}
      <nav className="flex justify-between items-center w-full px-12 py-8 z-50 bg-transparent font-sans tracking-tighter uppercase text-sm fixed top-0">
        <div className="text-2xl font-bold tracking-[-0.05em] text-foreground">KERN</div>
      </nav>

      {/* Main Content: Login Shell */}
      <main className="flex-grow flex items-center justify-start relative w-full prismatic-glow px-12 lg:px-24">
        {/* Background Abstract Element */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[0.5px] border-outline-variant/20 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[0.5px] border-outline-variant/30 rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 w-full z-10 gap-24 items-center">
          {/* Left Side: Editorial Content Carousel */}
          <div className="hidden lg:flex lg:col-span-6 flex-col gap-8 h-[600px] justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col gap-8"
              >
                <span className="text-primary font-sans font-bold tracking-[0.2em] text-xs uppercase">
                  {slides[currentSlide].label}
                </span>
                <h1 className="font-sans text-[8.5rem] font-black text-foreground kern-headline leading-[0.8] mb-4">
                  {slides[currentSlide].title}
                </h1>
                <p className="max-w-md text-outline leading-relaxed text-xl">
                  {slides[currentSlide].description}
                </p>
              </motion.div>
            </AnimatePresence>
            
            <div className="mt-12 flex gap-4">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={cn(
                    "h-1 transition-all duration-500",
                    i === currentSlide ? "w-16 bg-primary" : "w-12 bg-white/10 hover:bg-white/20"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="lg:col-span-5 lg:col-start-8 flex flex-col justify-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-12 lg:p-16 border-t border-l border-white/5 shadow-2xl"
            >
              <div className="mb-12">
                <h2 className="font-sans text-4xl font-bold mb-4 tracking-tight">Identity Sync</h2>
                <p className="text-outline text-lg">Initialize your secure workspace connection.</p>
              </div>

              <div className="pt-4">
                <button 
                  onClick={signInWithGoogle}
                  className="w-full bg-foreground text-background py-6 px-8 font-sans font-black uppercase tracking-widest text-sm hover:bg-primary hover:text-primary-foreground transition-all duration-500 transform hover:scale-[1.02] flex justify-between items-center group"
                >
                  <div className="flex items-center gap-4">
                    <img 
                      alt="Google" 
                      className="w-5 h-5 flex-shrink-0" 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    />
                    <span>AUTHENTICATE_SYSTEM</span>
                  </div>
                  <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                </button>
                <p className="mt-8 text-outline text-[10px] leading-relaxed uppercase tracking-widest text-center">
                  Enterprise security protocols active. All access is logged.
                </p>
              </div>
            </motion.div>
            <p className="mt-8 text-center text-outline-variant text-[10px] uppercase tracking-widest">
              New to the monolith? <a className="text-outline hover:text-primary transition-colors" href="#">CREATE ACCOUNT</a>
            </p>
          </div>
        </div>

      </main>

      {/* Decorative Prismatic Leak */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-accent opacity-[0.03] blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-primary opacity-[0.03] blur-[120px] rounded-full pointer-events-none"></div>
    </div>
  );
}
