---
description: "Draft a progress update to a family: attendance, the goal, the teacher's notes and the next lesson."
---

# /draft-progress

Draft it, then improve the wording from the student's notes. A person sends it.

```bash
node scripts/tutoring.mjs draft-progress "<student>"
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
