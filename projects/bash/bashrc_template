# .bashrc
# Source global definitions
if [ -f /etc/bashrc ]; then
    . /etc/bashrc
fi

# User specific environment
for dir in "$HOME/.local/bin" "$HOME/bin" "$HOME/.mistral/bin"; do
    if [[ -d "$dir" && ":$PATH:" != *":$dir:"* ]]; then
        PATH="$dir:$PATH"
    fi
done
unset dir

# User specific aliases and functions
if [ -d ~/.bashrc.d ]; then
    for rc in ~/.bashrc.d/*; do
        if [ -f "$rc" ]; then
            . "$rc"
        fi
    done
fi
# Unset commands here
unset rc
unset DEBUGINFOD_URLS
unset SSH_AUTH_SOCK
unset P11_KIT_SERVER_ADDRESS

#  GLOBAL FUNCTIONS ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
#  Display file contents directly in the terminal
tcat() {
    [[ "${KIMCTL_QUIET:-0}" == 1 ]] && return 0
    if [[ ! -w /dev/tty ]]; then
        printf 'Error: No writable terminal available.\n' >&2
        return 1
    fi
    command cat -- "$@" > /dev/tty
}

# Terminal presentation helpers.
# Consistent, compact status messages for interactive and non-interactive shells.
_terminal_msg() {
    local status="${1:-normal}" label color
    case "$status" in
        success|error|warning|normal) shift ;;
        *) status=normal ;;
    esac
    [[ "${KIMCTL_QUIET:-0}" == 1 ]] && return 0
    case "$status" in
        success) label=" OK  "; color='1;32' ;;
        error)   label="FAIL "; color='1;31' ;;
        warning) label="WARN "; color='1;33' ;;
        normal)  label="INFO "; color='1;36' ;;
    esac
    if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
        printf '  \033[%sm[%s]\033[0m %s\n' "$color" "$label" "$*"
    else
        printf '  [%s] %s\n' "$label" "$*"
    fi
}

# Short divider retained for compatibility with existing functions.
_terminal_line() {
    [[ "${KIMCTL_QUIET:-0}" == 1 ]] && return 0
    local type="${1:-normal}" width="${2:-32}" char='─' color='1;36' line
    case "$type" in
        success) color='1;32' ;;
        warning) color='1;33' ;;
        error) color='1;31' ;;
    esac
    (( width > 48 )) && width=48
    (( width < 8 )) && width=8
    printf -v line '%*s' "$width" ''
    line="${line// /$char}"
    if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
        printf '  \033[%sm%s\033[0m\n' "$color" "$line"
    else
        printf '  %s\n' "$line"
    fi
}

# Unified command loader.
# Use only for non-interactive commands. Do not wrap prompts, TTY applications,
# or functions whose changes must affect the current shell.
run_with_loader() {
    local label="${1:-Running}"
    shift
    local bar_width=15 progress=0 pid exit_code=0 had_monitor=0 cursor_hidden=0
    local i filled empty bar full_bar

    (( $# > 0 )) || {
        printf 'Usage: run_with_loader "label" command [arguments...]\n' >&2
        return 2
    }

    case "$-" in
        *m*) had_monitor=1; set +m ;;
    esac

    {
        KIMCTL_QUIET=1 "$@" </dev/null >/dev/null 2>&1 &
        pid=$!
    } 2>/dev/null

    if [[ -t 1 ]] && command -v tput >/dev/null 2>&1; then
        tput civis 2>/dev/null && cursor_hidden=1
    fi

    printf '%s\n' "$label"
    while kill -0 "$pid" 2>/dev/null; do
        if (( progress < 95 )); then
            progress=$((progress + (95 - progress) / 10 + 1))
        fi
        filled=$((progress * bar_width / 100))
        empty=$((bar_width - filled))
        bar=""
        for ((i=0; i<filled; i++)); do bar+="🟩"; done
        for ((i=0; i<empty; i++)); do bar+="⬜"; done
        printf '\r[ %s %3d%% progress ]' "$bar" "$progress"
        sleep 0.2
    done

    wait "$pid" || exit_code=$?
    (( cursor_hidden )) && tput cnorm 2>/dev/null || :
    (( had_monitor )) && set -m

    if (( exit_code == 0 )); then
        full_bar=""
        for ((i=0; i<bar_width; i++)); do full_bar+="🟩"; done
        printf '\r[ %s 100%% progress ]\n' "$full_bar"
    else
        printf '\nFailed (exit code: %d)\n' "$exit_code"
    fi
    return "$exit_code"
}

# Double echo oreoreore
givemespace(){
  echo
  echo
}

# END OF GLOBAL FUNCTIONS ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

# Display the customization notice once per interactive shell session.
if [[ $- == *i* && -z "${BASHRC_CUSTOM_NOTICE_SHOWN:-}" ]]; then
    _terminal_msg warning "Important: This shell configuration has been customized."
    _terminal_line warning
    BASHRC_CUSTOM_NOTICE_SHOWN=1
fi

#  DECLARATIVE CONFIG      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

# disable .swp or .swo
grep -qxF 'set noswapfile' ~/.vimrc 2>/dev/null || \
printf '\n" Disable swap files\nset noswapfile\n' >> ~/.vimrc

# Default visual and editor
# Ensure newly created files/folders are completely private to the owner
umask 077 2>/dev/null

# PATH hardening
# Keep only absolute PATH entries. This removes:
# - Empty entries (which can mean the current working directory)
# - "." and other relative directory entries
# Explicit execution using ./program remains possible.
PATH="$(printf '%s' "$PATH" | awk -v RS=: '
    /^\// {
        if (n++) printf ":"
        printf "%s", $0
    }
')"

# Prevents the shell and its children from creating memory core dumps on crash
ulimit -c 0

# ignorespace: Hidden from history if command starts with a space
# ignoredups: Do not record sequential duplicate commands

# Erase specific high-risk command names entirely from being recorded

# Force immediate history append instead of overwriting on shell exit
shopt -s histappend 2>/dev/null

# Automatically log out of the shell session after 10 minutes of inactivity (600 seconds)
# ALIAS     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
# Protect custom privileged-command wrappers against runtime redefinition.
for fn in run0 sudo; do
    if declare -F "$fn" >/dev/null 2>&1; then
        readonly -f "$fn"
    fi
done

# FUNCTIONS ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

getbash() {
    if [[ -f "$HOME/.bashrc" ]]; then
        _terminal_msg normal ".bashrc configuration"
        if bash -n "$HOME/.bashrc"; then
            _terminal_msg success "Syntax OK! Configuration valid! ♻️"
        else
            _terminal_msg error "Syntax error found in ~/.bashrc"
            return 1
        fi
    else
        _terminal_msg error "~/.bashrc does not exist"
        return 1
    fi
    echo ""
}

getpath() {
    _terminal_msg normal "PATH configuration"
    if printf '%s' "$PATH" | awk -v RS=: '
        length($0) == 0 || $0 !~ /^\// { bad = 1 }
        END { exit (bad || NR == 0) }
    '; then
        _terminal_msg success "Syntax OK! PATH looks good. 👌"
    else
        _terminal_msg error "FAIL❌: PATH has some issues. Please check. 🙇"
        return 1
    fi
}

# Get all virtual instances
getvirtall() {
    virsh -c qemu:///system list --all
}

# download nvm node and npm
getnvm(){
givemespace
_terminal_msg normal '🚀 Downloading latest NVM.'
run_with_loader "Running" bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash' || return $?
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
run_with_loader "Running" nvm install --lts || return $?
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
givemespace
_terminal_msg success '🚀 Finished downloading'
givemespace
_terminal_msg normal '📦 Rebuilding workspace.'
run_with_loader "Running" npm rebuild || return $?
_terminal_msg success '🚀 Finished rebuilding'
givemespace
_terminal_msg normal  '⚙️  Fetching versions...'
givemespace
_terminal_msg normal 🟢'nvm:'$(nvm -v)
_terminal_msg normal 🟢'node:'$(node -v)
_terminal_msg normal 🟢'npm:'$(npm -v)
givemespace
}

# empowered
whoseyourdaddy() {
    run0 --empower && _terminal_msg warning "With great power comes with great responsibility"
}

workspaceconfigcheck() {
    _terminal_line normal
    _terminal_msg normal "Checklist initialize 📋"
    givemespace
    getpath
    givemespace
    getbash
    givemespace
    _terminal_line success
    _terminal_msg normal "Done with all checks..."
    _terminal_msg success "Enjoy 🎉"
    givemespace
}

# Source .bashrc
bashconfigsource(){
_terminal_msg normal "Loading bash configuration"
source /var/home/kim/.bashrc
_terminal_msg success "Done"
exec bash
}

# Workspace navigator
workspace() {
    local target_dir="/var/home/kim/workspace"
    local item choice keyword selected_folder choice_num i
    local -a folders=() matches=()

    # Validate workspace directory.
    if [[ ! -d "$target_dir" ]]; then
        printf 'Error: Directory %s does not exist.\n' "$target_dir" >&2
        return 1
    fi

    # Discover workspace directories.
    for item in "$target_dir"/*/; do
        [[ -d "$item" ]] || continue
        folders+=("${item%/}")
    done

    if (( ${#folders[@]} == 0 )); then
        printf 'No subfolders found in %s.\n' "$target_dir"
        return 0
    fi

    # Display initial workspace list.
    while true; do
        printf '\n'
        _terminal_msg normal ' Which folder do you want to enter? 📂 '
        _terminal_line normal

        printf '\nAvailable workspaces:\n'

        for i in "${!folders[@]}"; do
            printf '%2d. %s\n' "$((i + 1))" "${folders[$i]##*/}"
        done

        # Accept number or keyword.
        read -r -p $'\nEnter number or keyword (q to quit): ' choice || return 1

        case "${choice,,}" in
            q|quit|exit)
                printf 'Cancelled.\n'
                return 0
                ;;
            "")
                printf 'Error: Input cannot be empty.\n' >&2
                continue
                ;;
        esac

        selected_folder=""

        # Direct numeric selection.
        if [[ "$choice" =~ ^[0-9]+$ ]]; then
            choice_num=$((10#$choice))

            if (( choice_num < 1 || choice_num > ${#folders[@]} )); then
                printf 'Error: Selection out of range.\n' >&2
                continue
            fi

            selected_folder="${folders[$((choice_num - 1))]}"

        else
            # Case-insensitive partial keyword search.
            keyword="${choice,,}"
            matches=()

            for item in "${folders[@]}"; do
                if [[ "${item##*/}" == *"$keyword"* ]]; then
                    matches+=("$item")
                fi
            done

            if (( ${#matches[@]} == 0 )); then
                printf 'No folders match keyword: %s\n' "$choice" >&2
                continue
            fi

            # Display matching results.
            printf '\nMatching workspaces:\n'

            for i in "${!matches[@]}"; do
                printf '%2d. %s\n' "$((i + 1))" "${matches[$i]##*/}"
            done

            # Automatically identify a single match.
            if (( ${#matches[@]} == 1 )); then
                selected_folder="${matches[0]}"

                while true; do
                    read -r -p "Enter '${selected_folder##*/}'? [y/N]: " choice || return 1

                    case "${choice,,}" in
                        y|yes)
                            break
                            ;;
                        n|no|"")
                            printf 'Returning to workspace list.\n'
                            selected_folder=""
                            break
                            ;;
                        *)
                            printf 'Please enter y or n.\n'
                            ;;
                    esac
                done

                [[ -n "$selected_folder" ]] || continue

            else
                # Select from multiple matches.
                read -r -p 'Select matching folder number (0 to go back): ' choice || return 1

                if [[ ! "$choice" =~ ^[0-9]+$ ]]; then
                    printf 'Error: Enter a valid number.\n' >&2
                    continue
                fi

                choice_num=$((10#$choice))

                if (( choice_num == 0 )); then
                    printf 'Returning to workspace list.\n'
                    continue
                fi

                if (( choice_num < 1 || choice_num > ${#matches[@]} )); then
                    printf 'Error: Selection out of range.\n' >&2
                    continue
                fi

                selected_folder="${matches[$((choice_num - 1))]}"
            fi
        fi

        # Enter selected workspace.
        if [[ -n "$selected_folder" ]]; then
            if ! cd -- "$selected_folder"; then
                printf 'Error: Could not enter directory.\n' >&2
                return 1
            fi

            printf 'Moved to: %s\n' "$PWD"
            return 0
        fi
    done
}


# Back up user dotfiles for Fedora Secureblue workspace recovery
workspacesync() {
    local SRC="$HOME" DEST="$HOME/workspace/dotfiles-backup"

    if [[ ! -d "$DEST" ]]; then
        _terminal_msg error "Destination path does not exist: $DEST"
        return 1
    fi

    _terminal_msg normal "Backing up workspace configuration and files..."
    run_with_loader "Running" bash -c '
        set -e
        src=$1 dest=$2
        for file in .gitconfig .bashrc .bash_profile; do
            [[ ! -f "$src/$file" ]] || cp -p -- "$src/$file" "$dest/"
        done
        [[ ! -d "$src/.cline" ]] || cp -a -- "$src/.cline" "$dest/"
        [[ ! -d "$src/.config/containers" ]] || {
            mkdir -p -- "$dest/.config"
            cp -a -- "$src/.config/containers" "$dest/.config/"
        }
        if [[ -d "$src/Documents/Cline" ]]; then
            mkdir -p -- "$dest/Documents"
            cp -a -- "$src/Documents/Cline" "$dest/Documents/"
        fi
        # The destination is inside ~/workspace; copying that tree into itself
        # would recurse. Back up workspace entries except the backup directory.
        if [[ -d "$src/workspace" ]]; then
            mkdir -p -- "$dest/workspace"
            for item in "$src/workspace"/* "$src/workspace"/.[!.]* "$src/workspace"/..?*; do
                [[ -e "$item" ]] || continue
                [[ "$item" == "$dest" ]] && continue
                cp -a -- "$item" "$dest/workspace/"
            done
        fi
        if command -v podman >/dev/null 2>&1 && command -v toolbox >/dev/null 2>&1; then
            mapfile -t ids < <(toolbox list --containers 2>/dev/null | awk "NR>1 {print \$1}")
            if ((${#ids[@]})); then
                mkdir -p -- "$dest/toolbox-backups"
                for id in "${ids[@]}"; do
                    safe_id=${id//[^a-zA-Z0-9_.-]/_}
                    podman export "$id" -o "$dest/toolbox-backups/${safe_id}.tar"
                done
            fi
        fi
    ' _ "$SRC" "$DEST" || {
        _terminal_msg error "Workspace backup failed."
        return 1
    }

    _terminal_msg success "Workspace backup completed."
}

# install AI assistants
getaitools(){
    export NVM_DIR="$HOME/.nvm"
    [[ ! -s "$NVM_DIR/nvm.sh" ]] || . "$NVM_DIR/nvm.sh"
    [[ ! -s "$NVM_DIR/bash_completion" ]] || . "$NVM_DIR/bash_completion"

    case ":$PATH:" in
        *":$HOME/.local/bin:"*) ;;
        *) export PATH="$HOME/.local/bin:$PATH" ;;
    esac

    if ! command -v nvm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        _terminal_msg normal "Installing nvm, Node.js, and npm..."
        run_with_loader "Running" workspacenode || return $?
        [[ ! -s "$NVM_DIR/nvm.sh" ]] || . "$NVM_DIR/nvm.sh"
        [[ ! -s "$NVM_DIR/bash_completion" ]] || . "$NVM_DIR/bash_completion"
    else
        _terminal_msg success " nvm, node, and npm are already installed."
    fi

    if ! command -v cline >/dev/null 2>&1; then
        _terminal_msg normal "Installing Cline CLI..."
        run_with_loader "Running" npm install -g cline --no-progress || return $?
    else
        _terminal_msg success " Cline CLI is already installed."
    fi

    if ! command -v devin >/dev/null 2>&1 && [[ ! -x "$HOME/.local/bin/devin" ]]; then
        _terminal_msg normal "Installing Devin CLI..."
        run_with_loader "Running" bash -c 'curl -fsSL https://devin.ai | bash' || return $?
    else
        _terminal_msg success " Devin CLI is already installed."
    fi

    if ! command -v mistral >/dev/null 2>&1 && [[ ! -x "$HOME/.local/bin/mistral" ]]; then
        _terminal_msg normal "Installing Mistral CLI..."
        run_with_loader "Running" bash -c 'curl -fsSL https://mistral.ai/vibe/install.sh | bash && uv tool install mistral-vibe' || return $?
    else
        _terminal_msg success " Mistral CLI is already installed."
    fi

    if ! command -v herdr-app >/dev/null 2>&1 && [[ ! -x "$HOME/.local/bin/herdr-app" ]]; then
        _terminal_msg normal "Installing Herdr CLI..."
        run_with_loader "Running" bash -c 'curl -fsSL https://releases.herdr.dev/app/install.sh | sh' || return $?
    else
        _terminal_msg success " Herdr app is already installed."
    fi



    _terminal_msg success " Workspace AI setup complete. 🧠"
}


# Configure GitHub, Cloudflare, and Firecrawl MCP servers for Cline CLI.
# CF_TOK, GH_PAT, and FIRECRAWL_TOKEN are exported to Cline; their values are
# never written to the MCP settings file. Cline resolves ${env:NAME} at
# connection time.
clinemcpsetup() {
    local settings_file settings_dir tmp backup

    if (( $# > 0 )); then
        printf 'Usage: clinemcpsetup\n' >&2
        return 2
    fi

    if [[ ! -v CF_TOK ]] || (( ${#CF_TOK} == 0 )); then
        printf 'Error: CF_TOK is not set or is empty.\n' >&2
        return 2
    fi
    if [[ ! -v GH_PAT ]] || (( ${#GH_PAT} == 0 )); then
        printf 'Error: GH_PAT is not set or is empty.\n' >&2
        return 2
    fi
    if [[ ! -v FIRECRAWL_TOKEN ]] || (( ${#FIRECRAWL_TOKEN} == 0 )); then
        printf 'Error: FIRECRAWL_TOKEN is not set or is empty.\n' >&2
        return 2
    fi

    command -v cline >/dev/null 2>&1 || {
        printf 'Error: Cline CLI is not installed or is not on PATH.\n' >&2
        return 127
    }
    command -v jq >/dev/null 2>&1 || {
        printf 'Error: jq is required to update the MCP settings safely.\n' >&2
        return 127
    }

    # Make the values available to the Cline process launched from this shell.
    export CF_TOK GH_PAT FIRECRAWL_TOKEN

    # CLINE_MCP_SETTINGS_PATH overrides the file path; CLINE_DATA_DIR overrides
    # the Cline data root. The default CLI settings file is under ~/.cline/data.
    if [[ -n "${CLINE_MCP_SETTINGS_PATH:-}" ]]; then
        settings_file="$CLINE_MCP_SETTINGS_PATH"
    else
        settings_file="${CLINE_DATA_DIR:-$HOME/.cline/data}/settings/cline_mcp_settings.json"
    fi
    settings_dir="$(dirname -- "$settings_file")"

    if [[ -L "$settings_file" ]]; then
        printf 'Error: Refusing to modify a symlinked MCP settings file: %s\n' "$settings_file" >&2
        return 1
    fi
    if [[ -e "$settings_file" && ! -f "$settings_file" ]]; then
        printf 'Error: MCP settings path is not a regular file: %s\n' "$settings_file" >&2
        return 1
    fi
    if ! mkdir -p -- "$settings_dir"; then
        printf 'Error: Cannot create MCP settings directory: %s\n' "$settings_dir" >&2
        return 1
    fi
    chmod 700 -- "$settings_dir" || return 1

    if [[ -f "$settings_file" ]]; then
        if ! jq -e 'type == "object" and ((.mcpServers // {}) | type == "object")' \
            "$settings_file" >/dev/null 2>&1; then
            printf 'Error: Existing MCP settings are invalid or mcpServers is not an object. No changes made.\n' >&2
            return 1
        fi

        backup="$(mktemp "${settings_file}.bak.XXXXXX")" || {
            printf 'Error: Could not create a backup of existing MCP settings.\n' >&2
            return 1
        }
        if ! cp -p -- "$settings_file" "$backup"; then
            rm -f -- "$backup"
            printf 'Error: Could not back up existing MCP settings. No changes made.\n' >&2
            return 1
        fi
        chmod 600 -- "$backup" || return 1
    fi

    tmp="$(mktemp "${settings_file}.tmp.XXXXXX")" || {
        printf 'Error: Could not create temporary MCP settings file.\n' >&2
        return 1
    }

    if [[ -f "$settings_file" ]]; then
        if ! jq '
            if type != "object" then
                error("top-level MCP settings must be an object")
            else
                .mcpServers = (
                    (.mcpServers // {}) as $servers
                    | if ($servers | type) != "object" then
                        error("mcpServers must be an object")
                      else
                        $servers + {
                            "github": {
                                "type": "streamableHttp",
                                "url": "https://api.githubcopilot.com/mcp/readonly",
                                "headers": {
                                    "Authorization": "Bearer ${env:GH_PAT}"
                                },
                                "disabled": false,
                                "autoApprove": []
                            },
                            "cloudflare": {
                                "type": "streamableHttp",
                                "url": "https://mcp.cloudflare.com/mcp",
                                "headers": {
                                    "Authorization": "Bearer ${env:CF_TOK}"
                                },
                                "disabled": false,
                                "autoApprove": []
                            },
                            "firecrawl": {
                                "type": "streamableHttp",
                                "url": "https://mcp.firecrawl.dev/v2/mcp",
                                "headers": {
                                    "Authorization": "Bearer ${env:FIRECRAWL_TOKEN}"
                                },
                                "disabled": false,
                                "autoApprove": []
                            }
                        }
                      end
                )
            end
        ' "$settings_file" > "$tmp"; then
            rm -f -- "$tmp"
            printf 'Error: Failed to update MCP JSON. Existing settings were not replaced.\n' >&2
            return 1
        fi
    else
        if ! jq -n '
            {
                "mcpServers": {
                    "github": {
                        "type": "streamableHttp",
                        "url": "https://api.githubcopilot.com/mcp/readonly",
                        "headers": {
                            "Authorization": "Bearer ${env:GH_PAT}"
                        },
                        "disabled": false,
                        "autoApprove": []
                    },
                    "cloudflare": {
                        "type": "streamableHttp",
                        "url": "https://mcp.cloudflare.com/mcp",
                        "headers": {
                            "Authorization": "Bearer ${env:CF_TOK}"
                        },
                        "disabled": false,
                        "autoApprove": []
                    },
                    "firecrawl": {
                        "type": "streamableHttp",
                        "url": "https://mcp.firecrawl.dev/v2/mcp",
                        "headers": {
                            "Authorization": "Bearer ${env:FIRECRAWL_TOKEN}"
                        },
                        "disabled": false,
                        "autoApprove": []
                    }
                }
            }
        ' > "$tmp"; then
            rm -f -- "$tmp"
            printf 'Error: Failed to create MCP JSON.\n' >&2
            return 1
        fi
    fi

    # Ensure the file keeps variable references, not resolved token values.
    if ! jq -e '
        .mcpServers.github.headers.Authorization == "Bearer ${env:GH_PAT}" and
        .mcpServers.cloudflare.headers.Authorization == "Bearer ${env:CF_TOK}" and
        .mcpServers.firecrawl.headers.Authorization == "Bearer ${env:FIRECRAWL_TOKEN}" and
        .mcpServers.github.url == "https://api.githubcopilot.com/mcp/readonly" and
        .mcpServers.cloudflare.url == "https://mcp.cloudflare.com/mcp" and
        .mcpServers.firecrawl.url == "https://mcp.firecrawl.dev/v2/mcp"
    ' "$tmp" >/dev/null; then
        rm -f -- "$tmp"
        printf 'Error: Generated MCP settings did not pass validation.\n' >&2
        return 1
    fi

    chmod 600 -- "$tmp" || {
        rm -f -- "$tmp"
        return 1
    }
    if ! mv -f -- "$tmp" "$settings_file"; then
        rm -f -- "$tmp"
        printf 'Error: Could not install MCP settings file.\n' >&2
        return 1
    fi

    printf 'Cline MCP settings updated: %s\n' "$settings_file"
    printf '  GitHub:     https://api.githubcopilot.com/mcp/readonly\n'
    printf '  Cloudflare: https://mcp.cloudflare.com/mcp\n'
    printf '  Firecrawl:  https://mcp.firecrawl.dev/v2/mcp\n'
    printf 'Credentials are referenced from CF_TOK, GH_PAT, and FIRECRAWL_TOKEN; token values were not written to the file.\n'
    printf 'Start Cline from this shell so it inherits the exported variables.\n'
}


mistralfix() {
    local rc

    if ! command -v pip >/dev/null 2>&1; then
        _terminal_msg error "pip is not installed."
        return 127
    fi

    _terminal_msg normal "Repairing Mistral Vibe installation..."

    if run_with_loader "Reinstalling Mistral Vibe" pip install --user --force-reinstall mistral-vibe; then
        _terminal_msg success "Mistral Vibe installation repaired."
        return 0
    else
        rc=$?
        _terminal_msg error "Mistral Vibe repair failed (exit code $rc)."
        _terminal_msg warning "For externally-managed-environment errors, use: pipx install mistral-vibe or uv tool install mistral-vibe."
        return "$rc"
    fi
}

# List usable SSH private keys in ~/.ssh (skips public keys, known_hosts, dotfiles).
_workspace_ssh_key_list() {
    local f first
    for f in "$HOME/.ssh"/*; do
        [[ -f "$f" ]] || continue
        first=$(head -n 1 "$f" 2>/dev/null) || continue
        case "$first" in
            "-----BEGIN OPENSSH PRIVATE KEY-----"|\
            "-----BEGIN RSA PRIVATE KEY-----"|\
            "-----BEGIN DSA PRIVATE KEY-----"|\
            "-----BEGIN EC PRIVATE KEY-----"|\
            "-----BEGIN ENCRYPTED PRIVATE KEY-----") printf '%s\n' "$f" ;;
        esac
    done
}

# Prompt the user to choose an SSH private key; stores it in WORKSPACE_SSH_KEY.
# $1 optionally preselects a previously chosen key.
_workspace_select_ssh_key() {
    local -a keys=()
    local key i choice default="" prompt
    while IFS= read -r key; do
        keys+=("$key")
    done < <(_workspace_ssh_key_list)

    if ((${#keys[@]} == 0)); then
        _terminal_msg error "No SSH private keys found in $HOME/.ssh."
        return 1
    fi

    _terminal_msg normal "Available SSH private keys:"
    for ((i = 0; i < ${#keys[@]}; i++)); do
        printf '    %d) %s\n' "$((i + 1))" "${keys[$i]#"$HOME"/}"
        [[ "${keys[$i]}" == "${1:-}" ]] && default=$((i + 1))
    done

    while :; do
        prompt="Select key"
        [[ -n "$default" ]] && prompt+=" [$default]"
        read -rp "$prompt: " choice || return 1
        [[ -z "$choice" && -n "$default" ]] && choice="$default"
        if [[ "$choice" =~ ^[0-9]+$ ]] &&
           ((choice >= 1 && choice <= ${#keys[@]})); then
            WORKSPACE_SSH_KEY="${keys[$((choice - 1))]}"
            return 0
        fi
        _terminal_msg warning "Invalid selection."
    done
}

# Dedicated SSH agent for a selected workspace key.
# Usage: workspaceconnect [path/to/private_key]
workspaceconnect() {
    _terminal_msg normal "Creating temporary workspace access."
    local key agent_output

    if ! declare -F tcat >/dev/null ||
       ! command -v ssh-agent >/dev/null 2>&1 ||
       ! command -v ssh-add >/dev/null 2>&1; then
        return 1
    fi

    if [[ -n "${1:-}" ]]; then
        key="${1/#\~/$HOME}"
    else
        if ! _workspace_select_ssh_key "${HOME_SECURITY_SSH_KEY:-}"; then
            return 1
        fi
        key="$WORKSPACE_SSH_KEY"
        HOME_SECURITY_SSH_KEY="$key"
    fi

    if [[ ! -f "$key" || ! -r "$key" ]]; then
        _terminal_msg error "SSH key is missing or unreadable: $key"
        return 1
    fi

    # Reuse existing dedicated agent if still alive and socket exists
    if [[ -n "${HOME_SECURITY_SSH_AGENT_PID:-}" ]] &&
       kill -0 "$HOME_SECURITY_SSH_AGENT_PID" 2>/dev/null &&
       [[ -S "${HOME_SECURITY_SSH_AUTH_SOCK:-}" ]]; then
        export SSH_AGENT_PID="$HOME_SECURITY_SSH_AGENT_PID"
        export SSH_AUTH_SOCK="$HOME_SECURITY_SSH_AUTH_SOCK"
        # Refresh the 5-minute key timer if needed
        ssh-add -t 300 "$key" >/dev/null 2>&1
        _terminal_msg success "Temporary workspace access is already active (timer refreshed to 5m)."
        return 0
    fi

    # Clean up any stale PID/socket before starting fresh
    if declare -F workspacekill >/dev/null 2>&1; then
        run0 workspacekill >/dev/null 2>&1 || true
    fi

    # Preserve the current SSH agent environment.
    HOME_SECURITY_PREV_SOCK="${SSH_AUTH_SOCK-}"
    HOME_SECURITY_PREV_PID="${SSH_AGENT_PID-}"
    HOME_SECURITY_PREV_SOCK_SET=${SSH_AUTH_SOCK+x}
    HOME_SECURITY_PREV_PID_SET=${SSH_AGENT_PID+x}

    # Start a dedicated agent without printing its environment.
    if ! agent_output=$(umask 077; ssh-agent -s 2>/dev/null); then
        _terminal_msg error "Could not start the dedicated SSH agent."
        return 1
    fi

    eval "$agent_output" >/dev/null

    HOME_SECURITY_SSH_AGENT_PID="$SSH_AGENT_PID"
    HOME_SECURITY_SSH_AUTH_SOCK="$SSH_AUTH_SOCK"

    # Load the key for 5 minutes; suppress routine ssh-add confirmation output.
    if ! ssh-add -t 300 "$key" >/dev/null; then
        run0 workspacekill
        _terminal_msg error "Could not load the SSH key."
        return 1
    fi

    # Clean up on normal exit OR terminal window close (HUP)
    trap 'workspacekill' EXIT HUP
    _terminal_msg success "Workspace access initialized (PID $HOME_SECURITY_SSH_AGENT_PID; key lifetime 5 minutes)."
    _terminal_msg warning "Access is terminated when this terminal exits."
}


# Kill all ssh-agent processes owned by all users.

workspacekill() {
    local agent_pid agent_sock agent_dir
    local remaining=0
    local attempts=0
    local initial_count=0

    _terminal_msg normal "Terminating all SSH agent sessions."

    # 1. Terminate the dedicated workspace SSH agent
    agent_pid="${HOME_SECURITY_SSH_AGENT_PID:-}"
    agent_sock="${HOME_SECURITY_SSH_AUTH_SOCK:-}"

    if [[ "$agent_pid" =~ ^[0-9]+$ ]] && kill -0 "$agent_pid" 2>/dev/null; then
        _terminal_msg normal "Terminating dedicated workspace SSH agent (PID: $agent_pid)."

        kill -TERM "$agent_pid" 2>/dev/null || true
        wait "$agent_pid" 2>/dev/null || true
    fi

    # 2. Discover all running SSH agent processes
    initial_count=$(pgrep -x ssh-agent 2>/dev/null | wc -l)
    initial_count=${initial_count//[[:space:]]/}

    if (( initial_count > 0 )); then
        _terminal_msg warning "Found $initial_count SSH agent process(es). Terminating system-wide."
    else
        _terminal_msg normal "No running SSH agent processes detected."
    fi

    # 3. Terminate all SSH agents, including root-owned processes
    if (( initial_count > 0 )); then
        if [[ "$EUID" -eq 0 ]]; then
            pkill -TERM -x ssh-agent 2>/dev/null || true

        elif command -v run0 >/dev/null 2>&1; then
            run0 pkill -TERM -x ssh-agent 2>/dev/null || true

        else
            _terminal_msg error "Cannot terminate system-wide SSH agents: run0 is unavailable."
            return 1
        fi

        # 4. Allow agents time to terminate gracefully (2 seconds)
        while (( attempts < 10 )); do
            if ! pgrep -x ssh-agent >/dev/null 2>&1; then
                break
            fi

            sleep 0.2
            ((attempts++))
        done

        # 5. Force termination of remaining SSH agents
        if pgrep -x ssh-agent >/dev/null 2>&1; then
            _terminal_msg warning "Some SSH agents remain. Escalating to SIGKILL."

            if [[ "$EUID" -eq 0 ]]; then
                pkill -KILL -x ssh-agent 2>/dev/null || true
            else
                run0 pkill -KILL -x ssh-agent 2>/dev/null || true
            fi
        fi
    fi

    # 6. Verify termination
    if pgrep -x ssh-agent >/dev/null 2>&1; then
        remaining=$(pgrep -x ssh-agent | wc -l)
        _terminal_msg error "Failed to terminate all SSH agents. Remaining: $remaining"
    fi

    # 7. Clean up dedicated workspace socket
    if [[ -n "$agent_sock" ]]; then
        agent_dir="$(dirname -- "$agent_sock")"

        if [[ -S "$agent_sock" ]]; then
            rm -f -- "$agent_sock" 2>/dev/null || true
        fi

        # Remove only if the directory is empty
        if [[ -d "$agent_dir" ]]; then
            rmdir -- "$agent_dir" 2>/dev/null || true
        fi
    fi

    # 8. Restore previous SSH agent environment
    unset HOME_SECURITY_SSH_AGENT_PID
    unset HOME_SECURITY_SSH_AUTH_SOCK

    if [[ "${HOME_SECURITY_PREV_SOCK_SET:-}" == "1" ]]; then
        export SSH_AUTH_SOCK="$HOME_SECURITY_PREV_SOCK"
    else
        unset SSH_AUTH_SOCK
    fi

    if [[ "${HOME_SECURITY_PREV_PID_SET:-}" == "1" ]]; then
        export SSH_AGENT_PID="$HOME_SECURITY_PREV_PID"
    else
        unset SSH_AGENT_PID
    fi

    unset HOME_SECURITY_PREV_SOCK
    unset HOME_SECURITY_PREV_PID
    unset HOME_SECURITY_PREV_SOCK_SET
    unset HOME_SECURITY_PREV_PID_SET

    # 9. Final status
    if pgrep -x ssh-agent >/dev/null 2>&1; then
        _terminal_msg error "SSH agent cleanup incomplete."
        return 1
    fi

    _terminal_msg success "All SSH agent processes terminated. Previous agent environment restored."

    return 0
}


# restart agent
workspacerestart() {
    _terminal_msg normal "Restarting workspace access."
    run0 workspacekill || return $?
    workspaceconnect
}


# Generate SSH and GPG keys for Github
workspacegenkeys(){
local git_name git_email key_passphrase ssh_key_name ssh_key_path gpg_key_id gpg_batch gpg_rc
# --- 1. Gather User Details ---
read -rp "Enter your GitHub Name: " git_name
read -rp "Enter your GitHub Email: " git_email
read -rsp "Enter a passphrase for your keys (Do not leave blank): ⚠️" key_passphrase
echo ""

ssh_key_name=$(hostname)
ssh_key_path="$HOME/.ssh/$ssh_key_name"

# --- 2. Generate SSH Key (Ed25519) ---
_terminal_msg normal "[*] Generating Ed25519 SSH key...🚀"
mkdir -p -m 700 "$HOME/.ssh"

if [[ -f "$ssh_key_path" ]]; then
    _terminal_msg warning "[!] $ssh_key_path already exists ⚠️. Skipping SSH key generation."
else
    run_with_loader "Running" ssh-keygen -t ed25519 -C "$git_email" -f "$ssh_key_path" -N "$key_passphrase" || return $?
    chmod 600 "$ssh_key_path" || return $?
    chmod 644 "${ssh_key_path}.pub" || return $?
fi

# --- 3. Generate GPG Key (RSA 4096) ---
echo "[*] Generating 4096-bit RSA GPG key...🚀"
gpg_batch=$(mktemp "${TMPDIR:-/tmp}/gpg-batch.XXXXXX") || return 1
cat >"$gpg_batch" <<EOF
%echo Generating GitHub GPG key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $git_name
Name-Email: $git_email
Expire-Date: 0
Passphrase: $key_passphrase
%commit
%echo Done
EOF
chmod 600 "$gpg_batch" || {
    rm -f -- "$gpg_batch"
    return 1
}
run_with_loader "Running" gpg --batch --generate-key "$gpg_batch"
gpg_rc=$?
rm -f -- "$gpg_batch"
(( gpg_rc == 0 )) || return "$gpg_rc"


# Extract the newly created GPG Key ID (Long format)
gpg_key_id=$(gpg --list-secret-keys --keyid-format=long "$git_email" | awk '/sec/{print $2}' | cut -d'/' -f2 | tail -n 1)

# --- 4. Configure Global Git Settings ---
_terminal_msg normal "[*] Configuring Git...🚀"
run_with_loader "Running" git config --global user.name "$git_name" || return $?
run_with_loader "Running" git config --global user.email "$git_email" || return $?
run_with_loader "Running" git config --global user.signingkey "$gpg_key_id" || return $?
run_with_loader "Running" git config --global commit.gpgsign true || return $?
run_with_loader "Running" git config --global gpg.program "$(command -v gpg)" || return $?

# --- 5. Output Public Keys for GitHub ---
_terminal_msg success "Done generating SSH and GPG keys!🔑🚀"
sleep 2

_terminal_msg warning "  🔑 SSH public key : (Proceed to add in GH)"
cat "${ssh_key_path}.pub"
sleep 2

_terminal_line normal

_terminal_msg warning "  🔑 GPG public key: (Proceed to add in GH)"
gpg --armor --export "$gpg_key_id"
sleep 2

_terminal_msg normal "Testing your keys against GH"
_terminal_msg normal "ssh -T git@github.com"
}


# Convert a Bash string into a valid GVariant string.
_gvariant_quote() {
    local value=${1//\\/\\\\}
    value=${value//\"/\\\"}
    printf '"%s"' "$value"
}

# Interactive GNOME Custom Keyboard Shortcuts Manager. Simply add keyboard shortcuts.
workspaceshortcuts() {
    if ! command -v gsettings >/dev/null 2>&1; then
        _terminal_msg error "gsettings not found. A compatible GNOME settings schema is required."
        return 1
    fi

    local SCHEMA="org.gnome.settings-daemon.plugins.media-keys"
    local BASE_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"

    # List registered shortcuts.
    _list_shortcuts() {
        local current_bindings paths path schema_path name cmd binding

        if ! current_bindings=$(gsettings get "$SCHEMA" custom-keybindings 2>/dev/null); then
            _terminal_msg error "Could not read custom-keybindings. Check that the desktop schema is available."
            return 1
        fi

        if [[ "$current_bindings" == "@as []" || "$current_bindings" == "[]" ]]; then
            _terminal_msg warning "No custom shortcuts are currently loaded."
            return 0
        fi

        _terminal_msg normal "Loaded Custom Shortcuts:"

        paths=$(printf '%s\n' "$current_bindings" |
            tr -d "[]'" |
            tr ',' '\n' |
            sed 's/^[[:space:]]*//')

        while IFS= read -r path; do
            [[ -z "$path" ]] && continue

            schema_path="${SCHEMA}.custom-keybinding:${path}"

            name=$(gsettings get "$schema_path" name 2>/dev/null) || name="<unavailable>"
            cmd=$(gsettings get "$schema_path" command 2>/dev/null) || cmd="<unavailable>"
            binding=$(gsettings get "$schema_path" binding 2>/dev/null) || binding="<unavailable>"

            printf '  • %-22s | Hotkey: %-18s | Cmd: %s\n' \
                "$name" "$binding" "$cmd"
        done <<< "$paths"
    }

    # Add or update a shortcut.
    _add_shortcut() {
        local name cmd binding slug new_path current_bindings updated_bindings
        local quoted_name quoted_cmd quoted_binding quoted_path schema_path

        read -r -p "Shortcut Name (e.g., Ptyxis New Window): " name || return 1
        read -r -p "Command to run (e.g., ptyxis --new-window): " cmd || return 1
        read -r -p "Hotkey (e.g., <Control>1, <Super>t): " binding || return 1

        if [[ -z "$name" || -z "$cmd" || -z "$binding" ]]; then
            _terminal_msg error "All fields (Name, Command, Hotkey) are required."
            return 1
        fi

        slug=$(printf '%s' "$name" |
            tr '[:upper:]' '[:lower:]' |
            tr -cs 'a-z0-9' '-' |
            sed 's/^-//; s/-$//')

        if [[ -z "$slug" ]]; then
            _terminal_msg error "Shortcut name must contain at least one letter or number."
            return 1
        fi

        new_path="${BASE_PATH}/${slug}/"
        schema_path="${SCHEMA}.custom-keybinding:${new_path}"

        if ! current_bindings=$(gsettings get "$SCHEMA" custom-keybindings 2>/dev/null); then
            _terminal_msg error "Could not read custom-keybindings."
            return 1
        fi

        quoted_name=$(_gvariant_quote "$name")
        quoted_cmd=$(_gvariant_quote "$cmd")
        quoted_binding=$(_gvariant_quote "$binding")
        quoted_path=$(_gvariant_quote "$new_path")

        # Prompts above remain interactive; animate only the non-interactive writes.
        run_with_loader "Running" gsettings set "$schema_path" name "$quoted_name" || return 1
        run_with_loader "Running" gsettings set "$schema_path" command "$quoted_cmd" || return 1
        run_with_loader "Running" gsettings set "$schema_path" binding "$quoted_binding" || return 1

        # Register the path only if it does not already exist.
        if [[ "$current_bindings" != *"$new_path"* ]]; then
            if [[ "$current_bindings" == "@as []" || "$current_bindings" == "[]" ]]; then
                updated_bindings="[$quoted_path]"
            else
                updated_bindings="${current_bindings%]}, $quoted_path]"
            fi

            run_with_loader "Running" gsettings set "$SCHEMA" custom-keybindings "$updated_bindings" || return 1
        fi

        _terminal_msg success "Configured shortcut '$name' ($binding) -> '$cmd'"
    }

    # Interactive menu.
    while true; do
        printf '\n'
        _terminal_msg normal "Custom Keyboard Shortcuts Manager"

        printf '  1) List all loaded shortcuts\n'
        printf '  2) Add or update a shortcut\n'
        printf '  3) Exit\n'

        local choice
        read -r -p "Select an option [1-3]: " choice || break

        case "$choice" in
            1)
                _list_shortcuts
                ;;
            2)
                _add_shortcut
                ;;
            3)
                _terminal_msg normal "Exiting shortcut manager."
                break
                ;;
            *)
                _terminal_msg warning "Invalid selection. Choose 1, 2, or 3."
                ;;
        esac
    done
}

# Optional one-time Ptyxis shortcut provisioning.
# Manually execute: setup_ptyxis_shortcut
workspaceterminalshortcut() {
    if ! command -v gsettings >/dev/null 2>&1; then
        _terminal_msg error "gsettings not found."
        return 1
    fi

    local SCHEMA="org.gnome.settings-daemon.plugins.media-keys"
    local BASE_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"
    local KEY_NAME="ptyxis-new-window"
    local NEW_PATH="${BASE_PATH}/${KEY_NAME}/"
    local schema_path="${SCHEMA}.custom-keybinding:${NEW_PATH}"
    local current_bindings updated_bindings quoted_path

    if ! current_bindings=$(gsettings get "$SCHEMA" custom-keybindings 2>/dev/null); then
        _terminal_msg error "Could not read custom-keybindings."
        return 1
    fi

    # Configure the shortcut; there are no prompts or live output in this phase.
    run_with_loader "Running" gsettings set "$schema_path" name "$(_gvariant_quote "Ptyxis New Window")" || return 1
    run_with_loader "Running" gsettings set "$schema_path" command "$(_gvariant_quote "ptyxis --new-window")" || return 1
    run_with_loader "Running" gsettings set "$schema_path" binding "$(_gvariant_quote "<Control>1")" || return 1

    # Register only if not already present.
    if [[ "$current_bindings" != *"$NEW_PATH"* ]]; then
        quoted_path=$(_gvariant_quote "$NEW_PATH")

        if [[ "$current_bindings" == "@as []" || "$current_bindings" == "[]" ]]; then
            updated_bindings="[$quoted_path]"
        else
            updated_bindings="${current_bindings%]}, $quoted_path]"
        fi

        run_with_loader "Running" gsettings set "$SCHEMA" custom-keybindings "$updated_bindings" || return $?
    fi

    _terminal_msg success "Ptyxis shortcut configured: Ctrl+1"
}

# Whitelist podman image
podimage() {
    local input_path repo_scope answer
    local toolbox_name

    read -rp "Enter container image path (e.g., quay.io/fedora/fedora-toolbox:latest): " input_path

    if [[ -z "$input_path" ]]; then
        echo "Error: Image path cannot be empty." >&2
        return 1
    fi

    # Strip digest or tag so trust applies to repository scope
    repo_scope="${input_path%%@*}"

    if [[ "${repo_scope##*/}" == *:* ]]; then
        repo_scope="${repo_scope%:*}"
    fi

    # Update the active Podman signature policy for this repository scope.
    # image trust set does not accept a --signature-policy option.
    if ! podman image trust set --type accept "$repo_scope"; then
        echo "Error: Failed to whitelist image repository: $repo_scope" >&2
        return 1
    fi

    echo "Successfully whitelisted: $repo_scope"

    # Check whether image is already downloaded
    if podman image exists "$input_path"; then
        echo "Image already exists locally. Skipping pull."
    else
        read -rp "Image is not downloaded. Pull '$input_path' now? [y/N]: " answer

        case "$answer" in
            [yY]|[yY][eE][sS])
                echo "Pulling image: $input_path"

                if ! run_with_loader "Running" podman pull "$input_path"; then
                    echo "Error: Failed to pull image." >&2
                    return 1
                fi

                echo "Successfully pulled: $input_path"
                ;;
            *)
                echo "Image pull skipped."

                # Cannot create Toolbox without a local image
                read -rp "Continue to Toolbox creation using an existing local image? [y/N]: " answer

                case "$answer" in
                    [yY]|[yY][eE][sS])
                        if ! podman image exists "$input_path"; then
                            echo "Error: Image is not available locally." >&2
                            return 1
                        fi
                        ;;
                    *)
                        echo "Operation cancelled."
                        return 0
                        ;;
                esac
                ;;
        esac
    fi

    # Optional Toolbox creation and entry
    read -rp "Do you want to create and enter a Toolbox using this image? [y/N]: " answer

    case "$answer" in
        [yY]|[yY][eE][sS])
            if ! command -v toolbox >/dev/null 2>&1; then
                echo "Error: Toolbox command is not installed." >&2
                return 1
            fi

            read -rp "Enter Toolbox container name [custom-toolbox]: " toolbox_name
            toolbox_name="${toolbox_name:-custom-toolbox}"
            # Check if Toolbox container already exists and is running
            if toolbox list --containers | grep -Fq "$toolbox_name"; then
                if podman container exists "$toolbox_name"; then
                    if [[ "$(podman inspect --format '{{.State.Running}}' "$toolbox_name" 2>/dev/null)" == "true" ]]; then
                        echo "Toolbox '$toolbox_name' is already running. Skipping creation."
                        toolbox enter "$toolbox_name"
                        return $?
                    fi
                fi

                echo "Toolbox '$toolbox_name' already exists but is not running."
                read -rp "Do you want to start and enter it? [y/N]: " answer

                case "$answer" in
                    [yY]|[yY][eE][sS])
                        toolbox enter "$toolbox_name"
                        return $?
                        ;;
                    *)
                        echo "Toolbox entry skipped."
                        return 0
                        ;;
                esac
            fi

            echo "Creating Toolbox container: $toolbox_name"

            if ! run_with_loader "Running" toolbox create \
                --container "$toolbox_name" \
                --image "$input_path"; then
                _terminal_msg error "Error: Failed to create Toolbox container."
                return 1
            fi

            _terminal_msg normal "Entering Toolbox container: $toolbox_name"
            toolbox enter "$toolbox_name"
            ;;
        *)
            echo "Toolbox creation skipped."
            ;;
    esac
}

