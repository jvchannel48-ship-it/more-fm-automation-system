# MSIC managed OpenVPN on GCP — 900 Kbps per client

This is the **enforcement path** for an MSIC-owned VPN server. The existing VPN Gate list is made of third-party volunteer relays; MSIC cannot impose a speed limit on those machines. Do not describe VPN Gate profiles as capped.

## Policy

- Each connected client receives a Linux traffic-control class keyed to its OpenVPN tunnel IP.
- Limit: **900 kbit/s download and 900 kbit/s upload per client**, independently (full-duplex cap).
- Each client gets its own class, so one busy client does not consume another client's 900 kbit/s class.
- The server must use a dedicated OpenVPN tunnel subnet **10.8.0.0/24** and the tunnel interface **tun0**, unless the hook environment is overridden.
- This is a bandwidth shaper, not a monthly data quota or a carrier "free load/no-load" bypass.

## GCP prerequisites

1. Create an Ubuntu 24.04 Compute Engine VM in a GCP project you control. Choose a region close to the intended users and size it for expected concurrent users.
2. Reserve a static external IP. Configure the VPC firewall to allow only the OpenVPN transport/port you actually configure (for example UDP 1194) and SSH only from trusted administrator IPs.
3. Enable IP forwarding on the VM and configure the required GCP VPC route/NAT for the VPN subnet. Do not expose SSH or management ports to the whole internet.
4. Install and configure OpenVPN with a PKI, unique client certificates, certificate revocation, and `server 10.8.0.0 255.255.255.0`. Use unique client identities; do not distribute one shared profile to everyone.
5. Copy `scripts/msic-openvpn-rate-limit.sh` to `/etc/openvpn/msic-rate-limit.sh`, set owner root and mode 0750. Install `iproute2` and ensure the `ifb` kernel module is available.

## OpenVPN server hooks

Add these directives to the active server configuration (commonly `/etc/openvpn/server/server.conf`), then restart OpenVPN:

```conf
script-security 2
up /etc/openvpn/msic-rate-limit.sh init
client-connect /etc/openvpn/msic-rate-limit.sh connect
client-disconnect /etc/openvpn/msic-rate-limit.sh disconnect
```

If your OpenVPN service uses a different tunnel interface or address pool, set `TUN_DEV`, `IFB_DEV`, and `POOL_PREFIX` in the service environment and keep the subnet within a /24. The hook expects OpenVPN to provide `ifconfig_pool_remote_ip` to client-connect/client-disconnect scripts.

## Verify before inviting users

- Connect two test clients and confirm they receive different tunnel IPs.
- Run `tc -s class show dev tun0` and `tc -s class show dev ifb0`; each connected IP should have its own class.
- Run a speed test from both clients simultaneously. Each should be shaped to roughly 900 Kbps in each direction; TCP overhead and latency can make application tests read slightly lower.
- Disconnect a client and confirm its class disappears.
- Reboot the VM and verify the OpenVPN `up` hook recreates the qdiscs.
- Review GCP egress charges, logs, abuse reports, account/session limits, and certificate revocation procedures.

## Important limitations

- This hook only shapes traffic passing through the configured OpenVPN `tun0`/IFB path. It does not limit the existing VPN Gate volunteer servers.
- This repository's Next.js app does not provision GCP resources, issue client certificates, or deploy this hook. A GCP administrator must configure the VM and OpenVPN service before a managed profile can be offered in the app.
- The supplied `gs://...` customer-template object is not automatically installed by this guide. Verify its contents and provenance before using it; do not paste secrets or private keys into the repository.
