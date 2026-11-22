#!/usr/bin/env bash
# Per-client OpenVPN bandwidth shaping for an MSIC-managed Linux/GCP server.
# 900 kbit/s in each direction per connected client. This does not control third-party relays.
set -euo pipefail

MODE="${1:-}"
TUN_DEV="${TUN_DEV:-tun0}"
IFB_DEV="${IFB_DEV:-ifb0}"
POOL_PREFIX="${POOL_PREFIX:-10.8.0}"
RATE="${RATE:-900kbit}"
CEIL="${CEIL:-900kbit}"

log() { printf '[msic-vpn] %s\n' "$*"; }
fail() { printf '[msic-vpn] ERROR: %s\n' "$*" >&2; exit 1; }

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "Run this hook as root."
  command -v tc >/dev/null 2>&1 || fail "iproute2/tc is required."
  command -v ip >/dev/null 2>&1 || fail "iproute2/ip is required."
}

client_ip() {
  local value="${ifconfig_pool_remote_ip:-}"
  [[ "$value" =~ ^${POOL_PREFIX//./\\.}\\.([0-9]{1,3})$ ]] || fail "Missing or out-of-pool ifconfig_pool_remote_ip."
  local octet="${BASH_REMATCH[1]}"
  (( octet >= 2 && octet <= 254 )) || fail "Client IP is outside the supported pool range."
  printf '%s' "$value"
}

class_minor() {
  local ip="$1"
  printf '%d' "${ip##*.}"
}

init() {
  ip link show "$TUN_DEV" >/dev/null 2>&1 || fail "OpenVPN interface $TUN_DEV does not exist yet."
  modprobe ifb numifbs=1 2>/dev/null || true
  ip link show "$IFB_DEV" >/dev/null 2>&1 || ip link add "$IFB_DEV" type ifb
  ip link set "$IFB_DEV" up

  # Client downloads: packets leaving tun0 are classified by destination client IP.
  tc qdisc replace dev "$TUN_DEV" root handle 1: htb default 999
  tc class replace dev "$TUN_DEV" parent 1: classid 1:1 htb rate 1gbit ceil 1gbit
  tc class replace dev "$TUN_DEV" parent 1:1 classid 1:999 htb rate 1gbit ceil 1gbit
  tc qdisc replace dev "$TUN_DEV" handle ffff: ingress

  # Client uploads: redirect tun0 ingress to IFB, then classify by source client IP.
  tc filter replace dev "$TUN_DEV" parent ffff: protocol ip pref 1 u32 match u32 0 0 action mirred egress redirect dev "$IFB_DEV"
  tc qdisc replace dev "$IFB_DEV" root handle 1: htb default 999
  tc class replace dev "$IFB_DEV" parent 1: classid 1:1 htb rate 1gbit ceil 1gbit
  tc class replace dev "$IFB_DEV" parent 1:1 classid 1:999 htb rate 1gbit ceil 1gbit
  log "Shaping initialized on $TUN_DEV/$IFB_DEV; per-client rate is $RATE each way."
}

connect_client() {
  local ip minor
  ip="$(client_ip)"
  minor="$(class_minor "$ip")"
  tc class replace dev "$TUN_DEV" parent 1:1 classid "1:$minor" htb rate "$RATE" ceil "$CEIL" burst 32k cburst 32k
  tc qdisc replace dev "$TUN_DEV" parent "1:$minor" handle "${minor}0:" fq_codel
  tc filter replace dev "$TUN_DEV" parent 1: protocol ip pref "$minor" u32 match ip dst "$ip"/32 flowid "1:$minor"

  tc class replace dev "$IFB_DEV" parent 1:1 classid "1:$minor" htb rate "$RATE" ceil "$CEIL" burst 32k cburst 32k
  tc qdisc replace dev "$IFB_DEV" parent "1:$minor" handle "${minor}0:" fq_codel
  tc filter replace dev "$IFB_DEV" parent 1: protocol ip pref "$minor" u32 match ip src "$ip"/32 flowid "1:$minor"
  log "Applied $RATE upload/download cap to client $ip."
}

disconnect_client() {
  local ip minor
  ip="$(client_ip)"
  minor="$(class_minor "$ip")"
  tc filter del dev "$TUN_DEV" parent 1: protocol ip pref "$minor" 2>/dev/null || true
  tc filter del dev "$IFB_DEV" parent 1: protocol ip pref "$minor" 2>/dev/null || true
  tc class del dev "$TUN_DEV" classid "1:$minor" 2>/dev/null || true
  tc class del dev "$IFB_DEV" classid "1:$minor" 2>/dev/null || true
  log "Removed traffic classes for client $ip."
}

require_root
case "$MODE" in
  init) init ;;
  connect) connect_client ;;
  disconnect) disconnect_client ;;
  *) fail "Usage: $0 {init|connect|disconnect}" ;;
esac
