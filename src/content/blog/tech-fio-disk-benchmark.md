---
title: "Fio 磁盘性能测试指南"
description: "从安装到实战，全面讲解 fio 测试磁盘 IOPS、吞吐量、延迟的方法，包含 NVMe / SSD / HDD 测试参数与结果解读。"
pubDate: 2026-07-08
category: tech
tags: ["fio", "Linux", "磁盘测试", "IOPS", "运维"]
draft: false
---

# Fio 磁盘性能测试指南

> 适用环境：Linux (Ubuntu / CentOS / Debian) / fio 3.x
> 编写日期：2026-07-08
> 适用场景：SSD / NVMe / HDD 性能评估、云盘选型、存储压测

---

## 0. 为什么用 fio

fio (Flexible I/O Tester) 是业界标准的磁盘性能测试工具，原因：

- **灵活**：支持十几种引擎，参数可任意组合
- **准确**：直接调用 libaio / io_uring，绕过缓存干扰
- **通用**：Linux / Windows / macOS 全平台
- **权威**：云厂商（AWS / 阿里云 / 腾讯云）官方测试均用 fio

常见误区：用 `dd` 测磁盘。`dd` 只能测顺序写，且受 page cache 影响极大，结果偏差严重。专业测试请用 fio。

---

## 1. 安装

### Ubuntu / Debian

```bash
sudo apt update && sudo apt install -y fio
```

### CentOS / RHEL

```bash
sudo yum install -y fio
# 或
sudo dnf install -y fio
```

### 源码编译（需要最新版时）

```bash
git clone https://github.com/axboe/fio.git
cd fio
./configure
make -j$(nproc)
sudo make install
```

### 验证

```bash
fio --version
# fio-3.36
```

---

## 2. 核心概念

测试前必须理解这几个概念，否则结果会误读。

| 概念 | 说明 |
|------|------|
| **IOPS** | 每秒 I/O 次数，衡量小文件 / 随机读写能力 |
| **吞吐量 (Throughput)** | 每秒传输数据量 (MB/s)，衡量大文件 / 顺序读写能力 |
| **延迟 (Latency)** | 单次 I/O 响应时间 (μs / ms)，衡量响应速度 |
| **队列深度 (iodepth)** | 同时提交的 I/O 请求数，高并发场景需调大 |
| **numjobs** | 并发线程数，模拟多进程负载 |
| **direct=1** | 绕过 page cache，直接读写磁盘（测试真实性能必须开启） |

---

## 3. 基础测试

### 3.1 顺序读写（测吞吐量）

测大文件传输、备份场景的吞吐能力。

```bash
# 顺序写
fio --name=seq-write \
    --filename=/data/fio-test \
    --rw=write \
    --bs=1M \
    --size=10G \
    --direct=1 \
    --numjobs=1 \
    --iodepth=1 \
    --group_reporting

# 顺序读
fio --name=seq-read \
    --filename=/data/fio-test \
    --rw=read \
    --bs=1M \
    --size=10G \
    --direct=1 \
    --numjobs=1 \
    --iodepth=1 \
    --group_reporting
```

**参数解释**：

- `--bs=1M`：块大小 1MB（大块 → 高吞吐）
- `--size=10G`：测试文件 10GB
- `--direct=1`：绕过缓存，测真实磁盘性能
- `--group_reporting`：多 job 时汇总输出

### 3.2 随机读写（测 IOPS）

测数据库、小文件场景的 IOPS。

```bash
# 随机写
fio --name=rand-write \
    --filename=/data/fio-test \
    --rw=randwrite \
    --bs=4k \
    --size=10G \
    --direct=1 \
    --numjobs=1 \
    --iodepth=32 \
    --group_reporting

# 随机读
fio --name=rand-read \
    --filename=/data/fio-test \
    --rw=randread \
    --bs=4k \
    --size=10G \
    --direct=1 \
    --numjobs=1 \
    --iodepth=32 \
    --group_reporting
```

**参数解释**：

- `--bs=4k`：块大小 4KB（小块 → 测 IOPS）
- `--iodepth=32`：队列深度 32，让磁盘满负载
- `--rw=randwrite/randread`：随机读写

### 3.3 混合读写（模拟真实负载）

实际业务多为读写混合（如数据库 70% 读 + 30% 写）。