# Setup rootless podman
# This is the rootless setup
# Setup rootless podman
podrootless() {
    local sock_path="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock"
    local host_uri="unix://${sock_path}"

    # Remote-only podman client (Secureblue): local socket impossible.
    if ! podman system service --help >/dev/null 2>&1; then
        [[ -S "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman-machine-default-api.sock" ]] \
            || run_with_loader "Running" podman machine start || true
        export CONTAINER_HOST="unix:///run/user/1000/podman/podman-machine-default-api.sock"
        export DOCKER_HOST="$CONTAINER_HOST"
        grep -qxF "export CONTAINER_HOST=\"$CONTAINER_HOST\"" "$HOME/.bashrc" \
            || printf 'export CONTAINER_HOST="%s"\n' "$CONTAINER_HOST" >> "$HOME/.bashrc"
        grep -qxF "export DOCKER_HOST=\"$DOCKER_HOST\"" "$HOME/.bashrc" \
            || printf 'export DOCKER_HOST="%s"\n' "$DOCKER_HOST" >> "$HOME/.bashrc"
        _terminal_msg normal "Rootless Podman via podman machine: $CONTAINER_HOST"
        return 0
    fi

    # 1. Restart only podman.socket on the host (let systemd socket activation start podman.service on demand)
    if [ -f /run/.containerenv ]; then
        echo "Detected Toolbox environment. Restarting host rootless Podman socket..."
        run_with_loader "Running" flatpak-spawn --host systemctl --user reset-failed podman.socket podman.service 2>/dev/null || return $?
        run_with_loader "Running" flatpak-spawn --host systemctl --user enable --now podman.socket || return $?
        run_with_loader "Running" flatpak-spawn --host systemctl --user restart podman.socket || return $?
    else
        echo "Restarting rootless Podman socket on host..."
        run_with_loader "Running" systemctl --user reset-failed podman.socket podman.service 2>/dev/null || return $?
        run_with_loader "Running" systemctl --user enable --now podman.socket || return $?
        run_with_loader "Running" systemctl --user restart podman.socket || return $?
    fi

    # 2. Export and persist socket variables
    export CONTAINER_HOST="${host_uri}"
    export DOCKER_HOST="${host_uri}"
    grep -qxF "export CONTAINER_HOST=\"${host_uri}\"" ~/.bashrc || echo "export CONTAINER_HOST=\"${host_uri}\"" >> ~/.bashrc
    grep -qxF "export DOCKER_HOST=\"${host_uri}\"" ~/.bashrc || echo "export DOCKER_HOST=\"${host_uri}\"" >> ~/.bashrc

    # 3. Ensure docker CLI shim is available inside Toolbox
    if [ -f /run/.containerenv ]; then
        rpm -q podman-docker podman-remote >/dev/null 2>&1 || sudo dnf install -y podman-docker podman-remote
        [ -f /etc/containers/nodocker ] || sudo touch /etc/containers/nodocker 2>/dev/null
    fi

    # 4. Verify socket using podman --remote (works on both host and Toolbox)
    if [ -S "${sock_path}" ] && podman --remote --url "${host_uri}" info >/dev/null 2>&1; then
        _terminal_msg success "Success: Rootless Podman socket is active at ${host_uri}"
    else
        _terminal_msg error "Error: Socket check failed. Details:"
        podman --remote --url "${host_uri}" info
        return 1
    fi
}



