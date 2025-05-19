/**
 * Account management utilities
 * Handles account balance, margin, and position calculations
 */

/**
 * Create a new trading account with initial balance
 * @param {number} initialBalance - Starting balance
 * @returns {Object} Account object
 */
function createAccount(initialBalance) {
  return {
    balance: initialBalance,
    equity: initialBalance,
    positions: []
  };
}

/**
 * Calculate the maximum position size based on risk
 * @param {number} balance - Account balance
 * @param {number} price - Current asset price
 * @param {number} riskPercentage - Percentage of balance to risk (1-100)
 * @param {number} leverage - Leverage multiplier
 * @returns {number} Position size
 */
function calculatePositionSize(balance, price, riskPercentage, leverage = 1) {
  const riskAmount = balance * (riskPercentage / 100);
  return (riskAmount / price) * leverage;
}

/**
 * Calculate required margin for a position
 * @param {number} price - Current asset price
 * @param {number} size - Position size
 * @param {number} leverage - Leverage multiplier
 * @returns {number} Required margin
 */
function calculateMargin(price, size, leverage = 1) {
  return (price * size) / leverage;
}

/**
 * Calculate profit/loss for a position
 * @param {string} direction - Position direction (long/short)
 * @param {number} entryPrice - Entry price
 * @param {number} currentPrice - Current price
 * @param {number} size - Position size
 * @returns {number} Profit/loss amount
 */
function calculatePnL(direction, entryPrice, currentPrice, size) {
  if (direction === 'long') {
    return (currentPrice - entryPrice) * size;
  } else {
    return (entryPrice - currentPrice) * size;
  }
}

module.exports = {
  createAccount,
  calculatePositionSize,
  calculateMargin,
  calculatePnL
}; 