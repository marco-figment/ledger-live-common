import invariant from "invariant";
import flatMap from "lodash/flatMap";

import type {
  Transaction,
  Account,
  AccountLike,
  AccountLikeArray,
} from "../../types";

const options = [
  {
    name: "mode",
    type: String,
    desc: "mode of transaction: send",
  },
];

function inferAccounts(account: Account): AccountLikeArray {
  invariant(account.currency.family === "osmosis", "osmosis family");

  const accounts: Account[] = [account];
  return accounts;
}

function inferTransactions(
  transactions: Array<{
    account: AccountLike;
    transaction: Transaction;
    mainAccount: Account;
  }>,
  opts: Record<string, any>
): Transaction[] {
  return flatMap(transactions, ({ transaction }) => {
    invariant(transaction.family === "osmosis", "osmosis family");

    return {
      ...transaction,
      family: "osmosis",
      mode: opts.mode || "send",
    } as Transaction;
  });
}

export default {
  options,
  inferAccounts,
  inferTransactions,
};
