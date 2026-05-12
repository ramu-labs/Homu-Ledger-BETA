"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackCategory, FeedbackStatus } from "@/lib/types";

type Result = { error?: string };

const CATEGORIES: FeedbackCategory[] = ["bug", "feature", "question", "other"];
const STATUSES: FeedbackStatus[] = ["open", "in_progress", "closed"];

function parseCategory(v: FormDataEntryValue | null): FeedbackCategory {
  return CATEGORIES.includes(v as FeedbackCategory) ? (v as FeedbackCategory) : "other";
}

function parseStatus(v: FormDataEntryValue | null): FeedbackStatus | null {
  return STATUSES.includes(v as FeedbackStatus) ? (v as FeedbackStatus) : null;
}

export async function createFeedback(formData: FormData): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const subject = (formData.get("subject") ?? "").toString().trim();
  const body = (formData.get("body") ?? "").toString().trim();
  if (!subject) return { error: "Subject is required" };
  if (!body) return { error: "Message is required" };
  const category = parseCategory(formData.get("category"));
  const attachments = formData
    .getAll("attachments")
    .map((v) => v.toString())
    .filter(Boolean);

  // Optional: tag with current household for context
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      created_by: user.id,
      household_id: profile?.household_id ?? null,
      subject,
      body,
      category,
      attachments,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/settings/feedback-admin");
  revalidatePath("/settings/help");
  return { id: data.id };
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/feedback-admin");
  return {};
}

export async function replyToFeedback(id: string, reply: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const trimmed = reply.trim();
  if (!trimmed) return { error: "Reply cannot be empty" };
  const { error } = await supabase
    .from("feedback")
    .update({
      reply: trimmed,
      replied_at: new Date().toISOString(),
      replied_by: user.id,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/feedback-admin");
  return {};
}

export async function deleteFeedback(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/feedback-admin");
  return {};
}

/** Server-side action used by status-change buttons in the admin shell. */
export async function setFeedbackStatusFromForm(formData: FormData): Promise<Result> {
  const id = (formData.get("id") ?? "").toString();
  const status = parseStatus(formData.get("status"));
  if (!id || !status) return { error: "Invalid input" };
  return updateFeedbackStatus(id, status);
}
