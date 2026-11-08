import React from "react";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { Link } from "react-router";
import { useGuestSections } from "@/api/guest";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEPARTMENTS = [
  { level: "JHS", label: "Junior High School" },
  { level: "SHS", label: "Senior High School" },
] as const;

type Level = (typeof DEPARTMENTS)[number]["level"];

const choiceClass = (isSelected: boolean) =>
  `min-h-11 rounded-md border px-3 text-sm font-medium ${
    isSelected ? "bg-[#790D16] text-white border-[#790D16]" : "bg-background text-neutral-700"
  }`;

/** Public: Department, then Grade Level, then Section. Students cannot be searched, on purpose. */
const GuestViewIndex = () => {
  const { data, isPending, isError } = useGuestSections();
  const [level, setLevel] = React.useState<Level>("JHS");
  const [chosenGrade, setChosenGrade] = React.useState<number>();
  const [search, setSearch] = React.useState("");

  const inDepartment = data?.sections.filter((section) => section.level === level) ?? [];
  const grades = [...new Set(inDepartment.map(({ grade }) => grade))];
  const grade = chosenGrade !== undefined && grades.includes(chosenGrade) ? chosenGrade : grades[0];
  const sections = inDepartment.filter(
    (section) => section.grade === grade && section.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto min-h-dvh max-w-2xl space-y-5 p-4 sm:p-6">
      <Link to="/" className={buttonVariants({ variant: "link", className: "h-11 px-0 text-xs" })}>
        <ArrowLeft />
        Back to Sign in
      </Link>

      <div>
        <h1 className="text-branding text-xl font-medium">View as Guest</h1>
        <p className="text-sm text-neutral-700">Class schedules for students, parents and visitors.</p>
        {data?.term && (
          <p className="text-sm text-neutral-700">
            {data.term.name}, SY {data.term.school_year}
          </p>
        )}
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <FormAlert>The sections could not be loaded. Please try again later.</FormAlert>}
      {data && !data.term && (
        <p className="text-sm text-neutral-700">No schedule is open right now.</p>
      )}

      {data?.term && (
        <>
          <div className="space-y-1">
            <p className="text-sm text-neutral-800">Department</p>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {DEPARTMENTS.map((department) => (
                <button
                  key={department.level}
                  type="button"
                  aria-pressed={department.level === level}
                  onClick={() => setLevel(department.level)}
                  className={choiceClass(department.level === level)}
                >
                  {department.label}
                </button>
              ))}
            </div>
          </div>

          {grades.length === 0 ? (
            <p className="text-sm text-neutral-700">There are no sections here yet.</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm text-neutral-800">Grade level</p>
                <div className="flex flex-wrap gap-2">
                  {grades.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={item === grade}
                      onClick={() => setChosenGrade(item)}
                      className={choiceClass(item === grade)}
                    >
                      Grade {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="guest-search" className="text-sm text-neutral-800">
                  Section
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 size-4 text-neutral-500" />
                  <Input
                    id="guest-search"
                    type="search"
                    className="h-11 pl-9"
                    placeholder="Search a section"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                {sections.length === 0 && (
                  <p className="text-sm text-neutral-700">No section matches your search.</p>
                )}
                <ul className="divide-y rounded-md border">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <Link
                        to={`/guest/sections/${section.id}`}
                        className="flex min-h-11 items-center justify-between gap-3 p-3 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-neutral-900">{section.name}</span>
                          {section.track && (
                            <span className="block text-xs text-neutral-700">{section.track}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {!section.is_ready && <Badge variant="secondary">Not ready yet</Badge>}
                          <ChevronRight className="size-4 text-neutral-500" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GuestViewIndex;
