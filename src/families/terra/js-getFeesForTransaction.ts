import { BigNumber } from "bignumber.js";
import { Account } from "../../types";
import { Transaction } from "./types";

/**
 * Fetch the transaction fees for a transaction
 */
const getEstimatedFees = async ({
  a,
  t,
}: {
  a: Account;
  t: Transaction;
}): Promise<BigNumber> => {
  const feesEstimate = new BigNumber(5000);
  // TODO, fees estimate calculation
  return feesEstimate;
};

export default getEstimatedFees;
