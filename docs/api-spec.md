# PeakPick API Specification — OpenAPI 3.0

## 概述

PeakPick 后端是一个 Python FastAPI 服务，为照片管理提供 REST API。

- **基础路径**: `http://localhost:7878/api`
- **格式**: JSON
- **认证**: 无（本地离线应用）
- **评分系统**: 1–5 浮点数，前端通过 `formatScore()` 转为 `3-`/`3`/`3+` 格式

---

## 端点

### `GET /api/photos`

获取照片列表（支持筛选）。

**查询参数**:

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| status | string | `all` | `all` / `pending` / `kept` / `dismissed` |
| score_min | float | 1.0 | 最低评分 |
| score_max | float | 5.0 | 最高评分 |
| date_from | string (ISO) | — | 起始日期 (YYYY-MM-DD) |
| date_to | string (ISO) | — | 结束日期 |
| search | string | — | 文件名搜索 |
| locked | bool | — | 仅锁定照片 |
| sort | string | `date` | `date` / `score` / `filename` |
| order | string | `asc` | `asc` / `desc` |

**响应 `200`**:
```json
{
  "photos": [
    {
      "id": 1,
      "filename": "DSC_00123.NEF",
      "filepath": "/photos/DSC_00123.NEF",
      "score": 3.8,
      "status": "pending",
      "locked": false,
      "group_id": null,
      "date_taken": "2026-03-15",
      "width": 6000,
      "height": 4000,
      "file_size": 24300000,
      "created_at": "2026-05-05T10:00:00Z"
    }
  ],
  "total": 84,
  "filtered": 42
}
```

---

### `GET /api/photos/{id}`

获取单张照片详情。

**响应 `200`**: 同单条 photo 对象。

**响应 `404`**: `{"error": "Photo not found"}`

---

### `POST /api/photos/import/scan`

扫描文件夹，返回待导入文件列表（不写入数据库）。

**请求体**:
```json
{
  "path": "/media/usb/DCIM"
}
```

**响应 `200`**:
```json
{
  "count": 247,
  "date_range": { "min": "2026-01-01", "max": "2026-05-05" },
  "files": ["DSC_00001.NEF", "DSC_00002.NEF", ...]
}
```

---

### `POST /api/photos/import/confirm`

确认导入，将扫描结果写入数据库并触发 AI 评分。

**请求体**:
```json
{
  "path": "/media/usb/DCIM",
  "files": ["DSC_00001.NEF", "DSC_00002.NEF"]
}
```

**响应 `201`**:
```json
{
  "imported": 247,
  "failed": 0,
  "avg_score": 3.2
}
```

---

### `PATCH /api/photos/{id}/score`

用户修正评分。触发在线学习更新模型。

**请求体**:
```json
{
  "score": 4.3
}
```

**响应 `200`**:
```json
{
  "id": 1,
  "old_score": 3.8,
  "new_score": 4.3,
  "model_updated": true
}
```

---

### `POST /api/photos/{id}/lock`

切换锁定状态。

**响应 `200`**:
```json
{
  "id": 1,
  "locked": true
}
```

---

### `PATCH /api/photos/{id}/status`

修改照片状态。

**请求体**:
```json
{
  "status": "kept"
}
```
允许值: `pending`, `kept`, `dismissed`

**响应 `200`**:
```json
{
  "id": 1,
  "status": "kept"
}
```

---

### `POST /api/photos/batch/delete`

批量删除评分低于阈值的照片（排除锁定照片）。

**请求体**:
```json
{
  "score_threshold": 2.5
}
```

**响应 `200`**:
```json
{
  "deleted": 12,
  "skipped_locked": 2,
  "skipped_dismissed": 1
}
```

---

### `POST /api/photos/batch/status`

批量修改照片状态。

**请求体**:
```json
{
  "ids": [1, 2, 3, 5],
  "status": "dismissed"
}
```

**响应 `200`**:
```json
{
  "updated": 4
}
```

---

### `GET /api/scores/distribution`

获取评分分布统计。

**响应 `200`**:
```json
{
  "distribution": [
    { "base": 1, "count": 5, "percentage": 6.0 },
    { "base": 2, "count": 12, "percentage": 14.3 },
    { "base": 3, "count": 28, "percentage": 33.3 },
    { "base": 4, "count": 22, "percentage": 26.2 },
    { "base": 5, "count": 17, "percentage": 20.2 }
  ],
  "avg_score": 3.4,
  "total": 84
}
```

---

### `GET /api/photos/similar`

获取相似组列表。

**响应 `200`**:
```json
{
  "groups": [
    {
      "group_id": 1,
      "desc": "几乎相同的构图，曝光不同",
      "member_ids": [2, 15, 27, 41],
      "best_id": 15,
      "best_score": 4.0
    }
  ]
}
```

---

### `GET /api/ml/status`

ML 后端状态检查。

**响应 `200`**:
```json
{
  "model": "CLIP-ViT-L",
  "backend": "cpu",
  "cuda_available": false,
  "version": "0.1.0",
  "photos_scored": 84,
  "feedback_samples": 12,
  "online_learning": true
}
```

---

## 错误格式

```json
{
  "error": "错误描述",
  "code": "ERROR_CODE",
  "detail": {}
}
```

## 通用状态码

| 状态码 | 含义 |
|---|---|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务内部错误 |
