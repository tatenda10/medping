const prisma = require('../../config/database');

const createVitalsLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      weight,
      blood_pressure_systolic,
      blood_pressure_diastolic,
      blood_glucose,
      heart_rate,
      temperature,
      notes,
    } = req.body;

    const vitalsLog = await prisma.vitalsLog.create({
      data: {
        user_id: userId,
        weight: weight || null,
        blood_pressure_systolic: blood_pressure_systolic || null,
        blood_pressure_diastolic: blood_pressure_diastolic || null,
        blood_glucose: blood_glucose || null,
        heart_rate: heart_rate || null,
        temperature: temperature || null,
        notes: notes || null,
        recorded_at: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Vitals logged successfully',
      vitals: vitalsLog,
    });
  } catch (error) {
    console.error('Error creating vitals log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log vitals',
      error: error.message,
    });
  }
};

module.exports = { createVitalsLog };

