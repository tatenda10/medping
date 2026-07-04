const { query, transaction } = require('../../config/mysql');
const caregiverNotificationService = require('../../services/caregiverNotificationService');

const createRefill = async (req, res) => {
  try {
    const userId = req.user.id;
    const { medication_id, quantity, refill_date, notes } = req.body;

    // Validation
    if (!medication_id || !quantity || !refill_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: medication_id, quantity, refill_date',
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0',
      });
    }

    const qty = parseInt(quantity, 10);

    const result = await transaction(async (tx) => {
      // Verify medication belongs to user
      const medicationRows = await tx.query(
        'SELECT id, quantity_remaining, low_stock_threshold FROM medications WHERE id = ? AND user_id = ? LIMIT 1',
        [medication_id, userId]
      );
      const medication = medicationRows?.[0] || null;
      if (!medication) {
        return { notFound: true };
      }

      const idRows = await tx.query('SELECT UUID() as id');
      const refillId = idRows?.[0]?.id;

      await tx.execute(
        `INSERT INTO refills (id, user_id, medication_id, quantity, refill_date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [refillId, userId, medication_id, qty, new Date(refill_date), notes || null]
      );

      const currentQuantity = medication.quantity_remaining || 0;
      const newQuantity = currentQuantity + qty;

      await tx.execute(
        `UPDATE medications SET quantity_remaining = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`,
        [newQuantity, medication_id, userId]
      );

      const refillRows = await tx.query('SELECT * FROM refills WHERE id = ? LIMIT 1', [refillId]);
      const refill = refillRows?.[0] || null;

      return { refill, newQuantity, lowStockThreshold: medication.low_stock_threshold || 7 };
    });

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    const refill = result.refill;
    const newQuantity = result.newQuantity;
    const lowStockThreshold = result.lowStockThreshold;

    if (newQuantity <= lowStockThreshold) {
      caregiverNotificationService.notifyLowStock(userId, medication_id)
        .catch(err => console.error('Error notifying caregivers:', err));
    }

    res.status(201).json({
      success: true,
      message: 'Refill created successfully',
      refill,
      updated_quantity: newQuantity,
    });
  } catch (error) {
    console.error('Error creating refill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create refill',
      error: error.message,
    });
  }
};

module.exports = createRefill;

