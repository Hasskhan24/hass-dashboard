# Monthly Payroll Files

To add a new month's payroll, create a file named `YYYY-MM.js` in this directory.

The dashboard automatically picks the most recent month's payroll that is ≤ the current month.

## Template

Copy `2026-03.js` and update for the new month. The shape is:

```js
export default {
  month: '2026-05',
  monthLabel: 'May 2026',
  departments: {
    Internal: { total: 46167, headcount: 12, people: [{ name, amount }] },
    Production: { total: 31884, headcount: 30, people: [...] },
    Sales: { total: 28173, headcount: 7, people: [...] },
  },
  totalPayroll: 106224,
  headcount: 49,
}
```

## Workflow

1. Drop the new month's payroll PDF into `/Users/hassankhan/Desktop/Claude/hass-dashboard/server/payroll/source/` (any name)
2. Tell Claude to "parse the new payroll PDF" — Claude reads it and creates the new `YYYY-MM.js`
3. Commit and push — dashboard auto-picks it up

No code changes needed.
