/**
 * Trading Simulator
 * Runs backtests using historical price data
 */
const database = require('./database');
const account = require('./utils/account');
const strategy = require('./strategies/bob-is-awesome');

/**
 * Run a trading simulation based on historical data
 * @param {Object} config - Trading configuration
 */
async function run(config) {
  console.log('Initializing simulation...');
  
  try {
    // Initialize account
    const tradingAccount = account.createAccount(config.initialBalance);
    
    // Fetch historical price data from database
    console.log(`Fetching price data for ${config.ticker} from ${config.startDate} to ${config.endDate}...`);
    let priceData = await database.fetchPriceData(
      config.ticker,
      config.startDate,
      config.endDate,
      config.interval
    );
    
    // If no data in database, try to import from CSV
    if (!priceData || priceData.length === 0) {
      console.log(`No data found in database for ${config.ticker}. Trying to import from CSV...`);
      
      // Import data from CSV to database with optimization options
      const importOptions = {
        batchSize: 1000000,       // Larger batch size for faster imports
        showProgress: true     // Show progress bar
      };
      
      // Import data from CSV to database
      const importedCount = await database.importCSVToDatabase(config.ticker, importOptions);
      
      if (importedCount > 0) {
        console.log(`Successfully imported ${importedCount} records from CSV to database.`);
        
        // Fetch the data again from database
        priceData = await database.fetchPriceData(
          config.ticker,
          config.startDate,
          config.endDate,
          config.interval
        );
      }
      
      // If still no data after import attempt
      if (!priceData || priceData.length === 0) {
        throw new Error(
          `Could not find or import data for ${config.ticker}.\n` +
          `Please ensure CSV file exists at data/${config.ticker.toLowerCase()}_1min_data.csv`
        );
      }
    }
    
    console.log(`Loaded ${priceData.length} candles for simulation.`);
    
    // Run simulation
    console.log('Starting simulation...');
    
    // Initialize tracking variables
    let currentPosition = null;
    const tradeHistory = [];
    
    // Loop through each candle
    for (let i = 50; i < priceData.length; i++) {
      // Create a slice of data up to the current candle for analysis
      // (strategy should not look ahead)
      const candles = priceData.slice(0, i + 1);
      const currentCandle = candles[i];
      
      // Skip if account balance is too low AND we don't have an open position
      if (tradingAccount.balance < 2 && !currentPosition) {
        console.log('Account balance too low for new trades.');
        // Continue processing candles in case we have an open position we need to close
      } else if (tradingAccount.balance < 0.5) {
        console.log('Account balance critically low, stopping simulation.');
        break;
      }
      
      // Update current market price
      const currentPrice = currentCandle.close;
      
      // Execute strategy on the current data slice
      // Pass account details and config to strategy
      const signal = strategy.analyze(candles, currentPosition, tradingAccount, config);
      
      // Check if we need to stop the simulation (bankrupt)
      if (signal.action === 'stop') {
        console.log(`Stopping simulation: ${signal.reason}`);
        tradeHistory.push({
          timestamp: currentCandle.time,
          action: 'stop',
          reason: signal.reason,
          balance: tradingAccount.balance
        });
        break; // Exit the loop to stop the simulation
      }
      
      // Handle trading signals
      if (signal.action === 'buy' && !currentPosition) {
        // Strategy provides all position details including size, leverage, stops
        const positionSize = signal.positionSize * signal.leverage; // Leveraged size
        const margin = (positionSize * currentPrice) / signal.leverage;
        
        // Apply fees
        const fees = margin * (config.feePercentage / 100);
        
        // Make sure we don't exceed available balance
        if (margin + fees > tradingAccount.balance) {
          console.log(`Insufficient balance for trade. Required: $${(margin + fees).toFixed(2)}, Available: $${tradingAccount.balance.toFixed(2)}`);
          continue;
        }
        
        // Enter position
        currentPosition = {
          direction: signal.direction,
          entryPrice: currentPrice,
          size: positionSize,
          margin: margin,
          leverage: signal.leverage,
          entryTime: currentCandle.time,
          entryReason: signal.reason,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          entryBalance: tradingAccount.balance, // Store the balance at entry
          volatilityPercent: signal.volatilityPercent, // Store volatility from signal
          adx: signal.adx // Store ADX from signal
        };
        
        // Update account - reserve the margin and deduct fees
        tradingAccount.balance -= (margin + fees);
        
        console.log(formatTradeLog('open', currentPosition, currentPrice, null, null, tradingAccount.balance, signal.reason));
      }
      else if (signal.action === 'sell' && !currentPosition) {
        // Strategy provides all position details including size, leverage, stops
        const positionSize = signal.positionSize * signal.leverage; // Leveraged size
        const margin = (positionSize * currentPrice) / signal.leverage;
        
        // Apply fees
        const fees = margin * (config.feePercentage / 100);
        
        // Make sure we don't exceed available balance
        if (margin + fees > tradingAccount.balance) {
          console.log(`Insufficient balance for trade. Required: $${(margin + fees).toFixed(2)}, Available: $${tradingAccount.balance.toFixed(2)}`);
          continue;
        }
        
        // Enter position
        currentPosition = {
          direction: signal.direction,
          entryPrice: currentPrice,
          size: positionSize,
          margin: margin,
          leverage: signal.leverage,
          entryTime: currentCandle.time,
          entryReason: signal.reason,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          entryBalance: tradingAccount.balance, // Store the balance at entry
          volatilityPercent: signal.volatilityPercent, // Store volatility from signal
          adx: signal.adx // Store ADX from signal
        };
        
        // Update account - reserve the margin and deduct fees
        tradingAccount.balance -= (margin + fees);
        
        console.log(formatTradeLog('open', currentPosition, currentPrice, null, null, tradingAccount.balance, signal.reason));
      }
      else if (signal.action === 'exit' && currentPosition) {
        // Calculate P&L
        let pnl;
        if (currentPosition.direction === 'long') {
          // For long positions: (exit price - entry price) * size
          pnl = (currentPrice - currentPosition.entryPrice) * currentPosition.size;
        } else {
          // For short positions: (entry price - exit price) * size
          pnl = (currentPosition.entryPrice - currentPrice) * currentPosition.size;
        }
        
        // Apply fees
        const exitFees = currentPosition.margin * (config.feePercentage / 100);
        const totalPnl = pnl - exitFees;
        
        // Calculate profit percentage relative to margin
        const profitPercentage = (totalPnl / currentPosition.margin) * 100;
        
        // Record trade
        const trade = {
          ...currentPosition,
          exitPrice: currentPrice,
          exitTime: currentCandle.time,
          exitReason: signal.reason,
          profit: totalPnl,
          profitPercentage: profitPercentage,
          fees: exitFees
        };
        
        tradeHistory.push(trade);
        
        // Update account balance - add the margin back and the profit/loss
        tradingAccount.balance += currentPosition.margin + totalPnl;
        
        console.log(formatTradeLog('close', currentPosition, currentPrice, totalPnl, profitPercentage, tradingAccount.balance, signal.reason));
        
        // Reset position
        currentPosition = null;
      }
      // Check for stop loss and take profit - still handled here for price monitoring
      else if (currentPosition) {
        // For long positions
        if (currentPosition.direction === 'long') {
          // Check if price hit stop loss
          if (currentPrice <= currentPosition.stopLoss) {
            // Calculate P&L
            const pnl = (currentPrice - currentPosition.entryPrice) * currentPosition.size;
            
            // Apply fees
            const exitFees = currentPosition.margin * (config.feePercentage / 100);
            const totalPnl = pnl - exitFees;
            
            // Calculate profit percentage relative to margin
            const profitPercentage = (totalPnl / currentPosition.margin) * 100;
            
            // Record trade
            const trade = {
              ...currentPosition,
              exitPrice: currentPrice,
              exitTime: currentCandle.time,
              exitReason: 'Stop loss triggered',
              profit: totalPnl,
              profitPercentage: profitPercentage,
              fees: exitFees
            };
            
            tradeHistory.push(trade);
            
            // Update account balance - add the margin back and the profit/loss
            tradingAccount.balance += currentPosition.margin + totalPnl;
            
            console.log(formatTradeLog('close', currentPosition, currentPrice, totalPnl, profitPercentage, tradingAccount.balance, 'Stop loss triggered'));
            
            // Reset position
            currentPosition = null;
          }
          // Check if price hit take profit
          else if (currentPrice >= currentPosition.takeProfit) {
            // Calculate P&L
            const pnl = (currentPrice - currentPosition.entryPrice) * currentPosition.size;
            
            // Apply fees
            const exitFees = currentPosition.margin * (config.feePercentage / 100);
            const totalPnl = pnl - exitFees;
            
            // Calculate profit percentage relative to margin
            const profitPercentage = (totalPnl / currentPosition.margin) * 100;
            
            // Record trade
            const trade = {
              ...currentPosition,
              exitPrice: currentPrice,
              exitTime: currentCandle.time,
              exitReason: 'Take profit triggered',
              profit: totalPnl,
              profitPercentage: profitPercentage,
              fees: exitFees
            };
            
            tradeHistory.push(trade);
            
            // Update account balance - add the margin back and the profit/loss
            tradingAccount.balance += currentPosition.margin + totalPnl;
            
            console.log(formatTradeLog('close', currentPosition, currentPrice, totalPnl, profitPercentage, tradingAccount.balance, 'Take profit triggered'));
            
            // Reset position
            currentPosition = null;
          }
        }
        // For short positions
        else if (currentPosition.direction === 'short') {
          // Check if price hit stop loss
          if (currentPrice >= currentPosition.stopLoss) {
            // Calculate P&L
            const pnl = (currentPosition.entryPrice - currentPrice) * currentPosition.size;
            
            // Apply fees
            const exitFees = currentPosition.margin * (config.feePercentage / 100);
            const totalPnl = pnl - exitFees;
            
            // Calculate profit percentage relative to margin
            const profitPercentage = (totalPnl / currentPosition.margin) * 100;
            
            // Record trade
            const trade = {
              ...currentPosition,
              exitPrice: currentPrice,
              exitTime: currentCandle.time,
              exitReason: 'Stop loss triggered',
              profit: totalPnl,
              profitPercentage: profitPercentage,
              fees: exitFees
            };
            
            tradeHistory.push(trade);
            
            // Update account balance - add the margin back and the profit/loss
            tradingAccount.balance += currentPosition.margin + totalPnl;
            
            console.log(formatTradeLog('close', currentPosition, currentPrice, totalPnl, profitPercentage, tradingAccount.balance, 'Stop loss triggered'));
            
            // Reset position
            currentPosition = null;
          }
          // Check if price hit take profit
          else if (currentPrice <= currentPosition.takeProfit) {
            // Calculate P&L
            const pnl = (currentPosition.entryPrice - currentPrice) * currentPosition.size;
            
            // Apply fees
            const exitFees = currentPosition.margin * (config.feePercentage / 100);
            const totalPnl = pnl - exitFees;
            
            // Calculate profit percentage relative to margin
            const profitPercentage = (totalPnl / currentPosition.margin) * 100;
            
            // Record trade
            const trade = {
              ...currentPosition,
              exitPrice: currentPrice,
              exitTime: currentCandle.time,
              exitReason: 'Take profit triggered',
              profit: totalPnl,
              profitPercentage: profitPercentage,
              fees: exitFees
            };
            
            tradeHistory.push(trade);
            
            // Update account balance - add the margin back and the profit/loss
            tradingAccount.balance += currentPosition.margin + totalPnl;
            
            console.log(formatTradeLog('close', currentPosition, currentPrice, totalPnl, profitPercentage, tradingAccount.balance, 'Take profit triggered'));
            
            // Reset position
            currentPosition = null;
          }
        }
      }
    }
    
    // Calculate statistics
    const winningTrades = tradeHistory.filter(trade => trade.profit > 0);
    const losingTrades = tradeHistory.filter(trade => trade.profit <= 0);
    
    const totalProfit = winningTrades.reduce((sum, trade) => sum + trade.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profit, 0));
    
    const stats = {
      initialBalance: config.initialBalance,
      finalBalance: tradingAccount.balance,
      totalTrades: tradeHistory.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: tradeHistory.length > 0 ? (winningTrades.length / tradeHistory.length) * 100 : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
      pnl: tradingAccount.balance - config.initialBalance,
      pnlPercentage: ((tradingAccount.balance / config.initialBalance) - 1) * 100
    };
    
    // Save simulation results to database
    const simulationId = await database.saveSimulation(
      {
        ticker: config.ticker,
        startDate: config.startDate,
        endDate: config.endDate,
        feePercentage: config.feePercentage,
        slippagePercentage: config.slippagePercentage
      },
      { stats }
    );
    
    // Save trade history
    if (simulationId) {
      await database.saveTrades(simulationId, tradeHistory, { stats });
    }
    
    // Log simulation results
    console.log('\n==== SIMULATION RESULTS ====');
    console.log(`Initial Balance: $${stats.initialBalance.toFixed(2)}`);
    console.log(`Final Balance: $${stats.finalBalance.toFixed(2)}`);
    console.log(`P&L: $${stats.pnl.toFixed(2)} (${stats.pnlPercentage.toFixed(2)}%)`);
    console.log(`Total Trades: ${stats.totalTrades}`);
    console.log(`Win Rate: ${stats.winRate.toFixed(2)}%`);
    console.log(`Profit Factor: ${stats.profitFactor.toFixed(2)}`);
    console.log('===========================\n');
    
    // Cleanup
    await database.closeDatabase();
    console.log('Simulation completed.');
    
    return {
      stats,
      trades: tradeHistory
    };
  } catch (error) {
    console.error('Simulation failed:', error);
    await database.closeDatabase();
    throw error;
  }
}

