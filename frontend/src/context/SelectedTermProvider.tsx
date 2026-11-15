import React from "react";
import { useTerms } from "@/api/calendar";
import { SelectedTermContext } from "./selectedTerm";

const STORAGE_KEY = "selected-term-id";

const SelectedTermProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: terms = [], isPending } = useTerms();
  const [selectedId, setSelectedId] = React.useState(() =>
    Number(localStorage.getItem(STORAGE_KEY)),
  );

  const term =
    terms.find(({ id }) => id === selectedId) ??
    terms.find(({ is_active }) => is_active) ??
    terms[0];

  const selectTerm = (termId: number) => {
    localStorage.setItem(STORAGE_KEY, String(termId));
    setSelectedId(termId);
  };

  return (
    <SelectedTermContext.Provider value={{ terms, term, selectTerm, isPending }}>
      {children}
    </SelectedTermContext.Provider>
  );
};

export default SelectedTermProvider;
