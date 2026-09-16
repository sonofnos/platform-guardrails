variable "zone_id" {
  description = "Cloudflare zone ID for the domain."
  type        = string
}

variable "record_name" {
  description = "Hostname to point at the origin, e.g. \"app\" for app.example.com."
  type        = string
}

variable "origin_ipv4" {
  description = "Public IPv4 of the origin server (the DigitalOcean droplet)."
  type        = string
}

variable "environment" {
  type = string
}
