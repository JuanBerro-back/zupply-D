import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authRequired);

router.get('/', roleRequired('admin', 'gerente', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let sql = `SELECT u.id, u.username, u.name, u.email, u.phone, u.is_active, u.last_login,
                      u.created_at, r.name AS role_name, r.id AS role_id
               FROM users u
               JOIN roles r ON r.id = u.role_id
               WHERE 1=1`;
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      params.push(user.supplier_id);
      sql += ` AND u.supplier_id = $${params.length}`;
    } else if (user.restaurant_id) {
      params.push(user.restaurant_id);
      sql += ` AND u.restaurant_id = $${params.length}`;
    } else if (user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    sql += ' ORDER BY u.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', roleRequired('admin', 'gerente', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { username, password, name, email, phone, role_id } = req.body;
    if (!username || !password || !name || !role_id) {
      return res.status(400).json({ error: 'username, password, name y role_id son requeridos' });
    }
    const allowedRoles = user.role === 'proveedor_admin'
      ? [5]
      : user.restaurant_id
        ? [2, 3, 5]
        : [1, 2, 3, 4, 5];
    if (!allowedRoles.includes(role_id)) {
      return res.status(403).json({ error: 'No puedes crear usuarios con ese rol' });
    }
    const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rowCount) return res.status(409).json({ error: 'El usuario ya existe' });
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
      `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, supplier_id, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, username, name, email, phone, role_id, restaurant_id, supplier_id, is_active, created_at`,
      [username, hash, name, email ?? null, phone ?? null, role_id, restaurantId, supplierId, branchId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', roleRequired('admin', 'gerente', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { name, email, phone, is_active, role_id } = req.body;
    const target = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    const targetUser = target.rows[0];
    if (user.role === 'proveedor_admin' && targetUser.supplier_id !== user.supplier_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.restaurant_id && targetUser.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (role_id && role_id !== targetUser.role_id) {
      const allowedRoles = user.role === 'proveedor_admin'
        ? [5]
        : user.restaurant_id
          ? [2, 3, 5]
          : [1, 2, 3, 4, 5];
      if (!allowedRoles.includes(role_id)) {
        return res.status(403).json({ error: 'No puedes asignar ese rol' });
      }
    }
    const result = await query(
      `UPDATE users
       SET name = COALESCE($2, name), email = COALESCE($3, email),
           phone = COALESCE($4, phone), is_active = COALESCE($5, is_active),
           role_id = COALESCE($6, role_id), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, username, name, email, phone, role_id, restaurant_id, supplier_id, is_active, created_at`,
      [req.params.id, name, email, phone, is_active, role_id]
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
    if (user.role === 'proveedor_admin' && targetUser.supplier_id !== user.supplier_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.restaurant_id && targetUser.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({ error: 'No autorizado' });
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
    if (user.role === 'proveedor_admin' && targetUser.supplier_id !== user.supplier_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.restaurant_id && targetUser.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
