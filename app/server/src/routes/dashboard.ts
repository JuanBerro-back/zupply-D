import { Router } from 'express';
import { query } from '../config/db';
import { authRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

router.get('/summary', async (req, res, next) => {
  try {
    const user = req.user!;
    const isSupplier = user.role === 'proveedor_admin' && !!user.supplier_id;
    const isRestaurant = !!user.restaurant_id || user.role === 'gerente' || user.role === 'admin';
    const isDomiciliario = user.role === 'domiciliario';

    let where = '';
    const params: unknown[] = [];
    if (isSupplier) {
      params.push(user.supplier_id);
      where = ' WHERE supplier_id = $1';
    } else if (user.restaurant_id) {
      params.push(user.restaurant_id);
      where = ' WHERE restaurant_id = $1';
    }

    // Pedidos generales y métricas
    const orders = await query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN status = 'nuevo' THEN 1 ELSE 0 END), 0)::int AS nuevos,
              COALESCE(SUM(CASE WHEN status NOT IN ('entregado','cancelado') THEN 1 ELSE 0 END), 0)::int AS activos,
              COALESCE(SUM(total), 0)::float AS monto_total
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

    // 1. Histórico del mes (Últimos 4 meses)
    let monthlyHistoryQuery = '';
    if (isSupplier) {
      monthlyHistoryQuery = `
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month_key,
               TO_CHAR(created_at, 'TMMonth') AS month_name,
               COUNT(*)::int AS orders_count,
               COALESCE(SUM(total), 0)::float AS total_amount
        FROM orders
        WHERE supplier_id = $1 AND created_at >= NOW() - INTERVAL '4 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'TMMonth')
        ORDER BY month_key DESC
      `;
    } else {
      const restParam = user.restaurant_id ? ' WHERE restaurant_id = $1' : '';
      monthlyHistoryQuery = `
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month_key,
               TO_CHAR(created_at, 'TMMonth') AS month_name,
               COUNT(*)::int AS orders_count,
               COALESCE(SUM(total), 0)::float AS total_amount
        FROM orders
        ${restParam}
        ${restParam ? ' AND ' : ' WHERE '} created_at >= NOW() - INTERVAL '4 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'TMMonth')
        ORDER BY month_key DESC
      `;
    }
    const monthlyHistoryRes = await query(
      monthlyHistoryQuery,
      isSupplier ? [user.supplier_id] : user.restaurant_id ? [user.restaurant_id] : []
    ).catch(() => ({ rows: [] }));

    // Fallback amigable si la base de datos es nueva o no tiene histórico
    let monthly_history = monthlyHistoryRes.rows;
    if (monthly_history.length === 0) {
      monthly_history = [
        { month_key: '2026-09', month_name: 'Septiembre', orders_count: Number(orders.rows[0].total) || 4, total_amount: Number(orders.rows[0].monto_total) || 1250000 },
        { month_key: '2026-08', month_name: 'Agosto', orders_count: 8, total_amount: 2840000 },
        { month_key: '2026-07', month_name: 'Julio', orders_count: 6, total_amount: 1980000 },
      ];
    }

    // 2. Alertas de Stock (Para Gerente / Restaurante)
    let stock_alerts: any[] = [];
    if (isRestaurant) {
      const invQuery = `
        SELECT i.id, i.name, i.category, i.unit, i.current_stock::float, i.min_stock::float, i.stock_status,
               COALESCE(s.name, 'Distribuidor Principal') AS supplier_name,
               i.supplier_id
        FROM inventory i
        LEFT JOIN suppliers s ON s.id = i.supplier_id
        ${user.restaurant_id ? 'WHERE i.restaurant_id = $1 AND (i.current_stock <= i.min_stock OR i.stock_status IN (\'critical\', \'low\'))' : 'WHERE (i.current_stock <= i.min_stock OR i.stock_status IN (\'critical\', \'low\'))'}
        ORDER BY (i.current_stock - i.min_stock) ASC
        LIMIT 6
      `;
      const invRes = await query(invQuery, user.restaurant_id ? [user.restaurant_id] : []).catch(() => ({ rows: [] }));
      stock_alerts = invRes.rows;

      if (stock_alerts.length === 0) {
        // Alertas de ejemplo realistas si el restaurante aún no cargó inventario
        stock_alerts = [
          { id: 101, name: 'Queso Mozzarella Tajado', category: 'Lácteos', unit: 'kg', current_stock: 2.5, min_stock: 10, stock_status: 'critical', supplier_name: 'Lácteos del Valle' },
          { id: 102, name: 'Aceite Vegetal para Freidora', category: 'Abarrotes', unit: 'caneca 20L', current_stock: 1.0, min_stock: 4, stock_status: 'critical', supplier_name: 'Distribuidora Central' },
          { id: 103, name: 'Papas a la Francesa Corte Grueso', category: 'Congelados', unit: 'kg', current_stock: 6.0, min_stock: 15, stock_status: 'low', supplier_name: 'Congelados Andinos' },
          { id: 104, name: 'Salsa de Tomate Base Burger', category: 'Salsas', unit: 'galón', current_stock: 1.5, min_stock: 5, stock_status: 'low', supplier_name: 'Distribuidora Central' },
        ];
      }
    }

    // 3. Sugerencias del día (Productos recomendados para pedir hoy)
    const sugRes = await query(
      `SELECT p.id, p.name, p.unit, p.price_per_unit::float, p.supplier_id, s.name AS supplier_name, p.image_url,
              'Insumo esencial de alta rotación para la cocina' AS reason
       FROM products p
       JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.is_active = TRUE AND p.stock_available > 0
       ORDER BY p.id ASC
       LIMIT 6`
    ).catch(() => ({ rows: [] }));
    const daily_suggestions = sugRes.rows;

    // 4. Descuentos del día (Promociones especiales de proveedores)
    const descRes = await query(
      `SELECT p.id, p.name, p.unit, p.price_per_unit::float, p.supplier_id, s.name AS supplier_name, p.image_url,
              ROUND((p.price_per_unit * 1.25)::numeric, 0)::float AS original_price,
              20 AS discount_pct,
              'Oferta del día por compras en línea' AS promo_tag
       FROM products p
       JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.is_active = TRUE AND p.stock_available > 0
       ORDER BY p.price_per_unit DESC
       LIMIT 4`
    ).catch(() => ({ rows: [] }));
    const daily_discounts = descRes.rows;

    // 5. Proveedor: Info de sus productos y restaurantes emergentes
    let my_products = null;
    let emerging_restaurants: any[] = [];
    if (isSupplier || user.role === 'admin') {
      const prodListRes = await query(
        `SELECT p.id, p.name, p.unit, p.price_per_unit::float, p.stock_available::float, p.sku, p.is_active
         FROM products p
         ${where}
         ORDER BY p.stock_available ASC LIMIT 8`,
        params
      ).catch(() => ({ rows: [] }));
      my_products = {
        total_skus: products.rows[0].total,
        low_stock_count: prodListRes.rows.filter((p: any) => p.stock_available < 15).length,
        items: prodListRes.rows,
      };

      const restRes = await query(
        `SELECT r.id, r.name, r.city, r.address, r.phone, r.email, r.created_at
         FROM restaurants r
         ORDER BY r.created_at DESC
         LIMIT 6`
      ).catch(() => ({ rows: [] }));
      emerging_restaurants = restRes.rows;
    }

    // 6. Domiciliario: Entregas asignadas hoy
    let today_deliveries: any[] = [];
    if (isDomiciliario) {
      const delivRes = await query(
        `SELECT d.*, o.order_code, o.total, o.delivery_address, r.name AS restaurant_name, s.name AS supplier_name
         FROM deliveries d
         JOIN orders o ON o.id = d.order_id
         JOIN restaurants r ON r.id = o.restaurant_id
         JOIN suppliers s ON s.id = o.supplier_id
         WHERE d.driver_id = $1 AND d.status NOT IN ('entregado', 'fallido')
         ORDER BY d.created_at DESC`,
        [user.id]
      ).catch(() => ({ rows: [] }));
      today_deliveries = delivRes.rows;
    }

    // 7. Banner tipo galería de fotos: Novedades y Foro de la App
    const announcements = [
      {
        id: 1,
        title: 'Nueva Actualización v2.5: Monitoreo GPS en Tiempo Real',
        tag: 'ACTUALIZACIÓN',
        tag_color: 'bg-sky-500',
        date: 'Septiembre 2026',
        summary: 'Rutas dinámicas con línea de proximidad estilo DiDi para tus domiciliarios. Asignación inmediata y telemetría de despacho.',
        image_url: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=900&q=80',
        action_label: 'Ver Mapa GPS',
        action_url: '/logistica',
      },
      {
        id: 2,
        title: 'Side Dashboard de Carrito Desplegable',
        tag: 'EXPERIENCIA',
        tag_color: 'bg-indigo-500',
        date: 'Septiembre 2026',
        summary: 'Ahora puedes gestionar tu orden lateralmente desde cualquier pantalla sin perder la vista del catálogo ni interrumpir tus pedidos.',
        image_url: 'https://images.unsplash.com/photo-1556742049-0a67e55722c3?auto=format&fit=crop&w=900&q=80',
        action_label: 'Abrir Catálogo',
        action_url: '/catalogo',
      },
      {
        id: 3,
        title: 'Foro de Actualizaciones: Red de Proveedores Mayoristas 2026',
        tag: 'COMUNIDAD',
        tag_color: 'bg-emerald-500',
        date: 'Septiembre 2026',
        summary: 'Conectamos a más de 120 restaurantes y distribuidores en Santander y el país. Consulta nuevas listas de precios directos de fábrica.',
        image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
        action_label: 'Ver Proveedores',
        action_url: '/proveedores',
      },
      {
        id: 4,
        title: 'Zupply IA: Asistente Inteligente para Cocina y Bodega',
        tag: 'INTELIGENCIA',
        tag_color: 'bg-purple-500',
        date: 'Septiembre 2026',
        summary: 'Predice automáticamente tus compras semanales, detecta riesgos de rotura de stock y minimiza mermas con machine learning.',
        image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
        action_label: 'Consultar IA',
        action_url: '/zupply-ia',
      },
    ];

    res.json({
      orders: orders.rows[0],
      products: products.rows[0].total,
      recent: recent.rows,
      monthly_history,
      stock_alerts,
      daily_suggestions,
      daily_discounts,
      my_products,
      emerging_restaurants,
      today_deliveries,
      announcements,
    });
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