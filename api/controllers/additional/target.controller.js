import { mainPool } from '../../db/pool.js';

/**
 * Controller untuk mengambil data target omset/revenue dari tabel mst_target_waschen
 * Berdasarkan outlet (login), tahun, dan bulan saat ini.
 */
export const getTargetRevenue = async (req, res) => {
  try {
    const { outlet, tahun, bulan } = req.query;
    const now = new Date();
    const currentYear = tahun ? parseInt(tahun) : now.getFullYear();
    const currentMonth = bulan ? parseInt(bulan) : (now.getMonth() + 1);
    const outletName = outlet ? outlet.trim() : '';

    let targetNominal = 0;

    if (outletName) {
      const [rows] = await mainPool.query(
        `SELECT nominal 
         FROM mst_target_waschen 
         WHERE (outlet = ? OR outlet LIKE ?) 
           AND tahun = ? 
           AND bulan = ? 
         LIMIT 1`,
        [outletName, `%${outletName}%`, currentYear, currentMonth]
      );

      if (rows && rows.length > 0) {
        targetNominal = rows[0].nominal;
      }
    }

    // Fallback default target jika outlet belum diatur di database
    if (!targetNominal || targetNominal === 0) {
      targetNominal = 50000000; // Default Rp 50.000.000
    }

    return res.json({
      success: true,
      data: {
        outlet: outletName,
        tahun: currentYear,
        bulan: currentMonth,
        targetNominal
      }
    });
  } catch (error) {
    console.error('Error fetching target revenue:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data target revenue',
      error: error.message
    });
  }
};
