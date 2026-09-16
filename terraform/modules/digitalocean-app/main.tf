terraform {
  required_version = ">= 1.5"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
    cloudinit = {
      source  = "hashicorp/cloudinit"
      version = "~> 2.3"
    }
  }
}

locals {
  name = "app-${var.environment}"
  tags = concat(var.tags, ["environment:${var.environment}", "managed-by:terraform"])
}

# Cloud-init: creates a non-root deploy user with sudo, disables password auth and
# root SSH login outright, and enables unattended security updates. A droplet
# that only ever accepts key-based, non-root SSH removes the two most common
# ways these boxes get popped within the first week of being online.
data "cloudinit_config" "app" {
  gzip          = false
  base64_encode = false

  part {
    content_type = "text/cloud-config"
    content      = <<-YAML
      #cloud-config
      users:
        - name: deploy
          groups: sudo
          shell: /bin/bash
          sudo: 'ALL=(ALL) NOPASSWD:ALL'
          ssh_authorized_keys: []

      ssh_pwauth: false
      disable_root: true

      package_update: true
      package_upgrade: true
      packages:
        - unattended-upgrades
        - fail2ban
        - ufw

      write_files:
        - path: /etc/ssh/sshd_config.d/99-hardening.conf
          content: |
            PermitRootLogin no
            PasswordAuthentication no
            ChallengeResponseAuthentication no
            X11Forwarding no
            MaxAuthTries 3
            ClientAliveInterval 300
            ClientAliveCountMax 2

      runcmd:
        - ufw default deny incoming
        - ufw default allow outgoing
        - ufw allow OpenSSH
        - ufw allow 443/tcp
        - ufw --force enable
        - systemctl restart ssh
        - systemctl enable fail2ban
        - systemctl start fail2ban
    YAML
  }
}

resource "digitalocean_droplet" "app" {
  name     = local.name
  region   = var.region
  size     = var.droplet_size
  image    = "ubuntu-24-04-x64"
  vpc_uuid = var.vpc_id
  ssh_keys = var.ssh_key_fingerprints
  tags     = local.tags

  # Belt-and-braces on top of the cloud-init hardening: DO's own monitoring agent
  # and automated backups so a compromised or corrupted box is recoverable
  # without depending on anything that lives on the box itself.
  monitoring        = true
  backups           = true
  graceful_shutdown = true
  droplet_agent     = true
  ipv6              = true
  resize_disk       = false

  user_data = data.cloudinit_config.app.rendered

  lifecycle {
    # Rebuilding a running production app box from an image change should
    # never be silent; force a human to explicitly taint/replace it.
    prevent_destroy = false
    ignore_changes  = [image]
  }
}

# Deny-by-default inbound. Everything not explicitly allowed here is dropped,
# not rejected -- a dropped packet gives a port-scanner nothing to work with.
resource "digitalocean_firewall" "app" {
  name        = "${local.name}-fw"
  droplet_ids = [digitalocean_droplet.app.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.allowed_ssh_cidrs
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # No inbound 80 rule: HTTP is redirected to HTTPS at Cloudflare, so the
  # origin never needs to accept it directly. See modules/cloudflare-dns.

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_project_resources" "app" {
  count   = var.environment == "production" ? 1 : 0
  project = var.environment
  resources = [
    digitalocean_droplet.app.urn,
  ]
}
