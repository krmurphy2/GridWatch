"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUser, signIn, signOut, requireUser, getCurrentUser } from "@/lib/auth";
import {
  editableProfileFields,
  getLatestRouterProfile,
  updateRouterProfile,
  type RouterProfileUpdates
} from "@/lib/router-profile";
import { processRouterSetup } from "@/lib/router-setup";
import {
  appendChatMessage,
  clearChatMessages,
  countRecentUserMessages,
  getChatMessages
} from "@/lib/chat";
import { getChatReply } from "@/lib/chat-client";
import { lookupRouterCves } from "@/lib/nvd";
import { lookupPassiveExposure } from "@/lib/internetdb";
import { getSecurityFindings, saveSecurityFindings } from "@/lib/security-findings";
import type { SecurityFindings } from "@/lib/types";

const maxChatMessageLength = 2000;
const chatHistoryLimit = 20;
// Per-user rate limit on the paid LLM chat endpoint to prevent cost abuse.
const chatRateLimitWindowMs = 60_000;
const chatRateLimitMax = 15;
// Rate limit external security checks (NVD/InternetDB) per user to respect
// upstream free-tier limits and prevent abuse.
const securityChecksCooldownMs = 20_000;

// Returns /dashboard when the signed-in user already has a saved router profile,
// otherwise /setup so they can capture their first piece of evidence.
async function landingPathForCurrentUser() {
  try {
    const user = await getCurrentUser();

    if (user) {
      const profile = await getLatestRouterProfile(user.id);
      return profile ? "/dashboard" : "/setup";
    }
  } catch {
    // Fall through to the safe default below.
  }

  return "/setup";
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

export type AuthActionState = { error?: string };

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const email = requiredString(formData, "email");
    const password = requiredString(formData, "password");
    const setupToken = requiredString(formData, "setupToken");

    if (password.length < 12) {
      throw new Error("Password must be at least 12 characters.");
    }

    await createUser(email, password, setupToken);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create the account." };
  }

  // redirect() throws NEXT_REDIRECT, so it must run outside the try/catch above.
  redirect("/setup");
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const email = requiredString(formData, "email");
    const password = requiredString(formData, "password");

    await signIn(email, password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not sign in." };
  }

  redirect(await landingPathForCurrentUser());
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export async function saveRouterSetupAction(formData: FormData) {
  const user = await requireUser();
  await processRouterSetup(formData, user.id);
  redirect("/dashboard?updated=1");
}

export type ChatActionState = { error?: string };

export async function sendChatMessageAction(
  _prevState: ChatActionState,
  formData: FormData
): Promise<ChatActionState> {
  const user = await requireUser();
  const raw = formData.get("message");
  const message = typeof raw === "string" ? raw.trim() : "";

  if (!message) {
    return { error: "Enter a message to send." };
  }

  if (message.length > maxChatMessageLength) {
    return { error: `Messages must be ${maxChatMessageLength} characters or fewer.` };
  }

  try {
    const recentCount = await countRecentUserMessages(user.id, chatRateLimitWindowMs);
    if (recentCount >= chatRateLimitMax) {
      return {
        error: "You're sending messages too quickly. Please wait a moment and try again."
      };
    }

    await appendChatMessage(user.id, "user", message);

    const history = await getChatMessages(user.id);
    const profile = await getLatestRouterProfile(user.id);
    const reply = await getChatReply({
      userId: user.id,
      messages: history.slice(-chatHistoryLimit),
      routerProfile: profile
    });

    await appendChatMessage(user.id, "assistant", reply);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send the message." };
  }

  revalidatePath("/chat");
  return {};
}

export async function clearChatAction() {
  const user = await requireUser();
  await clearChatMessages(user.id);
  revalidatePath("/chat");
}

export type SecurityChecksState = { error?: string; ok?: boolean };

// Run the read-only external security checks (NVD CVE lookup + InternetDB passive
// exposure) for the signed-in user's router facts, persist the results, and
// refresh the dashboard. Both lookups only use the user's own vendor/model and
// verified public IP; private/LAN addresses are never sent to third parties.
export async function runSecurityChecksAction(
  _prevState: SecurityChecksState,
  _formData: FormData
): Promise<SecurityChecksState> {
  const user = await requireUser();

  try {
    const profile = await getLatestRouterProfile(user.id);

    if (!profile) {
      return { error: "Add router evidence before running security checks." };
    }

    const existing = await getSecurityFindings(user.id);
    if (existing && Date.now() - new Date(existing.checkedAt).getTime() < securityChecksCooldownMs) {
      return { error: "Checks were just run. Please wait a few seconds before retrying." };
    }

    const scanIp = profile.publicIp ?? profile.scanTargetIp;

    const [cve, passive] = await Promise.all([
      lookupRouterCves({ routerVendor: profile.routerVendor, routerModel: profile.routerModel }),
      lookupPassiveExposure(scanIp)
    ]);

    const findings: SecurityFindings = {
      cve: { query: cve.query, results: cve.results, note: cve.note },
      passive: { exposure: passive.exposure, note: passive.note },
      checkedAt: new Date().toISOString()
    };

    await saveSecurityFindings(user.id, findings);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not run security checks." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export type ProfileEditState = { error?: string; ok?: boolean };

export async function updateRouterProfileAction(
  _prevState: ProfileEditState,
  formData: FormData
): Promise<ProfileEditState> {
  const user = await requireUser();

  try {
    const updates: RouterProfileUpdates = {};

    for (const field of editableProfileFields) {
      const value = formData.get(field);
      updates[field] = typeof value === "string" ? value : null;
    }

    await updateRouterProfile(user.id, updates);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the profile." };
  }

  // Refresh the dashboard's server-rendered data in place. We intentionally do
  // not redirect here: pairing redirect() with useFormState can momentarily
  // yield an undefined state on the client and crash the form during the
  // transition. Returning a success state avoids that and keeps the user in
  // place with the recomputed profile.
  revalidatePath("/dashboard");
  return { ok: true };
}
