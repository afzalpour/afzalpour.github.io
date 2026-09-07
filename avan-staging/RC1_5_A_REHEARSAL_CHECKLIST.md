# RC1.5-A Rehearsal Checklist

Before permanent migration:
- inspect existing composite keys for Company-scoped FK compatibility.
- create all Gate-A objects inside BEGIN/ROLLBACK.
- verify active-rule lookup by effective date.
- verify Company A cannot read Company B tax profiles under authenticated RLS context.
- verify legacy invoice lines remain valid with nullable tax snapshots.
- verify posted journal and invoice immutability triggers are unaffected.
- verify Ledger debit/credit baseline unchanged after rollback.
- verify public SECURITY DEFINER executable by authenticated remains zero.

Only after all checks PASS may the Gate-A migration be applied permanently.
