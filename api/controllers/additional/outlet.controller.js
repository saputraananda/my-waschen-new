import { mainPool } from '../../db/pool.js';

export const getOutlets = async (req, res) => {
  try {
    const [rows] = await mainPool.query(
      'SELECT id, name, full_name, address FROM mst_outlet ORDER BY name ASC'
    );
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching outlets from mst_outlet:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data outlet dari database'
    });
  }
};
