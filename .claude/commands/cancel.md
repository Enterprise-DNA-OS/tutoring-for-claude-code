---
description: "Cancel a lesson, with who cancelled it. Nobody in it is charged."
---

# /cancel

Confirm the lesson and the reason, then cancel. Offer to book a replacement.

```bash
node scripts/tutoring.mjs cancel <lesson code> --by=teacher|centre|weather [--note="..."]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
