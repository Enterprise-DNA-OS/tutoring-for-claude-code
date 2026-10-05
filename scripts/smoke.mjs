// npm test: a temporary embedded database (or an isolated schema on TEST_DATABASE_URL),
// migrate, seed twice, then every command, import, document and view. Never touches your data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { execute, entities, human, toDate, toTime } from './tutoring.mjs';
import { parseCsv } from './lib/csv.mjs';
import { page, table } from './lib/render.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutoring-smoke-'));
const postgresUrl = process.env.TEST_DATABASE_URL || '';
let control, schema;
if (postgresUrl) {
  const { default: pg } = await import('pg');
  control = new pg.Client({ connectionString: postgresUrl }); await control.connect();
  schema = 'tutoring_test_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8);
  await control.query(`create schema ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema},public`;
}
process.env.DATABASE_URL = postgresUrl; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
const db = await getDb();
let checks = 0;
const run = (...args) => execute(db, args);
const ok = (condition, message) => { assert.ok(condition, message); console.log(`ok ${++checks}: ${message}`); };
const fail = async (args, pattern) => { await assert.rejects(() => run(...args), pattern); ok(true, `Rejects: ${args.slice(0, 3).join(' ')}`); };
const count = async (t, where = 'true') => Number((await db.query(`select count(*) as n from ${t} where ${where}`))[0].n);
const rules = async () => (await run('compliance')).map((r) => `${r.rule}|${r.subject}`);
const today = new Date().toISOString().slice(0, 10);

try {
  ok((await migrate(db)).ran.length === 1, 'Migration applies');
  ok((await migrate(db)).ran.length === 0, 'Migration is idempotent');
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8');
  await db.exec(seed); await db.exec(seed);
  ok((await run('families')).length === 12 && (await count('students')) === 13, 'Seed is idempotent');

  // Every read
  for (const c of ['help', 'families', 'students', 'teachers', 'checks', 'services', 'locations', 'lessons', 'unmarked', 'unbilled', 'invoices', 'overdue', 'packages', 'makeups', 'compliance', 'at-risk', 'teacher-load', 'schedule', 'attention', 'payroll'])
    ok(Boolean(await run(c)), `Read ${c}`);
  ok((await run('student', 'olivia')).lessons.length >= 6, 'Student history by first name');
  ok((await run('family', 'WILSON')).invoices[0].days_overdue > 0, 'Family detail, case-insensitive, shows the overdue invoice');
  ok((await run('teacher', 'daniel')).findings.some((x) => x.rule === 'SAFETY-NO-CHECK'), 'Teacher detail carries their findings');
  ok((await run('at-risk')).some((r) => r.student === 'Jae Kim' && r.next_booked === 'nothing booked'), 'At-risk finds the student who stopped booking');

  // Name matching
  ok((await run('show', 'teachers', 'EMMA')).name === 'Emma Walsh', 'Case-insensitive name match');
  await fail(['show', 'students', 'a'], /Ambiguous/);
  await fail(['show', 'families', 'nobody'], /No families match/);

  // Record checks: every rule has seeded evidence and a source
  const findings = await run('compliance');
  const all = ['SAFETY-NO-CHECK', 'AU-NSW-WWCC-VERIFY', 'NZ-SAFETY-RECHECK', 'SAFETY-EXPIRING', 'POLICY-UNMARKED', 'POLICY-UNBILLED', 'POLICY-PACKAGE-OVERDRAWN', 'POLICY-DOUBLE-BOOKED', 'POLICY-INVOICE-OVERDUE'];
  ok(all.every((r) => findings.some((x) => x.rule === r)), 'Every compliance rule has seeded evidence');
  ok(findings.every((x) => x.source), 'Every finding carries its source');
  ok(findings.find((x) => x.rule === 'SAFETY-NO-CHECK').source.includes('qld.gov.au'), 'Queensland gap cites the blue card rule');

  // Blue card boundary: valid through the lesson date passes; expired the day before is flagged.
  await db.exec('BEGIN');
  const lastDaniel = (await db.query(`select max(on_date) as d from v_roster where teacher='Daniel Okafor' and minor and lesson_status<>'cancelled' and on_date<=current_date+14`))[0].d;
  await db.query(`update safety_checks set expires_on=$1 where number='1234567/2'`, [lastDaniel]);
  ok(!(await rules()).includes('SAFETY-NO-CHECK|Daniel Okafor'), 'Blue card valid on the lesson date passes');
  await db.query(`update safety_checks set expires_on=$1::date-1 where number='1234567/2'`, [lastDaniel]);
  ok((await rules()).includes('SAFETY-NO-CHECK|Daniel Okafor'), 'Blue card that expired the day before is flagged');
  await db.exec('ROLLBACK');

  // Adults need no check; Victoria accepts VIT registration.
  await db.exec('BEGIN');
  await db.query(`delete from safety_checks where number='WWC0034567E'`);
  const liam = (await run('compliance')).find((x) => x.rule === 'SAFETY-NO-CHECK' && x.subject === 'Liam Patel');
  const kids = Number((await db.query(`select count(distinct lesson_id) as n from v_roster where teacher='Liam Patel' and minor and lesson_status<>'cancelled' and on_date between current_date-90 and current_date+14`))[0].n);
  const allLiam = Number((await db.query(`select count(distinct lesson_id) as n from v_roster where teacher='Liam Patel' and lesson_status<>'cancelled' and on_date between current_date-90 and current_date+14`))[0].n);
  ok(liam && liam.finding.startsWith(`${kids} lesson`) && kids < allLiam, 'Lessons with an adult student are not counted');
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await run('add', 'locations', '--name=Box Hill', '--jurisdiction=VIC', '--currency=AUD');
  const vic = await run('book', 'Olivia Chen', '--service=Primary Maths', '--teacher=Emma Walsh', '--location=Box Hill', `--at=${today} 07:00`);
  ok(vic.length === 1 && (await run('compliance')).some((x) => x.rule === 'SAFETY-NO-CHECK' && x.subject === 'Emma Walsh' && x.source.includes('Worker Screening')), 'Victoria lesson without a check cites the Worker Screening Act');
  await run('add', 'safety_checks', '--teacher=Emma Walsh', '--jurisdiction=VIC', '--kind=vit-registration', '--number=VIT 123456', `--issued_on=${today}`);
  ok(!(await rules()).includes('SAFETY-NO-CHECK|Emma Walsh'), 'VIT registration clears the Victorian check');
  await db.exec('ROLLBACK');
  await db.exec('BEGIN');
  await run('add', 'safety_checks', '--teacher=Aroha', '--jurisdiction=NZ', '--kind=nz-safety-check', '--number=HTG-SC-2026', `--issued_on=${today}`, `--verified_on=${today}`);
  ok(!(await rules()).includes('NZ-SAFETY-RECHECK|Aroha Ngata'), 'A fresh New Zealand safety check clears the recheck');
  await db.exec('ROLLBACK');

  // Ten questions
  const insights = await run('insights');
  ok(insights.length === 10 && insights.every((x) => x.rows.length), 'Ten questions have real answers');
  for (let i = 1; i <= 10; i++) ok((await run('insights', String(i)))[0].number === i, `Question ${i} alone`);
  await fail(['insights', '11'], /1 through 10/);

  // Attendance: mark, charge, packages, make-ups
  const unmarked = await db.query(`select distinct lesson_id from v_roster where teacher='Chloe Nguyen' and attendance is null and lesson_status<>'cancelled' and on_date<current_date`);
  ok(unmarked.length === 2, 'Two of Chloe\'s past lessons are unmarked');
  const group = (await db.query(`select lesson_id from v_roster where teacher='Chloe Nguyen' and service='English Writing Group' and attendance is null and on_date<current_date`))[0].lesson_id;
  const marked = await run('mark', group.slice(0, 8), '--as=present');
  ok(marked.length === 2 && marked.every((m) => m.charge === 45), 'Group lesson marked for both students at the hourly rate');
  ok((await run('show', 'lessons', group)).status === 'completed', 'A fully marked lesson is completed');
  const other = unmarked.find((u) => u.lesson_id !== group).lesson_id;
  const abs = await run('mark', other, '--as=absent-notice', '--student=zara');
  ok(abs[0].makeup_issued && abs[0].charge === '', 'Absence with notice issues a make-up and no charge');
  const remark = await run('mark', other, '--as=present');
  ok(!remark[0].makeup_issued && remark[0].charge === 70, 'Re-marking present withdraws the unused make-up');
  ok(!(await rules()).includes('POLICY-UNMARKED|Chloe Nguyen'), 'Marking clears the unmarked finding');
  await fail(['mark', other, '--as=maybe'], /must be one of/);
  const future = (await db.query(`select id from lessons where starts_at>current_date+1 and status='scheduled' limit 1`))[0].id;
  await fail(['mark', future, '--as=present'], /not happened yet/);
  const maya = (await db.query(`select lesson_id from v_roster where student='Maya Kowalski' and attendance='present' order by on_date desc limit 1`))[0].lesson_id;
  ok((await run('mark', maya, '--as=present'))[0].from_package, 'A package student is drawn from their package');
  const viaTeacher = await db.query(`select to_char(starts_at,'YYYY-MM-DD') as d from lessons where teacher_id=(select id from teachers where name='Ben Carter') and starts_at<current_date order by starts_at desc limit 1`);
  await fail(['mark', '--teacher=Ben', `--on=${viaTeacher[0].d}`, '--as=present'], /2 lessons that day|already on an invoice/);

  // Booking, joining, make-up booking, cancelling
  const booked = await run('book', 'Mia Nguyen', '--service=English Writing', '--teacher=Chloe', '--location=Chatswood', `--at=${new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10)} 10:00`, '--weeks=3');
  ok(booked.length === 3, 'Weekly booking for three weeks');
  await fail(['book', 'Mia Nguyen', '--service=English Writing', '--teacher=Chloe', '--location=Chatswood', `--at=${booked[0].starts_at}`], /already has a lesson/);
  const nextGroup = (await db.query(`select l.id from lessons l join services s on s.id=l.service_id where s.name='English Writing Group' and l.status='scheduled' and l.starts_at>=current_date and l.teacher_id=(select id from teachers where name='Chloe Nguyen') order by l.starts_at limit 1`))[0].id;
  const olivia = (await db.query(`select * from v_makeups where student='Olivia Chen' and state='available'`))[0];
  const mk = await run('book-makeup', 'Olivia Chen', `--lesson=${nextGroup}`);
  ok(mk.makeup_id === olivia.id && (await db.query('select state from v_makeups where id=$1', [olivia.id]))[0].state === 'booked', 'Make-up credit booked into a group lesson');
  await fail(['book-makeup', 'Olivia Chen', `--lesson=${nextGroup}`], /no make-up credit|duplicate|unique/);
  const oneToOne = (await db.query(`select left(l.id::text,8) as id from lessons l join services s on s.id=l.service_id where s.max_students=1 and l.status='scheduled' and l.starts_at>=current_date limit 1`))[0].id;
  await fail(['join', oneToOne, 'Mia Nguyen'], /is full/);
  ok((await run('cancel', booked[2].lesson, '--by=centre')).status === 'cancelled', 'Cancel a lesson');

  // Billing and payments
  const haddad = (await run('unbilled')).filter((r) => r.family === 'Haddad family').length;
  const dry = await run('bill-run', '--dry-run');
  ok(dry.length > 0 && (await run('unbilled')).filter((r) => r.family === 'Haddad family').length === haddad, 'Billing run dry run rolls back');
  const inv = await run('bill', 'Haddad');
  ok(inv[0].lines === haddad && inv[0].invoice.startsWith('INV-'), 'Bill a family for every unbilled lesson');
  ok(!(await rules()).includes('POLICY-UNBILLED|Haddad family'), 'Billing clears the unbilled finding');
  await fail(['bill', 'Haddad'], /Nothing unbilled/);
  const run2 = await run('bill-run');
  ok(run2.length > 0 && (await run('unbilled')).length === 0, 'Billing run invoices every family');
  ok(run2.some((r) => r.currency === 'NZD'), 'New Zealand lessons are invoiced in NZD');
  await fail(['pay', 'Wilson', '--amount=999'], /more than/);
  const paid = await run('pay', 'Wilson', '--amount=180', '--reference=Bank 77');
  ok(paid.balance_left === 0 && !(await run('overdue')).some((r) => r.family === 'Wilson family'), 'Payment clears the overdue invoice');
  const pkg = await run('sell-package', 'Kowalski', '--student=Maya', '--hours=5', '--price=450');
  ok(pkg.minutes === 300 && pkg.invoice.startsWith('INV-'), 'Sell a package with its invoice');
  const pr = await run('payroll', `--from=${new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10)}`);
  const chloe = pr.teachers.find((t) => t.teacher === 'Chloe Nguyen');
  ok(Number(chloe.hours) === Number(chloe.lessons), 'Payroll counts a group lesson once');

  // Create and update every record kind
  const loc = await run('add', 'locations', '--name=Test Room', '--jurisdiction=NSW');
  const svc = await run('add', 'services', '--name=Chemistry 1:1', '--rate=95');
  ok(Number(svc.rate_cents) === 9500, 'Rate in dollars is stored in cents');
  const tch = await run('add', 'teachers', '--name=Test Teacher', '--pay-rate=41.5');
  const chk = await run('add', 'safety_checks', `--teacher=${tch.id}`, '--jurisdiction=NSW', '--kind=wwcc', '--number=WWC0099999E', '--expires_on=2030-01-01');
  const fam = await run('add', 'families', '--name=Test family', '--email=test@example.test');
  ok((await run('show', 'families', fam.id.slice(0, 8))).id === fam.id, 'Partial id resolution');
  const stu = await run('add', 'students', '--family=Test family', '--name=Test Student', '--dob=2015-05-05');
  const les = await run('add', 'lessons', `--service=${svc.id}`, `--teacher=${tch.id}`, `--location=${loc.id}`, '--starts_at=2027-01-01 10:00', '--minutes=60');
  const pk = await run('add', 'packages', `--family=${fam.id}`, `--student=${stu.id}`, '--name=Test block', '--minutes_purchased=120', '--price=180');
  const mu = await run('add', 'makeups', `--student=${stu.id}`, '--expires_on=2027-02-01');
  const iv = await run('add', 'invoices', `--family=${fam.id}`, '--number=TEST-1', '--due_on=2027-01-01');
  const py = await run('add', 'payments', `--family=${fam.id}`, `--invoice=${iv.id}`, '--amount=10');
  const nt = await run('log', 'Test Student', 'Called', 'about', 'term', 'dates', '--kind=call');
  const made = { locations: loc, services: svc, teachers: tch, safety_checks: chk, families: fam, students: stu, lessons: les, packages: pk, makeups: mu, invoices: iv, payments: py, notes: nt };
  ok(Object.values(made).every((r) => r.id) && nt.student_id === stu.id, 'All twelve record kinds created');
  const updates = { locations: ['address', '1 Test St'], services: ['max_students', '3'], teachers: ['phone', '0400 000 000'], safety_checks: ['verified_on', today], families: ['payment_terms_days', '7'], students: ['year_level', 'Year 6'], lessons: ['notes', 'Moved rooms'], packages: ['expires_on', '2027-06-30'], makeups: ['reason', 'Sick'], invoices: ['status', 'void'], payments: ['method', 'card'], notes: ['title', 'Updated note'] };
  ok(Object.keys(updates).length === Object.keys(entities).length, 'Update test covers every kind');
  for (const [kind, [field, value]] of Object.entries(updates)) ok((await run('update', kind, made[kind].id, `--${field}=${value}`)).id === made[kind].id, `Update ${kind}`);
  ok(new Date((await run('show', 'notes', nt.id)).updated_at) >= new Date(nt.updated_at), 'Update trigger maintains updated_at');
  await fail(['update', 'students', stu.id, '--injected=bad'], /Unknown field/);
  await fail(['update', 'lessons', les.id, '--status=bogus'], /check constraint/);

  // Teachworks import
  const ex = path.join(REPO_ROOT, 'examples/teachworks');
  const imp = (kind) => ['import', 'teachworks', `--kind=${kind}`, `--file=${path.join(ex, kind + '.csv')}`];
  const before = await count('families');
  await run(...imp('families'), '--dry-run'); ok(await count('families') === before, 'Import dry run rolls back');
  const first = await run(...imp('families')); await run(...imp('families'));
  ok(first.created === 3 && await count('families') === before + 3, 'Repeated family import upserts');
  const studs = await run(...imp('students'));
  ok(studs.created === 4 && (await run('show', 'students', 'Tom Becker')).adult === true, 'Students import; an independent student is an adult');
  ok((await run('show', 'students', 'Isaac Fraser')).dob === '2014-03-14', 'DD/MM/YYYY birth dates');
  const tchs = await run(...imp('teachers'));
  ok(tchs.created === 1 && tchs.updated === 1 && Number((await run('show', 'teachers', 'Grace Liu')).pay_rate_cents) === 4200, 'Teachers import matches an existing teacher by name');
  const lessonsBefore = await count('lessons');
  const li = await run(...imp('lessons')); await run(...imp('lessons'));
  ok(li.created === 5 && await count('lessons') === lessonsBefore + 4, 'Lesson import: one lesson per time slot, a group lesson holds two students');
  const isaac = await db.query(`select attendance,charge_cents,invoiced from v_roster where student='Isaac Fraser' order by on_date`);
  ok(isaac[0].attendance === 'present' && isaac[0].charge_cents === 7000 && isaac[1].attendance === 'absent-notice', 'Import maps Teachworks attendance and cost');
  ok(isaac.every((r) => r.invoiced) && !(await run('unbilled')).some((r) => r.family === 'Helen Fraser'), 'Imported history counts as already billed in Teachworks');
  ok((await db.query(`select attendance from v_roster where student='Amelia Fraser'`))[0].attendance === 'absent-no-notice', 'No Show maps to absent without notice');
  const bad = path.join(temp, 'bad.csv');
  fs.writeFileSync(bad, 'Date,Start Time,Duration in Minutes,Teacher,Student,Attendance\n2026-08-01,10:00,60,Grace Liu,New Kid,Attended\n2026-08-01,11:00,60,Grace Liu,New Kid,Teleported\n');
  const n = await count('lesson_students'); await fail(['import', 'teachworks', '--kind=lessons', `--file=${bad}`], /unknown attendance/); ok(await count('lesson_students') === n, 'A bad later row rolls back the whole import');
  fs.writeFileSync(bad, 'Date,Start Time,Duration in Minutes,Teacher,Student,Attendance\n31/02/2026,10:00,60,Grace Liu,New Kid,Attended\n');
  await fail(['import', 'teachworks', '--kind=lessons', `--file=${bad}`], /not a real date/);
  await fail(['import', 'teachworks', '--kind=lessons', '--file=lessons.xlsx'], /as CSV/);
  ok(toDate('Mon, Oct 5, 2026', 'x') === '2026-10-05' && toDate('5 Oct 2026', 'x') === '2026-10-05' && toTime('4:30 PM', 'x') === '16:30' && toTime('12:15 am', 'x') === '00:15', 'Teachworks date and time formats');
  assert.deepEqual(parseCsv('﻿a,b\r\n"line\none","two, three"\r\n'), [{ a: 'line\none', b: 'two, three' }]);
  for (const csv of ['a,A\n1,2', 'a,b\n1', 'a,b\n"bad,2']) assert.throws(() => parseCsv(csv));
  ok(true, 'CSV BOM, multiline, quotes and malformed input');

  // Export, drafts, review
  const out = path.join(temp, 'backup.json'); await run('export', `--out=${out}`);
  const snap = JSON.parse(fs.readFileSync(out, 'utf8'));
  ok(Object.keys(snap.records).length === 14 && snap.records.lesson_students.length === await count('lesson_students'), 'Export holds every record kind');
  await fail(['export', `--out=${out}`], /EEXIST/);
  await db.exec('BEGIN');
  await db.query(`delete from payments where family_id=(select id from families where name='Walker family')`);
  const reminder = await run('draft-reminder', 'Walker');
  ok(!reminder.sent && fs.readFileSync(reminder.file, 'utf8').includes('INV-'), 'Payment reminder lists the open invoices and does not send');
  await db.exec('ROLLBACK');
  await fail(['draft-reminder', 'Nguyen family'], /nothing owing/);
  const progress = await run('draft-progress', 'Olivia');
  ok(fs.readFileSync(progress.file, 'utf8').includes('Times tables to 12'), 'Progress update carries the goal and the teacher\'s notes');
  const review = await run('weekly-review');
  ok(Object.keys(review.data).length === 3 && fs.existsSync(review.file), 'Weekly review joins three live reads');
  ok(!page({ title: '<script>x</script>', sections: [{ title: 't', html: table([{ a: '<img onerror=x>' }]) }] }).includes('<script>x'), 'HTML escapes record content');
  ok(human(await run('schedule', `--on=${booked[0].starts_at.slice(0, 10)}`)).includes('Mia Nguyen'), 'Human output is a readable table');

  // Separate processes: CLI, views, documents
  await db.close();
  const call = (script, args = []) => spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  for (const [script, args] of [['tutoring.mjs', ['attention', '--json']], ['view.mjs', []], ['docs.mjs', []]]) { const r = call(script, args); assert.equal(r.status, 0, r.stderr); ok(true, `Runs ${script}`); }
  const amb = call('tutoring.mjs', ['show', 'students', 'a', '--json']);
  ok(amb.status === 1 && JSON.parse(amb.stdout).matches.length > 1, 'CLI exits 1 and lists ambiguous matches as JSON');
  ok(fs.readFileSync(path.join(temp, 'views/safety.html'), 'utf8').includes('Daniel Okafor'), 'View rendered from real records');
  for (const kind of ['invoice', 'family-statement', 'progress-report', 'timesheet', 'safety-register']) ok(fs.readdirSync(path.join(temp, 'docs-out', kind)).length > 0, `Document ${kind} rendered`);
  console.log(`PASS: ${checks} checks; every command, import, document and view.`);
} catch (e) { console.error(e); process.exitCode = 1; }
finally {
  try { await db.close(); } catch {}
  fs.rmSync(temp, { recursive: true, force: true });
  if (control) { await control.query(`drop schema ${schema} cascade`); await control.end(); }
}
