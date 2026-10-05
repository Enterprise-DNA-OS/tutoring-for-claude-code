#!/usr/bin/env node
// One CLI for the tutoring database. Human tables by default, --json for machines.
//   node scripts/tutoring.mjs help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, money } from './lib/format.mjs';

// Writable fields per record kind. Anything else is rejected.
export const entities = {
  locations: ['name', 'jurisdiction', 'currency', 'address', 'online', 'active'],
  services: ['name', 'subject', 'rate_cents', 'max_students', 'active'],
  teachers: ['name', 'email', 'phone', 'pay_rate_cents', 'status', 'external_id'],
  safety_checks: ['teacher_id', 'jurisdiction', 'kind', 'number', 'issued_on', 'expires_on', 'verified_on'],
  families: ['name', 'contact_name', 'email', 'phone', 'payment_terms_days', 'status', 'external_id'],
  students: ['family_id', 'name', 'dob', 'adult', 'school', 'year_level', 'status', 'goals', 'external_id'],
  lessons: ['service_id', 'teacher_id', 'location_id', 'starts_at', 'minutes', 'status', 'cancelled_by', 'notes', 'external_id'],
  packages: ['family_id', 'student_id', 'name', 'minutes_purchased', 'price_cents', 'currency', 'purchased_on', 'expires_on'],
  makeups: ['student_id', 'issued_on', 'expires_on', 'reason'],
  invoices: ['family_id', 'number', 'currency', 'issued_on', 'due_on', 'status'],
  payments: ['family_id', 'invoice_id', 'paid_on', 'amount_cents', 'method', 'reference'],
  notes: ['family_id', 'student_id', 'teacher_id', 'kind', 'title', 'body'],
};
// Which column a person uses to name a record, and which table a reference field points at.
const label = { locations: 'name', services: 'name', teachers: 'name', safety_checks: 'number', families: 'name', students: 'name', lessons: 'id::text', packages: 'name', makeups: 'id::text', invoices: 'number', payments: 'reference', notes: 'title' };
const refs = { family_id: 'families', student_id: 'students', teacher_id: 'teachers', service_id: 'services', location_id: 'locations', invoice_id: 'invoices', package_id: 'packages' };
// Dollar flags a person types, and the cents column each one fills.
const dollarFlags = { rate: 'rate_cents', pay_rate: 'pay_rate_cents', price: 'price_cents', amount: 'amount_cents' };

const need = (v, msg) => { if (v === undefined || v === null || v === '' || v === true) throw Error(msg); return v; };
const entity = (v) => { if (!Object.hasOwn(entities, v)) throw Error(`Unknown kind ${v}. Choose ${Object.keys(entities).join(', ')}`); return v; };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const ATTENDANCE = ['present', 'late', 'absent-notice', 'absent-no-notice'];
const CHARGED = ['present', 'late', 'absent-no-notice'];
const MAKEUP_DAYS = 42;

export function parseArgs(args) {
  const pos = [], flags = {};
  for (const s of args) {
    if (s.startsWith('--')) { const i = s.indexOf('='); flags[s.slice(2, i < 0 ? undefined : i).replaceAll('-', '_')] = i < 0 ? true : s.slice(i + 1); }
    else pos.push(s);
  }
  return { pos, flags };
}

// Exact id or name first (case-insensitive), then id prefix or name fragment. One match or an error listing them.
export async function resolve(db, kind, value) {
  entity(kind); need(value, `Specify a ${kind} name or id`);
  const key = label[kind];
  let rows = await db.query(`select * from ${kind} where id::text=$1 or lower(${key})=lower($1)`, [String(value)]);
  if (!rows.length) rows = await db.query(`select * from ${kind} where starts_with(id::text,lower($1)) or position(lower($1) in lower(${key}))>0 order by ${key}`, [String(value)]);
  if (rows.length !== 1) {
    const name = (r) => r[key.replace('::text', '')] || r.id;
    const error = Error(rows.length ? `Ambiguous ${kind}: ${rows.slice(0, 12).map((r) => `${r.id} ${name(r)}`).join('; ')}` : `No ${kind} match: ${value}`);
    error.matches = rows.map((r) => ({ id: r.id, name: name(r) }));
    throw error;
  }
  return rows[0];
}

// Money flags read as dollars ("70" or "1,250.50") and are stored in cents.
function cents(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[$,\s]|AUD|NZD|USD/gi, ''));
  if (!Number.isFinite(n)) throw Error(`Not an amount: ${v}`);
  return Math.round(n * 100);
}

const lessonCode = `left(l.id::text,8)`;

export const insightQueries = [
  ['Which students came to fewer lessons in the last three weeks than the three before?',
    `select student,family,attended_prior_3wk,attended_3wk,absences_28d,last_attended,coalesce(next_booked::text,'nothing booked') as next_booked from v_student_activity where status='active' and attended_3wk<attended_prior_3wk order by attended_prior_3wk-attended_3wk desc,student`],
  ['Which teachers lose the most lessons to no-shows?',
    `select teacher,count(*) filter (where attendance is not null)::int as marked,count(*) filter (where attendance='absent-no-notice')::int as no_shows,count(*) filter (where attendance='absent-notice')::int as with_notice,round(100.0*count(*) filter (where attendance like 'absent%')/nullif(count(*) filter (where attendance is not null),0)) as pct_absent from v_roster where on_date>=current_date-42 group by teacher having count(*) filter (where attendance like 'absent%')>0 order by pct_absent desc`],
  ['What does each teacher bring in per teaching hour, after their pay?',
    `with l as (select l.id,l.teacher_id,l.minutes,(select coalesce(sum(r.charge_cents),0) from v_roster r where r.lesson_id=l.id and r.chargeable) as charged,lo.currency from lessons l join locations lo on lo.id=l.location_id where l.status='completed' and l.starts_at>=current_date-28)
     select t.name as teacher,l.currency,round(sum(l.minutes)/60.0,1) as hours,round(sum(l.charged)/100.0) as charged,round(sum(l.minutes)*t.pay_rate_cents/6000.0) as pay,round((sum(l.charged)-sum(l.minutes)*t.pay_rate_cents/60.0)/100.0/(sum(l.minutes)/60.0)) as margin_per_hour from l join teachers t on t.id=l.teacher_id group by t.name,t.pay_rate_cents,l.currency order by margin_per_hour desc`],
  ['Which families owe money and still have lessons booked this week?',
    `select b.family,b.currency,round(b.overdue_cents/100.0) as overdue,b.oldest_overdue,count(distinct r.lesson_id)::int as lessons_this_week from v_family_balance b join v_roster r on r.family_id=b.id and r.lesson_status='scheduled' and r.on_date between current_date and current_date+6 where b.overdue_cents>0 group by b.family,b.currency,b.overdue_cents,b.oldest_overdue order by b.overdue_cents desc`],
  ['Which prepaid packages run out before the lessons already booked?',
    `select family,student,name,minutes_purchased,minutes_used,minutes_left,minutes_booked,expires_on from v_package_balance where minutes_left<minutes_booked or minutes_left<=0 order by minutes_left`],
  ['Which make-up credits expire in the next 14 days without being used?',
    `select student,family,issued_on,expires_on,days_left from v_makeups where state='available' and days_left<=14 order by expires_on`],
  ['Which services make the most per teaching hour?',
    `with l as (select l.id,l.service_id,l.minutes,lo.currency,(select coalesce(sum(r.charge_cents),0) from v_roster r where r.lesson_id=l.id and r.chargeable) as charged,(select count(*) from lesson_students x where x.lesson_id=l.id) as students from lessons l join locations lo on lo.id=l.location_id where l.status='completed' and l.starts_at>=current_date-42)
     select s.name as service,l.currency,count(*)::int as lessons,round(avg(l.students),1) as avg_students,round(sum(l.minutes)/60.0,1) as hours,round(sum(l.charged)/100.0/(sum(l.minutes)/60.0)) as charged_per_hour from l join services s on s.id=l.service_id group by s.name,l.currency order by charged_per_hour desc`],
  ['Which group classes are running below half full?',
    `select s.name as service,t.name as teacher,to_char(l.starts_at,'Dy HH24:MI') as slot,count(ls.id)::int as students,s.max_students,s.max_students-count(ls.id)::int as places_free from lessons l join services s on s.id=l.service_id join teachers t on t.id=l.teacher_id left join lesson_students ls on ls.lesson_id=l.id where s.max_students>1 and l.status='scheduled' and l.starts_at>=current_date and l.starts_at<current_date+7 group by l.id,s.name,s.max_students,t.name,l.starts_at having count(ls.id)*2<s.max_students order by places_free desc`],
  ['Which students came in the last month but have nothing booked in the next two weeks?',
    `select student,family,last_attended,current_date-last_attended as days_since from v_student_activity where status='active' and last_attended>=current_date-35 and (next_booked is null or next_booked>current_date+14) order by last_attended`],
  ['Which families spend the most a month, across all their children?',
    `select family,currency,count(distinct student_id)::int as students,count(*)::int as lessons,round(sum(charge_cents)/100.0) as charged_last_28_days from v_roster where chargeable and on_date>=current_date-28 group by family,currency order by sum(charge_cents) desc limit 10`],
];

