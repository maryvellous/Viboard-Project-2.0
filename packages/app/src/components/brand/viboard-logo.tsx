import viboardLogoUrl from "@/assets/brand/viboard-logo.svg";
import { cn } from "@/lib/utils";

interface ViboardLogoProps {
  size?: number;
  className?: string;
  title?: string;
}

export function ViboardLogo({ size, className, title }: ViboardLogoProps) {
  return (
    <img
      src={viboardLogoUrl}
      width={size}
      height={size}
      className={cn("block shrink-0", className)}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  );
}
