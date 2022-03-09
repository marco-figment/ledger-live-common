// import { getAbandonSeedAddress } from "@ledgerhq/cryptoassets";
import { BigNumber } from "bignumber.js";
import { Account } from "../../types";
// import { calculateAmount } from "../polkadot/logic";
import { Transaction } from "./types";

// /**
//  * Fetch the transaction fees for a transaction
//  *
//  * @param {Account} a
//  * @param {Transaction} t
//  */
// const getEstimatedFees = async ({
//   a,
//   t,
// }: {
//   a: Account;
//   t: Transaction;
// }): Promise<BigNumber> => {
//   const transaction = {
//     ...t,
//     recipient: getAbandonSeedAddress(a.currency.id),
//     // Always use a fake recipient to estimate fees
//     amount: calculateAmount({
//       a,
//       t: { ...t, fees: new BigNumber(0) },
//     }), // remove fees if present since we are fetching fees
//   };
// };

// export default getEstimatedFees;

// For the time being, using Crypto_org's fixed fee estimation
// const FIXED_GAS_PRICE = 0.025;
// const FIXED_DEFAULT_GAS_LIMIT = 200000;

/**
 * Fetch the transaction fees for a transaction
 */
const getEstimatedFees = async (): Promise<BigNumber> => {
  // for "send" transactions fees are zero
  return new BigNumber(0);
};

export default getEstimatedFees;
