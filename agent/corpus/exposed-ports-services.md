# Understanding exposed ports and services

When something on your network is "reachable from the internet" on a given port, it
means a service is listening there and the outside world can connect to it. Some
open ports are normal; others are warning signs on a home connection.

## Ports that usually deserve attention if open

- **21 (FTP)** and **23 (Telnet)** — old, unencrypted file transfer and remote
  login. These should almost never face the internet on a home network.
- **22 (SSH)** and **3389 (Remote Desktop)** — remote login services. Powerful and
  a frequent target for password-guessing bots; only expose them if you truly need
  remote access and have strong protection in place.
- **80 / 443 / 8080 / 8443 (web)** — often a router admin page or a device's web
  interface. If this is your router's admin page, it should not be exposed.
- **445 (Windows file sharing)** — sharing internal files to the internet is a
  serious risk.
- **7547 (TR-069)** — an ISP remote-management port. It has been abused in
  large-scale attacks; if you did not intentionally enable it, treat it as a concern.

## What to do

For any exposed port you did not deliberately set up:
1. Check whether UPnP opened it automatically (see the UPnP guidance).
2. Check port-forwarding rules for an entry pointing at that port.
3. Disable remote management if the exposed service is the router itself.

Closing an unused open door is almost always safe and is one of the highest-value
changes you can make.

## Sources

Reflects common port-risk guidance from CISA and public exposure datasets such as
Shodan's service categorizations.
