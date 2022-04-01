// aggregations
const StateMonitor = require('./monitor.js');
const DappState = require('./state.js');

// monitors
const ERC20Monitor = require('./erc20.js');
const ETHWalletMonitor = require('./ethwallet.js');
const ContractMonitor = require('./contract.js');

module.exports.StateMonitor = StateMonitor;
module.exports.DappState = DappState;

module.exports.ETHWalletMonitor = ETHWalletMonitor;
module.exports.ERC20Monitor = ERC20Monitor;
module.exports.ContractMonitor = ContractMonitor;
