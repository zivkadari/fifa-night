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

type BottomNavItem = {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

export const SoccerNightBottomNav = ({ items }: { items: BottomNavItem[] }) => (
  <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#26313D] bg-[#05070A]/95 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-[backdrop-filter]:bg-[#05070A]/88">
    <div
      className="mx-auto grid w-full sm:max-w-md"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      dir="rtl"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={cn(
            "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold text-[#A4ADB8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF88]",
            item.active && "relative -mt-5 text-[#39FF88]",
            item.disabled && "cursor-not-allowed opacity-45"
          )}
          onClick={item.onClick}
          disabled={item.disabled}
          aria-label={item.ariaLabel ?? item.label}
        >
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center",
              item.active &&
                "h-14 w-16 rounded-t-2xl border border-[#39FF88]/35 bg-[#0E2A1A] shadow-[0_0_22px_rgba(57,255,136,0.22)]"
            )}
          >
            {item.icon}
          </span>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  </nav>
);
