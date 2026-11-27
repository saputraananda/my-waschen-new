import { myWaschenPool } from '../db/pool.js';
import { EFFECTIVE_SERVICE_COLUMNS, EFFECTIVE_UNIT_SQL, EFFECTIVE_CATEGORY_ID_SQL } from '../utils/serviceOutlet.js';

/**
 * Jumlah pemakaian tiap layanan di nota (untuk urutan katalog). Satu query GROUP BY,
 * disimpan di memori 30 menit — popularitas tidak perlu real-time.
 */
const USAGE_TTL_MS = 30 * 60 * 1000;
let usageCache = { at: 0, map: new Map(), pending: null };

async function getServiceUsageMap() {
  if (Date.now() - usageCache.at < USAGE_TTL_MS) return usageCache.map;
  if (!usageCache.pending) {
    usageCache.pending = myWaschenPool
      .query('SELECT service_id, COUNT(*) AS n FROM tr_transaction_detail WHERE service_id IS NOT NULL GROUP BY service_id')
      .then(([rows]) => {
        usageCache = { at: Date.now(), map: new Map(rows.map((r) => [Number(r.service_id), Number(r.n)])), pending: null };
        return usageCache.map;
      })
      .catch((err) => {
        console.error('Gagal menghitung popularitas layanan:', err.message);
        usageCache.pending = null;
        return usageCache.map; // tetap jalan dengan data lama / kosong
      });
  }
  return usageCache.pending;
}

/** Di dalam kelompok yang sama (unggulan, produksi, kategori), layanan paling sering dipakai di atas. */
function sortByPopularity(rows, usage) {
  const groupKey = (r) => `${Number(r.is_featured) || 0}|${Number(r.category_is_production ?? 1)}|${r.category_id ?? ''}`;
  const groupRank = new Map();
  rows.forEach((r, i) => { const k = groupKey(r); if (!groupRank.has(k)) groupRank.set(k, i); });
  rows.sort((a, b) => (
    groupRank.get(groupKey(a)) - groupRank.get(groupKey(b))
    || (usage.get(Number(b.id)) || 0) - (usage.get(Number(a.id)) || 0)
    || Number(a.id) - Number(b.id)
  ));
}

/**
 * GET /api/services?outlet_id=
 * Dengan outlet_id: layanan yang tersedia di outlet itu (mst_service_outlet), nilai efektif
 * = override outlet atau master. Tanpa outlet_id: master layanan aktif (mis. untuk BOM inventory).
 */
