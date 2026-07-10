"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateRouterProfileAction, type ProfileEditState } from "../actions";

type FieldValues = {
  routerVendor: string | null;
  routerModel: string | null;
  hardwareVersion: string | null;
  firmwareVersion: string | null;
  publicIp: string | null;
  routerAdminUrl: string | null;
  upnpStatus: string | null;
  remoteAdminStatus: string | null;
  portForwardingStatus: string | null;
  wifiSecurity: string | null;
};

type Props = {
  values: FieldValues;
  publicIpSuggestion: string | null;
};

const textFields: { name: keyof FieldValues; label: string; placeholder?: string }[] = [
  { name: "routerVendor", label: "Router vendor", placeholder: "e.g. TP-Link" },
  { name: "routerModel", label: "Router model", placeholder: "e.g. Archer AX55" },
  { name: "hardwareVersion", label: "Hardware version", placeholder: "e.g. v2" },
  { name: "firmwareVersion", label: "Firmware version", placeholder: "e.g. 1.2.6" },
  { name: "routerAdminUrl", label: "Router admin URL", placeholder: "e.g. 192.168.1.1" },
  { name: "upnpStatus", label: "UPnP status", placeholder: "Enabled or Disabled" },
  { name: "remoteAdminStatus", label: "Remote administration", placeholder: "Enabled or Disabled" },
  { name: "portForwardingStatus", label: "Port forwarding", placeholder: "Enabled or Disabled" },
  { name: "wifiSecurity", label: "Wi-Fi security", placeholder: "WPA3 / WPA2 / WEP / Open" }
];

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary-button" type="submit" disabled={pending}>
      <span className="button-content">
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        {pending ? "Saving..." : "Save profile details"}
      </span>
    </button>
  );
}

export function ProfileEditForm({ values, publicIpSuggestion }: Props) {
  const [state, formAction] = useFormState<ProfileEditState, FormData>(updateRouterProfileAction, {});
  const showIpSuggestion = !values.publicIp && Boolean(publicIpSuggestion);
  const publicIpDefault = values.publicIp ?? (publicIpSuggestion ?? "");

  return (
    <form action={formAction} className="form-grid">
      {state.error ? <p className="error">{state.error}</p> : null}

      <label className="field">
        <span>Public IP</span>
        <input
          type="text"
          name="publicIp"
          defaultValue={publicIpDefault}
          placeholder="e.g. 203.0.113.10"
          inputMode="numeric"
        />
      </label>

      {showIpSuggestion ? (
        <div className="notice">
          <p>
            No public IP was found in your screenshots. Based on your current connection, your
            router&apos;s public IP is likely <b>{publicIpSuggestion}</b>. We&apos;ve pre-filled it
            above &mdash; confirm it matches your router before saving.
          </p>
        </div>
      ) : null}

      {textFields.map((field) => (
        <label className="field" key={field.name}>
          <span>{field.label}</span>
          <input
            type="text"
            name={field.name}
            defaultValue={values[field.name] ?? ""}
            placeholder={field.placeholder}
          />
        </label>
      ))}

      <p className="muted">
        Leave a field blank if it doesn&apos;t apply. Values you enter here are saved to your
        profile and used in your security assessment.
      </p>

      <SaveButton />
    </form>
  );
}
