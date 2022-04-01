const timeMachine = require('ganache-time-traveler');
const {StateSource, DappState, ERC20Monitor, ETHWalletMonitor, ContractMonitor} = require('./monitors');

/**
 * =================================
 * READ THIS BEFORE WRITING TESTS
 * =================================
 *
 * Represents a collection of mocha tests for a given dapp.
 *    describeDapp(name, state, instructions)
 *         - name(string): Human-readable name of the dapp.
 *         - state(DappState): An initialized DappState object.
 *              You should initialize your DappState with monitors for pieces of
 *               on-chain state you wish to track.
 *
 * Writing Tests:
 *   To call solidity contract functions, use
 *      await state.wallets.<caller>.call(myContract.function, param1, param2...);
 *   where:
 *      - state is your DappState instance
 *      - <caller> is the name of the ETH wallet monitor that's making the call (as defined in the DappState constructor)
 *      - myContract is a truffle instance of a contract, where `.function` is the name of the contract fn (that requires a txn).
 *          NOTE: you can call non-txn functions using normal truffle syntax.
 *      - param1, param2, etc. are all the normal application-level parameters you'd pass to your solidity function.
 *
 *  NOTE:
 *    - Specifying the final argument {\from: address[0]}\ as you'd normally do in web3.js is handled for you.
 *    - You can specify {\value: <amt>}\ if you need to send ETH to the contract. `from` will still be provided for you.
 *
 * Test Behavior:
 *
 *    1. At the beginning of each test,
 *        - The framework will automatically fetch current values for all monitored
 *          chain-data.
 *    2. Before each transaction,
 *        - The framework will make sure all changes to on-chain data have been asserted (see: Asserting)
 *    3. After every test,
 *        - The framework will make sure all changes to on-chain data have been asserted (see: Asserting)
 *
 *    If you forget to assert something (or if your contracts change and start modifying chain-data you monitor)
 *    you'll receive an exception / test-failure indicating what state transition was observed.
 *
 *  Asserting:
 *
 *     Using the state object exposed to each test, you can assert different things
 *     about how your on-chain state changes througout the execution of the test.
 *
 *     access different monitors by:
 *        state.[wallets|erc20|contract].<name>
 *
 *     Once given a monitor, see `monitors/monitor.js` for the functions you can call.
 *      - async expect(value, message)
 *      - async expectRisesBy(amount, message)
 *      - async expectFallsBy(amount, message)
 *      - async expectLessThan(value, message)
 *
 */
const describeDapp = (name, state, instructions) => {
  const prevInstructions = instructions;
  const testImpl = () => {
    let snapshotId = null;

    beforeEach(async () => {
      await state.reset();
      let snapshot = await timeMachine.takeSnapshot();
      snapshotId = snapshot['result'];
    });

    afterEach(async () => {
      if (state.exceptions) {
        // potentially a failure already that caused test execution to end.
        // Failing here is unnecessary since another test part has failed.
        await timeMachine.revertToSnapshot(snapshotId);
      } else {
        await state.checkDirty();
        await timeMachine.revertToSnapshot(snapshotId);
        state.assertNoExceptions();
        await state.reset();
      }
    });

    prevInstructions(state);
  };

  describe(name, testImpl);
}

module.exports.describeDapp = describeDapp;
module.exports.DappState = DappState;
module.exports.ERC20Monitor = ERC20Monitor;
module.exports.ETHWalletMonitor = ETHWalletMonitor;
module.exports.ContractMonitor = ContractMonitor;
