---
description: "Use a student's make-up credit to book them into another lesson."
---

# /book-makeup

Book the make-up. The lesson is not charged when it is marked.

```bash
node scripts/tutoring.mjs book-makeup "<student>" --lesson=<lesson code>
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
