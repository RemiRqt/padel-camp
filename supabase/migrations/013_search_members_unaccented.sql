-- ============================================
-- 013_search_members_unaccented
-- ============================================
-- Recherche de membres insensible aux accents et à la casse.
-- "Remi" matche "Rémi", "Chloe" matche "Chloé", etc.
-- Inclut balance + balance_bonus pour affichage du solde.
-- ============================================

CREATE OR REPLACE FUNCTION search_members_unaccented(
    p_query TEXT,
    p_limit INT DEFAULT 5,
    p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    balance NUMERIC,
    balance_bonus NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    accents_in  TEXT := 'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ';
    accents_out TEXT := 'eeeeaaaiioouuucEEEEAAAIIOOUUUC';
    q TEXT;
BEGIN
    q := LOWER(translate(COALESCE(p_query, ''), accents_in, accents_out));

    IF length(q) < 2 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT p.id, p.display_name, p.email, p.avatar_url, p.balance, p.balance_bonus
    FROM profiles p
    WHERE p.role != 'admin'
      AND (p_exclude_id IS NULL OR p.id != p_exclude_id)
      AND LOWER(translate(p.display_name, accents_in, accents_out)) LIKE '%' || q || '%'
    ORDER BY p.display_name
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_members_unaccented(TEXT, INT, UUID) TO authenticated, anon;
