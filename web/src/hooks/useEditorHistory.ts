/**
 * @file useEditorHistory.ts
 * @description Immutable undo/redo history management for template field mappings.
 * @architecture Encapsulates stack transitions with history depth limits for the template mapping editor.
 * @agent_note Updates to mapping nodes should dispatch snapshots through pushSnapshot to preserve undoability.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { IFieldMapping } from "@/components/templates/mapping/types";

export const MAX_HISTORY_DEPTH = 50;

export interface EditorHistoryCore<T> {
  getPresent: () => T;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushSnapshot: (next: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  reset: (initial: T) => void;
}

/**
 * Pure state machine implementation of an undo/redo stack.
 * Independent of React for unit testing and deterministic transitions.
 * @desc Creates a decoupled undo/redo history manager state machine.
 * @param {T} initialPresent - Initial state snapshot.
 * @param {number} [maxDepth=MAX_HISTORY_DEPTH] - Maximum number of history entries to retain.
 * @returns {EditorHistoryCore<T>} History manager controls and accessor methods.
 */
export function createEditorHistory<T>(
  initialPresent: T,
  maxDepth = MAX_HISTORY_DEPTH,
): EditorHistoryCore<T> {
  let past: T[] = [];
  let present: T = initialPresent;
  let future: T[] = [];

  return {
    getPresent: () => present,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    pushSnapshot: (next: T) => {
      past = [...past, present];
      if (past.length > maxDepth) {
        past = past.slice(past.length - maxDepth);
      }
      present = next;
      future = [];
    },
    undo: () => {
      if (past.length === 0) return null;
      const prev = past[past.length - 1];
      past = past.slice(0, past.length - 1);
      future = [present, ...future];
      present = prev;
      return present;
    },
    redo: () => {
      if (future.length === 0) return null;
      const next = future[0];
      future = future.slice(1);
      past = [...past, present];
      if (past.length > maxDepth) {
        past = past.slice(past.length - maxDepth);
      }
      present = next;
      return present;
    },
    reset: (initial: T) => {
      past = [];
      present = initial;
      future = [];
    },
  };
}

export type FieldMappingsUpdater =
  IFieldMapping[] | ((prev: IFieldMapping[]) => IFieldMapping[]);

export interface UseEditorHistoryReturn {
  fieldMappings: IFieldMapping[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushSnapshot: (mappingsOrUpdater: FieldMappingsUpdater) => void;
  setFieldMappingsDirect: React.Dispatch<React.SetStateAction<IFieldMapping[]>>;
  resetHistory: (initial: IFieldMapping[]) => void;
}

/**
 * React hook wrapping the immutable undo/redo history stack for template field mappings.
 * @hook useEditorHistory
 * @description Manages undo, redo, and snapshot history states for template field mappings.
 * @param {IFieldMapping[]} [initialMappings=[]] - Default initial field mappings array.
 * @returns {UseEditorHistoryReturn} Mapping state, undo/redo triggers, and history manipulators.
 * @sideeffects Synchronizes active present state with internal stack references and provides immutable state updates.
 */
export function useEditorHistory(
  initialMappings: IFieldMapping[] = [],
): UseEditorHistoryReturn {
  const [past, setPast] = useState<IFieldMapping[][]>([]);
  const [present, setPresent] = useState<IFieldMapping[]>(initialMappings);
  const [future, setFuture] = useState<IFieldMapping[][]>([]);

  const presentRef = useRef(present);
  useEffect(() => {
    presentRef.current = present;
  }, [present]);

  const pushSnapshot = useCallback((nextOrUpdater: FieldMappingsUpdater) => {
    const current = presentRef.current;
    const nextMappings =
      typeof nextOrUpdater === "function"
        ? nextOrUpdater(current)
        : nextOrUpdater;

    setPast((prevPast) => {
      const newPast = [...prevPast, current];
      return newPast.length > MAX_HISTORY_DEPTH
        ? newPast.slice(newPast.length - MAX_HISTORY_DEPTH)
        : newPast;
    });
    presentRef.current = nextMappings;
    setPresent(nextMappings);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setFuture((prevFuture) => [presentRef.current, ...prevFuture]);
      presentRef.current = previous;
      setPresent(previous);
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setPast((prevPast) => {
        const newPast = [...prevPast, presentRef.current];
        return newPast.length > MAX_HISTORY_DEPTH
          ? newPast.slice(newPast.length - MAX_HISTORY_DEPTH)
          : newPast;
      });
      presentRef.current = next;
      setPresent(next);
      return newFuture;
    });
  }, []);

  const resetHistory = useCallback((initial: IFieldMapping[]) => {
    presentRef.current = initial;
    setPast([]);
    setPresent(initial);
    setFuture([]);
  }, []);

  return {
    fieldMappings: present,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    pushSnapshot,
    setFieldMappingsDirect: setPresent,
    resetHistory,
  };
}