export const getServices = async (req, res) => {
  try {
    const { category, search } = req.query;
    const outletId = parseInt(req.query.outlet_id, 10) || null;

    // Mode halaman (katalog /services): hanya ambil satu halaman dari DB.
    if (req.query.page != null) return getServicesPaged(req, res, outletId);

    // Tanpa outlet: so = baris kosong, sehingga nilai efektif = master.
    let sql = `
      SELECT ${EFFECTIVE_SERVICE_COLUMNS},
             c.name as category_name,
             c.code as category_code,
             COALESCE(c.is_production, 1) as category_is_production,
             ${EFFECTIVE_UNIT_SQL} as unit,
             u.name as unit_name
      FROM mst_service s
      ${outletId
        ? 'JOIN mst_service_outlet so ON so.service_id = s.id AND so.outlet_id = ? AND so.is_active = 1'
        : 'LEFT JOIN mst_service_outlet so ON 1 = 0'}
      LEFT JOIN mst_service_category c ON c.id = ${EFFECTIVE_CATEGORY_ID_SQL}
      LEFT JOIN mst_unit u ON u.id = COALESCE(so.unit_id, s.unit_id)
      WHERE s.is_active = 1
    `;
    const params = outletId ? [outletId] : [];

    if (category && category !== 'Semua') {
      sql += ' AND (c.code = ? OR c.name LIKE ?)';
      params.push(category, `%${category}%`);
    }

    if (search && search.trim()) {
      sql += ' AND (COALESCE(so.name, s.name) LIKE ? OR s.code LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Urutan katalog: unggulan dulu → layanan cucian (kategori produksi) sebelum Biaya Tambahan
    // → per kategori sesuai urutan master → di dalam kategori, yang paling sering dipakai dulu.
    // Popularitas dihitung sekali (cache), bukan subquery per layanan (lambat di tabel detail besar).
    sql += ' ORDER BY s.is_featured DESC, COALESCE(c.is_production, 1) DESC, COALESCE(c.id, 999999) ASC, s.id ASC';

    const [[rows], usage] = await Promise.all([myWaschenPool.query(sql, params), getServiceUsageMap()]);
    sortByPopularity(rows, usage);
    // Kategori yang punya layanan di outlet ini (outlet tanpa layanan = tanpa kategori).
    const [categories] = outletId
      ? await myWaschenPool.query(
        `SELECT * FROM mst_service_category
         WHERE is_active = 1 AND id IN (
           SELECT DISTINCT ${EFFECTIVE_CATEGORY_ID_SQL}
           FROM mst_service_outlet so JOIN mst_service s ON s.id = so.service_id
           WHERE so.outlet_id = ? AND so.is_active = 1 AND s.is_active = 1)
         ORDER BY id ASC`,
        [outletId]
      )
      : await myWaschenPool.query('SELECT * FROM mst_service_category WHERE is_active = 1 ORDER BY id ASC');

    return res.status(200).json({
      success: true,
      data: rows,
      categories: categories
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar layanan',
      error: error.message
    });
  }
};

/**
 * GET /api/services?page=&limit=&category=&search=&outlet_id=
 * Katalog berhalaman: data satu halaman + total + jumlah per kategori (untuk chip filter).
 * Pencarian: nama, kode, deskripsi, nama kategori. category = kode kategori (mis. KILOAN).
 */
async function getServicesPaged(req, res, outletId) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
  const offset = (page - 1) * limit;
  const category = String(req.query.category || '').trim();
  const search = String(req.query.search || '').trim();

  const from = `
    FROM mst_service s
    ${outletId
      ? 'JOIN mst_service_outlet so ON so.service_id = s.id AND so.outlet_id = ? AND so.is_active = 1'
      : 'LEFT JOIN mst_service_outlet so ON 1 = 0'}
    LEFT JOIN mst_service_category c ON c.id = ${EFFECTIVE_CATEGORY_ID_SQL}`;
  const baseParams = outletId ? [outletId] : [];

  // Filter pencarian (dipakai juga untuk hitungan per kategori)
  let searchSql = '';
  const searchParams = [];
  if (search) {
    const like = `%${search}%`;
    searchSql = ' AND (COALESCE(so.name, s.name) LIKE ? OR s.code LIKE ? OR s.description LIKE ? OR c.name LIKE ?)';
    searchParams.push(like, like, like, like);
  }
  const categorySql = category && category !== 'Semua' ? ' AND c.code = ?' : '';
  const categoryParams = categorySql ? [category] : [];

  const where = `WHERE s.is_active = 1${searchSql}`;

  const [[rows], [[{ total }]], [countRows], [categories]] = await Promise.all([
    myWaschenPool.query(
      `SELECT ${EFFECTIVE_SERVICE_COLUMNS},
              c.name AS category_name, c.code AS category_code,
              COALESCE(c.is_production, 1) AS category_is_production,
              ${EFFECTIVE_UNIT_SQL} AS unit, u.name AS unit_name
       ${from}
       LEFT JOIN mst_unit u ON u.id = COALESCE(so.unit_id, s.unit_id)
       ${where}${categorySql}
       ORDER BY s.is_featured DESC, COALESCE(c.is_production, 1) DESC, COALESCE(c.id, 999999) ASC,
                COALESCE(so.name, s.name) ASC
       LIMIT ? OFFSET ?`,
      [...baseParams, ...searchParams, ...categoryParams, limit, offset]
    ),
    myWaschenPool.query(
      `SELECT COUNT(*) AS total ${from} ${where}${categorySql}`,
      [...baseParams, ...searchParams, ...categoryParams]
    ),
    myWaschenPool.query(
      `SELECT c.code AS code, COUNT(*) AS n ${from} ${where} GROUP BY c.code`,
      [...baseParams, ...searchParams]
    ),
    outletId
      ? myWaschenPool.query(
        `SELECT * FROM mst_service_category
         WHERE is_active = 1 AND id IN (
           SELECT DISTINCT ${EFFECTIVE_CATEGORY_ID_SQL}
           FROM mst_service_outlet so JOIN mst_service s ON s.id = so.service_id
           WHERE so.outlet_id = ? AND so.is_active = 1 AND s.is_active = 1)
         ORDER BY id ASC`,
        [outletId]
      )
      : myWaschenPool.query('SELECT * FROM mst_service_category WHERE is_active = 1 ORDER BY id ASC')
  ]);

  const counts = {};
  let all = 0;
  countRows.forEach((r) => {
    counts[r.code || 'UNKNOWN'] = Number(r.n) || 0;
    all += Number(r.n) || 0;
  });

  return res.status(200).json({
    success: true,
    data: rows,
    categories,
    meta: {
      page,
      limit,
      total: Number(total) || 0,
      totalPages: Math.max(1, Math.ceil((Number(total) || 0) / limit)),
      counts,
      countAll: all
    }
  });
}

