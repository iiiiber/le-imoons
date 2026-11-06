---
title: "达梦数据库 DM8 实战部署与 MySQL 迁移指南"
description: "基于麒麟 V10 ARM64 真实环境整理的达梦 DM8 安装、初始化、服务配置、使用方法、注意事项，以及 MySQL 到达梦的完整迁移方案，新手也能跟着操作。"
pubDate: 2026-11-06
category: tech
subcategory: "数据库运维"
tags: ["达梦", "DM8", "数据库", "MySQL", "国产数据库", "麒麟", "ARM64"]
draft: false
---

# 达梦数据库 DM8 实战部署与 MySQL 迁移指南

> 本文基于真实服务器环境整理：
> **172.28.229.88 / Kylin Linux Advanced Server V10 (Halberd) / ARM64 / 鲲鹏 920 / 8 核 14GB 内存**
>  
> 实际部署版本：**DM8**
>  
> 安装目录：`/opt/dmdbms`  
> 数据目录：`/opt/dmdata`  
> 实例名：`DMSERVER`  
> 监听端口：`5236`  
> 服务名：`DmServiceDMSERVER`

这篇文档适合第一次接触达梦数据库的同学。我会按“装、配、用、迁”的顺序讲，尽量把每一步都写清楚，避免只给概念不给命令。

---

## 目录

