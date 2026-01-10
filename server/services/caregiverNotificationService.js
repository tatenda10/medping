const prisma = require('../config/database');

class CaregiverNotificationService {
  /**
   * Notify caregivers when care recipient misses a dose
   */
  async notifyMissedDose(careRecipientId, medicationId, scheduledTime) {
    try {
      // Get all accepted caregiver relationships
      const relationships = await prisma.caregiverRelationship.findMany({
        where: {
          care_recipient_id: careRecipientId,
          status: 'accepted',
        },
        include: {
          caregiver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          care_recipient: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (relationships.length === 0) return;

      // Get medication details
      const medication = await prisma.medication.findFirst({
        where: { id: medicationId },
      });

      if (!medication) return;

      const careRecipientName = relationships[0].care_recipient.name || relationships[0].care_recipient.email;

      // Create notifications for all caregivers
      const notifications = relationships.map(rel => ({
        user_id: rel.caregiver_id,
        type: 'caregiver_alert',
        title: 'Missed Dose Alert',
        message: `${careRecipientName} missed their ${medication.name} dose at ${new Date(scheduledTime).toLocaleTimeString()}`,
        data: {
          care_recipient_id: careRecipientId,
          care_recipient_name: careRecipientName,
          medication_id: medicationId,
          medication_name: medication.name,
          scheduled_time: scheduledTime,
          alert_type: 'missed_dose',
        },
      }));

      await prisma.notification.createMany({
        data: notifications,
      });

      console.log(`✅ Notified ${notifications.length} caregiver(s) about missed dose`);
    } catch (error) {
      console.error('Error notifying caregivers about missed dose:', error);
    }
  }

  /**
   * Notify caregivers when care recipient's medication is low stock
   */
  async notifyLowStock(careRecipientId, medicationId) {
    try {
      const relationships = await prisma.caregiverRelationship.findMany({
        where: {
          care_recipient_id: careRecipientId,
          status: 'accepted',
        },
        include: {
          caregiver: {
            select: {
              id: true,
            },
          },
          care_recipient: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (relationships.length === 0) return;

      const medication = await prisma.medication.findFirst({
        where: { id: medicationId },
      });

      if (!medication) return;

      const careRecipientName = relationships[0].care_recipient.name || relationships[0].care_recipient.email;

      const notifications = relationships.map(rel => ({
        user_id: rel.caregiver_id,
        type: 'caregiver_alert',
        title: 'Low Stock Alert',
        message: `${careRecipientName}'s ${medication.name} is running low (${medication.quantity_remaining || 0} remaining)`,
        data: {
          care_recipient_id: careRecipientId,
          care_recipient_name: careRecipientName,
          medication_id: medicationId,
          medication_name: medication.name,
          quantity_remaining: medication.quantity_remaining,
          alert_type: 'low_stock',
        },
      }));

      await prisma.notification.createMany({
        data: notifications,
      });

      console.log(`✅ Notified ${notifications.length} caregiver(s) about low stock`);
    } catch (error) {
      console.error('Error notifying caregivers about low stock:', error);
    }
  }

  /**
   * Notify caregivers when new medication is added for care recipient
   */
  async notifyNewMedication(careRecipientId, medicationId) {
    try {
      const relationships = await prisma.caregiverRelationship.findMany({
        where: {
          care_recipient_id: careRecipientId,
          status: 'accepted',
        },
        include: {
          caregiver: {
            select: {
              id: true,
            },
          },
          care_recipient: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (relationships.length === 0) return;

      const medication = await prisma.medication.findFirst({
        where: { id: medicationId },
      });

      if (!medication) return;

      const careRecipientName = relationships[0].care_recipient.name || relationships[0].care_recipient.email;

      const notifications = relationships.map(rel => ({
        user_id: rel.caregiver_id,
        type: 'caregiver_alert',
        title: 'New Medication Added',
        message: `A new medication "${medication.name}" has been added to ${careRecipientName}'s schedule`,
        data: {
          care_recipient_id: careRecipientId,
          care_recipient_name: careRecipientName,
          medication_id: medicationId,
          medication_name: medication.name,
          alert_type: 'new_medication',
        },
      }));

      await prisma.notification.createMany({
        data: notifications,
      });

      console.log(`✅ Notified ${notifications.length} caregiver(s) about new medication`);
    } catch (error) {
      console.error('Error notifying caregivers about new medication:', error);
    }
  }
}

module.exports = new CaregiverNotificationService();

