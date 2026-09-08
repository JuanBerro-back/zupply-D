import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { emitOrder, emitToUser } from '../lib/realtime';

const router = Router();
router.use(authRequired);

function deliverySelect() {
  return `SELECT d.*, o.order_code, o.total AS order_total, o.notes AS order_notes,
                 r.name AS restaurant_name, r.phone AS restaurant_phone,
                 r.address AS restaurant_address,
                 v.name AS vehicle_name, v.plate, v.type AS vehicle_type,
                 v.current_lat AS vehicle_lat, v.current_lng AS vehicle_lng,
                 v.last_location_update, v.imei, v.gps_validated, v.gps_last_seen,
                 u.name AS driver_name, u.phone AS driver_phone,
                 s.name AS supplier_name, s.phone AS supplier_phone
          FROM deliveries d
          JOIN orders o ON o.id = d.order_id
          JOIN restaurants r ON r.id = d.restaurant_id
          JOIN suppliers s ON s.id = o.supplier_id
          LEFT JOIN vehicles v ON v.id = d.vehicle_id
          LEFT JOIN users u ON u.id = d.driver_id`;
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let sql = `${deliverySelect()} WHERE 1=1`;
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      params.push(user.supplier_id);
      sql += ` AND o.supplier_id = $${params.length}`;
    } else if (user.role === 'domiciliario') {
      params.push(user.id);
      sql += ` AND d.driver_id = $${params.length}`;
    } else if (user.restaurant_id) {
      params.push(user.restaurant_id);
      sql += ` AND d.restaurant_id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND d.status = $${params.length}`;
    }
    sql += ' ORDER BY d.created_at DESC LIMIT 100';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/my-deliveries', roleRequired('domiciliario'), async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(
      `${deliverySelect()}
       WHERE d.driver_id = $1
       ORDER BY d.created_at DESC LIMIT 50`,
      [user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/vehicles', roleRequired('proveedor_admin', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query('SELECT * FROM vehicles WHERE supplier_id = $1 AND is_active = TRUE ORDER BY name', [
      user.supplier_id,
    ]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(`${deliverySelect()} WHERE d.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const delivery = result.rows[0];
    if (user.role === 'domiciliario' && delivery.driver_id !== user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      const order = await query('SELECT supplier_id FROM orders WHERE id = $1', [delivery.order_id]);
      if (order.rowCount && order.rows[0].supplier_id !== user.supplier_id) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }
    const items = await query('SELECT * FROM delivery_items WHERE delivery_id = $1', [req.params.id]);
    const orderItems = await query('SELECT * FROM order_items WHERE order_id = $1', [delivery.order_id]);
    res.json({ ...delivery, items: items.rows, order_items: orderItems.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', roleRequired('proveedor_admin', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.supplier_id) return res.status(403).json({ error: 'Solo proveedores crean entregas' });
    const { order_id, vehicle_id, driver_id, delivery_address, scheduled_time, notes, items } = req.body;
    const order = await query(
      'SELECT * FROM orders WHERE id = $1 AND supplier_id = $2',
      [order_id, user.supplier_id]
    );
    if (!order.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    const code = `DEL-${Date.now().toString(36).toUpperCase()}`;
    const confirmationCode = String(Math.floor(1000 + Math.random() * 9000));
    const result = await query(
      `INSERT INTO deliveries (delivery_code, order_id, vehicle_id, driver_id, restaurant_id,
         delivery_address, scheduled_time, notes, confirmation_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [code, order_id, vehicle_id, driver_id, order.rows[0].restaurant_id,
       delivery_address ?? order.rows[0].delivery_address, scheduled_time, notes, confirmationCode]
    );
    if (Array.isArray(items)) {
      for (const it of items) {
        await query(
          `INSERT INTO delivery_items (delivery_id, product_name, quantity, unit) VALUES ($1, $2, $3, $4)`,
          [result.rows[0].id, it.product_name, it.quantity, it.unit]
        );
      }
    }
    if (driver_id) {
      emitToUser('notification:created', driver_id, {
        message: `Se te asignó la entrega ${code} del pedido ${order.rows[0].order_code}`,
        delivery_id: result.rows[0].id,
      });
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/assign', roleRequired('proveedor_admin', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { driver_id } = req.body;
    if (!driver_id) return res.status(400).json({ error: 'driver_id es requerido' });
    const delivery = await query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (user.supplier_id) {
      const order = await query('SELECT supplier_id FROM orders WHERE id = $1', [del.order_id]);
      if (order.rowCount && order.rows[0].supplier_id !== user.supplier_id) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }
    const driver = await query(
      `SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [driver_id]
    );
    if (!driver.rowCount || driver.rows[0].role_name !== 'domiciliario') {
      return res.status(400).json({ error: 'El usuario debe ser un domiciliario activo' });
    }
    const confirmationCode = String(Math.floor(1000 + Math.random() * 9000));
    const result = await query(
      `UPDATE deliveries SET driver_id = $1, confirmation_code = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [driver_id, confirmationCode, req.params.id]
    );
    emitToUser('notification:created', driver_id, {
      message: `Se te asignó la entrega ${del.delivery_code}`,
      delivery_id: del.id,
      confirmation_code: confirmationCode,
    });
    const order = await query('SELECT order_code FROM orders WHERE id = $1', [del.order_id]);
    emitToUser('notification:created', del.driver_id ?? 0, {
      message: `Entrega ${del.delivery_code} asignada a ${driver.rows[0].name}`,
    });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const user = req.user!;
    const { status } = req.body;
    const valid = ['asignado', 'en_camino', 'llegando', 'entregado', 'fallido'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Estado de entrega inválido' });
    const delivery = await query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (user.role === 'domiciliario' && del.driver_id !== user.id) {
      return res.status(403).json({ error: 'Solo puedes actualizar tus propias entregas' });
    }
    if (user.role === 'domiciliario' && !['en_camino', 'llegando', 'entregado'].includes(status)) {
      return res.status(403).json({ error: 'El domiciliario solo puede cambiar a en_camino, llegando o entregado' });
    }
    if (status === 'entregado' && user.role === 'domiciliario') {
      return res.status(400).json({ error: 'Usa POST /:id/confirm con el código de confirmación para entregar' });
    }
    const deliveredSql = status === 'entregado' ? ', actual_delivery_time = CURRENT_TIMESTAMP' : '';
    const result = await query(
      `UPDATE deliveries SET status = $1, updated_at = CURRENT_TIMESTAMP${deliveredSql} WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (status === 'entregado') {
      await query("UPDATE orders SET status = 'entregado', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [del.order_id]);
      const updated = await query(
        `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
         WHERE o.id = $1`,
        [del.order_id]
      );
      emitOrder('order:updated', updated.rows[0]);
    }
    emitOrder('delivery:status', { delivery_id: del.id, status, delivery_code: del.delivery_code });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/confirm', roleRequired('domiciliario'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { confirmation_code } = req.body;
    if (!confirmation_code) return res.status(400).json({ error: 'confirmation_code es requerido' });
    const delivery = await query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (del.driver_id !== user.id) {
      return res.status(403).json({ error: 'Esta entrega no está asignada a ti' });
    }
    if (del.status === 'entregado') {
      return res.status(400).json({ error: 'Esta entrega ya fue confirmada' });
    }
    if (del.confirmation_code !== String(confirmation_code)) {
      return res.status(401).json({ error: 'Código de confirmación incorrecto' });
    }
    const result = await query(
      `UPDATE deliveries SET status = 'entregado', actual_delivery_time = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await query(
      `UPDATE orders SET status = 'entregado', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [del.order_id]
    );
    const order = await query(
      `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
       FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
       WHERE o.id = $1`,
      [del.order_id]
    );
    if (order.rowCount) emitOrder('order:updated', order.rows[0]);
    emitOrder('delivery:status', { delivery_id: del.id, status: 'entregado', delivery_code: del.delivery_code });
    res.json({ message: 'Entrega confirmada exitosamente', delivery: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/position', async (req, res, next) => {
  try {
    const user = req.user!;
    const { lat, lng, speed } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'lat y lng requeridos' });
    }
    const delivery = await query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (user.role === 'domiciliario' && del.driver_id !== user.id) {
      return res.status(403).json({ error: 'Solo puedes actualizar tu posición en tus entregas' });
    }
    if (del.vehicle_id) {
      await query(
        `UPDATE vehicles SET current_lat = $1, current_lng = $2, last_location_update = CURRENT_TIMESTAMP,
          gps_last_seen = CURRENT_TIMESTAMP WHERE id = $3`,
        [lat, lng, del.vehicle_id]
      );
    }
    if (del.driver_id) {
      emitOrder('delivery:position', {
        delivery_id: del.id,
        lat,
        lng,
        speed: speed ?? null,
        driver_name: user.username,
      });
    }
    await query(
      `INSERT INTO route_history (vehicle_id, delivery_id, lat, lng, speed)
       VALUES ($1, $2, $3, $4, $5)`,
      [del.vehicle_id, req.params.id, lat, lng, speed ?? null]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/vehicles', roleRequired('proveedor_admin', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { name, plate, type, driver_name, imei } = req.body;
    const result = await query(
      `INSERT INTO vehicles (supplier_id, name, plate, type, driver_name, imei, gps_validated)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user.supplier_id, name, plate, type ?? 'moto', driver_name, imei || null, Boolean(imei)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/vehicles/:id/gps', roleRequired('proveedor_admin', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { imei, gps_validated } = req.body;
    const result = await query(
      `UPDATE vehicles SET imei = $1, gps_validated = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND supplier_id = $4 RETURNING *`,
      [imei || null, Boolean(gps_validated), req.params.id, user.supplier_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
