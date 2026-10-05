import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Columns3,
  Download,
  FileText,
  Flame,
  ListTodo,
  Timer,
  WifiOff,
  Zap,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { AppPreview } from "@/components/landing/AppPreview";

export const metadata: Metadata = {
  title: "Notesflow — a calmer way to get things done",
  description:
    "Tasks and Markdown notes in one place. Organised into lists, quick to capture, private by default, and it works offline. Sign in only if you want to sync.",
  openGraph: {
    title: "Notesflow — a calmer way to get things done",
    description: "Tasks and notes in one place. Works offline. Syncs when you want it to.",
    type: "website",
  },
};

const FEATURES = [
  {
    icon: ListTodo,
    title: "Lists for tasks and notes",
    body: "Keep a task and the notes behind it side by side. Smart views like Today, Tomorrow and Next 7 Days build themselves from your due dates.",
  },
  {
    icon: Zap,
    title: "Capture in a sentence",
    body: "Type “Pay rent tomorrow !high #bills” and the date, priority and tag are filled in for you. Press ⌘K to jump anywhere.",
  },
  {
    icon: FileText,
    title: "Notes that think with you",
    body: "Write in Markdown with a live preview, clickable checklists and #tags. Your formatting toolbar and shortcuts are always there.",
  },
  {
    icon: WifiOff,
    title: "Offline, and installable",
    body: "Everything works without a connection. Add Notesflow to your home screen or desktop and it opens like any other app.",
  },
  {
    icon: Check,
    title: "Sync when you want it",
    body: "Start with no account at all. Sign in with email or Google and your lists follow you across every device.",
  },
  {
    icon: Download,
    title: "Yours to take with you",
    body: "Export a full backup, a spreadsheet, Markdown or calendar events at any time, and bring tasks in from other apps. Your data is never locked in.",
  },
];

const STEPS = [
  {
    title: "Capture",
    body: "Drop a task or a note into your inbox the moment it comes to mind.",
  },
  {
    title: "Organise",
    body: "Give it a date, a priority and a list. Tags and smart views do the sorting.",
  },
  {
    title: "Do",
    body: "Open Today, work through it, and let the rest wait until tomorrow.",
  },
];

const ALSO_INSIDE = [
  { icon: CalendarDays, label: "Calendar views" },
  { icon: Columns3, label: "Board view" },
  { icon: Bell, label: "Reminders" },
  { icon: Timer, label: "Focus timer" },
  { icon: Flame, label: "Habit tracker" },
];

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-stone-50/85 backdrop-blur dark:border-stone-800/70 dark:bg-stone-950/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2" aria-label="Notesflow home">
            <LogoMark size={32} />
            <span className="heading-display text-xl font-semibold">Notesflow</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 text-sm">
            <a href="#features" className="btn btn-ghost hidden sm:inline-flex">
              Features
            </a>
            <a href="#how" className="btn btn-ghost hidden sm:inline-flex">
              How it works
            </a>
            <Link href="/app?signin=1" className="btn btn-ghost">
              Sign in
            </Link>
            <Link href="/app" className="btn btn-primary">
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-10 pt-14 text-center sm:pt-20">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-3 py-1 text-xs font-medium text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
            <span className="size-1.5 rounded-full bg-accent-500" /> To-dos and notes, together
          </p>
          <h1 className="heading-display mx-auto mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.1] sm:text-6xl">
            A calmer way to get things done.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-stone-600 dark:text-stone-300">
            Notesflow keeps your tasks and notes in one quiet place. Capture fast, organise into
            lists, and focus on today. It is private by default, works offline, and syncs only when
            you sign in.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/app" className="btn btn-primary px-5 py-2.5 text-base">
              Open the app <ArrowRight size={18} aria-hidden />
            </Link>
            <a href="#features" className="btn btn-ghost px-5 py-2.5 text-base">
              See what is inside
            </a>
          </div>
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            No account needed. Your data stays on your device until you choose to sync.
          </p>

          <div className="relative mx-auto mt-12 max-w-5xl">
            <div
              aria-hidden
              className="absolute -inset-x-6 -inset-y-4 -z-10 rounded-[2rem] bg-gradient-to-b from-accent-100/70 to-transparent dark:from-accent-950/40"
            />
            <AppPreview />
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-display text-3xl font-semibold sm:text-4xl">
              Everything you need, nothing you do not
            </h2>
            <p className="mt-3 text-stone-600 dark:text-stone-300">
              A focused set of tools that stay out of your way.
            </p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="rounded-2xl border border-stone-200 bg-white/70 p-5 shadow-soft dark:border-stone-800 dark:bg-stone-900"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-950 dark:text-accent-300">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="heading-display mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="how"
          className="scroll-mt-16 border-y border-stone-200 bg-stone-100/70 py-16 dark:border-stone-800 dark:bg-stone-900/50"
        >
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="heading-display text-center text-3xl font-semibold sm:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="text-center sm:text-left">
                  <span className="heading-display text-5xl font-semibold text-accent-300 dark:text-accent-700">
                    {index + 1}
                  </span>
                  <h3 className="heading-display mt-1 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-stone-600 dark:text-stone-300">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 text-center">
          <h2 className="heading-display text-3xl font-semibold sm:text-4xl">Growing steadily</h2>
          <p className="mx-auto mt-3 max-w-xl text-stone-600 dark:text-stone-300">
            Notesflow is improved a little every day. Already inside:
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {ALSO_INSIDE.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-4 py-2 text-sm text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200"
              >
                <Icon size={16} className="text-accent-600 dark:text-accent-400" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-20">
          <div className="rounded-3xl bg-accent-600 px-6 py-12 text-center text-white shadow-lift dark:bg-accent-700">
            <h2 className="heading-display text-3xl font-semibold sm:text-4xl">
              Start with a clean inbox.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-accent-50">
              It takes a few seconds, and you do not need an account.
            </p>
            <Link
              href="/app"
              className="btn mt-6 bg-white px-6 py-2.5 text-base text-accent-800 hover:bg-accent-50"
            >
              Open Notesflow <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-8 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5">
          <span>© {new Date().getFullYear()} Notesflow</span>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/app" className="hover:text-stone-800 dark:hover:text-stone-200">
              Open app
            </Link>
            <a
              href="https://github.com/Gowreesh-VT/notesflow"
              className="hover:text-stone-800 dark:hover:text-stone-200"
              rel="noopener noreferrer"
            >
              Source on GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
