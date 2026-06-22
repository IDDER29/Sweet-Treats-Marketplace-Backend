variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "project" {
  description = "Name prefix for all resources"
  type        = string
  default     = "sweet-treats"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones to span (>= 2 for multi-AZ RDS)"
  type        = number
  default     = 2
}

variable "image_tag" {
  description = "Container image tag to deploy (e.g. a git SHA)"
  type        = string
  default     = "latest"
}

variable "api_desired_count" {
  description = "Number of API tasks"
  type        = number
  default     = 2
}

variable "worker_desired_count" {
  description = "Number of queue-worker tasks"
  type        = number
  default     = 1
}

variable "task_cpu" {
  description = "Fargate task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 1024
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage" {
  description = "RDS storage (GiB)"
  type        = number
  default     = 50
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.small"
}

variable "allowed_origins" {
  description = "CORS allowlist passed to the app as ALLOWED_ORIGINS"
  type        = string
  default     = "https://app.sweet-treats.example"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener (in var.region)"
  type        = string
  default     = ""
}
