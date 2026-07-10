"use server";

import { redirect } from "next/navigation";
import { createFirstUser, signIn, signOut, requireUser } from "@/lib/auth";
import { processRouterSetup } from "@/lib/router-setup";

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

export async function setupFirstUserAction(formData: FormData) {
  const email = requiredString(formData, "email");
  const password = requiredString(formData, "password");
  const setupToken = requiredString(formData, "setupToken");

  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  await createFirstUser(email, password, setupToken);
  redirect("/setup");
}

export async function signInAction(formData: FormData) {
  const email = requiredString(formData, "email");
  const password = requiredString(formData, "password");

  await signIn(email, password);
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
