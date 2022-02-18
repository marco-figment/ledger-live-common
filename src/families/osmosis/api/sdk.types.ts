export const OsmosisAccountTransactionTypeEnum = {
  // See https://docs.figment.io/network-documentation/terra/enriched-apis/transaction-search
  // for help on these types.
  Send: "send",
  MultiSend: "multisend",
  Receive: "receive",
};

export const OsmosisCurrency = "uosmo";

export interface OsmosisAccountTransaction {
  id: string;
  hash: string;
  block_hash: string;
  height: number;
  chain_id: string;
  time: Date;
  transaction_fee: OsmosisAmount[];
  gas_wanted: number;
  gas_used: number;
  version: string;
  events: OsmosisEvent[];
  has_errors: boolean;
}
export interface OsmosisAmount {
  text: string;
  currency: string;
  numeric: string;
}

export interface CosmosAmount {
  amount: string;
  denom: string;
}

export interface OsmosisEventNestedContent {
  account: any;
  amounts: OsmosisAmount[];
}

export interface OsmosisEventContent {
  type: string[];
  module: string;
  sender: OsmosisEventNestedContent[];
  recipient: OsmosisEventNestedContent[];
  transfers: any[];
}

export interface OsmosisEvent {
  id: string;
  kind: typeof OsmosisAccountTransactionTypeEnum;
  sub: OsmosisEventContent[];
}
