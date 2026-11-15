---
title: "20th-smart-car · TC264 双摄智能车"
slug: 20th-smart-car
published: 2026-10-11
order: 150
description: "基于逐飞 TC264 开源库 V3.4.6 的双摄循迹智能车工程：大津法二值化 + 边界跟随寻线 + 路口状态机，位置 PD 方向环与增量式 PID 速度环驱动双电机差速。"
image: ""
status: "developing"
tags:
  - C
  - TC264
  - 智能车
  - 嵌入式
  - PID
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/1005WM/20th-smart-car"
  - label: "项目文章"
    icon: "material-symbols:article"
    value: "/posts/20th-smart-car/"
---

::github{repo="1005WM/20th-smart-car"}

## 项目简介

20 届「疯狂电路」智能车代码。主控为 Infineon AURIX **TC264D**，两颗 MT9V03X（总钻风）灰度摄像头采集 188 × 120 @ 50 fps 图像，经大津法自适应二值化、边界跟随寻线与路口识别后，算出中线偏差，交给位置 PD 方向环 + 增量式 PID 速度环，最终输出双电机差速 PWM。

- **视觉**：双摄 8 位并口 + 场中断 + DMA 搬运，IPS114 屏幕实时叠加图像与边界
- **控制**：5 ms 速度环、10 ms 方向环，路口由路径表驱动的状态机判断
- **调试**：VOFA+ JustFloat 波形、逐飞助手 6 通道、串口在线调 PID
- **环境**：AURIX Development Studio v1.10.2（TASKING，`cctc -Ctc26xb`）

## 代码结构

- `code/` — 应用代码：`image`（图像处理）、`motor`（电机与控制环）、`connect`（路口状态机）、`IMU`、`vofa`、`justfloat`、`buzzer`
- `user/` — 工程与中断：`cpu0_main.c`、`cpu1_main.c`、`isr.c`、`isr_config.h`
- `libraries/` — 逐飞开源库 V3.4.6 与 Infineon iLLD
- `Debug/` — ADS 构建产物

## 当前状态

代码尚未跑通编译链接：`IMU.c` 有语法错误，`motor.c` 仍在调用已被 `path_driver()` 取代的 `state_machine()`，另有若干只声明未定义的全局变量。`Debug/` 中的 `.hex` / `.elf` 是旧产物，不代表当前源码。完整的已知问题清单、引脚分配、控制参数与调参步骤写在[项目文章](/posts/20th-smart-car/)里。

底层逐飞库与上层应用代码均按 **GPL-3.0** 发布，使用时需保留成都逐飞科技有限公司的版权声明。
