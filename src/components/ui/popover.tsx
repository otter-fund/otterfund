"use client"

// otterfund Popover — thin wrapper over @base-ui/react Popover, same house pattern
// as ui/select.tsx and ui/menu.tsx (Portal → Positioner → Popup). Used for
// rich, non-menu popovers (the notifications panel, the month picker) where the
// content is arbitrary rather than a list of items. The Positioner keeps the
// popup on-screen at any viewport with no manual anchoring.

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverClose = PopoverPrimitive.Close

function PopoverContent({
  className,
  children,
  side = "bottom",
  sideOffset = 8,
  align = "end",
  alignOffset = 0,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={12}
        className="z-50 max-w-[calc(100vw-24px)]"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "of-pop max-h-[var(--available-height)] max-w-[calc(100vw-24px)] origin-[var(--transform-origin)] overflow-hidden rounded-[18px] border border-[var(--color-of-line)] bg-[var(--color-of-surface)] shadow-[0_12px_32px_oklch(20%_0.02_80/0.16)] outline-none",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverClose, PopoverContent }
