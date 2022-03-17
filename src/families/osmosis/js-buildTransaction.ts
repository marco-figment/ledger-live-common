import { Account } from "../../types";
import { Transaction } from "./types";
import {
  makeAuthInfoBytes,
  Registry,
  TxBodyEncodeObject,
} from "@cosmjs/proto-signing";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import BigNumber from "bignumber.js";
import { fetchAccountInfo } from "./api/sdk";

export const buildTransaction = async (
  account: Account,
  transaction: Transaction
): Promise<any> => {
  const msg: Array<{ typeUrl: string; value: any }> = [];

  // Ledger Live is able to build transaction atomically,
  // Take care expected data are complete before push msg.
  // Otherwise, the transaction is silently returned intact.

  let isComplete = true;

  switch (transaction.mode) {
    case "send":
      if (!transaction.recipient || transaction.amount.lte(0)) {
        isComplete = false;
      } else {
        msg.push({
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: {
            fromAddress: account.freshAddress,
            toAddress: transaction.recipient,
            amount: [
              {
                denom: account.currency.units[1].code, // this is 'uosmo', per @ledgerhq/cryptoassets
                amount: transaction.amount.toString(),
              },
            ],
          },
        });
      }
      break;
  }

  if (!isComplete) {
    return [];
  }

  return msg;
};

export const postBuildTransaction = async (
  account: Account,
  transaction: Transaction,
  pubkey: any,
  unsignedPayload: any,
  signature: Uint8Array
): Promise<any> => {
  // √
  const txBodyFields: TxBodyEncodeObject = {
    typeUrl: "/cosmos.tx.v1beta1.TxBody",
    value: {
      messages: unsignedPayload,
      memo: transaction.memo || "",
    },
  };

  const registry = new Registry();
  const { sequence } = await fetchAccountInfo(account.freshAddress);
  const txBodyBytes = registry.encode(txBodyFields);

  const authInfoBytes = makeAuthInfoBytes(
    [{ pubkey, sequence }],
    [
      {
        amount: transaction.fees?.toString() || new BigNumber(0).toString(),
        denom: account.currency.units[1].code, // this is 'uosmo', per @ledgerhq/cryptoassets
      },
    ],
    transaction.gas?.toNumber() || new BigNumber(200000).toNumber(), // using 200000 as default, similar to examples found in osmosis codebase
    SignMode.SIGN_MODE_LEGACY_AMINO_JSON
  );

  const txRaw = TxRaw.fromPartial({
    bodyBytes: txBodyBytes,
    authInfoBytes,
    signatures: [signature],
  });

  const tx_bytes = Array.from(Uint8Array.from(TxRaw.encode(txRaw).finish()));

  return tx_bytes;
};

export default buildTransaction;