# Recover rootless Podman (Host / Toolbox)
podrecoverstate() {
    local uid runtime_dir socket_path host_uri
    local answer bashrc
    local -a systemctl_cmd

    # Remote-only podman client (Secureblue): local socket impossible.
    if ! podman system service --help >/dev/null 2>&1; then
        [[ -S "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman-machine-default-api.sock" ]] \
            || run_with_loader "Running" podman machine start || true
        export CONTAINER_HOST="unix:///run/user/1000/podman/podman-machine-default-api.sock"
        export DOCKER_HOST="$CONTAINER_HOST"
        grep -qxF "export CONTAINER_HOST=\"$CONTAINER_HOST\"" "$HOME/.bashrc" \
            || printf 'export CONTAINER_HOST="%s"\n' "$CONTAINER_HOST" >> "$HOME/.bashrc"
        grep -qxF "export DOCKER_HOST=\"$DOCKER_HOST\"" "$HOME/.bashrc" \
            || printf 'export DOCKER_HOST="%s"\n' "$DOCKER_HOST" >> "$HOME/.bashrc"
        _terminal_msg normal "Rootless Podman via podman machine: $CONTAINER_HOST"
        return 0
    fi

    # --------------------------------------------------
    # 1. Validate prerequisites
    # --------------------------------------------------

    for cmd in podman systemctl; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            _terminal_msg error "Required command unavailable: $cmd"
            return 1
        fi
    done

    uid=$(id -u)
    runtime_dir="${XDG_RUNTIME_DIR:-/run/user/${uid}}"
    socket_path="${runtime_dir}/podman/podman.sock"
    host_uri="unix://${socket_path}"
    bashrc="${HOME}/.bashrc"

    if [[ ! -d "$runtime_dir" ]]; then
        _terminal_msg error "Runtime directory unavailable: ${runtime_dir}"
        return 1
    fi

    if [[ "$(stat -c '%u' "$runtime_dir" 2>/dev/null)" != "$uid" ]]; then
        _terminal_msg error "Runtime directory ownership mismatch."
        return 1
    fi

    # --------------------------------------------------
    # 2. Detect execution environment
    # --------------------------------------------------

    if [[ -f /run/.containerenv ]]; then

        if ! command -v flatpak-spawn >/dev/null 2>&1; then
            _terminal_msg error "flatpak-spawn is unavailable inside Toolbox."
            return 1
        fi

        systemctl_cmd=(flatpak-spawn --host systemctl --user)

        _terminal_msg normal "Detected Toolbox environment."
        _terminal_msg normal "Host systemd will manage rootless Podman."

    else

        systemctl_cmd=(systemctl --user)

        _terminal_msg normal "Detected Fedora host environment."

    fi

    # --------------------------------------------------
    # 3. Confirm recovery
    # --------------------------------------------------

    _terminal_msg warning "Podman API socket will be restarted."
    _terminal_msg normal "Running containers, images, and volumes will be preserved."

    read -r -p "Continue? [y/N]: " answer

    case "$answer" in
        [yY]|[yY][eE][sS]) ;;
        *)
            _terminal_msg error "Operation cancelled."
            return 0
            ;;
    esac

    # --------------------------------------------------
    # 4. Reset failed systemd units
    # --------------------------------------------------

    _terminal_msg normal "Resetting failed Podman systemd units."

    if ! run_with_loader "Running" \
        "${systemctl_cmd[@]}" reset-failed podman.socket podman.service; then
        _terminal_msg error "Failed to reset Podman systemd units."
        return 1
    fi

    # --------------------------------------------------
    # 5. Enable Podman socket
    # --------------------------------------------------

    _terminal_msg normal "Ensuring Podman socket is enabled."

    if ! run_with_loader "Running" \
        "${systemctl_cmd[@]}" enable podman.socket; then
        _terminal_msg error "Failed to enable podman.socket."
        return 1
    fi

    # --------------------------------------------------
    # 6. Restart Podman socket
    # --------------------------------------------------

    _terminal_msg normal "Restarting rootless Podman socket."

    if ! run_with_loader "Running" \
        "${systemctl_cmd[@]}" restart podman.socket; then
        _terminal_msg error "Failed to restart podman.socket."
        return 1
    fi

    # --------------------------------------------------
    # 7. Verify socket activation
    # --------------------------------------------------

    if ! "${systemctl_cmd[@]}" is-active --quiet podman.socket; then
        _terminal_msg error "Podman socket is not active."
        return 1
    fi

    # --------------------------------------------------
    # 8. Verify socket availability
    # --------------------------------------------------

    if [[ ! -S "$socket_path" ]]; then
        _terminal_msg error "Podman socket file is unavailable: ${socket_path}"
        return 1
    fi

    # --------------------------------------------------
    # 9. Verify remote Podman API
    # --------------------------------------------------

    _terminal_msg normal "Verifying rootless Podman API connectivity."

    if ! run_with_loader "Running" \
        podman --remote --url "$host_uri" info; then

        _terminal_msg error "Rootless Podman API verification failed."
        return 1
    fi

    # --------------------------------------------------
    # 10. Configure Docker-compatible environment
    # --------------------------------------------------

    export CONTAINER_HOST="$host_uri"
    export DOCKER_HOST="$host_uri"

    # --------------------------------------------------
    # 11. Persist environment variables
    # --------------------------------------------------

    if [[ ! -e "$bashrc" ]]; then
        if ! touch "$bashrc"; then
            _terminal_msg error "Cannot create ${bashrc}."
            return 1
        fi
    fi

    if [[ ! -w "$bashrc" ]]; then
        _terminal_msg error "Cannot write to ${bashrc}."
        return 1
    fi

    if ! grep -qxF "export CONTAINER_HOST=\"${host_uri}\"" "$bashrc"; then
        if ! printf 'export CONTAINER_HOST="%s"\n' "$host_uri" >> "$bashrc"; then
            _terminal_msg error "Failed to persist CONTAINER_HOST."
            return 1
        fi
    fi

    if ! grep -qxF "export DOCKER_HOST=\"${host_uri}\"" "$bashrc"; then
        if ! printf 'export DOCKER_HOST="%s"\n' "$host_uri" >> "$bashrc"; then
            _terminal_msg error "Failed to persist DOCKER_HOST."
            return 1
        fi
    fi

    # --------------------------------------------------
    # 12. Final verification
    # --------------------------------------------------
    givemespace
    _terminal_line success

    _terminal_msg success "Rootless Podman recovery completed."

    printf 'Environment: %s\n' \
        "$([[ -f /run/.containerenv ]] && echo Toolbox || echo Host)"

    printf 'User:        %s\n' "$USER"
    printf 'UID:         %s\n' "$uid"
    printf 'Socket:      %s\n' "$socket_path"
    printf 'Socket URI:  %s\n' "$host_uri"
    printf 'Socket:      %s\n' "$("${systemctl_cmd[@]}" show -p ActiveState --value podman.socket)"
    printf 'Service:     %s\n' "$("${systemctl_cmd[@]}" show -p ActiveState --value podman.service)"
    printf 'Docker Host: %s\n' "$DOCKER_HOST"
    givemespace

    _terminal_msg success "Podman API is operational."
    _terminal_msg normal "No containers, images, or volumes were removed."
}


