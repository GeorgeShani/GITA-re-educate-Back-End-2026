# Demo files

Sample CSV and XLSX files for showing what Gridline does. Every name, address, phone number and IBAN in them is invented
(the addresses are on `example.com`). Each file is built to show one thing, and what you should see below was checked by
uploading them all.

## Before you upload: add these quality rules

Go to **Quality rules → Add a rule**. A file's flaws only lower its score when a rule says they matter, so without rules
the messy files below score 100.

| Rule name | What to check | Column | Setting | Severity |
|---|---|---|---|---|
| Credit limit mostly filled | Most empty cells | `credit_limit` | 5 % | Warning |
| No repeated rows | Most repeated rows | (none) | 0 | Warning |
| Expense ids are unique | Values are unique | `expense_id` | | Error |
| Amounts are not negative | Lowest value | `amount_gel` | 0 | Error |
| Amounts are numbers | Column type | `amount_gel` | Number | Error |
| No personal data | No personal data | (none) | | Warning |

Rules skip a file that does not have the column, so one set serves every file.

## The files

| File | What it shows | What you should see |
|---|---|---|
| `01-sales-clean.csv` | A healthy file, and the query builder | Score **100**. On **Explore**, group by `region` and add "Total of `revenue`". |
| `02-customers-messy.csv` | Dirty data and the cleaning builder | Score **33**: too many empty `credit_limit` cells and repeated rows. Open **Clean**: trimming spaces, replacing `N/A` placeholders and removing repeated rows each show how many cells or rows change, with a before and after. Use **Add a step** to add "standardise dates" for the mixed date formats. Create the cleaned version and open it. |
| `03-employees-personal-data.csv` | The personal-data scan and access control | A warning naming **4 columns** (email, phone, IBAN, date of birth); "No personal data" fails, score **50**. Click **Sharing**, choose "Only people I choose", and sign in as an employee who isn't on the list: the file isn't there. |
| `04-inventory-v1.csv`, `04-inventory-v2.csv` | Version comparison, row by row | Upload v1, then on it click **Upload new version** and pick v2. Open **Versions → Compare**. In the section that lists the rows that changed, choose `sku` as the column that identifies a row: 6 rows added, 3 removed, 26 changed (23 in `on_hand`, 5 in `warehouse`), 51 unchanged. |
| `04-inventory-v3-columns-changed.csv` | A version whose columns changed | Upload it as a third version. The comparison reports that `reorder_level` was removed and `supplier` was added. |
| `05-support-tickets.csv` | Exploring and asking questions | Score **100**. Query builder: group by `category`, work out "Average of `resolution_hours`", sort highest first. With the AI assistant on, ask "Average resolution time by priority". |
| `06-quarterly-report-3-sheets.xlsx` | A workbook with several sheets | Score **100**. The report covers one sheet; you can choose which of the three (`Summary`, `Q3 Sales`, `Targets`). |
| `07-expenses-with-errors.xlsx` | Rules catching real mistakes | Score **25**: 2 repeated expense ids, 2 negative amounts and one of 98,000, and text ("ten", "n/a") where numbers belong. The report shows which rules failed and why. |
| `08-corrupt-workbook.xlsx` | A refused upload | Refused straight away: "The file content does not match any of them, whatever its name says." Nothing is stored. |

## A suggested order for a 10-minute demo

1. Sign in as an admin and add the rules above.
2. Upload `01`, `02`, `03` and `07` together (drag all four onto **Files**). Watch the scores arrive on their own.
3. Open `02` → **Clean** → create the cleaned version.
4. Open `03` → **Sharing**, restrict it, then show an employee's view.
5. Upload `04` v1, add v2 and v3, and open the comparison.
6. Explore `05`.
7. Drop `08` to show the refusal.

The files are created by a script, so the same names and numbers come out every time.
