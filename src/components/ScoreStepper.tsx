import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScoreStepperProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}

const toNumber = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const ScoreStepper = ({ label, value, onChange, disabled, className }: ScoreStepperProps) => {
  const numericValue = value === "" ? 0 : toNumber(value);
  const decrement = () => onChange(String(Math.max(0, numericValue - 1)));
  const increment = () => onChange(String(numericValue + 1));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 rounded-lg border-[#26313D] bg-[#151C26] text-[#F4F7F5]"
        onClick={decrement}
        disabled={disabled || numericValue <= 0}
        aria-label={`הורד תוצאה עבור ${label}`}
      >
        <Minus className="h-5 w-5" />
      </Button>
      <span className="sr-only">{label}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 rounded-lg border-[#26313D] bg-[#151C26] text-[#F4F7F5]"
        onClick={increment}
        disabled={disabled}
        aria-label={`העלה תוצאה עבור ${label}`}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
};

