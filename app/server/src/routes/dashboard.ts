import { Router } from 'express';
import { query } from '../config/db';
import { authRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

router.get('/summary', async (req, res, next) => {
  try {
    const user = req.user!;
    let where = '';
    const params: unknown[] = [];
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      params.push(user.supplier_id);
      where = ' WHERE supplier_id = $1';
    } else if (user.restaurant_id) {
      params.push(user.restaurant_id);
      where = ' WHERE restaurant_id = $1';
    }

    const orders = await query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN status = 'nuevo' THEN 1 ELSE 0 END), 0)::int AS nuevos,
              COALESCE(SUM(CASE WHEN status NOT IN ('entregado','cancelado') THEN 1 ELSE 0 END), 0)::int AS activos,
              COALESCE(SUM(total), 0) AS monto_total
       FROM orders${where}`,
      params
    );
    const products = await query(`SELECT COUNT(*)::int AS total FROM products${where}`, params);
    const recent = await query(
      `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       JOIN suppliers s ON s.id = o.supplier_id
       ${where}
       ORDER BY o.created_at DESC LIMIT 5`,
      params
    );
    res.json({ orders: orders.rows[0], products: products.rows[0].total, recent: recent.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/supplier-listing', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.is_active = TRUE) AS product_count,
              (SELECT COUNT(*) FROM orders o WHERE o.supplier_id = s.id) AS order_count
       FROM suppliers s
       WHERE s.is_active = TRUE
       ORDER BY s.rating DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;