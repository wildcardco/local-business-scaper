/**
 * Last created. Null n8n times sort last so a row with no created stamp
 * cannot sit above a dated one. LIMIT/OFFSET must run after this order.
 */
export const MOCKUP_CREATED_ORDER_SQL = 'n8n_created_at IS NULL, n8n_created_at DESC, id DESC'