```bash
fio --name=mixed \
    --filename=/data/fio-test \
    --rw=randrw \
    --rwmixread=70 \
    --bs=4k \
    --size=10G \
    --direct=1 \
    --numjobs=4 \
    --iodepth=32 \
    --group_reporting
```

**参数解释**：

- `--rwmixread=70`：读占比 70%
- `--numjobs=4`：4 个并发线程

---

## 4. 进阶配置

### 4.1 使用配置文件

命令行参数太多时，用 job 文件更清晰。

创建 `fio-test.fio`：

```ini
[global]
ioengine=libaio
direct=1
group_reporting
time_based
runtime=60

[random-write]
filename=/data/fio-test
rw=randwrite
bs=4k
size=10G
numjobs=4
iodepth=32

[random-read]
filename=/data/fio-test
rw=randread
bs=4k
size=10G
numjobs=4
iodepth=32
```

执行：

```bash
fio fio-test.fio
```

### 4.2 测试延迟

关注 `clat` (completion latency) 字段：

```bash
fio --name=lat-test \
    --filename=/data/fio-test \
    --rw=randread \
    --bs=4k \
    --size=10G \
    --direct=1 \
    --numjobs=1 \
    --iodepth=1 \
    --group_reporting
```

`iodepth=1` 时测出的就是单次 I/O 延迟。

### 4.3 io_uring 引擎（Linux 5.1+）

新版 Linux 推荐用 io_uring，性能比 libaio 更好：

```bash
fio --name=io-uring-test \
    --filename=/data/fio-test \
    --rw=randread \
    --bs=4k \
    --size=10G \
    --direct=1 \
    --ioengine=io_uring \
    --numjobs=4 \
    --iodepth=32 \
    --group_reporting
```

---

## 5. 结果解读

fio 输出较长，关注以下几个关键行：

```
rand-write: (groupid=0, jobs=4): err= 0: pid=12345: Mon Jul  8 10:00:00 2026
  write: IOPS=85.2k, BW=332MiB/s (349MB/s)(19.0GiB/60010msec)
    slat (usec): min=2, max=4567, avg= 5.23, stdev= 3.12
    clat (usec): min=120, max=89234, avg=1456.78, stdev=823.45
     lat (usec): min=125, max=89240, avg=1462.01, stdev=823.56
    clat percentiles (usec):
     |  1.00th=[  832],  5.00th=[  968], 10.00th=[ 1064], 20.00th=[ 1208],
     | 30.00th=[ 1304], 40.00th=[ 1384], 50.00th=[ 1456], 60.00th=[ 1544],
     | 70.00th=[ 1640], 80.00th=[ 1752], 90.00th=[ 1928], 95.00th=[ 2128],
     | 99.00th=[ 3120], 99.50th=[ 3728], 99.90th=[ 7488], 99.95th=[ 9888],
     | 99.99th=[26048]
```

### 关键指标对照

| 指标 | 含义 | 关注点 |
|------|------|--------|
| **IOPS** | 每秒 I/O 次数 | 随机读写核心指标 |
| **BW** | 带宽 (MB/s) | 顺序读写核心指标 |
| **slat** | 提交延迟 | fio → 内核的时间，越小越好 |
| **clat** | 完成延迟 | 内核 → 磁盘完成的时间，反映磁盘真实性能 |
| **lat** | 总延迟 | slat + clat，用户感知的响应时间 |
| **P99** | 99 分位延迟 | 长尾延迟，关注稳定性 |

### 常见磁盘性能参考值

| 磁盘类型 | 随机读 IOPS | 随机写 IOPS | 顺序读 MB/s | 延迟 |
|----------|------------|------------|-------------|------|
| **7200rpm HDD** | 100-200 | 100-200 | 100-150 | 5-15ms |
| **SATA SSD** | 50k-100k | 30k-80k | 500-550 | 100-500μs |
| **NVMe SSD** | 200k-500k | 200k-400k | 2000-3500 | 50-150μs |
| **NVMe Gen4** | 500k-1000k | 400k-800k | 5000-7000 | 20-80μs |

---

## 6. 实战场景

### 6.1 云盘选型对比

测试腾讯云 / 阿里云不同云盘型号的真实性能：

