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
import { encodeOperationId } from "../../operation";
import { LedgerSigner } from "@cosmjs/ledger-amino";
import { stringToPath } from "@cosmjs/crypto";
import { buildTransaction, postBuildTransaction } from "./js-buildTransaction";
import BigNumber from "bignumber.js";
import { makeSignDoc } from "@cosmjs/launchpad";
import getEstimatedFees from "./js-getFeesForTransaction";

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

        const { aminoMsgs, protoMsgs } = await buildTransaction(
          account,
          transaction
        );

        const freshFees = await getEstimatedFees();
        const feeToEncode = {
          amount: [
            {
              denom: account.currency.units[1].code,
              amount: transaction.fees
                ? (transaction.fees.toNumber().toString() as string)
                : (String(freshFees) as string),
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

        // It shouldn't be necessary to do this, I'm being extra careful
        // for now but should revert later to:
        // const fee = transaction.fees || new BigNumber(0);
        const fee = transaction.fees
          ? new BigNumber(transaction.fees.toNumber())
          : new BigNumber(0);

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
