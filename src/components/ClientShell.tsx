"use client";

import { useState } from "react";
import FactorsPanel from "./FactorsPanel";
import MonitorDialog from "./MonitorDialog";
import type { Factor } from "@/lib/db";

interface Props {
  factors: Factor[];
}

export default function ClientShell({ factors }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <FactorsPanel factors={factors} onAddMonitor={() => setDialogOpen(true)} />
      <MonitorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
