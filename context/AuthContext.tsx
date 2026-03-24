"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  gdriveToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleDrive: () => void;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  gdriveToken: null,
  signInWithGoogle: async () => {},
  signInWithGoogleDrive: () => {},
  logOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    // Check for existing token
    const savedToken = sessionStorage.getItem("gdrive_token");
    if (savedToken) setGdriveToken(savedToken);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const signInWithGoogleDrive = () => {
    if (typeof window === "undefined" || !(window as any).google) {
      showToast("Google Identity Services not loaded", "error");
      return;
    }
    
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.metadata.readonly",
        callback: (response: any) => {
          if (response.error) {
            console.error("GDrive Auth Callback Error:", response.error);
            showToast(`Drive Connection Error: ${response.error}`, "error");
            return;
          }
          if (response.access_token) {
            setGdriveToken(response.access_token);
            sessionStorage.setItem("gdrive_token", response.access_token);
            showToast("Google Drive Connected", "success");
          }
        },
        error_callback: (err: any) => {
          console.error("GDrive Auth Client Error:", err);
          showToast("Drive Authentication Failed", "error");
        }
      });
      client.requestAccessToken();
    } catch (error) {
      console.error("Error initializing GDrive client:", error);
      showToast("Failed to initialize Drive connection", "error");
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
      setGdriveToken(null);
      sessionStorage.removeItem("gdrive_token");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, gdriveToken, signInWithGoogle, signInWithGoogleDrive, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
