"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type KyraBtnVariant = "emerald" | "navy" | "outline" | "ghost" | "danger" | "subtle";
type KyraBtnSize = "sm" | "md" | "lg" | "icon";

export interface KyraButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: KyraBtnVariant;
  size?: KyraBtnSize;
}

const variantMap: Record<KyraBtnVariant, string> = {
  emerald: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs border border-emerald-600",
  navy: "bg-[#0e1e32] text-white hover:bg-[#142a45] shadow-xs border border-[#0e1e32]",
  outline: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white hover:bg-red-500 shadow-xs border border-red-600",
  subtle: "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200",
};

const sizeMap: Record<KyraBtnSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-9 px-4 text-xs rounded-lg gap-2",
  lg: "h-10 px-5 text-sm rounded-xl gap-2",
  icon: "h-8 w-8 rounded-lg justify-center",
};

export const KyraButton = React.forwardRef<HTMLButtonElement, KyraButtonProps>(
  ({ className, variant = "emerald", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 disabled:pointer-events-none",
        variantMap[variant],
        sizeMap[size],
        className
      )}
      {...props}
    />
  )
);
KyraButton.displayName = "KyraButton";

export function KyraCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-white rounded-xl border border-slate-200/80 shadow-xs", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function KyraBadge({
  tone = "slate",
  className,
  children,
}: {
  tone?: "emerald" | "amber" | "red" | "blue" | "purple" | "slate";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function KyraSwitch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="w-9 h-5 rounded-full bg-slate-200 data-[state=checked]:bg-emerald-600 relative transition-colors outline-none cursor-pointer disabled:opacity-50"
    >
      <SwitchPrimitive.Thumb className="block w-4 h-4 bg-white rounded-full shadow-xs transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

export const KyraModal = DialogPrimitive.Root;
export const KyraModalTrigger = DialogPrimitive.Trigger;

export function KyraModalContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto focus:outline-none",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100 mb-4">
          <div>
            <DialogPrimitive.Title className="text-base font-bold text-slate-900">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-xs text-slate-500 mt-0.5">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const KyraTabs = TabsPrimitive.Root;

export function KyraTabsList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80",
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function KyraTabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 transition-all data-[state=active]:bg-[#0e1e32] data-[state=active]:text-white data-[state=active]:shadow-xs hover:text-slate-900",
        className
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export const KyraTabsContent = TabsPrimitive.Content;
