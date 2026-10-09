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
- [x] [BIG] Time tracking per task: start and stop a timer, add manual entries, and see the total
- [x] [BIG] Outcomes: when completing a task, optionally tag how it went (Went well, Learned something, Needs follow-up, Didn't go as planned; editable) with a one-line note
- [x] Energy and effort tags on tasks (quick win, deep work, low energy) with a filter
- [x] [BIG] Task templates: save a task with its subtasks as a template and create new tasks from it

### Phase 2 — Reminders and recurrence (days 11–19)

- [x] Multiple reminders per task: at the due time, minutes or hours before, or a day before
- [x] Browser notifications for reminders while the app is open, with a clear permission flow
- [x] Constant reminder: a persistent notification that repeats until the task is completed or snoozed
- [x] Snooze for reminders (10 minutes, 1 hour, tomorrow morning)
- [x] [BIG] Recurring tasks: daily, weekly, monthly, yearly, custom intervals, and "repeat after completion"
- [x] Smarter quick add: times ("5pm"), weekdays ("mon", "next friday"), `@list`, `#tag`, `!priority` and `~estimate`
- [x] Start date on tasks, so a task can span a date range
- [x] Offline and sync status banner: clear states for offline, syncing, failed, and conflicts resolved
- [x] Notification and reminder settings (quiet hours, default reminder time)
- [x] Push reminders when the app is closed (Web Push with an external scheduler)

### Phase 3 — Organise (days 20–28)

- [x] Move or copy a task to another list, from the detail panel and the list context
- [x] [BIG] Multi-select with batch edit: set date, priority, list, tags or energy, complete, and delete many tasks at once
- [x] [BIG] Saved filters: combine list, tag, priority, due range, energy and status; pinned in the sidebar under "Filters"
- [x] Rename or merge a tag across all items from the sidebar
- [x] Archive lists: hide finished lists in an "Archived lists" section, restorable
- [x] Drag-and-drop ordering of tasks within a list or section, and of lists in the sidebar
- [x] Group a list by due date, priority, section or tag
- [x] Note-to-task: turn the unchecked checklist lines of a note into real tasks
- [x] Daily notes: one note per day, created from the command palette

### Phase 4 — Views (days 29–40)

- [x] [BIG] Calendar view, month layout, showing tasks on their due dates
- [x] Calendar week layout with due times
- [x] Calendar day and agenda layouts
- [x] Drag a task to another day in the calendar to reschedule it
- [x] [BIG] Board (Kanban) view for a list, with sections as columns
- [x] Drag cards between board columns
- [x] Eisenhower matrix view: tasks placed by priority and due date
- [x] [BIG] Timeline view of tasks with a start and due date
- [x] [BIG] Plan view: a day timeline where tasks can be dragged into time slots
- [x] Split view: pin one list beside another and drag tasks between them

### Phase 5 — Focus, habits and planning (days 41–52)

- [x] [BIG] Pomodoro focus timer attached to a task, with configurable work and break lengths
- [x] Focus statistics: focus time per day, week and list
- [x] Ambient focus sounds generated in the browser (white, pink and brown noise), with volume
- [x] [BIG] Habit tracker: create habits and check them in each day
- [x] Habit goals (for example 3 times a week), streaks, and a monthly heat-map
- [x] Countdowns for important dates, shown in the sidebar
- [x] [BIG] Today planner: a "Plan my day" flow to pick tasks, fit them to your available time, order them, and time-block them
- [x] [BIG] Weekly review: a guided page showing what you finished, what slipped, outcomes, and one-click rescheduling of leftovers
- [x] Progress view: completion trends, streaks and a calm "done for today" state
- [x] Smart scheduling suggestions based on local rules, for example an overloaded day, a task longer than the time left, or overdue tasks to move
- [x] Outcomes insights: filter by outcome and see how outcomes break down in the weekly review
- [x] "What can I do in 15 minutes?" view using estimates and energy tags

### Phase 6 — Personalise, import and polish (days 53–60)

- [x] [BIG] Settings page for all preferences, synced to the account
- [x] Themes: accent colour presets and a custom accent colour
- [x] Density (compact or comfortable) and font choices
- [x] Week start day, date format and time format settings
- [x] Export to CSV, Markdown and iCal
- [x] Import from CSV and JSON (TickTick and Todoist exports)
- [x] [BIG] Account settings: change password, delete the account and all its data
- [x] [BIG] Password reset by email (needs an email provider and keys from the owner)
- [x] Keyboard shortcuts for all common actions, and a vim-style navigation mode
- [x] Accessibility audit pass: focus order, labels, contrast, reduced motion
- [x] Performance pass: virtualise long lists and trim the initial bundle

### Phase 7 — Launch readiness: everyday polish

- [ ] Renaming and deleting lists, sections, folders and tags uses in-app dialogs instead of browser pop-ups
- [ ] Undo after completing, deleting, swiping or batch-editing tasks, offered in a short message at the bottom
- [ ] [BIG] One calendar sheet for picking a date, time, repeat and end date, used in task details, the add sheet and batch edit
- [ ] On phones, the add sheet and other bottom sheets stay above the keyboard, and the layout clears the notch and home bar
- [ ] Swiping a task row never triggers the browser's back gesture or pull-to-refresh
- [ ] Placeholder rows while the workspace loads, instead of a "Loading" message
- [ ] The sync bar only appears while changes are waiting, when syncing fails, or when the device is offline

### Phase 8 — Launch readiness: first run and trust

- [ ] [BIG] First run: a few example tasks that teach quick add and swipes, with advanced views hidden until turned on in Settings
- [ ] A gentle prompt to sign in and sync after a new user has added a few tasks
- [ ] When the first reminder is added, offer to turn on reminders that arrive while the app is closed, with steps for the user's phone
- [ ] Push reminders re-register this device on every start, so closed-app reminders recover on their own
- [ ] A "Send feedback" item in the menu and a short "What's new" note after an update
- [ ] A help page with short answers about sync, reminders, installing the app and privacy
- [ ] [BIG] One shared set of dialogs, menus, bottom sheets and messages, so every pop-up looks and behaves the same, including keyboard focus
- [ ] Accessibility check with VoiceOver and TalkBack on phones, fixing what it finds
- [ ] Consistent text sizes, icon sizes and 44px tap targets across every view, in light and dark mode

## Ideas (not started — move up to "Next up" to approve)

- Email verification for new accounts
- Collaboration: shared lists, assigning tasks, comments, activity log (needs accounts model changes)
- Calendar subscriptions and Google Calendar sync
- Voice capture, email-to-task, share target for saving links
- Home-screen widgets
- Local encryption of notes with a passphrase, and an app lock
- Sticky notes
- Print-friendly export
- Error tracking and privacy-friendly usage statistics (needs a provider choice from the owner)
- Privacy policy and terms pages (needs text from the owner)
- End-to-end tests and screenshot comparisons for the main flows on phone and desktop

## Not wanted

- AI features
- Heavy dependencies for small features
- Wiki links and backlinks between notes
- Custom smart lists with their own icons
- Task attachments
- Copying another app's branding, icons or text
