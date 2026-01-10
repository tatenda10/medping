const prisma = require('../../config/database');
const caregiverNotificationService = require('../../services/caregiverNotificationService');

const updateRefill = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity, refill_date, notes } = req.body;

    // Find refill and verify ownership
    const refill = await prisma.refill.findFirst({
      where: {
        id,
        user_id: userId,
      },
      include: {
        medication: true,
      },
    });

    if (!refill) {
      return res.status(404).json({
        success: false,
        message: 'Refill not found',
      });
    }

    // Calculate quantity difference if quantity changed
    let quantityDiff = 0;
    if (quantity !== undefined && quantity !== refill.quantity) {
      quantityDiff = parseInt(quantity) - refill.quantity;
    }

    // Update refill
    const updatedRefill = await prisma.refill.update({
      where: { id },
      data: {
        quantity: quantity !== undefined ? parseInt(quantity) : refill.quantity,
        refill_date: refill_date ? new Date(refill_date) : refill.refill_date,
        notes: notes !== undefined ? notes : refill.notes,
      },
    });

    // Update medication quantity if quantity changed
    if (quantityDiff !== 0) {
      const currentQuantity = refill.medication.quantity_remaining || 0;
      const newQuantity = Math.max(0, currentQuantity + quantityDiff);

      const updatedMedication = await prisma.medication.update({
        where: { id: refill.medication_id },
        data: { quantity_remaining: newQuantity },
      });

      // Check for low stock and notify caregivers
      const lowStockThreshold = updatedMedication.low_stock_threshold || 7;
      if (newQuantity <= lowStockThreshold) {
        caregiverNotificationService.notifyLowStock(userId, refill.medication_id)
          .catch(err => console.error('Error notifying caregivers:', err));
      }
    }

    res.json({
      success: true,
      message: 'Refill updated successfully',
      refill: updatedRefill,
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