const reads = {
  locations: `select id,name,jurisdiction,currency,online,active from locations order by name`,
  services: `select id,name,subject,round(rate_cents/100.0,2) as rate_per_hour,max_students,active from services order by name`,
  teachers: `select t.id,t.name,t.email,t.phone,round(t.pay_rate_cents/100.0,2) as pay_per_hour,t.status,(select string_agg(c.jurisdiction||' '||c.kind||coalesce(' to '||c.expires_on,''),'; ') from safety_checks c where c.teacher_id=t.id) as checks from teachers t order by t.name`,
  checks: `select c.id,t.name as teacher,c.jurisdiction,c.kind,c.number,c.issued_on,c.expires_on,c.verified_on,case when c.expires_on<current_date then 'expired' when c.expires_on<=current_date+60 then 'expiring' when c.verified_on is null then 'not verified' else 'current' end as state from safety_checks c join teachers t on t.id=c.teacher_id order by t.name,c.jurisdiction`,
  families: `select f.id,f.name,f.contact_name,f.email,f.phone,f.status,(select count(*) from students s where s.family_id=f.id)::int as students,(select string_agg(b.currency||' '||round(b.balance_cents/100.0),', ') from v_family_balance b where b.id=f.id and b.balance_cents<>0) as owing from families f order by f.name`,
  students: `select s.id,s.name,f.name as family,s.year_level,s.school,s.status,a.last_attended,a.next_booked from students s join families f on f.id=s.family_id join v_student_activity a on a.id=s.id order by s.name`,
  lessons: `select ${lessonCode} as lesson,to_char(l.starts_at,'Dy YYYY-MM-DD HH24:MI') as starts,l.minutes,sv.name as service,t.name as teacher,lo.name as location,l.status,(select string_agg(s.name||coalesce(' ('||ls.attendance||')',''),', ' order by s.name) from lesson_students ls join students s on s.id=ls.student_id where ls.lesson_id=l.id) as students from lessons l join services sv on sv.id=l.service_id join teachers t on t.id=l.teacher_id join locations lo on lo.id=l.location_id where l.starts_at>=$1::date and l.starts_at<$2::date+1 order by l.starts_at,t.name`,
  unmarked: `select left(lesson_id::text,8) as lesson,on_date,to_char(starts_at,'HH24:MI') as at,teacher,service,student from v_roster where attendance is null and lesson_status<>'cancelled' and on_date<current_date order by on_date,starts_at,student`,
  unbilled: `select family,student,service,on_date,minutes,currency,round(charge_cents/100.0,2) as amount,days_since from v_unbilled order by family,on_date`,
  invoices: `select id,number,family,currency,issued_on,due_on,round(amount_cents/100.0,2) as amount,round(paid_cents/100.0,2) as paid,round(balance_cents/100.0,2) as balance,days_overdue from v_invoices order by issued_on desc,number`,
  overdue: `select family,contact_name,email,currency,round(overdue_cents/100.0,2) as overdue,oldest_overdue,current_date-oldest_overdue as days from v_family_balance where overdue_cents>0 order by overdue_cents desc`,
  packages: `select id,family,student,name,minutes_purchased,minutes_used,minutes_left,minutes_booked,expires_on from v_package_balance order by minutes_left`,
  makeups: `select id,student,family,issued_on,expires_on,state,days_left from v_makeups where state<>'expired' order by state,expires_on`,
  compliance: `select rule,subject,finding,since,source from v_compliance order by case when rule like 'SAFETY%' or rule like 'AU-%' or rule like 'NZ-%' then 0 else 1 end,rule,subject`,
  'at-risk': `select student,family,attended_3wk,attended_prior_3wk,absences_28d,last_attended,coalesce(next_booked::text,'nothing booked') as next_booked from v_student_activity where status='active' and ((next_booked is null and last_attended is not null) or absences_28d>=2 or attended_3wk<attended_prior_3wk-1) order by next_booked nulls first,absences_28d desc`,
  'teacher-load': `select t.name as teacher,count(distinct l.id)::int as lessons,round(coalesce((select sum(x.minutes) from lessons x where x.teacher_id=t.id and x.status='scheduled' and x.starts_at>=current_date and x.starts_at<current_date+7),0)/60.0,1) as hours,count(ls.id)::int as student_places from teachers t left join lessons l on l.teacher_id=t.id and l.status='scheduled' and l.starts_at>=current_date and l.starts_at<current_date+7 left join lesson_students ls on ls.lesson_id=l.id where t.status='active' group by t.id,t.name order by hours desc,t.name`,
};

