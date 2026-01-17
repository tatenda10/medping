import { Platform } from 'react-native';

// Only import SQLite on native platforms (not web)
let SQLite = null;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

class DatabaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.initPromise = null;
    this.isInitializing = false;
    this.failureCount = 0;
    this.maxFailures = 5;
    this.lastFailureTime = null;
    this.circuitBreakerTimeout = 30000; // 30 seconds
  }

  /**
   * Ensure database is initialized
   */
  async ensureInitialized() {
    // Skip on web platform
    if (Platform.OS === 'web') {
      return;
    }

    if (!SQLite) {
      return;
    }

    // Check circuit breaker
    if (this.failureCount >= this.maxFailures) {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure < this.circuitBreakerTimeout) {
        console.warn('⚠️ Circuit breaker active - too many failures, waiting before retry');
        // Return without throwing to prevent infinite loops
        return;
      } else {
        // Reset circuit breaker after timeout
        console.log('🔄 Resetting circuit breaker after timeout');
        this.failureCount = 0;
        this.lastFailureTime = null;
      }
    }

    if (this.initialized && this.db) {
      // Verify database is still valid and has required methods
      if (typeof this.db.getAllAsync !== 'function' || typeof this.db.runAsync !== 'function') {
        console.warn('⚠️ Database object invalid (missing methods), reinitializing...');
        this.initialized = false;
        this.db = null;
        this.initPromise = null;
      } else {
        // Don't test with a query here - it can cause NullPointerException
        // If the object has the required methods, assume it's valid
        // The database will be tested naturally when operations are performed
        // Reset failure count since we have a valid database object
        this.failureCount = 0;
        return;
      }
    }
    
    if (this.initPromise) {
      try {
        await this.initPromise;
        // Verify it actually initialized
        if (this.db && this.initialized) {
          this.failureCount = 0; // Reset on success
          return;
        }
        // If promise resolved but db is still null, try again
        this.initPromise = null;
      } catch (error) {
        console.warn('⚠️ Previous initialization failed, retrying...', error.message);
        this.initPromise = null;
        this.initialized = false;
        this.db = null;
      }
    }
    
    // Retry initialization up to 2 times (reduced to prevent loops)
    let retries = 0;
    const maxRetries = 2;
    
    while (retries < maxRetries) {
      try {
        this.initPromise = this.init();
        await this.initPromise;
        
        // Verify initialization succeeded
        if (this.db && this.initialized) {
          // Reset failure count on success
          this.failureCount = 0;
          return;
        }
        
        // If we get here, initialization didn't properly set db
        throw new Error('Database initialization completed but db is still null');
      } catch (error) {
        retries++;
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.initPromise = null;
        this.initialized = false;
        this.db = null;
        
        if (retries >= maxRetries) {
          console.error(`❌ Database initialization failed after ${maxRetries} attempts:`, error);
          // Don't throw - return to prevent infinite loops and app crashes
          console.warn('⚠️ Returning without initialization to prevent infinite loop');
          return;
        }
        
        // Wait before retrying (exponential backoff with longer delays)
        const delay = Math.min(1000 * Math.pow(2, retries), 5000); // Max 5 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
        console.log(`🔄 Retrying database initialization (attempt ${retries + 1}/${maxRetries})...`);
      }
    }
  }

  /**
   * Initialize database and create tables
   */
  async init() {
    // Skip initialization on web platform
    if (Platform.OS === 'web') {
      console.log('⚠️ SQLite not available on web platform');
      this.initialized = true;
      return;
    }

    if (!SQLite) {
      console.warn('⚠️ SQLite module not available');
      this.initialized = true;
      return;
    }

    // Prevent concurrent initialization
    if (this.isInitializing) {
      // Wait for ongoing initialization
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.initialized && this.db) {
        return;
      }
    }
    
    try {
      if (this.initialized && this.db) {
        // Verify it's still valid - check methods exist but don't test with query
        // Query testing can cause NullPointerException on Android
        if (typeof this.db.getAllAsync === 'function' && typeof this.db.runAsync === 'function') {
          return; // Database appears valid, return early
        } else {
          // Database is invalid, reinitialize
          this.initialized = false;
          this.db = null;
        }
      }
      
      this.isInitializing = true;
      console.log('🔄 Initializing database...');
      
      // Don't close existing database - SQLite handles connection pooling
      // Closing can cause NullPointerException issues
      let dbRef = this.db;
      
      if (!dbRef) {
        try {
          console.log('📂 Opening database...');
          
          // Close any existing database first to avoid conflicts
          try {
            if (this.db && typeof this.db.closeAsync === 'function') {
              await this.db.closeAsync().catch(() => {});
            }
          } catch (closeError) {
            // Ignore close errors - database might not be open
          }
          
          // Open database
          dbRef = await SQLite.openDatabaseAsync('mediping.db');
          
          if (!dbRef) {
            throw new Error('openDatabaseAsync returned null');
          }
          
          // Verify database object has required methods immediately
          if (typeof dbRef.runAsync !== 'function' || typeof dbRef.getAllAsync !== 'function') {
            throw new Error('Database object is missing required methods');
          }
          
          // Set this.db immediately after successful open to prevent garbage collection
          this.db = dbRef;
          console.log('✅ Database opened successfully');
          
          // Wait a bit to ensure the database connection is stable before using it
          // Don't test with a query here - it can cause NullPointerException on Android
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (openError) {
          console.error('❌ Error opening database:', openError);
          this.db = null;
          throw new Error(`Failed to open database: ${openError.message}`);
        }
      } else {
        // Verify existing database reference is still valid
        if (typeof dbRef.runAsync !== 'function' || typeof dbRef.getAllAsync !== 'function') {
          console.warn('⚠️ Existing database reference invalid, reopening...');
          this.db = null;
          dbRef = null;
          // Retry opening
          dbRef = await SQLite.openDatabaseAsync('mediping.db');
          if (!dbRef) {
            throw new Error('Failed to reopen database - returned null');
          }
          this.db = dbRef;
          // Small delay after reopening
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Always use this.db from now on to ensure consistency
      dbRef = this.db;
      
      // Final verification - but don't test query here, just verify object exists
      if (!dbRef || !this.db) {
        throw new Error('Database reference is null after opening');
      }
      
      // Verify methods exist
      if (typeof this.db.runAsync !== 'function' || typeof this.db.getAllAsync !== 'function') {
        throw new Error('Database object missing required methods after opening');
      }
      
      // Wait a bit more before creating tables to ensure database is fully ready
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Create tables using runAsync (execAsync has issues with NullPointerException)
      // Use runAsync for all DDL statements as it's more reliable
      const createMedicationsTable = `CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, dosage TEXT NOT NULL, medication_type TEXT DEFAULT 'tablet', frequency TEXT, times_per_day INTEGER, times_of_day TEXT, start_date TEXT NOT NULL, end_date TEXT, is_continuous INTEGER DEFAULT 1, food_instructions TEXT, notes TEXT, photo_url TEXT, quantity_remaining INTEGER, low_stock_threshold INTEGER DEFAULT 7, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, server_synced INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0)`;
      
      const createDoseLogsTable = `CREATE TABLE IF NOT EXISTS dose_logs (id TEXT PRIMARY KEY, user_id TEXT, medication_id TEXT NOT NULL, scheduled_time TEXT NOT NULL, status TEXT NOT NULL, taken_time TEXT, notes TEXT, injection_site TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, server_synced INTEGER DEFAULT 0)`;
      
      const createRefillsTable = `CREATE TABLE IF NOT EXISTS refills (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, medication_id TEXT NOT NULL, quantity INTEGER NOT NULL, refill_date TEXT NOT NULL, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, server_synced INTEGER DEFAULT 0)`;
      
      const createHealthLogsTable = `CREATE TABLE IF NOT EXISTS health_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, log_type TEXT NOT NULL, data TEXT NOT NULL, recorded_at TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, server_synced INTEGER DEFAULT 0)`;
      
      const createVitalsLogsTable = `CREATE TABLE IF NOT EXISTS vitals_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, weight REAL, blood_pressure_systolic INTEGER, blood_pressure_diastolic INTEGER, blood_glucose REAL, heart_rate INTEGER, temperature REAL, notes TEXT, recorded_at TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, server_synced INTEGER DEFAULT 0)`;
      
      const createAppointmentsTable = `CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, doctor_name TEXT, appointment_type TEXT, scheduled_time TEXT NOT NULL, location TEXT, notes TEXT, reminder_minutes INTEGER DEFAULT 60, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, server_synced INTEGER DEFAULT 0)`;
      
      const createSyncQueueTable = `CREATE TABLE IF NOT EXISTS sync_queue (id TEXT PRIMARY KEY, operation_type TEXT NOT NULL, table_name TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, retry_count INTEGER DEFAULT 0)`;
      
      const createQuestionnaireAnswersTable = `CREATE TABLE IF NOT EXISTS questionnaire_answers (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, answers TEXT NOT NULL, completed_at TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, server_synced INTEGER DEFAULT 0)`;
      
      // Create tables one by one using runAsync (more reliable than execAsync)
      // Always use this.db to ensure we're using the same database object
      if (!this.db) {
        throw new Error('Database reference is null - cannot create tables');
      }
      
      // Verify database is still valid before creating tables
      if (typeof this.db.runAsync !== 'function') {
        throw new Error('Database object invalid - runAsync method missing');
      }
      
      // Try to create medications table
      try {
        // Verify database is still valid before each operation
        if (!this.db || typeof this.db.runAsync !== 'function') {
          throw new Error('Database object invalid before table creation');
        }
        await this.db.runAsync(createMedicationsTable);
        console.log('✅ Medications table created/verified');
      } catch (error) {
        // If it's a NullPointerException, the database object is corrupted - don't continue
        if (error.message && error.message.includes('NullPointerException')) {
          console.error('❌ NullPointerException during medications table creation');
          this.db = null;
          this.initialized = false;
          throw new Error('Database NullPointerException - cannot continue initialization');
        }
        console.warn('⚠️ Medications table creation warning:', error.message);
        // Continue anyway - table might already exist
      }
      
      // Always check if medication_type column exists (for existing databases)
      // CREATE TABLE IF NOT EXISTS won't add columns to existing tables
      try {
        await this.db.getAllAsync('SELECT medication_type FROM medications LIMIT 1');
        console.log('✅ medication_type column exists');
      } catch (columnError) {
        if (columnError.message && columnError.message.includes('no such column')) {
          console.log('🔄 Adding medication_type column to medications table...');
          try {
            await this.db.runAsync('ALTER TABLE medications ADD COLUMN medication_type TEXT DEFAULT "tablet"');
            console.log('✅ medication_type column added');
          } catch (alterError) {
            console.warn('⚠️ Could not add medication_type column:', alterError.message);
            // Don't throw - app can still work without this column, just with default values
          }
        } else {
          // Some other error, log it but don't fail
          console.warn('⚠️ Could not verify medication_type column:', columnError.message);
        }
      }
      
      // Try to create dose_logs table
      try {
        if (!this.db || typeof this.db.runAsync !== 'function') {
          throw new Error('Database object invalid');
        }
        await this.db.runAsync(createDoseLogsTable);
        console.log('✅ Dose logs table created/verified');
      } catch (error) {
        if (error.message && error.message.includes('NullPointerException')) {
          console.error('❌ NullPointerException during dose_logs table creation');
          this.db = null;
          this.initialized = false;
          throw new Error('Database NullPointerException');
        }
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Dose logs table already exists');
        } else {
          console.warn('⚠️ Dose logs table creation warning:', error.message);
        }
      }
      
      // Try to create refills table
      try {
        if (!this.db || typeof this.db.runAsync !== 'function') {
          throw new Error('Database object invalid');
        }
        await this.db.runAsync(createRefillsTable);
        console.log('✅ Refills table created/verified');
      } catch (error) {
        if (error.message && error.message.includes('NullPointerException')) {
          console.error('❌ NullPointerException during refills table creation');
          this.db = null;
          this.initialized = false;
          throw new Error('Database NullPointerException');
        }
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Refills table already exists');
        } else {
          console.warn('⚠️ Refills table creation warning:', error.message);
        }
      }
      
      // Try to create vitals_logs table
      try {
        if (!this.db || typeof this.db.runAsync !== 'function') {
          throw new Error('Database object invalid');
        }
        await this.db.runAsync(createVitalsLogsTable);
        console.log('✅ Vitals logs table created/verified');
      } catch (error) {
        if (error.message && error.message.includes('NullPointerException')) {
          console.error('❌ NullPointerException during vitals logs table creation');
          this.db = null;
          this.initialized = false;
          throw new Error('Database NullPointerException');
        }
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Vitals logs table already exists');
        } else {
          console.warn('⚠️ Vitals logs table creation warning:', error.message);
        }
      }
      
      // Try to create health_logs table
      try {
        if (!this.db || typeof this.db.runAsync !== 'function') {
          throw new Error('Database object invalid');
        }
        await this.db.runAsync(createHealthLogsTable);
        console.log('✅ Health logs table created/verified');
      } catch (error) {
        if (error.message && error.message.includes('NullPointerException')) {
          console.error('❌ NullPointerException during health logs table creation');
          this.db = null;
          this.initialized = false;
          throw new Error('Database NullPointerException');
        }
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Health logs table already exists');
        } else {
          console.warn('⚠️ Health logs table creation warning:', error.message);
        }
      }
      
      // Try to create appointments table
      try {
        if (!this.db || typeof this.db.runAsync !== 'function') {
          throw new Error('Database object invalid');
        }
        await this.db.runAsync(createAppointmentsTable);
        console.log('✅ Appointments table created/verified');
      } catch (error) {
        if (error.message && error.message.includes('NullPointerException')) {
          console.error('❌ NullPointerException during appointments table creation');
          this.db = null;
          this.initialized = false;
          throw new Error('Database NullPointerException');
        }
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Appointments table already exists');
        } else {
          console.warn('⚠️ Appointments table creation warning:', error.message);
        }
      }
      
      // Try to create sync_queue table
      try {
        if (!this.db || typeof this.db.runAsync !== 'function') {
          throw new Error('Database object invalid');
        }
        await this.db.runAsync(createSyncQueueTable);
        console.log('✅ Sync queue table created/verified');
      } catch (error) {
        if (error.message && error.message.includes('NullPointerException')) {
          console.error('❌ NullPointerException during sync_queue table creation');
          this.db = null;
          this.initialized = false;
          throw new Error('Database NullPointerException');
        }
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Sync queue table already exists');
        } else {
          console.warn('⚠️ Sync queue table creation warning:', error.message);
        }
      }

      // Try to create questionnaire_answers table
      try {
        if (!this.db || typeof this.db.runAsync !== 'function') {
          throw new Error('Database object invalid');
        }
        await this.db.runAsync(createQuestionnaireAnswersTable);
        console.log('✅ Questionnaire answers table created/verified');
      } catch (error) {
        if (error.message && error.message.includes('NullPointerException')) {
          console.error('❌ NullPointerException during questionnaire_answers table creation');
          this.db = null;
          this.initialized = false;
          throw new Error('Database NullPointerException');
        }
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Questionnaire answers table already exists');
        } else {
          console.warn('⚠️ Questionnaire answers table creation warning:', error.message);
        }
      }

      // Create indexes (non-critical, continue even if they fail)
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_medications_synced ON medications(server_synced)',
        'CREATE INDEX IF NOT EXISTS idx_dose_logs_medication_id ON dose_logs(medication_id)',
        'CREATE INDEX IF NOT EXISTS idx_dose_logs_synced ON dose_logs(server_synced)',
        'CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at)',
      ];
      
      for (const indexSql of indexes) {
        try {
          if (!this.db) {
            console.warn('⚠️ Database reference is null, skipping index creation');
            break;
          }
          await this.db.runAsync(indexSql);
        } catch (error) {
          // Don't log NullPointerException for indexes - they're non-critical
          if (!error.message || !error.message.includes('NullPointerException')) {
            console.warn('⚠️ Error creating index (non-critical, continuing):', error.message);
          }
          // Continue - indexes are not critical for functionality
        }
      }

      // Final verification - use this.db (should already be set)
      if (!this.db) {
        throw new Error('Database reference is null after initialization');
      }

      // Verify database has required methods
      if (typeof this.db.getAllAsync !== 'function' || typeof this.db.runAsync !== 'function') {
        throw new Error('Database object missing required methods (getAllAsync or runAsync)');
      }
      
      // Don't do a test query here - if we got this far, tables were created successfully
      // which means the database is working. Testing again can cause NullPointerException.
      // The database will be tested naturally when operations are performed.
      
      this.initialized = true;
      this.initPromise = null;
      this.isInitializing = false;
      console.log('✅ Database initialized successfully');
    } catch (error) {
      this.initPromise = null;
      this.isInitializing = false;
      this.initialized = false;
      this.db = null;
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Medications CRUD operations
   */
  async saveMedication(medication, isNew = true) {
    try {
      // On web platform, SQLite is not available - return early
      if (Platform.OS === 'web') {
        console.log('⚠️ SQLite not available on web - skipping local save');
        return { ...medication, id: medication.id || `med_${Date.now()}` };
      }

      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot save medication');
      }
      
      const now = new Date().toISOString();
      const timesOfDay = typeof medication.times_of_day === 'string' 
        ? medication.times_of_day 
        : JSON.stringify(medication.times_of_day || []);

      // Check if medication already exists
      const existing = await this.getMedicationById(medication.id);
      const actuallyNew = isNew || !existing;

      if (actuallyNew) {
        await this.db.runAsync(
          `INSERT INTO medications (
            id, user_id, name, dosage, medication_type, frequency, times_per_day, times_of_day,
            start_date, end_date, is_continuous, food_instructions, notes,
            photo_url, quantity_remaining, low_stock_threshold, created_at, updated_at, server_synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            medication.id,
            medication.user_id,
            medication.name,
            medication.dosage,
            medication.medication_type || 'tablet',
            medication.frequency,
            medication.times_per_day,
            timesOfDay,
            medication.start_date,
            medication.end_date || null,
            medication.is_continuous ? 1 : 0,
            medication.food_instructions || null,
            medication.notes || null,
            medication.photo_url || null,
            medication.quantity_remaining || null,
            medication.low_stock_threshold || 7,
            now,
            now,
          ]
        );
      } else {
        await this.db.runAsync(
          `UPDATE medications SET
            name = ?, dosage = ?, medication_type = ?, frequency = ?, times_per_day = ?, times_of_day = ?,
            start_date = ?, end_date = ?, is_continuous = ?, food_instructions = ?,
            notes = ?, photo_url = ?, quantity_remaining = ?, low_stock_threshold = ?,
            updated_at = ?, server_synced = 1
          WHERE id = ?`,
          [
            medication.name,
            medication.dosage,
            medication.medication_type || 'tablet',
            medication.frequency,
            medication.times_per_day,
            timesOfDay,
            medication.start_date,
            medication.end_date || null,
            medication.is_continuous ? 1 : 0,
            medication.food_instructions || null,
            medication.notes || null,
            medication.photo_url || null,
            medication.quantity_remaining || null,
            medication.low_stock_threshold || 7,
            now,
            medication.id,
          ]
        );
      }

      // Add to sync queue if not synced
      await this.addToSyncQueue(
        isNew ? 'create' : 'update',
        'medications',
        medication.id,
        medication
      );

      return medication;
    } catch (error) {
      console.error('Error saving medication:', error);
      throw error;
    }
  }

  async getMedications(userId) {
    try {
      // Skip on web platform
      if (Platform.OS === 'web') {
        return [];
      }

      await this.ensureInitialized();
      
      // Double-check database is valid before use
      if (!this.db) {
        console.error('Database is null - cannot get medications');
        return [];
      }

      // Verify database object has the required method
      if (typeof this.db.getAllAsync !== 'function') {
        console.error('Database object invalid - getAllAsync method missing');
        this.db = null;
        this.initialized = false;
        // Try to reinitialize
        await this.ensureInitialized();
        if (!this.db || typeof this.db.getAllAsync !== 'function') {
          return [];
        }
      }
      
      const result = await this.db.getAllAsync(
        `SELECT * FROM medications 
         WHERE user_id = ? AND deleted = 0 
         ORDER BY created_at DESC`,
        [userId]
      );
      
      return result.map(med => ({
        ...med,
        times_of_day: typeof med.times_of_day === 'string' 
          ? JSON.parse(med.times_of_day) 
          : med.times_of_day,
        is_continuous: med.is_continuous === 1,
      }));
    } catch (error) {
      console.error('Error getting medications:', error);
      
      // If it's a NullPointerException, try to reinitialize
      if (error.message && error.message.includes('NullPointerException')) {
        console.log('🔄 NullPointerException detected, reinitializing database...');
        this.db = null;
        this.initialized = false;
        this.initPromise = null;
        
        try {
          await this.ensureInitialized();
          // Retry once after reinitialization
          if (this.db && typeof this.db.getAllAsync === 'function') {
            const result = await this.db.getAllAsync(
              `SELECT * FROM medications 
               WHERE user_id = ? AND deleted = 0 
               ORDER BY created_at DESC`,
              [userId]
            );
            return result.map(med => ({
              ...med,
              times_of_day: typeof med.times_of_day === 'string' 
                ? JSON.parse(med.times_of_day) 
                : med.times_of_day,
              is_continuous: med.is_continuous === 1,
            }));
          }
        } catch (retryError) {
          console.error('Error retrying after reinitialization:', retryError);
        }
      }
      
      return [];
    }
  }

  async getMedicationById(id) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        console.error('Database is null - cannot get medication');
        return null;
      }
      
      const result = await this.db.getFirstAsync(
        `SELECT * FROM medications WHERE id = ? AND deleted = 0`,
        [id]
      );
      
      if (result) {
        return {
          ...result,
          times_of_day: typeof result.times_of_day === 'string' 
            ? JSON.parse(result.times_of_day) 
            : result.times_of_day,
          is_continuous: result.is_continuous === 1,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting medication:', error);
      return null;
    }
  }

  async deleteMedication(id) {
    try {
      await this.ensureInitialized();
      // Soft delete
      await this.db.runAsync(
        `UPDATE medications SET deleted = 1, server_synced = 0, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), id]
      );

      // Add to sync queue
      await this.addToSyncQueue('delete', 'medications', id, { id });
      
      return true;
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw error;
    }
  }

  /**
   * Dose logs CRUD operations
   */
  async saveDoseLog(doseLog) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot save dose log');
      }
      
      const now = new Date().toISOString();
      const id = doseLog.id || `dose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Check if dose log with this ID already exists
      const existing = await this.db.getFirstAsync(
        `SELECT * FROM dose_logs WHERE id = ?`,
        [id]
      );

      if (existing) {
        // Update existing record instead
        console.log('📝 Dose log already exists, updating:', id);
        return await this.updateDoseLog(id, {
          status: doseLog.status,
          taken_time: doseLog.taken_time,
          notes: doseLog.notes,
        });
      }

      // Insert new dose log
      try {
        await this.db.runAsync(
          `INSERT INTO dose_logs (
            id, user_id, medication_id, scheduled_time, status, taken_time, notes, created_at, server_synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            id,
            doseLog.user_id,
            doseLog.medication_id,
            doseLog.scheduled_time,
            doseLog.status,
            doseLog.taken_time || null,
            doseLog.notes || null,
            now,
          ]
        );
      } catch (insertError) {
        // If insert fails due to duplicate, try to update instead
        if (insertError.message && insertError.message.includes('UNIQUE constraint')) {
          console.log('⚠️ Duplicate dose log detected, updating instead:', id);
          return await this.updateDoseLog(id, {
            status: doseLog.status,
            taken_time: doseLog.taken_time,
            notes: doseLog.notes,
          });
        }
        throw insertError;
      }

      // Add to sync queue
      await this.addToSyncQueue('create', 'dose_logs', id, { ...doseLog, id });

      return { ...doseLog, id };
    } catch (error) {
      console.error('Error saving dose log:', error);
      throw error;
    }
  }

  async getDoseLogs(userId, medicationId = null) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        console.error('Database is null - cannot get dose logs');
        return [];
      }
      
      let query = `SELECT * FROM dose_logs WHERE user_id = ?`;
      const params = [userId];

      if (medicationId) {
        query += ` AND medication_id = ?`;
        params.push(medicationId);
      }

      query += ` ORDER BY scheduled_time DESC`;

      return await this.db.getAllAsync(query, params);
    } catch (error) {
      console.error('Error getting dose logs:', error);
      return [];
    }
  }

  async updateDoseLog(doseLogId, updates) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot update dose log');
      }
      
      const updateFields = [];
      const updateValues = [];
      
      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(updates.status);
      }
      
      if (updates.taken_time !== undefined) {
        updateFields.push('taken_time = ?');
        updateValues.push(updates.taken_time);
      }
      
      if (updates.notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(updates.notes);
      }
      
      // Mark as unsynced when updated
      updateFields.push('server_synced = ?');
      updateValues.push(0);
      
      if (updateFields.length === 0) {
        return; // Nothing to update
      }
      
      updateValues.push(doseLogId);
      
      await this.db.runAsync(
        `UPDATE dose_logs SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
      
      // Add to sync queue for update
      const doseLog = await this.db.getFirstAsync(
        `SELECT * FROM dose_logs WHERE id = ?`,
        [doseLogId]
      );
      
      if (doseLog) {
        await this.addToSyncQueue('update', 'dose_logs', doseLogId, doseLog);
      }
      
      return doseLog;
    } catch (error) {
      console.error('Error updating dose log:', error);
      throw error;
    }
  }

  /**
   * Sync queue operations
   */
  async addToSyncQueue(operationType, tableName, recordId, data) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        console.error('Database is null - cannot add to sync queue');
        return;
      }
      
      const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.db.runAsync(
        `INSERT INTO sync_queue (id, operation_type, table_name, record_id, data, created_at, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [id, operationType, tableName, recordId, JSON.stringify(data), new Date().toISOString()]
      );
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  }

  async getSyncQueue() {
    try {
      await this.ensureInitialized();
      return await this.db.getAllAsync(
        `SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 50`
      );
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  async removeFromSyncQueue(id) {
    try {
      await this.ensureInitialized();
      await this.db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
    } catch (error) {
      console.error('Error removing from sync queue:', error);
    }
  }

  async incrementSyncRetry(id) {
    try {
      await this.ensureInitialized();
      await this.db.runAsync(
        `UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?`,
        [id]
      );
    } catch (error) {
      console.error('Error incrementing sync retry:', error);
    }
  }

  /**
   * Mark records as synced
   */
  async markMedicationSynced(id) {
    try {
      await this.ensureInitialized();
      await this.db.runAsync(
        `UPDATE medications SET server_synced = 1 WHERE id = ?`,
        [id]
      );
    } catch (error) {
      console.error('Error marking medication as synced:', error);
    }
  }

  async markDoseLogSynced(id) {
    try {
      await this.ensureInitialized();
      await this.db.runAsync(
        `UPDATE dose_logs SET server_synced = 1 WHERE id = ?`,
        [id]
      );
    } catch (error) {
      console.error('Error marking dose log as synced:', error);
    }
  }

  /**
   * Get unsynced records
   */
  async getUnsyncedMedications() {
    try {
      await this.ensureInitialized();
      const result = await this.db.getAllAsync(
        `SELECT * FROM medications WHERE server_synced = 0 AND deleted = 0`
      );
      return result.map(med => ({
        ...med,
        times_of_day: typeof med.times_of_day === 'string' 
          ? JSON.parse(med.times_of_day) 
          : med.times_of_day,
        is_continuous: med.is_continuous === 1,
      }));
    } catch (error) {
      console.error('Error getting unsynced medications:', error);
      return [];
    }
  }

  async getUnsyncedDoseLogs() {
    try {
      await this.ensureInitialized();
      return await this.db.getAllAsync(
        `SELECT * FROM dose_logs WHERE server_synced = 0`
      );
    } catch (error) {
      console.error('Error getting unsynced dose logs:', error);
      return [];
    }
  }

  /**
   * Refills CRUD operations
   */
  async saveRefill(refill) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot save refill');
      }
      
      const now = new Date().toISOString();
      const id = refill.id || `refill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.db.runAsync(
        `INSERT INTO refills (id, user_id, medication_id, quantity, refill_date, notes, created_at, server_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          refill.user_id,
          refill.medication_id,
          refill.quantity,
          refill.refill_date,
          refill.notes || null,
          now,
        ]
      );

      // Update medication quantity_remaining
      const medication = await this.getMedicationById(refill.medication_id);
      if (medication) {
        const currentQuantity = medication.quantity_remaining || 0;
        const newQuantity = currentQuantity + refill.quantity;
        await this.db.runAsync(
          `UPDATE medications SET quantity_remaining = ? WHERE id = ?`,
          [newQuantity, refill.medication_id]
        );
      }

      return id;
    } catch (error) {
      console.error('Error saving refill:', error);
      throw error;
    }
  }

  async getRefills(userId, medicationId = null) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        console.error('Database is null - cannot get refills');
        return [];
      }
      
      let query = `SELECT * FROM refills WHERE user_id = ?`;
      const params = [userId];
      
      if (medicationId) {
        query += ` AND medication_id = ?`;
        params.push(medicationId);
      }
      
      query += ` ORDER BY refill_date DESC`;
      
      return await this.db.getAllAsync(query, params);
    } catch (error) {
      console.error('Error getting refills:', error);
      return [];
    }
  }

  async deleteRefill(refillId) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot delete refill');
      }

      // Get refill to update medication quantity
      const refill = await this.db.getFirstAsync(
        `SELECT * FROM refills WHERE id = ?`,
        [refillId]
      );

      if (refill) {
        // Subtract quantity from medication
        const medication = await this.getMedicationById(refill.medication_id);
        if (medication) {
          const currentQuantity = medication.quantity_remaining || 0;
          const newQuantity = Math.max(0, currentQuantity - refill.quantity);
          await this.db.runAsync(
            `UPDATE medications SET quantity_remaining = ? WHERE id = ?`,
            [newQuantity, refill.medication_id]
          );
        }
      }

      await this.db.runAsync(`DELETE FROM refills WHERE id = ?`, [refillId]);
    } catch (error) {
      console.error('Error deleting refill:', error);
      throw error;
    }
  }

  /**
   * Save health log
   */
  async saveHealthLog(healthLog) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot save health log');
      }
      
      const now = new Date().toISOString();
      const id = healthLog.id || `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const data = typeof healthLog.data === 'object' ? JSON.stringify(healthLog.data) : healthLog.data;

      await this.db.runAsync(
        `INSERT OR REPLACE INTO health_logs (
          id, user_id, log_type, data, recorded_at, created_at, server_synced
        ) VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          healthLog.user_id,
          healthLog.log_type,
          data,
          healthLog.recorded_at || now,
          now,
        ]
      );

      // Add to sync queue
      await this.addToSyncQueue('create', 'health_logs', id, healthLog);
    } catch (error) {
      console.error('Error saving health log:', error);
      throw error;
    }
  }

  /**
   * Get health logs for a user
   */
  async getHealthLogs(userId) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        console.error('Database is null - cannot get health logs');
        return [];
      }
      
      const query = `SELECT * FROM health_logs WHERE user_id = ? ORDER BY recorded_at DESC`;
      const logs = await this.db.getAllAsync(query, [userId]);
      
      // Parse JSON data
      return logs.map(log => ({
        ...log,
        data: typeof log.data === 'string' ? JSON.parse(log.data) : log.data,
      }));
    } catch (error) {
      console.error('Error getting health logs:', error);
      return [];
    }
  }

  /**
   * Save vitals log
   */
  async saveVitalsLog(vitalsLog) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot save vitals log');
      }
      
      const now = new Date().toISOString();
      const id = vitalsLog.id || `vitals_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.db.runAsync(
        `INSERT OR REPLACE INTO vitals_logs (
          id, user_id, weight, blood_pressure_systolic, blood_pressure_diastolic,
          blood_glucose, heart_rate, temperature, notes, recorded_at, created_at, server_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          vitalsLog.user_id,
          vitalsLog.weight || null,
          vitalsLog.blood_pressure_systolic || null,
          vitalsLog.blood_pressure_diastolic || null,
          vitalsLog.blood_glucose || null,
          vitalsLog.heart_rate || null,
          vitalsLog.temperature || null,
          vitalsLog.notes || null,
          vitalsLog.recorded_at || now,
          now,
        ]
      );

      // Add to sync queue
      await this.addToSyncQueue('create', 'vitals_logs', id, vitalsLog);
    } catch (error) {
      console.error('Error saving vitals log:', error);
      throw error;
    }
  }

  /**
   * Get vitals logs for a user
   */
  async getVitalsLogs(userId) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        console.error('Database is null - cannot get vitals logs');
        return [];
      }
      
      const query = `SELECT * FROM vitals_logs WHERE user_id = ? ORDER BY recorded_at DESC`;
      return await this.db.getAllAsync(query, [userId]);
    } catch (error) {
      console.error('Error getting vitals logs:', error);
      return [];
    }
  }

  /**
   * Save appointment
   */
  async saveAppointment(appointment) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot save appointment');
      }
      
      const now = new Date().toISOString();
      const id = appointment.id || `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.db.runAsync(
        `INSERT OR REPLACE INTO appointments (
          id, user_id, title, doctor_name, appointment_type, scheduled_time,
          location, notes, reminder_minutes, created_at, updated_at, server_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          appointment.user_id,
          appointment.title,
          appointment.doctor_name || null,
          appointment.appointment_type || null,
          appointment.scheduled_time,
          appointment.location || null,
          appointment.notes || null,
          appointment.reminder_minutes || 60,
          now,
          now,
        ]
      );

      // Add to sync queue
      await this.addToSyncQueue('create', 'appointments', id, appointment);
    } catch (error) {
      console.error('Error saving appointment:', error);
      throw error;
    }
  }

  /**
   * Get appointments for a user
   */
  async getAppointments(userId) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        console.error('Database is null - cannot get appointments');
        return [];
      }
      
      const query = `SELECT * FROM appointments WHERE user_id = ? ORDER BY scheduled_time ASC`;
      return await this.db.getAllAsync(query, [userId]);
    } catch (error) {
      console.error('Error getting appointments:', error);
      return [];
    }
  }

  /**
   * Delete appointment
   */
  async deleteAppointment(appointmentId) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot delete appointment');
      }

      // Delete from local database
      await this.db.runAsync(
        `DELETE FROM appointments WHERE id = ?`,
        [appointmentId]
      );

      // Add to sync queue for server deletion
      await this.addToSyncQueue('delete', 'appointments', appointmentId, { id: appointmentId });
      
      return true;
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  }

  /**
   * Save questionnaire answers
   */
  async saveQuestionnaireAnswers(userId, answers) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database is null - cannot save questionnaire answers');
      }

      const id = `questionnaire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const answersJson = JSON.stringify(answers);

      await this.db.runAsync(
        `INSERT OR REPLACE INTO questionnaire_answers (id, user_id, answers, completed_at, created_at, server_synced) VALUES (?, ?, ?, ?, ?, 0)`,
        [id, userId, answersJson, now, now]
      );

      return id;
    } catch (error) {
      console.error('Error saving questionnaire answers:', error);
      throw error;
    }
  }

  /**
   * Get questionnaire answers for a user
   */
  async getQuestionnaireAnswers(userId) {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        console.error('Database is null - cannot get questionnaire answers');
        return null;
      }

      const result = await this.db.getFirstAsync(
        `SELECT * FROM questionnaire_answers WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1`,
        [userId]
      );

      if (result) {
        return {
          ...result,
          answers: JSON.parse(result.answers),
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting questionnaire answers:', error);
      return null;
    }
  }
}

export default new DatabaseService();

