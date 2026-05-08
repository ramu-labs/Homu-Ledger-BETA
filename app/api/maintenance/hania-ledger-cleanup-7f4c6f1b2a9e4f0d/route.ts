import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

type MembershipRow = {
  household_id: string;
  role: "owner" | "member";
  household: {
    id: string;
    name: string;
    owner_id: string | null;
    symbol: string | null;
    currency: string | null;
  } | null;
};

const TARGET_EMAIL = "haniagracia@gmail.com";
const TARGET_USERNAME = "hania";
const PERSONAL_NAME = "Personal";
const PERSONAL_SYMBOL = "👤";

function isPersonalName(name: string | null | undefined) {
  return name?.trim().toLowerCase() === PERSONAL_NAME.toLowerCase();
}

async function cleanup(apply: boolean) {
  const supabase = getAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, username, household_id")
    .or(`email.eq.${TARGET_EMAIL},username.eq.${TARGET_USERNAME}`)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("Hania profile not found");

  const { data: membershipsRaw, error: membershipsError } = await supabase
    .from("household_members")
    .select("household_id, role, household:households(id, name, owner_id, symbol, currency)")
    .eq("profile_id", profile.id);

  if (membershipsError) throw new Error(membershipsError.message);

  const memberships = (membershipsRaw ?? []) as unknown as MembershipRow[];
  const ownedMemberships = memberships.filter((m) => m.household?.owner_id === profile.id);
  const existingPersonal = ownedMemberships.find((m) => isPersonalName(m.household?.name));

  let keepHouseholdId = existingPersonal?.household_id ?? null;
  let createdPersonalId: string | null = null;

  if (apply && !keepHouseholdId) {
    const { data: inviteCode, error: codeError } = await supabase.rpc("generate_invite_code");
    if (codeError || !inviteCode) throw new Error(codeError?.message ?? "Failed to generate invite code");

    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({
        name: PERSONAL_NAME,
        symbol: PERSONAL_SYMBOL,
        currency: "IDR",
        invite_code: inviteCode,
        opening_balance: 0,
        owner_id: profile.id,
      })
      .select("id")
      .single();

    if (householdError || !household) throw new Error(householdError?.message ?? "Failed to create Personal ledger");

    const { error: memberError } = await supabase
      .from("household_members")
      .insert({ household_id: household.id, profile_id: profile.id, role: "owner" });
    if (memberError) throw new Error(memberError.message);

    keepHouseholdId = household.id;
    createdPersonalId = household.id;
  }

  if (!keepHouseholdId) {
    keepHouseholdId = "will-create-personal-ledger";
  }

  const deleteOwnedHouseholdIds = ownedMemberships
    .map((m) => m.household_id)
    .filter((id) => id !== keepHouseholdId);
  const removeMemberHouseholdIds = memberships
    .filter((m) => m.household?.owner_id !== profile.id)
    .map((m) => m.household_id)
    .filter((id) => id !== keepHouseholdId);

  if (apply) {
    const realKeepHouseholdId = keepHouseholdId;
    if (realKeepHouseholdId === "will-create-personal-ledger") {
      throw new Error("Internal error: Personal ledger was not created");
    }

    const { error: updateKeepError } = await supabase
      .from("households")
      .update({ name: PERSONAL_NAME, symbol: PERSONAL_SYMBOL, owner_id: profile.id })
      .eq("id", realKeepHouseholdId);
    if (updateKeepError) throw new Error(updateKeepError.message);

    if (removeMemberHouseholdIds.length > 0) {
      const { error } = await supabase
        .from("household_members")
        .delete()
        .eq("profile_id", profile.id)
        .in("household_id", removeMemberHouseholdIds);
      if (error) throw new Error(error.message);
    }

    if (deleteOwnedHouseholdIds.length > 0) {
      const { error } = await supabase
        .from("households")
        .delete()
        .in("id", deleteOwnedHouseholdIds);
      if (error) throw new Error(error.message);
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ household_id: realKeepHouseholdId })
      .eq("id", profile.id);
    if (profileUpdateError) throw new Error(profileUpdateError.message);
  }

  const { data: afterRaw, error: afterError } = await supabase
    .from("household_members")
    .select("household_id, role, household:households(id, name, owner_id, symbol, currency)")
    .eq("profile_id", profile.id);
  if (afterError) throw new Error(afterError.message);

  return {
    apply,
    profile: { id: profile.id, email: profile.email, username: profile.username },
    before: memberships.map((m) => ({
      id: m.household_id,
      name: m.household?.name,
      symbol: m.household?.symbol,
      owner: m.household?.owner_id === profile.id,
      role: m.role,
    })),
    planned: {
      keepHouseholdId,
      createdPersonalId,
      deleteOwnedHouseholdIds,
      removeMemberHouseholdIds,
    },
    after: ((afterRaw ?? []) as unknown as MembershipRow[]).map((m) => ({
      id: m.household_id,
      name: m.household?.name,
      symbol: m.household?.symbol,
      owner: m.household?.owner_id === profile.id,
      role: m.role,
    })),
  };
}

export async function GET() {
  try {
    return NextResponse.json(await cleanup(false));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cleanup failed" }, { status: 500 });
  }
}

export async function POST() {
  try {
    return NextResponse.json(await cleanup(true));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cleanup failed" }, { status: 500 });
  }
}