// The single lesson to act on: an id or id prefix, or --teacher plus --on (and --at when the teacher has two that day).
async function lessonOf(db, ref, f) {
  if (ref) return resolve(db, 'lessons', ref);
  const t = await resolve(db, 'teachers', need(f.teacher, 'Specify a lesson id, or --teacher= and --on=YYYY-MM-DD'));
  const rows = await db.query(`select * from lessons where teacher_id=$1 and starts_at::date=$2::date ${f.at ? `and to_char(starts_at,'HH24:MI')=$3` : ''} order by starts_at`, f.at ? [t.id, need(f.on, 'Specify --on=YYYY-MM-DD'), f.at] : [t.id, need(f.on, 'Specify --on=YYYY-MM-DD')]);
  if (rows.length !== 1) { const e = Error(rows.length ? `${t.name} has ${rows.length} lessons that day. Add --at=HH:MM` : `No lesson for ${t.name} on ${f.on}`); e.matches = rows.map((r) => ({ id: r.id, name: r.starts_at })); throw e; }
  return rows[0];
}

async function tx(db, fn) {
  await db.exec('BEGIN');
  try { const out = await fn(); await db.exec('COMMIT'); return out; } catch (e) { await db.exec('ROLLBACK'); throw e; }
}

// Mark one student-lesson: charge it, draw it from a package, or issue a make-up credit.
async function markOne(db, lesson, ls, as, note) {
  const sv = (await db.query('select * from services where id=$1', [lesson.service_id]))[0];
  const charged = CHARGED.includes(as) && !ls.makeup_id;
  const charge = charged ? Math.round(sv.rate_cents * lesson.minutes / 60) : (CHARGED.includes(as) ? 0 : null);
  let pkg = null;
  if (charged) pkg = (await db.query(`select p.id from v_package_balance p where p.student_id=$1 and (p.expires_on is null or p.expires_on>=$2::date) order by p.purchased_on limit 1`, [ls.student_id, String(lesson.starts_at).slice(0, 10)]))[0]?.id || null;
  let makeup = ls.issued_makeup_id;
  if (as === 'absent-notice' && !makeup) {
    const on = String(lesson.starts_at).slice(0, 10);
    makeup = (await db.query('insert into makeups (student_id,issued_on,expires_on,reason) values ($1,$2,$3,$4) returning id', [ls.student_id, on, addDays(on, MAKEUP_DAYS), 'Absent with notice']))[0].id;
  }
  if (as !== 'absent-notice' && makeup) {
    const used = await db.query('select 1 from lesson_students where makeup_id=$1', [makeup]);
    if (used.length) throw Error('This absence already issued a make-up that has been booked. Leave the mark as it is.');
    await db.query('update lesson_students set issued_makeup_id=null where id=$1', [ls.id]);
    await db.query('delete from makeups where id=$1', [makeup]); makeup = null;
  }
  if (await db.query('select 1 from invoice_lines where lesson_student_id=$1', [ls.id]).then((r) => r.length)) throw Error('This lesson is already on an invoice. Credit it on the invoice instead.');
  return (await db.query('update lesson_students set attendance=$1,charge_cents=$2,package_id=$3,issued_makeup_id=$4,lesson_note=coalesce($5,lesson_note) where id=$6 returning *', [as, charge, pkg, makeup, note ?? null, ls.id]))[0];
}

async function bill(db, family, f) {
  const to = f.to || today();
  const lines = await db.query(`select * from v_unbilled where family_id=$1 and on_date<=$2::date order by on_date`, [family.id, to]);
  if (!lines.length) return null;
  const currencies = [...new Set(lines.map((l) => l.currency))];
  const out = [];
  for (const currency of currencies) {
    const mine = lines.filter((l) => l.currency === currency);
    const n = (await db.query(`select coalesce(max(substring(number from '[0-9]+$')::int),1000)+1 as n from invoices where number ~ '^INV-[0-9]+$'`))[0].n;
    const issued = f.on || today();
    const inv = (await db.query('insert into invoices (family_id,number,currency,issued_on,due_on) values ($1,$2,$3,$4,$5) returning *', [family.id, `INV-${n}`, currency, issued, addDays(issued, Number(family.payment_terms_days))]))[0];
    for (const l of mine) await db.query('insert into invoice_lines (invoice_id,description,amount_cents,lesson_student_id) values ($1,$2,$3,$4)', [inv.id, `${l.service}, ${l.student}, ${l.on_date}`, l.charge_cents, l.id]);
    out.push({ invoice: inv.number, family: family.name, currency, lines: mine.length, amount: mine.reduce((s, l) => s + Number(l.charge_cents), 0) / 100, due_on: inv.due_on });
  }
  return out;
}

