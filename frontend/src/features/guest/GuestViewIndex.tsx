import React from "react";
import { ArrowLeft, BookOpen, ChevronRight, GraduationCap, Layers, LogIn, Search, ShieldCheck, Users, X } from "lucide-react";
import { Link } from "react-router";
import { useGuestSections } from "@/api/guest";
import FormAlert from "@/components/global-component/FormAlert";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LOGO = "/ercihs-logo.png";

const DEPARTMENTS = [
  { level: "JHS", label: "Junior High School", grades: "Grades 7 to 10", icon: BookOpen },
  { level: "SHS", label: "Senior High School", grades: "Grades 11 and 12", icon: GraduationCap },
] as const;

type Level = (typeof DEPARTMENTS)[number]["level"];

type GuestSectionItem = NonNullable<ReturnType<typeof useGuestSections>["data"]>["sections"][number];

/** A section matches by its name, or by the name of its adviser or co-adviser. */
const matches = (section: GuestSectionItem, query: string) =>
  [section.name, `grade ${section.grade} ${section.name}`, section.adviser ?? "", section.co_adviser ?? ""].some((text) =>
    text.toLowerCase().includes(query),
  );

/** One section as a card: its name, grade, adviser, and whether its schedule is posted. */
const SectionCard = ({ section, showGrade }: { section: GuestSectionItem; showGrade: boolean }) => (
  <Link
    to={`/guest/sections/${section.id}`}
    className="group flex min-h-11 items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#790D16]/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#790D16]"
  >
    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#790D16]/10 text-sm font-bold text-[#790D16]">
      {section.grade}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-semibold text-neutral-900">
        {showGrade ? `Grade ${section.grade} – ${section.name}` : section.name}
      </span>
      <span className="block truncate text-xs text-neutral-600">
        {[section.track, section.adviser && `Adviser: ${section.adviser}`].filter(Boolean).join(" · ") || "Adviser not set yet"}
      </span>
    </span>
    <span className="flex shrink-0 items-center gap-2">
      {section.is_ready ? (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">Posted</span>
      ) : (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-200">Not ready yet</span>
      )}
      <ChevronRight className="size-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-[#790D16]" />
    </span>
  </Link>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">{children}</div>
);

/**
 * Public: search a section or an adviser, or pick Department, then Grade Level, then Section.
 * Students cannot be searched, on purpose: they are minors.
 */
