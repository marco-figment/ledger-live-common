import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

export type NetworkInfo = {
  family: "terra";
};
export type NetworkInfoRaw = {
  family: "terra";
};
export type Transaction = TransactionCommon & {
  mode: string;
  family: "terra";
  fees?: BigNumber;
  memo: string | null | undefined;
};
export type TransactionRaw = TransactionCommonRaw & {
  family: "terra";
  mode: string;
  fees?: string;
  memo: string | null | undefined;
};

export type CoreStatics = Record<any, any>;
export type CoreAccountSpecifics = Record<any, any>;
export type CoreOperationSpecifics = Record<any, any>;
export type CoreCurrencySpecifics = Record<any, any>;

export const reflect = (_declare: any) => {};
