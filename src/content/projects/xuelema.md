---
title: "写了吗？ · xuelema"
slug: xuelema
published: 2026-11-01
order: 140
description: "Android 原生客户端原型：复用官方网页登录态只读同步课程、作业与考试，Room 本地缓存 + 增量刷新，Kotlin / Jetpack Compose / Hilt / Retrofit 技术栈。"
image: ""
status: "developing"
tags:
  - Kotlin
  - Android
  - Jetpack Compose
  - Room
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/1005WM/xuelema"
---

::github{repo="1005WM/xuelema"}

## 项目简介

一个 Android 客户端原型，用来在手机上查看课程、作业与考试信息。做法是直接复用用户主动登录后官方网页的 Cookie，由手机执行同源只读 HTTPS 请求，**不启动本地 Python 服务、不上传 Cookie、不保存密码**；读取流程参考 [xuexitong-cli](https://github.com/DanMo661/xuexitong-cli) 的课程签名与作业状态读取。

## 技术栈

Kotlin + Jetpack Compose / Material 3，Hilt 依赖注入，Room 持久化课程与作业缓存，DataStore 存设置，OkHttp / Retrofit 负责网络，Coroutines / Flow 驱动异步刷新。最低 Android 8.0（API 26），编译与目标 SDK 为 Android 17（API 37），当前版本 **0.3.12**（versionCode 27）。

## 主要设计

- **先缓存后刷新**：首页先展示 Room 缓存，每个账号每次会话自动尝试读取一次，之后依赖手动刷新；课程目录复用 30 分钟、作业列表复用 5 分钟。
- **增量同步**：普通刷新只读取过期或需核对的课程，单项最多 8 秒、后台详情总计 120 秒，遵循 `Retry-After`，遇到 429 或人机验证会暂停。
- **谨慎判定**：考试只排除明确关联到结课或未开放课程的记录，关联不明的保留并标注待确认，不靠标题猜课程；完整性证据不足时只显示「已发现」数量。
- **AI 解题**：仅在用户主动点击后才把题目发送给自行配置的服务。

## 当前状态

已在 Android 15 模拟器完成页面与设备测试，**尚未用真实登录账号和实体手机验证**；合成数据通过不代表兼容所有学校。官方页面属于非公开稳定接口，DOM 改版、签名与风控都可能导致解析失效。仓库 `docs/` 下留有各轮修复与合并核验记录，安装包与验证报告由 GitHub Actions 的 Android verification 工作流生成。
