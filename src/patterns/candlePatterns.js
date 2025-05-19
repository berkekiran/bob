/**
 * Candle Patterns for Scalp Trading
 * This file contains functions to detect various candle patterns useful for scalp trading
 */

/**
 * Check if a candle is a doji (open and close are very close)
 * @param {Object} candle - Price candle object
 * @param {number} tolerance - Tolerance percentage for price difference (default 0.05%)
 * @returns {boolean} True if the candle is a doji
 */
function isDoji(candle, tolerance = 0.05) {
  const bodySize = Math.abs(candle.close - candle.open);
  const candleRange = candle.high - candle.low;
  
  // Body size is very small compared to the range
  return bodySize <= (candleRange * (tolerance / 100));
}

/**
 * Check if a candle is a hammer (potential bullish reversal)
 * @param {Object} candle - Price candle object
 * @returns {boolean} True if the candle is a hammer
 */
function isHammer(candle) {
  const bodySize = Math.abs(candle.close - candle.open);
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  
  // Lower shadow should be at least 2x the body size
  // Upper shadow should be small
  return lowerShadow >= (bodySize * 2) && upperShadow <= (bodySize * 0.5);
}

/**
 * Check if a candle is a shooting star (potential bearish reversal)
 * @param {Object} candle - Price candle object
 * @returns {boolean} True if the candle is a shooting star
 */
function isShootingStar(candle) {
  const bodySize = Math.abs(candle.close - candle.open);
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  
  // Upper shadow should be at least 2x the body size
  // Lower shadow should be small
  return upperShadow >= (bodySize * 2) && lowerShadow <= (bodySize * 0.5);
}

/**
 * Check if a candle is a bullish engulfing pattern
 * @param {Object} currentCandle - Current price candle
 * @param {Object} previousCandle - Previous price candle
 * @returns {boolean} True if the pattern is a bullish engulfing
 */
function isBullishEngulfing(currentCandle, previousCandle) {
  // Previous candle must be bearish (close < open)
  const prevBearish = previousCandle.close < previousCandle.open;
  
  // Current candle must be bullish (close > open)
  const currBullish = currentCandle.close > currentCandle.open;
  
  // Current candle's body must engulf previous candle's body
  const engulfed = currentCandle.open < previousCandle.close && 
                   currentCandle.close > previousCandle.open;
  
  return prevBearish && currBullish && engulfed;
}

/**
 * Check if a candle is a bearish engulfing pattern
 * @param {Object} currentCandle - Current price candle
 * @param {Object} previousCandle - Previous price candle
 * @returns {boolean} True if the pattern is a bearish engulfing
 */
function isBearishEngulfing(currentCandle, previousCandle) {
  // Previous candle must be bullish (close > open)
  const prevBullish = previousCandle.close > previousCandle.open;
  
  // Current candle must be bearish (close < open)
  const currBearish = currentCandle.close < currentCandle.open;
  
  // Current candle's body must engulf previous candle's body
  const engulfed = currentCandle.open > previousCandle.close && 
                   currentCandle.close < previousCandle.open;
  
  return prevBullish && currBearish && engulfed;
}

/**
 * Check if candles form a bullish harami pattern
 * @param {Object} currentCandle - Current price candle
 * @param {Object} previousCandle - Previous price candle
 * @returns {boolean} True if the pattern is a bullish harami
 */
function isBullishHarami(currentCandle, previousCandle) {
  // Previous candle must be bearish (close < open)
  const prevBearish = previousCandle.close < previousCandle.open;
  
  // Current candle must be bullish (close > open)
  const currBullish = currentCandle.close > currentCandle.open;
  
  // Current candle's body must be inside previous candle's body
  const insideBody = currentCandle.open > previousCandle.close && 
                     currentCandle.close < previousCandle.open;
  
  return prevBearish && currBullish && insideBody;
}

/**
 * Check if candles form a bearish harami pattern
 * @param {Object} currentCandle - Current price candle
 * @param {Object} previousCandle - Previous price candle
 * @returns {boolean} True if the pattern is a bearish harami
 */
function isBearishHarami(currentCandle, previousCandle) {
  // Previous candle must be bullish (close > open)
  const prevBullish = previousCandle.close > previousCandle.open;
  
  // Current candle must be bearish (close < open)
  const currBearish = currentCandle.close < currentCandle.open;
  
  // Current candle's body must be inside previous candle's body
  const insideBody = currentCandle.open < previousCandle.close && 
                     currentCandle.close > previousCandle.open;
  
  return prevBullish && currBearish && insideBody;
}

/**
 * Check if candles form a morning star pattern (bullish reversal)
 * @param {Object} c1 - First candle (oldest)
 * @param {Object} c2 - Second candle (middle)
 * @param {Object} c3 - Third candle (newest)
 * @returns {boolean} True if the pattern is a morning star
 */
