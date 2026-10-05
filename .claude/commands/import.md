---
description: "Bring records across from Teachworks: families, students, teachers and lesson history."
---

# /import

Read docs/replace-teachworks.md. Import in order: families, students, teachers, lessons. Run each with --dry-run first and show the counts before the real run.

```bash
node scripts/tutoring.mjs import teachworks --kind=families --file=<customers.csv> --dry-run
node scripts/tutoring.mjs import teachworks --kind=students --file=<students.csv>
node scripts/tutoring.mjs import teachworks --kind=teachers --file=<employees.csv>
node scripts/tutoring.mjs import teachworks --kind=lessons --file=<lesson-history-by-student.csv> [--currency=NZD]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
