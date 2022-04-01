const {asBN} = require('../utils.js');

/**
 * Represents a source of chain-loadable state that your application monitors.
 *
 * To use:
 *  - Subclass, and
 *    - Override .fetchValue() to query your data from the chain.
 *    - Override .equals() / .lte() / serializeValue() comparison methods as needed.
 *        By default, if .fetchValue() returns a BN.js instance, this is unneeded.
 */
class StateMonitor {
  constructor(lastValue) {
    this.lastValue = lastValue;
    this.dirty = false;
    this.dirtyValue = null;
  }

  // called to accept any "dirty" state and reset our tracked value to
  // whatever is on-chain.
  async reset(toValue = null) {
    if (toValue != null) {
      this.lastValue = toValue;
    } else {
      this.lastValue = await this.fetchValue();
    }

    this.dirty = false;
    this.dirtyValue = false;
  }

  // check whether our last cached value is equal to the chain's current
  // state.
  async checkDirty() {
    const value = await this.fetchValue();
    this.dirty = (!this.equals(value, this.lastValue));
    if (this.dirty) {
      this.dirtyValue = value;
    }
    return this.dirty;
  }

  // a general method which can be used to adjust an expected value before
  // asserting it against the on-chain value. This is used to subtract our
  // expected gas consumption in the ethwallet monitor. (see: ethwallet.js)
  adjustExpectation(value) {
    return value;
  }

  // expect whether the on-chain state matches `value` (modulo any post-processing in adjustExpectation)
  // If it matches, update our tracked value and continue. If it doesn't, fail the test.
  async expect(value, message) {
    let actualValue = await this.fetchValue();
    let expectedValue = this.adjustExpectation(value);

    if (typeof actualValue == 'number') {
      actualValue = asBN(actualValue);
    }
    if (typeof expectedValue == 'number') {
      expectedValue = asBN(expectedValue);
    }

    if (!((typeof actualValue) == (typeof expectedValue))) {
      assert.fail(`Type mismatch in expectation: ${typeof actualValue} != ${typeof expectedValue}`);
    }

    if (!this.equals(actualValue, expectedValue)) {
      if (web3.utils.isBN(actualValue) && web3.utils.isBN(expectedValue)) {
        console.log(`Difference detected: ${actualValue.toString()} - ${expectedValue.toString()} = ${actualValue.sub(expectedValue).toString()} (${web3.utils.fromWei(actualValue.sub(expectedValue) , "ether")} eth)`)
      }

      assert.fail(`${this.toString()}: Error validating state (expected=${expectedValue}, actual=${actualValue}) ${this.errorMsg || ""}`);
    }

    console.log(`${this.toString()}: changed from (${this.lastValue}) => (${actualValue})`);
    await this.reset(actualValue);
  }

  /**
   * Indicate that a value shouldn't have changed, except for the gas consumed from some calls.
   */
  async expectOnlyConsumedGas(message) {
    await this.expect(this.lastValue, message);
  }

  /**
   * Indicate that a value should have fallen by a certain amount.
   */
  async expectFallsBy(dropBy, message) {
    dropBy = asBN(dropBy);
    await this.expect(this.lastValue.sub(dropBy), message);
  }

  /**
   * Indicate that a value should have risen by a certain amount.
   */
  async expectRisesBy(riseBy, message) {
    riseBy = asBN(riseBy);
    await this.expect(this.lastValue.add(riseBy), message);
  }

  /**
   * Indicate that a value should be less than a certain amount.
   *
   * NOTE: This method is only available for numeric types.
   */
  async expectLessThan(value, message) {
    value = asBN(value);
    if (!value) {
      throw new Error(`lte-assert: unsupported type - ${typeof value} `);
    }
    const actualValue = await this.fetchValue();

    if (!this.lte(actualValue, value)) {
      assert.fail(`${this.toString()}: Error validating state (expected<=${value}, actual=${actualValue}) ${this.errorMsg || ""}`);
    }

    console.log(`${this.toString()}: validated change (${this.lastValue}) => (${actualValue})`)
    await this.reset(actualValue);
  }

  /**
   * Fetch the monitors current value from chain. Subclasses should override this
   * by making `.call(...)`s to the chain.
   */
  async fetchValue() {
    throw new Exception("Unimplemented.");
  }

  /**
   * Return true if a === b. Default implementation assumes BN.js instances.
   */
  equals(a, b) {
    if (!(web3.utils.isBN(a) && web3.utils.isBN(b))) {
      throw new Error(`equal-assert: Types were not BN.js when processing equals(..): ${typeof a}, ${typeof b}`);
    }
    return a.eq(b); // bn.js
  }

  lte(a, b) {
    if (!(web3.utils.isBN(a) && web3.utils.isBN(b))) {
      throw new Error(`equal-assert: Types were not BN.js when processing lte(..): ${typeof a}, ${typeof b}`);
    }
    return a.lte(b);
  }

  serializeValue(value) {
    return value.toString();
  }
}

module.exports = StateMonitor;
