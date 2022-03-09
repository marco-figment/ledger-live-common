import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

import type { CosmosMessage } from "../cosmos/types";

export type NetworkInfo = {
  family: "osmosis";
};
export type NetworkInfoRaw = {
  family: "osmosis";
};

export type OsmosisMessage = CosmosMessage;

export type Transaction = TransactionCommon & {
  family: "osmosis";
  mode: string;
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
