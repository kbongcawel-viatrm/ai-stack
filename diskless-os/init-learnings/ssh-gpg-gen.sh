#!/usr/bin/env bash
set -euo pipefail

# --- 1. Gather User Details ---
read -rp "Enter your GitHub Name: " git_name
read -rp "Enter your GitHub Email: " git_email
read -rsp "Enter a passphrase for your keys (Do not leave blank): " key_passphrase
echo ""

ssh_key_name=$(hostname)
ssh_key_path="$HOME/.ssh/$ssh_key_name"

# --- 2. Generate SSH Key (Ed25519) ---
echo "[*] Generating Ed25519 SSH key..."
mkdir -p -m 700 "$HOME/.ssh"

if [[ -f "$ssh_key_path" ]]; then
    echo "[!] $ssh_key_path already exists. Skipping SSH key generation."
else
    ssh-keygen -t ed25519 -C "$git_email" -f "$ssh_key_path" -N "$key_passphrase"
    chmod 600 "$ssh_key_path"
    chmod 644 "${ssh_key_path}.pub"
fi

# --- 3. Generate GPG Key (RSA 4096) ---
echo "[*] Generating 4096-bit RSA GPG key..."
gpg --batch --generate-key <<EOF
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

# Extract the newly created GPG Key ID (Long format)
gpg_key_id=$(gpg --list-secret-keys --keyid-format=long "$git_email" | awk '/sec/{print $2}' | cut -d'/' -f2 | tail -n 1)

# --- 4. Configure Global Git Settings ---
echo "[*] Configuring Git..."
git config --global user.name "$git_name"
git config --global user.email "$git_email"
git config --global user.signingkey "$gpg_key_id"
git config --global commit.gpgsign true
git config --global gpg.program "$(command -v gpg)"

# --- 5. Output Public Keys for GitHub ---
echo ""
echo "========================================================"
echo " SETUP COMPLETE! Copy the keys below into GitHub:"
echo "========================================================"

echo ""
echo "--- 1. SSH PUBLIC KEY (Add to GitHub > Settings > SSH and GPG keys > New SSH key) ---"
cat "${ssh_key_path}.pub"

echo ""
echo "--- 2. GPG PUBLIC KEY (Add to GitHub > Settings > SSH and GPG keys > New GPG key) ---"
gpg --armor --export "$gpg_key_id"

echo ""
echo "--- Test your ssh connection by running command (workspaceagent) to establish SSH agent and wait for the result."

echo ""
echo "[*] Testing SSH keys"
echo "    ssh -T git@github.com"

