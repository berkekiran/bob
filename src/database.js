const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Database file path
const dbPath = path.join(__dirname, '..', 'data', 'bob-db.sqlite');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

/**
 * Initialize database connection
 * 
 * @returns {Promise<Object>} Database connection
 */
async function initializeDatabase() {
  try {
    if (db) {
      return db;
    }
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await createTablesIfNeeded();

    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Create database tables if they don't exist
 */
async function createTablesIfNeeded() {
  const query = `
    -- Price data table for storing OHLCV data
    CREATE TABLE IF NOT EXISTS price_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create unique index to prevent duplicate records
    CREATE UNIQUE INDEX IF NOT EXISTS price_data_ticker_date_idx ON price_data (ticker, date);
    
    -- Create index for faster queries by date range
    CREATE INDEX IF NOT EXISTS price_data_date_idx ON price_data (date);

    -- Simulations table for storing backtest results
    CREATE TABLE IF NOT EXISTS simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL, 
      initial_balance REAL NOT NULL,
      final_balance REAL NOT NULL,
      total_trades INTEGER NOT NULL,
      winning_trades INTEGER NOT NULL,
      losing_trades INTEGER NOT NULL,
      pnl REAL NOT NULL,
      win_rate REAL NOT NULL,
      profit_factor REAL NOT NULL,
      fee_percentage REAL NOT NULL,
      slippage_percentage REAL NOT NULL,
      run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Trades table for storing individual trade records
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      entry_price REAL NOT NULL,
      exit_price REAL NOT NULL,
      size REAL NOT NULL,
      margin REAL NOT NULL,
      leverage REAL NOT NULL,
      entry_time TEXT NOT NULL,
      exit_time TEXT NOT NULL,
      entry_reason TEXT NOT NULL,
      exit_reason TEXT NOT NULL, 
      profit REAL NOT NULL,
      profit_percentage REAL NOT NULL,
      fees REAL NOT NULL,
      prev_balance REAL NOT NULL,
      new_balance REAL NOT NULL,
      FOREIGN KEY (simulation_id) REFERENCES simulations(id)
    );
    
    -- Create index for faster queries by simulation
    CREATE INDEX IF NOT EXISTS trades_simulation_idx ON trades (simulation_id);
  `;
  
  await db.exec(query);
}

/**
 * Close database connection
 */
async function closeDatabase() {
  try {
    if (db) {
      await db.close();
      db = null;
    }
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

/**
 * Format a date string for SQL query
 * 
 * @param {string} dateString - Date string in any format
 * @returns {string} Formatted date string (YYYY-MM-DD)
 */
function formatDateForSQL(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Fetch price data from database or CSV file
 * 
 * IMPORTANT NOTE: Default behavior is to use the SQLite database.
 * CSV files should only be used for specific testing purposes.
 * To use database: set useRealData=false in simulation options (default)
 * To use CSV: set useRealData=true in simulation options
 * 
 * @param {string} ticker - The stock ticker symbol
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} interval - Candle interval (1m, 1h, 4h, 1d)
 * @param {boolean} useRealData - Whether to use real data from CSV files
 * @returns {Array} Array of price candles
 */
async function fetchPriceData(ticker, startDate, endDate, interval = '1d', useRealData = false) {
  try {
    // Check if we should load from CSV file
    if (useRealData) {
      return await loadDataFromCSV(ticker, startDate, endDate, interval);
    }
    
    await initializeDatabase();
    
    // Format dates for the query
    const formattedStartDate = formatDateForSQL(startDate);
    const formattedEndDate = formatDateForSQL(endDate);
    
    // Check if we already have data for this ticker and date range
    const query = `
      SELECT * FROM price_data 
      WHERE ticker = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `;
    
    const rows = await db.all(query, [ticker, formattedStartDate, `${formattedEndDate} 23:59:59`]);
    
    console.log(`Found ${rows.length} candles in database for ${ticker}`);
    
    // Convert the database rows to candle format expected by the algorithm
    return rows.map(row => {
      let timestamp;
      
      // Handle different date formats
      if (typeof row.date === 'number') {
        // Unix timestamp in seconds
        timestamp = row.date * 1000; // Convert to milliseconds
      } else if (typeof row.date === 'string') {
        // ISO date string or other date format
        timestamp = new Date(row.date).getTime();
      } else {
        // Default fallback
        timestamp = new Date(row.date).getTime();
      }
      
      return {
        time: timestamp,
        timestamp: timestamp,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume)
      };
    });
  } catch (error) {
    console.error('Error fetching price data:', error);
    return [];
  }
}

/**
 * Load price data from CSV file
 * @param {string} ticker - The stock ticker symbol
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} interval - Candle interval (1m, 1h, 4h, 1d)
 * @returns {Array} Array of price candles
 */
async function loadDataFromCSV(ticker, startDate, endDate, interval = '1d') {
  try {
    const csv = require('csv-parser');
    
    // Define CSV file path based on ticker
    const csvFilePath = path.join(__dirname, '..', 'data', `${ticker.toLowerCase()}_1min_data.csv`);
    
    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
    }
    
    console.log(`Loading data from CSV file: ${csvFilePath}`);
    
    // Convert start and end dates to timestamps for comparison
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999); // End of the day
    
    const startTimestamp = startDateObj.getTime() / 1000; // Convert to seconds for comparison
    const endTimestamp = endDateObj.getTime() / 1000;     // Convert to seconds for comparison
    
    console.log(`Filtering data between ${new Date(startTimestamp * 1000).toISOString()} and ${new Date(endTimestamp * 1000).toISOString()}`);
    
    // Read and parse CSV file in a streaming manner
    const candles = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            // Parse timestamp from the CSV format (it's in Unix seconds)
            const timestamp = parseFloat(row.Timestamp || row.timestamp);
            
            // Check if timestamp is within range
            if (timestamp >= startTimestamp && timestamp <= endTimestamp) {
              // Create candle object with normalized field names
              candles.push({
                time: timestamp * 1000, // Convert to milliseconds
                timestamp: timestamp * 1000, // Convert to milliseconds
                open: parseFloat(row.Open || row.open),
                high: parseFloat(row.High || row.high),
                low: parseFloat(row.Low || row.low),
                close: parseFloat(row.Close || row.close),
                volume: parseFloat(row.Volume || row.volume || 0)
              });
            }
          } catch (err) {
            console.warn('Error parsing row:', err, row);
          }
        })
        .on('end', () => {
          // Sort candles by time
          candles.sort((a, b) => a.time - b.time);
          
          console.log(`Found ${candles.length} raw candles in the specified date range`);
          
          // Resample to the desired interval if needed
          const resampledCandles = resampleCandles(candles, interval);
          
          console.log(`Loaded ${resampledCandles.length} ${interval} candles from CSV for ${ticker}`);
          resolve(resampledCandles);
        })
        .on('error', (error) => {
          console.error('Error reading CSV file:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('Error loading data from CSV:', error);
    return [];
  }
}

/**
 * Resample candles to a different interval
 * @param {Array} candles - Array of 1-minute candles
 * @param {string} interval - Target interval (1m, 1h, 4h, 1d)
 * @returns {Array} Resampled candles
 */
function resampleCandles(candles, interval) {
  // If interval is 1m or candles array is empty, return as is
  if (interval === '1m' || candles.length === 0) {
    return candles;
  }
  
  // Define interval in milliseconds
  let intervalMs;
  switch (interval) {
    case '1h':
      intervalMs = 60 * 60 * 1000;
      break;
    case '4h':
      intervalMs = 4 * 60 * 60 * 1000;
      break;
    case '1d':
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    default:
      return candles; // Return original if interval not recognized
  }
  
  // Group candles by interval
  const groupedCandles = {};
  
  for (const candle of candles) {
    // Calculate the start of the interval this candle belongs to
    const intervalStart = Math.floor(candle.time / intervalMs) * intervalMs;
    
    // Initialize group if it doesn't exist
    if (!groupedCandles[intervalStart]) {
      groupedCandles[intervalStart] = {
        time: intervalStart,
        timestamp: intervalStart,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      };
    } else {
      // Update high and low
      groupedCandles[intervalStart].high = Math.max(groupedCandles[intervalStart].high, candle.high);
      groupedCandles[intervalStart].low = Math.min(groupedCandles[intervalStart].low, candle.low);
      // Update close to the last candle in the interval
      groupedCandles[intervalStart].close = candle.close;
      // Sum volumes
      groupedCandles[intervalStart].volume += candle.volume;
    }
  }
  
  // Convert object to array and sort by time
  return Object.values(groupedCandles).sort((a, b) => a.time - b.time);
}

/**
 * Insert sample data into the database
 * @param {string} ticker - The stock ticker symbol
 * @param {Array} candles - Array of candle data
 */
async function insertSampleData(ticker, candles) {
  try {
    await initializeDatabase();
    
    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    const insertStmt = await db.prepare(`
      INSERT INTO price_data (ticker, date, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Insert each candle
    for (const candle of candles) {
      const date = new Date(candle.time).toISOString();
      await insertStmt.run([
        ticker,
        date,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume
      ]);
    }
    
    // Finalize statement and commit transaction
    await insertStmt.finalize();
    await db.run('COMMIT');
    
    console.log(`Inserted ${candles.length} sample data rows for ${ticker}`);
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Error inserting sample data:', error);
  }
}

/**
 * Save simulation results to database
 * @param {Object} config - Simulation config
 * @param {Object} account - Account state with results
 * @returns {Promise<number>} The ID of the inserted simulation
 */
async function saveSimulation(config, account) {
  try {
    await initializeDatabase();
    
    const result = await db.run(`
      INSERT INTO simulations (
        ticker, start_date, end_date, initial_balance, final_balance,
        total_trades, winning_trades, losing_trades, pnl, win_rate,
        profit_factor, fee_percentage, slippage_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.ticker,
      config.startDate,
      config.endDate,
      account.stats.initialBalance,
      account.stats.finalBalance,
      account.stats.totalTrades,
      account.stats.winningTrades,
      account.stats.losingTrades,
      account.stats.pnl,
      account.stats.winRate,
      account.stats.profitFactor,
      config.feePercentage,
      config.slippagePercentage
    ]);
    
    console.log(`Saved simulation #${result.lastID} to database`);
    return result.lastID;
  } catch (error) {
    console.error('Error saving simulation:', error);
    return null;
  }
}

/**
 * Save trade history to database
 * @param {number} simulationId - ID of the parent simulation
 * @param {Array} trades - Array of trade objects
 * @param {Object} account - Account state with balance history
 * @returns {Promise<boolean>} Success status
 */
async function saveTrades(simulationId, trades, account) {
  if (!simulationId) return false;
  
  try {
    await initializeDatabase();
    
    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    const insertStmt = await db.prepare(`
      INSERT INTO trades (
        simulation_id, direction, entry_price, exit_price, size,
        margin, leverage, entry_time, exit_time, entry_reason,
        exit_reason, profit, profit_percentage, fees, prev_balance, new_balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Start with initial balance
    let runningBalance = account.stats.initialBalance;
    
    // Insert each trade
    for (const trade of trades) {
      const prevBalance = runningBalance;
      // Update running balance
      runningBalance += trade.profit;
      
      await insertStmt.run([
        simulationId,
        trade.direction,
        trade.entryPrice,
        trade.exitPrice,
        trade.size,
        trade.margin,
        trade.leverage || 1,
        new Date(trade.entryTime).toISOString(),
        new Date(trade.exitTime).toISOString(),
        trade.entryReason,
        trade.exitReason,
        trade.profit,
        trade.profitPercentage,
        trade.fees,
        prevBalance,
        runningBalance
      ]);
    }
    
    // Finalize statement and commit transaction
    await insertStmt.finalize();
    await db.run('COMMIT');
    
    console.log(`Saved ${trades.length} trades for simulation #${simulationId} to database`);
    return true;
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Error saving trades:', error);
    return false;
  }
}

/**
 * Import CSV data into the database with optimized batch processing
 * @param {string} ticker - The ticker symbol
 * @param {Object} options - Import options
 * @param {number} options.maxRecords - Maximum number of records to import (default: all)
 * @param {boolean} options.showProgress - Whether to show progress bar (default: true)
 * @returns {Promise<number>} Number of records imported
 */
async function importCSVToDatabase(ticker, options = {}) {
  const fs = require('fs');
  const path = require('path');
  const { exec } = require('child_process');
  const os = require('os');
  
  const maxRecords = options.maxRecords || Number.MAX_SAFE_INTEGER;
  const showProgress = options.showProgress !== false;
  
  let progressBar = null;
  let tempFile = null;
  let sqlFile = null;
  
  try {
    // Initialize database connection
    await initializeDatabase();
    
    // Get the CSV file path
    const csvFilePath = path.join(__dirname, '..', 'data', `${ticker.toLowerCase()}_1min_data.csv`);
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      return 0;
    }
    
    console.log(`Importing ${ticker} data from ${csvFilePath}...`);
    
    // Check if we already have data for this ticker
    const checkResult = await db.get('SELECT COUNT(*) as count FROM price_data WHERE ticker = ?', [ticker]);
    if (checkResult && checkResult.count > 0) {
      console.log(`Found ${checkResult.count.toLocaleString()} existing records for ${ticker}. Skipping import.`);
      return checkResult.count;
    }
    
    // Create progress bar if needed
    if (showProgress) {
      const cliProgress = require('cli-progress');
      progressBar = new cliProgress.SingleBar({
        format: 'Importing [{bar}] {percentage}% | {value}/{total} records',
        barCompleteChar: '=',
        barIncompleteChar: ' '
      }, cliProgress.Presets.shades_classic);
      
      progressBar.start(100, 0); // We'll use percentage since we can't easily track records
    }
    
    // Need to close database connection before using SQLite CLI
    await closeDatabase();
    
    // Generate a temp CSV file with proper headers that SQLite can directly import
    const tempDir = os.tmpdir();
    tempFile = path.join(tempDir, `bob_${ticker.toLowerCase()}_import_${Date.now()}.csv`);
    
    console.log(`Creating temporary file: ${tempFile}`);
    
    // Create a stream to write the processed CSV data
    const writeStream = fs.createWriteStream(tempFile);
    
    // Write header with column names matching our table
    writeStream.write('ticker,date,open,high,low,close,volume\n');
    
    // Read and transform the source CSV
    const readline = require('readline');
    const readInterface = readline.createInterface({
      input: fs.createReadStream(csvFilePath),
      crlfDelay: Infinity
    });
    
    let lineCount = 0;
    let isHeader = true;
    
    console.log('Processing CSV data...');
    
    for await (const line of readInterface) {
      // Skip header
      if (isHeader) {
        isHeader = false;
        continue;
      }
      
      lineCount++;
      
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Parse CSV line
      const [timestamp, open, high, low, close, volume] = line.split(',');
      
      if (!timestamp || isNaN(parseFloat(open)) || isNaN(parseFloat(high)) || 
          isNaN(parseFloat(low)) || isNaN(parseFloat(close))) {
        continue; // Skip invalid data
      }
      
      // Convert timestamp to date
      const date = new Date(parseInt(timestamp) * 1000).toISOString();
      
      // Write the transformed line to the temporary file
      writeStream.write(`${ticker},${date},${open},${high},${low},${close},${volume || 0}\n`);
      
      // Update progress occasionally
      if (lineCount % 100000 === 0) {
        console.log(`Processed ${lineCount.toLocaleString()} lines...`);
        if (showProgress) {
          // Update progress based on percentage of max records
          const progress = Math.min(100, Math.floor((lineCount / maxRecords) * 100));
          progressBar.update(progress);
        }
      }
      
      // Stop if we've reached max records
      if (lineCount >= maxRecords) {
        break;
      }
    }
    
    // Close the write stream
    await new Promise((resolve) => {
      writeStream.end(resolve);
    });
    
    console.log(`Processed ${lineCount.toLocaleString()} lines to temporary file`);
    
    if (showProgress) {
      progressBar.update(50); // We're halfway done
    }
    
    // Create a SQL file for SQLite to execute
    const dbPath = path.join(__dirname, '..', 'data', 'bob-db.sqlite');
    sqlFile = path.join(tempDir, `bob_${ticker.toLowerCase()}_import_${Date.now()}.sql`);
    
    // Write SQL commands to file
    fs.writeFileSync(sqlFile, `
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
PRAGMA cache_size = -50000;
PRAGMA temp_store = MEMORY;

-- Create temp table
CREATE TEMPORARY TABLE temp_import (
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL
);

-- Set mode to CSV
.mode csv
.import "${tempFile}" temp_import

-- Count records
.output ${sqlFile}.count
SELECT COUNT(*) FROM temp_import;
.output stdout

-- Insert into main table
BEGIN TRANSACTION;
INSERT OR IGNORE INTO price_data (ticker, date, open, high, low, close, volume)
SELECT ticker, date, open, high, low, close, volume FROM temp_import;
COMMIT;

-- Drop the temp table
DROP TABLE temp_import;

-- Optimize
PRAGMA optimize;
`);
    
    console.log('Running SQLite import command...');
    
    // Execute the SQLite command
    const importCmd = `sqlite3 "${dbPath}" < "${sqlFile}"`;
    const { stdout, stderr } = await executeCommand(importCmd);
    
    if (stderr) {
      console.error('SQLite error:', stderr);
    }
    
    // Get the number of records imported from the count file
    let recordsImported = 0;
    try {
      const countFile = `${sqlFile}.count`;
      if (fs.existsSync(countFile)) {
        const countData = fs.readFileSync(countFile, 'utf8');
        recordsImported = parseInt(countData.trim(), 10);
        fs.unlinkSync(countFile);
      }
    } catch (e) {
      console.warn('Error reading count file:', e.message);
      recordsImported = lineCount; // Fallback to line count
    }
    
    // Clean up temp files
    try {
      if (tempFile) fs.unlinkSync(tempFile);
      if (sqlFile) fs.unlinkSync(sqlFile);
    } catch (e) {
      console.warn('Error cleaning up temp files:', e.message);
    }
    
    // Update progress
    if (showProgress) {
      progressBar.update(100);
      progressBar.stop();
    }
    
    // Reinitialize the database connection
    await initializeDatabase();
    
    console.log(`${ticker} import complete: ${recordsImported.toLocaleString()} records added`);
    return recordsImported;
  } catch (error) {
    console.error('Import error:', error);
    
    if (progressBar) {
      progressBar.stop();
    }
    
    // Clean up temp files
    try {
      if (tempFile) fs.unlinkSync(tempFile);
      if (sqlFile) fs.unlinkSync(sqlFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // Reinitialize the database connection in case it was closed
    try {
      await initializeDatabase();
    } catch (e) {
      // Ignore initialization errors
    }
    
    return 0;
  }
}

/**
 * Execute a shell command as a promise
 * @param {string} command - The command to execute
 * @returns {Promise<Object>} stdout and stderr
 */
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Process all imports or a specific ticker
 * @param {string|null} specificTicker - Ticker to import or null for all
 */
async function processImports(specificTicker = null) {
  const TICKERS = ['BTC', 'ETH', 'AAPL'];
  
  try {
    console.log('Starting CSV import process...');
    
    // Import specific ticker or all tickers
    const tickersToImport = specificTicker ? [specificTicker] : TICKERS;
    
    // Track overall stats
    let totalImported = 0;
    
    // Process each ticker
    for (const ticker of tickersToImport) {
      console.log(`\nProcessing ${ticker}...`);
      
      // Import the CSV file for this ticker
      const importedCount = await importCSVToDatabase(ticker);
      totalImported += importedCount;
    }
    
    // Create indexes for better query performance
    await createPerformanceIndexes();
    
    console.log(`\nImport process completed. Total records imported: ${totalImported}`);
    
    // Close database connection
    await closeDatabase();
    
    return totalImported;
  } catch (error) {
    console.error('Error during import process:', error);
    return 0;
  }
}

/**
 * Create additional performance indexes after import
 */
async function createPerformanceIndexes() {
  try {
    console.log('Creating performance indexes...');
    
    // Start timing
    const startTime = Date.now();
    
    // Begin transaction for faster indexing
    await db.run('BEGIN TRANSACTION');
    
    // Create indexes
    await db.run('CREATE INDEX IF NOT EXISTS price_data_ticker_idx ON price_data (ticker)');
    await db.run('CREATE INDEX IF NOT EXISTS price_data_ticker_date_close_idx ON price_data (ticker, date, close)');
    
    // Commit transaction
    await db.run('COMMIT');
    
    // End timing
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`Performance indexes created in ${duration.toFixed(2)} seconds`);
  } catch (error) {
    console.error('Error creating indexes:', error);
    try {
      await db.run('ROLLBACK');
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

module.exports = {
  initializeDatabase,
  closeDatabase,
  fetchPriceData,
  saveSimulation,
  saveTrades,
  loadDataFromCSV,
  resampleCandles,
  importCSVToDatabase,
  processImports,
  createPerformanceIndexes
};

// CLI Import functionality - Check if this file is being run directly
if (require.main === module) {
  const TICKERS = ['BTC', 'ETH', 'AAPL'];
  
  // Get ticker from command line arguments if provided
  const specificTicker = process.argv[2] ? process.argv[2].toUpperCase() : null;
  
  // Validate ticker if provided
  if (specificTicker && !TICKERS.includes(specificTicker)) {
    console.error(`Invalid ticker: ${specificTicker}`);
    console.log(`Available tickers: ${TICKERS.join(', ')}`);
    process.exit(1);
  }
  
  // Run the import process
  processImports(specificTicker)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Import failed:', err);
      process.exit(1);
    });
} 