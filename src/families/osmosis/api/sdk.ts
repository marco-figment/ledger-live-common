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
  const amount = getMicroOsmoAmountCosmosType(
    data.balances ? data.balances : []
  );
  return amount;
};

/**
 * Map transaction to an Operation Type
 */
function getOperationType(eventContent: OsmosisEventContent): OperationType {
  // See if we want to add an additional check to validate transaction type
  // in transaction.kind matches event.type
  // Also, get a code review here to see if we can trust this way of getting event type
  const type = eventContent.type[0];
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
    case "OUT":
      amount = BigNumber.sum(
        getMicroOsmoAmount(eventContent.sender[0]?.amounts),
        fee
      );
      break;
    case "IN":
      amount = getMicroOsmoAmount(eventContent.recipient[0]?.amounts);
      break;
    default:
      // defaults to received funds (i.e. no fee is added)
      amount = getMicroOsmoAmount(eventContent.recipient[0]?.amounts);
  }
  return amount;
}

/**
 * Extract only the amount from a list of type OsmosisAmount
 */
export const getMicroOsmoAmount = (amounts: OsmosisAmount[]): BigNumber => {
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
export const getMicroOsmoAmountCosmosType = (
  amounts: CosmosAmount[]
): BigNumber => {
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
  const fee = new BigNumber(getMicroOsmoAmount(transaction.transaction_fee));
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
    hasFailed: transaction.has_errors,
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
  const operations: Operation[] = [];
  const { data } = await network({
    method: "POST",
    url: getIndexerUrl(`/transactions_search/`),
    data: {
      network: "osmosis",
      account: [addr],
      limit: transactionsLimit,
      offset: startAt,
    },
  });
  if (data == null) {
    // throw new Error("Error retrieving transaction data");
    return operations;
  }
  const accountTransactions = data;
  // console.log("number of transactions to parse:", accountTransactions.length);
  for (let i = 0; i < accountTransactions.length; i++) {
    const events = accountTransactions[i].events;
    const memo = accountTransactions[i].memo;
    const memoTransaction = memo || "";
    // console.log(`evaluating transaction with index: ${i}`);
    for (let j = 0; j < events.length; j++) {
      const transactionType = events[j].kind ? events[j].kind : "n/a";
      switch (
        transactionType // example: "send" or "receive" See: OsmosisAccountTransactionTypeEnum
      ) {
        case OsmosisAccountTransactionTypeEnum.Send: {
          console.log("-> parsed a SEND transaction");
          const eventContent: OsmosisEventContent = events[j].sub;
          operations.push(
            convertSendTransactionToOperation(
              accountId,
              eventContent[0], // check that I can do this w/ indexer people
              accountTransactions[i],
              memoTransaction
            )
          );
          break;
        }
        // TODO refactor this duplication of code later
        case OsmosisAccountTransactionTypeEnum.Receive: {
          console.log("-> parsed a RECEIVE transaction");
          const eventContent: OsmosisEventContent = events[j].sub;
          operations.push(
            convertSendTransactionToOperation(
              accountId,
              eventContent,
              accountTransactions[i],
              memoTransaction
            )
          );
          break;
        }
        default:
          // Get feedback on what we want to do here. Maybe just silently ignore
          // or consider adding the operation with type "NONE", described in operation.ts
          // throw new Error("encountered error while parsing transaction type");
          console.log(
            "skipping transaction, because transaction type is: ",
            transactionType
          );
          break;
      }
    }
  }

  return operations;
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
