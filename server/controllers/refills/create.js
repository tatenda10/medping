const prisma = require('../../config/database');
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

    // Verify medication belongs to user
    const medication = await prisma.medication.findFirst({
      where: {
        id: medication_id,
        user_id: userId,
      },
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    // Create refill
    const refill = await prisma.refill.create({
      data: {
        user_id: userId,
        medication_id,
        quantity: parseInt(quantity),
        refill_date: new Date(refill_date),
        notes: notes || null,
      },
    });

    // Auto-update quantity_remaining
    const currentQuantity = medication.quantity_remaining || 0;
    const newQuantity = currentQuantity + parseInt(quantity);

    const updatedMedication = await prisma.medication.update({
      where: { id: medication_id },
      data: { quantity_remaining: newQuantity },
    });

    // Check for low stock and notify caregivers
    const lowStockThreshold = updatedMedication.low_stock_threshold || 7;
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

