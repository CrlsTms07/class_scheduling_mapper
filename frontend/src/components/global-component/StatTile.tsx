import type { LucideIcon } from "lucide-react";

type StatTileProp = {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Amber when the number needs attention. */
  tone?: "default" | "warning";
};

/** One number with its label, for the summary row at the top of a page. */
const StatTile = ({ icon: Icon, label, value, tone = "default" }: StatTileProp) => (
  <div
    className={`flex items-center gap-3 rounded-xl border bg-background p-3 ${
      tone === "warning" ? "border-amber-300 bg-amber-50" : ""
    }`}
  >
    <div
      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
        tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-[#790D16]/10 text-branding"
      }`}
    >
      <Icon className="size-5" />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-semibold leading-tight text-neutral-900">{value}</p>
      <p className="truncate text-xs text-neutral-700">{label}</p>
    </div>
  </div>
);

export default StatTile;
