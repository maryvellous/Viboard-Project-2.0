import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { densityClasses, type Density } from "@/lib/enterprise-ui";
import { Skeleton } from "@/components/ui/skeleton";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterBarConfig {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel?: string;
  width?: string;
}

interface FilterBarProps {
  filters: FilterBarConfig[];
  count: number;
  countLabel: string;
  className?: string;
  rightElement?: React.ReactNode;
  leadingElement?: React.ReactNode;
  density?: Density;
  isLoading?: boolean;
}

export function FilterBar({
  filters,
  count,
  countLabel,
  className,
  rightElement,
  leadingElement,
  density = "regular",
  isLoading = false,
}: FilterBarProps) {
  const { t } = useTranslation();
  const rowHeight = densityClasses[density].section;
  const defaultAllLabel = t("common.buttons.all");

  return (
    <div className={cn("flex min-h-11 flex-1 flex-wrap items-center gap-3", rowHeight, className)}>
      {leadingElement}
      {filters.map((filter) => (
        <div key={filter.id} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{filter.label}:</span>
          <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger size="xs" className={cn("text-xs", filter.width || "w-[160px]")}>
              <SelectValue placeholder={filter.allLabel || defaultAllLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filter.allLabel || defaultAllLabel}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {isLoading ? (
          <Skeleton className="h-3 w-16" />
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {count} {countLabel}
          </span>
        )}
        {rightElement}
      </div>
    </div>
  );
}
