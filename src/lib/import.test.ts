import { describe, expect, it } from "vitest";
import { toCsv } from "./export";
import { importTasks, parseCsv, repeatFromRRule, repeatFromText } from "./import";
import { INBOX_ID, type Item, type TaskList } from "./types";

const NOW = Date.UTC(2026, 9, 5, 12);
const TODAY = "2026-10-05";
const work: TaskList = {
  id: "work",
  name: "Work",
  createdAt: 0,
  updatedAt: 0,
  folderId: null,
  sections: [],
};

describe("CSV parsing", () => {
  it("handles quotes, doubled quotes, commas and line breaks", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi""\nthere"\n\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });
});

describe("repeat rules", () => {
  it("reads RRULEs and Todoist's words", () => {
    expect(repeatFromRRule("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH")).toEqual({
      unit: "week",
      every: 2,
      weekdays: [1, 4],
    });
    expect(repeatFromRRule("FREQ=HOURLY")).toBeNull();
    expect(repeatFromText("every 3 days")).toEqual({ unit: "day", every: 3 });
    expect(repeatFromText("every monday")).toEqual({ unit: "week", every: 1, weekdays: [1] });
    expect(repeatFromText("Monthly")).toEqual({ unit: "month", every: 1 });
    expect(repeatFromText("tomorrow")).toBeNull();
  });
});

describe("TickTick backup", () => {
  const csv = [
    '"Date: 2026-10-05+0000"',
    '"Version: 7.1"',
    '"Status: ',
    "0 Normal",
    "1 Completed",
    '2 Archived"',
    '"Folder Name","List Name","Title","Kanban","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"',
    '"","Work","Write report","","writing, q4","Draft first","N","","2026-10-09","","","5","0","2026-10-01T09:00:00+0000","","1","UTC","true","false","Doing","","list","1",""',
    '"","Groceries","Shopping","","","▪Milk\n▫Eggs","Y","","","","RRULE:FREQ=WEEKLY;INTERVAL=1","1","0","2026-10-01T09:00:00+0000","","2","UTC","","false","","","list","2",""',
    '"","Work","Outline","","","","N","","","","","0","2","2026-10-01T09:00:00+0000","2026-10-02T09:00:00+0000","3","UTC","","false","","","list","3","1"',
  ].join("\n");

  it("imports lists, priorities, tags, checklists, child tasks and kanban columns", () => {
    const result = importTasks("ticktick.csv", csv, [work], TODAY, NOW);
    expect(result.source).toBe("TickTick");
    expect(result.lists.map((l) => l.name)).toEqual(["Groceries"]);
    const [report, shopping] = result.items;
    expect(result.items).toHaveLength(2);
    expect(report).toMatchObject({
      title: "Write report #writing #q4",
      body: "Draft first",
      listId: "work",
      priority: "high",
      due: "2026-10-09",
      status: "open",
      sectionId: null, // existing lists keep their own sections
      subtasks: [expect.objectContaining({ title: "Outline", done: true })],
    });
    expect(shopping).toMatchObject({
      listId: result.lists[0].id,
      priority: "low",
      repeat: { unit: "week", every: 1 },
      subtasks: [
        expect.objectContaining({ title: "Milk", done: true }),
        expect.objectContaining({ title: "Eggs", done: false }),
      ],
    });
  });
});

describe("Todoist CSV", () => {
  const csv = [
    "TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT",
    "section,Planning,,,,,,,,,,",
    "task,Plan the trip,Book flights,1,1,Me,,2026-10-12,en,UTC,45,minute",
    "task,Find hotel,,4,2,Me,,,en,UTC,,",
    "task,Water plants,,4,1,Me,,every 3 days,en,UTC,,",
    "note,Some comment,,,,,,,,,,",
  ].join("\n");

  it("imports a project named after the file, with sections, sub-tasks and repeats", () => {
    const result = importTasks("Holiday_Plans.csv", csv, [], TODAY, NOW);
    expect(result.source).toBe("Todoist");
    expect(result.lists).toHaveLength(1);
    expect(result.lists[0]).toMatchObject({
      name: "Holiday Plans",
      sections: [{ name: "Planning" }],
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: "Plan the trip",
      body: "Book flights",
      priority: "high",
      due: "2026-10-12",
      estimate: 45,
      sectionId: result.lists[0].sections[0].id,
      subtasks: [expect.objectContaining({ title: "Find hotel" })],
    });
    expect(result.items[1]).toMatchObject({
      title: "Water plants",
      repeat: { unit: "day", every: 3 },
      due: TODAY,
    });
  });
});

describe("JSON", () => {
  it("imports Todoist API tasks with projects and parents", () => {
    const json = JSON.stringify({
      projects: [{ id: "p1", name: "Work" }],
      items: [
        {
          id: "1",
          content: "Ship",
          description: "v2",
          priority: 4,
          project_id: "p1",
          due: { date: "2026-10-08" },
        },
        { id: "2", content: "Tests", priority: 1, project_id: "p1", parent_id: "1", checked: true },
      ],
    });
    const result = importTasks("todoist.json", json, [work], TODAY, NOW);
    expect(result.lists).toEqual([]);
    expect(result.items).toEqual([
      expect.objectContaining({
        title: "Ship",
        body: "v2",
        listId: "work",
        priority: "high",
        due: "2026-10-08",
        subtasks: [expect.objectContaining({ title: "Tests", done: true })],
      }),
    ]);
  });

  it("imports TickTick API tasks", () => {
    const json = JSON.stringify([
      {
        id: "a",
        title: "Read",
        content: "Chapter 3",
        priority: 3,
        status: 2,
        items: [{ title: "Pages 1-10", status: 1 }],
      },
    ]);
    const [task] = importTasks("ticktick.json", json, [], TODAY, NOW).items;
    expect(task).toMatchObject({
      title: "Read",
      body: "Chapter 3",
      listId: INBOX_ID,
      priority: "medium",
      status: "done",
      completedAt: NOW,
      subtasks: [expect.objectContaining({ title: "Pages 1-10", done: true })],
    });
  });

  it("explains files it cannot use", () => {
    expect(() => importTasks("x.json", "{oops", [], TODAY, NOW)).toThrow("not valid JSON");
    expect(() => importTasks("x.json", '{"a":1}', [], TODAY, NOW)).toThrow("No tasks");
    expect(() => importTasks("x.csv", "foo,bar\n1,2", [], TODAY, NOW)).toThrow("title column");
  });
});

describe("generic and Notesflow CSV", () => {
  it("reads any CSV with a title column", () => {
    const result = importTasks(
      "tasks.csv",
      "Name,Due,Priority,Notes,Project,Done\nPay rent,2026-11-01,High,Online,Home,no\nOld,,,,,yes",
      [],
      TODAY,
      NOW,
    );
    expect(result.source).toBe("CSV");
    expect(result.items[0]).toMatchObject({
      title: "Pay rent",
      due: "2026-11-01",
      priority: "high",
      body: "Online",
      listId: result.lists[0].id,
    });
    expect(result.items[1]).toMatchObject({ status: "done", completedAt: NOW });
  });

  it("round-trips Notesflow's own CSV export", () => {
    const original: Item = {
      id: "x",
      kind: "task",
      title: "Write #docs",
      body: "Body, with comma",
      listId: "work",
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
      pinned: false,
      status: "open",
      completedAt: null,
      priority: "medium",
      due: "2026-10-09",
      dueTime: "14:30",
      estimate: 45,
      subtasks: [{ id: "s", title: "Outline", done: true }],
      sectionId: null,
    };
    const result = importTasks("export.csv", toCsv([original], [work]), [work], TODAY, NOW);
    expect(result.source).toBe("Notesflow CSV");
    expect(result.items[0]).toMatchObject({
      title: "Write #docs",
      body: "Body, with comma",
      listId: "work",
      priority: "medium",
      due: "2026-10-09",
      dueTime: "14:30",
      estimate: 45,
      subtasks: [expect.objectContaining({ title: "Outline", done: true })],
    });
  });
});