# Podman reset all
podresetall() {
    local uid
    uid=$(id -u)

    _terminal_line normal
    _terminal_msg normal "Checking Podman socket and service 🚀"

    # Recover Podman socket if inactive.
    if ! systemctl --user is-active --quiet podman.socket; then

        if ! run_with_loader "Running" systemctl --user stop podman.service; then
            _terminal_msg error "Error: Failed to stop podman.service" >&2
            return 1
        fi

        if ! run_with_loader "Running" systemctl --user stop podman.socket; then
            _terminal_msg error "Error: Failed to stop podman.socket" >&2
            return 1
        fi

        if ! run_with_loader "Running" systemctl --user start podman.socket; then
            _terminal_msg error "Error: Failed to start podman.socket" >&2
            return 1
        fi
    fi

    # Verify socket.
    if ! systemctl --user is-active --quiet podman.socket; then
        _terminal_msg error "Error: podman.socket is not active"
        return 1
    fi

    # Verify Podman CLI.
    if ! run_with_loader "Running" podman info; then
        _terminal_msg error "Error: Podman is not operational"
        return 1
    fi
    givemespace
    echo "Socket: $(systemctl --user show -p ActiveState,SubState --value podman.socket | paste -sd '/') ✅"
    echo "Service: $(systemctl --user show -p ActiveState,SubState --value podman.service | paste -sd '/')"
    givemespace

    # Prune Podman resources.
    _terminal_line normal
    _terminal_msg normal "Pruning Podman resources ✂️"

    if ! run_with_loader "Running" podman stop --all; then
        _terminal_msg error "Error: Failed to stop all Podman containers" >&2
        return 1
    fi

  #  if ! run_with_loader "Running" podman rm --all --force; then
  #    _terminal_msg error "Error: Failed to remove all Podman containers" >&2
  #      return 1
  #  fi
  #
  #  if ! run_with_loader "Running" podman system prune --all --volumes --force; then
  #      _terminal_msg error "Error: Failed to prune Podman resources" >&2
  #      return 1
  #  fi

    _terminal_msg success "Podman resources have been reset."

    # Re-check Podman socket after pruning.
    _terminal_line normal
    _terminal_msg normal "Re-checking Podman socket after pruning 🚀"

    if ! systemctl --user is-active --quiet podman.socket; then
        if ! run_with_loader "Running" systemctl --user restart podman.socket; then
            _terminal_msg error "Error: Failed to restart podman.socket" >&2
            return 1
        fi
    fi

    if ! systemctl --user is-active --quiet podman.socket; then
        _terminal_msg error "Error: Podman socket failed to recover"
        return 1
    fi

    if ! run_with_loader "Running" podman info; then
        _terminal_msg error "Error: Podman failed post-pruning verification"
        return 1
    fi

    givemespace
    echo "Socket: $(systemctl --user show -p ActiveState,SubState --value podman.socket | paste -sd '/') ✅"
    echo "Service: $(systemctl --user show -p ActiveState,SubState --value podman.service | paste -sd '/')"
    givemespace

    # Configure automatic startup.
    _terminal_line normal
    _terminal_msg normal "Ensuring Podman socket starts automatically 🚀"

    if ! run_with_loader "Running" loginctl enable-linger "$USER"; then
        _terminal_msg error "Error: Failed to enable lingering for $USER" >&2
        return 1
    fi

    if ! run_with_loader "Running" systemctl --user enable --now podman.socket; then
        _terminal_msg error "Error: Failed to enable podman.socket" >&2
        return 1
    fi

    # Verify socket enablement.
    if ! run_with_loader "Running" systemctl --user is-enabled podman.socket; then
        _terminal_msg error "Error: podman.socket is not enabled" >&2
        return 1
    fi

    # Verify socket activation.
    if ! run_with_loader "Running" systemctl --user is-active podman.socket; then
        _terminal_msg error "Error: podman.socket is not active" >&2
        return 1
    fi

    # Configure Docker-compatible clients.
    export DOCKER_HOST="unix:///run/user/${uid}/podman/podman.sock"

    # Verify socket file.
    if [[ ! -S "/run/user/${uid}/podman/podman.sock" ]]; then
        _terminal_msg error "Error: Podman API socket file does not exist" >&2
        return 1
    fi

    _terminal_line normal
    _terminal_msg success "Podman reset completed successfully."
    _terminal_msg normal "Podman socket is enabled, active, and configured for automatic startup."
    _terminal_msg normal "DOCKER_HOST=${DOCKER_HOST}"
}

# systemic restart
podsystemrestart() {
    local rc=0

    _terminal_msg normal "Refreshing Podman resources..."
    unset CONTAINER_HOST

    _terminal_msg normal "Stopping Podman socket and service..."
    if run_with_loader "Stopping Podman socket" systemctl --user stop podman.socket; then
        :
    else
        rc=$?
    fi
    if (( rc == 0 )); then
        if run_with_loader "Stopping Podman service" systemctl --user stop podman.service; then
            :
        else
            rc=$?
        fi
    fi

    if (( rc == 0 )); then
        _terminal_msg normal "Waiting for Podman to stop..."
        sleep 5
        _terminal_msg normal "Starting Podman socket and service..."
        if run_with_loader "Starting Podman socket" systemctl --user start podman.socket; then
            :
        else
            rc=$?
        fi
    fi
    if (( rc == 0 )); then
        if run_with_loader "Starting Podman service" systemctl --user start podman.service; then
            :
        else
            rc=$?
        fi
    fi

    if (( rc == 0 )); then
        _terminal_msg success "Podman resources restarted."
        return 0
    fi

    _terminal_msg warning "Direct restart failed (exit code $rc); attempting recovery."
    if podrootless; then
        return 0
    elif podrecoverstate; then
        return 0
    elif podresetall; then
        return 0
    fi

    _terminal_msg error "Podman recovery did not complete."
    return "$rc"
}

# Install gcloud
workspaceinstallgcloud(){
# Install the Google Cloud CLI (gcloud) on Fedora via the RPM repository,
# following https://docs.cloud.google.com/sdk/docs/install-sdk#rpm
#
# Usage:
#   source install_gcloud.sh
#   install_gcloud            # auto-detect Fedora/arch and repo (el9 or el10)
#   install_gcloud el10       # force a specific repo generation
    local repo_gen="${1:-auto}"

    if [[ "$(. /etc/os-release; echo "$ID")" != "fedora" ]]; then
        echo "error: this function is intended for Fedora (detected ID='$(. /etc/os-release; echo "$ID")')" >&2
        return 1
    fi

    local fedora_major
    fedora_major=$(. /etc/os-release; echo "${VERSION_ID%%.*}")

    local arch
    case "$(uname -m)" in
        x86_64)  arch="x86_64" ;;
        aarch64) arch="aarch64" ;;
        *)
            echo "error: unsupported architecture '$(uname -m)'" >&2
            return 1
            ;;
    esac

    # Fedora 41/42 -> el9 repo; Fedora 43+ -> el10 repo (per docs' RHEL mapping)
    if [[ "$repo_gen" == "auto" ]]; then
        if (( fedora_major >= 43 )); then
            repo_gen="el10"
        else
            repo_gen="el9"
        fi
    fi

    local repo_file="/etc/yum.repos.d/google-cloud-sdk.repo"
    if [[ "$repo_gen" == "el10" ]]; then
        sudo tee "$repo_file" >/dev/null <<EOF
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el10-${arch}
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key-v10.gpg
EOF
    else
        sudo tee "$repo_file" >/dev/null <<EOF
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el9-${arch}
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOF
    fi

    sudo dnf install -y libxcrypt-compat
    sudo CLOUDSDK_SKIP_PY_COMPILATION=1 dnf install -y google-cloud-cli

    # Ensure the gcloud symlinks are on PATH for non-login shells too.
    if [[ -d /opt/google-cloud-sdk/bin && ":$PATH:" != *":/opt/google-cloud-sdk/bin:"* ]]; then
        echo "note: add /opt/google-cloud-sdk/bin to your PATH" >&2
    fi

    gcloud --version
}

# Create/reuse a Fedora Toolbox, upgrade it, install Google Cloud CLI, and enter it.
# Usage: gcloudtoolbox [container-name]
gcloudtoolbox() {
    local container_name="${1:-gcloud-dev}" arch rc
    if (( $# > 1 )) || [[ ! "$container_name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
        printf 'Usage: gcloudtoolbox [container-name]\n' >&2
        return 2
    fi
    for cmd in toolbox podman; do
        command -v "$cmd" >/dev/null 2>&1 || {
            printf 'Error: Required command not found: %s\n' "$cmd" >&2
            return 127
        }
    done
    case "$(uname -m)" in
        x86_64) arch=x86_64 ;;
        aarch64) arch=aarch64 ;;
        *) printf 'Error: Unsupported architecture: %s\n' "$(uname -m)" >&2; return 1 ;;
    esac
    if podman container exists "$container_name"; then
        printf 'Reusing Toolbox container: %s\n' "$container_name"
    else
        printf 'Creating Toolbox container: %s\n' "$container_name"
        if run_with_loader "Creating $container_name" toolbox create --container "$container_name"; then
            :
        else
            rc=$?
            _terminal_msg error "Toolbox creation failed: $container_name (exit code $rc)."
            return "$rc"
        fi
    fi
    toolbox run --container "$container_name" bash -c '
        set -Eeuo pipefail
        arch="$1"
        sudo dnf upgrade --refresh -y
        sudo tee /etc/yum.repos.d/google-cloud-sdk.repo >/dev/null <<EOF
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el10-${arch}
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key-v10.gpg
EOF
        sudo dnf install -y libxcrypt-compat
        sudo env CLOUDSDK_SKIP_PY_COMPILATION=1 dnf install -y google-cloud-cli
        gcloud version
    ' _ "$arch" || return $?
    printf 'Google Cloud CLI setup complete. Entering %s.\n' "$container_name"
    toolbox enter "$container_name"
}

# Unified bidirectional workspace sync.
# Prompts for direction interactively, or pass "up"/"down" (aliases: upload/download)
# to skip the prompt. Neither direction uses --delete.
gcloud_workspace_sync() {
    local PROJECT_ID="home-security-511714"
    local BUCKET="gs://home-security-bucket"
    local LOCAL_DIR="$HOME/workspace"
    local REMOTE_DIR="$BUCKET/workspace"
    local direction="${1:-}"
    local SOURCE_DIR DESTINATION_DIR
    local exit_code=0
    local gcloud_log

    # Validate required commands.
    for cmd in gcloud tput sleep mktemp; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            _terminal_msg error "Required command not found: $cmd ⚠️ "
            return 1
        fi
    done

    # Resolve direction: argument first, then interactive prompt.
    case "$direction" in
        up|upload|push)   direction="up" ;;
        down|download|pull) direction="down" ;;
        "")
            if [[ ! -t 0 ]]; then
                _terminal_msg error "No direction given and stdin is not a TTY. Usage: $FUNCNAME [up|down] ⚠️ "
                return 1
            fi
            _terminal_msg normal "Google Cloud Storage sync 📦"
            _terminal_msg normal "  1) Upload   $LOCAL_DIR -> $REMOTE_DIR"
            _terminal_msg normal "  2) Download $REMOTE_DIR -> $LOCAL_DIR"
            printf "Choose direction [1/2]: "
            read -r choice
            case "$choice" in
                1) direction="up" ;;
                2) direction="down" ;;
                *)
                    _terminal_msg error "Invalid choice: $choice ⚠️ "
                    return 1
                    ;;
            esac
            ;;
        *)
            _terminal_msg error "Invalid direction: $direction (expected up|down) ⚠️ "
            return 1
            ;;
    esac

    if [[ "$direction" == "up" ]]; then
        SOURCE_DIR="$LOCAL_DIR"
        DESTINATION_DIR="$REMOTE_DIR"
        if [[ ! -d "$SOURCE_DIR" ]]; then
            _terminal_msg error "Source directory does not exist: $SOURCE_DIR ⚠️ "
            return 1
        fi
    else
        SOURCE_DIR="$REMOTE_DIR"
        DESTINATION_DIR="$LOCAL_DIR"
    fi

    # Create temporary error log.
    gcloud_log=$(mktemp "${TMPDIR:-/tmp}/gcloud-sync.XXXXXX") || {
        _terminal_msg error "Could not create temporary log. ⚠️"
        return 1
    }

    _terminal_msg normal "Direction: $([[ "$direction" == up ]] && echo 'Upload 📤' || echo 'Download 📥')"
    _terminal_msg normal "Source: $SOURCE_DIR"
    _terminal_msg normal "Destination: $DESTINATION_DIR"
    _terminal_msg normal "Project: $PROJECT_ID"

    # Animate only the non-interactive sync phase.
    run_with_loader "Running" bash -c '
        CLOUDSDK_METRICS_REQUEST_ATTRIBUTION="agent-skills/1.0 (skill:gcloud)" \
            gcloud storage rsync "$1" "$2" \
                --recursive --quiet --project="$3" \
                >/dev/null 2>"$4"
    ' _ "$SOURCE_DIR" "$DESTINATION_DIR" "$PROJECT_ID" "$gcloud_log"
    exit_code=$?

    # Display final result.
    if (( exit_code == 0 )); then
        rm -f -- "$gcloud_log"
        _terminal_msg success "Google Cloud Storage $([[ "$direction" == up ]] && echo 'upload' || echo 'download') completed! 🚀"
        return 0
    else
        _terminal_msg error \
            "Google Cloud Storage sync failed (exit code: $exit_code). ⚠️ "

        _terminal_msg warning "GCloud error details: ⚠️ "
        tcat "$gcloud_log"

        _terminal_msg normal "Error log: $gcloud_log ⚠️"
        return "$exit_code"
    fi
}
# Upload to cf secureblue-oci"
# export R2_ACCESS_KEY_ID
# export R2_SECRET_ACCESS_KEY


# Load Cloudflare R2 credentials on demand from ~/.config/r2.env (requires chmod 600)
_load_r2_env() {
    local env_file="${R2_ENV_FILE:-$HOME/.config/r2.env}"
    local profile="${1:-default}"

    if [[ ! -f "$env_file" ]]; then
        _terminal_msg error "R2 env file not found: $env_file"
        return 1
    fi

    local perms
    perms=$(stat -c '%a' "$env_file" 2>/dev/null || echo "")
    if [[ "$perms" != "600" ]]; then
        _terminal_msg error "Unsafe permissions ($perms) on $env_file. Run: chmod 600 $env_file"
        return 1
    fi

    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a

    if [[ "$profile" == "oci" && -n "${R2_OCI_ACCESS_KEY_ID:-}" && -n "${R2_OCI_SECRET_ACCESS_KEY:-}" ]]; then
        R2_ACCESS_KEY_ID="$R2_OCI_ACCESS_KEY_ID"
        R2_SECRET_ACCESS_KEY="$R2_OCI_SECRET_ACCESS_KEY"
    fi

    if [[ -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
        _terminal_msg error "R2 credentials missing in $env_file"
        return 1
    fi
}

# Load Cloudflare R2 credentials on demand from ~/.config/r2.env (requires chmod 600)
_load_r2_env() {
    local env_file="${R2_ENV_FILE:-$HOME/.config/r2.env}"
    local profile="${1:-default}"

    if [[ ! -f "$env_file" ]]; then
        _terminal_msg error "R2 env file not found: $env_file"
        return 1
    fi

    local perms
    perms=$(stat -c '%a' "$env_file" 2>/dev/null || echo "")
    if [[ "$perms" != "600" ]]; then
        _terminal_msg error "Unsafe permissions ($perms) on $env_file. Run: chmod 600 $env_file"
        return 1
    fi

    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a

    if [[ "$profile" == "oci" && -n "${R2_OCI_ACCESS_KEY_ID:-}" && -n "${R2_OCI_SECRET_ACCESS_KEY:-}" ]]; then
        R2_ACCESS_KEY_ID="$R2_OCI_ACCESS_KEY_ID"
        R2_SECRET_ACCESS_KEY="$R2_OCI_SECRET_ACCESS_KEY"
    fi

    if [[ -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
        _terminal_msg error "R2 credentials missing in $env_file"
        return 1
    fi
}

cf_secureblue_upload(){
    local R2_ENDPOINT="https://cloudflarestorage.com"
    local BUCKET="s3://secureblue-oci/snapshots"
    local LOCAL_DIR="$HOME/workspace/secureblue-oci/snapshots"
    local REMOTE_DIR="$BUCKET"
    local direction="${1:-}"
    local SOURCE_DIR DESTINATION_DIR
    local exit_code=0
    local r2_log

    # Ensure secrets are scrubbed from memory when function exits
    trap 'unset R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_OCI_ACCESS_KEY_ID R2_OCI_SECRET_ACCESS_KEY' RETURN

    for cmd in aws tput sleep mktemp stat; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            _terminal_msg error "Required command not found: $cmd ⚠️ "
            return 1
        fi
    done

    _load_r2_env oci || return 1

    case "$direction" in
        up|upload|push)   direction="up" ;;
        down|download|pull) direction="down" ;;
        "")
            if [[ ! -t 0 ]]; then
                _terminal_msg error "No direction given and stdin is not a TTY. Usage: $FUNCNAME [up|down] ⚠️ "
                return 1
            fi
            _terminal_msg normal "Cloudflare R2 sync 📦"
            _terminal_msg normal "  1) Upload   $LOCAL_DIR -> $REMOTE_DIR"
            _terminal_msg normal "  2) Download $REMOTE_DIR -> $LOCAL_DIR"
            printf "Choose direction [1/2]: "
            read -r choice
            case "$choice" in
                1) direction="up" ;;
                2) direction="down" ;;
                *)
                    _terminal_msg error "Invalid choice: $choice ⚠️ "
                    return 1
                    ;;
            esac
            ;;
        *)
            _terminal_msg error "Invalid direction: $direction (expected up|down) ⚠️ "
            return 1
            ;;
    esac

    if [[ "$direction" == "up" ]]; then
        SOURCE_DIR="$LOCAL_DIR"
        DESTINATION_DIR="$REMOTE_DIR"
        if [[ ! -d "$SOURCE_DIR" ]]; then
            _terminal_msg error "Source directory does not exist: $SOURCE_DIR ⚠️ "
            return 1
        fi
    else
        SOURCE_DIR="$REMOTE_DIR"
        DESTINATION_DIR="$LOCAL_DIR"
        mkdir -p "$DESTINATION_DIR" || {
            _terminal_msg error "Could not create destination directory: $DESTINATION_DIR ⚠️ "
            return 1
        }
    fi

    r2_log=$(mktemp "${TMPDIR:-/tmp}/r2-sync.XXXXXX") || {
        _terminal_msg error "Could not create temporary log. ⚠️"
        return 1
    }

    _terminal_msg normal "Direction: $([[ "$direction" == up ]] && echo 'Upload 📤' || echo 'Download 📥')"
    _terminal_msg normal "Source: $SOURCE_DIR"
    _terminal_msg normal "Destination: $DESTINATION_DIR"

    run_with_loader "Running" bash -c '
        AWS_ACCESS_KEY_ID="$1" \
        AWS_SECRET_ACCESS_KEY="$2" \
        AWS_REGION=auto \
        aws s3 sync "$3" "$4" \
            --endpoint-url "$5" --only-show-errors \
            >/dev/null 2>"$6"
    ' _ "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY" \
        "$SOURCE_DIR" "$DESTINATION_DIR" "$R2_ENDPOINT" "$r2_log"
    exit_code=$?

    if (( exit_code == 0 )); then
        rm -f -- "$r2_log"
        _terminal_msg success "Cloudflare R2 $([[ "$direction" == up ]] && echo 'upload' || echo 'download') completed! 🚀"
        return 0
    else
        _terminal_msg error "Cloudflare R2 sync failed (exit code: $exit_code). ⚠️ "
        _terminal_msg warning "R2 error details: ⚠️ "
        tcat "$r2_log"
        _terminal_msg normal "Error log: $r2_log ⚠️"
        return "$exit_code"
    fi
}

