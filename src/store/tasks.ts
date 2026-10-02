import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Priority, Task } from "@/lib/types";
import { createId } from "@/lib/utils";

type NewTask = {
  title: string;
  priority?: Priority;
  due?: string | null;
  details?: string;
};

type TasksState = {
  tasks: Task[];
  addTask: (input: NewTask) => string;
  updateTask: (
    id: string,
    patch: Partial<Pick<Task, "title" | "details" | "priority" | "due">>,
  ) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  clearCompleted: () => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  mergeTasks: (incoming: Task[]) => number;
  replaceTasks: (tasks: Task[]) => void;
};

const mapTask = (tasks: Task[], id: string, fn: (task: Task) => Task) =>
  tasks.map((t) => (t.id === id ? fn(t) : t));

export const useTasks = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: ({ title, priority = "none", due = null, details = "" }) => {
        const task: Task = {
          id: createId(),
          title: title.trim(),
          details,
          done: false,
          priority,
          due,
          createdAt: Date.now(),
          completedAt: null,
          subtasks: [],
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return task.id;
      },

      updateTask: (id, patch) =>
        set((s) => ({ tasks: mapTask(s.tasks, id, (t) => ({ ...t, ...patch })) })),

      toggleTask: (id) =>
        set((s) => ({
          tasks: mapTask(s.tasks, id, (t) => ({
            ...t,
            done: !t.done,
            completedAt: t.done ? null : Date.now(),
          })),
        })),

      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      clearCompleted: () => set((s) => ({ tasks: s.tasks.filter((t) => !t.done) })),

      addSubtask: (taskId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((s) => ({
          tasks: mapTask(s.tasks, taskId, (t) => ({
            ...t,
            subtasks: [...t.subtasks, { id: createId(), title: trimmed, done: false }],
          })),
        }));
      },

      toggleSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: mapTask(s.tasks, taskId, (t) => ({
            ...t,
            subtasks: t.subtasks.map((st) =>
              st.id === subtaskId ? { ...st, done: !st.done } : st,
            ),
          })),
        })),

      deleteSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: mapTask(s.tasks, taskId, (t) => ({
            ...t,
            subtasks: t.subtasks.filter((st) => st.id !== subtaskId),
          })),
        })),

      mergeTasks: (incoming) => {
        const existing = new Set(get().tasks.map((t) => t.id));
        const fresh = incoming.filter((t) => !existing.has(t.id));
        if (fresh.length) set((s) => ({ tasks: [...s.tasks, ...fresh] }));
        return fresh.length;
      },

      replaceTasks: (tasks) => set({ tasks }),
    }),
    { name: "notesflow:tasks", version: 1, skipHydration: true },
  ),
);
