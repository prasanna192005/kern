import { useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export type UndoableAction =
  | { type: "delete"; collection: string; docId: string; snapshot: Record<string, any> }
  | { type: "rename"; collection: string; docId: string; field: string; oldValue: string }
  | { type: "move"; collection: string; docId: string; field: string; oldValue: string; oldProjectId?: string };

/**
 * useUndoStack — maintains a stack of reversible Firestore operations.
 * Call `push(action)` after each destructive op.
 * Call `undo(uid)` to reverse the last action. Returns false if stack is empty.
 */
export function useUndoStack() {
  const stack = useRef<UndoableAction[]>([]);

  const push = useCallback((action: UndoableAction) => {
    stack.current = [...stack.current.slice(-9), action]; // keep last 10
  }, []);

  const undo = useCallback(async (uid: string): Promise<UndoableAction | null> => {
    if (stack.current.length === 0) return null;
    const action = stack.current[stack.current.length - 1];
    stack.current = stack.current.slice(0, -1);

    try {
      switch (action.type) {
        case "delete": {
          // Restore the deleted document (setDoc re-creates it with original ID)
          await setDoc(
            doc(db, `users/${uid}/${action.collection}`, action.docId),
            { ...action.snapshot, _restoredAt: serverTimestamp() }
          );
          break;
        }
        case "rename": {
          await updateDoc(
            doc(db, `users/${uid}/${action.collection}`, action.docId),
            { [action.field]: action.oldValue, updatedAt: serverTimestamp() }
          );
          break;
        }
        case "move": {
          const update: Record<string, any> = {
            [action.field]: action.oldValue,
            updatedAt: serverTimestamp(),
          };
          // Also restore old projectId if it existed
          if (action.oldProjectId !== undefined) {
            update.projectId = action.oldProjectId;
          }
          await updateDoc(
            doc(db, `users/${uid}/${action.collection}`, action.docId),
            update
          );
          break;
        }
      }
    } catch (e) {
      console.error("Undo failed", e);
      return null;
    }

    return action;
  }, []);

  const canUndo = useCallback(() => stack.current.length > 0, []);
  const peek = useCallback(() => stack.current[stack.current.length - 1] ?? null, []);

  return { push, undo, canUndo, peek };
}
