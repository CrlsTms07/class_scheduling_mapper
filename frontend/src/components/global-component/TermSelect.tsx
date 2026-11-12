import { useSelectedTerm } from "@/context/selectedTerm";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const TermSelect = ({ className = "" }: { className?: string }) => {
  const { terms, term, selectTerm } = useSelectedTerm();

  if (!term) return null;

  return (
    <NativeSelect
      aria-label={term.school_year.term_label}
      className={`[&_select]:h-11 [&_select]:text-xs ${className}`}
      value={term.id}
      onChange={(event) => selectTerm(Number(event.target.value))}
    >
      {terms.map(({ id, name, is_active, school_year }) => (
        <NativeSelectOption key={id} value={id}>
          SY {school_year.name} · {name}
          {is_active ? " (active)" : ""}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
};

export default TermSelect;
