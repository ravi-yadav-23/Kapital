#!/usr/bin/env bash
set -euo pipefail

# Verify static IP for NSE SmartAPI compliance
CURRENT_IP="$(curl -s https://api.ipify.org || echo 'UNKNOWN')"
echo "[NSE Static IP Check] Outbound public IP is: ${CURRENT_IP}"

if [ -n "${STATIC_IP:-}" ]; then
  if [ "${CURRENT_IP}" != "${STATIC_IP}" ]; then
    echo "[WARNING] Current IP (${CURRENT_IP}) does not match configured STATIC_IP (${STATIC_IP})!"
    exit 1
  fi
  echo "[OK] IP matches registered broker static IP."
fi

