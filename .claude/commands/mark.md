---
description: "Mark attendance for a lesson: present, late, absent with notice (make-up issued) or absent without notice (charged)."
---

# /mark

Mark the lesson the operator names. Use the lesson code from /schedule, or the teacher and date. Mark one student with --student. Say what each student was charged, whether it came from a package and whether a make-up credit was issued.

```bash
node scripts/tutoring.mjs mark <lesson code> --as=present|late|absent-notice|absent-no-notice [--student="<student>"] [--note="..."]
node scripts/tutoring.mjs mark --teacher="<teacher>" --on=<YYYY-MM-DD> [--at=HH:MM] --as=present
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
