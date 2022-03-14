import type { Account } from "../../types";
import { encodeAccountId } from "../../account";
import type { GetAccountShape } from "../../bridge/jsHelpers";
import { makeSync, makeScanAccounts, mergeOps } from "../../bridge/jsHelpers";
import { getAccount, getOperations } from "./api";

const getAccountShape: GetAccountShape = async (info) => {
  const { address, initialAccount, currency, derivationMode } = info;
  const oldOperations = initialAccount?.operations || [];

  const accountId = encodeAccountId({
    type: "js",
    version: "2",
    currencyId: currency.id,
    xpubOrAddress: address,
    derivationMode,
  });

  const {
    blockHeight,
    balance,

    // cryptoOrg stub, will probably them for staking
    // bondedBalance,
    // redelegatingBalance,
    // unbondingBalance,
    // commissions,
  } = await getAccount(address);

  // Merge new operations with the previously synced ones
  let startAt = 0;
  let maxIteration = 20;
  let operations = oldOperations;
  console.log("oldOperations.length:", oldOperations.length);

  let newOperations = await getOperations(accountId, address, startAt);

  do {
    operations = mergeOps(operations, newOperations);
    newOperations = await getOperations(accountId, address, startAt++);
  } while (--maxIteration && newOperations.length != 0);

  const shape = {
    id: accountId,
    balance,
    spendableBalance: balance,
    operationsCount: operations.length,
    blockHeight,

    // cryptoOrg stub, will probably them for staking
    // cryptoOrgResources: {
    //   bondedBalance,
    //   redelegatingBalance,
    //   unbondingBalance,
    //   commissions,
    // },
  };
  return { ...shape, operations };
};

const postSync = (initial: Account, parent: Account) => parent;

export const scanAccounts = makeScanAccounts(getAccountShape);
export const sync = makeSync(getAccountShape, postSync);
