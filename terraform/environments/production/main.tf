terraform {
  required_version = ">= 1.5"

  # Remote state with locking. A local backend for infra that two engineers
  # might touch is how you get a corrupted state file; this is deliberately
  # not `backend "local"`. Bucket/table are created out of band once, not by
  # this config, since Terraform cannot safely bootstrap its own backend.
  backend "s3" {
    bucket         = "platform-guardrails-tfstate"
    key            = "production/terraform.tfstate"
    region         = "eu-west-2"
    dynamodb_table = "platform-guardrails-tfstate-lock"
    encrypt        = true
  }

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "do_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_zone_id" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "ssh_key_fingerprints" {
  type = list(string)
}

variable "allowed_ssh_cidrs" {
  type = list(string)
}

provider "digitalocean" {
  token = var.do_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "app" {
  source = "../../modules/digitalocean-app"

  environment          = "production"
  vpc_id               = var.vpc_id
  ssh_key_fingerprints = var.ssh_key_fingerprints
  allowed_ssh_cidrs    = var.allowed_ssh_cidrs
  tags                 = ["service:platform-guardrails"]
}

module "dns" {
  source = "../../modules/cloudflare-dns"

  zone_id     = var.cloudflare_zone_id
  record_name = "app"
  origin_ipv4 = module.app.ipv4_address
  environment = "production"
}
