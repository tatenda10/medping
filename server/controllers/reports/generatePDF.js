const { query } = require('../../config/mysql');
const PDFDocument = require('pdfkit');
const { startOfMonth, endOfMonth, format, subMonths } = require('date-fns');

const generateHealthReportPDF = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;
    
    // Parse date or use current month
    const reportDate = month && year 
      ? new Date(parseInt(year), parseInt(month) - 1, 1)
      : new Date();
    
    const startDate = startOfMonth(reportDate);
    const endDate = endOfMonth(reportDate);
    const prevStartDate = startOfMonth(subMonths(reportDate, 1));
    const prevEndDate = endOfMonth(subMonths(reportDate, 1));

    // Get user profile
    const userRows = await query(
      `SELECT u.id, u.email, u.name, up.age, up.gender, up.onboarding_completed
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    const user = userRows?.[0] || null;
    if (user) {
      user.profile = user.onboarding_completed !== undefined ? {
        age: user.age ?? null,
        gender: user.gender ?? null,
        onboarding_completed: !!user.onboarding_completed,
      } : null;
    }

    // Get medications
    const medications = await query('SELECT * FROM medications WHERE user_id = ?', [userId]);

    // Get dose logs for the period (join medication)
    const doseLogs = await query(
      `SELECT dl.*, m.name as medication_name, m.dosage as medication_dosage
       FROM dose_logs dl
       JOIN medications m ON m.id = dl.medication_id
       WHERE dl.user_id = ?
         AND dl.scheduled_time >= ?
         AND dl.scheduled_time <= ?
       ORDER BY dl.scheduled_time ASC`,
      [userId, startDate, endDate]
    );
    const shapedDoseLogs = doseLogs.map((log) => ({
      ...log,
      medication: {
        id: log.medication_id,
        name: log.medication_name,
        dosage: log.medication_dosage,
      },
    }));

    // Get vitals for the period
    const vitals = await query(
      `SELECT *
       FROM vitals_logs
       WHERE user_id = ?
         AND recorded_at >= ?
         AND recorded_at <= ?
       ORDER BY recorded_at ASC`,
      [userId, startDate, endDate]
    );

    // Get previous month vitals for comparison
    const prevVitals = await query(
      `SELECT *
       FROM vitals_logs
       WHERE user_id = ?
         AND recorded_at >= ?
         AND recorded_at <= ?`,
      [userId, prevStartDate, prevEndDate]
    );

    // Calculate adherence
    const taken = shapedDoseLogs.filter(log => log.status === 'taken').length;
    const missed = shapedDoseLogs.filter(log => log.status === 'missed').length;
    const total = taken + missed;
    const adherencePercentage = total > 0 ? Math.round((taken / total) * 100) : 0;

    // Calculate average vitals
    const bpReadings = vitals.filter(v => v.blood_pressure_systolic && v.blood_pressure_diastolic);
    const hrReadings = vitals.filter(v => v.heart_rate);
    const glucoseReadings = vitals.filter(v => v.blood_glucose);

    const avgSystolic = bpReadings.length > 0
      ? Math.round(bpReadings.reduce((sum, v) => sum + parseInt(v.blood_pressure_systolic), 0) / bpReadings.length)
      : null;
    const avgDiastolic = bpReadings.length > 0
      ? Math.round(bpReadings.reduce((sum, v) => sum + parseInt(v.blood_pressure_diastolic), 0) / bpReadings.length)
      : null;
    const avgHeartRate = hrReadings.length > 0
      ? Math.round(hrReadings.reduce((sum, v) => sum + parseInt(v.heart_rate), 0) / hrReadings.length)
      : null;
    const avgGlucose = glucoseReadings.length > 0
      ? Math.round(glucoseReadings.reduce((sum, v) => sum + parseFloat(v.blood_glucose), 0) / glucoseReadings.length)
      : null;

    // Calculate trends
    const prevBpReadings = prevVitals.filter(v => v.blood_pressure_systolic && v.blood_pressure_diastolic);
    const prevHrReadings = prevVitals.filter(v => v.heart_rate);
    const prevGlucoseReadings = prevVitals.filter(v => v.blood_glucose);

    let bpTrend = null;
    if (avgSystolic && prevBpReadings.length > 0) {
      const prevAvgSystolic = prevBpReadings.reduce((sum, v) => sum + parseInt(v.blood_pressure_systolic), 0) / prevBpReadings.length;
      const change = ((avgSystolic - prevAvgSystolic) / prevAvgSystolic) * 100;
      bpTrend = { value: Math.abs(change).toFixed(1), isPositive: change < 0 };
    }

    let hrTrend = null;
    if (avgHeartRate && prevHrReadings.length > 0) {
      const prevAvg = prevHrReadings.reduce((sum, v) => sum + parseInt(v.heart_rate), 0) / prevHrReadings.length;
      hrTrend = Math.abs(avgHeartRate - prevAvg) < 2 ? 'Stable' : null;
    }

    let glucoseTrend = null;
    if (avgGlucose && prevGlucoseReadings.length > 0) {
      const prevAvg = prevGlucoseReadings.reduce((sum, v) => sum + parseFloat(v.blood_glucose), 0) / prevGlucoseReadings.length;
      const change = ((avgGlucose - prevAvg) / prevAvg) * 100;
      glucoseTrend = { value: Math.abs(change).toFixed(1), isPositive: change < 0 };
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="health-report-${format(reportDate, 'yyyy-MM')}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(24).text('Health Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#666666').text(`${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`, { align: 'center' });
    doc.moveDown(1);

    // User Info
    if (user) {
      doc.fontSize(14).fillColor('#000000').text('Patient Information', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#333333');
      doc.text(`Name: ${user.name || 'N/A'}`);
      if (user.email) doc.text(`Email: ${user.email}`);
      doc.moveDown(1);
    }

    // Medication Adherence
    doc.fontSize(14).fillColor('#000000').text('Medication Adherence', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#333333');
    doc.text(`Adherence Rate: ${adherencePercentage}%`);
    doc.text(`Taken: ${taken} doses`);
    doc.text(`Missed: ${missed} doses`);
    doc.text(`Total: ${total} doses`);
    doc.moveDown(1);

    // Average Vitals
    doc.fontSize(14).fillColor('#000000').text('Average Vitals', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#333333');
    
    if (avgSystolic && avgDiastolic) {
      let bpText = `Blood Pressure: ${avgSystolic}/${avgDiastolic} mmHg`;
      if (bpTrend) {
        bpText += ` (${bpTrend.isPositive ? '↓' : '↑'} ${bpTrend.value}%)`;
      }
      doc.text(bpText);
    }
    
    if (avgHeartRate) {
      let hrText = `Heart Rate: ${avgHeartRate} BPM`;
      if (hrTrend) {
        hrText += ` (${hrTrend})`;
      }
      doc.text(hrText);
    }
    
    if (avgGlucose) {
      let glucoseText = `Blood Glucose: ${avgGlucose} mg/dL`;
      if (glucoseTrend) {
        glucoseText += ` (${glucoseTrend.isPositive ? '↓' : '↑'} ${glucoseTrend.value}%)`;
      }
      doc.text(glucoseText);
    }
    doc.moveDown(1);

    // Medications List
    if (medications.length > 0) {
      doc.fontSize(14).fillColor('#000000').text('Medications', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#333333');
      medications.forEach((med, index) => {
        doc.text(`${index + 1}. ${med.name} - ${med.dosage}`);
      });
      doc.moveDown(1);
    }

    // Dose Log Summary
    if (shapedDoseLogs.length > 0) {
      doc.fontSize(14).fillColor('#000000').text('Dose Log Summary', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#333333');
      
      // Group by medication
      const groupedByMed = {};
      shapedDoseLogs.forEach(log => {
        if (!groupedByMed[log.medication.name]) {
          groupedByMed[log.medication.name] = { taken: 0, missed: 0, skipped: 0 };
        }
        if (log.status === 'taken') groupedByMed[log.medication.name].taken++;
        else if (log.status === 'missed') groupedByMed[log.medication.name].missed++;
        else if (log.status === 'skipped') groupedByMed[log.medication.name].skipped++;
      });

      Object.entries(groupedByMed).forEach(([medName, stats]) => {
        doc.text(`${medName}: Taken: ${stats.taken}, Missed: ${stats.missed}, Skipped: ${stats.skipped}`);
      });
      doc.moveDown(1);
    }

    // Footer
    doc.fontSize(10).fillColor('#999999').text(
      `Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
      { align: 'center' }
    );

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF report',
      error: error.message,
    });
  }
};

module.exports = { generateHealthReportPDF };

