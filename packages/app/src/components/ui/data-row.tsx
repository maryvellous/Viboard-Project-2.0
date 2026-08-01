import { cn } from "@/lib/utils";
import { densityClasses, type Density } from "@/lib/enterprise-ui";
import { interactionClasses } from "@/lib/enterprise-ui";

interface DataRowProps {
  children: React.ReactNode;
  density?: Density;
  active?: boolean;
  className?: string;
}

export function DataRow({
  children,
  density = "regular",
  active = false,
  className,
}: DataRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md transition-colors",
        densityClasses[density].row,
        active ? interactionClasses.selectedContent : interactionClasses.restingContent,
        interactionClasses.keyboardFocus,
        className
      )}
    >
      {children}
    </div>
  );
}
