"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"

const Dialog = (props: React.ComponentProps<typeof DialogPrimitive.Root>) => <DialogPrimitive.Root data-slot="dialog" {...props} />
const DialogTrigger = (props: React.ComponentProps<typeof DialogPrimitive.Trigger>) => <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
const DialogPortal = (props: React.ComponentProps<typeof DialogPrimitive.Portal>) => <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
const DialogClose = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Close>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>>((props, ref) => <DialogPrimitive.Close ref={ref} data-slot="dialog-close" {...props} />)
DialogClose.displayName = DialogPrimitive.Close.displayName

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-slot="dialog-content"
      className={cn(
        "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && <DialogPrimitive.Close data-slot="dialog-close" className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4">
        <X />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn(
      "flex flex-col gap-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className, children, showCloseButton = false, ...props
}: React.HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }) => (
  <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props}>
    {children}
    {showCloseButton && <DialogPrimitive.Close asChild><Button variant="outline">Close</Button></DialogPrimitive.Close>}
  </div>
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="dialog-title"
    className={cn(
      "text-lg leading-none font-semibold",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="dialog-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
