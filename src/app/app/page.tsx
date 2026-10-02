import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { title: "Notesflow" };

export default function AppPage() {
  return <AppShell />;
}
