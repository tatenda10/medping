const { createAppointment } = require('./create');
const { listAppointments } = require('./list');
const { updateAppointment } = require('./update');
const { deleteAppointment } = require('./delete');

module.exports = {
  createAppointment,
  listAppointments,
  updateAppointment,
  deleteAppointment,
};

