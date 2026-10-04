# Notesflow roadmap

This file is the owner's steering wheel for the daily autonomous run (see CLAUDE.md). Edit it freely;
the daily run may only tick items off (`- [ ]` → `- [x]`), never reword, add or remove them.

Notesflow is a TickTick-style to-do list and notes app: lists hold tasks and notes, tasks come first. It works
offline as an installable PWA, and signed-in users sync across devices (Auth.js + Postgres). Accounts, sync and the
PWA are done; the goal now is to finish the feature set in about 60 days, roughly one item a day.

How the daily run uses it:

- It first fixes any real bug or accessibility blocker it finds.
- Otherwise it takes the **first unchecked item under "Next up"**, top to bottom.
- Items marked `[BIG]` are major changes: they are delivered as reviewed pull requests, in slices if needed.
- Items larger than one run are done in slices; the item is only ticked when fully complete.
- Every new field must sync (see "Sync rules for every new field" in CLAUDE.md) and have tests.
- Nothing under "Ideas" is started until it is moved to "Next up". Nothing under "Not wanted" is ever built.
- When "Next up" is empty it falls back to the general priority order in CLAUDE.md.

Keep items small and concrete: one sentence, user-visible outcome, no implementation details.

## Next up

### Phase 1 — Shape the data (days 1–10)

- [x] [BIG] Sections inside a list: create, rename, delete and reorder sections, and move tasks between them
- [x] Collapse and expand sections, remembered per list and synced
- [x] [BIG] Nested subtasks: subtasks can have subtasks (up to 5 levels), with progress rolled up to the parent
- [x] Convert a subtask into a task and a task into a subtask
- [x] Due time on tasks (date plus optional time, or all-day), shown in lists and used for sorting
- [x] Estimated time per task (for example 25m or 1h30), shown in the list and the detail panel
- [ ] [BIG] Time tracking per task: start and stop a timer, add manual entries, and see the total
- [ ] [BIG] Outcomes: when completing a task, optionally tag how it went (Went well, Learned something, Needs follow-up, Didn't go as planned; editable) with a one-line note
- [ ] Energy and effort tags on tasks (quick win, deep work, low energy) with a filter
- [ ] [BIG] Task templates: save a task with its subtasks as a template and create new tasks from it

### Phase 2 — Reminders and recurrence (days 11–19)

- [ ] Multiple reminders per task: at the due time, minutes or hours before, or a day before
- [ ] Browser notifications for reminders while the app is open, with a clear permission flow
- [ ] Constant reminder: a persistent notification that repeats until the task is completed or snoozed
- [ ] Snooze for reminders (10 minutes, 1 hour, tomorrow morning)
- [ ] [BIG] Recurring tasks: daily, weekly, monthly, yearly, custom intervals, and "repeat after completion"
- [ ] Smarter quick add: times ("5pm"), weekdays ("mon", "next friday"), `@list`, `#tag`, `!priority` and `~estimate`
- [ ] Start date on tasks, so a task can span a date range
- [ ] Offline and sync status banner: clear states for offline, syncing, failed, and conflicts resolved
- [ ] Notification and reminder settings (quiet hours, default reminder time)

### Phase 3 — Organise (days 20–28)

- [ ] Move or copy a task to another list, from the detail panel and the list context
- [ ] [BIG] Multi-select with batch edit: set date, priority, list, tags or energy, complete, and delete many tasks at once
- [ ] [BIG] Saved filters: combine list, tag, priority, due range, energy and status; pinned in the sidebar under "Filters"
- [ ] Rename or merge a tag across all items from the sidebar
- [ ] Archive lists: hide finished lists in an "Archived lists" section, restorable
- [ ] Drag-and-drop ordering of tasks within a list or section, and of lists in the sidebar
- [ ] Group a list by due date, priority, section or tag
- [ ] Note-to-task: turn the unchecked checklist lines of a note into real tasks
- [ ] Daily notes: one note per day, created from the command palette

### Phase 4 — Views (days 29–40)

- [ ] [BIG] Calendar view, month layout, showing tasks on their due dates
- [ ] Calendar week layout with due times
- [ ] Calendar day and agenda layouts
- [ ] Drag a task to another day in the calendar to reschedule it
- [ ] [BIG] Board (Kanban) view for a list, with sections as columns
- [ ] Drag cards between board columns
- [ ] Eisenhower matrix view: tasks placed by priority and due date
- [ ] [BIG] Timeline view of tasks with a start and due date
- [ ] [BIG] Plan view: a day timeline where tasks can be dragged into time slots
- [ ] Split view: pin one list beside another and drag tasks between them

### Phase 5 — Focus, habits and planning (days 41–52)

- [ ] [BIG] Pomodoro focus timer attached to a task, with configurable work and break lengths
- [ ] Focus statistics: focus time per day, week and list
- [ ] Ambient focus sounds generated in the browser (white, pink and brown noise), with volume
- [ ] [BIG] Habit tracker: create habits and check them in each day
- [ ] Habit goals (for example 3 times a week), streaks, and a monthly heat-map
- [ ] Countdowns for important dates, shown in the sidebar
- [ ] [BIG] Today planner: a "Plan my day" flow to pick tasks, fit them to your available time, order them, and time-block them
- [ ] [BIG] Weekly review: a guided page showing what you finished, what slipped, outcomes, and one-click rescheduling of leftovers
- [ ] Progress view: completion trends, streaks and a calm "done for today" state
- [ ] Smart scheduling suggestions based on local rules, for example an overloaded day, a task longer than the time left, or overdue tasks to move
- [ ] Outcomes insights: filter by outcome and see how outcomes break down in the weekly review
- [ ] "What can I do in 15 minutes?" view using estimates and energy tags

### Phase 6 — Personalise, import and polish (days 53–60)

- [ ] [BIG] Settings page for all preferences, synced to the account
- [ ] Themes: accent colour presets and a custom accent colour
- [ ] Density (compact or comfortable) and font choices
- [ ] Week start day, date format and time format settings
- [ ] Export to CSV, Markdown and iCal
- [ ] Import from CSV and JSON (TickTick and Todoist exports)
- [ ] [BIG] Account settings: change password, delete the account and all its data
- [ ] [BIG] Password reset by email (needs an email provider and keys from the owner)
- [ ] Keyboard shortcuts for all common actions, and a vim-style navigation mode
- [ ] Accessibility audit pass: focus order, labels, contrast, reduced motion
- [ ] Performance pass: virtualise long lists and trim the initial bundle

## Ideas (not started — move up to "Next up" to approve)

- Push reminders when the app is closed (needs a scheduler; Vercel Hobby cron runs only daily)
- Email verification for new accounts
- Collaboration: shared lists, assigning tasks, comments, activity log (needs accounts model changes)
- Calendar subscriptions and Google Calendar sync
- Voice capture, email-to-task, share target for saving links
- Home-screen widgets
- Local encryption of notes with a passphrase, and an app lock
- Sticky notes
- Print-friendly export

## Not wanted

- AI features
- Heavy dependencies for small features
- Wiki links and backlinks between notes
- Custom smart lists with their own icons
- Task attachments
- Copying another app's branding, icons or text
