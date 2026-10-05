import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { ReloadWhenOnline } from "@/components/ReloadWhenOnline";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <ReloadWhenOnline />
      <LogoMark size={48} />
      <h1 className="text-xl font-semibold">You’re offline</h1>
      <p className="text-sm text-stone-600 dark:text-stone-400">
        This page isn’t available without a connection. Your tasks and notes are stored on this
        device, so reopen Notesflow and everything you already have will still be there.
      </p>
      <Link href="/" className="btn btn-primary">
        Open Notesflow
      </Link>
    </main>
  );
}
