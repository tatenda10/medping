const express = require('express');
const cors = require('cors');
const config = require('./config/env');

// Import routes
const userAuthRoutes = require('./routes/userAuth');
const userRoutes = require('./routes/user');
const medicationRoutes = require('./routes/medications');
const doseLogRoutes = require('./routes/doseLogs');
const caregiverRoutes = require('./routes/caregivers');
const refillRoutes = require('./routes/refills');
const vitalsRoutes = require('./routes/vitals');
const appointmentRoutes = require('./routes/appointments');

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/user-auth', userAuthRoutes);
app.use('/user', userRoutes);
app.use('/medications', medicationRoutes);
app.use('/dose-logs', doseLogRoutes);
app.use('/caregivers', caregiverRoutes);
app.use('/refills', refillRoutes);
app.use('/vitals', vitalsRoutes);
app.use('/appointments', appointmentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
const PORT = config.PORT;
const HOST = '0.0.0.0'; // Listen on all network interfaces
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${config.NODE_ENV}`);
  console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

