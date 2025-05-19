/**
 * Real Trading Module
 * Handles live trading with Binance
 */
const binance = require('./binance');
const strategy = require('../strategies/bob-is-awesome');
const account = require('../utils/account');

let isRunning = false;
let intervalId = null;
let currentPosition = null;

/**
 * Start the real trading process
 * @param {Object} config - Trading configuration
 */
async function start(config) {
  if (isRunning) {
    console.log('Trading is already running.');
    return;
  }
  
  try {
    console.log('Initializing Binance API...');
    binance.initialize(config.apiKey, config.apiSecret);
    
    // Log account information
    if (config.symbol.endsWith('USDT')) {
      const accountInfo = await binance.getAccountInfo();
      console.log(`Account Balance: ${accountInfo.balances.find(b => b.asset === 'USDT')?.free || 0} USDT`);
    }
    
    // Check for open positions
    const positions = await binance.getOpenPositions();
    const existingPosition = positions.find(p => p.symbol === config.symbol);
    
    if (existingPosition && parseFloat(existingPosition.positionAmt) !== 0) {
      console.log(`Found existing ${parseFloat(existingPosition.positionAmt) > 0 ? 'LONG' : 'SHORT'} position in ${config.symbol}`);
      
      // Track the existing position
      currentPosition = {
        direction: parseFloat(existingPosition.positionAmt) > 0 ? 'long' : 'short',
        entryPrice: parseFloat(existingPosition.entryPrice),
        size: Math.abs(parseFloat(existingPosition.positionAmt)),
        leverage: parseFloat(existingPosition.leverage)
      };
    }
    
    console.log(`Starting real trading for ${config.symbol}...`);
    isRunning = true;
    
    // Run initial analysis
    await runTradingCycle(config);
    
    // Set up regular interval for trading
    const intervalMinutes = 5; // Check every 5 minutes
    console.log(`Trading bot will check for signals every ${intervalMinutes} minutes.`);
    
    intervalId = setInterval(() => {
      runTradingCycle(config).catch(error => {
        console.error('Error in trading cycle:', error);
      });
    }, intervalMinutes * 60 * 1000);
    
  } catch (error) {
    console.error('Failed to start trading:', error);
    stop();
  }
}

/**
 * Process market data and execute trades based on strategy signals
 * @param {Object} config - Trading configuration
 */
async function processMarketData(config) {
  try {
    // Get current candle data
    console.log(`Fetching candle data for ${config.symbol}...`);
    const candles = await binance.getCandles(config.symbol, config.interval, { limit: 100 });
    
    if (!candles || candles.length === 0) {
      console.error('No candle data available.');
      return;
    }
    
    const currentPrice = await binance.getCurrentPrice(config.symbol);
    console.log(`Current ${config.symbol} price: $${currentPrice}`);
    
    // Get account information
    let accountBalance;
    
    // Get account info from spot or futures API
    const accountInfo = await binance.getAccountInfo();
    accountBalance = parseFloat(accountInfo.balances.find(b => b.asset === 'USDT')?.free || 0);
    
    const tradingAccount = { balance: accountBalance };
    
    // Execute strategy with account information
    const signal = strategy.analyze(candles, currentPosition, tradingAccount, config);
    
    // Log the signal with additional details
    if (signal.action !== 'wait' && signal.action !== 'hold') {
      const volatilityInfo = signal.volatility ? ` | Volatility: ${signal.volatility}%` : '';
      const adxInfo = signal.adx ? ` | ADX: ${signal.adx}` : '';
      const leverageInfo = signal.leverage ? ` | Leverage: ${signal.leverage}x` : '';
      
      console.log(`[${new Date().toISOString()}] Signal: ${signal.action.toUpperCase()} - ${signal.reason}${volatilityInfo}${adxInfo}${leverageInfo}`);
    } else {
      console.log(`[${new Date().toISOString()}] Signal: ${signal.action.toUpperCase()} - ${signal.reason}`);
    }
    
    // Execute trade based on signal
    if (signal.action === 'buy' && !currentPosition) {
      await executeBuy(config, signal, currentPrice);
    }
    else if (signal.action === 'sell' && !currentPosition) {
      await executeSell(config, signal, currentPrice);
    }
    else if (signal.action === 'exit' && currentPosition) {
      await executeExit(config, signal, currentPrice);
    }
    
  } catch (error) {
    console.error('Error in processing market data:', error);
  }
}

