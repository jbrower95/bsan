const StateMonitor = require('./monitor.js');
const {asBN, shortenAddress} = require('../utils.js');

/**
 * Asssert how the ERC20 balance of an ETH account changes on a contract.
 */
class ERC20AddressBalance extends StateMonitor {
  constructor(contract, address, initialBalance) {
    super(initialBalance);
    this.contract = contract;
    this.address = address;
  }

  async fetchValue() {
    const val = await this.contract.balanceOf.call(this.address);
    return web3.utils.toBN(val);
  }

  async expect(value, message) {
    // force-cast to BN.
    value = asBN(value);
    return await super.expect(value, message);
  }

  toString() {
    return `erc20(contract=${shortenAddress(this.contract.address)},wallet=${shortenAddress(this.address)})`;
  }

  type() {
    return "erc20-balance"
  }
}

module.exports = ERC20AddressBalance;
