import { Coin } from "@cosmjs/stargate";
import {
  AuthInfo,
  SignerInfo,
  DeepPartial,
  TxBody,
} from "cosmjs-types/cosmos/tx/v1beta1/tx";
import _m0 from "protobufjs/minimal";

interface Any {
  readonly type_url: string;
  readonly value: Uint8Array;
}

/** TxBody is the body of a transaction that all signers sign over. */
export interface TxBodyHack
  extends Omit<
    TxBody,
    | "messages"
    | "timeoutHeight"
    | "extensionOptions"
    | "nonCriticalExtensionOptions"
  > {
  /**
   * messages is a list of messages to be executed. The required signers of
   * those messages define the number and order of elements in AuthInfo's
   * signer_infos and Tx's signatures. Each required signer address is added to
   * the list only the first time it occurs.
   * By convention, the first required signer (usually from the first message)
   * is referred to as the primary signer and pays the fee for the whole
   * transaction.
   */
  messages: Any[];
  /** memo is any arbitrary memo to be added to the transaction */
  memo: string;
}

export declare const TxBodyHack: {
  encode(message: TxBodyHack, writer?: _m0.Writer): _m0.Writer;
  decode(
    input: _m0.Reader | Uint8Array,
    length?: number | undefined
  ): TxBodyHack;
  fromJSON(object: any): TxBodyHack;
  toJSON(message: TxBodyHack): unknown;
  fromPartial(object: DeepPartial<TxBodyHack>): TxBodyHack;
};

/**
 * AuthInfo describes the fee and signer modes that are used to sign a
 * transaction.
 */
export interface AuthInfoHack extends Omit<AuthInfo, "signerInfos" | "fee"> {
  signerInfos: SignerInfoHack[];
  fee?: Coin[];
}

/**
 * SignerInfo describes the public key and signing mode of a single top-level
 * signer.
 */
export interface SignerInfoHack extends Omit<SignerInfo, "publicKey"> {
  /**
   * public_key is the public key of the signer. It is optional for accounts
   * that already exist in state. If unset, the verifier can use the required \
   * signer address for this position and lookup the public key.
   */
  publicKey?: Any;
}

export declare const AuthInfoHack: {
  encode(message: AuthInfoHack, writer?: _m0.Writer): _m0.Writer;
  decode(
    input: _m0.Reader | Uint8Array,
    length?: number | undefined
  ): AuthInfoHack;
  fromJSON(object: any): AuthInfoHack;
  toJSON(message: AuthInfoHack): unknown;
  fromPartial(object: DeepPartial<AuthInfoHack>): AuthInfoHack;
};
