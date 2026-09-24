"use client"

import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = (props: React.ComponentProps<typeof CollapsiblePrimitive.Root>) => <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
const CollapsibleTrigger = React.forwardRef<React.ElementRef<typeof CollapsiblePrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>>((props, ref) => <CollapsiblePrimitive.Trigger ref={ref} data-slot="collapsible-trigger" {...props} />)
CollapsibleTrigger.displayName = CollapsiblePrimitive.Trigger.displayName
const CollapsibleContent = React.forwardRef<React.ElementRef<typeof CollapsiblePrimitive.Content>, React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>>((props, ref) => <CollapsiblePrimitive.Content ref={ref} data-slot="collapsible-content" {...props} />)
CollapsibleContent.displayName = CollapsiblePrimitive.Content.displayName

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
