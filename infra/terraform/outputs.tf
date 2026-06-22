output "alb_dns_name" {
  description = "Public ALB hostname — point your DNS (CNAME/ALIAS) here"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "Push images here; deploy by bumping var.image_tag"
  value       = aws_ecr_repository.app.repository_url
}

output "rds_endpoint" {
  description = "Postgres endpoint (private)"
  value       = aws_db_instance.main.address
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint (private)"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "uploads_bucket" {
  description = "S3 bucket for product images"
  value       = aws_s3_bucket.uploads.bucket
}
