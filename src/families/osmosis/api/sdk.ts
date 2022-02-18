import { BigNumber } from "bignumber.js";
import network from "../../../network";
import { getEnv } from "../../../env";
import { Operation, OperationType } from "../../../types";
import { encodeOperationId } from "../../../operation";
import {
  CosmosAmount,
  OsmosisAccountTransaction,
  OsmosisAccountTransactionTypeEnum,
  OsmosisAmount,
  OsmosisCurrency,
  OsmosisEventContent,
} from "./sdk.types";

const DEFAULT_TRANSACTIONS_LIMIT = 200;
const getIndexerUrl = (route): string =>
  `${getEnv("API_OSMOSIS_INDEXER")}${route || ""}`;
const getNodeUrl = (route): string =>
  `${getEnv("API_OSMOSIS_NODE")}${route || ""}`;

const fetchAccountBalance = async (address: string) => {
  const { data } = await network({
    method: "GET",
    url: getNodeUrl(`/cosmos/bank/v1beta1/balances/${address}`),
  });
  const amount = getOsmoAmountCosmosType(data.balances ? data.balances : []);
  return amount;
};

/**
 * Map transaction to an Operation Type
 */
function getOperationType(
  eventSendContent: OsmosisEventContent
): OperationType {
  const type = eventSendContent.type[0];
  switch (type) {
    case OsmosisAccountTransactionTypeEnum.Send:
      return "OUT";
    case OsmosisAccountTransactionTypeEnum.Receive:
      return "IN";
    default:
      return "NONE";
  }
}

/**
 * Map transaction to a correct Operation Value (affecting account balance)
 */
function getOperationValue(
  eventContent: OsmosisEventContent,
  type: string,
  fee: BigNumber
): BigNumber {
  let amount: BigNumber;
  switch (type) {
    // Per operation.ts, in "OUT" case, it includes the fees. in "IN" case, it excludes them.
    case OsmosisAccountTransactionTypeEnum.Send:
      amount = BigNumber.sum(
        getOsmoAmountOsmosisType(eventContent.sender[0]?.amounts),
        fee
      );
      break;
    case OsmosisAccountTransactionTypeEnum.Receive:
      amount = getOsmoAmountOsmosisType(eventContent.recipient[0]?.amounts);
      break;
    default:
      // defaults to received funds (i.e. no fee is added)
      amount = getOsmoAmountOsmosisType(eventContent.recipient[0]?.amounts);
  }
  return amount;
}

/**
 * Extract only the amount from a list of type OsmosisAmount
 */
export const getOsmoAmountOsmosisType = (
  amounts: OsmosisAmount[]
): BigNumber => {
  return amounts.reduce(
    (result, current) =>
      current.currency === OsmosisCurrency
        ? result.plus(new BigNumber(current.numeric))
        : result,
    new BigNumber(0)
  );
};

/**
 * Extract only the amount from a list of type CosmosAmount
 */
export const getOsmoAmountCosmosType = (amounts: CosmosAmount[]): BigNumber => {
  return amounts.reduce(
    (result, current) =>
      current.denom === OsmosisCurrency
        ? result.plus(new BigNumber(current.amount))
        : result,
    new BigNumber(0)
  );
};

/**
 * Map the send history transaction to a Ledger Live Operation
 */
function convertSendTransactionToOperation(
  accountId: string,
  eventContent: OsmosisEventContent,
  transaction: OsmosisAccountTransaction,
  memo: string
): Operation {
  const type = getOperationType(eventContent);
  const fee = new BigNumber(
    getOsmoAmountOsmosisType(transaction.transaction_fee)
  );
  // console.log("convertSendTransactionToOperation called");
  const senders = eventContent.sender[0]?.account?.id
    ? [eventContent.sender[0]?.account?.id]
    : [];
  const recipients = eventContent.recipient[0]?.account?.id
    ? [eventContent.recipient[0]?.account?.id]
    : [];

  return {
    id: encodeOperationId(accountId, transaction.hash, type),
    accountId,
    fee,
    value: getOperationValue(eventContent, type, fee),
    type,
    hash: transaction.hash,
    blockHash: transaction.block_hash,
    blockHeight: transaction.height,
    date: new Date(transaction.time),
    senders,
    recipients,
    hasFailed: !transaction.has_errors,
    extra: { memo }, // will need to serialize this separately as it's an extra field. More info here: https://developers.ledger.com/docs/coin/live-common/
  };
}

/**
 * Fetch operation list
 */
export const getOperations = async (
  accountId: string,
  addr: string,
  startAt = 0,
  transactionsLimit: number = DEFAULT_TRANSACTIONS_LIMIT
): Promise<Operation[]> => {
  const rawTransactions: Operation[] = [];

  const { data } = await network({
    method: "POST",
    url: getIndexerUrl(`/transactions_search/`),
    data: {
      network: "terra", //change this to osmosis later
      account: ["terra1p2yfmz0m9cmlts3ka7j5lp9t237et4c9pap6m0"], // change this to [addr] later
      limit: transactionsLimit,
      offset: startAt + 1,
    },
  });

  const accountTransactions = data;

  for (let i = 0; i < accountTransactions.length; i++) {
    const events = accountTransactions[i].events;
    const memo = accountTransactions[i].memo;
    const memoTransaction = memo || "";

    for (let j = 0; j < events.length; j++) {
      switch (
        events[j].kind // example: "send" or "receive", "aggregateexchangeratevote"... See: OsmosisAccountTransactionTypeEnum
      ) {
        case OsmosisAccountTransactionTypeEnum.Send: {
          const eventContent: OsmosisEventContent = events[j].sub;
          rawTransactions.push(
            convertSendTransactionToOperation(
              accountId,
              eventContent,
              accountTransactions[i],
              memoTransaction
              // Question, couldn't I simply pass here the Send type instead of re-calculating it later?
            )
          );
          break;
        }
        case OsmosisAccountTransactionTypeEnum.Receive: {
          const eventContent: OsmosisEventContent = events[j].sub;
          rawTransactions.push(
            convertSendTransactionToOperation(
              accountId,
              eventContent,
              accountTransactions[i],
              memoTransaction
              // Question, couldn't I simply pass here the Receive type instead of re-calculating it later?
            )
          );
          break;
        }
        default:
      }
    }
  }

  return rawTransactions;
};

const fetchLatestBlockHeight = async () => {
  const { data } = await network({
    method: "GET",
    url: getNodeUrl(`/blocks/latest`),
  });
  const latestBlockHeight = data?.block?.header?.height;
  return latestBlockHeight;
};

export const getAccount = async (address: string) => {
  const spendableBalance = await fetchAccountBalance(address);
  const blockHeight = await fetchLatestBlockHeight();
  return {
    blockHeight,
    balance: spendableBalance,
    spendableBalance,
  };
};
