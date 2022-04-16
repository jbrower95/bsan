# bsan: Better testing for truffle

## Known Issues

- BSAN is not compatible with solidity-coverage, which distorts gas consumption. 
- BSAN is not currently compatible with truffle's `debug(..)` macro.

## Philosophy

Smart contracts are above all a mechanism for updating state. While line and branch
coverage are essential, your tests are ultimately responsible for making sure that on-chain state
is updated correctly. Remembering to monitor everything you care about is hard. BSAN makes this easier.

## BSAN

BSAN (Blockchain Sanitizer) is a simple addition to Truffle's testing suite
that supports tracking and verifying how your code changes state on-chain.

BSAN allows you to track:
  - ETH account balances.
  - ERC20 account balances.
  - Smart contract variables.

BSAN provides a framework to extend to arbitrary tracking of chain-state, using a
simple but powerful methodology that integrates directly with Mocha.

## Should I use bsan?

If you:
  - Write Smart Contract tests using truffle and ganache, and
  - Are writing tons of imperative logic to check fields that your contracts may
    changed,
  - Want to understand how your code affects on-chain state better, so that you can make
    changes more confidently, then

You 100% should be monitoring all state-changes produced by your program with BSAN.

## Getting Started

In your project:
`npm i --save-dev @jbrower95/bsan`


```Solidity
// some erc20 contract
contract TokenContract is ERC20 {  ... }

// a sample solidity contract where you can set the owner by bidding the most ether.
contract MyContract {
  address owner;
  uint256 amountPaid;

  function setOwner() public payable {
    if (msg.value > amountPaid) {
      if (amountPaid > 0) {
        // refund
        bool sent = address(this.owner).send(amountPaid);
        require(sent, "Failed to refund ether");
      }

      this.owner = msg.sender;
      this.amountPaid = msg.value;
    }
  }
}
```

In your truffle test:

```JavaScript
const {ETHWalletMonitor, ContractMonitor} = require('bsan');
const {eth2wei} = require('bsan/utils.js');

// Your truffle `contract` test.

let myContract = null; // load this later.

contract.stateful(
  "MySmartContract",
  // after this state is created, it's available via the global "S"
  (accounts) => new DappState(
    wallets={
      account0: new ETHWalletMonitor(accounts[0]),
    },
    erc20={},
    contract={
      myContractOwner: new ContractMonitor(myContract, myContract.owner),
    },
  ),
  (accounts) => {
    before(async () => {
      // load any contracts you need.
      myContract = await MyContract.deployed({from: accounts[4]});
    });

    it("Bidding 0 causes the owner to not be set", async function () {
      await S.wallets.account0.call(S, myContract.setOwner, {value: eth2wei(0).toString()});
      await S.wallets.account0.expectOnlyConsumedGas("If bidding nothing, you should not receive ownership.");
    });

    it("Bidding 1 causes a new owner to be set", async function () {
      await S.wallets.account1.call(S, myContract.setOwner, {value: eth2wei(1).toString()});

      // assert wallet balance falls.
      await S.wallets.account1.expectFallsBy(eth2wei(1), "When bidding 1 eth, 1 eth is paid.");

      // assert new owner is set.
      await S.contract.myContractOwner.expect(account[1]);

      // bid even more from another account.
      await S.wallets.account0.call(S, myContract.setOwner, {value: eth2wei(2).toString()});
      await S.wallets.account1.expectRisesBy(eth2wei(1), "Account 1 should receive a refund.");
      await S.wallets.account0.expectFallsBy(eth2wei(2), "Account 0 pays 2 ETH to be the owner.");
      // assert new owner is set.
      await S.contract.myContractOwner.expect(account[0]);
    });
});


```

You should start to see how these tests work. In the beginning, you list the things
you care about on-chain.

```javascript
  new DappState(
    wallets={
      // monitor ETH sends/receives from this account
      account0: new ETHWalletMonitor(accounts[0]),
    },
    erc20={
      // monitor ERC20 balance changes on this account for the
      // truffle contract instance `token`
      account0: new ERC20Monitor(token, accounts[0])
    },
    contract={
      // monitor value changes to the `myContract.owneccr` field.
      myContractOwner: new ContractMonitor(myContract, myContract.owner),
    },
  )
```

Every time you call a function (via. `await S.wallets.account1.call(...)`) your state
will be asserted to make sure that all the things you care about haven't changed beyond your
expectations.

At the end of your test, every monitor will be checked to make sure that its final value
matches what is currently on-chain. If you haven't asserted something, you'll get an error
describing how the value on-chain differed from your expectations.

With the code example above, if you uncomment **any of the expect() calls**, the test will fail.
Similarly, if you change any of the logic in the contract, your tests should also fail if the
end-state on chain would deviate.

### Calling Contract Functions

With an ETHWalletMonitor, call your solidity contract functions by using

```await state.wallets.<name>.call(state, contractInstance.function, param1, param2...)```

If you need to pass value into a txn, you can pass a normal web3 dictionary as
the last argument to .call(). e.g ```{value: "100000000"}

When using this syntax, bsan will automatically keep track of gas consumption for you,
which would otherwise affect your ganache ETH account balances by the end of your test.

### expect() / state changes

By accessing your DappState (which describeDapp() provides to your tests -- see "S" above)
you get direct access to your monitors.

S.wallets.* - all of the ETH wallets you monitor.
S.contract.* - all of the contract variables you monitor.
S.erc20.* - all of the erc20 account balances you monitor.

With monitors, you can do things like:

```
  const monitor = S.wallets.account0;

  monitor.expectFallsBy(eth2wei(1), "Account falls by 1 eth.");
  monitor.expectRisesBy(eth2wei(1), "Account gains 1 eth.");
  monitor.expect(eth2wei(100), "Account has exactly 1 eth.");

```

### Contract values

With ContractMonitor, you can observe a field on a contract.
- If the field requires parameters, you can pass in an array of static parameters to provide when querying the field.
- If the field is a struct, you can provide a keypath to observe a specific scalar field on that struct.
(as of writing, you cannot not yet observe the entire struct, but fields individually can still be useful.)
Keypaths should follow the format of "key.path.part", and do not yet support indexing into lists.

```javascript
  // assume we have mapping <address, uint> for some balance tracking.

  //

    new DappState(
      contract={
        // monitor value changes to the `myContract.owneccr` field.
        mapping: new ContractMonitor(someContractInstance, someContractInstance.myMapping, [accounts[0]]),
        someKeypathField: new ContractMonitor(someContractInstance, someContractInstance.myStructMapping, [accounts[0]], keypath="my.field"),
      }
    );

  const monitor = S.contract.mapping;
  monitor.expect(address[0]);

  // then, maybe execute some logic that changes the mapping on-chain.
  // ...

  monitor.expect(address[1]);
```

## Contributing

New on-chain data:

If you'd like to track some other piece of on-chain state, head to ./monitors
and check out `monitor.js` for more information about the monitor abstraction.

Testing + Bugs:

If you find an issue in BSAN and want to support the project with a patch, submit a
pull request and I'll review quickly. Thanks!

## License

Open source / MIT. See LICENSE for more information.

## Tip Jar

ETH: jaymothy.eth

- If you like BSAN and find it useful, please reach out! Would love to here what
folks have to say about the framework.
- If BSAN helped you catch a bug or made your development easier, feel free to send
a tip to `jaymothy.eth`, or help contribute for others :)
