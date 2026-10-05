---
description: "Check the records against the child safety and centre rules in docs/compliance.md and report each gap with its source."
---

# /compliance

```bash
node scripts/tutoring.mjs compliance
```

1. Report as a table: rule, subject, finding, since. Child safety findings first (`SAFETY-`, `AU-`, `NZ-`), then centre policy (`POLICY-`).
2. For a teacher teaching children without a current check, say plainly which lessons are affected and that the roster needs a change or a check before the next one. Offer to show their next lessons with `/teacher`.
3. For anything else, draft the fix the operator can approve: the record to update, the reminder to draft (to `drafts/`, never sent), or the lesson to mark.
4. Every rule, its source and its limits are in `docs/compliance.md`. If a rule there looks out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the `v_compliance` view in a new migration together.

Nothing here is legal advice. The checks read the records you keep. A check that is not recorded cannot be checked.