cf_workspace_sync() {
    local R2_ENDPOINT="https://cloudflarestorage.com"
    local BUCKET="s3://backups/workspace"
    local PUBLIC_URL="https://r2.dev"
    local LOCAL_DIR="$HOME/workspace"
    local REMOTE_DIR="$BUCKET"
    local direction="${1:-}"
    local SOURCE_DIR DESTINATION_DIR
    local exit_code=0
    local r2_log

    # Ensure secrets are scrubbed from memory when function exits
    trap 'unset R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_OCI_ACCESS_KEY_ID R2_OCI_SECRET_ACCESS_KEY' RETURN

    for cmd in aws tput sleep mktemp stat; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            _terminal_msg error "Required command not found: $cmd ⚠️ "
            return 1
        fi
    done

    _load_r2_env default || return 1

    case "$direction" in
        up|upload|push)   direction="up" ;;
        down|download|pull) direction="down" ;;
        "")
            if [[ ! -t 0 ]]; then
                _terminal_msg error "No direction given and stdin is not a TTY. Usage: $FUNCNAME [up|down] ⚠️ "
                return 1
            fi
            _terminal_msg normal "Cloudflare R2 sync 📦"
            _terminal_msg normal "  1) Upload   $LOCAL_DIR -> $REMOTE_DIR"
            _terminal_msg normal "  2) Download $REMOTE_DIR -> $LOCAL_DIR"
            printf "Choose direction [1/2]: "
            read -r choice
            case "$choice" in
                1) direction="up" ;;
                2) direction="down" ;;
                *)
                    _terminal_msg error "Invalid choice: $choice ⚠️ "
                    return 1
                    ;;
            esac
            ;;
        *)
            _terminal_msg error "Invalid direction: $direction (expected up|down) ⚠️ "
            return 1
            ;;
    esac

    if [[ "$direction" == "up" ]]; then
        SOURCE_DIR="$LOCAL_DIR"
        DESTINATION_DIR="$REMOTE_DIR"
        if [[ ! -d "$SOURCE_DIR" ]]; then
            _terminal_msg error "Source directory does not exist: $SOURCE_DIR ⚠️ "
            return 1
        fi
    else
        SOURCE_DIR="$REMOTE_DIR"
        DESTINATION_DIR="$LOCAL_DIR"
    fi

    r2_log=$(mktemp "${TMPDIR:-/tmp}/r2-sync.XXXXXX") || {
        _terminal_msg error "Could not create temporary log. ⚠️"
        return 1
    }

    _terminal_msg normal "Direction: $([[ "$direction" == up ]] && echo 'Upload 📤' || echo 'Download 📥')"
    _terminal_msg normal "Source: $SOURCE_DIR"
    _terminal_msg normal "Destination: $DESTINATION_DIR"
    _terminal_msg normal "Public URL: $PUBLIC_URL"

    run_with_loader "Running" bash -c '
        AWS_ACCESS_KEY_ID="$1" \
        AWS_SECRET_ACCESS_KEY="$2" \
        AWS_REGION=auto \
        aws s3 sync "$3" "$4" \
            --endpoint-url "$5" --only-show-errors \
            >/dev/null 2>"$6"
    ' _ "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY" \
        "$SOURCE_DIR" "$DESTINATION_DIR" "$R2_ENDPOINT" "$r2_log"
    exit_code=$?

    if (( exit_code == 0 )); then
        rm -f -- "$r2_log"
        _terminal_msg success "Cloudflare R2 $([[ "$direction" == up ]] && echo 'upload' || echo 'download') completed! 🚀"
        return 0
    else
        _terminal_msg error "Cloudflare R2 sync failed (exit code: $exit_code). ⚠️ "
        _terminal_msg warning "R2 error details: ⚠️ "
        tcat "$r2_log"
        _terminal_msg normal "Error log: $r2_log ⚠️"
        return "$exit_code"
    fi
}

# Re-apply managed network/DNS state (Cloudflare DoT global DNS + dnsconfd/Unbound)
_mynetworkfix_impl() {
#!/usr/bin/env bash
# Enforce the desired network/DNS state on this Secureblue system.
# Idempotent: only restarts NetworkManager when something actually changed.
# Managed state:
#   - Resolver: dnsconfd (Unbound) on 127.0.0.1; systemd-resolved masked/stopped
#   - Global DNS: Cloudflare "security" profile via NM global-dns (DoT)
#   - Trivalent browser DoH: https://security.cloudflare-dns.com/dns-query
#   - No per-connection static DNS / bogus dns-search domains
#   - Dead USB NIC (enp0s20f0u10) kept down / autoconnect disabled
changed=0
note() { printf 'network-state-enforce: %s\n' "$*"; }

# --- 1. NM plugin config: dns=dnsconfd -------------------------------------
DNSCONFD_NM=/etc/NetworkManager/conf.d/dnsconfd.conf
if ! cmp -s "$DNSCONFD_NM" <(printf '[main]\ndns=dnsconfd\n') 2>/dev/null; then
    printf '[main]\ndns=dnsconfd\n' > "$DNSCONFD_NM"; chmod 644 "$DNSCONFD_NM"; changed=1
    note "rewrote $DNSCONFD_NM"
fi

# --- 2. Global DNS (Cloudflare security profile) ----------------------------
GLOBALDNS=/etc/NetworkManager/conf.d/global-dns.conf
GLOBALDNS_WANT='[global-dns]
resolve-mode=exclusive

[global-dns-domain-*]
servers=dns+tls://1.1.1.2#security.cloudflare-dns.com,dns+tls://1.0.0.2#security.cloudflare-dns.com,dns+tls://[2606:4700:4700::1112]#security.cloudflare-dns.com,dns+tls://[2606:4700:4700::1002]#security.cloudflare-dns.com
'
if ! cmp -s "$GLOBALDNS" <(printf '%s' "$GLOBALDNS_WANT") 2>/dev/null; then
    printf '%s' "$GLOBALDNS_WANT" > "$GLOBALDNS"; chmod 644 "$GLOBALDNS"; changed=1
    note "rewrote $GLOBALDNS"
fi

# --- 3. Trivalent DoH policy -------------------------------------------------
TRIV=/etc/trivalent/policies/managed/10-securedns-browser.json
TRIV_WANT='{
    "DnsOverHttpsMode": "secure",
    "DnsOverHttpsTemplates": "https://security.cloudflare-dns.com/dns-query"
}
'
if ! cmp -s "$TRIV" <(printf '%s' "$TRIV_WANT") 2>/dev/null; then
    install -d -m 0755 "$(dirname "$TRIV")"
    printf '%s' "$TRIV_WANT" > "$TRIV"; chmod 644 "$TRIV"; changed=1
    note "rewrote $TRIV"
fi

# --- 4. DNSSEC stays off (no /etc/dnsconfd.conf) -----------------------------
if [[ -e /etc/dnsconfd.conf ]]; then
    rm -f /etc/dnsconfd.conf; changed=1; note "removed /etc/dnsconfd.conf (DNSSEC off)"
fi

# --- 5. resolv.conf: real file for dnsconfd, not systemd stub ---------------
if [[ -L /etc/resolv.conf ]] || ! grep -q '^nameserver 127\.0\.0\.1' /etc/resolv.conf 2>/dev/null; then
    rm -f /etc/resolv.conf
    printf 'options edns0 trust-ad\nnameserver 127.0.0.1\n' > /etc/resolv.conf
    chown dnsconfd:root /etc/resolv.conf; chmod 644 /etc/resolv.conf
    changed=1; note "recreated /etc/resolv.conf for dnsconfd"
fi

# --- 6. Resolver services ----------------------------------------------------
if systemctl is-enabled --quiet systemd-resolved.service 2>/dev/null \
   || systemctl is-active --quiet systemd-resolved.service 2>/dev/null; then
    systemctl disable --now systemd-resolved.service >/dev/null 2>&1 || true
    systemctl mask systemd-resolved.service >/dev/null 2>&1 || true
    changed=1; note "stopped/disabled/masked systemd-resolved"
fi
for svc in dnsconfd.service unbound.socket unbound-control.socket; do
    if ! systemctl is-enabled --quiet "$svc" 2>/dev/null; then
        systemctl enable "$svc" >/dev/null 2>&1 || true; changed=1; note "enabled $svc"
    fi
done
if ! systemctl is-active --quiet dnsconfd.service 2>/dev/null; then
    systemctl start dnsconfd.service >/dev/null 2>&1 || true
fi

# --- 7. Strip per-connection static DNS drift (ethernet/wifi profiles) ------
while IFS= read -r conn; do
    [[ -z "$conn" ]] && continue
    dirty="$(nmcli -g ipv4.dns,ipv4.dns-search,ipv6.dns,ipv6.dns-search,ipv4.dns-options,ipv6.dns-options con show "$conn" 2>/dev/null | tr '\n' ',' )"
    if [[ "$dirty" =~ [^,[:space:]-] ]]; then
        nmcli con mod "$conn" ipv4.dns "" ipv4.dns-search "" ipv6.dns "" ipv6.dns-search "" \
            ipv4.dns-options "" ipv6.dns-options "" >/dev/null 2>&1 || true
        changed=1; note "cleared static DNS on connection '$conn'"
    fi
done < <(nmcli -t -f NAME,TYPE con show 2>/dev/null | awk -F: '$2 ~ /^802-3-ethernet$|^802-11-wireless$/ {print $1}')

# --- 8. Keep dead USB NIC down ----------------------------------------------
while IFS= read -r conn; do
    [[ -z "$conn" ]] && continue
    iface="$(nmcli -g connection.interface-name con show "$conn" 2>/dev/null || true)"
    if [[ "$iface" == "enp0s20f0u10" ]]; then
        auto="$(nmcli -g connection.autoconnect con show "$conn" 2>/dev/null || true)"
        if [[ "$auto" != "no" ]]; then
            nmcli con mod "$conn" connection.autoconnect no >/dev/null 2>&1 || true
            changed=1; note "disabled autoconnect on '$conn' ($iface)"
        fi
        if nmcli -t -f DEVICE,STATE device status 2>/dev/null | awk -F: -v i="$iface" '$1==i && $2=="connected" {f=1} END{exit !f}'; then
            nmcli device disconnect "$iface" >/dev/null 2>&1 || true
            note "disconnected dead interface $iface"
        fi
    fi
done < <(nmcli -t -f NAME con show 2>/dev/null)

# --- 9. Apply ----------------------------------------------------------------
if [[ "$changed" -eq 1 ]]; then
    note "changes applied; restarting NetworkManager"
    systemctl restart NetworkManager.service
    sleep 3
    systemctl start dnsconfd.service >/dev/null 2>&1 || true
else
    note "state already correct"
fi

}

# Network reconciliation is non-interactive; buffer its status output while animating.
mynetworkfix() {
    run_with_loader "Running" _mynetworkfix_impl "$@"
}

