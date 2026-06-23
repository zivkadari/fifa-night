import { ChevronDown } from "lucide-react";
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const TournamentStatusPill = ({ children, active = true }: { children: ReactNode; active?: boolean }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-[#26313D] bg-[#0F141B]/90 px-3 py-1 text-xs font-semibold text-[#F4F7F5]">
    {children}
    {active && <span className="h-2 w-2 rounded-full bg-[#39FF88] shadow-[0_0_12px_rgba(57,255,136,0.8)]" aria-hidden="true" />}
  </span>
);

export const CompactSummaryCard = ({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("min-h-[7rem] rounded-lg border border-[#26313D] bg-[#0F141B] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]", className)}>
    <div className="mb-2 flex items-center gap-2 text-[#F4F7F5]">
      <span className="text-[#39FF88]">{icon}</span>
      <h3 className="text-sm font-bold">{title}</h3>
    </div>
    {children}
  </section>
);

export const RecentResultCard = ({ children, className }: { children: ReactNode; className?: string }) => (
  <article className={cn("rounded-lg border border-[#26313D] bg-[#0F141B] px-3 py-2", className)}>
    {children}
  </article>
);

export const CollapsibleSection = ({
  title,
  preview,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  preview?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden rounded-lg border border-[#26313D] bg-[#0F141B]">
        <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF88]">
          <span className="flex min-w-0 items-center gap-3">
            {icon && <span className="text-[#6F7A86]">{icon}</span>}
            <span className="font-bold text-[#F4F7F5]">{title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-[#39FF88]">
            {preview}
            <ChevronDown className={cn("h-4 w-4 text-[#6F7A86] transition-transform", open && "rotate-180")} />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-[#26313D] p-3">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

