const asBN = (num) => web3.utils.isBN(num) ? num : web3.utils.toBN(num);

const shortenAddress = (address) => {
  return `${address.slice(-4).toUpperCase()}`;
}

const eth2wei = (amount) => {
  return web3.utils.toBN(web3.utils.toWei(amount.toString(), "ether"));
}

const dynamicEquals = (a, b) => {
  if (typeof a !== typeof b) {
    throw new Error(`ContractState: Error asserting state - cannot compare objects of different types (${typeof a} != ${typeof b})`);
  }

  if (web3.utils.isBN(a) && web3.utils.isBN(b)) {
    return a.eq(b);
  } else if ((typeof a) === "string" || (typeof a) === "number" || (typeof a) === "boolean") {
    return a === b;
  } else if (typeof a === "object") {
    // attempt object equality.

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length != keysB.length) {
      // different number of keys.
      return false;
    }

    for (let key of keysA) {
      if (["0", "1", "2", "3"].includes(key)) {
        continue;
      }

      if (!keysB.includes(key)) {
        return false;
      }

      if (!dynamicEquals(a[key], b[key])) {
        console.error(`[error] Key ${key} failed recursive equality check.`);
        return false;
      }
    }

    return true;
  } else {
    throw new Error(`ContractState: Error asserting state - unsupported comparison type (${typeof a})`);
  }
}

async function gasForReceipt(receipt) {
  const gasUsed = web3.utils.toBN(receipt.gasUsed);
  let gasPrice = await web3.eth.getGasPrice();
  gasPrice = web3.utils.toBN(gasPrice);
  return gasUsed.mul(gasPrice);
}

async function gasForCall(result) {
  return await gasForReceipt(result.receipt);
}

module.exports.gasForCall = gasForCall;
module.exports.gasForReceipt = gasForReceipt;
module.exports.shortenAddress = shortenAddress;
module.exports.asBN = asBN;
module.exports.eth2wei = eth2wei;
module.exports.dynamicEquals = dynamicEquals;