# Restart a systemd service
mysystemdrestart(){
    local keyword="$1"

    # Prompt for a keyword if none was passed as an argument
    if [[ -z "$keyword" ]]; then
        read -rp "Enter service keyword: " keyword
    fi

    # Exit if still empty
    [[ -z "$keyword" ]] && echo "No keyword provided." && return 1

    # Gather matching systemd service names into an array
    local services=()
    while IFS= read -r line; do
        services+=("$line")
    done < <(systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -i "$keyword")

    # Handle no matches
    if [[ ${#services[@]} -eq 0 ]]; then
        echo "No services found matching '$keyword'."
        return 1
    fi

    # Display interactive menu
    echo "Select a service to restart:"
    PS3="Enter number (or Ctrl+C to cancel): "
    select svc in "${services[@]}"; do
        if [[ -n "$svc" ]]; then
            echo "Restarting $svc..."
            run0 systemctl restart "$svc"
            break
        else
            echo "Invalid selection. Try again."
        fi
    done
}

# usbguard generate allow policy

myusbgenpolicy(){
_terminal_msg normal " Generating new policy: Default Allow all 💾 "
run0 usbguard generate-policy > /etc/usbguard/rules.conf
run0 chmod 600 /etc/usbguard/rules.conf
run0ctl enable --now usbguard.service
run0ctl restart  usbguard.service
run0ctl status usbguard.service
}

# connection check
# Verify the dedicated workspace SSH agent.
connectioncheck() {
    local agent_pid="${HOME_SECURITY_SSH_AGENT_PID:-}"
    local agent_sock="${HOME_SECURITY_SSH_AUTH_SOCK:-}"

    if [[ ! "$agent_pid" =~ ^[0-9]+$ ]] ||
       [[ -z "$agent_sock" || ! -S "$agent_sock" ]] ||
       ! kill -0 "$agent_pid" 2>/dev/null; then
        _terminal_msg error "Dedicated SSH agent is not running or its socket is unavailable."
        return 1
    fi

    if ! command -v ssh-add >/dev/null 2>&1; then
        _terminal_msg error "ssh-add is unavailable."
        return 1
    fi

    if ! SSH_AUTH_SOCK="$agent_sock" \
         SSH_AGENT_PID="$agent_pid" \
         ssh-add -l >/dev/null 2>&1; then
        _terminal_msg error "SSH agent is reachable, but no usable identity is loaded."
        return 1
    fi

    _terminal_msg success "Dedicated SSH agent is active."
    return 0
}


# pull updates from git
# Fetch and update ai-stack from origin/main.
getupdates() {
    local repo_dir="${AI_STACK_DIR:-$HOME/workspace/ai-stack}"
    local config_file="$repo_dir/projects/bash/bashrc_template"
    local branch

    # 1. Verify SSH access.
    _terminal_msg normal "Checking temporary SSH access..."

    if ! connectioncheck; then
        _terminal_msg warning "Run workspaceconnect and try again."
        return 1
    fi

    # Ensure Git inherits the dedicated SSH agent environment.
    export SSH_AUTH_SOCK="$HOME_SECURITY_SSH_AUTH_SOCK"
    export SSH_AGENT_PID="$HOME_SECURITY_SSH_AGENT_PID"

    # 2. Verify repository.
    if ! command -v git >/dev/null 2>&1 ||
       ! git -C "$repo_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        _terminal_msg error "ai-stack repository not found: $repo_dir"
        return 1
    fi

    # 3. Verify current branch.
    branch=$(git -C "$repo_dir" branch --show-current) || {
        _terminal_msg error "Could not determine the current Git branch."
        return 1
    }

    if [[ "$branch" != "main" ]]; then
        _terminal_msg error "Expected main branch; current branch is '${branch:-detached HEAD}'."
        return 1
    fi

    # 4. Protect uncommitted changes.
    if [[ -n "$(git -C "$repo_dir" status --porcelain)" ]]; then
        _terminal_msg warning "Working tree is not clean."
        _terminal_msg warning "Commit, stash, or discard changes before updating."
        git -C "$repo_dir" status --short
        return 1
    fi

    # 5. Fetch remote updates.
    _terminal_msg normal "Fetching updates from origin..."

    if ! git -C "$repo_dir" fetch --prune origin; then
        _terminal_msg error "Git fetch failed."
        return 1
    fi

    # 6. Verify origin/main exists.
    if ! git -C "$repo_dir" show-ref --verify --quiet refs/remotes/origin/main; then
        _terminal_msg error "Remote branch origin/main was not found."
        return 1
    fi

    # 7. Fast-forward only.
    _terminal_msg normal "Updating main branch..."

    if ! git -C "$repo_dir" merge --ff-only origin/main; then
        _terminal_msg error "Fast-forward failed. Manual Git reconciliation is required."
        return 1
    fi

    _terminal_msg success "Repository synchronized with origin/main."

    # 8. Validate configuration file.
    if [[ ! -r "$config_file" ]]; then
        _terminal_msg error "Configuration file is missing or unreadable."
        return 1
    fi

    _terminal_msg normal "Checking Bash syntax..."

    if ! bash -n "$config_file"; then
        _terminal_msg error "Syntax validation failed. Configuration was not loaded."
        return 1
    fi

    _terminal_msg success "Bash syntax is valid."

    # 9. Load updated configuration.
    _terminal_msg normal "Loading updated Bash configuration..."

    if ! source "$config_file"; then
        _terminal_msg error "Failed to load updated configuration."
        return 1
    fi

    # 10. Restore the dedicated SSH agent environment.
    # The template intentionally unsets SSH_AUTH_SOCK when sourced.
    if [[ -n "${HOME_SECURITY_SSH_AGENT_PID:-}" &&
          -n "${HOME_SECURITY_SSH_AUTH_SOCK:-}" &&
          -S "$HOME_SECURITY_SSH_AUTH_SOCK" ]] &&
       kill -0 "$HOME_SECURITY_SSH_AGENT_PID" 2>/dev/null; then

        export SSH_AUTH_SOCK="$HOME_SECURITY_SSH_AUTH_SOCK"
        export SSH_AGENT_PID="$HOME_SECURITY_SSH_AGENT_PID"

    else
        unset SSH_AUTH_SOCK SSH_AGENT_PID
        _terminal_msg warning "Configuration loaded, but the temporary SSH agent is no longer available."
        return 1
    fi

    _terminal_msg success "Updated Bash configuration loaded."
    _terminal_msg success "SSH agent environment restored."

    # 11. Optionally restart temporary workspace access.
    local reconnect
    if [[ -t 0 ]]; then
        printf '\n'
        read -r -p "Reconnect workspace access now? (Y/n): " reconnect
    else
        reconnect="n"
        _terminal_msg warning "No interactive terminal detected; skipping workspace reconnection."
    fi

    case "$reconnect" in
        [Yy]|[Yy][Ee][Ss])
            if ! declare -F workspacerestart >/dev/null 2>&1; then
                _terminal_msg error "workspacerestart function is not available."
                return 127
            fi

            _terminal_msg normal "Restarting workspace access..."
            if workspacerestart; then
                _terminal_msg success "Workspace access reconnected."
            else
                local restart_rc=$?
                _terminal_msg error "Workspace reconnection failed (exit code $restart_rc)."
                return "$restart_rc"
            fi
            ;;
        *)
            _terminal_msg normal "Keeping the current workspace connection."
            ;;
    esac

    return 0

    # 12. Kill the connection once done.
    workspacekill
}
# print all emoji for terminal
printemoji(){
_terminal_msg normal "Smileys & Emotion"
_terminal_line normal
echo " 😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖 💋 💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💯 💢 💥 💫 💦 💨 🕳️ 💣 💬 🗨️ 🗯️ 💭 💤 "

givemespace

_terminal_msg normal "People & Body"
_terminal_line normal
echo " 👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 👯 🧖 🧗 🤺 🏇 ⛷️ 🏂 🏌️ 🏄 🚣 🏊 ⛹️ 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🛀 🛌 👭 👫 👬 💏 💑 👪 🗣️ 👤 👥 🫂 👣 "

givemespace

_terminal_msg normal "Animals & Nature"
_terminal_line normal
echo " 🐵 🐒 🦍 🦧 🐶 🐕 🦮 🐕 🦺 🐩 🐺 🦊 🦝 🐱 🐈 🐈 ⬛ 🦁 🐯 🐅 🐆 🐴 🐎 🦄 🦓 🦌 🦬 🐮 🐂 🐃 🐄 🐷 🐖 🐗 🐽 🐏 🐑 🐐 🐪 🐫 🦙 🦒 🐘 🦣 🦏 🦛 🐭 🐁 🐀 🐹 🐰 🐇 🐿️ 🦫 🦔 🦇 🐻 🐻 ❄️  🐨 🐼 🦥 🦦 🦨 🦘 🦡 🐾 🦃 🐔 🐓 🐣 🐤 🐥 🐦 🐧 🕊️ 🦅 🦆 🦢 🦉 🦤 🪶 🦩 🦚 🦜 🐸 🐊 🐢 🦎 🐍 🐲 🐉 🦕 🦖 🐳 🐋 🐬 🦭 🐟 🐠 🐡 🦈 🐙 🐚 🐌 🦋 🐛 🐜 🐝 🪲 🐞 🦗 🪳 🕷️ 🕸️ 🦂 🦟 🪰 🪱 🦠 💐 🌸 💮 🏵️ 🌹 🥀 🌺 🌻 🌼 🌷 🌱 🪴 🌲 🌳 🌴 🌵 🌾 🌿 ☘️ 🍀 🍁 🍂 🍃 "


givemespace

_terminal_msg normal "Food & Drink"
_terminal_line normal
echo " 🍇 🍈 🍉 🍊 🍋 🍌 🍍 🥭 🍎 🍏 🍐 🍑 🍒 🍓 🫐 🥝 🍅 🫒 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🌰 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🦀 🦞 🦐 🦑 🦪 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🫖 🍵 🍶 🍾 🍷 🍸 🍹 🍺 🍻 🥂 🥃 🥤 🧋 🧃 🧉 🧊 🥢 🍽️ 🍴 🥄 🔪 🏺 "


givemespace

_terminal_msg normal "Travel & Places"
_terminal_line normal
echo " 🌍 🌎 🌏 🌐 🗺️ 🗾 🧭 🏔️ ⛰️ 🌋 🗻 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏗️ 🧱 🪨 🪵 🛖 🏘️ 🏚️ 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 ♨️ 🎠 🎡 🎢 💈 🎪 🚂 🚃 🚄 🚅 🚆 🚇 🚈 🚉 🚊 🚝 🚞 🚋 🚌 🚍 🚎 🚐 🚑 🚒 🚓 🚔 🚕 🚖 🚗 🚘 🚙 🛻 🚚 🚛 🚜 🏎️ 🏍️ 🛵 🦽 🦼 🛺 🚲 🛴 🛹 🛼 🚏 🛣️ 🛤️ 🛢️ ⛽ 🚨 🚥 🚦 🛑 🚧 ⚓ ⛵ 🛶 🚤 🛳️ ⛴️ 🛥️ 🚢 ✈️ 🛩️ 🛫 🛬 🪂 💺 🚁 🚟 🚠 🚡 🛰️ 🚀 🛸 🛎️ 🧳 ⌛ ⏳ ⌚ ⏰ ⏱️ ⏲️ 🕰️ 🕛 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🌙 🌚 🌛 🌜 🌡️ ☀️ 🌝 🌞 🪐 ⭐ 🌟 🌠 🌌 ☁️ ⛅ ⛈️ 🌤️ 🌥️ 🌦️ 🌧️ 🌨️ 🌩️ 🌪️ 🌫️ 🌬️ 🌀 🌈 🌂 ☂️ ☔ ⛱️ ⚡ ❄️ ☃️ ⛄ ☄️ 🔥 💧 🌊 "


givemespace

_terminal_msg normal "Activities"
_terminal_line normal
echo " 🎃 🎄 🎆 🎇 🧨 ✨ 🎈 🎉 🎊 🎋 🎍 🎎 🎏 🎐 🎑 🧧 🎀 🎁 🎗️ 🎟️ 🎫 🎖️ 🏆 🏅 🥇 🥈 🥉 ⚽ ⚾ 🥎 🏀 🏐 🏈 🏉 🎾 🥏 🎳 🏏 🏑 🏒 🥍 🏓 🏸 🥊 🥋 🥅 ⛳ ⛸️ 🎣 🤿 🎽 🎿 🛷 🥌 🎯 🪀 🪁 🎱 🔮 🪄 🧿 🎮 🕹️ 🎰 🎲 🧩 🧸 🪅 🪩 🪆 ♠️ ♥️ ♦️ ♣️ ♟️ 🃏 🀄 🎴 🎭 🖼️ 🎨 🧵 🪡 🧶 🪢 "


givemespace

_terminal_msg normal "Objects"
_terminal_line normal
echo " 👓 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚 👛 👜 👝 🛍️ 🎒 🩴 👞 👟 🥾 🥿 👠 👡 🩰 👢 👑 👒 🎩 🎓 🧢 🪖 ⛑️ 📿 💄 💍 💎 🔇 🔈 🔉 🔊 📢 📣 📯 🔔 🔕 🎼 🎵 🎶 🎙️ 🎚️ 🎛️ 🎤 🎧 📻 🎷 🪗 🎸 🎹 🎺 🎻 🪕 🥁 🪘 📱 📲 ☎️ 📞 📟 📠 🔋 🔌 💻 🖥️ 🖨️ ⌨️ 🖱️ 🖲️ 💽 💾 💿 📀 🧮 🎥 🎞️ 📽️ 🎬 📺 📷 📸 📹 📼 🔍 🔎 🕯️ 💡 🔦 🏮 🪔 📔 📕 📖 📗 📘 📙 📚 📓 📒 📃 📜 📄 📰 🗞️ 📑 🔖 🏷️ 💰 🪙 💴 💵 💶 💷 💸 💳 🧾 💹 ✉️ 📧 📨 📩 📤 📥 📦 📫 📪 📬 📭 📮 🗳️ ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📝 💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋 📌 📍 📎 🖇️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️ 🔒 🔓 🔏 🔐 🔑 🗝️ 🔨 🪓 ⛏️ ⚒️ 🛠️ 🗡️ ⚔️ 🔫 🪃 🏹 🛡️ 🪚 🔧 🪛 🔩 ⚙️ 🗜️ ⚖️ 🦯 🔗 ⛓️ 🪝 🧰 🧲 🪜 ⚗️ 🧪 🧫 🧬 🔬 🔭 📡 💉 🩸 💊 🩹 🩺 🚪 🛗 🪞 🪟 🛏️ 🛋️ 🪑 🚽 🪠 🚿 🛁 🪤 🪒 🧴 🧷 🧹 🧺 🧻 🪣 🧼 🪥 🧽 🧯 🛒 🚬 ⚰️ 🪦 ⚱️ 🗿 🪧 "


givemespace

_terminal_msg normal "Symbols"
_terminal_line normal
echo " 🏧 🚮 🚰 ♿ 🚹 🚺 🚻 🚼 🚾 🛂 🛃 🛄 🛅 ⚠️ 🚸 ⛔ 🚫 🚳 🚭 🚯 🚱 🚷 📵 🔞 ☢️ ☣️ ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝 🛐 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎ 🔀 🔁 🔂 ▶️ ⏩ ⏭️ ⏯️ ◀️ ⏪ ⏮️ 🔼 ⏫ 🔽 ⏬ ⏸️ ⏹️ ⏺️ ⏏️ 🎦 🔅 🔆 📶 📳 📴 ♀️ ♂️ ⚧️ ✖️ ➕ ➖ ➗ ♾️ ‼️ ⁉️ ❓ ❔ ❕ ❗ 〰️ 💱 💲 ⚕️ ♻️ ⚜️ 🔱 📛 🔰 ⭕ ✅ ☑️ ✔️ ❌ ❎ ➰ ➿ 〽️ ✳️ ✴️ ❇️ ©️ ®️ ™️ #️⃣ *️⃣ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔠 🔡 🔢 🔣 🔤 🅰️ 🆎 🅱️ 🆑 🆒 🆓 ℹ️ 🆔 Ⓜ️ 🆕 🆖 🅾️ 🆗 🅿️ 🆘 🆙 🆚 🈁 🈂️ 🈷️ 🈶 🈯 🉐 🈹 🈚 🈲 🉑 🈸 🈴 🈳 ㊗️ ㊙️ 🈺 🈵 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ ◼️ ◻️ ◾ ◽ ▪️ ▫️ 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲 "

givemespace

_terminal_msg normal "Flags"
_terminal_line normal
echo " 🏁 🚩 🎌 🏴 🏳️ 🏳️🌈 🏳️ ⚧️  ☠️  "
givemespace
}

# [DEPRECATED use bashconfigupdate] Check Bash syntax and show diagnostics before replacing ~/.bashrc.
# Usage: bashconfigcheck
bashconfigcheck() {
    local config="$HOME/workspace/ai-stack/projects/bash/bashrc_template"
    local syntax_output syntax_status error_line start_line end_line

    _terminal_msg normal "Validating $config before updating ~/.bashrc."

    # 1. Validate Bash syntax and retain stderr for diagnostics.
    syntax_output=$(bash -n "$config" 2>&1)
    syntax_status=$?

    if (( syntax_status != 0 )); then
        _terminal_msg error "Syntax check: FAILED"
        printf '%s\n' "$syntax_output" >&2

        # Show the reported line and nearby context when Bash provides a line number.
        if [[ "$syntax_output" =~ line[[:space:]]+([0-9]+) ]]; then
            error_line="${BASH_REMATCH[1]}"
            start_line=$(( error_line > 3 ? error_line - 3 : 1 ))
            end_line=$(( error_line + 3 ))

            _terminal_msg warning "Problem area (line $error_line):"
            awk -v start="$start_line" -v end="$end_line" -v error="$error_line" '
                NR >= start && NR <= end {
                    marker = (NR == error ? ">>>" : "   ")
                    printf "%s %6d | %s\n", marker, NR, $0
                }
            ' "$config"
        else
            _terminal_msg warning "Bash did not report a line number; inspect the diagnostic above."
        fi

        _terminal_msg error "Configuration was not copied."
        return 1
    fi

    _terminal_msg success "Bash syntax validation passed."

    # 2. Copy configuration only after syntax validation succeeds.
    if cp -f "$config" "$HOME/.bashrc"; then
        _terminal_msg success "Configuration copied to ~/.bashrc."
    else
        _terminal_msg error "Configuration copy: FAILED"
        return 1
    fi

    # 3. Reload configuration and preserve any error output.
    if source "$config"; then
        _terminal_msg success "Configuration sourced successfully."
    else
        _terminal_msg error "Configuration reload: FAILED"
        return 1
    fi
    # 4. Reload terminal
    _terminal_msg success "Configuration updated. Restarting the current Bash shell."
    exec bash
    return 0
}

# Sanboxed container
burnerbox() {
  local project_dir="${1:-.}"
  local image="${2:-registry.fedoraproject.org/fedora-toolbox:44}"
  local net_mode="${3:-host}"

  # Resolve the absolute path of the target project directory
  if ! project_dir="$(realpath -e "$project_dir" 2>/dev/null)"; then
    echo "Error: Directory '$1' does not exist." >&2
    return 1
  fi

  # Safety check: Prevent accidentally mounting your entire home directory or root
  if [[ "$project_dir" == "$HOME" || "$project_dir" == "/" ]]; then
    echo "Error: Refusing to mount '$project_dir' for security reasons. Pass a specific project subfolder." >&2
    return 1
  fi

  echo "Starting hardened AI sandbox..."
  echo "  Workspace : $project_dir -> /workspace"
  echo "  Image     : $image"
  echo "  Network   : $net_mode"

  podman run --rm -it \
    --name "ai-sandbox-$(date +%s)" \
    --cap-drop=ALL \
    --security-opt=no-new-privileges \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,nodev,size=512m \
    --tmpfs /var/tmp:rw,noexec,nosuid,nodev,size=256m \
    --pids-limit=512 \
    --memory=4g \
    --cpus=2 \
    --network="$net_mode" \
    --userns=keep-id \
    -v "${project_dir}:/workspace:Z" \
    -w /workspace \
    "$image" \
    /bin/bash

_terminal_msg normal "Verify created podman container"
podman ps -a

}

burnercommand() {
    local container="burnerbox"
    local project_dir="$HOME/workspace/"
    local image="registry.fedoraproject.org/fedora-toolbox:44"
    local rc

    # Create or start the persistent sandbox without requiring a TTY.
    if ! podman container exists "$container"; then
        _terminal_msg normal "Creating persistent hardened sandbox..."
        if run_with_loader "Creating $container" podman run -d \
            --name "$container" \
            --cap-drop=ALL \
            --security-opt=no-new-privileges \
            --read-only \
            --tmpfs /tmp:rw,noexec,nosuid,nodev,size=512m \
            --tmpfs /var/tmp:rw,noexec,nosuid,nodev,size=256m \
            --pids-limit=512 \
            --memory=4g \
            --cpus=2 \
            --network=host \
            --userns=keep-id \
            -v "${project_dir}:/workspace:Z" \
            -w /workspace \
            "$image" \
            sleep infinity; then
            _terminal_msg success "Sandbox container created."
        else
            rc=$?
            _terminal_msg error "Failed to create $container (exit code $rc)."
            return "$rc"
        fi
    elif [[ "$(podman inspect -f '{{.State.Running}}' "$container" 2>/dev/null)" != "true" ]]; then
        if run_with_loader "Starting $container" podman start "$container"; then
            _terminal_msg success "Sandbox container started."
        else
            rc=$?
            _terminal_msg error "Failed to start $container (exit code $rc)."
            return "$rc"
        fi
    else
        _terminal_msg success "Sandbox container is already running."
    fi

    # Keep interactive shell sessions in the foreground.
    if (( $# == 0 )); then
        podman exec -it "$container" /bin/bash
        return $?
    fi

    # Pass the requested command text to the container's Bash shell.
    local tty_flags=(-i)
    [[ -t 0 && -t 1 ]] && tty_flags=(-it)
    podman exec "${tty_flags[@]}" "$container" /bin/bash -c "$*"
}

# Configure Podman image trust for one registry/repository.
# Defaults to Fedora Toolbox 44 when no image scope is supplied.
podimagetrust() {
    local registry="${1:-}"
    local policy_file="${2:-}"

    if [[ -z "$registry" || -z "$policy_file" ]]; then
        _terminal_msg error "Usage: podimagetrust <registry> <policy_file> ⚠️ "
        return 1
    fi

    _terminal_msg normal "Adding trust to the registry: $registry"

    if podman image trust set --signature-policy "$policy_file" --type accept "$registry"; then
        _terminal_msg success "Trust successfully added for $registry 🚀"
        return 0
    else
        local exit_code=$?
        _terminal_msg error "Failed to add trust for $registry (exit code: $exit_code) ⚠️ "
        return "$exit_code"
    fi

}

podimagepull() {
    local registry="${1:-}"
    local policy_file="${2:-}"

    if [[ -z "$registry" || -z "$policy_file" ]]; then
        _terminal_msg error "Usage: podimagetrust <registry> <policy_file> ⚠️ "
        return 1
    fi

    _terminal_msg normal "Adding trust to the registry: $registry"

    if podman image trust set --signature-policy "$policy_file" --type accept "$registry"; then
        _terminal_msg success "Trust successfully added for $registry 🚀"
        _terminal_msg normal "Pulling image now..."
        podman pull --signature-policy $policy_file $registry
        return 0
    else
        local exit_code=$?
        _terminal_msg error "Failed to add trust for $registry (exit code: $exit_code) ⚠️ "
        return "$exit_code"
    fi
    
    

}


# EOF
firewall-cmd-get-active(){
for zone in $(sudo firewall-cmd --get-active-zones | grep -v '^[[:space:]]'); do
  sudo firewall-cmd --zone="$zone" --list-all
done
}

# Bash completion for kimctl: complete currently defined shell functions.
_kimctl_completion() {
    local current="${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=()
    (( COMP_CWORD == 1 )) || return 0
    mapfile -t COMPREPLY < <(compgen -A function -- "$current" | grep -v '^_kimctl_completion$')
}
complete -F _kimctl_completion kimctl

# Command wrapper: dispatch every defined function in the current shell.
# This preserves prompts, TTY access, cd/export changes, traps, and return codes.
kimctl() {
    local command_name="${1:-}" rc
    if (( $# == 0 )); then
        printf 'Usage: kimctl function [arguments...]\n' >&2
        return 2
    fi
    if [[ ! "$command_name" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]] ||
       ! declare -F "$command_name" >/dev/null 2>&1 ||
       [[ "$command_name" == kimctl ]]; then
        printf 'Error: Function not found: %s\n' "$command_name" >&2
        return 127
    fi

    shift
    _terminal_msg normal "Running function: $command_name"
    "$command_name" "$@"
    rc=$?

    if (( rc == 0 )); then
        _terminal_msg success "Completed: $command_name"
    else
        _terminal_msg error "Failed: $command_name (exit code $rc)"
    fi
    return "$rc"
}

# sretoolbox
sretoolbox() {
    local name="sredev"
    local image="${SRE_TOOLBOX_IMAGE:-registry.fedoraproject.org/fedora-toolbox:44}"
    local enter_after=0 name_set=0
    local cache_dir setup_script log_file rc cmd

    while (($#)); do
        case "$1" in
            -h|--help)
                cat <<'USAGE'
Usage: sretoolboxcreate [container-name] [--image IMAGE] [--enter]

Creates (or reuses) a Fedora Toolbox container and provisions an SRE/DevOps toolchain.
Default image: registry.fedoraproject.org/fedora-toolbox:44
Override image with --image or SRE_TOOLBOX_IMAGE.
USAGE
                return 0
                ;;
            -e|--enter)
                enter_after=1
                shift
                ;;
            -i|--image)
                if (($# < 2)); then
                    printf 'Error: --image requires an image reference.\n' >&2
                    return 2
                fi
                image="$2"
                shift 2
                ;;
            --)
                shift
                break
                ;;
            -* )
                printf 'Error: Unknown option: %s\n' "$1" >&2
                return 2
                ;;
            *)
                if (( name_set )); then
                    printf 'Error: Unexpected argument: %s\n' "$1" >&2
                    return 2
                fi
                name="$1"
                name_set=1
                shift
                ;;
        esac
    done

    if [[ ! "$name" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$ ]]; then
        printf 'Error: Invalid Toolbox container name: %s\n' "$name" >&2
        return 2
    fi

    for cmd in toolbox podman curl; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            printf 'Error: Required host command not found: %s\n' "$cmd" >&2
            return 127
        fi
    done

    cache_dir="$HOME/.cache/secureblue-oci"
    if ! mkdir -p -m 700 "$cache_dir"; then
        printf 'Error: Cannot create cache directory: %s\n' "$cache_dir" >&2
        return 1
    fi

    setup_script=$(mktemp "$cache_dir/provision.XXXXXX.sh") || return 1
    log_file="$cache_dir/${name}-$(date +%Y%m%d-%H%M%S).log"
    chmod 600 "$setup_script" || {
        rm -f -- "$setup_script"
        return 1
    }

    cat > "$setup_script" <<'TOOLBOX_SETUP'

if [[ ! -f /run/.containerenv ]]; then
    printf 'This provisioning script must run inside a Toolbox container.\n' >&2
    exit 1
fi

if [[ ! -r /etc/os-release ]]; then
    printf 'Cannot identify the container operating system.\n' >&2
    exit 1
fi
# shellcheck disable=SC1091
. /etc/os-release
if [[ "${ID:-}" != fedora ]]; then
    printf 'Expected Fedora Toolbox; found %s.\n' "${PRETTY_NAME:-unknown}" >&2
    exit 1
fi

command -v sudo >/dev/null 2>&1 || {
    printf 'sudo is required inside the Toolbox container.\n' >&2
    exit 127
}

workdir=$(mktemp -d "${TMPDIR:-/tmp}/secureblue-oci.XXXXXX")
trap 'rm -rf -- "$workdir"' EXIT

printf '\n==> Refreshing Fedora package metadata and upgrading installed packages\n'
sudo dnf upgrade --refresh -y

printf '\n==> Installing base Secureblue OCI packages\n'
base_packages=(
    git git-lfs gh
    curl wget ca-certificates
    gnupg2 openssh-clients openssl
    python3 python3-pip python3-devel python3-virtualenv pipx uv
    perl perl-Digest-SHA
    awscli2 azure-cli
    ansible-core
    lynis aide clamav clamav-freshclam
    jq yq ripgrep fd-find fzf tmux htop btop tree bat eza
    bind-utils mtr traceroute nmap tcpdump socat iperf3 lsof strace sysstat
    make gcc gcc-c++ cmake pkgconf-pkg-config
    unzip zip tar gzip xz less
    ShellCheck shfmt yamllint
    helm k9s
    buildah skopeo podman-compose
    cosign
)
sudo dnf install -y --skip-unavailable "${base_packages[@]}"

printf '\n==> Adding HashiCorp and Aqua Security repositories\n'
sudo install -d -m 0755 /etc/yum.repos.d
curl -fsSL https://rpm.releases.hashicorp.com/fedora/hashicorp.repo \
    | sudo tee /etc/yum.repos.d/hashicorp.repo >/dev/null
sudo tee /etc/yum.repos.d/trivy.repo >/dev/null <<'TRIVY_REPO'
[trivy]
name=Trivy repository
baseurl=https://aquasecurity.github.io/trivy-repo/rpm/releases/$basearch/
enabled=1
gpgcheck=1
gpgkey=https://aquasecurity.github.io/trivy-repo/rpm/public.key
TRIVY_REPO
sudo dnf makecache --refresh
sudo dnf install -y terraform trivy

printf '\n==> Installing cloudflared (latest Cloudflare RPM release)\n'
case "$(uname -m)" in
    x86_64) cloudflared_rpm='cloudflared-linux-x86_64.rpm' ;;
    aarch64) cloudflared_rpm='cloudflared-linux-aarch64.rpm' ;;
    *) printf 'Unsupported architecture for cloudflared: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac
curl -fL --retry 3 --retry-delay 2 \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/${cloudflared_rpm}" \
    -o "$workdir/$cloudflared_rpm"
sudo dnf install -y "$workdir/$cloudflared_rpm"

printf '\n==> Installing Google Cloud CLI from the official Linux archive\n'
case "$(uname -m)" in
    x86_64) gcloud_arch='x86_64' ;;
    aarch64) gcloud_arch='arm' ;;
    *) printf 'Unsupported architecture for Google Cloud CLI: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac
