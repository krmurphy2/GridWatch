import { requireUser } from "@/lib/auth";
import { getLatestRouterProfile } from "@/lib/router-profile";
import { saveRouterSetupAction, signOutAction } from "../actions";
import { ExtractSubmitButton } from "./submit-button";

const importantFields = [
  ["routerVendor", "Router vendor"],
  ["routerModel", "Router model"],
  ["hardwareVersion", "Hardware version"],
  ["firmwareVersion", "Firmware version"],
  ["publicIp", "Public IP"],
  ["upnpStatus", "UPnP status"],
  ["remoteAdminStatus", "Remote admin status"],
  ["portForwardingStatus", "Port forwarding"],
  ["wifiSecurity", "Wi-Fi security"]
] as const;

export default async function SetupPage({ searchParams }: { searchParams: { updated?: string } }) {
  const user = await requireUser();
  const profile = await getLatestRouterProfile(user.id);

  return (
    <main className="page-shell">
      <div className="container">
        <div className="header-row">
          <div>
            <p className="eyebrow">Information gathering</p>
            <h1>Router setup</h1>
          </div>
          <form action={signOutAction}>
            <button className="secondary-button" type="submit">Sign out</button>
          </form>
        </div>

        {searchParams.updated === "1" ? (
          <p className="success">Router evidence saved. Review extracted and missing fields below.</p>
        ) : null}

        <div className="two-column">
          <section className="card">
            <div className="card-inner">
              <form className="form-grid" action={saveRouterSetupAction}>
                <h2>Upload router evidence</h2>
                <p className="muted">
                  Upload screenshots from your router admin pages. Useful pages include status, firmware, internet/WAN, firewall, remote administration, UPnP, and port forwarding.
                </p>
                <label className="field">
                  <span>Router admin screenshot</span>
                  <input name="routerImage" type="file" accept="image/*" required />
                </label>
                <label className="field">
                  <span>Extra notes</span>
                  <textarea name="userNotes" placeholder="Example: ISP router, Netgear app screenshot, or anything visible that may help identify model/firmware." />
                </label>
                <label className="field">
                  <span>Public router IP if you know it</span>
                  <input name="scanTargetIp" placeholder="Example: 203.0.113.10" inputMode="decimal" />
                </label>
                <label className="checkbox">
                  <input name="scanApproved" type="checkbox" />
                  <span>
                    I approve a future limited external exposure scan only against my verified router public IP. I understand GridWatch will refuse arbitrary public IP, domain, or CIDR scans.
                  </span>
                </label>
                <ExtractSubmitButton />
              </form>
            </div>
          </section>

          <section className="stack">
            <ProfileSummary profile={profile} />
            <MissingFields profile={profile} />
          </section>
        </div>
      </div>
    </main>
  );
}

function ProfileSummary({ profile }: { profile: Awaited<ReturnType<typeof getLatestRouterProfile>> }) {
  if (!profile) {
    return (
      <section className="card">
        <div className="card-inner">
          <h2>No router profile yet</h2>
          <p className="muted">Upload a screenshot to create the first retained router profile.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-inner stack">
        <div>
          <p className="eyebrow">Saved profile</p>
          <h2>Extracted data</h2>
          <p className="muted">Latest upload: {profile.imageName ?? "unknown file"}</p>
        </div>
        <ul className="result-list">
          {importantFields.map(([key, label]) => (
            <li className="label-value" key={key}>
              <b>{label}</b>
              <span>{profile[key] ?? "Missing"}</span>
            </li>
          ))}
          <li className="label-value">
            <b>Scan approved</b>
            <span>{profile.scanApproved ? `Yes${profile.scanTargetIp ? ` for ${profile.scanTargetIp}` : ""}` : "No"}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

function MissingFields({ profile }: { profile: Awaited<ReturnType<typeof getLatestRouterProfile>> }) {
  if (!profile) {
    return null;
  }

  return (
    <section className="card">
      <div className="card-inner stack">
        <div>
          <p className="eyebrow">Next evidence needed</p>
          <h2>Missing from image</h2>
        </div>
        {profile.missingFields.length > 0 ? (
          <ul className="result-list">
            {profile.missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        ) : (
          <p className="success">No required fields were reported missing by the extractor.</p>
        )}
        {profile.extraction.notes.length > 0 ? (
          <div className="notice">
            {profile.extraction.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
