import {
  CalendarFold,
  ChartGantt,
  ClipboardCheck,
  Clock3,
  Grid2x2,
  TrendingUp,
  Zap,
  Repeat2,
  Timer,
} from "lucide-react";
import type { PlannerViewKind } from "@/lib/types";

export const PLANNER_ICONS: Record<PlannerViewKind, typeof CalendarFold> = {
  calendar: CalendarFold,
  matrix: Grid2x2,
  timeline: ChartGantt,
  plan: Clock3,
  focus: Timer,
  habits: Repeat2,
  review: ClipboardCheck,
  progress: TrendingUp,
  quick: Zap,
};
