import type { Transaction, OsmosisMessage } from "./types";
import type { CoreCosmosLikeTransaction } from "../cosmos/types";
import type { Account } from "../../types";
import type { Core, CoreAccount, CoreCurrency } from "../../libcore/types";
import BigNumber from "bignumber.js";
import estimateMaxSpendable from "./js-estimateMaxSpendable";
import { AmountRequired, GasLessThanEstimate } from "@ledgerhq/errors";
import { bigNumberToLibcoreAmount } from "../../libcore/buildBigNumber";
import getEstimatedFees from "./js-getFeesForTransaction";
import { promiseAllBatched } from "../../promise";
import { fetchAccountSequence } from "./api/sdk";

const getAmount = async (core: Core, amount: string) => {
  return await core.CosmosLikeAmount.init(amount, "uosmo");
};

export const osmosisCreateMessage = async (
  freshAddress: string,
  transaction: Transaction,
  core: Core
): Promise<OsmosisMessage[]> => {
  const { recipient } = transaction;

  switch (transaction.mode) {
    case "send":
      return [
        await core.CosmosLikeMessage.wrapMsgSend(
          await core.CosmosLikeMsgSend.init(freshAddress, recipient, [
            await getAmount(core, transaction.amount.toString()),
          ])
        ),
      ];
    default:
      throw new Error(`Unknown mode in transaction: ${transaction.mode}`);
  }
};

export async function osmosisBuildTransaction({
  account,
  core,
  coreAccount,
  coreCurrency,
  transaction,
  isCancelled,
}: // isPartial, // is true if we just want to estimate fees and gas
{
  account: Account;
  core: Core;
  coreAccount: CoreAccount;
  coreCurrency: CoreCurrency;
  transaction: Transaction;
  // isPartial: boolean;
  isCancelled: () => boolean;
}): Promise<CoreCosmosLikeTransaction | null | undefined> {
  const { memo } = transaction;
  const cosmosLikeAccount = await coreAccount.asCosmosLikeAccount();
  if (isCancelled()) return;
  const transactionBuilder = await cosmosLikeAccount.buildTransaction();
  // I don't understand here, why isCancelled gets called at every step?
  if (isCancelled()) return;

  // const accountCanEstimateGas = await canEstimateGas(account, transaction);
  // if (isCancelled()) return;

  // let messages = await osmosisCreateMessage(
  //   account.freshAddress,
  //   {
  //     ...transaction,
  //     amount: transaction.useAllAmount
  //       ? await estimateMaxSpendable(account, null)
  //       : transaction.amount,
  //   },
  //   core
  // );
  const memoTransaction = memo || "";
  await transactionBuilder.setMemo(memoTransaction);
  // Gas
  // TODO Later: if we want to have dynamic gas instead of default of 100k
  // let estimatedGas: BigNumber;

  // if (isPartial && accountCanEstimateGas) {
  //   const gasRequest = await core.CosmosGasLimitRequest.init(
  //     memoTransaction,
  //     messages,
  //     String(getEnv("COSMOS_GAS_AMPLIFIER"))
  //   );
  //   estimatedGas = await libcoreBigIntToBigNumber(
  //     // NOTE: With new cosmos code, this call might fail if the account hasn't been synchronized
  //     // and missed a new transaction. This is because now the account sequence needs to be exact,
  //     // and can't be a dummy 0 like pre-Stargate.
  //     //
  //     // LibCore internally calls for sequence number synchronization here, but this is a data race between the
  //     // last time we read the sequence number and the instant we send the gas estimation request
  //     await cosmosLikeAccount.estimateGas(gasRequest)
  //   );
  // } else {
  //   // 60000 is the default gas here.
  //   estimatedGas = gas || new BigNumber(60000);
  // }

  // Gas
  const estimatedGas = new BigNumber(100000);

  if (!estimatedGas.gt(0)) {
    throw new GasLessThanEstimate();
  }

  const gasAmount = await bigNumberToLibcoreAmount(
    core,
    coreCurrency,
    estimatedGas
  );
  if (isCancelled()) return;
  await transactionBuilder.setGas(gasAmount);

  // Fees
  const feesBigNumber = await getEstimatedFees();
  const feesAmount = await bigNumberToLibcoreAmount(
    core,
    coreCurrency,
    feesBigNumber
  );
  if (isCancelled()) return;
  await transactionBuilder.setFee(feesAmount);

  if (!transaction.amount) {
    throw new AmountRequired();
  }

  const messages = await osmosisCreateMessage(
    account.freshAddress,
    {
      ...transaction,
      amount: transaction.useAllAmount
        ? await estimateMaxSpendable(account, null)
        : transaction.amount,
    },
    core
  );

  promiseAllBatched(
    3,
    messages,
    async (message) => await transactionBuilder.addMessage(message)
  );
  // Signature information
  const accNum = await cosmosLikeAccount.getAccountNumber();
  await transactionBuilder.setAccountNumber(accNum);

  // TODO make sure to understand exactly how this works
  const accountCanEstimateGas = true;

  if (accountCanEstimateGas) {
    const sequence = await fetchAccountSequence(account.freshAddress);
    await transactionBuilder.setSequence(sequence);
  } else {
    await transactionBuilder.setSequence("0");
  }

  const tx = await transactionBuilder.build();
  return tx;
}

export default osmosisBuildTransaction;
