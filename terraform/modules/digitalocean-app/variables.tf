variable "environment" {
  description = "Deployment environment name, e.g. staging or production. Used to tag and name every resource so blast radius stays scoped."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be \"staging\" or \"production\"."
  }
}

variable "region" {
  description = "DigitalOcean region slug."
  type        = string
  default     = "lon1"
}

variable "droplet_size" {
  description = "DigitalOcean droplet size slug."
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "ssh_key_fingerprints" {
  description = "Fingerprints of SSH keys already registered in the DO account, added to the droplet at creation. No password auth is configured anywhere in this module."
  type        = list(string)
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed to reach port 22. Kept explicit and short on purpose -- an empty or 0.0.0.0/0 default here is how droplets get scanned within minutes of boot."
  type        = list(string)

  validation {
    condition     = length(var.allowed_ssh_cidrs) > 0 && !contains(var.allowed_ssh_cidrs, "0.0.0.0/0")
    error_message = "allowed_ssh_cidrs must be non-empty and must not include 0.0.0.0/0. Restrict to a VPN range or bastion IP."
  }
}

variable "vpc_id" {
  description = "VPC UUID the droplet attaches to, so app traffic never leaves the private network unless it goes through the load balancer."
  type        = string
}

variable "tags" {
  description = "Tags applied to every resource this module creates, for cost attribution and for firewall/monitoring rules that target by tag rather than by ID."
  type        = list(string)
  default     = []
}
