# DevOps Case Study — MERN Stack & Python ETL on AWS EKS

Production-grade Kubernetes deployment of a MERN stack web application and a Python ETL job on AWS, built with Terraform, GitHub Actions, Prometheus, and Grafana.

---

## Yönetici Özeti

| Alan | Önceki Durum | Sonraki Durum |
|---|---|---|
| Dağıtım | Manuel, tutarsız | GitHub Actions ile otomatik CI/CD |
| Altyapı | Tanımsız / el ile | Terraform IaC, S3 state, DynamoDB lock |
| Konteyner | Yok | Multi-stage Docker, non-root, minimal imaj |
| Güvenlik | Kimlik doğrulama yok, root süreçler | MongoDB auth, pod securityContext, Secrets |
| Ölçeklendirme | Yok | HPA (CPU %70), topologySpreadConstraints |
| İzleme | Yok | Prometheus + Grafana, e-posta alarmları |
| Testler | Yok | 11 server + 5 Python testi, deploy'u bloke ediyor |

---

## Projeler

### MERN Stack Web Uygulaması
Çalışan kayıtlarını (ad, pozisyon, seviye) yönetmek için CRUD API ve React arayüzü.

- **Frontend:** React → nginx:stable-alpine (port 8080)
- **Backend:** Express.js REST API (port 5050)
- **Veritabanı:** MongoDB 7.0 (StatefulSet, EBS PVC)

### Python ETL
GitHub API'sini saatlik olarak sorgulayan Kubernetes CronJob.

- **Schedule:** `0 * * * *` (her saat başı)
- **Runtime:** python:3.12-slim, non-root

---

## Sistem Mimarisi

```
Browser → ALB → Ingress → client pod (nginx:8080)
                               ↓ proxy /record /healthcheck
                          server pod (node:5050)
                               ↓
                          MongoDB StatefulSet
```

### AWS Kaynakları

| Kaynak | Detay |
|---|---|
| VPC | 3 public + 3 private subnet, NAT Gateway |
| EKS Cluster | Kubernetes 1.29, managed node group (t3.medium × 2, max 4) |
| ECR | mern-client, mern-server, python-etl — imaj taraması aktif |
| ALB | AWS Load Balancer Controller, IRSA ile yetkilendirilmiş |
| EBS CSI Driver | MongoDB PVC için, IRSA ile yetkilendirilmiş |
| S3 + DynamoDB | Terraform remote state ve state lock |

---

## Konteynerizasyon

### Client (React + Nginx)
- **Stage 1:** `node:18-alpine` — `npm ci` + `npm run build`
- **Stage 2:** `nginx:stable-alpine` — yalnızca statik dosyalar kopyalanır (~25 MB)
- Port 8080, UID 101 (non-root), `readOnlyRootFilesystem: true`
- `/var/cache/nginx`, `/var/run`, `/tmp`, `/var/log/nginx` → emptyDir volume

### Server (Express.js)
- **Stage 1:** `npm ci --omit=dev` (yalnızca production bağımlılıkları)
- **Stage 2:** `node:18-alpine`, UID 1001 (nodeuser), `readOnlyRootFilesystem: true`

### Python ETL
- `python:3.12-slim`, UID 1001, `readOnlyRootFilesystem: true`

---

## Kubernetes Orkestrasyon

| Bileşen | Tür | Detay |
|---|---|---|
| MongoDB | StatefulSet | 1 replika, 5 Gi PVC (EBS gp3) |
| Server | Deployment | 2 replika, HPA (CPU %70, max 5) |
| Client | Deployment | 2 replika, HPA (CPU %70, max 5) |
| Python ETL | CronJob | `0 * * * *` |
| Ingress | Ingress | AWS ALB, / → client:8080 |

**RollingUpdate:** `maxUnavailable: 0`, `maxSurge: 1` — sıfır kesinti ile deployment.  
**topologySpreadConstraints:** Pod'lar farklı AZ'lere dağıtılır.

---

## CI/CD Pipeline — GitHub Actions

`cd-mern.yml` ve `cd-python.yml` olmak üzere iki ayrı workflow. Her ikisinde de `deploy` job'u `needs: test` ile bağlıdır — **testler geçmeden deploy başlamaz.**

```
push → main
  └─ test job
       ├─ MongoDB service container (gerçek DB)
       ├─ npm test (11 server testi)
       └─ React build check
            ↓ (geçerse)
  └─ deploy job
       ├─ Docker build + push → ECR (tag: SHA[:8])
       ├─ envsubst → kubectl apply
       └─ kubectl rollout status (timeout: 120s)
```

