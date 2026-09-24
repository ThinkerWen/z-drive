"use client"

import * as React from "react"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function DropdownMenu(props: React.ComponentProps<typeof Menu.Root>) { return <Menu.Root data-slot="dropdown-menu" {...props} /> }
const DropdownMenuTrigger = React.forwardRef<React.ElementRef<typeof Menu.Trigger>, React.ComponentPropsWithoutRef<typeof Menu.Trigger>>((props, ref) => <Menu.Trigger ref={ref} data-slot="dropdown-menu-trigger" {...props} />)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"
function DropdownMenuGroup(props: React.ComponentProps<typeof Menu.Group>) { return <Menu.Group data-slot="dropdown-menu-group" {...props} /> }
function DropdownMenuPortal(props: React.ComponentProps<typeof Menu.Portal>) { return <Menu.Portal data-slot="dropdown-menu-portal" {...props} /> }
function DropdownMenuSub(props: React.ComponentProps<typeof Menu.Sub>) { return <Menu.Sub data-slot="dropdown-menu-sub" {...props} /> }
function DropdownMenuRadioGroup(props: React.ComponentProps<typeof Menu.RadioGroup>) { return <Menu.RadioGroup data-slot="dropdown-menu-radio-group" {...props} /> }

const DropdownMenuSubTrigger = React.forwardRef<React.ElementRef<typeof Menu.SubTrigger>, React.ComponentPropsWithoutRef<typeof Menu.SubTrigger> & { inset?: boolean }>(
  ({ className, inset, children, ...props }, ref) => (
    <Menu.SubTrigger ref={ref} data-slot="dropdown-menu-sub-trigger" data-inset={inset} className={cn(
      "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground", className
    )} {...props}>{children}<ChevronRightIcon className="ml-auto size-4" /></Menu.SubTrigger>
  )
)
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger"

const DropdownMenuSubContent = React.forwardRef<React.ElementRef<typeof Menu.SubContent>, React.ComponentPropsWithoutRef<typeof Menu.SubContent>>(
  ({ className, ...props }, ref) => <Menu.SubContent ref={ref} data-slot="dropdown-menu-sub-content" className={cn(
    "z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className
  )} {...props} />
)
DropdownMenuSubContent.displayName = "DropdownMenuSubContent"

const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof Menu.Content>, React.ComponentPropsWithoutRef<typeof Menu.Content>>(
  ({ className, sideOffset = 4, ...props }, ref) => <Menu.Portal><Menu.Content ref={ref} data-slot="dropdown-menu-content" sideOffset={sideOffset} className={cn(
    "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className
  )} {...props} /></Menu.Portal>
)
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof Menu.Item>, React.ComponentPropsWithoutRef<typeof Menu.Item> & { inset?: boolean; variant?: "default" | "destructive" }>(
  ({ className, inset, variant = "default", ...props }, ref) => <Menu.Item ref={ref} data-slot="dropdown-menu-item" data-inset={inset} data-variant={variant} className={cn(
    "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!", className
  )} {...props} />
)
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuCheckboxItem = React.forwardRef<React.ElementRef<typeof Menu.CheckboxItem>, React.ComponentPropsWithoutRef<typeof Menu.CheckboxItem>>(
  ({ className, children, checked, ...props }, ref) => <Menu.CheckboxItem ref={ref} data-slot="dropdown-menu-checkbox-item" checked={checked} className={cn(
    "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className
  )} {...props}><span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center"><Menu.ItemIndicator><CheckIcon className="size-4" /></Menu.ItemIndicator></span>{children}</Menu.CheckboxItem>
)
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

const DropdownMenuRadioItem = React.forwardRef<React.ElementRef<typeof Menu.RadioItem>, React.ComponentPropsWithoutRef<typeof Menu.RadioItem>>(
  ({ className, children, ...props }, ref) => <Menu.RadioItem ref={ref} data-slot="dropdown-menu-radio-item" className={cn(
    "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className
  )} {...props}><span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center"><Menu.ItemIndicator><CircleIcon className="size-2 fill-current" /></Menu.ItemIndicator></span>{children}</Menu.RadioItem>
)
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof Menu.Label>, React.ComponentPropsWithoutRef<typeof Menu.Label> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => <Menu.Label ref={ref} data-slot="dropdown-menu-label" data-inset={inset} className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)} {...props} />
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = React.forwardRef<React.ElementRef<typeof Menu.Separator>, React.ComponentPropsWithoutRef<typeof Menu.Separator>>(
  ({ className, ...props }, ref) => <Menu.Separator ref={ref} data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
)
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuShortcut = ({ className, ...props }: React.ComponentProps<"span">) => <span data-slot="dropdown-menu-shortcut" className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup }