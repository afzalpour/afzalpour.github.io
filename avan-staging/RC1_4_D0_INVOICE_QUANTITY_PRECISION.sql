-- Avan RC1.4-D0 Invoice quantity precision widening
-- STATUS: NOT APPLIED TO PRODUCTION.
-- Widening numeric(20,3) -> numeric(20,6) is lossless for all existing rows.
-- Required before RC1.4-D1 restores exact item quantities from the stock-aware draft wrapper.

alter table public.invoice_lines
  alter column quantity type numeric(20,6)
  using quantity::numeric(20,6);

-- Keep the existing positive-quantity invariant; PostgreSQL retains the existing CHECK.