/**
 * Run a single trading cycle
 * @param {Object} config - Trading configuration
 */
async function runTradingCycle(config) {
  try {
    await processMarketData(config);
  } catch (error) {
    console.error('Error in trading cycle:', error);
  }
}

/**
 * Execute a buy order
 * @param {Object} config - Trading configuration
 * @param {Object} signal - Strategy signal
 * @param {number} price - Current price
 */
async function executeBuy(config, signal, price) {
  try {
    console.log(`Executing BUY order for ${config.symbol} @ $${price}`);
    
    // Get account balance
    let balance;
    
    if (signal.leverage > 1) {
      // Futures trading
      const futuresAccount = await binance.getFuturesAccountInfo();
      balance = parseFloat(futuresAccount.availableBalance);
    } else {
      // Spot trading
      const accountInfo = await binance.getAccountInfo();
      balance = parseFloat(accountInfo.balances.find(b => b.asset === 'USDT')?.free || 0);
    }
    
    console.log(`Available balance: $${balance}`);
    
    // Use position size and leverage from strategy signal
    const positionSize = signal.positionSize * signal.leverage;
    const margin = (positionSize * price) / signal.leverage;
    
    // Calculate fees
    const fees = margin * (config.feePercentage / 100);
    
    console.log(`Position size: ${positionSize} ${config.ticker}`);
    console.log(`Required margin: $${margin.toFixed(2)}`);
    console.log(`Leverage: ${signal.leverage}x (dynamically determined by strategy)`);
    
    // Round position size to appropriate precision
    const roundedSize = Math.floor(positionSize * 1000) / 1000;
    
    if (roundedSize <= 0) {
      console.error('Position size too small to execute.');
      return;
    }
    
    // Make sure we have enough balance
    if (margin + fees > balance) {
      console.error(`Insufficient balance for trade. Required: $${(margin + fees).toFixed(2)}, Available: $${balance.toFixed(2)}`);
      return;
    }
    
    // Set leverage (if using futures)
    if (signal.leverage > 1) {
      console.log(`Setting leverage to ${signal.leverage}x for ${config.symbol}`);
      await binance.setLeverage(config.symbol, signal.leverage);
    }
    
    // Execute order
    const orderOptions = signal.leverage > 1 ? { futures: true } : {};
    const order = await binance.placeMarketOrder(
      config.symbol,
      'BUY',
      roundedSize,
      orderOptions
    );
    
    console.log(`Order executed: ${JSON.stringify(order)}`);
    
    // Update position tracking
    currentPosition = {
      direction: signal.direction,
      entryPrice: price,
      size: roundedSize,
      leverage: signal.leverage,
      entryTime: Date.now(),
      entryReason: signal.reason,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit
    };
    
    console.log(`LONG position opened: ${roundedSize} ${config.ticker} @ $${price} | Leverage: ${signal.leverage}x | Volatility: ${signal.volatility}% | ADX: ${signal.adx}`);
  } catch (error) {
    console.error('Failed to execute buy order:', error);
  }
}

/**
 * Execute a sell order
 * @param {Object} config - Trading configuration
 * @param {Object} signal - Strategy signal
 * @param {number} price - Current price
 */
