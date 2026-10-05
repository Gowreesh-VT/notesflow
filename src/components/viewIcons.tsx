import { CalendarFold, ChartGantt, Clock3, Grid2x2 } from "lucide-react";
import type { PlannerViewKind } from "@/lib/types";

export const PLANNER_ICONS: Record<PlannerViewKind, typeof CalendarFold> = {
  calendar: CalendarFold,
  matrix: Grid2x2,
  timeline: ChartGantt,
  plan: Clock3,
};