function isMorningStar(c1, c2, c3) {
  // First candle is bearish with large body
  const c1Bearish = c1.close < c1.open;
  const c1LargeBody = Math.abs(c1.close - c1.open) > ((c1.high - c1.low) * 0.6);
  
  // Second candle has small body (potential doji)
  const c2SmallBody = Math.abs(c2.close - c2.open) < ((c2.high - c2.low) * 0.3);
  
  // Gap down between first and second candles
  const gapDown = Math.max(c2.open, c2.close) < c1.close;
  
  // Third candle is bullish with large body
  const c3Bullish = c3.close > c3.open;
  const c3LargeBody = Math.abs(c3.close - c3.open) > ((c3.high - c3.low) * 0.6);
  
  // Third candle closes into first candle's body
  const closes = c3.close > (c1.open + c1.close) / 2;
  
  return c1Bearish && c1LargeBody && c2SmallBody && gapDown && c3Bullish && c3LargeBody && closes;
}

/**
 * Check if candles form an evening star pattern (bearish reversal)
 * @param {Object} c1 - First candle (oldest)
 * @param {Object} c2 - Second candle (middle)
 * @param {Object} c3 - Third candle (newest)
 * @returns {boolean} True if the pattern is an evening star
 */
function isEveningStar(c1, c2, c3) {
  // First candle is bullish with large body
  const c1Bullish = c1.close > c1.open;
  const c1LargeBody = Math.abs(c1.close - c1.open) > ((c1.high - c1.low) * 0.6);
  
  // Second candle has small body (potential doji)
  const c2SmallBody = Math.abs(c2.close - c2.open) < ((c2.high - c2.low) * 0.3);
  
  // Gap up between first and second candles
  const gapUp = Math.min(c2.open, c2.close) > c1.close;
  
  // Third candle is bearish with large body
  const c3Bearish = c3.close < c3.open;
  const c3LargeBody = Math.abs(c3.close - c3.open) > ((c3.high - c3.low) * 0.6);
  
  // Third candle closes into first candle's body
  const closes = c3.close < (c1.open + c1.close) / 2;
  
  return c1Bullish && c1LargeBody && c2SmallBody && gapUp && c3Bearish && c3LargeBody && closes;
}

/**
 * Check if candle has high volume compared to recent candles
 * @param {Object} candle - Current candle
 * @param {Array} candles - Array of recent candles
 * @param {number} lookback - Number of candles to look back for volume comparison
 * @returns {boolean} True if candle has high volume
 */
function hasHighVolume(candle, candles, lookback = 10) {
  if (!candle.volume || !candles.length || candles.length < lookback) {
    return false;
  }
  
  // Get average volume of recent candles
  const recentCandles = candles.slice(-lookback);
  const avgVolume = recentCandles.reduce((sum, c) => sum + (c.volume || 0), 0) / lookback;
  
  // Check if current volume is significantly higher
  return candle.volume > (avgVolume * 1.5);
}

/**
 * Check if candles form a three white soldiers pattern (strong bullish)
 * @param {Object} c1 - First candle (oldest)
 * @param {Object} c2 - Second candle
 * @param {Object} c3 - Third candle (newest)
 * @returns {boolean} True if the pattern is three white soldiers
 */
function isThreeWhiteSoldiers(c1, c2, c3) {
  // All three candles must be bullish
  const allBullish = c1.close > c1.open && c2.close > c2.open && c3.close > c3.open;
  
  // Each candle should close higher than the previous
  const higherCloses = c3.close > c2.close && c2.close > c1.close;
  
  // Each candle should open within the previous candle's body
  const properOpens = c2.open > c1.open && c2.open < c1.close && 
                      c3.open > c2.open && c3.open < c2.close;
  
  // Each candle should have small upper wicks
  const smallUpperWicks = (c1.high - c1.close) < (c1.close - c1.open) * 0.3 &&
                          (c2.high - c2.close) < (c2.close - c2.open) * 0.3 &&
                          (c3.high - c3.close) < (c3.close - c3.open) * 0.3;
  
  return allBullish && higherCloses && properOpens && smallUpperWicks;
}

/**
 * Check if candles form a three black crows pattern (strong bearish)
 * @param {Object} c1 - First candle (oldest)
 * @param {Object} c2 - Second candle
 * @param {Object} c3 - Third candle (newest)
 * @returns {boolean} True if the pattern is three black crows
 */
