# Interpreting passive exposure results

Passive exposure data comes from public internet scanners (such as Shodan's
InternetDB) that routinely scan the whole internet and record what they see. When
GridWatch checks your public IP against this data, it is showing you what the
outside world can already observe — without actively scanning you.

## How to read it

- **Open ports** listed here are ports that public scanners saw responding on your
  connection. Compare them against what you intentionally set up. Anything you do
  not recognize is worth investigating (see the exposed-ports guidance).
- **Flagged vulnerabilities** mean a scanner matched a service on your connection to
  a known issue. Treat these as a prompt to update firmware and close services.
- **Tags and hostnames** give extra context about what kind of device or service
  was detected.

## Important limitations

Passive data is a snapshot and can be out of date. Your ISP may also rotate your
public IP address, so records could reflect a previous holder of that IP rather
than your network. For these reasons, passive results are supporting context, not
proof of a current problem — but open ports and flagged vulnerabilities are still
worth acting on.

A result of "no records found" is generally a good sign: it means public scanners
are not currently advertising open services for your IP.

## Sources

Reflects how public internet-scan datasets (Shodan / InternetDB) work and CISA
guidance on minimizing internet-facing exposure.
