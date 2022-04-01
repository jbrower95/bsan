const StateMonitor = require('./monitor.js');
const {asBN, gasForReceipt, gasForCall, shortenAddress} = require('../utils.js');

/**
 * Assert how the balance of an ETH account changes.
 */
class ETHAddress extends StateMonitor {
  constructor(address, initialBalance) {
    super(initialBalance);
    this.address = address;
    this.expectedGas = null;
  }

  /**
   * Send a txn to a function on a truffle contract. Automatically computes
   * the gas used and factors into estimates.
   */
  async call(state, contractMethod, ...params) {
    // to enforce validation between txn calls, always assert that
    // we are not dirty before allowing a call(..)
    await state.checkDirty();
    state.assertNoExceptions();

    // automatically set {from:<x>} on the txn.
    if (params != null && params.length > 0) {
      const p = params[params.length - 1]; // last elt is the txn options.
      if (typeof p === 'object' && (p.from == undefined || p.from == null)) {
        p.from = this.address;
      } else {
        params.push({from: this.address});
      }
    } else {
      params = [{from: this.address}];
    }
    let gasCost = asBN(0);
    let res = null;

    try {
      res = await contractMethod(...params);
      gasCost = await gasForCall(res);
      this.expectGas(gasCost);
    } catch (exc) {
      // if this is a failed txn, it will have a transaction receipt on this
      // exception. We can assume gas consumption from this.
      if (exc.receipt) {
        const gasPrice = await gasForReceipt(exc.receipt);
        this.expectGas(gasPrice);
      }

      // rethrow.
      throw exc;
    }

    return res;
  }

  async reset() {
    await super.reset();
    this.expectedGas = null;
  }

  async expect(value, message) {
    // force-cast to BN.
    value = asBN(value);
    return await super.expect(value, message);
  }

  adjustExpectation(value) {
    return this.expectedGas != null ? value.sub(this.expectedGas) : value;
  }

  async fetchValue() {
    const bal = await web3.eth.getBalance(this.address);
    return web3.utils.toBN(bal);
  }

  toString() {
    return `eth(${shortenAddress(this.address)})`;
  }

  /**
   * Record that this state source consumed some gas.
   */
  expectGas(gasAmount) {
    if (this.expectedGas == null) {
      this.expectedGas = web3.utils.toBN(0);
    }
    this.expectedGas = this.expectedGas.add(gasAmount);
  }

  type() {
    return "eth-wallet"
  }
}

module.exports = ETHAddress;
