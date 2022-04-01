/**
 * Tracks a series of monitors for a dapp test.
 */
class DappState {

  /**
   * wallets: A map of <readable-name, ethwallet monitor>
   * erc20: A map of <readable-name, erc20 monitor>
   * contract: A map of <readable-name, contract monitor>
   */
  constructor(wallets={}, erc20={}, contract={}) {
    this.wallets = wallets;
    this.erc20 = erc20;
    this.contract = contract;
    this.exceptions = [];
    this.all = [this.wallets, this.erc20, this.contract];
  }

  /**
   * Accept on-chain values for every one of our tracked monitors.
   */
  async reset() {
    for (let group of this.all) {
      const keys = Object.keys(group);
      const results = await Promise.all([
        ...keys.map(srcKey => group[srcKey].reset().catch(e => e))
      ]);
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res instanceof Error) {
          const exc = res;
          const monitor = group[keys[i]];
          throw new Error(`Failed to check value of ${monitor.type()}.${keys[i]}: ${exc.stack}`)
        }
      }
    }

    this.exceptions = [];
  }

  /**
   * Check whether any of our on-chain monitors are reporting dirty (unasserted) values.
   *  If any unasserted values are found, this.exceptions will contain notes.
   */
  async checkDirty() {
    await Promise.all(this.all.map((group) => this._checkDirty(group)));
  }

  async _checkDirty(stateEntries) {
    const keys = Object.keys(stateEntries);

    for (let key of keys) {
      try {

      } catch (exc) {

      }
    }

    const dirty = await Promise.all(keys.map(srcKey => stateEntries[srcKey].checkDirty().catch(e => e)));
    for (let i = 0; i < dirty.length; i++) {
      if (dirty[i] instanceof Error) {
        const exc = dirty[i];
        const monitor = stateEntries[keys[i]];
        throw new Error(`Failed to check value of ${monitor.type()}.${keys[i]}: ${exc.stack}`)
      }

      if (dirty[i]) {
        const monitor = stateEntries[keys[i]];
        const last = monitor.serializeValue(monitor.lastValue);
        const dirty = monitor.serializeValue(monitor.dirtyValue);
        this.exceptions.push(new Error(`${monitor.type()}.${keys[i]}: un-asserted state change detected (${last}) => (${dirty})`));
      }
    }
  }

  /**
   * Assert that no exceptions were aggregated during a call to `checkDirty()`.
   */
  assertNoExceptions() {
    if (this.exceptions && this.exceptions.length > 0) {
      // some part of the state was dirty.
      throw new Error(`The following exceptions occurred:\n${this.exceptions.map((exc, idx) => '#' + idx + ': ' + exc.message).join('\n')}`);
    }
  }
}

module.exports = DappState;
