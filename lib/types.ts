export type TransactionType = "income" | "expense";

export type FeedbackCategory = "bug" | "feature" | "question" | "other";
export type FeedbackStatus = "open" | "in_progress" | "closed";

export type DbFeedback = {
  id: string;
  created_at: string;
  created_by: string | null;
  household_id: string | null;
  subject: string;
  body: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  attachments: string[];
  reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
};

export type DbHousehold = {
  id: string;
  name: string;
  currency: string;
  symbol: string;
  invite_code?: string;
  owner_id?: string | null;
};

export type DbHouseholdMembership = {
  household_id: string;
  role: "owner" | "member";
  household: DbHousehold;
};

export type DbPendingInvitation = {
  id: string;
  household_id: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  household: { id: string; name: string; symbol: string | null; currency: string };
  inviter: { id: string; name: string; initials: string; avatar_color: string } | null;
};

export type DbCategory = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  type: TransactionType;
  is_default?: boolean;
};

export type DbWallet = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  initial_balance: number;
  is_default: boolean;
};

export type SubscriptionTier = "3_months" | "6_months" | "1_year" | "lifetime" | "developer";

export type DbPromoCode = {
  id: string;
  code: string;
  tier: SubscriptionTier;
  created_at: string;
  created_by: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  redeemer?: { id: string; name: string } | null;
};

export type PromoCodeStats = {
  total: number;
  redeemed: number;
  byTier: Record<SubscriptionTier, { generated: number; redeemed: number }>;
};

export type DbMember = {
  id: string;
  name: string;
  initials: string;
  avatar_color: string;
};

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export type DbRecurringItem = {
  id: string;
  type: TransactionType;
  amount: number;
  name: string;
  category_id: string | null;
  wallet_id: string | null;
  frequency: RecurringFrequency;
  next_due_date: string | null;
  repeat_until: string | null;
  created_by: string | null;
  created_at: string;
  categories: DbCategory | null;
  wallets: DbWallet | null;
};

export type DbTransaction = {
  id: string;
  type: TransactionType;
  amount: number;
  name: string;
  category_id: string | null;
  wallet_id: string | null;
  transfer_pair_id: string | null;
  recurring_item_id: string | null;
  date: string;
  created_by: string | null;
  created_at: string;
  categories: DbCategory | null;
  wallets: DbWallet | null;
  /** Set on transfer rows after deduplication: the OTHER wallet in the pair. */
  peer_wallet?: DbWallet | null;
  photo_url: string | null;
};