function isThreeBlackCrows(c1, c2, c3) {
  // All three candles must be bearish
  const allBearish = c1.close < c1.open && c2.close < c2.open && c3.close < c3.open;
  
  // Each candle should close lower than the previous
  const lowerCloses = c3.close < c2.close && c2.close < c1.close;
  
  // Each candle should open within the previous candle's body
  const properOpens = c2.open < c1.open && c2.open > c1.close && 
                      c3.open < c2.open && c3.open > c2.close;
  
  // Each candle should have small lower wicks
  const smallLowerWicks = (c1.open - c1.low) < (c1.open - c1.close) * 0.3 &&
                          (c2.open - c2.low) < (c2.open - c2.close) * 0.3 &&
                          (c3.open - c3.low) < (c3.open - c3.close) * 0.3;
  
  return allBearish && lowerCloses && properOpens && smallLowerWicks;
}

/**
 * Calculate candle strength (bullish or bearish)
 * @param {Object} candle - Price candle
 * @returns {number} Strength value (-10 to +10) where positive is bullish
 */
function calcCandleStrength(candle) {
  if (!candle) return 0;
  
  let strength = 0;
  const range = candle.high - candle.low;
  const body = Math.abs(candle.close - candle.open);
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  
  // Determine if bullish or bearish
  const isBullish = candle.close > candle.open;
  
  // Base strength from candle direction
  strength += isBullish ? 3 : -3;
  
  // Adjust strength based on body size
  if (body > range * 0.7) {
    strength += isBullish ? 3 : -3; // Strong candle
  } else if (body < range * 0.2) {
    strength /= 2; // Weak candle (doji-like)
  }
  
  // Adjust strength based on wicks
  if (isBullish && lowerWick > body * 2) {
    strength += 2; // Bullish with long lower wick (buying pressure)
  } else if (!isBullish && upperWick > body * 2) {
    strength -= 2; // Bearish with long upper wick (selling pressure)
  }
  
  // Cap strength between -10 and 10
  return Math.max(-10, Math.min(10, strength));
}

/**
 * Detect the most significant candle pattern in a group of candles
 * @param {Array} candles - Array of price candles
 * @returns {Object} Pattern information including type and strength
 */
function detectPattern(candles) {
  if (!candles || candles.length < 3) {
    return { pattern: 'unknown', strength: 0 };
  }
  
  // Get the most recent candles
  const c1 = candles[candles.length - 3]; // Third last
  const c2 = candles[candles.length - 2]; // Second last
  const c3 = candles[candles.length - 1]; // Last candle
  
  // Check multi-candle patterns (strongest to weakest)
  if (isMorningStar(c1, c2, c3)) {
    return { pattern: 'morning_star', strength: 9, direction: 'bullish' };
  }
  
  if (isEveningStar(c1, c2, c3)) {
    return { pattern: 'evening_star', strength: -9, direction: 'bearish' };
  }
  
  if (isThreeWhiteSoldiers(c1, c2, c3)) {
    return { pattern: 'three_white_soldiers', strength: 8, direction: 'bullish' };
  }
  
  if (isThreeBlackCrows(c1, c2, c3)) {
    return { pattern: 'three_black_crows', strength: -8, direction: 'bearish' };
  }
  
  // Check two-candle patterns
  if (isBullishEngulfing(c3, c2)) {
    return { pattern: 'bullish_engulfing', strength: 7, direction: 'bullish' };
  }
  
  if (isBearishEngulfing(c3, c2)) {
    return { pattern: 'bearish_engulfing', strength: -7, direction: 'bearish' };
  }
  
  if (isBullishHarami(c3, c2)) {
    return { pattern: 'bullish_harami', strength: 5, direction: 'bullish' };
  }
  
  if (isBearishHarami(c3, c2)) {
    return { pattern: 'bearish_harami', strength: -5, direction: 'bearish' };
  }
  
  // Check single candle patterns
  if (isDoji(c3)) {
    return { pattern: 'doji', strength: 0, direction: 'neutral' };
  }
  
  if (isHammer(c3)) {
    return { pattern: 'hammer', strength: 6, direction: 'bullish' };
  }
  
  if (isShootingStar(c3)) {
    return { pattern: 'shooting_star', strength: -6, direction: 'bearish' };
  }
  
  // No clear pattern
  const strength = calcCandleStrength(c3);
  return {
    pattern: 'basic_candle',
    strength: strength,
    direction: strength > 0 ? 'bullish' : strength < 0 ? 'bearish' : 'neutral'
  };
}

module.exports = {
  isDoji,
  isHammer,
  isShootingStar,
  isBullishEngulfing,
  isBearishEngulfing,
  isBullishHarami,
  isBearishHarami,
  isMorningStar,
  isEveningStar,
  isThreeWhiteSoldiers,
  isThreeBlackCrows,
  hasHighVolume,
  calcCandleStrength,
  detectPattern
}; 