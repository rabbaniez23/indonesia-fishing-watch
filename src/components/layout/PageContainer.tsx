import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Padding halaman 16/24/32px dan lebar maksimum konten nonpeta 1600px (DS §5, §6.1). */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8", className)}>
      {children}
    </div>
  );
}
