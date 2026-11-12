import React from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Link, useParams } from "react-router";
import { ArrowLeft, Download, Eraser, Send, Sparkles, TableProperties, Undo2, X } from "lucide-react";
import {
  conflictDetailsOf,
  useAssignSlot,
  useAutoFill,
  useClearSchedule,
  useMoveEntry,
  usePlotter,
  useReviseSchedule,
} from "@/api/schedule";
import { useColorCoding } from "@/api/auth";
import { downloadFile } from "@/api/client";
import { useSelectedTerm } from "@/context/selectedTerm";
import { apiErrorMessage } from "@/lib/forms";
import {
  entryAt,
  hasSubject,
  planMove,
  PLOTTER_VIEWS,
  readDrop,
  readPlotterView,
  savePlotterView,
  STATUS_COLORS,
  STATUS_LABELS,
  subjectColor,
  type PlotterView,
} from "@/lib/schedule";
import type { DayPattern, Plotter, Shift, TimeSlot } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import EntrySheet, { type SheetTarget } from "./EntrySheet";
import FlagsPanel from "./FlagsPanel";
import SetupChecklist from "./SetupChecklist";
import LoadingPanel from "./LoadingPanel";
import AutoFillSheet from "./AutoFillSheet";
import ColorCodingSwitch from "./ColorCodingSwitch";
import PlotterGuide from "./PlotterGuide";
import ScheduleDayCards from "./ScheduleDayCards";
import ScheduleDayList from "./ScheduleDayList";
import ScheduleGrid from "./ScheduleGrid";
import SubmitSheet from "./SubmitSheet";
import SectionDailyView from "@/features/schedule/builder/SectionDailyView";
import { Chip, ChipRow, Crumbs, SegmentedTabs, TermTabs } from "@/components/global-component/ScheduleUi";

type SectionMode = "daily" | "timetable";
const SECTION_MODE_KEY = "section-view";
const readSectionMode = (): SectionMode => {
  try {
    return localStorage.getItem(SECTION_MODE_KEY) === "timetable" ? "timetable" : "daily";
  } catch {
    return "daily";
  }
};
const saveSectionMode = (mode: SectionMode) => {
  try {
    localStorage.setItem(SECTION_MODE_KEY, mode);
  } catch {
    // The choice is only a convenience.
  }
};

const BackToSections = () => (
  <Link
    to="/schedule"
    className={buttonVariants({ variant: "link", className: "h-11 px-0 text-xs" })}
  >
    <ArrowLeft />
    All sections
  </Link>
);

const PlotterPage = () => {
  const sectionId = Number(useParams().sectionId);
  const { term } = useSelectedTerm();
  const { data: plotter, isPending, error } = usePlotter(term?.id, sectionId);

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <BackToSections />
        <FormAlert>This section is not available in what is selected at the top.</FormAlert>
      </div>
    );
  }

  if (isPending || !plotter || !term) {
    return <p className="p-6 text-sm text-neutral-600">Loading...</p>;
  }

  // A new key resets the screen when the user switches to another term.
  return <PlotterScreen key={term.id} plotter={plotter} termId={term.id} />;
};

