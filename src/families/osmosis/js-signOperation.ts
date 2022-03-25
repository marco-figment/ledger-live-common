import {
  Account,
  Operation,
  OperationType,
  SignOperationEvent,
} from "../../types";
import type { Transaction } from "./types";
import { fetchAccountInfo, getChainId } from "./api/sdk";
import { Observable } from "rxjs";
import { withDevice } from "../../hw/deviceAccess";
// import { encodePubkey } from "@cosmjs/proto-signing";
import { PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { encodeOperationId } from "../../operation";
import { LedgerSigner } from "@cosmjs/ledger-amino";
import { AminoTypes } from "@cosmjs/stargate";
import { stringToPath } from "@cosmjs/crypto";
import { buildTransaction, postBuildTransaction } from "./js-buildTransaction";
import BigNumber from "bignumber.js";
import { makeSignDoc } from "@cosmjs/launchpad";

// Per https://github.com/osmosis-labs/osmosis-transak/blob/53259a5fa433aedfb5a5fb2bc142de4ed013800c/index.ts#L133
// const customTypes: Record<string, string> = { something: "something" };
// const customTypes = new AminoTypes().toAmino({
//   typeUrl: "cosmos-sdk/MsgSend",
//   value: {
//     type: "cosmos-sdk/MsgSend",
//     value: "/cosmos.bank.v1beta1.MsgSend",
//   },
// });

const aminoTypes = new AminoTypes({ prefix: "osmo" });

const signOperation = ({
  account,
  deviceId,
  transaction,
}: {
  account: Account;
  deviceId: any;
  transaction: Transaction;
}): Observable<SignOperationEvent> =>
  withDevice(deviceId)((transport) =>
    Observable.create((o) => {
      let cancelled;

      async function main() {
        const { accountNumber, sequence } = await fetchAccountInfo(
          account.freshAddress
        );
        const chainId = await getChainId();
        const hdPaths: any = stringToPath("m/" + account.freshAddressPath);
        const ledgerSigner = new LedgerSigner(transport, {
          hdPaths: [hdPaths],
          prefix: account.currency.id,
        });
        o.next({ type: "device-signature-requested" });
        const accounts = await ledgerSigner.getAccounts();

        // let pubkey;
        // accounts.forEach((a) => {
        //   if (a.address == account.freshAddress) {
        //     pubkey = encodePubkey({
        //       type: "tendermint/PubKeySecp256k1", // this is correct per keplr
        //       value: Buffer.from(a.pubkey).toString("base64"),
        //     });
        //   }
        // });

        // let pubkey;
        // accounts.forEach((a) => {
        //   if (a.address == account.freshAddress) {
        //     // pubkey = encodePubkey({
        //     //   type: "tendermint/PubKeySecp256k1", // this is correct per keplr
        //     //   value: Buffer.from(a.pubkey).toString("base64"),
        //     // });

        const { aminoMsgs, protoMsgs } = await buildTransaction(
          account,
          transaction
        );

        // const aMsgs = aminoMsgs.map((msg) => aminoTypes.fromAmino(msg));

        // Note:
        // We don't use Cosmos App,
        // Cosmos App support legacy StdTx and required to be ordered in a strict way,
        // Cosmos API expects a different sorting, resulting in a separate signature.
        // https://github.com/LedgerHQ/app-cosmos/blob/6c194daa28936e273f9548eabca9e72ba04bb632/app/src/tx_parser.c#L52

        // const signed = await ledgerSigner.signAmino(account.freshAddress, {
        //   chain_id: chainId,
        //   account_number: accountNumber.toString(),
        //   sequence: sequence.toString(),
        //   fee: {
        //     amount: [
        //       {
        //         denom: account.currency.units[1].code,
        //         amount: transaction.fees?.toString() as string,
        //       },
        //     ],
        //     gas: transaction.gas?.toString() as string,
        //   },
        //   msgs: aMsgs,
        //   memo: transaction.memo || "",
        // });

        const feeToEncode = {
          amount: [
            {
              denom: account.currency.units[1].code,
              amount: transaction.fees?.toString() as string,
            },
          ],
          gas: transaction.gas
            ? (transaction.gas.toString() as string)
            : (String(100000) as string),
        };

        const signDoc = makeSignDoc(
          aminoMsgs,
          feeToEncode,
          chainId,
          transaction.memo || "",
          accountNumber.toString(),
          sequence.toString()
        );

        /*
         *
         *  so far so good (verified with keplr codebase)
         *
         */

        const signResponse = await ledgerSigner.signAmino(
          account.freshAddress,
          signDoc
        );

        const signed_tx_bytes = await postBuildTransaction(
          account,
          transaction,
          signResponse,
          protoMsgs
        );

        const signature = Buffer.from(signed_tx_bytes).toString("hex");

        if (cancelled) {
          return;
        }

        o.next({ type: "device-signature-granted" });

        const hash = ""; // resolved at broadcast time
        const accountId = account.id;
        const fee = transaction.fees || new BigNumber(0);
        const extra = {};

        const type: OperationType = "OUT";

        const senders: string[] = [];
        const recipients: string[] = [];

        if (transaction.mode === "send") {
          senders.push(account.freshAddress);
          recipients.push(transaction.recipient);
        } else {
          throw new Error("Unsupported transaction type");
        }

        // build optimistic operation
        const operation: Operation = {
          id: encodeOperationId(accountId, hash, type),
          hash,
          type,
          value: transaction.useAllAmount
            ? account.spendableBalance
            : transaction.amount.plus(fee),
          fee,
          extra,
          blockHash: null,
          blockHeight: null,
          senders,
          recipients,
          accountId,
          date: new Date(),
          transactionSequenceNumber: sequence,
        };

        console.log("optimistic operation: ", operation);

        o.next({
          type: "signed",
          signedOperation: {
            operation,
            signature,
            expirationDate: null,
          },
        });
      }

      main().then(
        () => o.complete(),
        (e) => o.error(e)
      );

      return () => {
        cancelled = true;
      };
    })
  );

export default signOperation;
