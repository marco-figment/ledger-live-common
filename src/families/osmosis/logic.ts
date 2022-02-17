import { AccAddress } from "./utils";

/**
 * Returns true if address is a valid Osmosis address md5
 *
 * @param {string} address
 */
export const isValidAddress = (address: string): boolean => {
  if (!address) return false;
  return AccAddress.validate(address);
};
