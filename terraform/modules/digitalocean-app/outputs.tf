output "droplet_id" {
  value = digitalocean_droplet.app.id
}

output "ipv4_address" {
  description = "Public IPv4. Used by the cloudflare-dns module as the record target, never referenced directly by client-facing DNS."
  value       = digitalocean_droplet.app.ipv4_address
}

output "firewall_id" {
  value = digitalocean_firewall.app.id
}