const PlotterScreen = ({ plotter, termId }: { plotter: Plotter; termId: number }) => {
  const { term: selectedTerm } = useSelectedTerm();
  // Daily schedule (cards, typed times) or Timetable (grid, drag and drop). The choice is remembered.
  const [mode, setMode] = React.useState<SectionMode>(readSectionMode);
  const changeMode = (next: SectionMode) => {
    setMode(next);
    saveSectionMode(next);
  };
  const {
    section,
    patterns,
    entries,
    loading,
    flags,
    status,
    last_review: lastReview,
    can_plot: canPlot,
    can_edit: canEdit,
  } = plotter;
  const [patternId, setPatternId] = React.useState(patterns[0]?.id);
  const [day, setDay] = React.useState(1);
  const [selectedLoadingId, setSelectedLoadingId] = React.useState<number | null>(null);
  const [target, setTarget] = React.useState<SheetTarget | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = React.useState(false);
  // Chosen from New schedule (?autofill=1), Auto-fill opens right away.
  const [isAutoFillOpen, setIsAutoFillOpen] = React.useState(
    () => canEdit && new URLSearchParams(window.location.search).get("autofill") === "1",
  );
  const [removedByRevise, setRemovedByRevise] = React.useState<string[]>([]);
  const [view, setView] = React.useState<PlotterView>(readPlotterView);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);
  const assign = useAssignSlot(termId, section.id);
  const isColored = useColorCoding();
  const move = useMoveEntry(termId, section.id);
  const clearSchedule = useClearSchedule(termId, section.id);
  const { undo: undoAutoFill } = useAutoFill(termId, section.id);

  // A short click stays a tap. On a touch screen, hold first, so that swiping still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const dragged = loading.find(({ id }) => id === draggedId);
  const placing = loading.find(({ id }) => id === selectedLoadingId);
  const plotContext = { patterns, entries, level: section.level };
  const revise = useReviseSchedule(termId, section.id);

  const pattern = patterns.find(({ id }) => id === patternId) ?? patterns[0];

  const patternFor = (slot: TimeSlot): DayPattern =>
    patterns.find(({ slots }) => slots.some(({ id }) => id === slot.id)) as DayPattern;

  /**
   * With a subject picked or dragged, an empty slot saves right away. Anything else,
   * including a conflict or a missing room, opens the sheet to finish it there.
   */
  const placeSubject = (slot: TimeSlot, slotDay: number, loadingId: number | null) => {
    const slotPattern = patternFor(slot);
    const entry = entryAt(entries, slotDay, slot);
    const isTaken = hasSubject(entry);
    // An open slot keeps the room it was copied with.
    const roomId = entry?.room_id ?? section.home_room_id;

    if (!loadingId || isTaken || !roomId) {
      setTarget({
        pattern: slotPattern,
        slot,
        day: slotDay,
        loadingId: isTaken ? undefined : loadingId,
      });
      return;
    }

    // JHS fills the whole pattern, SHS one day. Days that already have a subject stay as they are.
    const days = (section.level === "JHS" ? slotPattern.days : [slotDay]).filter(
      (item) => !hasSubject(entryAt(entries, item, slot)),
    );

    assign.mutate(
      {
        slotId: slot.id,
        section_subject_id: loadingId,
        room_id: roomId,
        days,
      },
      {
        onError: (error) =>
          setTarget({
            pattern: slotPattern,
            slot,
            day: slotDay,
            loadingId,
            days,
            error,
          }),
      },
    );
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setDraggedId((active.data.current as { loadingId: number }).loadingId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    const drop = readDrop(event);

    if (!drop) return;

    if (!drop.from) {
      placeSubject(drop.slot, drop.day, drop.loadingId);
      return;
    }

    const plan = planMove({ ...drop, from: drop.from }, patterns, entries, section.level);

    if (plan) {
      move.mutate({ slotId: drop.slot.id, from_slot_id: drop.from.slot.id, ...plan });
    }
  };

  const changeView = (next: PlotterView) => {
    setView(next);
    savePlotterView(next);
  };

  const handleDownload = (extension: "pdf" | "xlsx" | "csv") => {
    setDownloadError(null);
    downloadFile(
      `/terms/${termId}/sections/${section.id}/class-program.${extension}`,
    ).catch((error: Error) => setDownloadError(error.message));
  };

  const handleRevise = () => {
    revise.mutate(undefined, {
      onSuccess: ({ removed }) => setRemovedByRevise(removed),
    });
  };

  const moveConflict = conflictDetailsOf(move.error);

  const onSelect = canEdit
    ? (slot: TimeSlot, slotDay: number) => placeSubject(slot, slotDay, selectedLoadingId)
    : undefined;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Crumbs items={[{ label: "Home", to: "/dashboard" }, { label: "Schedule", to: "/schedule" }, { label: section.label }]} />

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#790D16] text-white shadow-sm shadow-[#790D16]/30">
              <TableProperties className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-branding">{section.label}</h1>
                <Badge className={`shrink-0 ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</Badge>
              </div>
              <p className="text-sm text-neutral-700">
                Adviser: {section.adviser ?? "None yet"}
                <span className="text-neutral-400"> · </span>
                {section.level === "SHS" ? "Senior High" : "Junior High"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                title="Let the system place the subjects not placed yet. You see a preview first, and can undo it."
                onClick={() => setIsAutoFillOpen(true)}
              >
                <Sparkles />
                Auto-fill
              </Button>
            )}
            {canEdit && status === "draft" && (
              <Button type="button" className="h-11" onClick={() => setIsSubmitOpen(true)}>
                <Send />
                Submit for approval
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t bg-neutral-50 px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Class Program</span>
          <div className="flex flex-wrap gap-1">
            {(["pdf", "xlsx", "csv"] as const).map((extension) => (
              <Button
                key={extension}
                type="button"
                variant="ghost"
                className="h-11 px-3"
                aria-label={`Class Program ${extension.toUpperCase()}`}
                onClick={() => handleDownload(extension)}
              >
                <Download />
                {extension.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <ChipRow
        label="Subjects"
        chips={loading.map(({ id, subject }) => <Chip key={id}>{subject}</Chip>)}
        empty="No teacher loading yet"
      />
      <TermTabs />
      <SegmentedTabs
        label="Show"
        className="sm:max-w-md"
        items={[
          { value: "daily" as const, label: "Daily schedule" },
          { value: "timetable" as const, label: "Timetable" },
        ]}
        value={mode}
        onChange={changeMode}
      />

      {status === "pending" && (
        <FormAlert variant="success">
          Submitted. This schedule is locked while it waits for the Admin.
        </FormAlert>
      )}

      {status === "approved" && (
        <FormAlert variant="success">
          Approved{lastReview ? ` by ${lastReview.reviewed_by}` : ""}. This schedule is locked.
        </FormAlert>
      )}

      {status === "rejected" && (
        <div className="space-y-2">
          <FormAlert>
            Rejected{lastReview ? ` by ${lastReview.reviewed_by}: ${lastReview.remarks}` : "."}
          </FormAlert>
          {canPlot && (
            <Button
              type="button"
              className="h-11"
              disabled={revise.isPending}
              onClick={handleRevise}
            >
              {revise.isPending ? "Opening..." : "Revise this schedule"}
            </Button>
          )}
          {revise.isError && <FormAlert>{apiErrorMessage(revise.error)}</FormAlert>}
        </div>
      )}

      {status === "draft" && lastReview && lastReview.action !== "approve" && (
        <FormAlert>
          {lastReview.action === "reject" ? "Rejected" : "Reopened"} by {lastReview.reviewed_by}:{" "}
          {lastReview.remarks}
        </FormAlert>
      )}

      {removedByRevise.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-medium">These entries could not come back. Please place them again:</p>
          <ul className="list-disc pl-4">
            {removedByRevise.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {downloadError && <FormAlert>{downloadError}</FormAlert>}
      {move.isError && (
        <FormAlert>
          Not moved.{" "}
          {moveConflict
            ? moveConflict.conflicts.map(({ message }) => message).join(" ")
            : apiErrorMessage(move.error)}
        </FormAlert>
      )}
      {patterns.length > 0 && loading.length > 0 && <FlagsPanel flags={flags} />}

      {mode === "timetable" && canEdit && patterns.length > 0 && loading.length > 0 && (
        <PlotterGuide loading={loading} {...plotContext} />
      )}

      {/* The daily schedule starts the bell schedule from typed times, so only the timetable needs one first. */}
      {(loading.length === 0 || (mode === "timetable" && patterns.length === 0)) && (
        <SetupChecklist
          sectionId={section.id}
          level={section.level}
          shift={section.shift as Shift}
          hasBellSchedule={patterns.length > 0}
          hasLoading={loading.length > 0}
          canFix={canPlot}
        />
      )}

      {mode === "daily" && loading.length > 0 && selectedTerm && (
        <SectionDailyView plotter={plotter} term={selectedTerm} canEdit={canEdit} canManageBreaks={canEdit} />
      )}

      {mode === "timetable" && patterns.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggedId(null)}
        >
          <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] gap-4 space-y-4 lg:space-y-0">
            {loading.length > 0 && (
              <div className="max-md:portrait:hidden lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
                <LoadingPanel
                  loading={loading}
                  selectedId={selectedLoadingId}
                  onSelect={canEdit ? setSelectedLoadingId : undefined}
                {...plotContext}
                />
              </div>
            )}

            <div className={`min-w-0 space-y-3 ${loading.length === 0 ? "lg:col-span-2" : ""}`}>
            {placing && (
              <div
                role="status"
                className="sticky top-20 z-20 flex items-center justify-between gap-2 rounded-md border-2 border-[#790D16] bg-background p-2 text-sm shadow"
              >
                <p className="min-w-0">
                  <span className="font-medium">Now placing: {placing.subject}.</span> Tap the empty periods where it
                  belongs.
                </p>
                <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setSelectedLoadingId(null)}>
                  <X />
                  Done
                </Button>
              </div>
            )}

              <ColorCodingSwitch />

              {/* Wide screens and landscape */}
              <div className="max-md:portrait:hidden space-y-3">
                <div role="tablist" aria-label="View" className="grid grid-cols-2 gap-2 sm:w-80">
                  {PLOTTER_VIEWS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={value === view}
                      onClick={() => changeView(value)}
                      className={`min-h-11 rounded-md border px-3 text-sm font-medium ${
                        value === view
                          ? "bg-[#790D16] text-white border-[#790D16]"
                          : "bg-background text-neutral-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {view === "days" && (
                  <ScheduleDayCards patterns={patterns} entries={entries} onSelect={onSelect} />
                )}

                {view === "grid" && patterns.length > 1 && (
                  <div role="tablist" aria-label="Bell schedule" className="flex gap-2">
                    {patterns.map(({ id, name }) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={id === pattern?.id}
                        onClick={() => setPatternId(id)}
                        className={`min-h-11 flex-1 sm:flex-none rounded-md border px-4 text-sm font-medium ${
                          id === pattern?.id
                            ? "bg-[#790D16] text-white border-[#790D16]"
                            : "bg-background text-neutral-700"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {view === "grid" && pattern && (
                  <ScheduleGrid pattern={pattern} entries={entries} onSelect={onSelect} />
                )}
              </div>

              {/* Phones in portrait */}
              <div className="hidden max-md:portrait:block">
                <ScheduleDayList
                  patterns={patterns}
                  entries={entries}
                  day={day}
                  onDayChange={setDay}
                  onSelect={onSelect}
                />
              </div>
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {dragged && (
              <div className={`w-56 rounded-md border p-2 text-left shadow-lg ${subjectColor(dragged.id, isColored)}`}>
                <span className="block text-xs font-medium">{dragged.subject}</span>
                <span className="block text-[11px] opacity-80">{dragged.teacher}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {canPlot && (status === "draft" || status === "rejected") && entries.length > 0 && (
        <div className="space-y-2 border-t pt-4 sm:max-w-sm">
          {clearSchedule.isError && <FormAlert>{apiErrorMessage(clearSchedule.error)}</FormAlert>}
          <ConfirmDelete
            label="Clear this schedule"
            icon={Eraser}
            confirmLabel="Yes, clear it"
            warning={`This removes all ${entries.length} classes of ${section.label} so you can start over. The teacher loading stays.`}
            isPending={clearSchedule.isPending}
            onConfirm={() => clearSchedule.mutate()}
          />
        </div>
      )}

      {canEdit && plotter.last_auto_fill && (
        <div className="space-y-2 border-t pt-4 sm:max-w-sm">
          {undoAutoFill.isError && <FormAlert>{apiErrorMessage(undoAutoFill.error)}</FormAlert>}
          <ConfirmDelete
            label="Undo the last auto-fill"
            icon={Undo2}
            confirmLabel="Yes, undo it"
            warning={`This removes the ${plotter.last_auto_fill.entries} classes the last auto-fill placed here (and in the other sections it filled). Classes you placed or moved yourself stay.`}
            isPending={undoAutoFill.isPending}
            onConfirm={() => plotter.last_auto_fill && undoAutoFill.mutate(plotter.last_auto_fill.id)}
          />
        </div>
      )}

      {isAutoFillOpen && (
        <AutoFillSheet plotter={plotter} termId={termId} onClose={() => setIsAutoFillOpen(false)} />
      )}

      {isSubmitOpen && (
        <SubmitSheet
          plotter={plotter}
          termId={termId}
          onClose={() => setIsSubmitOpen(false)}
        />
      )}

      {target && (
        <EntrySheet
          key={`${target.slot.id}-${target.day}`}
          target={target}
          plotter={plotter}
          termId={termId}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
};

export default PlotterPage;