export async function execute(db, args) {
  const { pos, flags: f } = parseArgs(args);
  const [cmd = 'help', sub, ...rest] = pos;
  if (cmd === 'help' || f.help) return {
    commands: ['families', 'students', 'teachers', 'checks', 'services', 'locations', 'lessons [--from=date --to=date]', 'unmarked', 'unbilled', 'invoices', 'overdue', 'packages', 'makeups', 'compliance', 'at-risk', 'teacher-load',
      'schedule [--on=date] [--teacher=name]', 'student <student>', 'family <family>', 'teacher <teacher>', 'attention', 'insights [1..10]',
      'book <student> --service= --teacher= --location= --at="YYYY-MM-DD HH:MM" [--minutes=60] [--weeks=1]', 'join <lesson> <student>',
      'mark <lesson> --as=present|late|absent-notice|absent-no-notice [--student=name] [--note=...]', 'cancel <lesson> --by=teacher|centre|weather',
      'book-makeup <student> --lesson=<lesson>', 'bill <family> [--to=date] [--dry-run]', 'bill-run [--to=date] [--dry-run]', 'pay <invoice|family> --amount=dollars [--method=] [--reference=]',
      'sell-package <family> --student= --hours= --price=dollars [--expires=date]', 'payroll [--from=date --to=date]',
      'show <kind> <name|id>', 'add <kind> --field=value', 'update <kind> <name|id> --field=value', 'log <family|student> <note> [--kind=call|email|progress|complaint]',
      'import teachworks --kind=families|students|teachers|lessons --file=export.csv [--currency=AUD] [--dry-run]', 'export --out=backup.json',
      'weekly-review', 'draft-reminder <family>', 'draft-progress <student>'],
    note: 'Every command takes --json. Money flags (--rate, --pay-rate, --price, --amount) are dollars; *_cents fields are cents. Reference fields accept names or ids. Lessons are named by the 8-character code in schedule and lessons.',
  };

  if (cmd === 'lessons') return db.query(reads.lessons, [f.from || today(), f.to || addDays(f.from || today(), 6)]);
  if (reads[cmd]) return db.query(reads[cmd]);

  if (cmd === 'schedule') {
    const on = f.on || today();
    const t = f.teacher ? await resolve(db, 'teachers', f.teacher) : null;
    const rows = await db.query(reads.lessons, [on, on]);
    return t ? rows.filter((r) => r.teacher === t.name) : rows;
  }

  if (cmd === 'attention') {
    const compliance = await db.query(reads.compliance);
    return {
      safety_checks: compliance.filter((r) => !r.rule.startsWith('POLICY')).map(({ source, ...r }) => r),
      unmarked: await db.query(`select teacher,count(*)::int as students,min(on_date) as oldest from v_roster where attendance is null and lesson_status<>'cancelled' and on_date<current_date group by teacher order by oldest`),
      overdue_invoices: await db.query(`select family,currency,round(overdue_cents/100.0,2) as overdue,current_date-oldest_overdue as days from v_family_balance where overdue_cents>0 order by overdue_cents desc`),
      packages_running_out: await db.query(`select family,student,name,minutes_left,minutes_booked from v_package_balance where minutes_left<=60 or minutes_left<minutes_booked order by minutes_left`),
      makeups_expiring: await db.query(`select student,family,expires_on,days_left from v_makeups where state='available' and days_left<=7 order by expires_on`),
      students_drifting: await db.query(`select student,family,last_attended,coalesce(next_booked::text,'nothing booked') as next_booked,absences_28d from v_student_activity where status='active' and ((next_booked is null and last_attended is not null) or absences_28d>=2) order by last_attended`),
      double_bookings: compliance.filter((r) => r.rule === 'POLICY-DOUBLE-BOOKED').map((r) => ({ teacher: r.subject, finding: r.finding })),
    };
  }

  if (cmd === 'student') {
    const s = await resolve(db, 'students', sub);
    return {
      student: { ...s, family: (await db.query('select name from families where id=$1', [s.family_id]))[0].name },
      activity: (await db.query('select attended_3wk,attended_prior_3wk,absences_28d,last_attended,next_booked from v_student_activity where id=$1', [s.id]))[0],
      lessons: await db.query(`select left(lesson_id::text,8) as lesson,on_date,service,teacher,coalesce(attendance,case when lesson_status='cancelled' then 'cancelled' when on_date>=current_date then 'booked' else 'not marked' end) as attendance,lesson_note from v_roster where student_id=$1 and on_date>=current_date-42 order by starts_at`, [s.id]),
      packages: await db.query('select name,minutes_left,minutes_booked,expires_on from v_package_balance where student_id=$1', [s.id]),
      makeups: await db.query(`select left(id::text,8) as makeup,issued_on,expires_on,state from v_makeups where student_id=$1 and state<>'expired'`, [s.id]),
      notes: await db.query('select kind,title,body,created_at::date as on from notes where student_id=$1 order by created_at desc', [s.id]),
    };
  }

  if (cmd === 'family') {
    const fam = await resolve(db, 'families', sub);
    return {
      family: fam,
      students: await db.query('select s.name,s.year_level,s.status,a.last_attended,a.next_booked from students s join v_student_activity a on a.id=s.id where s.family_id=$1 order by s.name', [fam.id]),
      invoices: await db.query('select number,currency,issued_on,due_on,round(amount_cents/100.0,2) as amount,round(balance_cents/100.0,2) as balance,days_overdue from v_invoices where family_id=$1 order by issued_on desc', [fam.id]),
      unbilled: await db.query('select student,service,on_date,round(charge_cents/100.0,2) as amount from v_unbilled where family_id=$1 order by on_date', [fam.id]),
      packages: await db.query('select student,name,minutes_left,minutes_booked from v_package_balance where family_id=$1', [fam.id]),
      notes: await db.query('select kind,title,body,created_at::date as on from notes where family_id=$1 order by created_at desc', [fam.id]),
    };
  }

  if (cmd === 'teacher') {
    const t = await resolve(db, 'teachers', sub);
    return {
      teacher: t,
      checks: await db.query('select jurisdiction,kind,number,issued_on,expires_on,verified_on from safety_checks where teacher_id=$1', [t.id]),
      this_week: await db.query(reads.lessons, [today(), addDays(today(), 6)]).then((r) => r.filter((x) => x.teacher === t.name)),
      findings: (await db.query(reads.compliance)).filter((r) => r.subject === t.name),
    };
  }

  if (cmd === 'insights') {
    if (sub !== undefined && !/^([1-9]|10)$/.test(sub)) throw Error('Choose insight 1 through 10');
    const out = [];
    for (let i = 0; i < insightQueries.length; i++) {
      if (sub && Number(sub) !== i + 1) continue;
      out.push({ number: i + 1, question: insightQueries[i][0], rows: await db.query(insightQueries[i][1]) });
    }
    return out;
  }

  if (cmd === 'show') return resolve(db, entity(sub), rest[0]);

  if (cmd === 'add' || cmd === 'update') {
    const kind = entity(sub);
    const old = cmd === 'update' ? await resolve(db, kind, rest[0]) : null;
    const values = {};
    for (const [key, v] of Object.entries(f)) {
      if (key === 'json') continue;
      if (dollarFlags[key] && entities[kind].includes(dollarFlags[key])) { values[dollarFlags[key]] = cents(v); continue; }
      const col = entities[kind].includes(key) ? key : entities[kind].includes(key + '_id') ? key + '_id' : null;
      if (!col) throw Error(`Unknown field ${key} for ${kind}`);
      values[col] = v === 'null' ? null : v;
    }
    for (const [key, target] of Object.entries(refs)) if (values[key]) values[key] = (await resolve(db, target, values[key])).id;
    const keys = Object.keys(values);
    if (!keys.length) throw Error('Supply at least one field');
    const params = Object.values(values);
    const sql = cmd === 'add'
      ? `insert into ${kind} (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *`
      : `update ${kind} set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} where id=$${params.push(old.id)} returning *`;
    return (await db.query(sql, params))[0];
  }

  // Book a student into a new lesson, weekly for --weeks. A group service can take more students with join.
  if (cmd === 'book') {
    const s = await resolve(db, 'students', sub);
    const sv = await resolve(db, 'services', need(f.service, 'Specify --service='));
    const t = await resolve(db, 'teachers', need(f.teacher, 'Specify --teacher='));
    const lo = await resolve(db, 'locations', need(f.location, 'Specify --location='));
    const at = need(f.at, 'Specify --at="YYYY-MM-DD HH:MM"');
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(at)) throw Error('--at must look like "2026-10-12 16:00"');
    const weeks = Number(f.weeks || 1), minutes = Number(f.minutes || 60);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw Error('--weeks must be 1 to 52');
    return tx(db, async () => {
      const made = [];
      for (let w = 0; w < weeks; w++) {
        const startsAt = `${addDays(at.slice(0, 10), 7 * w)} ${at.slice(11)}`;
        const clash = await db.query(`select id from lessons where teacher_id=$1 and status<>'cancelled' and starts_at<$2::timestamp+make_interval(mins=>$3::int) and $2::timestamp<starts_at+make_interval(mins=>minutes)`, [t.id, startsAt, minutes]);
        if (clash.length && !f.allow_overlap) throw Error(`${t.name} already has a lesson at ${startsAt}. Pick another time or add --allow-overlap.`);
        const l = (await db.query('insert into lessons (service_id,teacher_id,location_id,starts_at,minutes) values ($1,$2,$3,$4,$5) returning *', [sv.id, t.id, lo.id, startsAt, minutes]))[0];
        await db.query('insert into lesson_students (lesson_id,student_id) values ($1,$2)', [l.id, s.id]);
        made.push({ lesson: l.id.slice(0, 8), starts_at: startsAt, student: s.name, service: sv.name, teacher: t.name, location: lo.name });
      }
      return made;
    });
  }

  if (cmd === 'join' || cmd === 'book-makeup') {
    const s = await resolve(db, 'students', cmd === 'join' ? rest[0] : sub);
    const l = await lessonOf(db, cmd === 'join' ? sub : f.lesson, f);
    if (l.status !== 'scheduled') throw Error(`That lesson is ${l.status}`);
    const sv = (await db.query('select * from services where id=$1', [l.service_id]))[0];
    const n = Number((await db.query('select count(*) as n from lesson_students where lesson_id=$1', [l.id]))[0].n);
    if (n >= sv.max_students) throw Error(`${sv.name} is full (${n} of ${sv.max_students})`);
    let makeup = null;
    if (cmd === 'book-makeup') {
      makeup = (await db.query(`select * from v_makeups where student_id=$1 and state='available' and expires_on>=$2::date order by expires_on limit 1`, [s.id, String(l.starts_at).slice(0, 10)]))[0];
      if (!makeup) throw Error(`${s.name} has no make-up credit that is still valid on that date`);
    }
    return (await db.query('insert into lesson_students (lesson_id,student_id,makeup_id) values ($1,$2,$3) returning *', [l.id, s.id, makeup?.id || null]))[0];
  }

  if (cmd === 'mark') {
    const as = need(f.as, `Specify --as=${ATTENDANCE.join('|')}`);
    if (!ATTENDANCE.includes(as)) throw Error(`--as must be one of ${ATTENDANCE.join(', ')}`);
    const l = await lessonOf(db, sub, f);
    if (l.status === 'cancelled') throw Error('That lesson was cancelled');
    if (String(l.starts_at).slice(0, 10) > today()) throw Error('That lesson has not happened yet');
    return tx(db, async () => {
      let rows = await db.query('select ls.*,s.name from lesson_students ls join students s on s.id=ls.student_id where ls.lesson_id=$1', [l.id]);
      if (f.student) { const s = await resolve(db, 'students', f.student); rows = rows.filter((r) => r.student_id === s.id); if (!rows.length) throw Error(`${s.name} is not in that lesson`); }
      const out = [];
      for (const r of rows) { const m = await markOne(db, l, r, as, f.note); out.push({ student: r.name, attendance: m.attendance, charge: m.charge_cents == null ? '' : m.charge_cents / 100, from_package: Boolean(m.package_id), makeup_issued: Boolean(m.issued_makeup_id) }); }
      const open = await db.query('select 1 from lesson_students where lesson_id=$1 and attendance is null', [l.id]);
      if (!open.length) await db.query(`update lessons set status='completed' where id=$1`, [l.id]);
      return out;
    });
  }

  if (cmd === 'cancel') {
    const l = await lessonOf(db, sub, f);
    const by = need(f.by, 'Specify --by=teacher|centre|weather');
    if (await db.query(`select 1 from lesson_students ls join invoice_lines il on il.lesson_student_id=ls.id where ls.lesson_id=$1`, [l.id]).then((r) => r.length)) throw Error('A student in that lesson is already invoiced. Credit the invoice first.');
    return tx(db, async () => {
      await db.query('update lesson_students set attendance=null,charge_cents=null,package_id=null where lesson_id=$1', [l.id]);
      return (await db.query(`update lessons set status='cancelled',cancelled_by=$1,notes=trim(notes||' '||$2) where id=$3 returning *`, [by, f.note || '', l.id]))[0];
    });
  }

  if (cmd === 'bill' || cmd === 'bill-run') {
    const families = cmd === 'bill' ? [await resolve(db, 'families', sub)] : await db.query('select distinct f.* from families f join v_unbilled u on u.family_id=f.id order by f.name');
    await db.exec('BEGIN');
    try {
      const out = [];
      for (const fam of families) { const r = await bill(db, fam, f); if (r) out.push(...r); }
      await db.exec(f.dry_run ? 'ROLLBACK' : 'COMMIT');
      if (cmd === 'bill' && !out.length) throw Error(`Nothing unbilled for ${families[0].name}`);
      return f.dry_run ? out.map((o) => ({ ...o, invoice: '(dry run)' })) : out;
    } catch (e) { try { await db.exec('ROLLBACK'); } catch {} throw e; }
  }

  if (cmd === 'pay') {
    const amount = cents(need(f.amount, 'Specify --amount= in dollars'));
    if (!(amount > 0)) throw Error('Amount must be more than zero');
    let inv = (await db.query('select * from v_invoices where lower(number)=lower($1) or id::text=$1', [sub]))[0];
    if (!inv) {
      const fam = await resolve(db, 'families', sub);
      inv = (await db.query('select * from v_invoices where family_id=$1 and balance_cents>0 order by due_on limit 1', [fam.id]))[0];
      if (!inv) throw Error(`${fam.name} has nothing owing`);
    }
    if (amount > inv.balance_cents) throw Error(`That is more than the ${money(inv.balance_cents, inv.currency)} owing on ${inv.number}`);
    const p = (await db.query('insert into payments (family_id,invoice_id,paid_on,amount_cents,method,reference) values ($1,$2,$3,$4,$5,$6) returning *', [inv.family_id, inv.id, f.on || today(), amount, f.method || 'bank transfer', f.reference || null]))[0];
    return { ...p, invoice: inv.number, balance_left: (inv.balance_cents - amount) / 100 };
  }

  if (cmd === 'sell-package') {
    const fam = await resolve(db, 'families', sub);
    const s = await resolve(db, 'students', need(f.student, 'Specify --student='));
    if (s.family_id !== fam.id) throw Error(`${s.name} is not in ${fam.name}`);
    const hours = Number(need(f.hours, 'Specify --hours='));
    if (!(hours > 0)) throw Error('Hours must be more than zero');
    const price = cents(need(f.price, 'Specify --price= in dollars'));
    const currency = f.currency || (await db.query(`select coalesce((select currency from v_roster where student_id=$1 order by starts_at desc limit 1),'AUD') as c`, [s.id]))[0].c;
    return tx(db, async () => {
      const name = f.name || `${hours} hour package`;
      const p = (await db.query('insert into packages (family_id,student_id,name,minutes_purchased,price_cents,currency,purchased_on,expires_on) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *', [fam.id, s.id, name, Math.round(hours * 60), price, currency, today(), f.expires || null]))[0];
      const n = (await db.query(`select coalesce(max(substring(number from '[0-9]+$')::int),1000)+1 as n from invoices where number ~ '^INV-[0-9]+$'`))[0].n;
      const inv = (await db.query('insert into invoices (family_id,number,currency,issued_on,due_on) values ($1,$2,$3,$4,$5) returning *', [fam.id, `INV-${n}`, currency, today(), addDays(today(), Number(fam.payment_terms_days))]))[0];
      await db.query('insert into invoice_lines (invoice_id,description,amount_cents,package_id) values ($1,$2,$3,$4)', [inv.id, `${name} for ${s.name}`, price, p.id]);
      return { package: p.name, student: s.name, minutes: p.minutes_purchased, invoice: inv.number, amount: price / 100, currency };
    });
  }

  // Teacher pay for a period: each taught lesson once, however many students were in it.
  if (cmd === 'payroll') {
    const to = f.to || today(), from = f.from || addDays(to, -13);
    const rows = await db.query(`select t.name as teacher,count(l.id)::int as lessons,round(coalesce(sum(l.minutes),0)/60.0,2) as hours,round(t.pay_rate_cents/100.0,2) as rate,round(coalesce(sum(l.minutes),0)*t.pay_rate_cents/6000.0,2) as pay,
      (select count(*) from lessons u where u.teacher_id=t.id and u.status='scheduled' and u.starts_at>=$1::date and u.starts_at<least($2::date+1,current_date))::int as unmarked_not_paid
      from teachers t left join lessons l on l.teacher_id=t.id and l.status='completed' and l.starts_at>=$1::date and l.starts_at<$2::date+1
      where t.status='active' group by t.id,t.name,t.pay_rate_cents order by t.name`, [from, to]);
    return { from, to, teachers: rows, note: 'Lessons still unmarked are not paid until they are marked.' };
  }

  if (cmd === 'log') {
    let fam = null, st = null;
    try { st = await resolve(db, 'students', sub); fam = { id: st.family_id }; } catch (e) { if (e.matches?.length) throw e; fam = await resolve(db, 'families', sub); }
    return (await db.query('insert into notes (family_id,student_id,kind,title,body) values ($1,$2,$3,$4,$5) returning *', [fam.id, st?.id || null, f.kind || 'note', f.title || 'Note', need(rest.join(' '), 'Supply the note text')]))[0];
  }

  if (cmd === 'import') return importTeachworks(db, sub, f);

  if (cmd === 'export') {
    const snapshot = { format: 'tutoring-for-claude-code/v1', exported_at: new Date().toISOString(), records: {} };
    await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try { for (const kind of [...Object.keys(entities), 'lesson_students', 'invoice_lines']) snapshot.records[kind] = await db.query(`select * from ${kind} order by id`); await db.exec('COMMIT'); }
    catch (e) { await db.exec('ROLLBACK'); throw e; }
    const out = path.resolve(need(f.out, 'Specify --out=backup.json'));
    fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { file: out, counts: Object.fromEntries(Object.entries(snapshot.records).map(([k, v]) => [k, v.length])) };
  }

  if (cmd === 'weekly-review') {
    const data = { this_week: await execute(db, ['lessons']), attention: await execute(db, ['attention']), compliance: await execute(db, ['compliance']) };
    return draft('weekly-review', `# Tutoring weekly review, ${today()}\n\n## Lessons this week\n\n${human(data.this_week)}\n\n## Needs attention\n\n${human(data.attention)}\n\n## Record checks\n\n${human(data.compliance.map(({ source, ...r }) => r))}\n`, data);
  }

  if (cmd === 'draft-reminder') {
    const fam = await resolve(db, 'families', sub);
    const open = await db.query('select * from v_invoices where family_id=$1 and balance_cents>0 order by due_on', [fam.id]);
    if (!open.length) throw Error(`${fam.name} has nothing owing`);
    const booked = await db.query(`select count(distinct lesson_id)::int as n from v_roster where family_id=$1 and lesson_status='scheduled' and on_date>=current_date`, [fam.id]);
    const list = open.map((i) => `- ${i.number}, issued ${i.issued_on}, due ${i.due_on}: ${money(i.balance_cents, i.currency)} owing`).join('\n');
    const text = `# Draft only: payment reminder\n\nTo: ${fam.contact_name || fam.name}${fam.email ? ` <${fam.email}>` : ''}\nSubject: Lesson invoice${open.length > 1 ? 's' : ''} now due\n\nHi ${(fam.contact_name || '').split(' ')[0] || 'there'},\n\nA quick note that ${open.length > 1 ? 'these invoices are' : 'this invoice is'} still open:\n\n${list}\n\n${booked[0].n ? `There ${booked[0].n === 1 ? 'is 1 lesson' : `are ${booked[0].n} lessons`} booked ahead, and we would love to keep them going. ` : ''}If it has already gone through, thank you, and please ignore this. If anything is wrong with the invoice, reply and we will sort it.\n\nThanks,\n[Your name]\n\nNothing has been sent. Review before use.\n`;
    return draft('payment-reminder', text, { family: fam, invoices: open });
  }

  if (cmd === 'draft-progress') {
    const s = await resolve(db, 'students', sub);
    const fam = (await db.query('select * from families where id=$1', [s.family_id]))[0];
    const act = (await db.query('select * from v_student_activity where id=$1', [s.id]))[0];
    const recent = await db.query(`select on_date,service,teacher,attendance,lesson_note from v_roster where student_id=$1 and attendance is not null and on_date>=current_date-42 order by on_date`, [s.id]);
    const notes = await db.query(`select body from notes where student_id=$1 and kind='progress' order by created_at desc limit 3`, [s.id]);
    const came = recent.filter((r) => ['present', 'late'].includes(r.attendance)).length;
    const text = `# Draft only: progress update\n\nTo: ${fam.contact_name || fam.name}${fam.email ? ` <${fam.email}>` : ''}\nSubject: ${s.name.split(' ')[0]}'s progress\n\nHi ${(fam.contact_name || '').split(' ')[0] || 'there'},\n\n${s.name.split(' ')[0]} came to ${came} of ${recent.length} lessons over the last six weeks${recent[0] ? ` with ${[...new Set(recent.map((r) => r.teacher))].join(' and ')}` : ''}.${s.goals ? `\n\nThe goal we set: ${s.goals}.` : ''}\n\n${notes.length ? `Where things are now:\n\n${notes.map((n) => `- ${n.body}`).join('\n')}` : '[Add what has improved and what comes next. There are no progress notes on file.]'}\n${recent.some((r) => r.lesson_note) ? `\nFrom recent lessons:\n\n${recent.filter((r) => r.lesson_note).map((r) => `- ${r.on_date}: ${r.lesson_note}`).join('\n')}\n` : ''}\n${act.next_booked ? `Next lesson: ${act.next_booked}.` : 'There is no lesson booked yet. Reply with a time that suits and we will hold it.'}\n\nThanks,\n[Your name]\n\nNothing has been sent. Review before use.\n`;
    return draft('progress', text, { student: s, recent });
  }

  throw Error(`Unknown command ${cmd}. Run help.`);
}

