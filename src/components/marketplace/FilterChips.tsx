import { SlidersHorizontal } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ChipOption = { id: string; label: string; count: number };

/**
 * Faceted filter chips — a toggle per option with a live match count.
 * Adapted from the 21st.dev "Role Filter Chips" pattern onto the project's
 * own Toggle/Badge primitives and brand colors.
 */
export function FilterChips({
  label,
  options,
  active,
  onToggle,
  onClear,
}: {
  label: string;
  options: ChipOption[];
  active: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <SlidersHorizontal className="size-3.5" />
          <span>{label}</span>
        </div>
        {active.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const isActive = active.has(o.id);
          return (
            <Toggle
              key={o.id}
              pressed={isActive}
              onPressedChange={() => onToggle(o.id)}
              aria-label={`Filter by ${o.label}`}
              size="sm"
              variant="outline"
              disabled={o.count === 0 && !isActive}
              className={cn(
                "h-8 gap-1.5 rounded-full border-border/60 px-3 text-xs font-semibold",
                "data-[state=on]:border-primary/50 data-[state=on]:bg-primary/15 data-[state=on]:text-foreground",
              )}
            >
              {o.label}
              <Badge
                variant={isActive ? "default" : "outline"}
                className={cn(
                  "rounded-full px-1.5 py-0 text-[10px] font-bold",
                  isActive
                    ? "bg-primary-foreground/20 text-current"
                    : "border-border/60 text-muted-foreground",
                )}
              >
                {o.count}
              </Badge>
            </Toggle>
          );
        })}
      </div>
    </div>
  );
}
