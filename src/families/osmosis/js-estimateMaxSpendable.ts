import { BigNumber } from "bignumber.js";
import type { AccountLike, Account } from "../../types";
import { getMainAccount } from "../../account";
// import type { Transaction } from "./types";
import getEstimatedFees from "./js-getFeesForTransaction";
// import { createTransaction } from "./js-transaction";

/**
 * Returns the maximum possible amount for transaction
 *
 * @param {Object} param - the account, parentAccount and transaction
 */
const estimateMaxSpendable = async ({
  account,
  parentAccount,
}: // transaction,
{
  account: AccountLike;
  parentAccount: Account;
  // transaction: Transaction;
}): Promise<BigNumber> => {
  const a = getMainAccount(account, parentAccount);
  // const t = { ...createTransaction(), ...transaction, useAllAmount: true };
  const fees = await getEstimatedFees();

  const x = BigNumber.max(0, a.spendableBalance.minus(fees));
  console.log(
    `ESTIMATE MAX SPENDABLE. fees: ${fees}, maxSpendableAmount: ${x}`
  );
  return x;
};

export default estimateMaxSpendable;
