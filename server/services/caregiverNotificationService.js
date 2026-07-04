const { query } = require('../config/mysql');
const smsService = require('./smsService');

class CaregiverNotificationService {
  async sendSmsToCaregiver(caregiverPhone, message) {
    if (!caregiverPhone) return;
    try {
      await smsService.sendSms(caregiverPhone, message);
    } catch (error) {
      console.error('Error sending caregiver SMS via Infobip:', error.message);
    }
  }

  /**
   * Notify caregivers when care recipient misses a dose
   */
  async notifyMissedDose(careRecipientId, medicationId, scheduledTime) {
    try {
      const relationships = await query(
        `SELECT cr.caregiver_id,
                r.name as care_recipient_name,
                r.email as care_recipient_email,
                cg.phone_number as caregiver_phone
         FROM caregiver_relationships cr
         JOIN users r ON r.id = cr.care_recipient_id
         JOIN users cg ON cg.id = cr.caregiver_id
         WHERE cr.care_recipient_id = ? AND cr.status = 'accepted'`,
        [careRecipientId]
      );
      if (!relationships.length) return;

      const medicationRows = await query('SELECT id, name FROM medications WHERE id = ? LIMIT 1', [
        medicationId,
      ]);
      const medication = medicationRows?.[0] || null;
      if (!medication) return;

      const careRecipientName =
        relationships[0].care_recipient_name || relationships[0].care_recipient_email;
      const timeLabel = new Date(scheduledTime).toLocaleTimeString();
      const smsBody = `MediPing: ${careRecipientName} missed ${medication.name} at ${timeLabel}.`;

      let created = 0;
      for (const rel of relationships) {
        const idRows = await query('SELECT UUID() as id');
        const notifId = idRows?.[0]?.id;
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
          [
            notifId,
            rel.caregiver_id,
            'caregiver_alert',
            'Missed Dose Alert',
            `${careRecipientName} missed their ${medication.name} dose at ${timeLabel}`,
            JSON.stringify({
              care_recipient_id: careRecipientId,
              care_recipient_name: careRecipientName,
              medication_id: medicationId,
              medication_name: medication.name,
              scheduled_time: scheduledTime,
              alert_type: 'missed_dose',
            }),
          ]
        );
        created++;

        await this.sendSmsToCaregiver(rel.caregiver_phone, smsBody);
      }

      console.log(`✅ Notified ${created} caregiver(s) about missed dose`);
    } catch (error) {
      console.error('Error notifying caregivers about missed dose:', error);
    }
  }

  /**
   * Notify caregivers when care recipient's medication is low stock
   */
  async notifyLowStock(careRecipientId, medicationId) {
    try {
      const relationships = await query(
        `SELECT cr.caregiver_id, r.name as care_recipient_name, r.email as care_recipient_email
         FROM caregiver_relationships cr
         JOIN users r ON r.id = cr.care_recipient_id
         WHERE cr.care_recipient_id = ? AND cr.status = 'accepted'`,
        [careRecipientId]
      );
      if (!relationships.length) return;

      const medicationRows = await query(
        'SELECT id, name, quantity_remaining FROM medications WHERE id = ? LIMIT 1',
        [medicationId]
      );
      const medication = medicationRows?.[0] || null;
      if (!medication) return;

      const careRecipientName =
        relationships[0].care_recipient_name || relationships[0].care_recipient_email;

      let created = 0;
      for (const rel of relationships) {
        const idRows = await query('SELECT UUID() as id');
        const notifId = idRows?.[0]?.id;
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
          [
            notifId,
            rel.caregiver_id,
            'caregiver_alert',
            'Low Stock Alert',
            `${careRecipientName}'s ${medication.name} is running low (${medication.quantity_remaining || 0} remaining)`,
            JSON.stringify({
              care_recipient_id: careRecipientId,
              care_recipient_name: careRecipientName,
              medication_id: medicationId,
              medication_name: medication.name,
              quantity_remaining: medication.quantity_remaining,
              alert_type: 'low_stock',
            }),
          ]
        );
        created++;
      }

      console.log(`✅ Notified ${created} caregiver(s) about low stock`);
    } catch (error) {
      console.error('Error notifying caregivers about low stock:', error);
    }
  }

  /**
   * Notify caregivers when new medication is added for care recipient
   */
  async notifyNewMedication(careRecipientId, medicationId) {
    try {
      const relationships = await query(
        `SELECT cr.caregiver_id, r.name as care_recipient_name, r.email as care_recipient_email
         FROM caregiver_relationships cr
         JOIN users r ON r.id = cr.care_recipient_id
         WHERE cr.care_recipient_id = ? AND cr.status = 'accepted'`,
        [careRecipientId]
      );
      if (!relationships.length) return;

      const medicationRows = await query('SELECT id, name FROM medications WHERE id = ? LIMIT 1', [
        medicationId,
      ]);
      const medication = medicationRows?.[0] || null;
      if (!medication) return;

      const careRecipientName =
        relationships[0].care_recipient_name || relationships[0].care_recipient_email;

      let created = 0;
      for (const rel of relationships) {
        const idRows = await query('SELECT UUID() as id');
        const notifId = idRows?.[0]?.id;
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
          [
            notifId,
            rel.caregiver_id,
            'caregiver_alert',
            'New Medication Added',
            `A new medication "${medication.name}" has been added to ${careRecipientName}'s schedule`,
            JSON.stringify({
              care_recipient_id: careRecipientId,
              care_recipient_name: careRecipientName,
              medication_id: medicationId,
              medication_name: medication.name,
              alert_type: 'new_medication',
            }),
          ]
        );
        created++;
      }

      console.log(`✅ Notified ${created} caregiver(s) about new medication`);
    } catch (error) {
      console.error('Error notifying caregivers about new medication:', error);
    }
  }
}

module.exports = new CaregiverNotificationService();