---

## Test Stratejisi

### Server Testleri (Jest + Supertest) — 11 test
| Test | Beklenen |
|---|---|
| GET /record — boş koleksiyon | `[]` döner |
| POST /record — geçerli kayıt | 204 döner |
| GET /record — oluşturma sonrası | 1 kayıt döner |
| GET /record/:id — mevcut kayıt | 200 döner |
| GET /record/:id — olmayan ID | 404 döner |
| PATCH /record/:id | Güncelleme kalıcı, 200 döner |
| DELETE /record/:id | Silme sonrası 404 döner |
| POST /record — boş body | 400 döner |
| POST /record — eksik alan | 400 döner |
| GET /healthcheck | 200 + `{ok: true}` |
| GET /healthcheck | Content-Type: JSON |

### Python Testleri (pytest) — 5 test
- GitHub API doğru endpoint'i çağırır
- API yanıtı stdout'a yazdırılır
- Geçersiz JSON → exception
- Ağ hatası → exception
- API URL formatı doğrudur

---

## Güvenlik

### Pod securityContext

| Konteyner | runAsUser | readOnlyRootFilesystem | Capabilities | seccompProfile |
|---|---|---|---|---|
| client (nginx) | 101 | true | drop ALL | RuntimeDefault |
| server (node) | 1001 | true | drop ALL | RuntimeDefault |
| mongodb | 999 | false* | drop ALL | RuntimeDefault |
| python-etl | 1001 | true | drop ALL | RuntimeDefault |

*MongoDB data dizinine yazabilmek için false — data EBS PVC'sinde tutulur.

### Gizli Bilgi Yönetimi
- Tüm hassas bilgiler **GitHub Secrets**'ta saklanır
- `envsubst` ile çalışma zamanında Kubernetes Secret'a yazılır
- Kod deposunda hiçbir yerde düz metin parola bulunmaz
- ECR imaj taraması (`scanOnPush`) aktif

### Ağ Güvenliği
- MongoDB ve Server servisleri `ClusterIP` — cluster dışından erişilemez
- ALB Security Group: yalnızca 80/443 dışarıya açık
- Node Security Group: yalnızca ALB'den 8080 ve 5050'ye izin verilmiş

---

## İzleme ve Alarmlama

`kube-prometheus-stack` Helm chart'ı ile Prometheus, Grafana ve Alertmanager kurulmuştur.

### Alarm Kuralları

| Alarm | Tetikleyici | Süre | Önem |
|---|---|---|---|
| HighCPUUsage | CPU > %80 | 5 dk | warning |
| PodCrashLooping | CrashLoopBackOff | 2 dk | critical |
| PodNotReady | Pod ready değil | 5 dk | warning |
| HighMemoryUsage | Bellek > %85 | 10 dk | warning |
| DeploymentReplicasMismatch | İstenen ≠ hazır replika | 5 dk | warning |
| PersistentVolumeFillingUp | PVC > %85 dolu | 10 dk | warning |
| NodeNotReady | Node hazır değil | 5 dk | critical |

**E-posta:** Alertmanager → Gmail SMTP → `musti_kucuk@hotmail.com`

---

## Terraform

Tüm AWS kaynakları Terraform IaC ile tanımlanmıştır.

```
terraform/
├── main.tf          # VPC, EKS, ECR, IAM modülleri
├── variables.tf     # AWS bölgesi, küme adı, node tipi
├── outputs.tf       # cluster_endpoint, ECR URL'leri
├── versions.tf      # Provider kısıtlamaları
└── monitoring.tf    # Prometheus/Grafana Helm release
```

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

---

## Repo Yapısı

```
.
├── mern-project/
│   ├── client/          # React app + Dockerfile + nginx config
│   └── server/          # Express.js API + Dockerfile + tests
├── python-project/      # ETL script + Dockerfile + tests
├── k8s/
│   ├── namespace.yaml
│   ├── mongodb/         # StatefulSet, Service, Secret, PVC
│   ├── server/          # Deployment, Service, HPA, Secret
│   ├── client/          # Deployment, Service, HPA, Ingress
│   ├── python-etl/      # CronJob
│   └── monitoring/      # Prometheus alert rules
├── terraform/           # AWS altyapısı (IaC)
└── .github/workflows/   # cd-mern.yml, cd-python.yml
```
