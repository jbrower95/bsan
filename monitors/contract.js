const StateMonitor = require('./monitor.js');
const {dynamicEquals, shortenAddress} = require('../utils.js');

/**
 * Monitors the state of a particular property on a contract.
 *
 *    e.g if your contract has a property .owner
 *      >> new ContractState(myContractInstance, myContractInstance.owner)
 *    will monitor whether .owner() changes through your execution.
 *
 *    If you need to pass parameters (e.g to query a particular value on a map)
 *    you can do so using the `params` constructor.
 *
 *    e.g - given this contract...
 *      contract LedgerBalance {\
 *          mapping(address => uint) public balances;
 *      }\
 *
 *    you can monitor changes to keys on balance by using:
 *
 *    >> new ContractState(LedgerBalanceInstance, LedgerBalanceInstance.balances, [accounts[0]])
 *
 *    ^ this example will monitor balances(accounts[0]) and report when it changes.
 */
class ContractState extends StateMonitor {
  constructor(contract, contractMethod, params = [], keypath = null) {
    super(null);
    this.contract = contract;
    this.contractMethod = contractMethod;
    this.params = params;
    this.keypath = keypath;
  }

  resolveKeypath(keypath, value) {
    const parts = keypath.split(".");
    let current = value;
    for (let part of parts) {
      current = current[part];
      if (current == undefined) {
        throw new Error(`Error resolving keypath(${keypath}) - Got undefined at .${part}`);
      }
    }
    return current;
  }

  async fetchValue() {
    const val = await this.contractMethod(...this.params);
    if (typeof val == 'object' && !web3.utils.isBN(val)) {
      if (this.keypath == null) {
        throw new Error(`Expected non-null keypath for ContractMonitor with on-chain object.`);
      }
      // resolve the associated keypath.
      if (typeof val != 'object') {
        throw new Error(`Expected object type for keypath('${this.keypath}') - on-chain value was ${typeof val}`);
      }
      return this.resolveKeypath(this.keypath, val);
    }
    return val;
  }

  toString() {
    return `contract(${shortenAddress(this.contract.address)})`;
  }

  type() {
    return "contract-state"
  }

  equals(a, b) {
    // a, b can be typed differently depending on which contract method
    // is called.
    return dynamicEquals(a, b);
  }

  lte(a, b) {
    if (web3.utils.isBN(a) && web3.utils.isBN(b)) {
      return a.lte(b);
    }
    throw new Error(`ContractState: Unsupported operation: ${JSON.stringify(a)} <= ${JSON.stringify(b)}`);
  }

  serializeValue(value) {
    return JSON.stringify(value);
  }
}

module.exports = ContractState;
