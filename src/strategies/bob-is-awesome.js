/**
 * Bob is Awesome!!!
 * This file contains the main trading logic that users can modify
 * 
 * Strategy: Ultra High-Frequency Scalping System v2
 * - Extremely frequent ultra-short term trading with micro-profit targets
 * - Optimized entry criteria to generate maximum trading opportunities
 * - Ultra-quick profit taking (0.1-0.2%) to accumulate many small wins
 * - Tight stop-loss management to minimize individual trade losses
 * - Sophisticated momentum-based entries with immediate trend detection
 * - Enhanced volatility filter to only trade during optimal conditions
 * - ADX trend strength filter to avoid trading in choppy markets
 */

const candlePatterns = require('../patterns/candlePatterns');
const indicators = require('../indicators');

/**
 * Analyze candle data and generate trading signals
 * @param {Array} candles - Array of price candles
 * @param {Object|null} currentPosition - Current open position or null if no position
 * @param {Object} account - Account information including balance
 * @param {Object} config - Trading configuration
 * @returns {Object} Signal object with action, reason, and position details
 */
function analyze(candles, currentPosition, account = {}, config = {}) {
  const accountBalance = account.balance || 1000;
  
  // Check for bankruptcy - stop simulation if balance <= 0
  if (accountBalance <= 0) {
    return { 
      action: 'stop', 
      reason: 'Account bankrupt - balance is zero or negative'
    };
  }
  
  if (candles.length < 15) {
    return { action: 'wait', reason: 'Not enough data' };
  }

  // Get candle data
  const currentCandle = candles[candles.length - 1];
  const previousCandle = candles[candles.length - 2];
  
  // Calculate EMAs for multiple timeframes
  const ema5 = indicators.calculateEMA(candles, 5);
  const ema8 = indicators.calculateEMA(candles, 8);
  const ema13 = indicators.calculateEMA(candles, 13);
  
  // Get previous EMAs for trend slope
  const prevEma5 = indicators.calculateEMA(candles.slice(0, -1), 5);
  const prevEma8 = indicators.calculateEMA(candles.slice(0, -1), 8);
  
  // Calculate RSI for overbought/oversold conditions
  const rsi = indicators.calculateRSI(candles, 14);
  const prevRsi = indicators.calculateRSI(candles.slice(0, -1), 14);
  
  // Calculate ATR for volatility and position sizing
  const atr = indicators.calculateATR(candles, 14);
  // Make sure we have a valid price for volatility calculation
  const volatilityPercent = currentCandle.close > 0 ? (atr / currentCandle.close * 100) : 0;

  // Calculate ADX for trend strength (values above 25 indicate strong trend)
  const adx = indicators.calculateADX(candles, 14);
  
  // Calculate MACD
  const macd = indicators.calculateMACD(candles);
  const prevMacd = indicators.calculateMACD(candles.slice(0, -1));
  
  // Calculate Stochastic
  const stoch = indicators.calculateStochastic(candles);
  const prevStoch = indicators.calculateStochastic(candles.slice(0, -1));
  
  // Detect price action
  const bullishCandle = currentCandle.close > currentCandle.open;
  const bearishCandle = currentCandle.close < currentCandle.open;
  
  // Check for price momentum
  const momentumUp = currentCandle.close > previousCandle.close;
  const momentumDown = currentCandle.close < previousCandle.close;
  
  // Candlestick patterns
  const isBullishEngulfing = candlePatterns.isBullishEngulfing(currentCandle, previousCandle);
  const isBearishEngulfing = candlePatterns.isBearishEngulfing(currentCandle, previousCandle);
  
  // Micro trend detection (optimized for super-short timeframe)
  const microUptrend = ema5 > prevEma5;
  const microDowntrend = ema5 < prevEma5;
  
  // Momentum detection 
  const quickBullishMomentum = (macd.histogram > 0 && macd.histogram > prevMacd.histogram) || (rsi > prevRsi);
  const quickBearishMomentum = (macd.histogram < 0 && macd.histogram < prevMacd.histogram) || (rsi < prevRsi);
  
  // Define smaller profit targets for ultra-fast trading
  const profitTarget = 0.1; // Reduced to 0.1% for super-fast trading
  
  // Very tight stops to minimize losses
  const stopLoss = 0.15; // Fixed 0.15% stop loss
  
  // Position management - Current open position
  if (currentPosition) {
    const currentPnL = currentPosition.direction === 'long'
      ? (currentCandle.close - currentPosition.entryPrice) / currentPosition.entryPrice * 100
      : (currentPosition.entryPrice - currentCandle.close) / currentPosition.entryPrice * 100;

    // Take profits at target
    if (currentPnL >= profitTarget) {
      return {
        action: 'exit',
        reason: 'Take profit hit',
        price: currentCandle.close
      };
    }
    
    // Stop loss
    if (currentPnL <= -stopLoss) {
      return {
        action: 'exit',
        reason: 'Stop loss hit',
        price: currentCandle.close
      };
    }
    
    // Long position management
    if (currentPosition.direction === 'long') {
      // Quick exit on any bearish signal
      if (bearishCandle || microDowntrend || macd.histogram < 0) {
        return {
          action: 'exit',
          reason: 'Trend change',
          price: currentCandle.close
        };
      }
      
      // Ultra-aggressive trailing stop - lock in profits at any level
      if (currentPnL > 0.05) {
        // Very tight trailing stop (0.05% below current price)
        const trailStopPrice = currentCandle.close * 0.9995;
        if (trailStopPrice > currentPosition.entryPrice) {
          return {
            action: 'exit',
            reason: 'Trailing stop hit',
            price: currentCandle.close
          };
        }
      }
    }
    
    // Short position management
    if (currentPosition.direction === 'short') {
      // Quick exit on any bullish signal
      if (bullishCandle || microUptrend || macd.histogram > 0) {
        return {
          action: 'exit',
          reason: 'Trend change',
          price: currentCandle.close
        };
      }
      
      // Ultra-aggressive trailing stop - lock in profits at any level
      if (currentPnL > 0.05) {
        // Very tight trailing stop (0.05% above current price)
        const trailStopPrice = currentCandle.close * 1.0005;
        if (trailStopPrice < currentPosition.entryPrice) {
          return {
            action: 'exit',
            reason: 'Trailing stop hit',
            price: currentCandle.close
          };
        }
      }
    }

    return {
      action: 'hold',
      reason: 'Maintaining position'
    };
  }
  
  // Only skip extremely low volatility periods
  if (volatilityPercent < 0.02) {
    return { action: 'wait', reason: 'Extremely low volatility' };
  }
  
  // Skip very weak trends unless volatility is high enough for scalping
  if (adx !== null && adx < 15 && volatilityPercent < 0.05) {
    return { action: 'wait', reason: 'Weak trend with insufficient volatility' };
  }
  
  // Aggressive position sizing for more trades
  const riskPercentage = 0.3;
  const riskAmount = accountBalance * (riskPercentage / 100);
  const stopLossAmount = currentCandle.close * (stopLoss / 100);
  let positionSize = riskAmount / stopLossAmount;
  
  // Limit position size to 20% of capital
  const maxPositionValue = accountBalance * 0.20;
  const positionValue = positionSize * currentCandle.close;
  if (positionValue > maxPositionValue) {
    positionSize = maxPositionValue / currentCandle.close;
  }
  
  // Conservative leverage for safer trading
  const leverage = 3;

  // Long Entry - Ultra-relaxed criteria to generate maximum trades
  const longSignal = 
    // Any positive price action is enough
    ((bullishCandle || momentumUp) &&
    // Only need one confirmation from any indicator
    (microUptrend || rsi > 40 || macd.histogram > 0 || stoch.k > stoch.d));
    
  // Special case for oversold condition with any positive price action
  const oversoldBounce = 
    (rsi < 40 && rsi > prevRsi) && 
    (bullishCandle || momentumUp);
  
  // Enhance entry criteria with ADX
  const strongTrendUp = adx !== null && adx > 20 && microUptrend;
    
  if ((longSignal || oversoldBounce || strongTrendUp) && !(adx !== null && adx < 15 && rsi > 60)) {
    // Set reason for logging
    let reason = 'Long setup';
    if (oversoldBounce) reason = 'Oversold bounce';
    if (strongTrendUp) reason = 'Strong uptrend detected';
    
    return {
      action: 'buy',
      reason: reason,
      direction: 'long',
      price: currentCandle.close,
      positionSize: positionSize,
      leverage: leverage,
      stopLoss: currentCandle.close * (1 - stopLoss/100),
      takeProfit: currentCandle.close * (1 + profitTarget/100),
      openTime: currentCandle.timestamp,
      volatilityPercent: volatilityPercent.toFixed(2), // Add volatility to signal
      adx: adx // Add ADX to signal
    };
  }

  // Short Entry - Ultra-relaxed criteria to generate maximum trades
  const shortSignal = 
    // Any negative price action is enough
    ((bearishCandle || momentumDown) &&
    // Only need one confirmation from any indicator
    (microDowntrend || rsi < 60 || macd.histogram < 0 || stoch.k < stoch.d));
  
  // Special case for overbought condition with any negative price action
  const overboughtDrop = 
    (rsi > 60 && rsi < prevRsi) && 
    (bearishCandle || momentumDown);
  
  // Enhance entry criteria with ADX
  const strongTrendDown = adx !== null && adx > 20 && microDowntrend;
    
  if ((shortSignal || overboughtDrop || strongTrendDown) && !(adx !== null && adx < 15 && rsi < 40)) {
    // Set reason for logging
    let reason = 'Short setup';
    if (overboughtDrop) reason = 'Overbought drop';
    if (strongTrendDown) reason = 'Strong downtrend detected';
    
    return {
      action: 'sell',
      reason: reason,
      direction: 'short',
      price: currentCandle.close,
      positionSize: positionSize,
      leverage: leverage,
      stopLoss: currentCandle.close * (1 + stopLoss/100),
      takeProfit: currentCandle.close * (1 - profitTarget/100),
      openTime: currentCandle.timestamp,
      volatilityPercent: volatilityPercent.toFixed(2), // Add volatility to signal
      adx: adx // Add ADX to signal
    };
  }

  return { action: 'wait', reason: 'Waiting for setup' };
}

module.exports = {
  analyze
}; 