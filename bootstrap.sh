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
ROOTFS="${PREFIX:+$PREFIX/var/lib/proot-distro/containers/debian/rootfs}"

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
  # proot-distro prints its container list to STDERR, not stdout, so piping
  # `proot-distro list 2>/dev/null` into a test discarded the very output being
  # checked: the container was always reported absent, and bootstrap died on
  # "container 'debian' already exists". Capture the output instead.
  # Avoid `| grep -q` here as well -- under `set -o pipefail` a short-circuiting
  # grep can surface a SIGPIPE failure from the left side of the pipe.
  proot_list="$(proot-distro list 2>&1 || true)"
  case "$proot_list" in
    *debian*) log "proot: debian container present" ;;
    *)
      log "proot: installing debian (large download)"
      proot-distro install debian
      ;;
  esac
  if ! proot-distro run debian -- true >/dev/null 2>&1; then
    warn "debian container unhealthy; recreating"
    proot-distro remove debian || true
    proot-distro install debian
  fi
}

install_opencode_phone() {
  # OpenCode is a glibc ELF and has to live inside the Debian proot: Termux is
  # musl and cannot exec it. Install straight into the rootfs and leave it
  # there. An earlier design kept a copy in $PREFIX/bin and re-copied it on
  # every launch, which silently reverted "opencode upgrade" -- the next
  # launch overwrote the upgraded binary with the stale source copy.
  dest="$ROOTFS/usr/local/bin/opencode"
  if [ ! -x "$dest" ]; then
    log "Downloading opencode (linux-arm64) into the proot rootfs"
    mkdir -p "$ROOTFS/usr/local/bin"
    curl -fsSL https://github.com/sst/opencode/releases/latest/download/opencode-linux-arm64.tar.gz -o "$PREFIX/oc.tar.gz"
    tar xzf "$PREFIX/oc.tar.gz" -C "$ROOTFS/usr/local/bin"
    chmod 755 "$dest"
    rm -f "$PREFIX/oc.tar.gz"
  fi

  # Thin launcher: no copy, no staging, no state left in the rootfs.
  # Quoted heredoc so nothing expands at write time.
  cat > "$PREFIX/bin/oc" <<'WRAP'
#!/data/data/com.termux/files/usr/bin/bash
# OpenCode runs inside the Debian proot (glibc); Termux is musl and cannot
# exec it. Config is symlinked: /root/.config/opencode -> Termux home.
exec proot-distro run debian -- /usr/local/bin/opencode "$@"
WRAP
  chmod 755 "$PREFIX/bin/oc"
  log "Installed launcher: oc"
}



link_config_into_proot() {
  # proot sets HOME to /root, NOT the Termux home, so opencode reads
  # /root/.config/opencode and would otherwise see an empty config -- every
  # skill, agent and command installed into $CFGDIR would be invisible.
  # Symlink rather than copy: one copy, in a git-visible location, and this
  # recreates the link if the rootfs is ever rebuilt.
  [ -n "$ROOTFS" ] || return 0
  link="$ROOTFS/root/.config/opencode"
  mkdir -p "$ROOTFS/root/.config"
  if [ -L "$link" ] || [ -e "$link" ]; then
    rm -rf "$link"
  fi
  ln -s "$CFGDIR" "$link"
  log "Linked $link -> $CFGDIR"
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
  if [ "$HOST" = termux ]; then link_config_into_proot; fi
  install_graph

  if [ -z "$(git config --global user.name || true)" ]; then
    log "Setting git identity"
    git config --global user.name "theDRElabs"
    # Use the noreply address, not the real one: GitHub rejects any push whose
    # commits carry a private email (GH007), which would leave a freshly
    # recovered device able to clone but unable to commit.
    git config --global user.email "144799227+theDRElabs@users.noreply.github.com"
    git config --global init.defaultBranch main
  fi

  log "Done. On Termux, start OpenCode with: oc"
}

main "$@"