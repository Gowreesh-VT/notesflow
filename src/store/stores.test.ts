import { beforeEach, describe, expect, it } from "vitest";
import { useNotes } from "./notes";
import { useTasks } from "./tasks";

beforeEach(() => {
  useNotes.setState({ notes: [] });
  useTasks.setState({ tasks: [] });
});

describe("notes store", () => {
  it("creates, edits and moves notes through trash", () => {
    const { createNote, updateNote, trashNote, restoreNote, deleteForever, emptyTrash } =
      useNotes.getState();
    const id = createNote({ title: "A" });
    updateNote(id, { body: "hello" });
    expect(useNotes.getState().notes[0]).toMatchObject({ title: "A", body: "hello" });

    trashNote(id);
    expect(useNotes.getState().notes[0].deletedAt).not.toBeNull();
    restoreNote(id);
    expect(useNotes.getState().notes[0].deletedAt).toBeNull();

    trashNote(id);
    emptyTrash();
    expect(useNotes.getState().notes).toHaveLength(0);

    const other = createNote();
    deleteForever(other);
    expect(useNotes.getState().notes).toHaveLength(0);
  });

  it("keeps wiki links working when a note is renamed", () => {
    const { createNote, updateNote } = useNotes.getState();
    const target = createNote({ title: "Plan" });
    const linker = createNote({ title: "Index", body: "see [[Plan]]" });
    updateNote(target, { title: "Roadmap" });
    expect(useNotes.getState().notes.find((n) => n.id === linker)?.body).toBe("see [[Roadmap]]");

    createNote({ title: "Roadmap" });
    updateNote(target, { title: "Other" });
    expect(useNotes.getState().notes.find((n) => n.id === linker)?.body).toBe("see [[Roadmap]]");
  });

  it("unpins when archiving and duplicates notes", () => {
    const { createNote, togglePin, setArchived, duplicateNote } = useNotes.getState();
    const id = createNote({ title: "Keep", body: "x" });
    togglePin(id);
    setArchived(id, true);
    expect(useNotes.getState().notes[0]).toMatchObject({ archived: true, pinned: false });

    const copyId = duplicateNote(id);
    const copy = useNotes.getState().notes.find((n) => n.id === copyId);
    expect(copy).toMatchObject({ title: "Keep (copy)", body: "x", archived: false });
    expect(duplicateNote("missing")).toBeNull();
  });

  it("merges only unseen notes", () => {
    const { createNote, mergeNotes } = useNotes.getState();
    const id = createNote();
    const existing = useNotes.getState().notes[0];
    const added = mergeNotes([existing, { ...existing, id: "new" }]);
    expect(added).toBe(1);
    expect(useNotes.getState().notes.map((n) => n.id)).toContain("new");
    expect(id).toBeTruthy();
  });
});

describe("tasks store", () => {
  it("adds, completes and deletes tasks", () => {
    const { addTask, toggleTask, deleteTask, clearCompleted } = useTasks.getState();
    const a = addTask({ title: "  Write tests  ", priority: "high" });
    const b = addTask({ title: "Ship" });
    expect(useTasks.getState().tasks[0]).toMatchObject({ title: "Write tests", priority: "high" });

    toggleTask(a);
    expect(useTasks.getState().tasks[0].completedAt).not.toBeNull();
    clearCompleted();
    expect(useTasks.getState().tasks.map((t) => t.id)).toEqual([b]);
    deleteTask(b);
    expect(useTasks.getState().tasks).toHaveLength(0);
  });

  it("manages subtasks and ignores blank ones", () => {
    const { addTask, addSubtask, toggleSubtask, deleteSubtask } = useTasks.getState();
    const id = addTask({ title: "Parent" });
    addSubtask(id, "  ");
    addSubtask(id, "child");
    const sub = useTasks.getState().tasks[0].subtasks;
    expect(sub).toHaveLength(1);

    toggleSubtask(id, sub[0].id);
    expect(useTasks.getState().tasks[0].subtasks[0].done).toBe(true);
    deleteSubtask(id, sub[0].id);
    expect(useTasks.getState().tasks[0].subtasks).toHaveLength(0);
  });
});
