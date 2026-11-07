import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
};

const variants = {
  default: "bg-[#167354] text-white shadow-sm hover:bg-[#105a41]",
  outline: "border border-[#dfe6e1] bg-white text-[#425149] hover:bg-[#f7faf7]",
  ghost: "bg-transparent text-[#425149] hover:bg-[#f2f6f2]",
};

const sizes = {
  default: "min-h-10 px-4 py-2.5 text-sm",
  sm: "min-h-9 px-3 py-2 text-xs",
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#167354]/15 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />;
}
