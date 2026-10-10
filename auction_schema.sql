-- 1. 거래소 거래 내역 테이블
CREATE TABLE IF NOT EXISTS public.auction_transactions (
    id bigint PRIMARY KEY,
    price bigint NOT NULL,
    transaction_date timestamp with time zone NOT NULL,
    item_type text NOT NULL,
    enhancement_level integer,
    enchants jsonb,
    item_info jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. 거래소 이상 거래 내역 테이블
CREATE TABLE IF NOT EXISTS public.auction_anomalies (
    id bigint PRIMARY KEY,
    item_type text NOT NULL,
    item_name text NOT NULL,
    price bigint NOT NULL,
    avg_price bigint NOT NULL,
    diff_percent double precision NOT NULL,
    transaction_date timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. 거래소 평균가 계산 뷰 (View)
-- 아이템 타입, 표시 이름, 그리고 확률 보너스(lore)를 기준으로 그룹화하여 갯수 비례 평균 단가를 산출합니다.
CREATE OR REPLACE VIEW public.auction_average_prices AS
SELECT 
    item_type,
    (item_info ->> 'displayName'::text) AS display_name,
    (avg(((price)::numeric / (GREATEST(COALESCE(((item_info ->> 'amount'::text))::integer, 1), 1))::numeric)))::bigint AS avg_price,
    count(*) AS tx_count,
    (
        SELECT substring(l FROM '확률 보너스:\s*([\d.]+)%')
        FROM jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(item_info->'lore') = 'array' THEN item_info->'lore' 
                ELSE '[]'::jsonb 
            END
        ) AS l
        WHERE l LIKE '%확률 보너스%'
        LIMIT 1
    ) AS probability
FROM auction_transactions
GROUP BY 
    item_type,
    (item_info ->> 'displayName'::text),
    (
        SELECT substring(l FROM '확률 보너스:\s*([\d.]+)%')
        FROM jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(item_info->'lore') = 'array' THEN item_info->'lore' 
                ELSE '[]'::jsonb 
            END
        ) AS l
        WHERE l LIKE '%확률 보너스%'
        LIMIT 1
    );
