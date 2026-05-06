// Types mirror the SQL schema in supabase/migrations/0001_initial_schema.sql.
// When the schema changes, regenerate with:
//   npx supabase gen types typescript --project-id <ref> --schema public

export type TransactionType = "income" | "expense";
export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  opening_balance: number;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  name: string;
  initials: string;
  avatar_color: string;
  household_id: string | null;
  created_at: string;
  language: "en" | "id" | null;
  icon_style: "2d" | "3d" | null;
};

export type Category = {
  id: string;
  household_id: string;
  name: string;
  symbol: string;
  color: string;
  is_default: boolean;
  created_at: string;
};

export type Transaction = {
  id: string;
  household_id: string;
  created_by: string | null;
  type: TransactionType;
  amount: number;
  name: string;
  note: string | null;
  category_id: string | null;
  date: string;
  created_at: string;
};

export type RecurringItem = {
  id: string;
  household_id: string;
  created_by: string | null;
  type: TransactionType;
  amount: number;
  name: string;
  category_id: string | null;
  frequency: RecurringFrequency;
  next_due_date: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      households:      { Row: Household;      Insert: Partial<Household>      & { name: string; invite_code: string };      Update: Partial<Household> };
      profiles:        { Row: Profile;        Insert: Partial<Profile>        & { id: string; email: string; name: string; initials: string }; Update: Partial<Profile> };
      categories:      { Row: Category;       Insert: Partial<Category>       & { household_id: string; name: string; symbol: string; color: string }; Update: Partial<Category> };
      transactions:    { Row: Transaction;    Insert: Partial<Transaction>    & { household_id: string; type: TransactionType; amount: number; name: string }; Update: Partial<Transaction> };
      recurring_items: { Row: RecurringItem;  Insert: Partial<RecurringItem>  & { household_id: string; type: TransactionType; amount: number; name: string; frequency: RecurringFrequency }; Update: Partial<RecurringItem> };
    };
  };
};
