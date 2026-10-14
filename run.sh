#!/usr/bin/env bash

# Generated run script for EmitDocs
# Start multiple servers concurrently with color-coded log prefixes.

set -e

# Configuration
PKG_MANAGER="pnpm"

# ANSI color codes
COLOR_BLUE=$'\e[34m'
COLOR_GREEN=$'\e[32m'
COLOR_CYAN=$'\e[36m'
COLOR_MAGENTA=$'\e[35m'
COLOR_YELLOW=$'\e[33m'
COLOR_RED=$'\e[31m'
COLOR_RESET=$'\e[0m'

declare -a PIDS=()
FORCE_COLOR=1
export FORCE_COLOR

# Subroutines

print_usage() {
  echo "Usage: ./run.sh [options]"
  echo ""
  echo "Options:"
  echo "  -l, --lint      Run lint across all directories before starting."
  echo "  -p, --prettify  Run format/prettify across all directories before starting."
  echo "  -h, --help      Show this help message."
  echo ""
  echo "Servers configured:"
  echo "  - web (frontend)"
  echo "  - api (backend)"
}

kill_tree() {
  local pid=$1
  local sig=${2:-TERM}
  local children
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  for child in $children; do
    kill_tree "$child" "$sig"
  done
  kill -"$sig" "$pid" 2>/dev/null || true
}

cleanup() {
  trap - SIGINT SIGTERM EXIT
  echo -e "\n${COLOR_RED}Shutting down servers...${COLOR_RESET}"
  for pid in "${PIDS[@]}"; do
    kill_tree "$pid" TERM
  done
  fuser -k 3000/tcp 2>/dev/null || true
  fuser -k 5173/tcp 2>/dev/null || true
  wait "${PIDS[@]}" 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

run_with_prefix() {
  local dir=$1
  local cmd=$2
  local prefix=$3
  local color=$4

  (
    cd "$dir" || exit 1
    eval "$cmd" 2>&1 | while IFS= read -r line; do
      echo -e "${color}[${prefix}]${COLOR_RESET} ${line}"
    done
  ) &
  
  local pid=$!
  PIDS+=("$pid")
}

run_lint() {
  echo -e "${COLOR_CYAN}Running lint...${COLOR_RESET}"
  for dir in "web" "api"; do
    if [ -d "$dir" ]; then
      echo "Linting $dir..."
      # Try running package lint script, fallback to eslint
      (cd "$dir" && { $PKG_MANAGER run lint 2>/dev/null || $PKG_MANAGER exec eslint . ; }) || {
        echo -e "${COLOR_RED}Lint failed in $dir${COLOR_RESET}"
        exit 1
      }
    fi
  done
  echo -e "${COLOR_GREEN}Lint complete.${COLOR_RESET}"
}

run_format() {
  echo -e "${COLOR_CYAN}Running format...${COLOR_RESET}"
  for dir in "web" "api"; do
    if [ -d "$dir" ]; then
      echo "Formatting $dir..."
      # Try running package format script, fallback to prettier
      (cd "$dir" && { $PKG_MANAGER run format 2>/dev/null || $PKG_MANAGER exec prettier --write . ; }) || {
        echo -e "${COLOR_RED}Format failed in $dir${COLOR_RESET}"
        exit 1
      }
    fi
  done
  echo -e "${COLOR_GREEN}Format complete.${COLOR_RESET}"
}

# Argument parsing
RUN_LINT=0
RUN_FORMAT=0

while [[ $# -gt 0 ]]; do
  case $1 in
    -l|--lint)
      RUN_LINT=1
      shift
      ;;
    -p|--prettify)
      RUN_FORMAT=1
      shift
      ;;
    -h|--help)
      print_usage
      trap - SIGINT SIGTERM EXIT
      exit 0
      ;;
    --vercel)
      USE_VERCEL=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      print_usage
      trap - SIGINT SIGTERM EXIT
      exit 1
      ;;
  esac
done

if [ "$RUN_LINT" -eq 1 ]; then
  run_lint
fi

if [ "$RUN_FORMAT" -eq 1 ]; then
  run_format
fi

# Pre-flight: ensure ports 3000 and 5173 are free
for port in 3000 5173; do
  if lsof -i :"$port" >/dev/null 2>&1; then
    echo -e "${COLOR_YELLOW}Port $port is in use. Releasing port...${COLOR_RESET}"
    fuser -k "$port"/tcp 2>/dev/null || true
    sleep 0.5
  fi
done

# Concurrent Server Phase
set +e

echo -e "${COLOR_GREEN}Starting servers...${COLOR_RESET}"

BACKEND_CMD="$PKG_MANAGER run dev"
if [ "${USE_VERCEL:-0}" -eq 1 ]; then
  BACKEND_CMD="vercel dev --yes"
fi

run_with_prefix "web" "$PKG_MANAGER run dev" "frontend" "$COLOR_BLUE"
run_with_prefix "api" "$BACKEND_CMD" "backend" "$COLOR_GREEN"

# Wait for the first server to exit (e.g. crash)
wait -n

echo -e "${COLOR_RED}A server has exited. Initiating shutdown...${COLOR_RESET}"
cleanup

