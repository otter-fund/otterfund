import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline:
          "border-border bg-background hover:border-primary hover:text-primary aria-expanded:border-primary aria-expanded:text-primary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        danger:
          "bg-[var(--color-bk-clay)] text-white hover:opacity-90 focus-visible:ring-destructive/30",
        // Inline text link (e.g. a card header's "View all →"). Self-contained:
        // resets the base pill's height/padding/rounding so it sits on the text
        // baseline regardless of `size`. Accent-toned, subtle hover.
        link: "!h-auto !min-h-0 gap-1 !rounded-none !border-0 !bg-transparent !px-0 py-0 font-semibold text-primary hover:opacity-70 focus-visible:ring-0 focus-visible:underline focus-visible:underline-offset-4",
      },
      size: {
        xs: "h-8 gap-1 px-3.5 text-xs has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-10 gap-1.5 px-4.5 text-sm has-data-[icon=inline-start]:pl-4",
        default: "h-11 gap-2 px-5 has-data-[icon=inline-start]:pl-4.5",
        lg: "h-12 gap-2 px-6 text-[15px] has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
