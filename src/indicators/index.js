const calculateRSI = require('./rsiIndicator');
const calculateEMA = require('./emaIndicator');
const calculateSMA = require('./smaIndicator');
const calculateATR = require('./atrIndicator');
const calculateBollingerBands = require('./bollingerBandsIndicator');
const calculateMACD = require('./macdIndicator');
const calculateStochastic = require('./stochasticIndicator');
const calculateADX = require('./adxIndicator');
const { isSupport, isResistance } = require('./supportResistanceIndicator');

module.exports = {
  calculateRSI,
  calculateEMA,
  calculateSMA,
  calculateATR,
  calculateBollingerBands,
  calculateMACD,
  calculateStochastic,
  calculateADX,
  isSupport,
  isResistance
}; 