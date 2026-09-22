import diasproLogoUrl from "@/assets/brand/diaspro-logo.svg";
import { cn } from "@/lib/utils";

interface DiasproLogoProps {
  size?: number;
  className?: string;
  title?: string;
}

export function DiasproLogo({ size, className, title }: DiasproLogoProps) {
  return (
    <img
      src={diasproLogoUrl}
      width={size}
      height={size}
      className={cn("block shrink-0", className)}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  );
}
