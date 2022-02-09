export const TerraAccountTransactionTypeEnum = {
  // See https://docs.figment.io/network-documentation/terra/enriched-apis/transaction-search
  // for help on these types.
  Send: "send",
  MultiSend: "multisend",
  Receive: "receive",
};

export const TerraCurrency = "uluna";

export interface TerraAccountTransaction {
  id: string;
  hash: string;
  block_hash: string;
  height: number;
  chain_id: string;
  time: Date;
  transaction_fee: TerraAmount[];
  gas_wanted: number;
  gas_used: number;
  version: string;
  events: TerraEvent[];
  has_errors: boolean;
}
export interface TerraAmount {
  text: string;
  currency: string;
  numeric: string;
}

export interface TerraEventNestedContent {
  account: any;
  amounts: TerraAmount[];
}

export interface TerraEventContent {
  type: string[];
  module: string;
  sender: TerraEventNestedContent[];
  recipient: TerraEventNestedContent[];
  transfers: any[];
}

export interface TerraEvent {
  id: string;
  kind: typeof TerraAccountTransactionTypeEnum;
  sub: TerraEventContent[];
}
