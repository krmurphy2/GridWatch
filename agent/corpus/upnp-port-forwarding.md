# UPnP and port forwarding

Both of these features can open "doors" from the internet to devices on your home
network. They are useful in specific cases but are a common source of accidental
exposure.

## UPnP (Universal Plug and Play)

UPnP lets devices on your network open inbound ports on the router automatically,
without asking you. Game consoles, some smart-home hubs, and peer-to-peer apps use
it for convenience. The risk is that any device — including malware or a poorly
written app — can quietly open your network to the internet, and you have no easy
way to see what was opened.

Recommendation: turn UPnP off unless you have a device that clearly needs it and
stops working without it. If you turn it off and something breaks, you can set up a
single, specific port-forwarding rule instead, which is visible and controlled.

## Port forwarding

Port forwarding is a deliberate rule that sends inbound internet traffic on a
chosen port to one specific device (for example, a security camera or a game
server). Because it is intentional, it is safer than UPnP — but old or forgotten
rules are a frequent problem. A rule set up years ago for a device you no longer
own can leave a port open to the internet.

Recommendation: review the port-forwarding list and remove anything you do not
recognize or no longer use. For rules you keep, make sure the target device is
patched and protected by a strong password.

## Sources

Reflects home-network hardening guidance from CISA and OWASP IoT security
recommendations on minimizing inbound exposure.
