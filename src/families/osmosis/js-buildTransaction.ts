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
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { AminoMsgSend } from "@cosmjs/stargate";

export const buildTransaction = async (
  account: Account,
  transaction: Transaction
): Promise<any> => {
  // TODO this "msgs" should instead be defined as protoMsgs of type google.protobuf.IAny[];
  const aminoMsgs: Array<{ type: string; value: any }> = [];
  const protoMsgs: Array<{ type_url: string; typeUrl: string; value: any }> =
    [];

  // Ledger Live is able to build transaction atomically,
  // Take care expected data are complete before push msg.
  // Otherwise, the transaction is silently returned intact.

  let isComplete = true;

  // question: does keplr send both messages then?
  switch (transaction.mode) {
    case "send":
      if (!transaction.recipient || transaction.amount.lte(0)) {
        isComplete = false;
      } else {
        // AMINO MESSAGE, shouldn't work as deprecated
        const aminoMsg: AminoMsgSend = {
          type: "cosmos-sdk/MsgSend", // per https://github.com/chainapsis/keplr-wallet/blob/477c57ce10beab169ad8b0da7d929c5bb988ca7e/packages/stores/src/account/cosmos.ts#L123
          value: {
            from_address: account.freshAddress,
            to_address: transaction.recipient,
            amount: [
              {
                denom: account.currency.units[1].code,
                amount: transaction.amount.toString(),
              },
            ],
          },
        };
        aminoMsgs.push(aminoMsg);

        // PROTO MESSAGE
        protoMsgs.push({
          type_url: "/cosmos.bank.v1beta1.MsgSend", // this is correct per: https://github.com/chainapsis/keplr-wallet/blob/477c57ce10beab169ad8b0da7d929c5bb988ca7e/packages/stores/src/account/cosmos.ts#L144
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: await MsgSend.encode({
            // MsgSend.encode per https://github.com/chainapsis/keplr-wallet/blob/477c57ce10beab169ad8b0da7d929c5bb988ca7e/packages/stores/src/account/cosmos.ts#L145-L149
            fromAddress: account.freshAddress,
            toAddress: transaction.recipient,
            amount: [
              {
                denom: account.currency.units[1].code, // this is 'uosmo', per @ledgerhq/cryptoassets
                amount: transaction.amount.toString(),
              },
            ],
          }).finish(),
        });
      }
      break;
  }

  if (!isComplete) {
    return [];
  }

  return { aminoMsgs, protoMsgs };
};

export const postBuildTransaction = async (
  account: Account,
  transaction: Transaction,
  pubkey: any,
  protoMsgs: any,
  signature: Uint8Array
): Promise<any> => {
  console.log("got to post build transaction");
  const txBodyFields: TxBodyEncodeObject = {
    typeUrl: "/cosmos.tx.v1beta1.TxBody",
    value: {
      messages: protoMsgs,
      memo: transaction.memo || "",
    },
  };

  // const registry = new Registry([
  //   ["/cosmos.bank.v1beta1.MsgSend", MsgSend],
  //   ["cosmos-sdk/MsgSend", MsgSend],
  // ]);
  const registry = new Registry();

  const { sequence } = await fetchAccountInfo(account.freshAddress);
  console.log("got here 5");
  const txBodyBytes = registry.encode(txBodyFields);
  console.log("got here 6");
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
  console.log("got here 7");
  const txRaw = TxRaw.fromPartial({
    bodyBytes: txBodyBytes,
    authInfoBytes,
    signatures: [signature],
  });
  const tx_bytes = Array.from(Uint8Array.from(TxRaw.encode(txRaw).finish()));

  return tx_bytes;
};

export default buildTransaction;
