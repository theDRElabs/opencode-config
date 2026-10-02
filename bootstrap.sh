#!/usr/bin/env bash
# bootstrap.sh - Provision an OpenCode harness host.
#
# Hosts: termux (Android/Termux + proot Debian), codespace, linux
# Idempotent. Safe to re-run. Never overwrites an existing .env.
set -euo pipefail

REPO_URL="${GIT_REPO_URL:-https://github.com/theDRElabs/opencode-config.git}"
BRANCH="${GIT_BRANCH:-phone/termux-setup}"
GRAPH_URL="${GRAPH_REPO_URL:-https://github.com/theDRElabs/graph-memory.git}"
CFGDIR="$HOME/.config/opencode"

log()  { printf "==> %s\n" "$*"; }
warn() { printf "[!] %s\n" "$*" >&2; }
die()  { printf "[x] %s\n" "$*" >&2; exit 1; }

detect_host() {
  if command -v termux-wake-lock >/dev/null 2>&1; then echo termux
  elif [ -f /.dockerenv ] || [ -d /workspaces ]; then echo codespace
  else echo linux; fi
}

termux_packages() {
  command -v pkg >/dev/null 2>&1 || die "pkg not found. Is this Termux?"
  log "Termux: refreshing package index"
  pkg update -y
  log "Termux: installing base toolchain"
  # nodejs-lts ships only a Corepack npm shim; install real npm too.
  pkg install -y git nano vim tmux jq python make clang openssh proot-distro nodejs-lts npm
}

linux_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    log "Installing base toolchain (apt)"
    sudo apt-get update -q
    sudo apt-get install -y git curl ca-certificates jq tmux vim build-essential python3
  fi
}

# OpenCode ships a glibc binary; Termux is musl, so it cannot exec without
# the Debian proot providing /lib/ld-linux-aarch64.so.1.
ensure_proot_debian() {
  command -v proot-distro >/dev/null 2>&1 || die "proot-distro missing"
  if proot-distro list 2>/dev/null | grep -q "debian"; then
    log "proot: debian container present"
  else
    log "proot: installing debian (large download)"
    proot-distro install debian
  fi
  if ! proot-distro run debian -- true >/dev/null 2>&1; then
    warn "debian container unhealthy; recreating"
    proot-distro remove debian || true
    proot-distro install debian
  fi
}

install_opencode_phone() {
  bin="$PREFIX/bin/opencode"
  rootfs="$PREFIX/var/lib/proot-distro/containers/debian/rootfs"
  if [ ! -x "$bin" ]; then
    log "Downloading opencode (linux-arm64)"
    mkdir -p "$PREFIX/tmp"
    curl -fsSL https://github.com/sst/opencode/releases/latest/download/opencode-linux-arm64.tar.gz -o "$PREFIX/tmp/oc.tar.gz"
    tar xzf "$PREFIX/tmp/oc.tar.gz" -C "$PREFIX/bin"
    chmod 755 "$bin"
  fi
  cat > "$PREFIX/bin/oc" <<WRAP
#!/data/data/com.termux/files/usr/bin/bash
R="$PREFIX/var/lib/proot-distro/containers/debian/rootfs"
mkdir -p "$R/usr/local/bin"
cp -f "$PREFIX/bin/opencode" "$R/usr/local/bin/opencode"
chmod 755 "$R/usr/local/bin/opencode"
exec proot-distro run debian -- /usr/local/bin/opencode "$@"
WRAP
  chmod 755 "$PREFIX/bin/oc"
  log "Installed wrapper: oc"
}

install_config() {
  src="$1"
  log "Installing config into $CFGDIR"
  mkdir -p "$CFGDIR"
  for f in HARNESS-CONTRACT.md HARNESS-ROADMAP.md; do
    [ -f "$src/$f" ] && cp -f "$src/$f" "$CFGDIR/$f" || true
  done
  for d in skills agent commands plugin; do
    [ -d "$src/$d" ] && cp -rf "$src/$d" "$CFGDIR/" || true
  done
  if [ ! -f "$CFGDIR/.env" ]; then
    cp "$src/.env.example" "$CFGDIR/.env"
    chmod 600 "$CFGDIR/.env"
    warn "Created $CFGDIR/.env from example. FILL IN YOUR KEYS."
  else
    log ".env exists - left untouched"
  fi
}

install_graph() {
  dst="$CFGDIR/graph"
  if [ -d "$dst/.git" ]; then
    log "graph already cloned"
    git -C "$dst" pull --ff-only || warn "graph pull failed"
  else
    log "Cloning knowledge graph"
    mkdir -p "$dst"
    git -C "$dst" clone "$GRAPH_URL" . 2>/dev/null || {
      git -C "$dst" init -q
      git -C "$dst" remote add origin "$GRAPH_URL"
    }
  fi
}

main() {
  HOST="$(detect_host)"
  log "Host: $HOST"
  case "$HOST" in
    termux)
      termux_packages
      ensure_proot_debian
      install_opencode_phone
      ;;
    *)
      linux_packages
      ;;
  esac

  REPO="${CFG_REPO_PATH:-$HOME/src/opencode-config}"
  if [ -d "$REPO/.git" ]; then
    log "Config repo present"
    git -C "$REPO" fetch origin -q
    git -C "$REPO" pull --ff-only -q || warn "config pull failed"
  else
    log "Cloning config repo ($BRANCH)"
    mkdir -p "$(dirname "$REPO")"
    git clone -b "$BRANCH" "$REPO_URL" "$REPO"
  fi

  install_config "$REPO"
  install_graph

  if [ -z "$(git config --global user.name || true)" ]; then
    log "Setting git identity"
    git config --global user.name "theDRElabs"
    git config --global user.email "imeelijah41@gmail.com"
    git config --global init.defaultBranch main
  fi

  log "Done. On Termux, start OpenCode with: oc"
}

main "$@"