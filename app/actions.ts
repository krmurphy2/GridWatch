"use server";

import { redirect } from "next/navigation";
import { createUser, signIn, signOut, requireUser } from "@/lib/auth";
import { processRouterSetup } from "@/lib/router-setup";

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

  redirect("/setup");
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export async function saveRouterSetupAction(formData: FormData) {
  const user = await requireUser();
  await processRouterSetup(formData, user.id);
  redirect("/setup?updated=1");
}
