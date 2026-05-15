"use client";

// "Create new ledger from Settings" — uses the same 3-step
// LedgerSetupFlow component as initial onboarding (v1.38.1), wired
// to createNewLedger instead of createHousehold.
//
// The action handles the 20-ledger cap and the redirect on success;
// on failure the component surfaces the error inline.

import { useRouter } from "next/navigation";
import LedgerSetupFlow from "@/components/ledger-setup-flow";
import { createNewLedger } from "@/app/actions/households";

export default function NewLedgerPage() {
  const router = useRouter();
  return (
    <LedgerSetupFlow
      onCreate={async (fd) => {
        const result = await createNewLedger(fd);
        if (result?.error) return result;
        // Success: the action revalidates the relevant paths but
        // doesn't redirect (so the user CAN cancel by tapping back
        // on the final step). Send them to /transactions explicitly.
        router.push("/transactions");
        router.refresh();
      }}
      onBackFromStep1={() => router.back()}
    />
  );
}
