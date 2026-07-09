"use client"

// otterfund Menu — a thin wrapper over @base-ui/react Menu, matching the house
// pattern in ui/select.tsx (Portal → Positioner → Popup). The Positioner does
// collision detection and viewport shifting for free, so menus never clip off
// small screens — no hand-rolled position:absolute anchors. Styling reads the
// same otterfund tokens the old inline menus used, so the look is unchanged.

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

const Menu = MenuPrimitive.Root
const MenuTrigger = MenuPrimitive.Trigger
const MenuGroup = MenuPrimitive.Group

function MenuContent({
  className,
  children,
  side = "bottom",
  sideOffset = 8,
  align = "end",
  alignOffset = 0,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        // Keep the menu inside the viewport with a comfortable gutter on phones.
        collisionPadding={12}
        className="z-50 max-w-[calc(100vw-24px)]"
      >
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            "of-pop max-h-[var(--available-height)] min-w-[196px] max-w-[calc(100vw-24px)] origin-[var(--transform-origin)] overflow-y-auto rounded-[14px] border border-[var(--color-of-line)] bg-[var(--color-of-surface)] p-1.5 shadow-[0_12px_32px_oklch(20%_0.02_80/0.14)] outline-none",
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

// One shared item look — mirrors the old .of-menu-item (9px/11px pad, 13.5px
// semibold, accent-tinted hover), with truncation so long labels can't widen
// the popup. Works for plain Items and the label of checkbox/radio items.
const itemCls =
  "flex w-full items-center gap-2.5 rounded-[9px] px-[11px] py-[9px] text-[13.5px] font-semibold text-[var(--color-of-ink)] no-underline outline-none cursor-pointer transition-colors data-highlighted:bg-[oklch(96%_0.005_90)] [&>span:first-child]:min-w-0 [&>span:first-child]:truncate"

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(itemCls, className)}
      {...props}
    />
  )
}

function MenuRadioGroup(props: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup {...props} />
}

function MenuRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menu-radio-item"
      className={cn(itemCls, "justify-between", className)}
      {...props}
    >
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function MenuCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      className={cn(itemCls, "justify-between", className)}
      {...props}
    >
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function MenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn("mx-1 my-1.5 h-px bg-[var(--color-of-line-soft)]", className)}
      {...props}
    />
  )
}

export {
  Menu,
  MenuTrigger,
  MenuGroup,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuCheckboxItem,
  MenuSeparator,
}