```bash
cat > cloud-disk-test.fio << 'EOF'
[global]
ioengine=libaio
direct=1
group_reporting
time_based
runtime=60
size=20G

[rand-read-4k]
filename=/mnt/disk/fio-test
rw=randread
bs=4k
numjobs=4
iodepth=32

[rand-write-4k]
filename=/mnt/disk/fio-test
rw=randwrite
bs=4k
numjobs=4
iodepth=32

[seq-read-1m]
filename=/mnt/disk/fio-test
rw=read
bs=1m
numjobs=1
iodepth=1

[seq-write-1m]
filename=/mnt/disk/fio-test
rw=write
bs=1m
numjobs=1
iodepth=1
EOF

fio cloud-disk-test.fio
```

### 6.2 数据库场景压测

模拟 MySQL / PostgreSQL 负载（4K 随机读写，读写比 7:3）：

```bash
fio --name=db-workload \
    --filename=/data/mysql/fio-test \
    --rw=randrw \
    --rwmixread=70 \
    --bs=4k \
    --size=20G \
    --direct=1 \
    --numjobs=8 \
    --iodepth=64 \
    --group_reporting \
    --time_based \
    --runtime=120
```

### 6.3 检测磁盘是否达到标称值

云厂商标称 IOPS 往往是"峰值"，实际持续性能可能打折：

```bash
# 持续测试 5 分钟，观察性能是否衰减
fio --name=endurance-test \
    --filename=/data/fio-test \
    --rw=randwrite \
    --bs=4k \
    --size=50G \
    --direct=1 \
    --numjobs=4 \
    --iodepth=32 \
    --group_reporting \
    --time_based \
    --runtime=300 \
    --log_avg_msec=1000 \
    --write_bw_log=fio-result
```

生成的 `fio-result_bw.1.log` 可绘制性能随时间变化的曲线。

---

## 7. 注意事项

### 7.1 测试前准备

```bash
# 1. 测试文件要足够大（至少 10G），避免被缓存
# 2. 测试前先填充数据（特别是随机读测试）
fio --name=prep \
    --filename=/data/fio-test \
    --rw=write \
    --bs=1M \
    --size=10G \
    --direct=1

# 3. 测试完清理
rm -f /data/fio-test
```

### 7.2 避免测试生产数据

```bash
# ❌ 危险：直接测有数据的分区
fio --filename=/dev/sda1 --rw=randwrite ...

# ✅ 安全：测挂载点下的测试文件
fio --filename=/data/fio-test --rw=randwrite ...
```

### 7.3 理解缓存影响

| 场景 | 是否测到真实磁盘性能 |
|------|---------------------|
| `direct=1` | ✅ 绕过 page cache，测真实性能 |
| `direct=0` | ❌ 受 page cache 影响，测到内存速度 |
| 云盘 + 缓存 | 可能有分布式缓存层，需长时间测试 |

### 7.4 测试环境对齐

- **CPU 状态**：测试时关闭 CPU 省电模式（`cpupower frequency-set -g performance`）
- **文件系统**：ext4 / xfs 性能有差异，需注明
- **挂载参数**：`noatime` 可减少额外写操作

---

## 8. 速查命令

```bash
# 一键测试（顺序 + 随机）
fio --name=quick \
    --filename=/data/fio-test \
    --rw=randrw --rwmixread=70 \
    --bsrange=4k-1m \
    --size=10G --direct=1 \
    --numjobs=4 --iodepth=32 \
    --group_reporting --runtime=60 --time_based

# 只看关键结果
fio ... | grep -E "IOPS|BW|lat|percentiles"

# JSON 格式输出（方便脚本处理）
fio --output-format=json ... > result.json
```

---

## 9. 总结

| 测试目标 | 块大小 | 读写模式 | 关键指标 |
|----------|--------|---------|---------|
| **吞吐量** | 1M | 顺序读写 | BW (MB/s) |
| **IOPS** | 4k | 随机读写 | IOPS |
| **延迟** | 4k | 随机读写 (iodepth=1) | clat (μs/ms) |
| **稳定性** | 4k | 随机读写 (长时间) | P99 / 性能衰减 |
| **真实负载** | 混合 | randrw (7:3) | 综合 |

记住：**没有"放之四海皆准"的测试参数**，根据你的实际业务场景选择块大小、读写比、并发数，测出来的数据才有参考价值。
