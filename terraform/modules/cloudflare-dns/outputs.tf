output "fqdn" {
  value = "${var.record_name}.${data.cloudflare_zone.app.name}"
}

output "origin_certificate_pem" {
  value     = cloudflare_origin_ca_certificate.app.certificate
  sensitive = true
}

output "origin_private_key_pem" {
  description = "Never write this to state in a shared backend without encryption at rest -- see docs/SECRETS.md."
  value       = tls_private_key.origin.private_key_pem
  sensitive   = true
}
