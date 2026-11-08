ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS requests_per_day integer;
ALTER TABLE public.entitlements ADD COLUMN IF NOT EXISTS requests_per_day integer;
UPDATE public.payments SET requests_per_day = 500 WHERE plan = 'pro' AND requests_per_day IS NULL;
UPDATE public.entitlements SET requests_per_day = 500 WHERE plan = 'pro' AND requests_per_day IS NULL;
ALTER TABLE public.payments DROP CONSTRAINT payments_plan_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_plan_check CHECK (plan IN ('starter','basic','pro','premium'));
ALTER TABLE public.entitlements DROP CONSTRAINT entitlements_plan_check;
ALTER TABLE public.entitlements ADD CONSTRAINT entitlements_plan_check CHECK (plan IN ('starter','basic','pro','premium'));
ALTER TABLE public.payments ADD CONSTRAINT payments_daily_allowance_check CHECK (requests_per_day > 0);
ALTER TABLE public.entitlements ADD CONSTRAINT entitlements_daily_allowance_check CHECK (requests_per_day > 0);
CREATE INDEX IF NOT EXISTS usage_user_created_idx ON public.usage_records(user_id, created_at);
REVOKE INSERT ON public.usage_records FROM authenticated;
GRANT SELECT ON public.usage_records TO authenticated;
GRANT ALL ON public.usage_records TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_ai_request(_user_id uuid, _kind text, _model text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowance integer := 50; daily_count integer; minute_count integer; usage_id uuid; boundary timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));
  boundary := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
  SELECT COALESCE(requests_per_day,50) INTO allowance FROM public.entitlements WHERE user_id=_user_id AND expires_at > now();
  allowance := COALESCE(allowance,50);
  SELECT count(*) FILTER (WHERE created_at >= boundary), count(*) FILTER (WHERE created_at >= now()-interval '1 minute') INTO daily_count,minute_count FROM public.usage_records WHERE user_id=_user_id AND created_at >= LEAST(boundary,now()-interval '1 minute');
  IF daily_count >= allowance THEN RETURN jsonb_build_object('ok',false,'reason',format('Daily limit of %s AI requests reached. Your allowance resets at midnight India time.',allowance)); END IF;
  IF minute_count >= 6 THEN RETURN jsonb_build_object('ok',false,'reason','Too many requests in a minute. Please wait a moment.'); END IF;
  INSERT INTO public.usage_records(user_id,kind,model,status) VALUES (_user_id,_kind,_model,'pending') RETURNING id INTO usage_id;
  RETURN jsonb_build_object('ok',true,'id',usage_id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_ai_request(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_request(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_verified_payment(_order_id text, _payment_id text, _via text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payments%ROWTYPE; start_at timestamptz; end_at timestamptz;
BEGIN
  SELECT * INTO p FROM public.payments WHERE razorpay_order_id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_order'; END IF;
  IF p.entitlement_applied_at IS NOT NULL THEN RETURN 'already_applied'; END IF;
  IF p.status = 'refunded' THEN RETURN 'refunded'; END IF;
  IF _via NOT IN ('checkout','webhook') OR p.requests_per_day IS NULL THEN RETURN 'invalid_order'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p.user_id::text,0));
  start_at := now();
  end_at := start_at + interval '30 days';
  INSERT INTO public.entitlements(user_id,plan,expires_at,requests_per_day,updated_at)
    VALUES (p.user_id,p.plan,end_at,p.requests_per_day,start_at)
    ON CONFLICT(user_id) DO UPDATE SET plan=EXCLUDED.plan,expires_at=EXCLUDED.expires_at,requests_per_day=EXCLUDED.requests_per_day,updated_at=EXCLUDED.updated_at;
  UPDATE public.payments SET status='paid',razorpay_payment_id=_payment_id,verified_via=_via,entitlement_applied_at=start_at,period_start=start_at,period_end=end_at,failure_reason=NULL,updated_at=start_at WHERE id=p.id;
  RETURN 'applied';
END $$;
REVOKE ALL ON FUNCTION public.apply_verified_payment(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.revoke_refunded_payment(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_refunded_payment(text) TO service_role;