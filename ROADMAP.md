# Notesflow roadmap

This file is the owner's steering wheel for the daily autonomous run (see CLAUDE.md). Edit it freely;
the daily run may only tick items off (`- [ ]` → `- [x]`), never reword, add or remove them.

Notesflow is becoming a TickTick-style to-do list and notes app. Lists hold tasks and notes; tasks come first.

How the daily run uses it:

- It first fixes any real bug or accessibility blocker it finds.
- Otherwise it takes the **first unchecked item under "Next up"**, top to bottom.
- Items marked `[BIG]` are major changes: they are delivered as reviewed pull requests, in slices if needed.
- Items larger than one run are done in slices; the item is only ticked when fully complete.
- Nothing under "Ideas" is started until it is moved to "Next up". Nothing under "Not wanted" is ever built.
- When "Next up" is empty it falls back to the general priority order in CLAUDE.md.

Keep items small and concrete: one sentence, user-visible outcome, no implementation details.

## Next up

- [ ] Smarter quick add: times ("5pm"), weekdays ("mon", "next friday"), `@list` to pick a list, `#tag` highlighted as you type
- [ ] Due time on tasks (not just a date), shown in lists and sorted correctly
- [ ] Saved filters: combine list, tag, priority, due range and status; pinned in the sidebar under "Filters"
- [ ] Recurring tasks (daily, weekly, monthly, custom) that reappear when completed
- [ ] Reminders: browser notifications at the due time while the app is open, with snooze
- [ ] [BIG] Calendar view with month, week and agenda layouts; drag a task to another day to reschedule
- [ ] [BIG] Board (Kanban) view for a list, with sections as columns and drag-and-drop between them
- [ ] Eisenhower matrix view: tasks placed by priority and due date
- [ ] [BIG] Pomodoro focus timer attached to a task, with a daily focus-time summary
- [ ] [BIG] Habit tracker with daily check-ins, streaks and a monthly view
- [ ] Drag-and-drop ordering of tasks within a list and of lists in the sidebar
- [ ] Highlight search matches in lists and in the Markdown preview
- [ ] Rename or merge a tag across all items from the sidebar

## Ideas (not started — move up to "Next up" to approve)

- Countdown dates for important events
- Timeline view
- Sticky notes
- Task templates and note templates
- Accounts and cross-device sync with a database (needs provider decisions, pull request only)
- Sharing and assigning tasks (needs accounts)
- Print-friendly export

## Not wanted

- AI features
- Heavy dependencies for small features
- Wiki links and backlinks between notes
- Copying another app's branding, icons or text
