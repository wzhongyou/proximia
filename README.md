# Proximia

从零构建的 Go 向量数据库。

---

**Proximia** 是一个从 0 到 1 自实现的向量数据库引擎，用 Go 编写。
核心算法（HNSW、IVF、BM25）全部手写，零第三方依赖（仅 Go 标准库）。

定位：轻量级、可嵌入、适合私有部署的向量数据库底座。

## 两大关键点

### 1. 全自研核心算法

HNSW 图索引、IVF 聚类索引、BM25 全文检索——每一行代码都手写在 `pkg/proximia/` 下，没有调第三方 ANN 库。

| 算法 | 实现 | 文件 |
|------|------|------|
| HNSW | 多层图遍历、efSearch/efConstruction 调参、双向连接管理 | `hnsw.go` |
| IVF | K-means++ 初始化、倒排列表、nProbe 可调 | `ivf.go` |
| BM25 | Okapi BM25 公式、分词器、增删索引 | `bm25.go` |
| Hybrid | 加权融合 + RRF 两种策略 | `hybrid.go` |

### 2. 生产就绪的单二进制

`go build` 产出单个静态二进制，`docker compose up` 一键启动。

```
# 一行启动
docker compose up -d

# 或直接跑
go run ./cmd/proximia
```

## 能力矩阵

| 维度 | 能力 |
|------|------|
| **索引** | HNSW、IVF、BruteForce（精确搜索） |
| **搜索** | 向量搜索、BM25 全文搜索、混合搜索（向量+文本） |
| **过滤** | eq/range/in/not/exists/text/geo + And/Or/Not 组合器 + 元数据倒排索引预过滤 |
| **度量** | Cosine、Euclidean (L2)、Inner Product |
| **Schema** | 类型化字段（string/float/int/bool/text/geo），写入时校验 |
| **写入** | 单条 Upsert、Batch Upsert、Batch Delete |
| **持久化** | WAL（JSON Lines）、全量快照、WAL 截断 |
| **可观测** | Prometheus 指标、查询耗时、向量计数 |
| **运维** | 健康检查/readiness、API Key 认证、CORS、配置（YAML/env/CLI）、优雅关闭 |
| **控制台** | 8 页面 SPA（Dashboard/Schema/Data/Search/Recall/Index/Explain/API Playground） |
| **部署** | Docker 多阶段构建 ~15MB，docker-compose 一键启动 |
| **依赖** | 零外部依赖（只有 Go 标准库 ~5350 行代码） |

## 快速开始

```bash
# 源码
git clone https://github.com/wzhongyou/proximia.git && cd proximia
go run ./cmd/proximia

# 浏览器打开 http://localhost:8080
```

```bash
# Docker
docker compose up -d
```

## 项目结构

```
├── cmd/proximia/        HTTP 服务（Go embed 嵌入前端）
│   └── web/             控制台前端（HTML/CSS/JS）
├── pkg/proximia/        核心引擎（5350 行自研代码）
│   ├── vector.go        数据库引擎入口
│   ├── index.go          Index 接口定义
│   ├── hnsw.go          HNSW 图索引
│   ├── ivf.go           IVF 聚类索引
│   ├── bm25.go          BM25 全文索引
│   ├── hybrid.go        混合搜索融合
│   ├── schema.go        类型化 Schema
│   ├── filter.go        过滤引擎 + 元数据倒排索引
│   ├── wal.go           WAL 持久化
│   ├── snapshot.go      快照/恢复
│   ├── io.go            导入/导出
│   ├── metrics.go       Prometheus 指标
│   └── config.go        配置管理
├── Dockerfile           ~15MB 多阶段构建
├── docker-compose.yml   单节点部署
└── example_config.yaml  配置示例
```
