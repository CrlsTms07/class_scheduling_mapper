import React from "react";
import { Link } from "react-router";
import { ArrowUpRightIcon, SearchIcon, TableProperties } from "lucide-react";
import { useSections } from "@/api/schedule";
import { useSelectedTerm } from "@/context/selectedTerm";
import { STATUS_LABELS } from "@/lib/schedule";
import type { ScheduleStatus } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  not_started: "bg-neutral-200 text-neutral-800",
  draft: "bg-sky-100 text-sky-900",
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
};

const Schedule = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const { data: sections, isPending, isError } = useSections(term?.id);
  const [search, setSearch] = React.useState("");

  const matches = (sections ?? []).filter((section) =>
    `grade ${section.grade} ${section.name} ${section.adviser ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const grades = [...new Set(matches.map(({ grade }) => grade))];

  const renderSections = () => {
    if (!term && !isTermPending) {
      return <p className="text-sm text-neutral-700">No term has been set up yet.</p>;
    }
    if (isError) {
      return <p className="text-sm text-destructive">Could not load the sections.</p>;
    }
    if (isPending) {
      return <p className="text-sm text-neutral-600">Loading...</p>;
    }
    if (sections.length === 0) {
      return (
        <p className="text-sm text-neutral-700">
          There are no sections in your grade levels for this school year yet.
        </p>
      );
    }
    if (matches.length === 0) {
      return <p className="text-sm text-neutral-700">No section matches your search.</p>;
    }

    return grades.map((grade) => (
      <div key={grade} className="space-y-3">
        <p className="font-bold text-branding border-b pb-1">Grade {grade}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {matches
            .filter((section) => section.grade === grade)
            .map((section) => (
              <Link
                key={section.id}
                to={`/schedule/sections/${section.id}`}
                className="block rounded-xl focus-visible:outline-2 focus-visible:outline-[#790D16]"
              >
                <Card className="shadow shadow-[#790D16]/40 h-full hover:bg-[#790D16]/5 transition-colors">
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center gap-3">
                      <p className="text-teal-700 font-bold text-base">
                        {section.name}
                      </p>
                      <ArrowUpRightIcon className="size-4 shrink-0 text-neutral-500" />
                    </div>
                    <p className="text-xs text-neutral-700">
                      Adviser: {section.adviser ?? "None yet"}
                    </p>
                    <Badge className={STATUS_COLORS[section.status]}>
                      {STATUS_LABELS[section.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-end">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#790D16]/20 rounded-sm">
            <TableProperties className="text-branding size-5" />
          </div>
          <div>
            <p className="text-branding text-xl font-medium">
              Schedule Configuration
            </p>
            <p className="text-sm text-neutral-700">
              Choose a section to build its timetable for{" "}
              {term ? `${term.name}, SY ${term.school_year.name}` : "the selected term"}.
            </p>
          </div>
        </div>
        <InputGroup className="h-11 sm:w-64 shrink-0">
          <InputGroupInput
            aria-label="Search sections"
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>
      {renderSections()}
    </div>
  );
};

export default Schedule;
