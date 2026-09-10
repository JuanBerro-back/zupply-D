import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authRequired);

// Asegurar columnas de asignación de vehículo en usuarios
query(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(50);
`).catch(() => undefined);

router.get('/', roleRequired('admin', 'gerente', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let sql = `SELECT u.id, u.username, u.name, u.email, u.phone, u.is_active, u.last_login,
                      u.created_at, u.supplier_id, u.restaurant_id,
                      COALESCE(u.vehicle_type, 'moto') AS vehicle_type,
                      u.vehicle_plate,
                      r.name AS role_name, COALESCE(r.display_name, r.name) AS role_label, r.id AS role_id
               FROM users u
               JOIN roles r ON r.id = u.role_id
               WHERE 1=1`;

    if (user.role === 'proveedor_admin') {
      if (user.supplier_id) {
        params.push(user.supplier_id);
        // Proveedor es jefe del domiciliario: solo ve domiciliarios de su empresa
        sql += ` AND r.name = 'domiciliario' AND (u.supplier_id = $${params.length} OR u.supplier_id IS NULL)`;
      } else {
        sql += ` AND r.name = 'domiciliario'`;
      }
    } else if (user.role === 'gerente' || user.restaurant_id) {
      if (user.restaurant_id) {
        params.push(user.restaurant_id);
        // Gerente es jefe del empleado: solo ve empleados operativos de su restaurante
        sql += ` AND r.name = 'empleado' AND u.restaurant_id = $${params.length}`;
      } else {
        sql += ` AND r.name = 'empleado'`;
      }
    } else if (user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    sql += ` ORDER BY u.is_active DESC, u.created_at DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', roleRequired('admin', 'gerente', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { username, password, name, email, phone, role_id, vehicle_type, vehicle_plate } = req.body;
    if (!username || !password || !name || !role_id) {
      return res.status(400).json({ error: 'username, password, name y role_id son requeridos' });
    }

    const numericRoleId = Number(role_id);
    // Gerente solo crea empleado (id 3). Proveedor solo crea domiciliario (id 5).
    const allowedRoles = user.role === 'proveedor_admin'
      ? [5]
      : (user.role === 'gerente' || user.restaurant_id)
        ? [3]
        : [1, 2, 3, 4, 5];

    if (!allowedRoles.includes(numericRoleId)) {
      return res.status(403).json({ error: 'No tienes permisos para crear usuarios con ese rol' });
    }

    const exists = await query('SELECT id FROM users WHERE username = $1', [username.trim()]);
    if (exists.rowCount) return res.status(409).json({ error: 'El nombre de usuario ya existe' });

    const hash = await bcrypt.hash(String(password), 10);
    let restaurantId = user.restaurant_id;
    let supplierId = user.supplier_id;
    let branchId = user.branch_id;

    if (user.role === 'admin' && req.body.restaurant_id) {
      restaurantId = req.body.restaurant_id;
      branchId = req.body.branch_id ?? null;
    }
    if (user.role === 'admin' && req.body.supplier_id) {
      supplierId = req.body.supplier_id;
    }

    const result = await query(
      `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, supplier_id, branch_id, vehicle_type, vehicle_plate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, username, name, email, phone, role_id, restaurant_id, supplier_id, vehicle_type, vehicle_plate, is_active, created_at`,
      [username.trim(), hash, name.trim(), email ? email.trim() : null, phone ? phone.trim() : null, numericRoleId, restaurantId, supplierId, branchId, vehicle_type || 'moto', vehicle_plate || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', roleRequired('admin', 'gerente', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { name, email, phone, is_active, role_id, vehicle_type, vehicle_plate } = req.body;
    const target = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    const targetUser = target.rows[0];

    const isDomiciliario = targetUser.role_id === 5;
    const isEmpleado = targetUser.role_id === 3;

    if (user.role === 'proveedor_admin') {
      if (!isDomiciliario || (targetUser.supplier_id && targetUser.supplier_id !== user.supplier_id)) {
        return res.status(403).json({ error: 'Solo puedes gestionar domiciliarios de tu empresa' });
      }
    }
    if (user.role === 'gerente' || user.restaurant_id) {
      if (!isEmpleado || targetUser.restaurant_id !== user.restaurant_id) {
        return res.status(403).json({ error: 'Solo puedes gestionar empleados de tu restaurante' });
      }
    }

    const numericRoleId = role_id ? Number(role_id) : undefined;
    if (numericRoleId && numericRoleId !== targetUser.role_id) {
      const allowedRoles = user.role === 'proveedor_admin'
        ? [5]
        : (user.role === 'gerente' || user.restaurant_id)
          ? [3]
          : [1, 2, 3, 4, 5];
      if (!allowedRoles.includes(numericRoleId)) {
        return res.status(403).json({ error: 'No puedes asignar ese rol' });
      }
    }

    const result = await query(
      `UPDATE users
       SET name = COALESCE($2, name), email = COALESCE($3, email),
           phone = COALESCE($4, phone), is_active = COALESCE($5, is_active),
           role_id = COALESCE($6, role_id),
           vehicle_type = COALESCE($7, vehicle_type),
           vehicle_plate = COALESCE($8, vehicle_plate),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, username, name, email, phone, role_id, restaurant_id, supplier_id, vehicle_type, vehicle_plate, is_active, created_at`,
      [req.params.id, name, email, phone, is_active, numericRoleId, vehicle_type, vehicle_plate]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', roleRequired('admin', 'gerente', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const target = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    const targetUser = target.rows[0];

    const isDomiciliario = targetUser.role_id === 5;
    const isEmpleado = targetUser.role_id === 3;
    if (user.role === 'proveedor_admin') {
      if (!isDomiciliario || (targetUser.supplier_id && targetUser.supplier_id !== user.supplier_id)) {
        return res.status(403).json({ error: 'Solo puedes gestionar domiciliarios de tu empresa' });
      }
    }
    if (user.role === 'gerente' || user.restaurant_id) {
      if (!isEmpleado || targetUser.restaurant_id !== user.restaurant_id) {
        return res.status(403).json({ error: 'Solo puedes gestionar empleados de tu restaurante' });
      }
    }
    if (targetUser.id === user.id) {
      return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
    }
    await query('UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/password', roleRequired('admin', 'gerente', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { password } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const target = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    const targetUser = target.rows[0];

    const isDomiciliario = targetUser.role_id === 5;
    const isEmpleado = targetUser.role_id === 3;
    if (user.role === 'proveedor_admin') {
      if (!isDomiciliario || (targetUser.supplier_id && targetUser.supplier_id !== user.supplier_id)) {
        return res.status(403).json({ error: 'Solo puedes gestionar domiciliarios de tu empresa' });
      }
    }
    if (user.role === 'gerente' || user.restaurant_id) {
      if (!isEmpleado || targetUser.restaurant_id !== user.restaurant_id) {
        return res.status(403).json({ error: 'Solo puedes gestionar empleados de tu restaurante' });
      }
    }
    const hash = await bcrypt.hash(String(password), 10);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
