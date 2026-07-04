const { transaction } = require('../../config/mysql');
const caregiverNotificationService = require('../../services/caregiverNotificationService');

const deleteRefill = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await transaction(async (tx) => {
      const refillRows = await tx.query(
        `SELECT r.*, m.quantity_remaining
         FROM refills r
         JOIN medications m ON m.id = r.medication_id
         WHERE r.id = ? AND r.user_id = ?
         LIMIT 1`,
        [id, userId]
      );
      const refill = refillRows?.[0] || null;
      if (!refill) return { notFound: true };

      const currentQuantity = refill.quantity_remaining || 0;
      const newQuantity = Math.max(0, currentQuantity - refill.quantity);

      await tx.execute('DELETE FROM refills WHERE id = ? AND user_id = ?', [id, userId]);
      await tx.execute(
        `UPDATE medications SET quantity_remaining = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`,
        [newQuantity, refill.medication_id, userId]
      );

      return { ok: true };
    });

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: 'Refill not found',
      });
    }

    res.json({
      success: true,
      message: 'Refill deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting refill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete refill',
      error: error.message,
    });
  }
};

module.exports = deleteRefill;

