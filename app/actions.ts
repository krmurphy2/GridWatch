"use server";

import { redirect } from "next/navigation";
import { createUser, signIn, signOut, requireUser, getCurrentUser } from "@/lib/auth";
import {
  editableProfileFields,
  getLatestRouterProfile,
  updateRouterProfile,
  type RouterProfileUpdates
} from "@/lib/router-profile";
import { processRouterSetup } from "@/lib/router-setup";

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

export type ProfileEditState = { error?: string };

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

  redirect("/dashboard?updated=1");
}
