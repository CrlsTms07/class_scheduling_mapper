import type { LucideIcon } from "lucide-react";

type PageHeaderProp = {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Buttons on the right; they stack under the title on phones. */
  actions?: React.ReactNode;
};

/** The title row of a page: icon, title, a short line under it, and the page's main buttons. */
const PageHeader = ({ icon: Icon, title, description, actions }: PageHeaderProp) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#790D16] text-white shadow-sm shadow-[#790D16]/30">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-branding">{title}</h1>
        {description && <p className="text-sm text-neutral-700">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 flex-col gap-2 sm:flex-row">{actions}</div>}
  </div>
);

export default PageHeader;
