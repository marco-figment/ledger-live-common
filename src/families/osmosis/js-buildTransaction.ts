import { Account } from "../../types";
import { Transaction } from "./types";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { cosmos } from "@keplr-wallet/cosmos";
import { AminoSignResponse } from "@cosmjs/amino";
import { AminoMsgSend } from "@cosmjs/stargate";
import Long from "long";

export const buildTransaction = async (
  account: Account,
  transaction: Transaction
): Promise<any> => {
  const aminoMsgs: Array<{ type: string; value: any }> = [];
  const protoMsgs: Array<{ type_url: string; value: Uint8Array }> = [];

  let isComplete = true;

  // question: does keplr send both messages then?
  switch (transaction.mode) {
    case "send":
      if (!transaction.recipient || transaction.amount.lte(0)) {
        isComplete = false;
      } else {
        const aminoMsg: AminoMsgSend = {
          type: "cosmos-sdk/MsgSend",
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
          type_url: "/cosmos.bank.v1beta1.MsgSend",
          value: cosmos.bank.v1beta1.MsgSend.encode({
            fromAddress: account.freshAddress,
            toAddress: transaction.recipient,
            amount: [
              {
                denom: account.currency.units[1].code,
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
  signResponse: AminoSignResponse,
  protoMsgs: any
): Promise<any> => {
  const signed_tx_bytes = cosmos.tx.v1beta1.TxRaw.encode({
    bodyBytes: cosmos.tx.v1beta1.TxBody.encode({
      messages: protoMsgs,
      memo: signResponse.signed.memo,
    }).finish(),
    authInfoBytes: cosmos.tx.v1beta1.AuthInfo.encode({
      signerInfos: [
        {
          publicKey: {
            type_url: "/cosmos.crypto.secp256k1.PubKey",
            value: cosmos.crypto.secp256k1.PubKey.encode({
              key: Buffer.from(signResponse.signature.pub_key.value, "base64"),
            }).finish(),
          },
          modeInfo: {
            single: {
              mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON as cosmos.tx.signing.v1beta1.SignMode,
            },
          },
          sequence: Long.fromString(signResponse.signed.sequence),
        },
      ],
      fee: {
        amount: signResponse.signed.fee.amount as cosmos.base.v1beta1.ICoin[],
        gasLimit: Long.fromString(signResponse.signed.fee.gas),
      },
    }).finish(),
    signatures: [Buffer.from(signResponse.signature.signature, "base64")],
  }).finish();

  return signed_tx_bytes;
};

export default buildTransaction;
