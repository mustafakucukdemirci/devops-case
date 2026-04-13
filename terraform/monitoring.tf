# Prometheus/Grafana stack is installed via Helm after Terraform provisions the cluster.
# See: scripts/install-monitoring.sh
#
# This file is intentionally minimal — Terraform manages AWS infrastructure,
# Helm manages Kubernetes workloads. Mixing them requires the kubernetes/helm
# Terraform providers which depend on exec-based auth (fragile on Windows/CI).