1. [达梦 DM8 是什么](#1-达梦-dm8-是什么)
2. [安装前准备](#2-安装前准备)
3. [下载安装包](#3-下载安装包)
4. [创建专用用户和目录](#4-创建专用用户和目录)
5. [解压并挂载 ISO](#5-解压并挂载-iso)
6. [命令行安装 DM8](#6-命令行安装-dm8)
7. [初始化数据库实例](#7-初始化数据库实例)
8. [注册 systemd 服务并启动](#8-注册-systemd-服务并启动)
9. [连接验证](#9-连接验证)
10. [日常使用方法](#10-日常使用方法)
11. [注意事项](#11-注意事项)
12. [从 MySQL 迁移到达梦](#12-从-mysql-迁移到达梦)
13. [新手推荐工作流](#13-新手推荐工作流)

---

## 1. 达梦 DM8 是什么

达梦数据库（DM）是国产关系型数据库，语法风格接近 Oracle，也兼容不少 MySQL / PostgreSQL 场景。它常用于信创、政企、金融等对国产化有要求的系统里。

DM8 是当前常见的稳定版本，支持：

- 单机部署
- 主备 / 数据守护
- 读写分离集群
- 逻辑备份 / 物理备份
- SQL 标准语法
- JDBC / ODBC / Python / Go / Java 等驱动
- 图形化管理工具和命令行工具

如果你熟悉 Oracle，上手会很快；如果只熟悉 MySQL，也不会很难，但要注意语法细节。

---

## 2. 安装前准备

### 2.1 系统要求

我这次部署在：

| 项目 | 值 |
| --- | --- |
| 服务器 | `172.28.229.88` |
| 操作系统 | Kylin Linux Advanced Server V10 (Halberd) |
| 架构 | `aarch64` |
| CPU | 鲲鹏 920 |
| 核数 | 8 核 |
| 内存 | 14GB |
| 根分区 | 50GB，安装前剩余 36GB |

达梦 DM8 对资源要求不算极端，但建议至少满足：

- CPU：2 核以上
- 内存：4GB 以上
- 磁盘：20GB 以上
- Linux：CentOS 7+ / Kylin V10 / 麒麟 / 统信等

### 2.2 检查系统信息

先确认架构和系统版本：

```bash
uname -m
cat /etc/os-release
df -h /
free -h
```

我这次得到的关键信息是：

```text
aarch64
Kylin Linux Advanced Server V10 (Halberd)
36G 可用磁盘
14Gi 内存
```

### 2.3 确认 CPU 型号

这一步很重要，因为达梦安装包区分 `x86_64`、`ARM64`、鲲鹏、飞腾、龙芯等。

```bash
lscpu | grep -E "Architecture|Vendor ID|Model name"
```

我这里显示：

```text
Architecture: aarch64
Vendor ID: HiSilicon
Model name: Kunpeng-920
```

所以选择了 **鲲鹏 920 + 麒麟 10 SP1** 对应的安装包。

---

## 3. 下载安装包

### 3.1 官方下载地址

这次使用的是官方直链：

```text
https://download.dameng.com/eco/adapter/DM8/202611/dm8_20261104_HWarm920_kylin10_sp1_64.zip
```

如果你是不同架构，请去达梦官网下载对应版本：

```text
https://eco.dameng.com/download/
```

### 3.2 服务器直接下载

在服务器上执行：

```bash
cd /opt
wget https://download.dameng.com/eco/adapter/DM8/202611/dm8_20261104_HWarm920_kylin10_sp1_64.zip
```

如果服务器没有 `wget`，也可以用 `curl`：

```bash
cd /opt
curl -LO https://download.dameng.com/eco/adapter/DM8/202611/dm8_20261104_HWarm920_kylin10_sp1_64.zip
```

下载完成后检查大小：

```bash
ls -lh /opt/dm8_20261104_HWarm920_kylin10_sp1_64.zip
```

我这里约 **908MB**。

---

## 4. 创建专用用户和目录

达梦不建议直接用 `root` 跑数据库，官方安装器也要求存在 `dmdba` 用户。

### 4.1 创建用户

```bash
id dmdba >/dev/null 2>&1 || useradd -m -s /bin/bash dmdba
```

### 4.2 创建目录

我使用了三个目录：

- `/opt/dmdbms`：安装目录
- `/opt/dmdata`：数据目录
- `/opt/dmarch`：归档目录

创建并授权：

```bash
mkdir -p /opt/dmdbms /opt/dmdata /opt/dmarch
chown -R dmdba:dmdba /opt/dmdbms /opt/dmdata /opt/dmarch
```

### 4.3 调整系统资源限制

安装器提醒打开文件数太小，建议至少 65536。我直接调到了 `655360`：

```bash
printf "%s\n" \
  "dmdba soft nofile 655360" \
  "dmdba hard nofile 655360" \
  "dmdba soft nproc 655360" \
  "dmdba hard nproc 655360" \
  > /etc/security/limits.d/99-dmdba.conf
```

检查是否生效：

```bash
su - dmdba -c "ulimit -n"
```

应输出：

```text
655360
```

---

## 5. 解压并挂载 ISO

### 5.1 解压 ZIP

```bash
mkdir -p /opt/dm8_install
unzip /opt/dm8_20261104_HWarm920_kylin10_sp1_64.zip \
  -d /opt/dm8_install
```

解压后可以看到：

```text
dm8_20261104_HWarm920_kylin10_sp1_64.iso
dm8_20261104_HWarm920_kylin10_sp1_64.iso_SHA256.txt
dm8_20261104_HWarm920_kylin10_sp1_64.README
```

### 5.2 挂载 ISO

```bash
mkdir -p /mnt/dm8_iso
mount -o loop \
  /opt/dm8_install/dm8_20261104_HWarm920_kylin10_sp1_64.iso \
  /mnt/dm8_iso
```

查看内容：

```bash
ls -lh /mnt/dm8_iso
```

你会看到：

```text
DMInstall.bin
DM8 Install.pdf
```

`DMInstall.bin` 就是安装器。

---

## 6. 命令行安装 DM8

### 6.1 进入命令行安装模式

```bash
/mnt/dm8_iso/DMInstall.bin -i
```

第一次会提示选择语言：

```text
[1]: 简体中文
[2]: English
Please select the installer's language [2]:
```

输入：

```text
1
```

然后一路按提示选择：

- 是否输入 Key：`N`
- 是否设置时区：`Y`
- 时区选择：`21`（中国标准时间）
- 安装类型：`1`（典型安装）
- 安装目录：`/opt/dmdbms`
- 确认安装路径：`Y`
- 确认安装：`Y`

安装过程会输出类似：

```text
[INFO] 安装达梦数据库...
[INFO] 安装 基础 模块...
[INFO] 安装 服务器 模块...
[INFO] 安装 客户端 模块...
[INFO] 安装 驱动 模块...
[INFO] 安装 手册 模块...
[INFO] 安装 服务 模块...
[INFO] 安装达梦数据库完成。
```

到这里，软件已经装好，但还没有初始化数据库实例。

---

## 7. 初始化数据库实例

### 7.1 初始化参数

我使用的初始化参数如下：

| 参数 | 值 | 说明 |
| --- | --- | --- |
| `PATH` | `/opt/dmdata` | 数据库存放目录 |
| `DB_NAME` | `DAMENG` | 数据库名 |
| `INSTANCE_NAME` | `DMSERVER` | 实例名 |
| `PORT_NUM` | `5236` | 监听端口 |
| `PAGE_SIZE` | `16` | 页大小 |
| `EXTENT_SIZE` | `32` | 簇大小 |
| `LOG_SIZE` | `1024` | 日志大小，单位 MB |
| `BUFFER` | `4096` | 缓存大小，单位 MB |
| `CHARSET` | `1` | UTF-8 |
| `CASE_SENSITIVE` | `Y` | 大小写敏感 |

### 7.2 初始化命令

用 `dmdba` 用户执行：

```bash
runuser -u dmdba -- /opt/dmdbms/bin/dminit \
  PATH=/opt/dmdata \
  DB_NAME=DAMENG \
  INSTANCE_NAME=DMSERVER \
  PORT_NUM=5236 \
  PAGE_SIZE=16 \
  EXTENT_SIZE=32 \
  LOG_SIZE=1024 \
  BUFFER=4096 \
  CHARSET=1 \
  CASE_SENSITIVE=Y \
  SYSDBA_PWD="你的密码" \
  SYSAUDITOR_PWD="你的密码"
```

成功后会看到：

```text
create dm database success.
```

### 7.3 初始化后的目录

```bash
ls -lh /opt/dmdata/DAMENG
```

常见文件包括：

- `dm.ini`：核心配置文件
- `dm.ctl`：控制文件
- `DAMENG01.log`
- `DAMENG02.log`
- `SYSTEM.DBF`
- `MAIN.DBF`
- `ROLL.DBF`

其中 `dm.ini` 是最常看的配置文件。

---

## 8. 注册 systemd 服务并启动

达梦自带服务注册脚本，位置在：

```text
/opt/dmdbms/script/root/dm_service_installer.sh
```

注册实例服务：

```bash
/opt/dmdbms/script/root/dm_service_installer.sh \
  -t dmserver \
  -p DMSERVER \
  -dm_ini /opt/dmdata/DAMENG/dm.ini
```

成功后会输出：

```text
Created symlink /etc/systemd/system/multi-user.target.wants/DmServiceDMSERVER.service
创建服务(DmServiceDMSERVER)完成
```

### 8.1 启动服务

```bash
systemctl start DmServiceDMSERVER
```

### 8.2 查看状态

```bash
systemctl status DmServiceDMSERVER --no-pager
```

正常状态：

```text
Active: active (running)
Main PID: 955858 (dmserver)
/opt/dmdbms/bin/dmserver path=/opt/dmdata/DAMENG/dm.ini -noconsole
```

### 8.3 设置开机自启

注册脚本默认已经 enabled，也可以手动确认：

```bash
systemctl enable DmServiceDMSERVER
systemctl is-enabled DmServiceDMSERVER
```

输出：

```text
enabled
```

### 8.4 检查端口

```bash
ss -ltnp | grep 5236
```

应看到类似：

```text
LISTEN 0 128 *:5236 *:* users:(("dmserver",pid=955858,fd=4))
```

---

## 9. 连接验证

达梦自带命令行客户端 `disql`。

### 9.1 本机连接

```bash
/opt/dmdbms/bin/disql \
  SYSDBA/"你的密码"@localhost:5236
```

连接成功后会看到版本信息。

### 9.2 测试 SQL

登录后执行：

```sql
SELECT 1;
```

正常输出：

```text
1
-----------
1
```

### 9.3 远程连接

从其他机器连接时，用服务器 IP：

```text
SYSDBA/"你的密码"@172.28.229.88:5236
```

如果连不上，优先检查：

- `5236` 端口是否监听
- 服务器防火墙
- 云服务器安全组
- `dm.ini` 里的监听配置

我这次服务器防火墙是 `inactive`，iptables 默认 `ACCEPT`，所以不需要额外放行。

---

## 10. 日常使用方法

### 10.1 启动、停止、重启

```bash
systemctl start DmServiceDMSERVER
systemctl stop DmServiceDMSERVER
systemctl restart DmServiceDMSERVER
```

### 10.2 查看日志

```bash
journalctl -u DmServiceDMSERVER -f
```

也可以看达梦自己的日志目录：

```bash
ls -lh /opt/dmdbms/log
```

### 10.3 常用 SQL

建表：

```sql
CREATE TABLE users (
  id INT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

插入：

```sql
INSERT INTO users (id, username)
VALUES (1, 'pengfei');
```

查询：

```sql
SELECT * FROM users;
```

更新：

```sql
UPDATE users
SET username = 'new_name'
WHERE id = 1;
```

删除：

```sql
DELETE FROM users
WHERE id = 1;
```

### 10.4 查看版本

```sql
SELECT * FROM V$VERSION;
```

### 10.5 查看当前连接

```sql
SELECT * FROM V$SESSIONS;
```

### 10.6 查看表空间

```sql
SELECT * FROM V$TABLESPACE;
```

### 10.7 查看数据文件

```sql
SELECT * FROM V$DATAFILE;
```

如果你熟悉 Oracle，这些系统视图会很亲切。

---

## 11. 注意事项

### 11.1 页大小不要随手改

`PAGE_SIZE` 初始化后不能随便改。它会影响：

- 单行最大长度
- 索引结构
- 存储行为

一般业务系统用 `16KB` 或 `32KB` 都常见。我这次用的是 `16KB`。

### 11.2 字符集要提前想清楚

我这次用的是 `CHARSET=1`，也就是 UTF-8。

如果你的系统主要面向中文，UTF-8 是比较稳妥的选择。

### 11.3 大小写敏感

我这次用的是 `CASE_SENSITIVE=Y`。

这意味着：

```sql
SELECT * FROM users;
SELECT * FROM USERS;
```

可能被视为不同对象。

如果你从 MySQL 迁移过来，建议先确认应用是否有大小写混用的情况。

### 11.4 License 有效期

安装完成后我看到的提示是：

```text
file dm.key not found, use default license!
License will expire on 2027-11-03
```

这说明当前用的是默认许可。生产环境要提前确认：

- License 是否正式
- 有效期到什么时候
- 并发数、节点数是否满足

### 11.5 备份一定要有

哪怕只是测试环境，也建议至少做逻辑备份。

常用思路：

- 小库：`dexp` / `dimp`
- 大库：物理备份 + 归档
- 关键业务：每天备份 + 异地保存

不要等坏了才想起来没备份。

### 11.6 不要用 root 跑数据库

达梦推荐使用 `dmdba` 专用用户。我这次也是这样做的：

```text
dmdba / dmdba
```

这样权限更清晰，也方便做资源限制。

### 11.7 注意磁盘和内存

达梦会吃内存，尤其是 `BUFFER` 参数。我这次给了 4096MB。

如果服务器内存小，不要盲目调大。建议：

- 4GB 机器：`BUFFER` 512MB ~ 1024MB
- 8GB 机器：`BUFFER` 2048MB ~ 4096MB
- 16GB 机器：`BUFFER` 4096MB ~ 8192MB

### 11.8 安装包架构必须匹配

`x86_64` 包不能装在 `aarch64` 上。一定要先看：

```bash
uname -m
```

---

## 12. 从 MySQL 迁移到达梦

这一部分是很多同学最关心的。下面给一套比较稳的迁移思路。

### 12.1 先明确迁移范围

建议先列清楚：

| 内容 | 是否迁移 |
| --- | --- |
| 表结构 | 必迁 |
| 索引 | 必迁 |
| 视图 | 视情况 |
| 存储过程 | 视情况 |
| 触发器 | 视情况 |
| 定时任务 | 视情况 |
| 数据 | 必迁 |
| 应用连接串 | 必改 |

如果你只是把表和数据迁过去，难度低很多；如果带存储过程和触发器，就要做语法改写。

### 12.2 类型映射

常见的 MySQL → 达梦类型对应关系：

| MySQL | 达梦建议 |
| --- | --- |
| `TINYINT` | `TINYINT` / `SMALLINT` |
| `SMALLINT` | `SMALLINT` |
| `INT` | `INT` |
| `BIGINT` | `BIGINT` |
| `DECIMAL(m,n)` | `DEC(m,n)` |
| `FLOAT` | `FLOAT` |
| `DOUBLE` | `DOUBLE` |
| `VARCHAR(n)` | `VARCHAR(n)` |
| `TEXT` | `TEXT` / `CLOB` |
| `MEDIUMTEXT` | `CLOB` |
| `LONGTEXT` | `CLOB` |
| `BLOB` | `BLOB` |
| `DATE` | `DATE` |
| `DATETIME` | `TIMESTAMP` |
| `TIMESTAMP` | `TIMESTAMP` |
| `JSON` | `VARCHAR` / `CLOB`，或用 JSON 扩展 |
| `ENUM` | `VARCHAR` + 约束 |
| `SET` | `VARCHAR` |

建议：

- 大文本用 `CLOB`
- 二进制用 `BLOB`
- 时间统一用 `TIMESTAMP`
  

### 12.3 语法差异

#### 1. 引号

MySQL 里习惯用反引号：

```sql
SELECT `name` FROM `users`;
```

达梦里一般直接写：

```sql
SELECT name FROM users;
```

如果需要大小写敏感，可以用双引号。

#### 2. 自增

MySQL：

```sql
id INT AUTO_INCREMENT PRIMARY KEY
```

达梦更常见的是用序列，或者建表时使用 IDENTITY：

```sql
id INT IDENTITY(1,1) PRIMARY KEY
```

也可以单独建序列：

```sql
CREATE SEQUENCE seq_users
START WITH 1
INCREMENT BY 1;
```

插入时：

```sql
INSERT INTO users (id, username)
VALUES (seq_users.NEXTVAL, 'pengfei');
```

#### 3. 分页

MySQL：

```sql
SELECT * FROM users LIMIT 10 OFFSET 20;
```

达梦常见写法：

```sql
SELECT * FROM users
LIMIT 20 OFFSET 10;
```

或者使用标准写法：

```sql
SELECT *
FROM (
  SELECT t.*, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM users t
) x
WHERE rn BETWEEN 11 AND 20;
```

#### 4. `ON DUPLICATE KEY UPDATE`

MySQL：

```sql
INSERT INTO users (id, name)
VALUES (1, 'A')
ON DUPLICATE KEY UPDATE name = 'A';
```

达梦可以用 `MERGE INTO`：

```sql
MERGE INTO users t
USING (SELECT 1 AS id, 'A' AS name FROM dual) s
ON (t.id = s.id)
WHEN MATCHED THEN
  UPDATE SET t.name = s.name
WHEN NOT MATCHED THEN
  INSERT (id, name)
  VALUES (s.id, s.name);
```

### 12.4 推荐迁移工具

#### 方案一：达梦 DTS（官方迁移工具）

达梦提供了图形化的数据迁移工具 DTS。适合：

- MySQL → DM8
- Oracle → DM8
- SQL Server → DM8
- CSV / Excel 导入

一般步骤：

1. 打开 DTS
2. 新建迁移工程
3. 选择 MySQL 作为源库
4. 选择 DM8 作为目标库
5. 勾选表、视图、数据
6. 让工具自动做类型映射
7. 执行迁移
8. 校验行数

优点是省事，缺点是遇到复杂存储过程还是要手工改。

#### 方案二：先导 SQL，再手工转换

适合表结构不复杂的系统。

1. 在 MySQL 里导出建表语句
2. 去掉 MySQL 特有语法
3. 转成达梦建表语句
4. 在 DM8 里执行
5. 再导出数据

例如把：

```sql
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

直接删掉。

#### 方案三：CSV 导入

适合只需要数据，不需要复杂对象。

1. MySQL 导出 CSV
2. 达梦用 `dmfldr` 或图形工具导入
3. 校验行数

这种方式最稳，但操作步骤多一点。

### 12.5 迁移后校验

至少要做这几件事：

```sql
-- 查表数量
SELECT COUNT(*) FROM user_tables;

-- 查索引
SELECT * FROM user_indexes;

-- 查视图
SELECT * FROM user_views;
```

再逐表核对：

```sql
SELECT COUNT(*) FROM users;
```

如果允许，可以对比：

- 行数
- 关键字段求和
- 主键数量
- 索引数量
- 最近更新时间

### 12.6 应用侧改动

迁移完成后，应用连接串也要改。

JDBC 示例：

```text
jdbc:dm://172.28.229.88:5236
```

驱动类：

```text
dm.jdbc.driver.DmDriver
```

如果你用的是 ORM，一般只需要：

1. 换 JDBC 驱动
2. 改连接串
3. 改方言
4. 跑单元测试

### 12.7 迁移建议

我的建议是：

1. 先迁结构，不迁数据
2. 手工把建表语句跑通
3. 再迁数据
4. 跑应用
5. 最后迁存储过程和触发器

不要一开始就把所有东西一起搬过去，出了问题很难定位。

---

## 13. 新手推荐工作流

如果你是第一次接触达梦，建议按这个顺序来：

1. 先装好 DM8
2. 用 `disql` 连上去
3. 手工建 2~3 张测试表
4. 练一下增删改查
5. 看懂 `dm.ini`
6. 做一次逻辑备份
7. 再做 MySQL 迁移
8. 最后接入应用

这套流程跑通后，你对达梦的基本使用就不陌生了。

---

## 总结

达梦 DM8 在国产数据库里算是比较容易上手的。只要注意：

- 架构匹配
- 初始化参数
- 大小写敏感
- 字符集
- License
- 备份

基本就能稳定跑起来。

如果你要从 MySQL 迁移，建议先用 DTS 或结构导出把表迁过去，再逐步处理复杂对象。不要想着一口气全自动搞定，稳定比快更重要。

