"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const useHistory = () => {
  const { user } = useAuth();

  const logInteraction = async (item: {
    title: string;
    url: string;
    category: string;
    type?: string;
  }) => {
    if (!user) return;

    try {
      await addDoc(collection(db, `users/${user.uid}/history`), {
        ...item,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error logging history:", error);
    }
  };

  return { logInteraction };
};
