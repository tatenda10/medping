const { transaction } = require('../../config/mysql');
const caregiverNotificationService = require('../../services/caregiverNotificationService');

const updateRefill = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity, refill_date, notes } = req.body;

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

      const newQty = quantity !== undefined ? parseInt(quantity, 10) : refill.quantity;
      const newRefillDate = refill_date ? new Date(refill_date) : refill.refill_date;
      const newNotes = notes !== undefined ? notes : refill.notes;

      const quantityDiff = newQty - refill.quantity;

      await tx.execute(
        `UPDATE refills SET quantity = ?, refill_date = ?, notes = ? WHERE id = ? AND user_id = ?`,
        [newQty, newRefillDate, newNotes, id, userId]
      );

      if (quantityDiff !== 0) {
        const currentQuantity = refill.quantity_remaining || 0;
        const updatedQuantity = Math.max(0, currentQuantity + quantityDiff);
        await tx.execute(
          `UPDATE medications SET quantity_remaining = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`,
          [updatedQuantity, refill.medication_id, userId]
        );
      }

      const updatedRows = await tx.query('SELECT * FROM refills WHERE id = ? LIMIT 1', [id]);
      return { updatedRefill: updatedRows?.[0] || null };
    });

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: 'Refill not found',
      });
    }

    res.json({
      success: true,
      message: 'Refill updated successfully',
      refill: result.updatedRefill,
    });
  } catch (error) {
    console.error('Error updating refill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update refill',
      error: error.message,
    });
  }
};

module.exports = updateRefill;