async function executeSell(config, signal, price) {
  try {
    console.log(`Executing SELL order for ${config.symbol} @ $${price}`);
    
    // Get account balance
    let balance;
    
    if (signal.leverage > 1) {
      // Futures trading
      const futuresAccount = await binance.getFuturesAccountInfo();
      balance = parseFloat(futuresAccount.availableBalance);
    } else {
      // Spot trading (can't short in spot, so return early)
      if (signal.leverage === 1) {
        console.log('Cannot execute short position in spot market.');
        return;
      }
      
      const accountInfo = await binance.getAccountInfo();
      balance = parseFloat(accountInfo.balances.find(b => b.asset === 'USDT')?.free || 0);
    }
    
    console.log(`Available balance: $${balance}`);
    
    // Use position size and leverage from strategy signal
    const positionSize = signal.positionSize * signal.leverage;
    const margin = (positionSize * price) / signal.leverage;
    
    // Calculate fees
    const fees = margin * (config.feePercentage / 100);
    
    console.log(`Position size: ${positionSize} ${config.ticker}`);
    console.log(`Required margin: $${margin.toFixed(2)}`);
    console.log(`Leverage: ${signal.leverage}x (dynamically determined by strategy)`);
    
    // Round position size to appropriate precision
    const roundedSize = Math.floor(positionSize * 1000) / 1000;
    
    if (roundedSize <= 0) {
      console.error('Position size too small to execute.');
      return;
    }
    
    // Make sure we have enough balance
    if (margin + fees > balance) {
      console.error(`Insufficient balance for trade. Required: $${(margin + fees).toFixed(2)}, Available: $${balance.toFixed(2)}`);
      return;
    }
    
    // Set leverage (if using futures)
    if (signal.leverage > 1) {
      console.log(`Setting leverage to ${signal.leverage}x for ${config.symbol}`);
      await binance.setLeverage(config.symbol, signal.leverage);
    }
    
    // Execute order
    const orderOptions = { futures: true };
    const order = await binance.placeMarketOrder(
      config.symbol,
      'SELL',
      roundedSize,
      orderOptions
    );
    
    console.log(`Order executed: ${JSON.stringify(order)}`);
    
    // Update position tracking
    currentPosition = {
      direction: signal.direction,
      entryPrice: price,
      size: roundedSize,
      leverage: signal.leverage,
      entryTime: Date.now(),
      entryReason: signal.reason,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit
    };
    
    console.log(`SHORT position opened: ${roundedSize} ${config.ticker} @ $${price} | Leverage: ${signal.leverage}x | Volatility: ${signal.volatility}% | ADX: ${signal.adx}`);
  } catch (error) {
    console.error('Failed to execute sell order:', error);
  }
}

/**
 * Execute an exit order
 * @param {Object} config - Trading configuration
 * @param {Object} signal - Strategy signal
 * @param {number} price - Current price
 */
async function executeExit(config, signal, price) {
  try {
    console.log(`Executing EXIT order for ${config.symbol} @ $${price}`);
    
    if (!currentPosition) {
      console.log('No position to exit.');
      return;
    }
    
    // Calculate profit/loss
    const pnl = account.calculatePnL(
      currentPosition.direction,
      currentPosition.entryPrice,
      price,
      currentPosition.size
    );
    
    const pnlPercentage = (pnl / (currentPosition.size * currentPosition.entryPrice)) * 100 * currentPosition.leverage;
    
    // Determine order side (opposite of position direction)
    const side = currentPosition.direction === 'long' ? 'SELL' : 'BUY';
    
    // Execute order
    const orderOptions = currentPosition.leverage > 1 ? { futures: true } : {};
    const order = await binance.placeMarketOrder(
      config.symbol,
      side,
      currentPosition.size,
      orderOptions
    );
    
    console.log(`Order executed: ${JSON.stringify(order)}`);
    
    console.log(`Position closed: ${currentPosition.size} ${config.ticker} @ $${price}`);
    console.log(`P&L: $${pnl.toFixed(2)} (${pnlPercentage.toFixed(2)}%)`);
    console.log(`Reason: ${signal.reason}`);
    
    // Clear position
    currentPosition = null;
  } catch (error) {
    console.error('Failed to execute exit order:', error);
  }
}

/**
 * Stop the trading process
 */
function stop() {
  if (!isRunning) {
    console.log('Trading is not running.');
    return;
  }
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  isRunning = false;
  console.log('Trading stopped.');
}

module.exports = {
  start,
  stop,
  runTradingCycle,
  processMarketData
}; 