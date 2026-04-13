output "cluster_name" {
  description = "EKS cluster name — used in CI/CD to configure kubectl"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "configure_kubectl" {
  description = "Run this command to update your local kubeconfig"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "ecr_registry" {
  description = "ECR registry URL — substitute into k8s manifests as ECR_REGISTRY"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "ecr_repository_urls" {
  description = "Per-service ECR URLs"
  value       = { for k, v in aws_ecr_repository.app : k => v.repository_url }
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

# ── Data sources ──────────────────────────────────────────────────────────────
data "aws_caller_identity" "current" {}
