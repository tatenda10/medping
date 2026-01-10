/**
 * Calculate if medication is low on stock
 * @param {Object} medication - Medication object
 * @param {Array} doseLogs - Array of dose logs for this medication
 * @returns {Object} - { isLowStock: boolean, daysRemaining: number, estimatedDays: number }
 */
export const calculateLowStock = (medication, doseLogs = []) => {
  if (!medication.quantity_remaining || medication.quantity_remaining <= 0) {
    return {
      isLowStock: true,
      daysRemaining: 0,
      estimatedDays: 0,
      message: 'Out of stock',
    };
  }

  if (!medication.low_stock_threshold) {
    return {
      isLowStock: false,
      daysRemaining: null,
      estimatedDays: null,
      message: null,
    };
  }

  // Calculate average daily consumption
  const timesPerDay = medication.times_per_day || 1;
  const dosage = medication.dosage || '1';
  
  // Extract number from dosage (e.g., "2 tablets" -> 2)
  const dosageMatch = dosage.match(/(\d+)/);
  const unitsPerDose = dosageMatch ? parseInt(dosageMatch[1]) : 1;
  
  const unitsPerDay = timesPerDay * unitsPerDose;
  
  if (unitsPerDay === 0) {
    return {
      isLowStock: false,
      daysRemaining: null,
      estimatedDays: null,
      message: null,
    };
  }

  // Calculate estimated days remaining
  const estimatedDays = Math.floor(medication.quantity_remaining / unitsPerDay);
  const daysRemaining = estimatedDays;

  // Check if low stock (below threshold)
  const isLowStock = estimatedDays <= medication.low_stock_threshold;

  let message = null;
  if (isLowStock) {
    if (estimatedDays === 0) {
      message = 'Out of stock';
    } else if (estimatedDays === 1) {
      message = '1 day remaining';
    } else {
      message = `${estimatedDays} days remaining`;
    }
  }

  return {
    isLowStock,
    daysRemaining,
    estimatedDays,
    message,
  };
};

/**
 * Filter medications by search term
 * @param {Array} medications - Array of medications
 * @param {string} searchTerm - Search term
 * @returns {Array} - Filtered medications
 */
export const filterMedicationsBySearch = (medications, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return medications;
  }

  const term = searchTerm.toLowerCase().trim();
  return medications.filter(med => {
    const name = (med.name || '').toLowerCase();
    const dosage = (med.dosage || '').toLowerCase();
    const medicationType = (med.medication_type || '').toLowerCase();
    
    return name.includes(term) || 
           dosage.includes(term) || 
           medicationType.includes(term);
  });
};

/**
 * Filter medications by type
 * @param {Array} medications - Array of medications
 * @param {string} type - Medication type filter
 * @returns {Array} - Filtered medications
 */
export const filterMedicationsByType = (medications, type) => {
  if (!type || type === 'all') {
    return medications;
  }

  return medications.filter(med => 
    (med.medication_type || 'tablet').toLowerCase() === type.toLowerCase()
  );
};

/**
 * Filter medications by status (low stock, active, etc.)
 * @param {Array} medications - Array of medications
 * @param {string} status - Status filter
 * @param {Function} getLowStockInfo - Function to get low stock info
 * @returns {Array} - Filtered medications
 */
export const filterMedicationsByStatus = (medications, status, getLowStockInfo) => {
  if (!status || status === 'all') {
    return medications;
  }

  return medications.filter(med => {
    if (status === 'low_stock') {
      const stockInfo = getLowStockInfo ? getLowStockInfo(med) : calculateLowStock(med);
      return stockInfo.isLowStock;
    }
    if (status === 'active') {
      const now = new Date();
      const startDate = new Date(med.start_date);
      const endDate = med.end_date ? new Date(med.end_date) : null;
      
      if (now < startDate) return false;
      if (endDate && now > endDate) return false;
      return true;
    }
    return true;
  });
};

/**
 * Sort medications
 * @param {Array} medications - Array of medications
 * @param {string} sortBy - Sort field ('name', 'type', 'quantity', 'date')
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} - Sorted medications
 */
export const sortMedications = (medications, sortBy = 'name', order = 'asc') => {
  const sorted = [...medications];
  
  sorted.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'name':
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        break;
      case 'type':
        aVal = (a.medication_type || 'tablet').toLowerCase();
        bVal = (b.medication_type || 'tablet').toLowerCase();
        break;
      case 'quantity':
        aVal = a.quantity_remaining || 0;
        bVal = b.quantity_remaining || 0;
        break;
      case 'date':
        aVal = new Date(a.start_date || 0).getTime();
        bVal = new Date(b.start_date || 0).getTime();
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
  
  return sorted;
};

