#!/usr/bin/env bash
#
# Rhythm Outdoors — one-step contributor setup for macOS.
#
# This installs the tools you need (Homebrew, Node 24, Git, GitHub CLI, Docker
# Desktop), signs you in to GitHub, downloads the project, and hands off to
# Claude to finish bringing the app up. It pauses with clear instructions at the
# few steps only a human can do (making a GitHub account, accepting your invite,
# and approving Docker the first time).
#
# It is safe to run more than once — it skips anything already done.
#
# Run it like this (copy the whole line into the Terminal app):
#   curl -fsSL https://rhytm-one.vercel.app/setup.sh -o ~/rhythm-setup.sh && bash ~/rhythm-setup.sh
#
# (Download-then-run — not "curl | bash" — so the sign-in prompts work.)

set -uo pipefail

# ---- pretty output --------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$(tput bold 2>/dev/null || echo); RESET=$(tput sgr0 2>/dev/null || echo)
  BLUE=$(tput setaf 4 2>/dev/null || echo); GREEN=$(tput setaf 2 2>/dev/null || echo)
  YELLOW=$(tput setaf 3 2>/dev/null || echo); RED=$(tput setaf 1 2>/dev/null || echo)
else
  BOLD=; RESET=; BLUE=; GREEN=; YELLOW=; RED=
fi

REPO="tazcarper/rhytm"
# Created inside whatever folder you run this from (cd there first).
REPO_DIR="$(pwd)/rhythm-outdoors"

step()  { printf "\n${BOLD}${BLUE}== %s ==${RESET}\n" "$*"; }
say()   { printf "   %s\n" "$*"; }
ok()    { printf "   ${GREEN}✓ %s${RESET}\n" "$*"; }
warn()  { printf "   ${YELLOW}! %s${RESET}\n" "$*"; }
fail()  { printf "\n${RED}✗ %s${RESET}\n" "$*"; exit 1; }

# Read a keypress from the real terminal even if stdin is busy.
pause() {
  printf "\n${BOLD}${YELLOW}%s${RESET}" "${1:-Press Enter to continue…}"
  read -r _ < /dev/tty || true
}

# ---- 0. intro -------------------------------------------------------------
clear 2>/dev/null || true
printf "${BOLD}Rhythm Outdoors — contributor setup${RESET}\n"
printf "This installs everything you need to edit the website with Claude.\n"
printf "It takes about 10–15 minutes, mostly waiting on downloads.\n\n"
printf "The project will be created in this folder:\n   ${BOLD}%s${RESET}\n\n" "$REPO_DIR"
printf "Not the right place? Press Ctrl-C, 'cd' into the folder you want,\nthen run the command again.\n"
pause "Press Enter to begin…"

# ---- 1. macOS check -------------------------------------------------------
step "Checking your computer"
[ "$(uname -s)" = "Darwin" ] || fail "This script is for Mac. Please use the written guide for other systems."
ok "macOS detected"

# ---- 2. Homebrew ----------------------------------------------------------
step "Step 1 of 6 — Homebrew (the tool installer)"
# If Homebrew is already installed but not yet on this shell's PATH (common on
# Apple Silicon), load it first so we DETECT it instead of reinstalling.
if ! command -v brew >/dev/null 2>&1; then
  if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
fi
if command -v brew >/dev/null 2>&1; then
  ok "Homebrew already installed ($(brew --version 2>/dev/null | head -1))"
else
  say "Installing Homebrew. It may ask for your Mac password — that's normal."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" < /dev/tty \
    || fail "Homebrew install failed. Re-run this script to try again."
  # Load the freshly-installed brew onto PATH for the rest of this run.
  if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
  ok "Homebrew installed"
fi
command -v brew >/dev/null 2>&1 || fail "Homebrew is installed but not on PATH. Close Terminal, reopen it, and run the script again."

# ---- 3. Node 24, Git, GitHub CLI -----------------------------------------
step "Step 2 of 6 — Node, Git, and the GitHub tool"
brew install node@24 git gh || fail "Could not install the base tools with Homebrew."
# node@24 is 'keg-only' — add it to PATH now and for future Terminal windows.
NODE_BIN="$(brew --prefix)/opt/node@24/bin"
export PATH="$NODE_BIN:$PATH"
PROFILE="$HOME/.zprofile"
if ! grep -qs "opt/node@24/bin" "$PROFILE" 2>/dev/null; then
  printf '\n# Rhythm Outdoors: use Node 24\nexport PATH="%s:$PATH"\n' "$NODE_BIN" >> "$PROFILE"
