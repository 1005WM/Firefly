---
title: "BinaryKeyboard · 二进制宏键盘"
slug: binarykeyboard
published: 2026-10-23
order: 130
description: "开源迷你宏键盘固件项目，提供 CH552G USB 有线版与 CH592F USB / BLE 双模版；本仓库为上游 MeowKJ/BinaryKeyboard 的 fork。"
image: ""
status: "published"
tags:
  - C
  - CH552G
  - CH592F
  - 宏键盘
  - 嵌入式
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/1005WM/BinaryKeyboard"
  - label: "在线文档"
    icon: "material-symbols:menu-book"
    value: "https://meowkj.github.io/BinaryKeyboard/"
---

::github{repo="1005WM/BinaryKeyboard"}

## 项目简介

BinaryKeyboard 是一个开源迷你宏键盘项目，固件提供两种硬件方案：**CH552G** 的 USB 有线版，以及 **CH592F** 的 USB / BLE 双模版。仓库包含 `firmware/`、`config/`、`examples/`、`tools/` 与 `docs/`，以及用于启动控制台的 `run.py`。

本仓库是上游 [MeowKJ/BinaryKeyboard](https://github.com/MeowKJ/BinaryKeyboard) 的 fork，用于本地试用与改动留存；硬件资料、无线款使用手册与固件发行版请看[在线文档](https://meowkj.github.io/BinaryKeyboard/)与上游 Releases。

## 快速开始

在仓库根目录运行：

```bash
python run.py
```

脚本会创建 `.venv`，安装控制台依赖并启动 `console.py` 的 TUI，用于配置按键与固件。

## 许可

代码遵循 **GPL-3.0**，文档与素材遵循 **CC BY-NC-SA 4.0（非商用）**，使用前请留意授权范围。
