---
title: "Vastbase（海量数据）数据库运维知识文档：安装、License、增删查改与 FAQ"
description: "基于麒麟 ARM 环境实测整理的 Vastbase G100 运维文档，覆盖安装部署、正式/临时 License 授权、数据库与数据增删查改、备份恢复、日常运维与 13 个常见问题"
pubDate: 2026-09-18
category: tech
subcategory: "数据库运维"
tags: ["Vastbase", "数据库", "运维", "License", "海量数据", "麒麟"]
draft: false
---

# Vastbase（海量数据）数据库运维知识文档

> 本文档基于实际环境 *****.***.***.*****（麒麟 Kylin aarch64）上的 Vastbase G100 实例实操整理。
> 覆盖：安装部署、授权文件（License）使用、数据库与数据增删查改、日常运维、常见问题 FAQ。
> 文中的命令、路径、报错均来自真实操作验证。

---

## 目录

1. [产品与环境概览](#1-产品与环境概览)
2. [安装部署](#2-安装部署)
3. [授权文件（License）使用](#3-授权文件license使用)
4. [启动 / 停止 / 状态管理](#4-启动--停止--状态管理)
5. [数据库与对象管理（增删改查）](#5-数据库与对象管理增删改查)
6. [数据备份与恢复](#6-数据备份与恢复)
7. [日常运维](#7-日常运维)
8. [常见问题 FAQ](#8-常见问题-faq)
9. [与业务项目的联动](#9-与业务项目的联动)

---

## 1. 产品与环境概览

### 1.1 产品简介

Vastbase（海量数据）是基于 openGauss / PostgreSQL 内核打造的企业级关系型数据库，**兼容 PostgreSQL 语法，同时提供部分 Oracle 兼容能力**。本环境为单机部署，未做集群。

### 1.2 本机实例关键信息（务必记住）

| 项目 | 值 |
| --- | --- |
| 版本 | Vastbase G100 V2.2 (Build 19) Release |
| 内核编译 | 2025-12-09，commit 29407 |
| 底层内核版本（PG_VERSION） | 9.2 |
| 系统 | Kylin KY10（aarch64 / ARM64） |
| 安装目录（GAUSSHOME） | `/home/vastbase/local/vastbase`（软链 → `vastbase_29407`） |
| 数据目录（PGDATA） | `/home/vastbase/data/vastbase` |
| 监听端口 | **3306**（默认是 5432，本机改成了 3306） |
| 运行用户 | `vastbase` |
| 数据库超级用户 | `vbadmin` |
| 监听地址 | `listen_addresses='*'`（允许任意 IP） |
| 最大连接数 | `max_connections=500` |
| 连接认证 | 本机 trust（免密），远程 md5（密码） |
| 日志目录 | `/home/vastbase/data/vastbase/pg_log/` |
| 安装包目录 | `/home/vastbase/vastbase-installer/` |
| 业务备份目录 | `/data/dbBackup/20260115/` |

### 1.3 重要目录速查

```bash
/home/vastbase/local/vastbase/bin/       # 所有可执行工具
/home/vastbase/local/vastbase/etc/.lic   # 许可证文件（临时许可证）
/home/vastbase/data/vastbase/            # 数据目录
/home/vastbase/data/vastbase/pg_log/     # 运行日志
/home/vastbase/.Vastbase                 # 环境变量文件（source 后可直接用命令）
/home/vastbase/vastbase-installer/       # 安装器与安装包
/data/dbBackup/20260115/                 # 数据库备份 SQL
```

### 1.4 常用命令速查表

| 功能 | 命令 |
| --- | --- |
| 启动 | `vb_ctl start -D /home/vastbase/data/vastbase` |
| 停止 | `vb_ctl stop -D /home/vastbase/data/vastbase` |
| 重启 | `vb_ctl restart -D /home/vastbase/data/vastbase` |
| 状态 | `vb_ctl status -D /home/vastbase/data/vastbase` |
| 进入命令行 | `gsql -U vbadmin -h 127.0.0.1 -p 3306 -d vastbase` |
| 加载正式许可证 | `vb_licensetool --load=/path/xxx.lic --pgdata=/home/vastbase/data/vastbase` |
| 查看临时许可证 | `vb_licensetool --view-temporary --pgdata=/home/vastbase/data/vastbase` |
| 备份单个库 | `vb_dump -U vbadmin -h 127.0.0.1 -p 3306 -d *** -f out.sql` |
| 全量备份 | `vb_dumpall -U vbadmin -h 127.0.0.1 -p 3306 -f all.sql` |
| 恢复 | `gsql -U vbadmin -h 127.0.0.1 -p 3306 -d *** -f out.sql` |

---

## 2. 安装部署

> 本机为 **ARM64（aarch64）架构 + 麒麟系统**，安装的是 `-ft_2000-no_mot` 版本。
> 安装分两种：**典型安装**（默认参数）和**自定义安装**（手动指定路径/端口/连接数，本机用的是自定义）。

### 2.1 前置条件

- 操作系统：麒麟（Kylin）V10 或兼容 Linux，aarch64（ARM64）架构
- 内存建议 ≥ 8GB（本机共享内存配置 3745MB）
- 磁盘空间：安装包约 250MB，解压后 + 数据目录按需预留
- 需要创建专用系统用户 `vastbase`（安装器通常会引导或需手动创建）
- 确保端口（本机 3306）未被占用

### 2.2 准备安装包

安装包是 tar.gz 压缩包（本机为 `Vastbase-G100-2.2_Build19_29407-Linux-ft_2000-no_mot.tar.gz`，约 249MB）：

```bash
# 解压（会得到 vastbase_installer 可执行文件和 locales 目录）
tar -zxvf Vastbase-G100-2.2_Build19_29407-Linux-ft_2000-no_mot.tar.gz
```

### 2.3 运行安装器（自定义安装示例）

```bash
# 以 vastbase 用户运行安装器
su - vastbase
cd /home/vastbase/vastbase-installer
./vastbase_installer
```

安装过程中按提示选择（本机实际选择如下）：

```
是否需要实例化数据库(Y/N): y

选择安装类型:
  -> 1- 典型安装
     2- 自定义安装
选择: 2

Vastbase软件安装目录（默认 /home/vastbase/local/vastbase）:
  -> /home/vastbase/local/vastbase

数据库目录（默认 /home/vastbase/data/vastbase）:
  -> /home/vastbase/data/vastbase

输入监听端口（默认 5432）:
  -> 3306

输入客户端最大连接数（默认 500）:
  -> 500

输入共享内存大小，单位MB（默认 3745）:
  -> 3745

是否加载正式License(Y/N): n        # 本机选 n，使用临时许可证（注意：临时许可证有有效期！）
```

> **重要提醒**：安装时若选择不加载正式 License（选 n），数据库会生成一个**临时许可证**，
> 有效期通常为 3 个月。到期后数据库将**无法启动**，必须申请正式许可证并加载（见第 3 节）。

### 2.4 配置环境变量（.Vastbase）

本机环境变量写在 `/home/vastbase/.Vastbase`，内容如下：

```bash
export PGPORT=3306
export PGUSER=vastbase
export PGDATA=/home/vastbase/data/vastbase
export LD_LIBRARY_PATH=/home/vastbase/local/vastbase/jre/lib/aarch64:/home/vastbase/local/vastbase/jre/lib/aarch64/server:$LD_LIBRARY_PATH
export GAUSSHOME=/home/vastbase/local/vastbase
export PATH=/home/vastbase/local/vastbase/bin:$PATH
export OM_GPHOME=/home/vastbase/local/omTmp
export LD_LIBRARY_PATH=$OM_GPHOME/lib:$LD_LIBRARY_PATH
export PATH=$OM_GPHOME/script/gspylib/pssh/bin:$OM_GPHOME/script:$PATH
export PYTHONPATH=$OM_GPHOME/lib
export OM_GAUSS_VERSION=2.2.19
export OM_PGHOST=/home/vastbase/local/omTmp/tmp
export OM_GAUSSLOG=/home/vastbase/data/vastbase/pg_log
export OM_GAUSS_ENV=2
export OM_GS_CLUSTER_NAME=dbCluster
```

使用时：

```bash
su - vastbase
source ~/.Vastbase      # 或每次登录自动生效（可加入 .bashrc）
```

### 2.5 初始化数据库（如需重建实例）

若数据目录为空或需要重建（谨慎操作，会丢数据）：

```bash
su - vastbase
source ~/.Vastbase
vb_ctl initdb -D /home/vastbase/data/vastbase
# 或
vb_initdb -D /home/vastbase/data/vastbase --nodename=single_node -E UTF8
```

### 2.6 验证安装

```bash
su - vastbase
source ~/.Vastbase
vastbase --version
# 输出示例: vastbase (Vastbase G100 V2.2 (Build 19) Release)
cat /home/vastbase/data/vastbase/PG_VERSION   # 9.2
```

---

## 3. 授权文件（License）使用

> 这是本机**当前最关键的运维问题**：临时许可证已过期导致数据库无法启动。
> Vastbase 是商业数据库，启动时会强制校验许可证，过期即拒绝启动，**无法绕过**。

### 3.1 许可证类型

| 类型 | 说明 | 有效期 |
| --- | --- | --- |
| 临时许可证 | 安装时未加载正式 License 自动生成 | 通常 3 个月 |
| 正式许可证 | 向海量数据厂商申请/购买 | 按合同（通常 1 年或更长） |

### 3.2 许可证相关文件与工具

- 许可证文件默认路径：`/home/vastbase/local/vastbase/etc/.lic`
- 管理工具：`/home/vastbase/local/vastbase/bin/vb_licensetool`

### 3.3 查看临时许可证信息

```bash
su - vastbase
source ~/.Vastbase
vb_licensetool --view-temporary --pgdata=/home/vastbase/data/vastbase
```

本机实测输出：

```
license info: Customer:'temporary license', Begins On:'2026-01-08 19:16:19',
Expires On:'2026-04-08 19:16:19', MAC:'', Model:'G100', Support Module:'BASIC, VECTOR'
```

> 从输出可以看出有效期。**临时许可证 2026-04-08 已到期**，这就是数据库启动失败的原因。

### 3.4 查看正式许可证详情（不加载）

```bash
vb_licensetool --dump=/path/to/xxx.lic
```

会打印该许可证的客户、有效期、机型、支持模块等信息，用于**加载前核对**是否与数据库机型匹配。

### 3.5 加载正式许可证（核心操作）

```bash
su - vastbase
source ~/.Vastbase
vb_licensetool --load=/path/to/xxx.lic --pgdata=/home/vastbase/data/vastbase
```

- 成功输出：`Success to load license!`
- 加载后再执行 `vb_ctl start` 即可启动
- 许可证与数据库机型不匹配时报错：`The license model and database model do not match`

### 3.6 许可证报错速查

| 报错 | 含义 | 处理 |
| --- | --- | --- |
| `License expired, database start failed` | 许可证已过期 | 向厂商申请新正式许可证并 `--load` |
| `license expired [..] now: ..` | 同样为过期 | 同上 |
| `The license model and database model do not match` | 许可证机型与库不符 | 确认申请的是 G100 / 对应机型 |
| `open license failed: ERROR RSA_public_encrypt error` | 读取/解密许可证失败 | 确认文件是**正式许可证**（.lic），不是临时许可证；检查文件权限 |
| `0 错误：许可证过期，数据库启动失败` | 启动时校验失败 | 先加载新许可证再启动 |

> **经验教训（本机实测）**：机器上 `etc/.lic` 这个文件其实是**临时许可证本身**，
> 不能用 `--load` 去加载它续期；`--load` 需要的是厂商签发的**正式许可证文件**。

### 3.7 如何申请正式许可证

1. 收集数据库信息：机型 `G100`、内核版本 `V2.2 Build 19`、安装目录、数据库名
2. 联系**海量数据（Vastbase）**官方/代理商，提供机器码或实例信息申请 License
3. 拿到 `.lic` 文件后按 3.5 节加载

---

## 4. 启动 / 停止 / 状态管理

### 4.1 启动数据库

```bash
su - vastbase
source ~/.Vastbase
vb_ctl start -D /home/vastbase/data/vastbase
```

正常输出（节选）：

```
the config file /home/vastbase/data/vastbase/postgresql.conf verify success.
```

**若许可证过期**，会看到：

```
0 错误： 许可证过期，数据库启动失败。许可证信息：Customer:'temporary license', ...
```

> 此时必须先处理许可证（见第 3 节），启动不会成功。

### 4.2 停止数据库

```bash
vb_ctl stop -D /home/vastbase/data/vastbase
```

### 4.3 重启数据库

```bash
vb_ctl restart -D /home/vastbase/data/vastbase
```

### 4.4 查看状态

```bash
vb_ctl status -D /home/vastbase/data/vastbase
# 或查看进程
ps -ef | grep vastbase | grep -v grep
# 或查看端口
ss -tlnp | grep 3306
```

正常运行时 `3306` 端口应被 `gaussdb` 进程监听。

### 4.5 开机自启（建议）

数据库默认**不会**随开机启动。可添加到系统服务或 crontab：

```bash
# 方式1：写入 /etc/rc.local 或 systemd service
# 方式2：使用 crontab 开机自启
@reboot su - vastbase -c "source ~/.Vastbase && vb_ctl start -D /home/vastbase/data/vastbase"
```

> 本机历史：`mariadb.service` 是 disabled，Vastbase 是手工启动的，**重启机器后需手动拉起**。

---

## 5. 数据库与对象管理（增删改查）

> Vastbase 客户端为 `gsql`（兼容 psql）。本机实测命令：
> `gsql -U vbadmin -h 127.0.0.1 -p 3306 -d ***`

### 5.1 连接数据库

```bash
# 连接默认库 vastbase
gsql -U vbadmin -h 127.0.0.1 -p 3306 -d vastbase

# 连接业务库 ***（本机主业务库）
gsql -U vbadmin -h 127.0.0.1 -p 3306 -d ***

# 指定密码连接
gsql -U vbadmin -W '密码' -h 127.0.0.1 -p 3306 -d vastbase

# 远程连接
gsql -U vbadmin -W '密码' -h ***.***.***.*** -p 3306 -d vastbase
```

进入 gsql 后的常用内部命令：

```sql
\l           -- 查看所有数据库
\c *** -- 切换数据库
\d           -- 查看当前库所有表
\d 表名       -- 查看表结构
\du          -- 查看用户/角色
\q           -- 退出
```

### 5.2 数据库的增删改查

```sql
-- 增：创建数据库
CREATE DATABASE ***;
CREATE DATABASE demo_db WITH OWNER vbadmin ENCODING 'UTF8';

-- 查：查看所有数据库
SELECT datname FROM pg_database;
-- 或 \l

-- 改：修改数据库（如改属主）
ALTER DATABASE *** OWNER TO vbadmin;

-- 删：删除数据库（注意：不能在有连接时删除）
DROP DATABASE demo_db;
-- 若有连接先断开：
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='demo_db';
```

### 5.3 表（对象）的增删改查

```sql
-- 增：建表
CREATE TABLE users (
  id        BIGSERIAL PRIMARY KEY,
  name      VARCHAR(64) NOT NULL,
  age       INT,
  email     VARCHAR(128),
  created_at TIMESTAMP DEFAULT now()
);

-- 查：查看表
\d users
SELECT * FROM information_schema.tables WHERE table_schema='public';

-- 改：改表结构
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ALTER COLUMN age SET DEFAULT 18;
ALTER TABLE users RENAME COLUMN email TO mail;

-- 删：删表
DROP TABLE users;
```

### 5.4 数据增删改查（DML）

```sql
-- 增（INSERT）
INSERT INTO users (name, age, email) VALUES ('张三', 30, 'zs@example.com');
INSERT INTO users (name, age) VALUES ('李四', 25), ('王五', 28);

-- 查（SELECT）
SELECT * FROM users;
SELECT id, name FROM users WHERE age > 26 ORDER BY age DESC LIMIT 10;

-- 改（UPDATE）
UPDATE users SET age = 31 WHERE name = '张三';

-- 删（DELETE）
DELETE FROM users WHERE name = '王五';

-- 清空（TRUNCATE，速度快，不可按条件）
TRUNCATE TABLE users;
```

### 5.5 索引管理

```sql
CREATE INDEX idx_users_name ON users(name);
DROP INDEX idx_users_name;
```

### 5.6 用户与权限管理

```sql
-- 增：创建用户
CREATE USER app_user WITH PASSWORD 'Strong@123';

-- 授权
GRANT CONNECT ON DATABASE *** TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;

-- 查
SELECT usename FROM pg_user;

-- 改：改密码
ALTER USER app_user WITH PASSWORD 'New@456';

-- 删
DROP USER app_user;
```

> 本机超级用户为 `vbadmin`，远程连接采用 md5 密码认证。

### 5.7 常用运维 SQL

```sql
-- 查看连接
SELECT pid, usename, datname, client_addr, state FROM pg_stat_activity;

-- 杀掉空闲/阻塞连接
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle';

-- 查看表大小
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;

-- 查看库大小
SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;
```

---

## 6. 数据备份与恢复

### 6.1 逻辑备份（单库）

```bash
# 使用 vb_dump（等同 pg_dump）
vb_dump -U vbadmin -h 127.0.0.1 -p 3306 -d *** -f /data/dbBackup/***_$(date +%Y%m%d).sql
```

### 6.2 全量备份（所有库）

```bash
vb_dumpall -U vbadmin -h 127.0.0.1 -p 3306 -f /data/dbBackup/all_$(date +%Y%m%d).sql
```

### 6.3 恢复

```bash
# 恢复单库
gsql -U vbadmin -h 127.0.0.1 -p 3306 -d *** -f /data/dbBackup/***_20260115.sql

# 恢复全量
gsql -U vbadmin -h 127.0.0.1 -p 3306 -d postgres -f /data/dbBackup/all_20260115.sql
```

> 本机实测：恢复业务库就是用 `gsql -U vbadmin -h 127.0.0.1 -p 3306 -d *** -f xxx.sql`。

### 6.4 本机备份情况

本机备份目录 `/data/dbBackup/20260115/`，包含业务库 SQL：

```
***.sql       -- 基础数据
***_bpm.sql                -- 工作流
***_module_system.sql      -- 系统模块
***.sql   -- ***管理
***.sql       -- ***
***.sql    -- ***
databasechangelog_*.sql       -- liquibase 变更记录
system_menu.sql / system_config.sql / system_dict_*.sql
```

### 6.5 备份建议（crontab）

```bash
# 每天凌晨2点备份 *** 库，保留7天
0 2 * * * su - vastbase -c "source ~/.Vastbase && vb_dump -U vbadmin -h 127.0.0.1 -p 3306 -d *** -f /data/dbBackup/***_\$(date +\%Y\%m\%d).sql" && find /data/dbBackup -name '***_*.sql' -mtime +7 -delete
```

---

## 7. 日常运维

### 7.1 查看运行日志

```bash
ls -lt /home/vastbase/data/vastbase/pg_log/          # 按时间列出日志
tail -f /home/vastbase/data/vastbase/pg_log/postgresql-*.log   # 实时跟踪
```

### 7.2 修改配置

配置文件：`/home/vastbase/data/vastbase/postgresql.conf` 和 `pg_hba.conf`

```bash
# 查看当前端口/监听
grep -E "^port|^listen_addresses|^max_connections" /home/vastbase/data/vastbase/postgresql.conf

# 用 vb_guc 在线修改（无需手工编辑）
vb_guc set -c port=3306 -D /home/vastbase/data/vastbase
vb_guc set -c max_connections=500 -D /home/vastbase/data/vastbase
```

> 本机关键配置：`port=3306`、`listen_addresses='*'`、`max_connections=500`。
> 修改后通常需要 `vb_ctl restart` 生效。

### 7.3 连接认证配置（pg_hba.conf）

本机 `pg_hba.conf` 要点：

```
local   all  all  127.0.0.1/32  trust     # 本机免密
host    all  all  0.0.0.0/0     md5       # 远程需密码
```

- 本机 `127.0.0.1` 免密（trust），所以本机工具直接 `-h 127.0.0.1` 不用密码
- 业务服务连接用 md5 认证

### 7.4 健康检查

```bash
# 端口是否监听
ss -tlnp | grep 3306

# 进程是否存活
ps -ef | grep gaussdb | grep -v grep

# 数据库是否可连
vb_isready -h 127.0.0.1 -p 3306 -d vastbase
```

### 7.5 密码找回 / 重置

以本机超级用户 `vbadmin` 通过本机 trust 连接后重置：

```sql
ALTER USER vbadmin WITH PASSWORD '新密码';
```

> 注意：业务服务配置文件里也存有连接密码，改库密码后需同步改业务配置。

### 7.6 空间管理

```bash
# 数据目录占用
du -sh /home/vastbase/data/vastbase
# 磁盘整体情况
df -h
```

---

## 8. 常见问题 FAQ

### Q1：数据库启动报「许可证过期」（本机当前问题）

**现象**：
```
0 错误： 许可证过期，数据库启动失败。许可证信息：Customer:'temporary license', Begins On:'2026-01-08 19:16:19', Expires On:'2026-04-08 19:16:19'
```

**原因**：临时许可证有效期 3 个月，2026-04-08 已到期。

**解决**：向海量数据厂商申请正式许可证，然后：
```bash
su - vastbase
source ~/.Vastbase
vb_licensetool --load=/path/正式许可.lic --pgdata=/home/vastbase/data/vastbase
vb_ctl start -D /home/vastbase/data/vastbase
```

### Q2：业务连数据库报 `Connection to ***.***.***.***:3306 refused`

**原因**：数据库没启动，或 3306 未监听。

**排查**：
```bash
ps -ef | grep gaussdb | grep -v grep   # 无输出 = 没起来
ss -tlnp | grep 3306                    # 无输出 = 没监听
```
**解决**：先处理许可证问题（Q1），再 `vb_ctl start`。

### Q3：如何查看当前用的是正式还是临时许可证？

```bash
vb_licensetool --view-temporary --pgdata=/home/vastbase/data/vastbase
```
若显示 `temporary license` 且有到期时间，说明是临时许可证。

### Q4：机器上有个 `.lic` 文件，用 `--load` 加载失败 / RSA 解密错误？

本机 `etc/.lic` 其实是**临时许可证本身**，不是正式许可证。`--load` 只接受厂商签发的正式 `.lic` 文件。请向厂商索取正式许可证。

### Q5：忘记数据库密码怎么办？

通过本机 trust 认证进入（无需密码）：
```bash
gsql -U vbadmin -h 127.0.0.1 -p 3306 -d vastbase
ALTER USER vbadmin WITH PASSWORD '新密码';
```
改完后同步修改业务系统配置里的数据库密码。

### Q6：如何允许远程连接？

1. 确认 `listen_addresses='*'`（本机已配置）
2. 确认 `pg_hba.conf` 有 `host all all 0.0.0.0/0 md5`
3. 防火墙放行 3306
4. 用 `gsql -U 用户 -W 密码 -h ***.***.***.*** -p 3306 -d 库名` 测试

### Q7：为什么本机连接不用密码，远程要密码？

`pg_hba.conf` 里 `127.0.0.1` 是 `trust`（免密），远程 `0.0.0.0/0` 是 `md5`（需密码）。这是正常配置。

### Q8：删数据库报「有其他会话连接」

先终止连接再删：
```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='要删的库';
DROP DATABASE 要删的库;
```

### Q9：磁盘满了怎么办？

```bash
df -h; du -sh /home/vastbase/data/vastbase
```
清理日志/备份，或扩容。数据库满盘可能导致无法写入甚至无法启动。

### Q10：服务器重启后数据库没起来？

Vastbase 不会自动开机自启（本机验证）。手动：
```bash
su - vastbase -c "source ~/.Vastbase && vb_ctl start -D /home/vastbase/data/vastbase"
```
或配置 systemd/crontab 自启（见 4.5）。

### Q11：修改端口后连不上？

确认 `postgresql.conf` 端口、`pg_hba.conf`、防火墙三者一致，然后重启：
```bash
vb_guc set -c port=3306 -D /home/vastbase/data/vastbase
vb_ctl restart -D /home/vastbase/data/vastbase
ss -tlnp | grep 3306
```

### Q12：如何备份 / 恢复数据库？

见第 6 节。备份用 `vb_dump`/`vb_dumpall`，恢复用 `gsql -f`。

### Q13：许可证快到期怎么提前预防？

- 定期执行 `vb_licensetool --view-temporary` 检查到期时间
- 到期前联系厂商申请正式许可证
- 把检查命令加入巡检脚本

---

## 9. 与业务项目的联动

### 9.1 业务架构（本机）

| 组件 | 端口 | 状态 | 说明 |
| --- | --- | --- | --- |
| Vastbase 数据库 | 3306 | 依赖许可证 | 核心业务库（*** 等） |
| rnacos（docker） | 8848 / 9848 / 10848 | Exited（需启动） | 注册/配置中心 |
| nginx（docker） | 8099 | Up | 前端入口，反代 8080 |
| 业务微服务 | 8080 | 未启动 | 7 个 Java 服务，`service.sh` 管理 |

### 9.2 业务数据库说明

业务库主要为 `***`（***管理），从备份 SQL 可见包含：
系统模块、BPM 工作流、基础数据、***、***、***等模块表。

### 9.3 恢复完整业务的顺序（故障恢复 SOP）

1. **加载正式许可证**（若过期）：
   ```bash
   vb_licensetool --load=/path/正式许可.lic --pgdata=/home/vastbase/data/vastbase
   ```
2. **启动数据库**：
   ```bash
   su - vastbase -c "source ~/.Vastbase && vb_ctl start -D /home/vastbase/data/vastbase"
   ss -tlnp | grep 3306    # 确认监听
   ```
3. **启动 rnacos**：
   ```bash
   docker start nacos
   ss -tlnp | grep 8848    # 确认监听
   ```
4. **启动业务服务**：
   ```bash
   cd /data/project && sh service.sh start all
   ```
5. **验证**：
   ```bash
   ps -ef | grep java | grep -v grep     # 7 个服务进程
   ss -tlnp | grep 8080                  # 后端端口
   curl -sI http://127.0.0.1:8099        # 前端入口
   ```

---

## 附录：本机关键命令一键脚本（供日常使用）

```bash
# 保存为 /root/vb_check.sh 或直接复制执行

# 1) 数据库状态
echo "=== Vastbase 进程 ==="; ps -ef | grep gaussdb | grep -v grep
echo "=== 3306 端口 ==="; ss -tlnp | grep 3306
echo "=== 许可证 ==="
su - vastbase -c "source ~/.Vastbase && vb_licensetool --view-temporary --pgdata=/home/vastbase/data/vastbase"

# 2) 启动数据库（许可证有效时）
# su - vastbase -c "source ~/.Vastbase && vb_ctl start -D /home/vastbase/data/vastbase"

# 3) 常用连接
# gsql -U vbadmin -h 127.0.0.1 -p 3306 -d ***
```

---

*文档整理时间：2026-09-18。基于 ***.***.***.*** 实测环境编写。*