fi
command -v node >/dev/null 2>&1 || fail "Node did not install correctly."
ok "Node $(node --version), Git, and GitHub CLI ready"

# ---- 4. Docker Desktop ----------------------------------------------------
step "Step 3 of 6 — Docker Desktop (runs the practice database)"
if [ -d "/Applications/Docker.app" ] || command -v docker >/dev/null 2>&1; then
  ok "Docker Desktop already installed"
else
  say "Installing Docker Desktop (a big download — please be patient)…"
  brew install --cask docker-desktop 2>/dev/null || brew install --cask docker \
    || warn "Couldn't install Docker automatically. Download it from https://www.docker.com/products/docker-desktop/ and install it, then re-run this script."
fi
say "Opening Docker. The FIRST time, accept its license and approve any password"
say "prompt it shows — those dialogs are from Docker, not this script."
open -a Docker 2>/dev/null || open -a "Docker Desktop" 2>/dev/null || warn "Open Docker Desktop yourself from your Applications folder."
printf "   Waiting for Docker to be ready"
DOCKER_OK=""
for _ in $(seq 1 60); do
  if docker system info >/dev/null 2>&1; then DOCKER_OK="yes"; break; fi
  printf "."; sleep 3
done
printf "\n"
if [ -n "$DOCKER_OK" ]; then ok "Docker is running"
else warn "Docker isn't ready yet. Make sure the whale icon 🐳 is steady in your menu bar; the app step later will wait for it."; fi

# ---- 5. GitHub account + sign-in -----------------------------------------
step "Step 4 of 6 — Your GitHub account"
say "You need a (free) GitHub account, and your developer must have invited you"
say "to the project. If you haven't yet:"
say "   1) Sign up at https://github.com"
say "   2) Send your username to your developer"
say "   3) Accept the email invitation they send"
pause "Press Enter once you have an account AND accepted the invite…"

if gh auth status >/dev/null 2>&1; then
  ok "Already signed in to GitHub"
else
  say "Let's sign you in. Choose: GitHub.com → HTTPS → 'Login with a web browser'."
  gh auth login < /dev/tty || fail "GitHub sign-in didn't finish. Re-run the script to try again."
  ok "Signed in to GitHub"
fi

# Confirm we can actually see the project (proves the invite was accepted).
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  fail "You're signed in, but can't access the project yet. Make sure you accepted the invitation your developer sent (check your email or https://github.com/notifications), then re-run this script."
fi
ok "Project access confirmed"

# ---- 6. Get the project + install ----------------------------------------
step "Step 5 of 6 — Downloading the project"
if [ -d "$REPO_DIR/.git" ]; then
  ok "Project already downloaded at $REPO_DIR"
  git -C "$REPO_DIR" pull --ff-only origin main >/dev/null 2>&1 || warn "Couldn't auto-update; Claude can handle this later."
else
  gh repo clone "$REPO" "$REPO_DIR" || fail "Couldn't download the project."
  ok "Downloaded to $REPO_DIR"
fi
say "Installing the project's building blocks (npm install)…"
( cd "$REPO_DIR" && npm install ) || fail "npm install failed. Re-run the script to try again."
ok "Project ready"

# ---- 7. Hand off to Claude ------------------------------------------------
step "Step 6 of 6 — Finishing in Claude"
printf "\n${GREEN}${BOLD}Almost there!${RESET} Everything is installed and the project is on your computer.\n\n"
printf "${BOLD}Claude will now finish the setup (start the local database, add sample\n"
printf "logins, and open the site). When Claude loads, type exactly this:${RESET}\n\n"
printf "   ${BOLD}Set me up to work on this project for the first time.${RESET}\n\n"
pause "Press Enter to open Claude…"

cd "$REPO_DIR" || fail "Couldn't open the project folder."
if command -v claude >/dev/null 2>&1; then
  exec claude
else
  warn "Claude Code isn't installed on this computer."
  say "Install it with:  npm install -g @anthropic-ai/claude-code"
  say "Then run:  cd \"$REPO_DIR\" && claude"
fi
