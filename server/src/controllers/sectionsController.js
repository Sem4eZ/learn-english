const db = require('../db/schema');

async function getSections(req, res) {
  try {
    const sections = await db.prepare(`
      SELECT 
        s.*, 
        COUNT(q.id) as question_count
      FROM sections s
      LEFT JOIN questions q ON s.id = q.section_id
      GROUP BY s.id
    `).all();

    res.json({ success: true, data: sections });
  } catch (err) {
    console.error('Error fetching sections:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getSections };