const GuestViewIndex = () => {
  const { data, isPending, isError } = useGuestSections();
  const [level, setLevel] = React.useState<Level>("JHS");
  const [chosenGrade, setChosenGrade] = React.useState<number>();
  const [search, setSearch] = React.useState("");
  const [isBrowsing, setIsBrowsing] = React.useState(false);
  const query = search.trim().toLowerCase();

  const all = data?.sections ?? [];
  const inDepartment = all.filter((section) => section.level === level);
  const grades = [...new Set(inDepartment.map(({ grade }) => grade))];
  const grade = chosenGrade !== undefined && grades.includes(chosenGrade) ? chosenGrade : grades[0];
  const sections = inDepartment.filter((section) => section.grade === grade);
  const found = query === "" ? [] : all.filter((section) => matches(section, query));

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b border-[#790D16]/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2">
            <img src={LOGO} alt="" className="size-10 shrink-0" />
            <span className="min-w-0">
              <span className="block font-bold leading-tight text-[#790D16]">ERCIHS</span>
              <span className="block truncate text-xs text-neutral-600">Scheduling System</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Link to="/" className={buttonVariants({ variant: "ghost", className: "h-11 max-sm:px-2" })}>
              <ArrowLeft />
              Back to home
            </Link>
            <Link to="/login" aria-label="Sign in" className={cn(buttonVariants({ variant: "outline" }), "h-11 min-w-11 border-[#790D16]/30 text-[#790D16] max-sm:px-3")}>
              <LogIn />
              <span className="max-sm:hidden">Sign in</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-linear-to-br from-[#790D16] via-[#8f1520] to-[#5e0a11] text-white">
        <div className="relative mx-auto grid max-w-5xl items-center gap-6 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">View as Guest</p>
            <h1 className="text-2xl font-bold sm:text-4xl">Find your class schedule</h1>
            <p className="text-sm text-white/85 sm:text-base">Class schedules for students, parents and visitors.</p>
            {data?.term && (
              <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                {data.term.name}, SY {data.term.school_year}
              </p>
            )}
          </div>

          {data?.term && (
            <div className="max-w-2xl space-y-1">
              <label htmlFor="guest-search" className="text-sm font-medium text-white/90">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="guest-search"
                  type="search"
                  className="h-14 rounded-xl border-0 bg-white pl-12 text-base text-neutral-900 shadow-lg placeholder:text-neutral-400"
                  placeholder="Section or adviser name"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          )}
          </div>
          <div className="hidden justify-center md:flex" aria-hidden="true">
            <span className="flex size-48 items-center justify-center rounded-full bg-white/95 p-3 shadow-2xl ring-8 ring-white/15 lg:size-56">
              <img src={LOGO} alt="" className="size-full select-none object-contain" />
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
        {isError && <FormAlert>The sections could not be loaded. Please try again later.</FormAlert>}
        {data && !data.term && <Empty>No schedule is open right now.</Empty>}

        {data?.term && query !== "" && (
          <section aria-label="Search results" className="space-y-3">
            <p className="text-sm font-medium text-neutral-700" aria-live="polite">
              {found.length === 0
                ? "No section or adviser matches your search."
                : `${found.length} ${found.length === 1 ? "section" : "sections"} found`}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {found.map((section) => (
                <li key={section.id}>
                  <SectionCard section={section} showGrade />
                </li>
              ))}
            </ul>
          </section>
        )}

        {data?.term && query === "" && !isBrowsing && (
          <section aria-label="Browse" className="flex flex-col items-start gap-4 rounded-2xl border bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="font-semibold text-neutral-900">Not sure of the section name?</h2>
              <p className="text-sm text-neutral-600">
                Search above, or browse the sections by department and grade level ({all.length} {all.length === 1 ? "section" : "sections"}).
              </p>
            </div>
            <button
              type="button"
              aria-expanded={false}
              onClick={() => setIsBrowsing(true)}
              className={cn(buttonVariants(), "h-11 shrink-0 bg-[#790D16] text-white hover:bg-[#790D16]/90")}
            >
              <Layers />
              Browse all sections
            </button>
          </section>
        )}

        {data?.term && query === "" && isBrowsing && (
          <>
            <div className="flex justify-end">
              <button type="button" aria-expanded onClick={() => setIsBrowsing(false)} className={cn(buttonVariants({ variant: "ghost" }), "h-11 text-neutral-700")}>
                <X />
                Hide the list
              </button>
            </div>
            <section aria-labelledby="department-heading" className="space-y-3">
              <h2 id="department-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Department
              </h2>
              <div className="grid gap-3 min-[420px]:grid-cols-2">
                {DEPARTMENTS.map((department) => {
                  const Icon = department.icon;
                  const isOn = department.level === level;
                  const count = all.filter((section) => section.level === department.level).length;

                  return (
                    <button
                      key={department.level}
                      type="button"
                      aria-pressed={isOn}
                      aria-label={department.label}
                      onClick={() => setLevel(department.level)}
                      className={`flex min-h-11 items-center gap-3 rounded-xl border p-4 text-left transition ${
                        isOn
                          ? "border-[#790D16] bg-[#790D16] text-white shadow-md"
                          : "border-neutral-200 bg-white text-neutral-800 hover:border-[#790D16]/40"
                      }`}
                    >
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${isOn ? "bg-white/15" : "bg-[#790D16]/10 text-[#790D16]"}`}>
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{department.label}</span>
                        <span className={`block text-xs ${isOn ? "text-white/80" : "text-neutral-600"}`}>
                          {department.grades} · {count} {count === 1 ? "section" : "sections"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {grades.length === 0 ? (
              <Empty>There are no sections here yet.</Empty>
            ) : (
              <>
                <section aria-labelledby="grade-heading" className="space-y-3">
                  <h2 id="grade-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                    Grade level
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {grades.map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={item === grade}
                        aria-label={`Grade ${item}`}
                        onClick={() => setChosenGrade(item)}
                        className={`min-h-11 rounded-full border px-5 text-sm font-medium transition ${
                          item === grade
                            ? "border-[#790D16] bg-[#790D16] text-white shadow-sm"
                            : "border-neutral-200 bg-white text-neutral-700 hover:border-[#790D16]/40"
                        }`}
                      >
                        Grade {item}
                        <span className={`ml-2 text-xs ${item === grade ? "text-white/80" : "text-neutral-500"}`}>
                          {inDepartment.filter((section) => section.grade === item).length}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section aria-labelledby="section-heading" className="space-y-3">
                  <h2 id="section-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                    Section
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {sections.map((section) => (
                      <li key={section.id}>
                        <SectionCard section={section} showGrade={false} />
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        )}

        <div className="grid gap-3 border-t pt-6 text-xs text-neutral-600 sm:grid-cols-2">
          <p className="flex gap-2">
            <ShieldCheck className="size-4 shrink-0 text-[#790D16]" />
            Only schedules approved by the school are shown, so what you see is what is followed.
          </p>
          <p className="flex gap-2">
            <Users className="size-4 shrink-0 text-[#790D16]" />
            Student names are never shown. Only the adviser and co-adviser of each section are named.
          </p>
        </div>
      </main>
    </div>
  );
};

export default GuestViewIndex;
