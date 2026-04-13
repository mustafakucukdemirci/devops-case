variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Used in resource names and tags"
  type        = string
  default     = "mern-app"
}

variable "environment" {
  description = "Deployment environment (dev / staging / prod)"
  type        = string
  default     = "prod"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "mern-eks"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.30"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# 3 AZs for HA — matches topologySpreadConstraints in k8s manifests
variable "availability_zones" {
  description = "List of AZs to deploy into"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnet_cidrs" {
  description = "CIDRs for private subnets (EKS nodes)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets (ALB)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "node_instance_types" {
  description = "EC2 instance types for EKS managed node group"
  type        = list(string)
  # t3.small: 2 vCPU / 2 GB — free-tier-eligible; use t3.medium in production
  default     = ["t3.small"]
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 10
}

variable "node_desired_size" {
  type    = number
  default = 3
}

variable "ecr_image_retention_count" {
  description = "Number of images to keep per ECR repository"
  type        = number
  default     = 10
}

variable "grafana_admin_password" {
  description = "Grafana admin password — pass via TF_VAR_grafana_admin_password env var, never hardcode"
  type        = string
  sensitive   = true
}

variable "alertmanager_webhook_url" {
  description = "Slack (or other) incoming webhook URL for Alertmanager notifications"
  type        = string
  sensitive   = true
}

variable "app_domain" {
  description = "Base domain for the application (e.g. example.com)"
  type        = string
}

variable "acm_cert_arn" {
  description = "ACM certificate ARN for HTTPS — must cover app_domain and grafana.app_domain"
  type        = string
}
