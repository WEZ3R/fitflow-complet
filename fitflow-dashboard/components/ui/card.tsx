import { cn } from "@/lib/utils";
import { type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
}

export const Card = ({ children, className, title, ...props }: CardProps) => {
  return (
    <div className={cn("card", className)} {...props}>
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      {children}
    </div>
  );
};
