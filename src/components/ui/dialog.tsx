"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    // Transition-driven fade (not animate-in/out): a class-driven end state
    // persists while the popup's longer exit transition finishes on mobile —
    // an exit *animation* ends early and snaps the scrim back to full
    // opacity, which read as a flicker. Opacity rests at 1; the state
    // attributes fade it out.
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-[oklch(20%_0.02_80/0.32)] transition-opacity duration-300 md:duration-100 data-starting-style:opacity-0 data-ending-style:opacity-0 data-closed:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      {/* Mobile-first: below md the popup is a bottom sheet — position + slide
          motion live on `.of-dialog` in globals.css (the same transition
          pattern as the nav sheet, so open/close slide instead of popping).
          Centering + the zoom-fade animation are md:-scoped so they can't
          fight the sheet transition on phones. Size/padding overrides from
          callers stay on sm: (e.g. sm:max-w-[480px]) and keep merging. */}
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "of-dialog fixed z-50 grid w-full max-w-[calc(100%-2.5rem)] max-h-[calc(100dvh-2.5rem)] overflow-y-auto overscroll-contain gap-5 rounded-[24px] border border-[var(--color-of-line)] bg-[var(--color-of-surface)] p-6 sm:p-8 text-sm text-[var(--color-of-ink)] shadow-[0_24px_64px_oklch(20%_0.02_80/0.16),0_2px_8px_oklch(20%_0.02_80/0.06)] outline-none sm:max-w-[460px] md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:duration-100 md:data-open:animate-in md:data-open:fade-in-0 md:data-open:zoom-in-95 md:data-closed:animate-out md:data-closed:fade-out-0 md:data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base leading-none font-semibold tracking-[-0.02em]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
