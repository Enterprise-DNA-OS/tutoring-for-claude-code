---
description: "Add a student to an existing group lesson, if there is a place."
---

# /join

Add the student. If the class is full, say so and offer the nearest other class.

```bash
node scripts/tutoring.mjs join <lesson code> "<student>"
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
