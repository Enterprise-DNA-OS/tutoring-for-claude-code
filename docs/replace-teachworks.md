# Moving off Teachworks

Teachworks lets you download your data to Excel "for backup copies or for analysis" ([records](https://teachworks.com/features/records)). Family, student and employee lists download with every profile field as a column, custom fields included, and lesson history downloads one row per student per lesson (Lesson History by Student) ([Excel downloads](https://blog.teachworks.com/2022/06/excel-downloads-easy-access-to-your-business-data/)). Teachworks does not describe a single whole-account export, so you take four downloads.

## 1. Download from Teachworks

1. **Families** (Customers list): download to Excel.
2. **Students**: download the student list to Excel.
3. **Teachers** (Employees list): download to Excel.
4. **Lesson History by Student**: pick the date range you want to keep (this term, or the last year) and download it.

Open each in Excel and save it as CSV (`File > Save As > CSV UTF-8`).

## 2. Import, in this order

Run each with `--dry-run` first. It reads the whole file, shows the counts and changes nothing.

```bash
npm run tutoring -- import teachworks --kind=families --file=customers.csv --dry-run
npm run tutoring -- import teachworks --kind=families --file=customers.csv
npm run tutoring -- import teachworks --kind=students --file=students.csv
npm run tutoring -- import teachworks --kind=teachers --file=employees.csv
npm run tutoring -- import teachworks --kind=lessons  --file=lesson-history-by-student.csv --currency=AUD
```

Every import runs in one transaction: a bad row stops it and nothing is written. Each can run again; it matches on the Teachworks ID column when there is one, and on the name when there is not.

## 3. What the import reads

Column names are matched without case. The first name in each list is the one Teachworks uses in its own help; the others are accepted too. If your download uses another heading, rename the column or add it to `COLUMNS` in `scripts/tutoring.mjs`.

| Kind | Column | Accepted headings | Goes to |
|---|---|---|---|
| all | ID | ID, Customer ID, Family ID, Student ID, Employee ID | `external_id` |
| all | Name | Name, or First Name + Last Name | `name` |
| families | Email, Mobile Phone, Status | Email, Email Address; Mobile Phone, Phone, Home Phone; Status | `families` |
| students | Family | Family, Customer, Family Name, Customer Name | the family (created if new). Blank means an independent student, who becomes their own family and is marked adult |
| students | Birth Date, School, Grade | Birth Date, Date of Birth; School; Grade, Year Level | `students` |
| teachers | Wage | Wage, Pay Rate, Hourly Wage | `pay_rate_cents` (dollars per hour) |
| lessons | Date, Start Time | Date, Lesson Date, Day; Start Time | `lessons.starts_at` |
| lessons | Duration in Minutes or End Time | Duration in Minutes, Duration (mins); End Time | `lessons.minutes` |
| lessons | Teacher, Service, Location | as named | created if new |
| lessons | Student, Customer | Student, Student Name; Customer, Family | `lesson_students` |
| lessons | Cost | Cost, Lesson Cost, Price | `charge_cents` |
| lessons | Attendance | Attendance, Student Status, Lesson Status, Status | see below |

Dates can be `2026-10-05`, `05/10/2026` (day first) or `Oct 5, 2026`. Times can be `16:00` or `4:00 PM`.

Attendance words map like this: Attended, Present, Completed, Left Early to **present**; Late to **late**; No Show, Missed, Late Cancel to **absent without notice** (charged); Absent, Cancelled, Excused to **absent with notice** (no charge); Scheduled or blank stay **unmarked**. Any other word stops the import and names the row, so you can map it.

## 4. After the import

- **Past lessons count as billed in Teachworks.** They are not on any invoice here, so they will not be billed again. Add `--billed=false` if you want them billed from here.
- **Set each location's jurisdiction and currency** (`/update locations "Chatswood" --jurisdiction=NSW`), and **add each teacher's safety checks** (`/add safety_checks`). Teachworks has no place for them, so the safety checks start empty and `/compliance` will flag every teacher of children until they are in.
- **Set service rates** if the Cost column was blank (`/update services "Piano" --rate=90`).
- **Open balances**: add each family's unpaid Teachworks invoice with `/add invoices` and record payments with `/pay`, or start clean from the first billing run here.
- **Packages**: add each family's remaining prepaid hours with `/sell-package` (or `/add packages` without an invoice).

## What does not come across

Invoice and payment history, lesson notes and shared notes, the family portal logins, the calendar colours, email history, files attached to profiles and custom report layouts. Keep the Teachworks downloads as your archive. Enterprise DNA maps these for you when you have us do the move.

Fictional examples of all four downloads are in `examples/teachworks/`.
