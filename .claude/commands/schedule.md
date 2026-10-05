---
description: "Show a day's lessons: time, teacher, location, students and lesson codes."
---

# /schedule

Show the lessons for the day the operator names (today if none). Keep the lesson codes in the table: the operator uses them to mark or cancel.

```bash
node scripts/tutoring.mjs schedule --on=<YYYY-MM-DD> [--teacher="<teacher>"]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
