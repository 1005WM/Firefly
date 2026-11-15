---
title: "ros2-navigation · ROS2 导航练习"
slug: ros2-navigation
published: 2026-10-11
order: 120
description: "ROS 2 导航学习工程，包含 fishbot 机器人描述、Navigation2 配置与地图、应用节点三个功能包。"
image: ""
status: "developing"
tags:
  - Python
  - ROS2
  - Navigation2
  - 机器人
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/1005WM/ros2-navigation"
---

::github{repo="1005WM/ros2-navigation"}

## 项目简介

ROS 2 导航相关的练习工程，`src/` 下按 ROS 2 工作空间习惯拆成三个功能包：

| 功能包 | 内容 |
| --- | --- |
| `fishbot_description` | 机器人模型（`urdf/`）、仿真世界（`world/`）、launch 与配置，CMake 构建 |
| `fishbot_navigation2` | Navigation2 的参数配置（`config/`）、启动文件（`launch/`）与地图（`maps/`） |
| `fishbot_application` | Python 应用节点，`setup.py` / `package.xml` 与单元测试骨架 |

## 当前状态

仓库 README 目前只有标题，工程仍处于搭建与调试阶段，尚未补上使用说明。后续跑通建图与导航后会补上启动命令、参数说明和效果记录。