function formatTradeLog(action, position, price, pnl = null, pnlPercent = null, balance = null, reason = null) {
  // Default timestamp if position doesn't have openTime 
  const timestamp = position && position.entryTime ? new Date(position.entryTime).toISOString() : new Date().toISOString();
  let logMessage = `[${timestamp}] `;
  
  if (action === 'open' && position) {
    const positionSize = position.size || 0;
    const leverageValue = position.leverage || 1;
    
    logMessage += `OPENED ${position.direction.toUpperCase()} @ $${price.toFixed(2)} | Size: ${positionSize.toFixed(5)} | Margin: $${position.margin.toFixed(2)} | Balance: $${balance.toFixed(2)} | Leverage: ${leverageValue}x`;
    
    // Add volatility and ADX if they exist in the position object
    if (position.volatilityPercent !== undefined) {
      logMessage += ` | Volatility: ${position.volatilityPercent}%`;
    } else {
      logMessage += ` | Volatility: N/A%`;
    }
    
    if (position.adx !== undefined) {
      logMessage += ` | ADX: ${position.adx}`;
    } else {
      logMessage += ` | ADX: N/A`;
    }
    
    if (reason) {
      logMessage += ` | Reason: ${reason}`;
    }
  } else if (action === 'close' && position) {
    logMessage += `CLOSED ${position.direction.toUpperCase()} @ $${price.toFixed(2)} | P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%) | Balance: $${balance.toFixed(2)}`;
    
    if (reason) {
      logMessage += ` | Reason: ${reason}`;
    }
  }

  return logMessage;
}

module.exports = {
  run
}; 