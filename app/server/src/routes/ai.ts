import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

const PLAN_SELECT: Record<string, { model: string; assistant: boolean; reports: boolean }> = {
  basico: { model: 'zupply-lite', assistant: true, reports: false },
  medio: { model: 'zupply-pro', assistant: true, reports: true },
  premium: { model: 'zupply-max', assistant: true, reports: true },
};

router.post('/chat', async (req, res) => {
  const { message, plan } = req.body as { message?: string; plan?: string };
  const cfg = PLAN_SELECT[plan ?? 'basico'] ?? PLAN_SELECT.basico;
  if (!message) return res.status(400).json({ error: 'message es requerido' });
  const lower = message.toLowerCase();
  let reply = `Hola, soy Zupply IA (${cfg.model}). Puedo ayudarte con pedidos, inventario, facturación y logística.`;
  if (lower.includes('inventario') || lower.includes('stock')) {
    reply =
      'Para gestionar inventario: revisa alertas de stock en el módulo de Inventario, o usa predicciones con Zupply IA Premium para recomendar pedidos de reposición.';
  } else if (lower.includes('pedido') || lower.includes('orden')) {
    reply =
      'Flujo de pedidos: crea el pedido desde el catálogo, el proveedor lo confirma, prepara, despacha y entrega. Los cambios se ven en tiempo real.';
  } else if (lower.includes('factura')) {
    reply =
      'Creo facturas electrónicas con IVA e impoconsumo desde el módulo de Facturación y las envío por correo (EmailJS). Puedes marcarlas como pagadas para contabilizarlas.';
  } else if (lower.includes('ruta') || lower.includes('entrega')) {
    reply =
      'Las entregas se gestionan en Logística: asigna vehículo y conductor, actualiza posiciones GPS y el estado llega hasta "entregado", lo que cierra el pedido.';
  } else if (lower.includes('premium') || lower.includes('plan')) {
    reply =
      'Planes Zupply: Básico (esencial), Medio (análisis y gestión avanzada) y Premium (predicción de inventario, reportes automatizados y asistencia inteligente).';
  }
  return res.json({ reply, model: cfg.model, plan: plan ?? 'basico' });
});

router.post('/predict-inventory', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'Solo restaurantes usan predicción de inventario' });
    const result = await query('SELECT * FROM v_inventory_predictions WHERE restaurant_id = $1 ORDER BY urgency DESC', [
      user.restaurant_id,
    ]);
    const summary = result.rows.map((r) => ({
      item: r.item_name,
      current_stock: r.current_stock,
      min_stock: r.min_stock,
      urgency: r.urgency,
      recommended_order_qty: r.recommended_order_qty,
      trend: r.trend,
    }));
    const high = summary.filter((r) => r.urgency === 'high').length;
    const recommendation = high > 0
      ? `Tienes ${high} ítem(s) con prioridad alta de reposición.`
      : 'Tu inventario está dentro de niveles aceptables.';
    res.json({ summary, recommendation });
  } catch (err) {
    next(err);
  }
});

router.post('/report', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { type } = req.body as { type?: string };
    if (!user.restaurant_id) return res.status(403).json({ error: 'Solo restaurantes generan reportes' });
    const orders = await query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(total), 0) AS revenue,
              COALESCE(AVG(total), 0) AS avg_order
       FROM orders WHERE restaurant_id = $1`,
      [user.restaurant_id]
    );
    const inventory = await query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN stock_status = 'critical' THEN 1 ELSE 0 END), 0)::int AS critical
       FROM inventory WHERE restaurant_id = $1`,
      [user.restaurant_id]
    );
    const typeLabel = type === 'monthly' ? 'mensual' : 'general';
    res.json({
      title: `Reporte ${typeLabel} Zupply IA`,
      generated_at: new Date().toISOString(),
      orders: orders.rows[0],
      inventory: inventory.rows[0],
      recommendation:
        'Resumen IA: monitorea los pedidos en curso y repón los ítems de inventario con urgencia alta.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;