function draft(prefix, text, data) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${prefix}-${today()}-${Math.random().toString(16).slice(2, 8)}.md`);
  fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 });
  return { file, data, sent: false };
}

const hidden = (k) => ['id', 'created_at', 'updated_at', 'source'].includes(k) || k.endsWith('_id');
export function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '  (none)';
    if (typeof value[0] !== 'object' || value[0] === null) return value.map((v) => `  ${v}`).join('\n');
    if (value[0]?.question) return value.map((x) => `${x.number}. ${x.question}\n${human(x.rows)}`).join('\n\n');
    const keys = Object.keys(value[0]).filter((k) => !hidden(k));
    return table(value, keys.map((key) => ({ key, label: key.replaceAll('_', ' '), width: key === 'finding' ? 110 : 70, format: (v) => (v instanceof Date ? v.toISOString().slice(0, 16) : v == null ? '' : String(v)) })));
  }
  if (value && typeof value === 'object') {
    const flat = (v) => v === null || typeof v !== 'object' || v instanceof Date;
    const scalars = Object.entries(value).filter(([k, v]) => flat(v) && !hidden(k)).map(([k, v]) => `${k.replaceAll('_', ' ')}: ${v instanceof Date ? v.toISOString().slice(0, 16) : v ?? ''}`);
    const nested = Object.entries(value).filter(([, v]) => !flat(v)).map(([k, v]) => `${k.replaceAll('_', ' ')}:\n${human(v)}`);
    return [scalars.join('\n'), ...nested].filter(Boolean).join('\n\n');
  }
  return String(value ?? '');
}

// Teachworks downloads open in Excel; save each as CSV. docs/replace-teachworks.md lists the
// column names read here. Common Teachworks labels are accepted as aliases.
const COLUMNS = {
  id: ['ID', 'Customer ID', 'Family ID', 'Student ID', 'Employee ID', 'Teacher ID'],
  name: ['Name', 'Family Name', 'Customer Name', 'Full Name', 'Student Name', 'Teacher Name', 'Employee Name'],
  first: ['First Name', 'First'],
  last: ['Last Name', 'Last', 'Surname'],
  email: ['Email', 'Email Address', 'Customer Email'],
  phone: ['Mobile Phone', 'Mobile', 'Phone', 'Home Phone', 'Customer Mobile Phone'],
  status: ['Status'],
  family: ['Family', 'Customer', 'Family Name', 'Customer Name', 'Parent'],
  dob: ['Birth Date', 'Date of Birth', 'Birthday', 'DOB'],
  school: ['School'],
  grade: ['Grade', 'Grade Level', 'Year Level', 'Year'],
  wage: ['Wage', 'Pay Rate', 'Hourly Wage', 'Wage Rate'],
  date: ['Date', 'Lesson Date', 'Day', 'Start Date'],
  start: ['Start Time', 'Start', 'Time'],
  end: ['End Time', 'End'],
  minutes: ['Duration in Minutes', 'Duration (mins)', 'Duration Minutes', 'Minutes'],
  teacher: ['Teacher', 'Teacher Name', 'Employee'],
  service: ['Service', 'Service Name', 'Subject'],
  location: ['Location', 'Location Name'],
  student: ['Student', 'Student Name'],
  cost: ['Cost', 'Lesson Cost', 'Price', 'Amount', 'Fee'],
  attendance: ['Attendance', 'Student Status', 'Lesson Status', 'Status'],
};
// Teachworks attendance words onto this system's four marks. Blank or scheduled stays unmarked.
const MARKS = { attended: 'present', present: 'present', completed: 'present', 'left early': 'present', late: 'late', 'arrived late': 'late', 'no show': 'absent-no-notice', 'no-show': 'absent-no-notice', missed: 'absent-no-notice', 'late cancel': 'absent-no-notice', 'late cancellation': 'absent-no-notice', 'absent no notice': 'absent-no-notice', absent: 'absent-notice', 'absent with notice': 'absent-notice', cancelled: 'absent-notice', canceled: 'absent-notice', excused: 'absent-notice', scheduled: null, booked: null, '': null };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function toDate(v, where) {
  if (!v) return null;
  const s = String(v).trim().replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+/i, '');
  let y, m, d, hit;
  if ((hit = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [hit[1], hit[2], hit[3]];
  else if ((hit = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) [y, m, d] = [hit[3], hit[2], hit[1]];
  else if ((hit = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MONTHS[hit[1].toLowerCase()]) [y, m, d] = [hit[3], MONTHS[hit[1].toLowerCase()], hit[2]];
  else if ((hit = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/)) && MONTHS[hit[2].toLowerCase()]) [y, m, d] = [hit[3], MONTHS[hit[2].toLowerCase()], hit[1]];
  else throw Error(`${where}: "${v}" is not a date (use YYYY-MM-DD, DD/MM/YYYY or "Oct 5, 2026")`);
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (Number.isNaN(Date.parse(iso + 'T00:00:00Z')) || new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) !== iso) throw Error(`${where}: "${v}" is not a real date`);
  return iso;
}
export function toTime(v, where) {
  const hit = String(v || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/i);
  if (!hit) throw Error(`${where}: "${v}" is not a time (use 16:00 or 4:00 PM)`);
  let h = Number(hit[1]); const ap = hit[3]?.[0].toLowerCase();
  if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0;
  if (h > 23 || Number(hit[2]) > 59) throw Error(`${where}: "${v}" is not a time`);
  return `${String(h).padStart(2, '0')}:${hit[2]}`;
}

async function importTeachworks(db, vendor, f) {
  if (vendor !== 'teachworks') throw Error('Supported import: teachworks');
  const kind = f.kind || 'families';
  if (!['families', 'students', 'teachers', 'lessons'].includes(kind)) throw Error('Import kind must be families, students, teachers or lessons');
  const file = need(f.file, 'Specify --file=export.csv');
  if (!String(file).toLowerCase().endsWith('.csv')) throw Error('Save the Teachworks Excel download as CSV first. Read docs/replace-teachworks.md.');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) throw Error('CSV has no data rows');
  const get = (row, col) => pick(row, ...COLUMNS[col]).trim();
  const fullName = (row, where) => need(get(row, 'name') || [get(row, 'first'), get(row, 'last')].filter(Boolean).join(' '), `${where}: a Name, or First Name and Last Name, is required`);
  const counts = { created: 0, updated: 0, families: 0, teachers: 0, services: 0, locations: 0, lessons: 0 };
  const findOrMake = async (t, name, extra = {}) => {
    const hit = (await db.query(`select * from ${t} where lower(name)=lower($1)`, [name]))[0];
    if (hit) return hit;
    counts[t]++;
    const cols = ['name', ...Object.keys(extra)];
    return (await db.query(`insert into ${t} (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, [name, ...Object.values(extra)]))[0];
  };
  await db.exec('BEGIN');
  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i], where = `Row ${i + 2}`;
      const status = (get(row, 'status') || 'active').toLowerCase();
      if (kind === 'families') {
        const name = fullName(row, where);
        const id = get(row, 'id') || null;
        const existing = (await db.query('select id from families where (external_id is not null and external_id=$1) or lower(name)=lower($2)', [id, name]))[0];
        const st = status.startsWith('inactive') ? 'inactive' : status.startsWith('prospect') || status.startsWith('lead') ? 'lead' : 'active';
        if (existing) await db.query('update families set contact_name=coalesce($1,contact_name),email=coalesce($2,email),phone=coalesce($3,phone),status=$4,external_id=coalesce($5,external_id) where id=$6', [name, get(row, 'email') || null, get(row, 'phone') || null, st, id, existing.id]);
        else await db.query('insert into families (name,contact_name,email,phone,status,external_id) values ($1,$1,$2,$3,$4,$5)', [name, get(row, 'email') || null, get(row, 'phone') || null, st, id]);
        counts[existing ? 'updated' : 'created']++;
      } else if (kind === 'students') {
        const name = fullName(row, where);
        // An independent student (an adult paying for themselves) is their own family.
        const famName = get(row, 'family') || name;
        const fam = await findOrMake('families', famName, { contact_name: famName });
        const id = get(row, 'id') || null;
        const existing = (await db.query('select id from students where (external_id is not null and external_id=$1) or (family_id=$2 and lower(name)=lower($3))', [id, fam.id, name]))[0];
        const dob = toDate(get(row, 'dob'), where);
        const adult = !get(row, 'family') || (dob ? dob <= addDays(today(), -6575) : false);
        const st = status.startsWith('inactive') ? 'inactive' : status.startsWith('wait') ? 'waitlist' : 'active';
        if (existing) await db.query('update students set dob=coalesce($1,dob),adult=$2,school=coalesce(nullif($3,\'\'),school),year_level=coalesce(nullif($4,\'\'),year_level),status=$5,external_id=coalesce($6,external_id) where id=$7', [dob, adult, get(row, 'school'), get(row, 'grade'), st, id, existing.id]);
        else await db.query('insert into students (family_id,name,dob,adult,school,year_level,status,external_id) values ($1,$2,$3,$4,$5,$6,$7,$8)', [fam.id, name, dob, adult, get(row, 'school'), get(row, 'grade'), st, id]);
        counts[existing ? 'updated' : 'created']++;
      } else if (kind === 'teachers') {
        const name = fullName(row, where);
        const id = get(row, 'id') || null;
        const existing = (await db.query('select id from teachers where (external_id is not null and external_id=$1) or lower(name)=lower($2)', [id, name]))[0];
        const wage = get(row, 'wage') ? cents(get(row, 'wage')) : null;
        if (existing) await db.query('update teachers set email=coalesce($1,email),phone=coalesce($2,phone),pay_rate_cents=coalesce($3,pay_rate_cents),external_id=coalesce($4,external_id) where id=$5', [get(row, 'email') || null, get(row, 'phone') || null, wage, id, existing.id]);
        else await db.query('insert into teachers (name,email,phone,pay_rate_cents,status,external_id) values ($1,$2,$3,$4,$5,$6)', [name, get(row, 'email') || null, get(row, 'phone') || null, wage ?? 0, status.startsWith('inactive') ? 'inactive' : 'active', id]);
        counts[existing ? 'updated' : 'created']++;
      } else {
        // Lesson History by Student: one row per student per lesson.
        const date = need(toDate(get(row, 'date'), where), `${where}: Date required`);
        const start = toTime(need(get(row, 'start'), `${where}: Start Time required`), where);
        let minutes = Number(get(row, 'minutes'));
        if (!minutes && get(row, 'end')) { const end = toTime(get(row, 'end'), where); minutes = (Number(end.slice(0, 2)) * 60 + Number(end.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3))); }
        if (!(minutes > 0)) throw Error(`${where}: Duration in Minutes, or an End Time after the Start Time, is required`);
        const teacher = await findOrMake('teachers', need(get(row, 'teacher'), `${where}: Teacher required`));
        const cost = get(row, 'cost') ? cents(get(row, 'cost')) : null;
        const service = await findOrMake('services', get(row, 'service') || 'Imported lessons', { rate_cents: cost != null ? Math.round(cost * 60 / minutes) : 0 });
        const location = await findOrMake('locations', get(row, 'location') || 'Imported location', { currency: (f.currency || 'AUD').toUpperCase() });
        const markWord = get(row, 'attendance').toLowerCase();
        if (!Object.hasOwn(MARKS, markWord)) throw Error(`${where}: unknown attendance "${get(row, 'attendance')}". Map it in docs/replace-teachworks.md terms.`);
        const mark = MARKS[markWord];
        const studentName = need(get(row, 'student'), `${where}: Student required`);
        const famName = get(row, 'family') || studentName;
        const fam = await findOrMake('families', famName, { contact_name: famName });
        let student = (await db.query('select * from students where family_id=$1 and lower(name)=lower($2)', [fam.id, studentName]))[0];
        if (!student) student = (await db.query('select * from students where lower(name)=lower($1)', [studentName]))[0];
        if (!student) student = (await db.query('insert into students (family_id,name,adult) values ($1,$2,$3) returning *', [fam.id, studentName, famName === studentName]))[0];
        const startsAt = `${date} ${start}`;
        let lesson = (await db.query('select * from lessons where teacher_id=$1 and starts_at=$2::timestamp and service_id=$3', [teacher.id, startsAt, service.id]))[0];
        const past = date < today();
        if (!lesson) { lesson = (await db.query('insert into lessons (service_id,teacher_id,location_id,starts_at,minutes,status) values ($1,$2,$3,$4,$5,$6) returning *', [service.id, teacher.id, location.id, startsAt, minutes, past && mark ? 'completed' : 'scheduled']))[0]; counts.lessons++; }
        const existing = (await db.query('select id from lesson_students where lesson_id=$1 and student_id=$2', [lesson.id, student.id]))[0];
        const charge = mark && CHARGED.includes(mark) ? (cost ?? 0) : mark ? null : null;
        await db.query(`insert into lesson_students (lesson_id,student_id,attendance,charge_cents,billed_externally) values ($1,$2,$3,$4,$5)
          on conflict (lesson_id,student_id) do update set attendance=excluded.attendance,charge_cents=excluded.charge_cents,billed_externally=excluded.billed_externally`,
          [lesson.id, student.id, mark, charge, past && f.billed !== 'false']);
        counts[existing ? 'updated' : 'created']++;
      }
    }
    await db.exec(f.dry_run ? 'ROLLBACK' : 'COMMIT');
  } catch (e) { await db.exec('ROLLBACK'); throw e; }
  return { kind, rows: rows.length, ...counts, dry_run: Boolean(f.dry_run) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  const args = process.argv.slice(2), json = args.includes('--json');
  try { db = await getDb(); const out = await execute(db, args); console.log(json ? JSON.stringify(out, null, 2) : human(out)); }
  catch (e) { if (json) console.log(JSON.stringify({ error: e.message, ...(e.matches ? { matches: e.matches } : {}) })); else console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
