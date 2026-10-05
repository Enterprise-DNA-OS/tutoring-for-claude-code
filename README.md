<h1 align="center">Tutoring for Claude Code</h1>

<p align="center">
  <strong>The open-source tutoring and lesson business system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Teachworks data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=teachworks">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/teachworks?utm_source=github&utm_medium=readme&utm_campaign=teachworks">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-teachworks">Instead of Teachworks</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Tutoring for Claude Code does the job you pay Teachworks for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Teachworks dashboard cannot.

Teachworks charges a monthly base fee plus a fee for every student in every lesson, billed in US dollars after each month: Starter US$16.49 plus US$0.32 per student lesson, Growth US$47.99 plus US$0.189, Premium US$187.99 plus US$0.065 ([pricing](https://www.teachworks.com/pricing), checked 5 October 2026). A centre teaching 1,000 student lessons a month on Growth pays US$236.99 a month, about US$2,844 a year, and the bill grows with every student you add. Here there is no per-lesson fee: the database is yours.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=teachworks).

It covers what a tutoring centre, music school or language school runs every week: families and students, teachers and their pay, services and rates, the lesson schedule, attendance, prepaid packages, make-up credits, monthly billing, payments, progress updates, and the child safety checks every teacher of children needs (NSW and Victorian Working with Children Checks, Queensland blue cards, New Zealand safety checks). It is for the owner or office manager of a centre with a handful to a few dozen teachers, in Australia or New Zealand.

What it does not have: a parent portal or a teacher app. Families get invoices, statements and progress reports as documents; the office or the teacher marks attendance by asking. Enterprise DNA builds a portal into your version if you want one.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No per-lesson fee, no plan tiers, no fee per branch. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/tutoring-for-claude-code.git
cd tutoring-for-claude-code
npm install
npm run demo
```

`npm run demo` loads a fictional centre across Chatswood, Indooroopilly, Takapuna and online into `.data/demo` and prints today's schedule, what needs attention and the record checks. Then open the folder in Claude Code and type `/attention`, or ask "who is teaching children without a current check?".

```bash
npm test                                      # 120+ checks on a throwaway database
DATA_DIR=.data/demo npm run tutoring -- schedule --on=2026-10-06
DATA_DIR=.data/demo npm run tutoring -- insights 5
DATA_DIR=.data/demo npm run view              # views/week.html, money.html, safety.html
DATA_DIR=.data/demo npm run docs              # docs-out/: invoices, statements, progress reports, timesheets, safety register
```

For real records, use a fresh database and run `npm run migrate` without seeding. Add your locations, services and teachers, then import your Teachworks history.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/schedule` | Show a day's lessons: time, teacher, location, students and lesson codes. |
| `/lessons` | List lessons across a date range, with each student and how they were marked. |
| `/mark` | Mark attendance for a lesson: present, late, absent with notice (make-up issued) or absent without notice (charged). |
| `/unmarked` | Past lessons with no attendance marked. Billing, packages, make-ups and teacher pay all wait on these. |
| `/book` | Book a student into a new lesson, once or weekly for a number of weeks. Refuses a time the teacher already has. |
| `/join` | Add a student to an existing group lesson, if there is a place. |
| `/book-makeup` | Use a student's make-up credit to book them into another lesson. |
| `/cancel` | Cancel a lesson, with who cancelled it. Nobody in it is charged. |
| `/student` | One student's full picture: recent lessons and attendance, packages, make-up credits and notes. |
| `/family` | One family's account: students, invoices, what is unbilled, packages and notes. |
| `/teacher` | One teacher: safety checks, this week's lessons and any findings against them. |
| `/families` | List families with contact details, how many students and what they owe. |
| `/students` | List students with family, year level, last lesson attended and next lesson booked. |
| `/teachers` | List teachers with pay rate and the child safety checks they hold. |
| `/checks` | Every child safety check on file: Working with Children Checks, blue cards, VIT registrations and NZ safety checks, with their state. |
| `/attention` | Everything that has gone quiet or overdue: safety check gaps, unmarked lessons, overdue invoices, packages running out, make-ups expiring, students drifting, double bookings. |
| `/at-risk` | Students drifting away: nothing booked, repeated absences, or fewer lessons than three weeks ago. |
| `/teacher-load` | Each teacher's lessons, hours and student places for the next seven days. |
| `/unbilled` | Lessons taught and charged that are on no invoice and no package. |
| `/bill` | Invoice one family for every unbilled lesson up to a date. |
| `/bill-run` | The monthly or term billing run: one invoice per family for every unbilled lesson. |
| `/invoices` | Open invoices with amount, paid, balance and days overdue. |
| `/overdue` | Families with an overdue balance, biggest first. |
| `/pay` | Record a payment against an invoice, or against the oldest open invoice for a family. |
| `/packages` | Prepaid packages: minutes bought, used, left and already booked. |
| `/sell-package` | Sell a block of prepaid hours to a family and raise its invoice. |
| `/makeups` | Make-up credits: available, booked, and how many days each has left. |
| `/payroll` | Teacher pay for a period: lessons taught, hours, rate and pay. A group lesson counts once. |
| `/compliance` | Check the records against the child safety and centre rules in docs/compliance.md and report each gap with its source. |
| `/insights` | Answer one or all of the ten questions across the records. |
| `/add` | Add a record: location, service, teacher, safety check, family, student, lesson, package, make-up, invoice, payment or note. |
| `/update` | Change fields on an existing record. |
| `/log` | Record a note against a family or a student: a call, an email, a progress note or a complaint. |
| `/weekly-review` | Write the Monday review from the week's lessons, what needs attention and the record checks. |
| `/draft-reminder` | Draft a payment reminder to a family for their open invoices. |
| `/draft-progress` | Draft a progress update to a family: attendance, the goal, the teacher's notes and the next lesson. |
| `/import` | Bring records across from Teachworks: families, students, teachers and lesson history. |
| `/export` | Export the whole database to a JSON backup. |
| `/documents` | Render invoices, family statements, term progress reports, teacher timesheets and the safety check register as branded HTML. |
| `/view` | Render the read-only dashboards: the week, money in, and child safety checks. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |

The full CLI reference is [docs/cli.md](docs/cli.md). Every command takes `--json`. Names match without case, partial ids work, and an ambiguous name lists the candidates and exits 1. Drafts go to `drafts/` and are never sent.

## Ten questions to ask across your own records

These run today with `npm run tutoring -- insights`:

1. Which students came to fewer lessons in the last three weeks than the three before?
2. Which teachers lose the most lessons to no-shows?
3. What does each teacher bring in per teaching hour, after their pay?
4. Which families owe money and still have lessons booked this week?
5. Which prepaid packages run out before the lessons already booked?
6. Which make-up credits expire in the next 14 days without being used?
7. Which services make the most per teaching hour?
8. Which group classes are running below half full?
9. Which students came in the last month but have nothing booked in the next two weeks?
10. Which families spend the most a month, across all their children?

## Record checks

`/compliance` checks the records against these rules. Each rule, its source and its limits are in [docs/compliance.md](docs/compliance.md).

| Rule | What it flags |
|---|---|
| `SAFETY-NO-CHECK` | A teacher with a child in a lesson and no current check for that state: a NSW or Victorian Working with Children Check, a Queensland blue card, a New Zealand safety check |
| `AU-NSW-WWCC-VERIFY` | A NSW Working with Children Check the employer has not verified |
| `NZ-SAFETY-RECHECK` | A New Zealand safety check more than three years old |
| `SAFETY-EXPIRING` | A check that expires in the next 60 days |
| `POLICY-UNMARKED` | A past lesson with attendance not marked |
| `POLICY-UNBILLED` | A charged lesson more than 31 days old on no invoice or package |
| `POLICY-PACKAGE-OVERDRAWN` | More minutes taught than a package paid for |
| `POLICY-DOUBLE-BOOKED` | A teacher in two lessons at once |
| `POLICY-INVOICE-OVERDUE` | An invoice past its due date |

## Documents and views

`npm run docs` renders, in your brand from `brand.json`: tax invoices, family statements, term progress reports, teacher timesheets and a child safety check register for each location. `npm run view` renders three read-only dashboards: the week, money in, and child safety checks. Print them or open them in a browser.

## Your first hour: ten things to ask for

1. "Add our two locations: Chatswood in NSW and an online class taught from Sydney."
2. "Add our services and rates: Primary Maths 1:1 at $70 an hour, English Writing Group at $45 a student, up to four."
3. "Add our teachers with their pay rates and their Working with Children Check numbers."
4. "Import our Teachworks families, students, teachers and this term's lesson history." (dry run first)
5. "Who is teaching children without a current check?"
6. "Show me tomorrow's schedule." then "Mark Ben's 4pm as present, Ruby was late."
7. "Run the monthly billing as a dry run, then for real."
8. "Which families owe us money? Draft reminders for the overdue ones."
9. "Put our logo, ABN and colours on the invoices."
10. "Late cancellations within 24 hours are charged at half price." (that is `/customise`)

## Instead of Teachworks

Teachworks lets you download your families, students, employees and lesson history to Excel ([records](https://teachworks.com/features/records)). Save each as CSV and import them in order:

```bash
npm run tutoring -- import teachworks --kind=families --file=customers.csv --dry-run
npm run tutoring -- import teachworks --kind=families --file=customers.csv
npm run tutoring -- import teachworks --kind=students --file=students.csv
npm run tutoring -- import teachworks --kind=teachers --file=employees.csv
npm run tutoring -- import teachworks --kind=lessons  --file=lesson-history-by-student.csv
```

Each import upserts on the Teachworks ID (or the name), so you can run it again. Lesson history maps Teachworks attendance (Attended, No Show, Cancelled and the rest) onto the four marks here, and past lessons count as already billed in Teachworks so nobody is invoiced twice. Invoices, payments, notes and portal logins do not come across in this version, and Teachworks has nowhere for safety checks, so you add those. Read [docs/replace-teachworks.md](docs/replace-teachworks.md) for the columns and what maps where. Fictional examples are in `examples/teachworks/`.

## Architecture

```
tutoring-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data: a fictional centre with overdue and missing records
  views.json                read-only dashboards (npm run view)
  documents.json            invoices, statements, progress reports, timesheets, safety register (npm run docs)
  examples/teachworks/      fictional Teachworks downloads for the import
  docs/                     the thesis, the record checks and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Tutoring for Claude Code for your business, migrates your Teachworks data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=teachworks)
- Read more: [enterprisedna.co/omni/instead-of/teachworks](https://enterprisedna.co/omni/instead-of/teachworks?utm_source=github&utm_medium=readme&utm_campaign=teachworks)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
