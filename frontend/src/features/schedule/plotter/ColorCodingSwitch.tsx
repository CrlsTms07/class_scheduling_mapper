import { useColorCoding, useUpdatePreferences } from "@/api/auth";

/**
 * Turns subject colors on or off. The choice is kept on the account, so it follows the
 * user to any device. Off shows plain cells, like a classic timetable.
 */
const ColorCodingSwitch = () => {
  const isColored = useColorCoding();
  const update = useUpdatePreferences();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isColored}
      disabled={update.isPending}
      onClick={() => update.mutate({ color_coding: !isColored })}
      className="flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-neutral-800 disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          isColored ? "bg-[#790D16]" : "bg-neutral-300"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            isColored ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      Color coding
    </button>
  );
};

export default ColorCodingSwitch;
