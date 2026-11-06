import { createContext, useContext } from "react";
import type { Term } from "@/types/api";

export type SelectedTermValue = {
  terms: Term[];
  term: Term | undefined;
  selectTerm: (termId: number) => void;
  isPending: boolean;
};

export const SelectedTermContext = createContext<SelectedTermValue | null>(null);

/** The term the user is working on: the active term unless they picked another. */
export function useSelectedTerm(): SelectedTermValue {
  const value = useContext(SelectedTermContext);

  if (!value) {
    throw new Error("useSelectedTerm must be used inside SelectedTermProvider");
  }

  return value;
}
