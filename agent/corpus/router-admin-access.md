# Securing access to your router's settings

Your router has an admin page (sometimes an app) where its settings live. Keeping
that admin access locked down is one of the most important things you can do,
because anyone who reaches it can change how your whole network behaves.

## Remote administration / remote management

Remote administration lets you open the router's settings page from the internet,
not just from home. Most home users never need this. When it is on, your login
page is exposed to the entire internet, where automated bots constantly try common
usernames and passwords. Unless you have a specific reason to manage the router
while away from home, turn remote administration (sometimes called "remote
management", "web access from WAN", or "remote GUI") off.

## Change the default admin password

Many routers ship with a well-known default admin password, and those defaults are
published online. Set a strong, unique admin password that is different from your
Wi-Fi password. This matters even if remote administration is off, because a
device already on your network could otherwise reach the settings.

## Keep the admin page off the public internet

If a scan shows your router's admin web page (often on port 80, 443, 8080, or 8443)
is reachable from the internet, treat that as high priority: disable remote
management and, if present, remove any port-forwarding rule pointing at the router
itself.

## Sources

Guidance in this document reflects consumer-router hardening advice from CISA
(Home Network Security) and general vendor security documentation.
