"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  checked = false,
  onCheckedChange,
  disabled,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onChange"> & {
  size?: "sm" | "default"
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-slot="switch"
      data-size={size}
      data-checked={checked ? "" : undefined}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px]",
        checked ? "bg-primary" : "bg-input dark:bg-input/80",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform",
          size === "default" ? "size-4" : "size-3",
          checked ? "translate-x-[calc(100%-2px)]" : "translate-x-0",
          "dark:bg-primary-foreground",
        )}
      />
    </button>
  )
}

export { Switch }