/**
 * GET /api/services/speeds
 * Mengambil master kecepatan pengerjaan & persentase surcharge
 */
export const getServiceSpeeds = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query('SELECT * FROM mst_service_speed WHERE is_active = 1 ORDER BY id ASC');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching service speeds:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data kecepatan pengerjaan',
      error: error.message
    });
  }
};

/**
 * GET /api/services/parfumes?outlet_id=
 * Parfum aktif: umum (outlet_id NULL) + khusus outlet. Outlet yang punya parfum khusus
 * memakai mode parfum per item (meta.perItem), harga per item dari mst_parfume.price.
 */
export const getParfumes = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id, 10) || null;
    const [rows] = await myWaschenPool.query(
      `SELECT * FROM mst_parfume
       WHERE is_active = 1 AND (outlet_id IS NULL OR outlet_id = ?)
       ORDER BY (outlet_id IS NULL) DESC, sort_order ASC, id ASC`,
      [outletId || 0]
    );
    const perItem = Boolean(outletId) && rows.some((r) => Number(r.outlet_id) === outletId);
    return res.status(200).json({
      success: true,
      data: rows,
      meta: { perItem }
    });
  } catch (error) {
    console.error('Error fetching parfumes:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar parfum',
      error: error.message
    });
  }
};

/**
 * GET /api/services/units
 * Mengambil daftar master satuan (mst_unit)
 */
export const getUnits = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query('SELECT * FROM mst_unit WHERE is_active = 1 ORDER BY id ASC');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching units:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar satuan',
      error: error.message
    });
  }
};

/**
 * POST /api/services
 * Tambah item layanan baru
 */
export const createService = async (req, res) => {
  try {
    const { categoryId, unitId, code, name, price, regularDurationDays, minOrderQty, description, isFeatured } = req.body;

    if (!categoryId || !name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Kategori, Nama Layanan, dan Harga wajib diisi'
      });
    }

    const [result] = await myWaschenPool.query(
      `INSERT INTO mst_service 
       (category_id, unit_id, code, name, price, regular_duration_days, min_order_qty, description, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        unitId || 1,
        code || `SVC-${Date.now().toString().slice(-4)}`,
        name.trim(),
        parseFloat(price) || 0,
        parseFloat(regularDurationDays) || 2.0,
        parseFloat(minOrderQty) || 1,
        description || null,
        isFeatured ? 1 : 0
      ]
    );
    // Layanan baru langsung tersedia di semua outlet (termasuk outlet Drop Point).
    await myWaschenPool.query(
      `INSERT IGNORE INTO mst_service_outlet (service_id, outlet_id, is_active)
       SELECT ?, id, 1 FROM mst_outlet`,
      [result.insertId]
    );

    const [newService] = await myWaschenPool.query(
      `SELECT s.*, COALESCE(s.unit, u.symbol, u.code, 'Kg') as unit, u.name as unit_name
       FROM mst_service s
       LEFT JOIN mst_unit u ON s.unit_id = u.id
       WHERE s.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Layanan baru berhasil ditambahkan',
      data: newService[0]
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan layanan',
      error: error.message
    });
  }
};
