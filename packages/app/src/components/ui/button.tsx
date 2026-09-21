import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // The global action pill — Diaspro language from diaspro-ui/cards/cards.css:
        // generous radius, Outfit extrabold, short shadow, lift on hover and a
        // slightly "rubbery" press. Kept to primary/secondary so filters, selects
        // and other dense controls stay practical.
        default:
          "rounded-full font-[Outfit] text-[13px] font-extrabold tracking-[.2px] shadow-[0_4px_14px_rgba(0,0,0,.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,.38)] active:translate-y-0 active:scale-[.97] active:shadow-[0_3px_8px_rgba(0,0,0,.3)] duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        destructive:
          "rounded-full font-[Outfit] text-[13px] font-extrabold tracking-[.2px] shadow-[0_4px_14px_rgba(0,0,0,.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[.97] duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] bg-destructive text-white hover:bg-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "rounded-full font-[Outfit] text-[13px] font-extrabold tracking-[.2px] shadow-[0_3px_10px_rgba(0,0,0,.24)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[.97] duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] bg-secondary text-secondary-foreground hover:bg-secondary",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
