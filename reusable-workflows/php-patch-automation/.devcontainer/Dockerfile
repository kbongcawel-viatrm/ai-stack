FROM mcr.microsoft.com/devcontainers/python:1-3.11-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl unzip jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspaces/reusable-workflows/php-patch-automation
