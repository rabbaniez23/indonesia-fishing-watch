"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button className="print:hidden" icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
      Cetak
    </Button>
  );
}
