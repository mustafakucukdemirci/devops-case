# DevOps Case — Sistem Dokümantasyonu

Bu belge, sistemi baştan ayağa kaldırabilmek, yönetebilmek ve sorun giderebilmek için gereken her şeyi kapsar.

---

## İçindekiler

1. [Sistemin Genel Mantığı](#1-sistemin-genel-mantığı)
2. [Projeler ve Ne İş Yaparlar](#2-projeler-ve-ne-iş-yaparlar)
3. [Kullanılan Teknolojiler](#3-kullanılan-teknolojiler)
4. [Sistem Mimarisi](#4-sistem-mimarisi)
5. [Canlı Sistem Bilgileri](#5-canlı-sistem-bilgileri)
6. [Klasör Yapısı](#6-klasör-yapısı)
7. [Docker — Uygulamaları Paketleme](#7-docker--uygulamaları-paketleme)
8. [Kubernetes — Uygulamaları Çalıştırma](#8-kubernetes--uygulamaları-çalıştırma)
9. [Terraform — AWS Altyapısı](#9-terraform--aws-altyapısı)
10. [CI/CD — Otomatik Dağıtım](#10-cicd--otomatik-dağıtım)
11. [İzleme — Prometheus & Grafana](#11-i̇zleme--prometheus--grafana)
12. [Yerel Geliştirme Ortamı](#12-yerel-geliştirme-ortamı)
13. [Sık Kullanılan Komutlar](#13-sık-kullanılan-komutlar)
14. [Sorun Giderme](#14-sorun-giderme)
15. [Sıfırdan Kurulum](#15-sıfırdan-kurulum)

---

## 1. Sistemin Genel Mantığı

Bu sistem iki bağımsız uygulamayı AWS üzerinde çalıştırır:

- **MERN Web Uygulaması** — Kullanıcıların kayıt oluşturduğu, düzenlediği ve sildiği bir web sitesi
- **Python ETL Scripti** — Her saat başı GitHub API'sinden veri çeken ve işleyen otomatik bir görev

### Bir istek sisteme nasıl ulaşır?

```
Kullanıcı tarayıcısı
       ↓
  AWS ALB (Yük Dengeleyici) — tek giriş noktası, trafiği dağıtır
       ↓
  /record, /healthcheck → Express.js Backend (Node.js)
  /                     → React Frontend (nginx)
       ↓
  MongoDB — veritabanı (yalnızca backend erişir, dışarıya kapalı)
```

Kullanıcı hiçbir zaman backend'e veya veritabanına doğrudan ulaşamaz. Her şey ALB üzerinden geçer.

---

## 2. Projeler ve Ne İş Yaparlar

### MERN Web Uygulaması

**MERN** dört teknolojinin baş harflerinden oluşur: **M**ongoDB, **E**xpress, **R**eact, **N**ode.js

| Bileşen | Teknoloji | Görev |
|---------|-----------|-------|
| Frontend (client) | React + nginx | Kullanıcının gördüğü arayüz |
| Backend (server) | Node.js + Express | API, iş mantığı |
| Veritabanı | MongoDB | Kayıtları saklar |

**Uygulama ne yapar?**
- Kayıt oluşturma, listeleme, düzenleme, silme (CRUD işlemleri)
- `/healthcheck` endpoint'i — sistemin sağlıklı çalışıp çalışmadığını bildirir

### Python ETL Scripti

ETL = **E**xtract (çek), **T**ransform (dönüştür), **L**oad (yükle)

- Her saat başı otomatik çalışır
- GitHub API'sinden veri çeker
- İşler ve çıktı üretir
- İşi bitince kapanır (sürekli çalışan bir servis değildir)

---

## 3. Kullanılan Teknolojiler

| Teknoloji | Ne İçin |
|-----------|---------|
| **Docker** | Uygulamaları bağımsız kutular (container) içine paketler. "Bende çalışıyor ama sunucuda çalışmıyor" sorununu ortadan kaldırır |
| **Kubernetes (EKS)** | Bu container'ları AWS'de yönetir. Çökürlerse yeniden başlatır, trafik artarsa yeni kopyalar açar |
| **Terraform** | AWS altyapısını (sunucular, ağ, veritabanı) kod olarak tanımlar. Elle tıklama yapmak yerine dosyadan okuyarak kurar |
| **GitHub Actions** | Kod push'landığında otomatik olarak test eder, paketler ve canlıya alır |
| **Prometheus** | Sistemden her saniye metrik toplar (CPU, bellek, istek sayısı vb.) |
| **Grafana** | Prometheus'tan aldığı metrikleri görsel grafiklere dönüştürür |
| **Amazon ECR** | Docker image'larının depolandığı AWS'nin özel registry'si |
| **Amazon ALB** | Gelen internet trafiğini doğru servise yönlendiren yük dengeleyici |

---

## 4. Sistem Mimarisi

```
                        İNTERNET
                            │
                    ┌───────▼────────┐
                    │   AWS ALB      │  ← Tek dış giriş noktası
                    │  (port 80)     │     internet-facing
                    └───────┬────────┘
                            │
               ┌────────────┼────────────┐
               │                         │
        /record, /healthcheck            /
               │                         │
     ┌─────────▼──────────┐   ┌──────────▼─────────┐
     │  server (3 kopya)  │   │  client (2 kopya)   │
     │  Node.js :5050     │   │  React + nginx :80  │
     └─────────┬──────────┘   └────────────────────┘
               │
     ┌─────────▼──────────┐
     │  MongoDB           │  ← Dışarıya tamamen kapalı
     │  :27017            │
     └────────────────────┘

     ┌────────────────────┐
     │  Python ETL        │  ← Her saat çalışır, biter
     │  (CronJob)         │
     └────────────────────┘

     ┌────────────────────┐
     │  Prometheus        │  ← Metrik toplar
     │  Grafana           │  ← Görselleştirir
     └────────────────────┘
```

### AWS'deki Ağ Yapısı

```
VPC: 10.0.0.0/16 (AWS'deki özel ağımız)
│
├── Public Subnet (10.0.101-103.0/24) — ALB burada, internete açık
│   us-east-1a, 1b, 1c
│
└── Private Subnet (10.0.1-3.0/24) — Pod'lar burada, internete kapalı
    us-east-1a, 1b, 1c
    NAT Gateway üzerinden internete çıkış yapabilirler (image çekme vb.)
```

3 farklı availability zone (veri merkezi) kullanılıyor. Biri çökse diğerleri çalışmaya devam eder.

---

## 5. Canlı Sistem Bilgileri

### Uygulama Adresleri

| Servis | Adres |
|--------|-------|
| **Web Uygulaması** | http://k8s-mernapp-merningr-0484b880f5-58312156.us-east-1.elb.amazonaws.com |
| **Healthcheck API** | http://k8s-mernapp-merningr-0484b880f5-58312156.us-east-1.elb.amazonaws.com/healthcheck |
| **Grafana** | http://a9a3294639282486fbc7871cee8310e4-1178655096.us-east-1.elb.amazonaws.com |

### Grafana Giriş Bilgileri

- Kullanıcı adı: `admin`
- Şifre: `Admin1234!`

### AWS Kaynak Bilgileri

| Kaynak | Değer |
|--------|-------|
| AWS Hesap ID | 858978650586 |
| AWS Region | us-east-1 (N. Virginia) |
| EKS Cluster Adı | mern-eks |
| Kubernetes Versiyonu | 1.30 |
| Node Tipi | t3.small (2 vCPU, 2 GB RAM) |
| Node Sayısı | Min: 2, Maks: 10, Başlangıç: 3 |

### ECR (Docker Image Deposu) Adresleri

```
858978650586.dkr.ecr.us-east-1.amazonaws.com/mern-server
858978650586.dkr.ecr.us-east-1.amazonaws.com/mern-client
858978650586.dkr.ecr.us-east-1.amazonaws.com/python-etl
```

### Terraform State (Altyapı Durum Dosyası)

```
S3 Bucket : mern-app-terraform-state-858978650586
Key        : mern-app/terraform.tfstate
DynamoDB   : terraform-state-lock (eş zamanlı değişiklik kilidi)
```

### GitHub Repository

```
https://github.com/mustafakucukdemirci/devops-case
```

### Çalışan Pod'lar (Anlık Durum)

```
mern-app namespace:
  client-xxx    2/2  Running   — React frontend, 2 kopya
  server-xxx    3/3  Running   — Node.js backend, 3 kopya
  mongodb-0     1/1  Running   — Veritabanı

monitoring namespace:
  grafana       1/1  Running
  prometheus    2/2  Running
  alertmanager  2/2  Running
```

---

## 6. Klasör Yapısı

```
DevOps CASE/
│
├── mern-project/
│   ├── client/                  # React uygulaması
│   │   ├── Dockerfile           # nginx içinde çalışan production build
│   │   ├── nginx.conf           # /record isteklerini backend'e yönlendirir
│   │   └── src/
│   │       ├── config.js        # API base URL ayarı (localhost vs production)
│   │       └── components/      # React bileşenleri
│   │
│   └── server/                  # Node.js API
│       ├── Dockerfile           # Non-root kullanıcıyla çalışan güvenli image
│       ├── app.mjs              # Express app tanımı (test edilebilir)
│       ├── server.mjs           # Sunucuyu başlatan giriş noktası
│       ├── routes/
│       │   ├── record.mjs       # CRUD endpoint'leri
│       │   └── healthcheck.mjs  # /healthcheck endpoint'i
│       └── tests/               # Otomatik testler
│
├── python-project/
│   ├── Dockerfile               # ETL için container tanımı
│   ├── ETL.py                   # GitHub API'den veri çeken script
│   └── tests/                   # Python testleri
│
├── k8s/                         # Kubernetes manifest dosyaları
│   ├── namespace.yaml           # mern-app namespace'i
│   ├── mongodb/
│   │   ├── statefulset.yaml     # MongoDB pod tanımı + disk bağlama
│   │   └── service.yaml         # MongoDB'ye erişim adresi
│   ├── server/
│   │   ├── deployment.yaml      # Backend pod tanımı (3 kopya, sıfır kesinti güncelleme)
│   │   ├── service.yaml         # Backend'e erişim adresi
│   │   ├── hpa.yaml             # Otomatik ölçekleme kuralları
│   │   └── secret.yaml          # MongoDB bağlantı şifresi
│   ├── client/
│   │   ├── deployment.yaml      # Frontend pod tanımı
│   │   ├── service.yaml         # Frontend'e erişim adresi
│   │   └── ingress.yaml         # ALB kuralları (hangi URL nereye gider)
│   ├── python-etl/
│   │   └── cronjob.yaml         # Her saat çalışan ETL görevi
│   └── monitoring/
│       └── alertrules.yaml      # Prometheus alert kuralları
│
├── terraform/                   # AWS altyapı kodu
│   ├── versions.tf              # Terraform ve provider versiyonları, S3 backend
│   ├── variables.tf             # Ayarlanabilir değişkenler
│   ├── main.tf                  # VPC, EKS, ECR, IRSA tanımları
│   └── outputs.tf               # Terraform çıktıları
│
├── .github/
│   └── workflows/
│       ├── ci-mern.yml          # PR'da test çalıştırır
│       ├── cd-mern.yml          # main'e push'ta canlıya alır
│       ├── ci-python.yml        # Python testleri
│       └── cd-python.yml        # Python ETL image'ını canlıya alır
│
└── docker-compose.yml           # Yerel geliştirme ortamı
```

---

## 7. Docker — Uygulamaları Paketleme

Docker, bir uygulamayı bağımlılıklarıyla birlikte içine kapattığı bir "kutu" (container) oluşturur. Bu kutu her yerde aynı şekilde çalışır.

### Server (Backend) Dockerfile Mantığı

İki aşamalı build kullanılır — amaç, production image'ını mümkün olduğunca küçük tutmak:

**Aşama 1 (deps):** Sadece production bağımlılıklarını indir
```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev    # test araçlarını (jest vb.) dahil etme
```

**Aşama 2 (runtime):** Sadece çalışması için gereken dosyaları al
```dockerfile
FROM node:18-alpine
# Güvenlik: root yerine nodeuser (UID 1001) ile çalış
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER nodeuser
CMD ["node", "server.mjs"]
```

### Client (Frontend) Dockerfile Mantığı

```dockerfile
# Aşama 1: React uygulamasını derle
FROM node:18-alpine AS builder
RUN npm ci && npm run build    # /build klasörü oluşur

# Aşama 2: Derlenmiş dosyaları nginx ile sun
FROM nginx:stable-alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

Kullanıcıya sadece statik HTML/CSS/JS dosyaları gider — Node.js bile kullanılmaz production'da.

### nginx.conf'un Rolü

Client container'ı sadece statik dosya sunmaz, aynı zamanda API isteklerini backend'e yönlendirir:

```nginx
upstream api {
    server server:5050;    # Kubernetes içindeki backend servisi
}

# /record veya /healthcheck ile başlayan istekler backend'e gider
location ~ ^/(record|healthcheck) {
    proxy_pass http://api;
}

# Geri kalan her şey React uygulamasına gider
location / {
    try_files $uri /index.html;    # React Router için
}
```

### Python ETL Dockerfile

```dockerfile
FROM python:3.11-slim          # alpine değil slim — C kütüphanesi sorunlarından kaçınmak için
RUN useradd -m -u 1001 appuser # Güvenlik: non-root kullanıcı
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY ETL.py .
USER appuser
CMD ["python", "ETL.py"]       # HEALTHCHECK yok — tek seferlik çalışan iş
```

---

## 8. Kubernetes — Uygulamaları Çalıştırma

Kubernetes (kısaca K8s), container'ları yönetir. "Şu uygulamadan 3 kopya çalışsın, çökürlerse yeniden başlat, trafik artarsa daha fazla aç" gibi kuralları tanımlarsın, gerisini Kubernetes halleder.

### Temel Kavramlar

| Kavram | Açıklama |
|--------|---------|
| **Pod** | Çalışan bir container. En küçük birim |
| **Deployment** | "Bu pod'dan şu kadar kopya çalıştır" tanımı |
| **StatefulSet** | Deployment gibi ama kalıcı disk bağlar (MongoDB için) |
| **Service** | Pod'lara sabit bir iç adres verir. Pod IP'si değişse bile servis adresi değişmez |
| **Ingress** | Dışarıdan gelen trafiği hangi servise yönlendireceğini belirler |
| **HPA** | CPU/bellek yüküne göre pod sayısını otomatik ayarlar |
| **CronJob** | Belirli aralıklarla otomatik çalışan iş tanımı |
| **Namespace** | Kaynakları mantıksal olarak ayıran gruplar. Bizde `mern-app` ve `monitoring` |

### Server Deployment'ının Mantığı

```yaml
replicas: 3                     # Her zaman 3 kopya çalışsın
strategy:
  rollingUpdate:
    maxUnavailable: 0           # Güncelleme sırasında hiç kopya kapatma
    maxSurge: 1                 # Bir ekstra aç, eskiyi kapat (sıfır kesinti)

topologySpreadConstraints:      # 3 kopyayı 3 farklı AWS veri merkezine dağıt
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
```

Yani sunucu güncellenirken bile kullanıcı hiçbir şey fark etmez.

### HPA (Otomatik Ölçekleme)

```yaml
minReplicas: 3                  # En az 3 kopya
maxReplicas: 20                 # En fazla 20 kopya
metrics:
  - CPU %70'i geçerse yeni kopya aç
  - Bellek %80'i geçerse yeni kopya aç
```

Gece trafik düşünce 3'e iner, anlık yoğunlukta 20'ye çıkabilir. Ekstra maliyet yok.

### MongoDB StatefulSet

MongoDB tek kopyalıdır ve kalıcı disk (EBS volume) kullanır. Container silinse bile veriler kaybolmaz:

```yaml
volumeClaimTemplates:
  - storage: 10Gi
    storageClassName: gp3       # AWS EBS SSD diski
```

### Python ETL CronJob

```yaml
schedule: "0 * * * *"          # Her saat başı (00:00, 01:00, 02:00...)
concurrencyPolicy: Forbid       # Bir önceki iş bitmeden yeni başlama
activeDeadlineSeconds: 3300     # 55 dakika içinde bitmezse zorla durdur
backoffLimit: 2                 # Başarısız olursa 2 kez daha dene
```

### Alert Kuralları

Şu durumlar alarm üretir (Grafana/Alertmanager üzerinden izlenir):

| Alert | Koşul |
|-------|-------|
| PodCrashLooping | Bir pod son 15 dakikada 3'ten fazla çöktüyse |
| DeploymentReplicasMismatch | İstenen kopya sayısı ile çalışan uyuşmuyorsa |
| PodNotReady | Pod 5 dakikadır hazır değilse |
| HighCPUUsage | CPU %85'i geçerse |
| HighMemoryUsage | Bellek %85'i geçerse |
| ETLJobFailed | ETL işi son çalışmada başarısız olduysa |
| ETLJobMissed | ETL son 90 dakikadır hiç çalışmadıysa |

---

## 9. Terraform — AWS Altyapısı

Terraform, AWS'deki tüm altyapıyı kod olarak tanımlar. "Hangi sunucu, hangi ağ, hangi veritabanı" bilgileri `.tf` dosyalarında yazılıdır.

### Ne Oluşturuldu?

**VPC (Sanal Özel Ağ)**
- CIDR: 10.0.0.0/16
- 3 public subnet (ALB için)
- 3 private subnet (pod'lar için)
- Her AZ'de bir NAT Gateway (pod'ların internete çıkması için)

**EKS (Kubernetes Kümesi)**
- Cluster adı: mern-eks
- Kubernetes: 1.30
- Node grubu: t3.small, min 2 / max 10 / başlangıç 3
- Node disk: 50 GB gp3 (şifreli)
- Cluster addons: CoreDNS, kube-proxy, vpc-cni, ebs-csi-driver

**ECR (Image Deposu)**
- mern-server, mern-client, python-etl
- Her push'ta güvenlik taraması
- Son 10 image saklanır, eskiler silinir

**IAM Rolleri (IRSA)**
- `mern-eks-ebs-csi-driver` — EBS disk oluşturma yetkisi
- `mern-eks-alb-controller` — Load balancer oluşturma yetkisi

### Terraform Komutları

```bash
cd terraform

# Gerekli modülleri indir
terraform init

# Neyin değişeceğini önizle (hiçbir şey yapmaz)
terraform plan

# Değişiklikleri uygula
terraform apply

# Her şeyi sil (DİKKAT: geri alınamaz)
terraform destroy
```

### State Dosyası Nedir?

Terraform, ne yarattığını bir "state" dosyasında takip eder. Bu dosya S3'te saklanır:
```
s3://mern-app-terraform-state-858978650586/mern-app/terraform.tfstate
```

DynamoDB tablosu (`terraform-state-lock`) ise iki kişinin aynı anda `terraform apply` çalıştırmasını önler.

---

## 10. CI/CD — Otomatik Dağıtım

CI/CD, "Continuous Integration / Continuous Deployment" demek. Koda değişiklik yapıldığında her şeyin otomatik test edilip canlıya alınması sürecidir.

### Ne Zaman Ne Olur?

```
main branch'e push
        │
        ├── MERN CD Workflow tetiklenir (mern-project/ değiştiyse)
        │   1. AWS'e bağlan
        │   2. ECR'e login ol
        │   3. mern-server image'ını build et ve ECR'e push et
        │   4. mern-client image'ını build et ve ECR'e push et
        │   5. EKS cluster'ına bağlan
        │   6. Kubernetes manifest'lerini uygula
        │   7. Alert kurallarını uygula
        │   8. Rollout tamamlanana kadar bekle
        │
        └── Python CD Workflow tetiklenir (python-project/ değiştiyse)
            1-4. Aynı şekilde python-etl image'ını build et ve push et
            5. CronJob manifest'ini güncelle
```

### Pull Request Açıldığında (CI)

Main'e gitmeden önce:
1. Gerçek bir MongoDB container ayağa kalkar
2. `npm test` çalışır — API testleri
3. React build alınır — derleme hatası yoksa geçer
4. Her iki Dockerfile da build edilir — image sorunsuz oluşuyorsa geçer

Testlerden geçemeyen kod main'e merge edilemez.

### Image Tagging

Her deployment farklı bir tag alır:
```
858978650586.dkr.ecr.us-east-1.amazonaws.com/mern-server:575d31da
                                                                 ↑
                                                    Git commit SHA'sının ilk 8 karakteri
```

Hangi deployment'ın hangi koddan geldiği böylece izlenebilir.

### GitHub Actions Secrets

Pipeline'ın çalışması için şu secret'lar tanımlanmış:

| Secret | Değer |
|--------|-------|
| AWS_ACCESS_KEY_ID | IAM kullanıcısı erişim anahtarı |
| AWS_SECRET_ACCESS_KEY | IAM kullanıcısı gizli anahtarı |
| AWS_REGION | us-east-1 |
| ECR_REGISTRY | 858978650586.dkr.ecr.us-east-1.amazonaws.com |
| EKS_CLUSTER_NAME | mern-eks |

---

## 11. İzleme — Prometheus & Grafana

### Prometheus Nedir?

Sistemden her 15 saniyede bir metrik toplar:
- Pod'ların CPU ve bellek kullanımı
- Kaç istek geldi, kaçı hata verdi
- Node'ların sağlık durumu
- ETL job'larının başarı/başarısızlık durumu

### Grafana Nedir?

Prometheus'tan aldığı ham verileri anlaşılır grafiklere dönüştürür.

**Grafana'ya erişim:**
```
http://a9a3294639282486fbc7871cee8310e4-1178655096.us-east-1.elb.amazonaws.com
Kullanıcı adı: admin
Şifre: Admin1234!
```

**Önemli Dashboard'lar:**

Sol menü → Dashboards → Browse:

- `Kubernetes / Compute Resources / Cluster` — Genel küme durumu
- `Kubernetes / Compute Resources / Namespace (Pods)` → mern-app seç → Tüm pod'lar
- `Kubernetes / Compute Resources / Pod` — Belirli bir pod'un detayı
- `Alertmanager` → Aktif alarmlar

---

## 12. Yerel Geliştirme Ortamı

Kod değişikliği yaparken AWS'ye gerek yok. Yerel makinede Docker ile her şeyi ayağa kaldırmak için:

**Gereksinimler:** Docker Desktop kurulu ve çalışıyor olmalı

```bash
# Tüm servisleri başlat (MongoDB, backend, frontend)
docker compose up

# Arka planda başlat
docker compose up -d

# ETL scriptini de dahil et
docker compose --profile etl up

# Logları izle
docker compose logs -f server

# Durdur
docker compose down

# Durdur ve verileri de sil
docker compose down -v
```

Çalışınca:
- Frontend: http://localhost (port 80)
- Backend API: http://localhost:5050/record
- MongoDB: localhost:27017

---

## 13. Sık Kullanılan Komutlar

### Cluster'a Bağlanma

```bash
aws eks update-kubeconfig --region us-east-1 --name mern-eks
```

Bu komut, `kubectl`'in AWS EKS cluster'ımıza bağlanmasını sağlar. Bir kez çalıştırılır.

### Pod Durumunu Görme

```bash
# mern-app namespace'indeki her şey
kubectl get pods -n mern-app

# Monitoring namespace'i
kubectl get pods -n monitoring

# Tüm namespace'ler
kubectl get pods -A
```

### Pod Loglarını İzleme

```bash
# Server logları
kubectl logs -f -l app=server -n mern-app

# Client logları
kubectl logs -f -l app=client -n mern-app

# MongoDB logları
kubectl logs -f mongodb-0 -n mern-app

# ETL job'unun son çalışmasının logları
kubectl logs -n mern-app -l app=python-etl --tail=100
```

### Deployment Güncelleme / Rollback

```bash
# Yeni image'a geç (manuel)
kubectl set image deployment/server server=858978650586.dkr.ecr.us-east-1.amazonaws.com/mern-server:YENİ_TAG -n mern-app

# Rollout durumunu izle
kubectl rollout status deployment/server -n mern-app

# Önceki versiyona geri dön
kubectl rollout undo deployment/server -n mern-app
```

### Yük Dengeleyici (ALB) Adresini Öğrenme

```bash
kubectl get ingress -n mern-app
```

### Otomatik Ölçekleme Durumu

```bash
kubectl get hpa -n mern-app
```

### ETL Job'larını Görme

```bash
# Geçmiş çalışmalar
kubectl get jobs -n mern-app

# ETL'yi manuel tetikle
kubectl create job python-etl-manual --from=cronjob/python-etl -n mern-app
```

### Bir Pod'un İçine Girme

```bash
kubectl exec -it deployment/server -n mern-app -- sh
```

---

## 14. Sorun Giderme

### Pod "ImagePullBackOff" hatası veriyorsa

ECR'den image çekilemiyor demektir.

```bash
# Hatanın detayını gör
kubectl describe pod <POD_ADI> -n mern-app

# Node'un ECR'e erişim yetkisi var mı?
aws iam list-attached-role-policies --role-name <NODE_ROLÜ>
# AmazonEC2ContainerRegistryReadOnly politikası olmalı
```

### Pod "CrashLoopBackOff" hatası veriyorsa

Uygulama başlayıp tekrar tekrar çöküyor.

```bash
# Logları oku
kubectl logs <POD_ADI> -n mern-app --previous
```

### MongoDB'ye bağlanamıyor hatası

```bash
# MongoDB çalışıyor mu?
kubectl get pod mongodb-0 -n mern-app

# Server'ın environment variable'ları doğru mu?
kubectl exec -it deployment/server -n mern-app -- env | grep ATLAS
```

### ALB oluşmadıysa (Ingress'te ADDRESS yok)

```bash
# ALB Controller çalışıyor mu?
kubectl get pods -n kube-system | grep alb

# ALB Controller logları
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

### Terraform "state lock" hatası

Bir önceki `terraform apply` yarım kalmış olabilir.

```bash
# Kilidi zorla kaldır (DİKKAT: başka biri apply yapıyorsa beklenmeli)
terraform force-unlock <LOCK_ID>
```

---

## 15. Sıfırdan Kurulum

Sistemi tamamen sıfırdan kurmak için gereken adımlar:

### Ön Koşullar

- AWS hesabı ve IAM kullanıcısı (yeterli yetkilerle)
- Terraform >= 1.6 kurulu
- kubectl kurulu
- AWS CLI kurulu ve yapılandırılmış (`aws configure`)
- GitHub CLI kurulu (`gh`)
- Helm kurulu

### Adım 1 — Terraform Backend Oluştur (Manuel, Bir Kez)

```bash
# State dosyasının saklanacağı S3 bucket
aws s3 mb s3://mern-app-terraform-state-858978650586 --region us-east-1

# State kilidi için DynamoDB tablosu
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Adım 2 — AWS Altyapısını Kur

```bash
cd terraform
terraform init
terraform apply
```

Bu adım şunları oluşturur: VPC, EKS cluster, ECR repository'leri, IAM rolleri.
Yaklaşık 15-20 dakika sürer.

### Adım 3 — kubectl Yapılandır

```bash
aws eks update-kubeconfig --region us-east-1 --name mern-eks
```

### Adım 4 — EKS Erişim Yetkisi Ver

```bash
# Kullanıcının ARN'ini öğren
aws sts get-caller-identity

# Cluster admin yetkisi ver
aws eks create-access-entry \
  --cluster-name mern-eks \
  --principal-arn <KULLANICI_ARN> \
  --region us-east-1

aws eks associate-access-policy \
  --cluster-name mern-eks \
  --principal-arn <KULLANICI_ARN> \
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
  --access-scope type=cluster \
  --region us-east-1
```

### Adım 5 — StorageClass Ekle

```bash
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  encrypted: "true"
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
EOF
```

### Adım 6 — ALB Controller Kur

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=mern-eks \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=<ALB_IRSA_ROLE_ARN>
```

### Adım 7 — Prometheus & Grafana Kur

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring

helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --set grafana.adminPassword=Admin1234! \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false
```

### Adım 8 — GitHub Repo ve CI/CD Kur

```bash
# GitHub'a giriş
gh auth login

# Repo oluştur ve kodları yükle
cd "DevOps CASE"
git init
git add .
git commit -m "Initial commit"
gh repo create devops-case --private --source=. --remote=origin
git branch -M main

# Secrets ekle
gh secret set AWS_ACCESS_KEY_ID --body "<KEY_ID>"
gh secret set AWS_SECRET_ACCESS_KEY --body "<SECRET_KEY>"
gh secret set AWS_REGION --body "us-east-1"
gh secret set ECR_REGISTRY --body "858978650586.dkr.ecr.us-east-1.amazonaws.com"
gh secret set EKS_CLUSTER_NAME --body "mern-eks"

# Push et — CI/CD otomatik tetiklenir
git push -u origin main
```

### Adım 9 — Grafana'yı Dışarı Aç

```bash
kubectl patch svc kube-prometheus-stack-grafana -n monitoring \
  -p '{"spec": {"type": "LoadBalancer"}}'

# Adresini öğren (2-3 dakika bekle)
kubectl get svc kube-prometheus-stack-grafana -n monitoring
```

---

*Bu sistemde herhangi bir değişiklik yapmak için tek gereken şey: GitHub'daki koda push yapmak. Gerisi otomatik.*
