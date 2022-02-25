import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

export type NetworkInfo = {
  family: "osmosis";
};
export type NetworkInfoRaw = {
  family: "osmosis";
};
export type Transaction = TransactionCommon & {
  mode: string;
  family: "osmosis";
  fees: BigNumber | null | undefined;
  memo: string | null | undefined;
};
export type TransactionRaw = TransactionCommonRaw & {
  family: "osmosis";
  mode: string;
  fees: BigNumber | null | undefined;
  memo: string | null | undefined;
};

export type CoreStatics = Record<any, any>;
export type CoreAccountSpecifics = Record<any, any>;
export type CoreOperationSpecifics = Record<any, any>;
export type CoreCurrencySpecifics = Record<any, any>;

export const reflect = (_declare: any) => {};
