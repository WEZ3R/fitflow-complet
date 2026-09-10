import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  outline: "border-2 border-primary-600 text-primary-600 hover:bg-primary-50",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2",
  lg: "px-6 py-3 text-lg",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = ({ children, variant = "primary", size = "md", className, ...props }: ButtonProps) => {
  return (
    <button className={cn("btn", variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};