gcloud_archive="google-cloud-cli-linux-${gcloud_arch}.tar.gz"
curl -fL --retry 3 --retry-delay 2 \
    "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/${gcloud_archive}" \
    -o "$workdir/$gcloud_archive"
mkdir -p "$HOME/.local/share/sre-devops"
tar -xzf "$workdir/$gcloud_archive" -C "$workdir"
gcloud_source="$workdir/google-cloud-sdk"
gcloud_target="$HOME/.local/share/sre-devops/google-cloud-sdk"
gcloud_previous="$HOME/.local/share/sre-devops/google-cloud-sdk.previous"
rm -rf -- "$gcloud_previous"
if [[ -d "$gcloud_target" ]]; then
    mv "$gcloud_target" "$gcloud_previous"
fi
if ! mv "$gcloud_source" "$gcloud_target"; then
    [[ ! -d "$gcloud_previous" ]] || mv "$gcloud_previous" "$gcloud_target"
    printf 'Could not publish the Google Cloud CLI installation.\n' >&2
    exit 1
fi
rm -rf -- "$gcloud_previous"
"$gcloud_target/install.sh" --quiet --path-update=false --command-completion=false --usage-reporting=false
gcloud components install gke-gcloud-auth-plugin --quiet

printf '\n==> Installing the current stable kubectl with SHA-256 verification\n'
case "$(uname -m)" in
    x86_64) kubectl_arch='amd64' ;;
    aarch64) kubectl_arch='arm64' ;;
    *) printf 'Unsupported architecture for kubectl: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac
kubectl_version=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
if [[ ! "$kubectl_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    printf 'Unexpected kubectl stable version value: %s\n' "$kubectl_version" >&2
    exit 1
fi
curl -fsSL "https://dl.k8s.io/release/${kubectl_version}/bin/linux/${kubectl_arch}/kubectl" \
    -o "$workdir/kubectl"
curl -fsSL "https://dl.k8s.io/release/${kubectl_version}/bin/linux/${kubectl_arch}/kubectl.sha256" \
    -o "$workdir/kubectl.sha256"
printf '%s  %s\n' "$(<"$workdir/kubectl.sha256")" "$workdir/kubectl" \
    | sha256sum --check --status || {
        printf 'kubectl checksum verification failed.\n' >&2
        exit 1
    }
install -d -m 0755 "$HOME/.local/bin"
install -m 0755 "$workdir/kubectl" "$HOME/.local/bin/kubectl"

printf '\n==> Installing NVM, current Node.js LTS, npm and AI CLIs\n'
export NVM_DIR="$HOME/.local/share/sre-devops/nvm"
mkdir -p "$NVM_DIR" "$HOME/.bashrc.d" "$HOME/.local/bin"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh \
        -o "$workdir/nvm-install.sh"
    PROFILE=/dev/null NVM_DIR="$NVM_DIR" bash "$workdir/nvm-install.sh"
fi
# shellcheck disable=SC1090
. "$NVM_DIR/nvm.sh"
nvm install --lts
nvm alias default 'lts/*'
nvm use --lts
npm install --global cline @anthropic-ai/claude-code

printf '\n==> Installing Devin CLI\n'
curl -fsSL https://cli.devin.ai/install.sh -o "$workdir/devin-install.sh"
bash "$workdir/devin-install.sh"

printf '\n==> Installing Python SRE/DevOps developer tools with pipx\n'
for app in ansible-lint checkov pre-commit; do
    if ! pipx runpip "$app" --version >/dev/null 2>&1; then
        pipx install "$app"
    else
        pipx upgrade "$app"
    fi
done

printf '\n==> Configuring Toolbox-only shell environment\n'
cat > "$HOME/.bashrc.d/96-secureblue-oci.sh" <<'TOOLBOX_RC'
# SRE/DevOps tools installed for Toolbox. Do not alter host-shell behavior.
if [[ -f /run/.containerenv ]]; then
    export PATH="$HOME/.local/bin:$PATH"
    export NVM_DIR="$HOME/.local/share/sre-devops/nvm"
    [[ ! -s "$NVM_DIR/nvm.sh" ]] || . "$NVM_DIR/nvm.sh"
    gcloud_path="$HOME/.local/share/sre-devops/google-cloud-sdk/path.bash.inc"
    [[ ! -s "$gcloud_path" ]] || . "$gcloud_path"

    # WARP is a host networking service; forward CLI calls to the host.
    warp-cli() {
        if command -v flatpak-spawn >/dev/null 2>&1 \
            && flatpak-spawn --host sh -c 'command -v warp-cli >/dev/null 2>&1'; then
            flatpak-spawn --host warp-cli "$@"
        else
            printf 'warp-cli is unavailable on the host. Install and run Cloudflare WARP on the host OS.\n' >&2
            return 127
        fi
    }
fi
TOOLBOX_RC
chmod 0644 "$HOME/.bashrc.d/96-secureblue-oci.sh"

printf '\n==> Provisioning completed. Installed command availability:\n'
for tool in git gh aws az gcloud cloudflared terraform ansible kubectl helm k9s trivy lynis aide clamscan freshclam nvm node npm cline claude devin gke-gcloud-auth-plugin; do
    if command -v "$tool" >/dev/null 2>&1; then
        printf '  [OK] %s -> %s\n' "$tool" "$(command -v "$tool")"
    else
        printf '  [MISSING] %s\n' "$tool"
    fi
done
printf '\nWARP: warp-cli is forwarded to the host if flatpak-spawn and the host WARP client are available.\n'
printf 'Note: Lynis, AIDE and ClamAV installed here operate within the Toolbox context, not as host security agents.\n'
TOOLBOX_SETUP

    if [[ ! -s "$setup_script" ]]; then
        printf 'Error: Failed to write Toolbox provisioning script.\n' >&2
        rm -f -- "$setup_script"
        return 1
    fi
    chmod 700 "$setup_script" || {
        rm -f -- "$setup_script"
        return 1
    }

    if command podman container exists "$name" >/dev/null 2>&1; then
        printf 'Reusing existing Toolbox container: %s\n' "$name"
    else
        printf 'Creating Toolbox container %s from %s\n' "$name" "$image"
        if declare -F run_with_loader >/dev/null 2>&1; then
            if run_with_loader "Creating ${name}" toolbox create --assumeyes --container "$name" --image "$image"; then
                rc=0
            else
                rc=$?
            fi
        else
            if toolbox create --assumeyes --container "$name" --image "$image"; then
                rc=0
            else
                rc=$?
            fi
        fi
        if (( rc != 0 )); then
            printf 'Error: Toolbox creation failed (exit code %d).\n' "$rc" >&2
            rm -f -- "$setup_script"
            return "$rc"
        fi
    fi

    printf 'Provisioning logs: %s\n' "$log_file"
    if declare -F run_with_loader >/dev/null 2>&1; then
        if run_with_loader "Provisioning ${name}" \
            bash -c 'toolbox run --container "$1" bash "$2" >"$3" 2>&1' \
            _ "$name" "$setup_script" "$log_file"; then
            rc=0
        else
            rc=$?
        fi
    else
        if toolbox run --container "$name" bash "$setup_script" >"$log_file" 2>&1; then
            rc=0
        else
            rc=$?
        fi
    fi

    rm -f -- "$setup_script"
    if (( rc != 0 )); then
        printf '\nError: Provisioning failed (exit code %d). Last 80 log lines:\n' "$rc" >&2
        tail -n 80 "$log_file" >&2
        printf '\nFull log: %s\n' "$log_file" >&2
        return "$rc"
    fi

    printf '\nToolbox %s is ready.\n' "$name"
    printf 'Enter it with: toolbox enter %q\n' "$name"
    printf 'Provisioning log: %s\n' "$log_file"

    if (( enter_after )); then
        toolbox enter "$name"
        return $?
    fi
}

# top 10 ps result
pstop10(){
   command ps -eo rss,%cpu,ppid,comm | awk '{key=$3"\t"$4; mem[key]+=$1; cpu[key]+=$2} END {for (i in mem) {print mem[i]/1024 " MB\t" cpu[i] "%\t" i}}' | sort -rn | head -n 10
}

# export podman logs
# copy from container
# Copies to your current directory
# podmanexportlogs my-suricata-container
#
# Copies to a specific custom directory
# podmanexportlogs my-suricata-container ~/workspace/suricata-analysis/
podmanexportlogs() {
    # Check for help flags
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Usage Options:"
        echo "  podmanexportlogs <container_name_or_id> [destination_path]"
        echo ""
        echo "Examples:"
        echo "  # Copies to your current directory"
        echo "  podmanexportlogs my-suricata-container"
        echo ""
        echo "  # Copies to a specific custom directory"
        echo "  podmanexportlogs my-suricata-container ~/workspace/suricata-analysis/"
        return 0
    fi

    if [ -z "$1" ]; then
        echo "Error: Please provide the Podman container name or ID."
        echo "Type 'podmanexportlogs --help' for examples."
        return 1
    fi

    local CONTAINER="$1"
    local DEST="${2:-.}"
    local SRC_PATH="/var/log/suricata/"
     
    _terminal_line normal
    _terminal_msg normal "Fetching logs from '$CONTAINER'..."

    # Run podman cp
    if podman cp "${CONTAINER}:${SRC_PATH}" "$DEST"; then
        givemespace
        _terminal_line success
        _terminal_msg success "Successfully copied suricata logs to: $(realpath "$DEST")"
        
        # Give ownership to nonroot users  
        local TARGET_DIR="${DEST%/}/suricata"  
       
        if [ -d "$TARGET_DIR" ]; then
           _terminal_msg normal "Adjusting permissions for $TARGET_DIR..."
           chmod 775 -R "$TARGET_DIR"
           chown kim:kim -R "$TARGET_DIR"
           _terminal_msg success "Done granting access to nonroot users."
        fi
    else
        _terminal_line error
        _terminal_msg error "Failed to copy logs. Please check if the container name is correct and running."
        return 1
    fi
}
# validate policy .json
podpolicyvalidate(){
   _terminal_msg normal "Validate policy.json file"
   python3 -m json.tool /etc/containers/policy.json > /dev/null && echo "Valid JSON"
}

# prune --dry-run and prune ( Destructive ) But intended for recreatable environments. Refer to sretoolbox()
prunecheckandexecute(){
  local prune_all=false
  [[ "$1" == "-a" || "$1" == "--all" ]] && prune_all=true

  echo "=== DRY RUN (podman): Resources eligible for pruning ==="

  echo -e "\n[Stopped Containers]"
  podman ps -a --filter "status=exited" --filter "status=created" \
    --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}"

  echo -e "\n[Orphaned / Dangling Volumes]"
  podman volume ls --filter "dangling=true" --format "table {{.Name}}\t{{.Driver}}"

  echo -e "\n[All Unused Volumes (native --dry-run)]"
  podman volume prune --all --dry-run

  echo -e "\n[Images]"
  if $prune_all; then
    podman images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}"
  else
    podman images --filter "dangling=true" --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}"
  fi

  echo -e "\n[Estimated Reclaimable Space]"
  podman system df

  echo ""
  read -r -p "Proceed with pruning these resources? [Y/n] " reply
  reply=${reply:-Y}

  if [[ "$reply" =~ ^[Yy]$ ]]; then
    podman system prune $( [[ "$prune_all" == true ]] && echo "-a" ) --volumes -f
    podman volume prune --filter "dangling=true" -f
  else
    echo "Prune aborted. Nothing was deleted."
  fi
}
# softaskill
loadsoftaskill(){
  _terminal_msg normal "Loadem up deps"
  getnvm
  _terminal_msg normal "Loadem up"
  npx skills add softaworks/agent-toolkit
}


# Backup firewall config
firewallbackup(){

local backup_root="${1:-/var/home/kim/workspace/firewall/backups/}"

run0 bash -s -- "$backup_root" <<'ROOT_SCRIPT'
set -Eeuo pipefail
umask 077

BACKUP_ROOT="${1:-/var/home/kim/workspace/firewall/backups/}"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
BACKUP_NAME="firewalld-${TIMESTAMP}"
WORK_DIR=""

cleanup() {
    if [[ -n "$WORK_DIR" && -d "$WORK_DIR" ]]; then
        rm -rf -- "$WORK_DIR"
    fi
}
trap cleanup EXIT

for cmd in firewall-cmd tar sha256sum hostname; do
    command -v "$cmd" >/dev/null 2>&1 || {
        echo "ERROR: Missing dependency: $cmd"
        exit 1
    }
done

[[ -d /etc/firewalld ]] || {
    echo "ERROR: /etc/firewalld does not exist."
    exit 1
}

mkdir -p -- "$BACKUP_ROOT"

ARCHIVE="${BACKUP_ROOT%/}/${BACKUP_NAME}.tar.gz"
CHECKSUM="${ARCHIVE}.sha256"

[[ ! -e "$ARCHIVE" ]] || {
    echo "ERROR: Backup archive already exists: $ARCHIVE"
    exit 1
}

WORK_DIR="$(mktemp -d "${BACKUP_ROOT%/}/.${BACKUP_NAME}.XXXXXX")"
mkdir -p "$WORK_DIR/snapshots"

capture() {
    local filename="$1"
    shift

    if "$@" > "$WORK_DIR/snapshots/$filename" 2>&1; then
        echo "[OK] $filename"
    else
        local rc=$?
        echo "[WARNING] $filename failed (exit $rc)"
        printf '\n[Snapshot command failed: exit %s]\n' "$rc" \
            >> "$WORK_DIR/snapshots/$filename"
    fi
}

capture runtime-zones.txt \
    firewall-cmd --list-all-zones

capture runtime-policies.txt \
    firewall-cmd --list-all-policies

capture runtime-active-zones.txt \
    firewall-cmd --get-active-zones

capture permanent-zones.txt \
    firewall-cmd --permanent --list-all-zones

capture permanent-policies.txt \
    firewall-cmd --permanent --list-all-policies

capture permanent-active-zones.txt \
    firewall-cmd --permanent --get-active-zones

{
    echo "Backup date: $(date --iso-8601=seconds)"
    echo "Hostname: $(hostname)"
    echo "Firewalld version: $(firewall-cmd --version)"
    echo "Source: /etc/firewalld"
} > "$WORK_DIR/backup-info.txt"

tar -czf "$ARCHIVE" \
    -C /etc firewalld \
    -C "$WORK_DIR" snapshots backup-info.txt

tar -tzf "$ARCHIVE" >/dev/null

(
    cd "$BACKUP_ROOT"
    sha256sum "$(basename "$ARCHIVE")" \
        > "$(basename "$CHECKSUM")"
    sha256sum --check "$(basename "$CHECKSUM")"
)

echo
echo "Firewalld backup completed."
echo "Archive:  $ARCHIVE"
echo "Checksum: $CHECKSUM"
echo
echo "Inspect archive:"
echo "tar -tzf '$ARCHIVE'"
ROOT_SCRIPT
}

# validate compose.yaml
podvalidatecompose(){
python3 - <<'PY'
import yaml

with open("compose.yaml") as f:
    config = yaml.safe_load(f)

for name, service in config["services"].items():
    build = service.get("build")

    if build is None and "build" in service:
        raise SystemExit(f"ERROR: {name}: build is null")

    if isinstance(build, dict):
        print(f"OK: {name}: {build}")
PY
}

# adb connect to gondar
workspaceadb() {
    local TARGET="${1:-10.1.29.4:5555}"

    # Define the kill switch cleanup routine
    cleanup() {
        echo -e "\n[!] Shutting down ADB connection to $TARGET..."
        adb disconnect "$TARGET" >/dev/null 2>&1
        adb kill-server >/dev/null 2>&1

        # Ensure no lingering adb daemon processes remain
        if pgrep -x "adb" >/dev/null 2>&1; then
            pkill -9 -x "adb" >/dev/null 2>&1
        fi
        _terminal_msg success "[+] ADB connection and server killed."
    }

    # Trap normal exit (EXIT), window close (HUP), Ctrl+C (INT), and termination (TERM)
    trap cleanup EXIT HUP INT TERM

    _terminal_msg normal "[*] Connecting to $TARGET..."
    adb connect "$TARGET"

    _terminal_msg normal "[*] Session active. Type 'exit' or close the window to trigger the kill switch."
    # Launch an interactive subshell; closing it triggers the trap
    bash
}

# adb nuke

workspaceadbkill() {
    local CYAN='\033[0;36m'
    local YELLOW='\033[1;33m'
    local GREEN='\033[0;32m'
    local NC='\033[0m' # No Color

    echo -e "${CYAN}[*] Disconnecting all wireless ADB devices...${NC}"
    adb disconnect >/dev/null 2>&1

    echo -e "${CYAN}[*] Stopping ADB server gracefully...${NC}"
    adb kill-server >/dev/null 2>&1

    # Force-kill any stuck adb processes
    if pgrep -x "adb" >/dev/null 2>&1; then
        echo -e "${YELLOW}[!] Lingering adb processes found. Force killing...${NC}"
        pkill -9 -x "adb" >/dev/null 2>&1
    fi

    echo -e "${GREEN}[+] All ADB connections and processes terminated.${NC}"
}

