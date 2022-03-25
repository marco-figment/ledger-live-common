import { Account } from "../../types";
import { Transaction } from "./types";
import {
  makeAuthInfoBytes,
  Registry,
  TxBodyEncodeObject,
} from "@cosmjs/proto-signing";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import { cosmos } from "@keplr-wallet/cosmos";
import BigNumber from "bignumber.js";
import { fetchAccountInfo } from "./api/sdk";
import { AminoSignResponse } from "@cosmjs/amino";
import { AminoMsgSend } from "@cosmjs/stargate";
import Long from "long";

export const buildTransaction = async (
  account: Account,
  transaction: Transaction
): Promise<any> => {
  // TODO this "msgs" should instead be defined as protoMsgs of type google.protobuf.IAny[];
  const aminoMsgs: Array<{ type: string; value: any }> = [];
  const protoMsgs: Array<{ type_url: string; value: Uint8Array }> = [];

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
          value: cosmos.bank.v1beta1.MsgSend.encode({
            // MsgSend.encode per https://github.com/chainapsis/keplr-wallet/blob/477c57ce10beab169ad8b0da7d929c5bb988ca7e/packages/stores/src/account/cosmos.ts#L145-L149
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
  // const txBodyFields: TxBodyEncodeObject = {
  //   typeUrl: "/cosmos.tx.v1beta1.TxBody",
  //   value: {
  //     messages: protoMsgs,
  //     memo: transaction.memo || "",
  //   },
  // };

  // const registry = new Registry([
  //   ["/cosmos.bank.v1beta1.MsgSend", MsgSend],
  //   ["cosmos-sdk/MsgSend", MsgSend],
  // ]);
  // const registry = new Registry();

  // const { sequence } = await fetchAccountInfo(account.freshAddress);

  // const txBodyBytes = registry.encode(txBodyFields);

  // const authInfoBytes = makeAuthInfoBytes(
  //   [{ pubkey, sequence }],
  //   [
  //     {
  //       amount: transaction.fees?.toString() || new BigNumber(0).toString(),
  //       denom: account.currency.units[1].code, // this is 'uosmo', per @ledgerhq/cryptoassets
  //     },
  //   ],
  //   transaction.gas?.toNumber() || new BigNumber(200000).toNumber(), // using 200000 as default, similar to examples found in osmosis codebase
  //   SignMode.SIGN_MODE_LEGACY_AMINO_JSON
  // );

  // const txRaw = TxRaw.fromPartial({
  //   bodyBytes: txBodyBytes,
  //   authInfoBytes,
  //   signatures: [signature],
  // });
  // const tx_bytes = Array.from(Uint8Array.from(TxRaw.encode(txRaw).finish()));

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
