import React from "react";
import { Link } from "react-router";
import { ExternalLink, Plus, SearchIcon, type LucideIcon } from "lucide-react";
import { useSelectedTerm } from "@/context/selectedTerm";
import { termMonths } from "@/lib/schedule";
import type { Term } from "@/types/api";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/*
 * The building blocks of the schedule, section and teacher pages: breadcrumbs, the gray tab
 * bar, the term tabs, a day's header, and the card that shows one class.
 */

/** "Home · Schedule · Room 101": where the page sits, the last part in maroon. */
export const Crumbs = ({ items }: { items: { label: string; to?: string }[] }) => (
  <nav aria-label="Breadcrumb" className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-neutral-600">
    <ExternalLink className="size-4 text-neutral-700" aria-hidden />
    {items.map(({ label, to }, index) => (
      <React.Fragment key={label}>
        {index > 0 && <span aria-hidden>·</span>}
        {to ? (
          <Link to={to} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-branding hover:underline">
            {label}
          </Link>
        ) : (
          <span aria-current="page" className="border-b border-[#790D16]/40 py-1 font-medium text-branding">
            {label}
          </span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

type TabItem<T extends string | number> = { value: T; label: string };

/** A light gray bar of choices; the chosen one is white. */
export function SegmentedTabs<T extends string | number>({
  label,
  items,
  value,
  onChange,
  className = "",
}: {
  label: string;
  items: TabItem<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1 ${className}`}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={`min-h-11 flex-1 shrink-0 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors ${
            item.value === value ? "bg-background text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** The terms of the selected school year as tabs (their names and count come from the database). */
export const TermTabs = () => {
  const { term, terms, selectTerm } = useSelectedTerm();
  const sameYear = term?.school_year ? terms.filter((item) => item.school_year?.id === term.school_year.id) : [];

  if (sameYear.length < 2) return null;

  return (
    <SegmentedTabs
      label={term?.school_year?.term_label ?? "Term"}
      items={sameYear.map(({ id, name }) => ({ value: id, label: name }))}
      value={term?.id}
      onChange={selectTerm}
    />
  );
};

/** "Daily Schedule  [June – August]" with a line under it. */
export const SectionHeading = ({ title, term, children }: { title: string; term?: Term; children?: React.ReactNode }) => (
  <div className="space-y-1">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-lg font-medium text-neutral-900">{title}</h2>
      {term && termMonths(term) && <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">{termMonths(term)}</span>}
    </div>
    {children && <p className="text-sm text-neutral-600">{children}</p>}
  </div>
);

/** A day's header: "Monday  👥 5 Sections", a search box and an add button. */
export const DayHeader = ({
  day,
  icon: Icon,
  count,
  noun,
  search,
  onSearch,
  onAdd,
  addLabel,
}: {
  day: string;
  icon: LucideIcon;
  count: number;
  noun: string;
  search?: string;
  onSearch?: (value: string) => void;
  onAdd?: () => void;
  addLabel?: string;
}) => (
  <div className="flex flex-col gap-2 border-y py-2 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3">
      <h3 className="font-semibold text-branding">{day}</h3>
      <span className="flex items-center gap-1.5 text-sm text-neutral-700">
        <Icon className="size-4" aria-hidden />
        <span className="text-base font-semibold text-teal-700">{count}</span>
        {noun}
      </span>
    </div>
    <div className="flex items-center gap-2">
      {onSearch && (
        <InputGroup className="h-11 sm:w-56">
          <InputGroupInput aria-label={`Search ${day}`} className="h-11" placeholder="Search..." value={search} onChange={(event) => onSearch(event.target.value)} />
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      )}
      {onAdd && (
        <Button type="button" size="icon" className="size-11 shrink-0" aria-label={addLabel ?? `Add to ${day}`} title={addLabel} onClick={onAdd}>
          <Plus />
        </Button>
      )}
    </div>
  </div>
);

/** The title row of a detail page: icon, name, a line under it, and buttons on the right. */
export const DetailHeader = ({
  icon: Icon,
  title,
  subtitle,
  badge,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#790D16]/10 text-branding">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-teal-700">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-neutral-700">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** "Sections: [STEM 11-1] [STEM 12-1]". */
export const ChipRow = ({ label, chips, empty = "None yet" }: { label: string; chips: React.ReactNode[]; empty?: string }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-sm text-neutral-700">{label}:</span>
    {chips.length === 0 ? <span className="text-sm text-neutral-500">{empty}</span> : chips}
  </div>
);

export const Chip = ({ children, to }: { children: React.ReactNode; to?: string }) =>
  to ? (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1 rounded-md bg-neutral-100 px-3 text-xs font-medium text-neutral-800 hover:bg-[#790D16]/10 hover:text-branding">
      {children}
    </Link>
  ) : (
    <span className="inline-flex min-h-8 items-center rounded-md bg-neutral-100 px-2.5 text-xs font-medium text-neutral-800">{children}</span>
  );

/** The maroon "60mins" pill. */
export const Minutes = ({ minutes }: { minutes: number }) => (
  <span className="shrink-0 rounded-full bg-[#790D16] px-2 py-0.5 text-xs font-semibold text-white">{minutes}mins</span>
);
