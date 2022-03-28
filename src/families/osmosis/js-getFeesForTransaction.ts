import { BigNumber } from "bignumber.js";

// Default fees in uosmo
export const DEFAULT_FEES = 0;

// Dear future developer working on this file, if fees become non-zero
// make sure to flip estimatedFees.isZero() to !estimatedFees.isZero() in
// './deviceTransactionConfig.ts'.

/**
 * Fetch the transaction fees for a transaction
 */
const getEstimatedFees = async (): Promise<BigNumber> => {
  // for "send" transactions fees are zero
  return new BigNumber(DEFAULT_FEES);
};

export default getEstimatedFees;