# kill all ai
killaitools(){
    local CYAN='\033[0;36m'
    local YELLOW='\033[1;33m'
    local GREEN='\033[0;32m'
    local NC='\033[0m' # No Color

    # List of process patterns to terminate
    local TARGETS=("devin" "cline" "cline-app" "cline-cli")

    echo -e "${CYAN}[*] Stopping Devin and Cline processes gracefully...${NC}"
    for proc in "${TARGETS[@]}"; do
        # Build bracketed regex (e.g., [d]evin) so pgrep/pkill doesn't match itself
        local pattern="[${proc:0:1}]${proc:1}"
        pkill -x "$proc" >/dev/null 2>&1
        pkill -f "$pattern" >/dev/null 2>&1
    done

    # Give processes a moment to flush state and exit cleanly
    sleep 1

    # Force-kill any stuck or lingering processes
    local FORCE_KILLED=0
    for proc in "${TARGETS[@]}"; do
        local pattern="[${proc:0:1}]${proc:1}"
        if pgrep -x "$proc" >/dev/null 2>&1 || pgrep -f "$pattern" >/dev/null 2>&1; then
            if [ "$FORCE_KILLED" -eq 0 ]; then
                echo -e "${YELLOW}[!] Lingering processes found. Force killing...${NC}"
                FORCE_KILLED=1
            fi
            pkill -9 -x "$proc" >/dev/null 2>&1
            pkill -9 -f "$pattern" >/dev/null 2>&1
        fi
    done

    echo -e "${GREEN}[+] All Devin and Cline processes terminated.${NC}"
}

# setup firewall
firewallsetup() {
    run0 bash -s << 'FW_EOF'
set -euo pipefail

echo "[*] Resetting firewalld to clean defaults..."
firewall-cmd --complete-reload >/dev/null 2>&1 || true

# ==============================================================================
# 1. INBOUND ZONE: FedoraWorkstation (Strict DROP, No Forwarding, Clean ICMP)
# ==============================================================================
echo "[*] Configuring FedoraWorkstation (Inbound DROP)..."
firewall-cmd --permanent --zone=FedoraWorkstation --add-interface=enp1s0 2>/dev/null || true
firewall-cmd --permanent --zone=trusted --add-interface=lo 2>/dev/null || true
firewall-cmd --permanent --zone=FedoraWorkstation --set-target=DROP
firewall-cmd --permanent --zone=FedoraWorkstation --remove-forward

for svc in $(firewall-cmd --permanent --zone=FedoraWorkstation --list-services); do
    firewall-cmd --permanent --zone=FedoraWorkstation --remove-service="$svc"
done
for prt in $(firewall-cmd --permanent --zone=FedoraWorkstation --list-ports); do
    firewall-cmd --permanent --zone=FedoraWorkstation --remove-port="$prt"
done
firewall-cmd --permanent --zone=FedoraWorkstation --remove-protocol=icmp 2>/dev/null || true

firewall-cmd --permanent --zone=FedoraWorkstation --remove-icmp-block-inversion 2>/dev/null || true
for icmptype in $(firewall-cmd --permanent --zone=FedoraWorkstation --list-icmp-blocks); do
    firewall-cmd --permanent --zone=FedoraWorkstation --remove-icmp-block="$icmptype"
done

# ==============================================================================
# 2. CLEAN UP PUBLIC ZONE (Ensure 8123/tcp & fallback ports stay closed)
# ==============================================================================
echo "[*] Hardening fallback public zone..."
firewall-cmd --permanent --zone=public --set-target=DROP
firewall-cmd --permanent --zone=public --remove-forward
for svc in $(firewall-cmd --permanent --zone=public --list-services); do
    firewall-cmd --permanent --zone=public --remove-service="$svc"
done
for prt in $(firewall-cmd --permanent --zone=public --list-ports); do
    firewall-cmd --permanent --zone=public --remove-port="$prt"
done

# ==============================================================================
# 3. OUTBOUND POLICY: host-to-outbound (DNS, Cloudflare, HTTP, HTTPS, FTP)
# ==============================================================================
echo "[*] Configuring host-to-outbound policy..."
if ! firewall-cmd --permanent --get-policies | grep -qw "host-to-outbound"; then
    firewall-cmd --permanent --new-policy=host-to-outbound
fi

firewall-cmd --permanent --policy=host-to-outbound --set-target=DROP
firewall-cmd --permanent --policy=host-to-outbound --set-priority=-1
firewall-cmd --permanent --policy=host-to-outbound --remove-forward 2>/dev/null || true

firewall-cmd --permanent --policy=host-to-outbound --add-ingress-zone=HOST
firewall-cmd --permanent --policy=host-to-outbound --add-egress-zone=FedoraWorkstation

for svc in dns dns-over-tls http https ntp; do
    firewall-cmd --permanent --policy=host-to-outbound --add-service="$svc" 2>/dev/null || true
done

for prt in 443/udp 853/tcp 7844/tcp 7844/udp; do
    firewall-cmd --permanent --policy=host-to-outbound --add-port="$prt" 2>/dev/null || true
done

# Allow SSH outbound only to 10.1.29.4
firewall-cmd --permanent --policy=host-to-outbound \
    --add-rich-rule='rule family="ipv4" destination address="10.1.29.4" service name="ssh" accept' 2>/dev/null || true

# Allow FTP (21 + passive data ports) strictly to 10.1.29.1 for dufs/rclone
firewall-cmd --permanent --policy=host-to-outbound \
    --add-rich-rule='rule family="ipv4" destination address="10.1.29.1" service name="ftp" accept' 2>/dev/null || true
firewall-cmd --permanent --policy=host-to-outbound \
    --add-rich-rule='rule family="ipv4" destination address="10.1.29.1" port port="1024-65535" protocol="tcp" accept' 2>/dev/null || true

# ==============================================================================
# 4. DIRECT RULES (8022/tcp to 10.1.29.4 & IPS/IDS NFQUEUE Hooks)
# ==============================================================================
echo "[*] Applying direct filter rules and NFQUEUE hooks..."
while read -r line; do
    [[ -n "$line" ]] && firewall-cmd --permanent --direct --remove-rule $line 2>/dev/null || true
done < <(firewall-cmd --permanent --direct --get-all-rules)

firewall-cmd --permanent --direct --add-rule ipv4 filter OUTPUT 0 \
    -p tcp -d 10.1.29.4 --dport 8022 -j ACCEPT

firewall-cmd --permanent --direct --add-rule ipv4 filter OUTPUT 0 \
    -o enp1s0 -m mark '!' --mark 0x1/0x1 -j NFQUEUE --queue-num 0 --queue-bypass
firewall-cmd --permanent --direct --add-rule ipv4 filter INPUT 0 \
    -i enp1s0 -m mark '!' --mark 0x1/0x1 -j NFQUEUE --queue-num 0 --queue-bypass
firewall-cmd --permanent --direct --add-rule ipv6 filter INPUT 0 \
    -i enp1s0 -m mark '!' --mark 0x1/0x1 -j NFQUEUE --queue-num 0 --queue-bypass
firewall-cmd --permanent --direct --add-rule ipv6 filter OUTPUT 0 \
    -o enp1s0 -m mark '!' --mark 0x1/0x1 -j NFQUEUE --queue-num 0 --queue-bypass

# ==============================================================================
# 5. RELOAD & VERIFY
# ==============================================================================
echo "[*] Reloading firewalld..."
firewall-cmd --reload

echo -e "
[+] Firewall recreation complete! Active summary:"
firewall-cmd --zone=FedoraWorkstation --list-all
firewall-cmd --policy=host-to-outbound --list-all
firewall-cmd --direct --get-all-rules
FW_EOF
}

# allow Github SSH
workspacegithubsetup() {
    _log() {
        if declare -f _terminal_msg >/dev/null 2>&1; then
            _terminal_msg "$1" "$2"
        else
            echo "$2"
        fi
    }

    _log normal "Preparing ssh/config for Github"

    if [ ! -d ~/.ssh ]; then
        mkdir -p ~/.ssh && chmod 700 ~/.ssh
        _log success "[+] Created ~/.ssh directory."
    else
        _log normal "[*] ~/.ssh already exists, skipping directory creation."
    fi

    if ! grep -Eq "^[[:space:]]*Host[[:space:]]+github\.com([[:space:]]|$)" ~/.ssh/config 2>/dev/null; then
        printf '\nHost github.com\n    Hostname ssh.github.com\n    Port 443\n    User git\n' >> ~/.ssh/config
        chmod 600 ~/.ssh/config
        _log success "[+] Added GitHub port 443 SSH config."
    else
        _log normal "[*] Host github.com already exists in ~/.ssh/config, skipping."
    fi
}

# Prepare R2 config validation (credentials must be provisioned separately).
cf_prep_r2_config() {
    local env_file="${R2_ENV_FILE:-$HOME/.config/r2.env}"
    local perms owner

    if [[ ! -f "$env_file" ]]; then
        _terminal_msg error "R2 configuration not found: $env_file"
        _terminal_msg normal "Create it outside the repository and populate it securely."
        return 1
    fi

    owner=$(stat -c '%u' -- "$env_file" 2>/dev/null) || return 1
    perms=$(stat -c '%a' -- "$env_file" 2>/dev/null) || return 1

    if [[ "$owner" != "$(id -u)" || "$perms" != "600" ]]; then
        _terminal_msg error "R2 config must be owned by the current user and have mode 600."
        return 1
    fi

    _terminal_msg success "External R2 configuration is present and has secure ownership/permissions."
}

# Pre-commit check, push, and reload of bash configuration

bashconfigci() {
    local repo="$HOME/workspace/ai-stack"
    local target="projects/bash/bashrc_template"
    # Detect literal-looking R2 key assignments, not variable-to-variable references.
    local secret_pattern='^[[:space:]]*(export[[:space:]]+)?R2_(OCI_)?(ACCESS_KEY_ID|SECRET_ACCESS_KEY)[[:space:]]*=[[:space:]]*"[A-Za-z0-9+/=_-]{12,}"'
    local confirm file

    if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        _terminal_msg error "Invalid Git repository: $repo"
        return 1
    fi

    if [[ ! -f "$repo/$target" ]]; then
        _terminal_msg error "Target file not found: $repo/$target"
        return 1
    fi

    _terminal_msg normal "Inspecting target diff."
    git -C "$repo" diff -- "$target" || return 1

    _terminal_msg normal "Scanning tracked files for hardcoded R2 credentials."
    if git -C "$repo" grep -nIE "$secret_pattern" -- .; then
        _terminal_msg error "Potential hardcoded R2 credentials found in tracked files. Aborting."
        return 1
    fi

    _terminal_msg normal "Scanning untracked files for hardcoded R2 credentials."
    while IFS= read -r -d '' file; do
        if grep -nIE "$secret_pattern" "$repo/$file"; then
            _terminal_msg error "Potential hardcoded R2 credentials found in $file. Aborting."
            return 1
        fi
    done < <(git -C "$repo" ls-files --others --exclude-standard -z)

    _terminal_msg success "No hardcoded R2 credential assignments detected."
    _terminal_msg warning "Review the diff carefully. Continue with commit and push?"
    read -r -p "Continue? [y/N]: " confirm

    case "${confirm,,}" in
        y|yes) ;;
        *)
            _terminal_msg warning "Operation cancelled. No commit or push performed."
            run0 workspacekill || return 1
            return 0
            ;;
    esac

    _terminal_msg normal "Getting updates before merging."
    getupdates || return 1

    _terminal_msg normal "Staging target file."
    git -C "$repo" add -- "$target" || return 1

    _terminal_msg normal "Checking staged target file for hardcoded R2 credentials."
    if git -C "$repo" grep --cached -nIE "$secret_pattern" -- "$target"; then
        _terminal_msg error "Hardcoded R2 credentials detected in staged target. Aborting commit."
        git -C "$repo" reset -q -- "$target"
        return 1
    fi

    _terminal_msg normal "Reviewing staged diff."
    git -C "$repo" diff --cached -- "$target" || return 1

    _terminal_msg normal "Committing changes."
    git -C "$repo" commit -m "Improve bash configuration" || return 1

    _terminal_msg normal "Pushing changes to GitHub."
    git -C "$repo" push origin main || return 1

    _terminal_msg success "Changes successfully pushed to GitHub."
    _terminal_msg normal "Cleaning up session."
    run0 workspacekill || return 1
    _terminal_msg success "Done!"
    return 0
}

# Pre-commit check, push, and reload of bash configuration

bashconfigupdate() {
    local REPO="$HOME/workspace/ai-stack"
    local TARGET="projects/bash/bashrc_template"
    local LIVE="$HOME/.bashrc"
    local BACKUP="$HOME/.bashrc.bak"
    local STASH_CREATED=0

    _terminal_msg normal "Starting Bash configuration update."

    # 1. Validate repository and target
    if [[ ! -f "$REPO/$TARGET" ]] ||
       ! git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        _terminal_msg error "Repository or Bash configuration template not found."
        return 1
    fi

    # 2. Validate and load template into current terminal
    _terminal_msg normal "Validating Bash configuration template."

    if ! bash -n "$REPO/$TARGET"; then
        _terminal_msg error "Template syntax validation failed."
        return 1
    fi

    _terminal_msg success "Template syntax valid."

    _terminal_msg normal "Loading new Bash functions into current terminal."

    if ! source "$REPO/$TARGET"; then
        _terminal_msg error "Failed to load Bash configuration template."
        return 1
    fi

    _terminal_msg success "New Bash functions loaded into current terminal."

    # 3. Check for local template changes
    if ! git -C "$REPO" diff --quiet HEAD -- "$TARGET"; then
        _terminal_msg normal "Local configuration changes detected."

        # Connect workspace
        if ! workspaceconnect; then
            _terminal_msg error "Workspace connection failed."
            return 1
        fi

        # Preserve local changes before synchronization
        if ! git -C "$REPO" stash push -m "bashconfigupdate temporary stash" -- "$TARGET"; then
            _terminal_msg error "Failed to preserve local changes."
            return 1
        fi

        STASH_CREATED=1

        # Pull latest changes using fast-forward only
        _terminal_msg normal "Synchronizing with remote repository."

        if ! git -C "$REPO" pull --ff-only origin main; then
            _terminal_msg error "Git synchronization failed. Local changes remain stashed."
            return 1
        fi

        # Restore local modifications
        _terminal_msg normal "Restoring local configuration changes."

        if ! git -C "$REPO" stash pop; then
            _terminal_msg error "Stash restoration failed. Resolve conflicts manually."
            return 1
        fi

        STASH_CREATED=0
    else
        _terminal_msg normal "No local template modifications detected."
    fi

    # 4. Validate Bash syntax
    _terminal_msg normal "Validate syntax."

    if ! bash -n "$REPO/$TARGET"; then
        _terminal_msg error "Syntax failed."
        return 1
    fi

    _terminal_msg success "Syntax valid."

    # 5. Stage configuration changes
    _terminal_msg normal "Stage Bash configuration changes."

    if ! git -C "$REPO" add -- "$TARGET"; then
        _terminal_msg error "Failed to stage configuration."
        return 1
    fi

    # 6. Commit and push
    if ! git -C "$REPO" diff --cached --quiet -- "$TARGET"; then
        _terminal_msg normal "Push changes."

        if ! git -C "$REPO" commit -m "Changes to bash configuration"; then
            _terminal_msg error "Git commit failed."
            return 1
        fi

        if ! git -C "$REPO" push origin main; then
            _terminal_msg error "Failed to push. Please investigate."
            return 1
        fi

        _terminal_msg success "Successfully pushed the changes."
    else
        _terminal_msg normal "No new changes to commit."
    fi

    # 7. Back up existing configuration
    _terminal_msg normal "Backing up existing Bash configuration."

    if [[ -f "$LIVE" ]]; then
        if ! cp -p "$LIVE" "$BACKUP"; then
            _terminal_msg error "Failed to back up existing configuration."
            return 1
        fi
    fi
    
    
    # 8. Deploy configuration
    _terminal_msg normal "Loading Bash configuration."

    if ! cp -f "$REPO/$TARGET" "$LIVE"; then
        _terminal_msg error "Failed to deploy Bash configuration."
        return 1
    fi

    if ! source "$LIVE"; then
        _terminal_msg error "Failed to load configuration. Backup: $BACKUP"
        return 1
    fi
    _terminal_msg success "Bash configuration loaded."

    # 9. Cleaning up session
    _terminal_msg normal "Cleaning up sessions"
    run0 workspacekill
    _terminal_msg success "Session closed. Restarting terminal."
   
    # 10. Restart interactive Bash
    exec bash
}


# Guide on how to update bash config using bashconfigupdate()
bashconfighelp(){
    cat <<'MANPAGE'
BASHCONFIGHELP(1)              User Commands              BASHCONFIGHELP(1)

NAME
    bashconfighelp - Display the Bash configuration management guide

SYNOPSIS
    bashconfighelp

DESCRIPTION
    Provides the recommended workflow for validating, loading, deploying,
    and publishing the Bash configuration maintained in the AI Stack
    Git repository.

    The configuration template is the source of truth. The live ~/.bashrc
    should only be updated after successful syntax and configuration checks.

CONFIGURATION
    Repository:
        ~/workspace/ai-stack

    Template:
        ~/workspace/ai-stack/projects/bash/bashrc_template

    Live configuration:
        ~/.bashrc:q;


GUIDE

        bash -n ~/workspace/ai-stack/projects/bash/bashrc_template || return 1

        source ~/workspace/ai-stack/projects/bash/bashrc_template

        declare -F bashconfigupdate

        bashconfigupdate


NOTES
    - Always maintain the repository template as the source of truth.
    - Never commit hardcoded credentials, API keys, or access tokens.
    - Keep external secrets in permission-restricted configuration files.
    - Review Git changes before committing or pushing.
    - Retain the backup of ~/.bashrc until the new configuration is
      verified.
    - bashconfigci handles Git publishing; avoid manually duplicating
      its commit and push operations.
    - getupdates is a separate workspace routine and should only be
      executed when its synchronization behavior is appropriate.

EXIT STATUS
    0    Help displayed successfully.
    1    Invalid invocation or help display failure.

BASHCONFIGHELP(1)              User Commands              BASHCONFIGHELP(1)
MANPAGE
}

# copy from container
# Secureblue ships the podman *remote* client as /usr/bin/podman; no local
# rootless socket can exist (podman.service exits 125). Containers run
# rootless in the podman machine instead.
# -----------------------------------------------------------------------------
# GLOBAL ENVIRONMENT AND ALIASES
# Kept after function definitions so aliases cannot rewrite commands inside them.
# -----------------------------------------------------------------------------

# Export PATH after the early PATH bootstrap and bashrc.d loading.
export PATH

# Default visual and editor
export EDITOR=/usr/bin/vim
export VISUAL=/usr/bin/vim
export BUN_JSC_useJIT=1
export JavaScriptCoreUseJIT=1

# Shell history behavior
export HISTCONTROL=ignoreboth
export HISTIGNORE="passwd:run0*:sudo*:*api_key*:*token*:*secret*:run0edit:workspace*:kses*:shazam*"
export PROMPT_COMMAND="history -a; $PROMPT_COMMAND"

# Automatically log out after 10 minutes of inactivity, unless already readonly.
if [[ "${TMOUT@a}" != *r* ]]; then
    export TMOUT=600
    readonly TMOUT
fi




# Aliases
alias run0='run0 -i'
alias cline='cline --auto-approve'
alias distro='distrobox'
alias tlbx='toolbox'
alias tlbxen='toolbox enter'
alias tlbxli='toolbox list'
alias tlbxcr='toolbox create'
alias ls='ls -alt'
alias run0ctl='run0 systemctl'
alias run0ctlrestart='run0 systemctl restart'
alias run0ctlstart='run0 systemctl start'
alias run0ctlstatus='run0 systemctl status'
alias run0ctlenable='run0 systemctl enable --now'
alias run0ctlstop='run0 systemctl stop'
alias run0journal='run0 journalctl -u'
alias vibe='vibe --continue --yolo'
