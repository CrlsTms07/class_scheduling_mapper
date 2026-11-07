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
import { ArrowLeft, Download, Send, TableProperties } from "lucide-react";
import { conflictDetailsOf, useAssignSlot, useMoveEntry, usePlotter, useReviseSchedule } from "@/api/schedule";
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
import type { DayPattern, Plotter, TimeSlot } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import EntrySheet, { type SheetTarget } from "./EntrySheet";
import FlagsPanel from "./FlagsPanel";
import LoadingPanel from "./LoadingPanel";
import ScheduleDayCards from "./ScheduleDayCards";
import ScheduleDayList from "./ScheduleDayList";
import ScheduleGrid from "./ScheduleGrid";
import SubmitSheet from "./SubmitSheet";

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
        <FormAlert>This section is not available in the selected term.</FormAlert>
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
  const [removedByRevise, setRemovedByRevise] = React.useState<string[]>([]);
  const [view, setView] = React.useState<PlotterView>(readPlotterView);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);
  const assign = useAssignSlot(termId, section.id);
  const move = useMoveEntry(termId, section.id);

  // A short click stays a tap. On a touch screen, hold first, so that swiping still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const dragged = loading.find(({ id }) => id === draggedId);
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

  const handleDownload = (extension: "pdf" | "xlsx") => {
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
      <BackToSections />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-[#790D16]/10 p-2 rounded-sm shrink-0">
            <TableProperties className="text-branding" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-teal-700">{section.label}</p>
            <p className="text-neutral-700 text-xs">
              Adviser: {section.adviser ?? "None yet"}
            </p>
          </div>
          <Badge className={`shrink-0 ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
          </Badge>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {(["pdf", "xlsx"] as const).map((extension) => (
              <Button
                key={extension}
                type="button"
                variant="outline"
                className="h-11"
                aria-label={`Class Program ${extension.toUpperCase()}`}
                onClick={() => handleDownload(extension)}
              >
                <Download />
                {extension.toUpperCase()}
              </Button>
            ))}
          </div>
          {canEdit && status === "draft" && (
            <Button
              type="button"
              className="h-11"
              onClick={() => setIsSubmitOpen(true)}
            >
              <Send />
              Submit for approval
            </Button>
          )}
        </div>
      </div>

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
      <FlagsPanel flags={flags} />

      {patterns.length === 0 && (
        <FormAlert>
          No bell schedule is set for {section.level}, {section.shift} shift, in this
          school year. The Admin sets these up in Time Slots.
        </FormAlert>
      )}

      {loading.length === 0 && (
        <div className="space-y-2">
          <FormAlert>
            No teacher loading for this section in this term yet, so there are no subjects
            to place.
          </FormAlert>
          {canPlot && (
            <Link
              to={`/teacher-loading?section=${section.id}`}
              className={buttonVariants({ variant: "outline", className: "h-11" })}
            >
              Go to Teacher Loading
            </Link>
          )}
        </div>
      )}

      {patterns.length > 0 && (
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
                />
              </div>
            )}

            <div className={`min-w-0 ${loading.length === 0 ? "lg:col-span-2" : ""}`}>
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
              <div className={`w-56 rounded-md border p-2 text-left shadow-lg ${subjectColor(dragged.id)}`}>
                <span className="block text-xs font-medium">{dragged.subject}</span>
                <span className="block text-[11px] opacity-80">{dragged.teacher}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
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
