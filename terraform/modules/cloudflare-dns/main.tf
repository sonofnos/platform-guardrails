terraform {
  required_version = ">= 1.5"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Proxied (orange-cloud) record: Cloudflare terminates TLS and sits in front of
# the origin, so the origin's real IP is never exposed to a client directly and
# every request gets Cloudflare's WAF and rate limiting before it reaches the box.
resource "cloudflare_record" "app" {
  zone_id = var.zone_id
  name    = var.record_name
  content = var.origin_ipv4
  type    = "A"
  ttl     = 1 # automatic; required and ignored when proxied is true
  proxied = true
}

# Full (strict) mode: Cloudflare validates the origin's certificate rather than
# accepting anything self-signed. Half-open TLS between edge and origin is the
# usual gap in a "we're behind Cloudflare so we're fine" setup.
resource "cloudflare_zone_settings_override" "app" {
  zone_id = var.zone_id

  settings {
    ssl                      = "strict"
    always_use_https         = "on"
    min_tls_version          = "1.2"
    automatic_https_rewrites = "on"
    security_level           = var.environment == "production" ? "high" : "medium"
    browser_check            = "on"
  }
}

# Origin CA certificate: lets the droplet present a Cloudflare-trusted cert
# without a public CA round trip, which is what "strict" mode above requires.
resource "cloudflare_origin_ca_certificate" "app" {
  csr                = tls_cert_request.origin.cert_request_pem
  hostnames          = ["${var.record_name}.${data.cloudflare_zone.app.name}"]
  request_type       = "origin-rsa"
  requested_validity = 5475 # 15 years, the max Cloudflare issues; rotation is handled by re-running this module, not by a shorter cert
}

resource "tls_private_key" "origin" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "origin" {
  private_key_pem = tls_private_key.origin.private_key_pem

  subject {
    common_name = "${var.record_name}.${data.cloudflare_zone.app.name}"
  }
}

data "cloudflare_zone" "app" {
  zone_id = var.zone_id
}
