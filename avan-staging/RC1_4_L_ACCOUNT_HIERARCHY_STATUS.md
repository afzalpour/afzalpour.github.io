# RC1.4-L — Inventory + Four-Level Accounts

Status: **Backend PASS / Staging code ready for Live Gate**

## User feedback addressed

1. Inventory Draft save now has a second deterministic UI path: the save click is intercepted before the legacy submit handler, saved once through `save_inventory_draft`, then the app reloads and returns to Inventory > Documents with a success notice.
2. Inventory quantity and unit-cost fields now have document-level input listeners so three-digit grouping also works for dynamically added rows. Values are normalized before RPC submission.
3. Account hierarchy is now four levels:
   - Level 1: کل
   - Level 2: معین
   - Level 3: تفصیلی ۱
   - Level 4: تفصیلی ۲
4. Leaf-only posting is enforced by the database. A postable account cannot have active children.
5. A Level-3 account cannot be converted into a parent if it is a system operational account, has Journal activity, has an Account Role, or is linked to a Financial Account.
6. New detail account codes are generated automatically with scalable three-digit sibling suffixes.
7. Account writes are restricted by RLS to owner / manager / accountant. Reads remain Company-scoped.

## Standard examples provisioned in every existing Company and future Company

### Asset example
`دارایی‌ها → دارایی‌های ثابت مشهود → وسایل نقلیه (نمونه) → خودروی اداری نمونه`

### Expense example
`هزینه‌ها → هزینه‌های حقوق و مزایا → حقوق کارکنان اداری (نمونه) → پرسنل نمونه`

The Level-3 example becomes non-postable because it has a Level-4 child; the Level-4 example is postable.

## Server verification

- 6 Companies each have 2 Level-3 samples and 2 Level-4 samples.
- Level-4 non-postable accounts: 0.
- Postable accounts with active children: 0.
- Accountant-role account creation rehearsal: PASS and rolled back.
- Unauthorized authenticated write rehearsal: BLOCKED and rolled back.
- Inventory `save_inventory_draft` rehearsal with quantity 1000 and unit cost 125000: PASS and rolled back.
- Permanent Inventory Documents after rehearsal: 0.
- Ledger debit = credit = 201,581,351.
- Public SECURITY DEFINER executable by authenticated = 0.
- Supabase Security Advisor: no new RC1.4 warning; only existing Leaked Password Protection WARN plus intentional RLS-no-policy INFO boundaries.

## Staging

Target cache: `avan-staging-rc1-v53`.
Production root frontend is unchanged.
