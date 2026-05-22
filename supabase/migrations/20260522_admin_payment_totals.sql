-- Admin payments dashboard: aggregation RPC + supporting indexes.
-- Run in Supabase SQL Editor.
--
-- Live cutoff: paiements considérés "réels" = created_at >= 2026-05-18.
-- Sandbox/onboarding antérieur exclu du solde et des totaux.

-- Drop previous signatures to avoid PostgREST ambiguity errors when the
-- function was created with a different argument list before.
drop function if exists admin_payment_totals();
drop function if exists admin_payment_totals(timestamptz);
drop function if exists admin_payment_totals(timestamptz, timestamptz);

create index if not exists idx_payments_status_completed_at
  on payments (status, completed_at desc);

create index if not exists idx_payments_completed_at
  on payments (completed_at desc);

create index if not exists idx_payments_created_at
  on payments (created_at desc);

create index if not exists idx_payouts_status_completed_at
  on payouts (status, completed_at desc);

create or replace function admin_payment_totals(
  live_since timestamptz default '2026-05-18T00:00:00Z',
  live_until timestamptz default null
)
returns table (
  total_collected   numeric,
  total_paid_out    numeric,
  available_balance numeric,
  payments_count    bigint,
  payouts_count     bigint,
  by_currency       jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select
      coalesce(currency, 'XOF') as currency,
      coalesce(sum(final_amount), 0)::numeric as sum_in,
      count(*)::bigint as n_in
    from payments
    where status = 'completed'
      and created_at >= live_since
      and (live_until is null or created_at < live_until)
    group by coalesce(currency, 'XOF')
  ),
  o as (
    select
      coalesce(currency, 'XOF') as currency,
      coalesce(sum(amount), 0)::numeric as sum_out,
      count(*)::bigint as n_out
    from payouts
    where status = 'completed'
      and created_at >= live_since
      and (live_until is null or created_at < live_until)
    group by coalesce(currency, 'XOF')
  ),
  merged as (
    select
      coalesce(p.currency, o.currency) as currency,
      coalesce(p.sum_in, 0) as sum_in,
      coalesce(o.sum_out, 0) as sum_out,
      coalesce(p.n_in, 0) as n_in,
      coalesce(o.n_out, 0) as n_out
    from p
    full outer join o on p.currency = o.currency
  )
  select
    coalesce(sum(sum_in), 0)::numeric                          as total_collected,
    coalesce(sum(sum_out), 0)::numeric                         as total_paid_out,
    (coalesce(sum(sum_in), 0) - coalesce(sum(sum_out), 0))::numeric as available_balance,
    coalesce(sum(n_in), 0)::bigint                             as payments_count,
    coalesce(sum(n_out), 0)::bigint                            as payouts_count,
    coalesce(
      jsonb_object_agg(
        currency,
        jsonb_build_object(
          'in',      sum_in,
          'out',     sum_out,
          'balance', sum_in - sum_out,
          'n_in',    n_in,
          'n_out',   n_out
        )
      ),
      '{}'::jsonb
    ) as by_currency
  from merged;
$$;

grant execute on function admin_payment_totals(timestamptz, timestamptz) to authenticated, service_role;

-- Force PostgREST schema cache reload so the new signature is callable
-- immediately via the REST API.
notify pgrst, 'reload schema';
