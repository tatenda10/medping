const prisma = require('../../config/database');
const caregiverNotificationService = require('../../services/caregiverNotificationService');

const deleteRefill = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

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

    // Calculate quantity to subtract
    const currentQuantity = refill.medication.quantity_remaining || 0;
    const newQuantity = Math.max(0, currentQuantity - refill.quantity);

    // Delete refill
    await prisma.refill.delete({
      where: { id },
    });

    // Update medication quantity
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

