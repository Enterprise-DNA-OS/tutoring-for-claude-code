---
description: "Book a student into a new lesson, once or weekly for a number of weeks. Refuses a time the teacher already has."
---

# /book

Confirm the student, service, teacher, location, start and number of weeks in one line, then book.

```bash
node scripts/tutoring.mjs book "<student>" --service="<service>" --teacher="<teacher>" --location="<location>" --at="YYYY-MM-DD HH:MM" [--minutes=60] [--weeks=10]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
