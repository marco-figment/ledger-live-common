import { decode } from 'bech32';

function checkPrefixAndLength(
    prefix: string,
    data: string,
    length: number
  ): boolean {
    try {
      const vals = decode(data);
      return vals.prefix === prefix && data.length == length;
    } catch (e) {
      return false;
    }
  }
  
  export namespace AccAddress {
    /**
     * Checks if a string is a valid Terra account address.
     *
     * @param data string to check
     */
    export function validate(data: string): boolean {
      return checkPrefixAndLength('terra', data, 44);
    }