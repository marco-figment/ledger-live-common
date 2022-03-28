import { BigNumber } from "bignumber.js";
import {
  NotEnoughBalance,
  RecipientRequired,
  InvalidAddress,
  FeeNotLoaded,
  AmountRequired,
  InvalidAddressBecauseDestinationIsAlsoSource,
} from "@ledgerhq/errors";
import { Account } from "../../types";
import { Transaction, TransactionStatus, StatusErrorMap } from "./types";
import { isValidAddress } from "./utils";

const getTransactionStatus = async (
  account: Account,
  transaction: Transaction
): Promise<TransactionStatus> => {
  const errors: StatusErrorMap = {};
  const warnings: StatusErrorMap = {};
  const useAllAmount = !!transaction.useAllAmount;

  if (account.freshAddress === transaction.recipient) {
    errors.recipient = new InvalidAddressBecauseDestinationIsAlsoSource();
  }
  // Removing as Osmosis doesn't have fees
  // if (!transaction.fees || !transaction.fees.gt(0)) {
  //   errors.fees = new FeeNotLoaded();
  // }

  // if (transaction.fees.isNan()) {
  //   errors.fees = new FeeNotLoaded();
  //   throw new Error("error fee is Nan");
  // }
  if (!transaction.fees || transaction.fees.isNaN()) {
    errors.fees = new FeeNotLoaded();
    throw new Error("fees not loaded");
  }

  // It shouldn't be necessary to do this, I'm being extra careful
  // for now but should revert later to:
  // const fee = transaction.fees || new BigNumber(0);
  const estimatedFees = transaction.fees
    ? new BigNumber(transaction.fees.toNumber())
    : new BigNumber(0);

  const amount = useAllAmount
    ? account.spendableBalance.minus(estimatedFees)
    : new BigNumber(transaction.amount);

  if (amount.lte(0) && !transaction.useAllAmount) {
    // shouldn't the first condition be valid always and not just when transaction.useAllAmount==true?
    errors.amount = new AmountRequired();
  }

  const totalSpent = amount.plus(estimatedFees);

  if (totalSpent.gt(account.spendableBalance)) {
    errors.amount = new NotEnoughBalance();
  }

  if (!errors.amount && account.spendableBalance.lt(estimatedFees)) {
    errors.amount = new NotEnoughBalance();
  }

  if (!transaction.recipient) {
    errors.recipient = new RecipientRequired();
  } else if (!isValidAddress(account.currency.id, transaction.recipient)) {
    errors.recipient = new InvalidAddress("", {
      currencyName: account.currency.name,
    });
  }

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount,
    totalSpent,
  });
};

export default getTransactionStatus;
