---
title: QCT-Nva代码知识
published: 2026-11-14
pinned: false
description: 青橙战队 ROS 2 哨兵导航工作区（QCT-Nva）的零基础逐行讲解：从 Livox MID360 驱动、FAST-LIO、地形分析与 OctoMap，到 ICP 重定位、Nav2 代价地图插件、行为树与底盘速度链，附常用函数与常用包的反查索引。
image: './images/qct-nva-cover.avif'
tags: [ROS 2, 源码阅读, C++, 机器人, Nav2, SLAM]
category: 源码解析
draft: false
lang: ''
slug: qct-nva-dai-ma-zhi-shi
---

> [!NOTE] 这篇在讲什么
> 讲的是 `QCT-Nva` —— 青橙战队的 ROS 2 哨兵机器人导航工作区。不假设你学过 ROS 2、点云或 SLAM：每个概念第一次出现就解释，每段代码都带真实行号和白话拆解，并按「数据在谁手里、下一步交给谁」把各个环节串成一条完整链路。

这是一份针对青橙战队哨兵机器人导航工作区的超详细源码讲解。不假设你学过 ROS 2、点云或 SLAM：每个概念第一次出现就解释，每段代码都带行号和白话逐行拆解，并按「数据在谁手里、下一步交给谁」把 14 个包串成一条完整链路；后半部分另附常用函数、常用包与按场景反查索引。

- **源码位置**：`D:/WORKclaude/QCT-Nva`
- **运行环境**：ROS 2 Humble / Ubuntu 22.04 / Livox MID360
- **规模**：12 个顶层目录、14 个 ROS 2 包、约 600 个文件
- **读法**：按「数据流向」而非文件夹顺序——雷达 → 定位建图 → 地形 → 重定位 → 导航 → 底盘

> [!TIP] 关于行号
> 文中代码片段全部摘自仓库原文，标注的是「起始行–结束行」区间；「逐行拆解」左侧的数字就是源码里的真实行号，可以直接按号在编辑器里定位。如果你手上是别的版本，行号可能有少量偏移，以函数名和代码内容为准。

## 章节地图

| 章 | 讲什么 |
| --- | --- |
| 00 · 读前说明：这份讲解打算怎么讲 | 先交代项目背景、讲解范围和阅读方法，避免一上来就掉进 600 个文件里。 |
| 01 · 零基础概念速查（这一章最重要） | 把后面会反复出现的 30 多个词一次讲清楚。看不懂代码，八成是卡在这里。 |
| 02 · 全局鸟瞰：14 个包与一条数据流 | 先记住这张地图，后面每一章都是在往这张图上贴细节。 |
| 03 · 先读两份文档：README 与源码导读 | 仓库自带的两份文档质量很高，先把它们逐段拆开，等于拿到了整份代码的索引。 |
| 04 · 第一环：Livox MID360 雷达驱动 | 所有数据的源头。理解它，才能理解后面 FAST-LIO 为什么那样配置。 |
| 05 · launch 文件入门：逐行拆 mapping.launch.py | 学会读 launch，就学会了这个工程 80% 的「接线图」。 |
| 06 · FAST-LIO：整个系统的心脏 | 它把雷达点云和 IMU 融合成「我在哪」，并顺手攒出一张三维点云地图。 |
| 07 · 地形分析：把「离地多高」塞进 intensity | 这是整个工程最巧妙、也最反直觉的一环，理解它才能看懂第 13 章的自定义代价地图插件。 |
| 08 · OctoMap 支路：从 3D 点云到 2D 栅格地图 | 建图时走的一条旁路，产出 Nav2 需要的 PNG + YAML。四个节点环环相扣。 |
| 09 · ICP 重定位：开机时先搞清「我在哪」 | 把一帧实时扫描和上次建好的 PCD 对齐，求出初始位姿，再把它变成 TF 树的一条边。 |
| 10 · 一键启动的门控：不让 Nav2 在没定位时乱跑 | 一个 65 行的 launch + 一个 63 行的 Python 脚本，把「先定位、后导航」变成硬约束。 |
| 11 · Nav2 启动全景：navigation.launch.py | 一个文件拉起 8 个生命周期节点、地形分析和 RViz，并把速度话题改了三次名。 |
| 12 · nav2_params.yaml：552 行参数逐块拆解 | 这份 YAML 决定了「怎么规划、怎么避障、卡住怎么办」。按决策 → 规划 → 控制 → 感知 → 恢复的顺序读。 |
| 13 · 自定义代价地图插件 costmap_intensity（逐行精读） | 整个工程最核心的自研改动：只改了十几行，就让 Nav2 会「看相对地面高度」而不是绝对高度。 |
| 14 · 行为树与自定义恢复行为 BackUpTwzFree | 卡住时机器人不是傻傻直退，而是查代价地图找一块空地，斜着平移过去。 |
| 15 · 速度指令的最后一公里：底盘与消息接口 | 从 Nav2 的抽象速度，到电控能理解的 ChassisCmd，中间只隔两个 60 行的小节点。 |
| 16 · 构建体系、坐标系模型与调试面板 | 看懂 CMakeLists / package.xml / URDF，才知道「改了文件为什么没生效」。 |
| 17 · 实战速查：命令、验收点与排障清单 | 把前面所有概念落到「终端里敲什么」。首次使用务必分阶段，每段都有可观测的验收点。 |
| 18 · 全量陷阱清单与联调优先级 | 把散落在各章的「不一致 / 未闭环 / 易错点」集中起来，交作业或实车前过一遍。 |
| 19 · 常用包全景：14 个包各自干什么、谁依赖谁 | 前面按数据流讲完了代码，这一章换成「按包查」：想改某个功能，先知道该进哪个目录。 |
| 20 · C++ 常用函数逐行拆解：节点骨架与消息收发 | 把散落在各章的 rclcpp / QoS / tf2 调用抽出来，集中讲「这个函数到底在干什么」。 |
| 21 · launch 与 Python 常用函数逐行拆解 | 不改一行 C++，只靠 launch 就能换话题名、换参数、改启动顺序。这一章讲清每个函数。 |
| 22 · 算法与数学库函数逐行：PCL / Eigen / ikd-Tree / ICP / IEKF | 前面讲的是「搬运数据的函数」，这一章讲「真正算东西的函数」。 |
| 23 · 函数与包速查索引：想改 X，该去哪、调什么 | 把前面 22 章压成一张反查表。实车联调、交作业、面试讲解时直接翻这一章。 |

---

## 00 · 读前说明：这份讲解打算怎么讲

*先交代项目背景、讲解范围和阅读方法，避免一上来就掉进 600 个文件里。*

`QCT-Nva` 是青橙战队**哨兵机器人**的 ROS 2 导航工作区。一句话概括它做的事：**把激光雷达和 IMU 的原始数据，变成「我在哪」「周围哪里能走」「轮子该转多快」这三件事。**它基于 SCURM 火锅战队开源的哨兵导航框架整理，运行在 Ubuntu 22.04 + ROS 2 Humble 上，传感器是 Livox MID360。

目录下有 632 个文件、14 个 ROS 2 包。别被数字吓到：其中 `Livox-SDK2`（239 个文件）、`livox_ros_driver2`（114 个）、`FAST_LIO`（66 个）里绝大部分是第三方/上游代码，**真正需要读懂的接线和自研逻辑，集中在另外 8 个包、大约 30 个文件**。这份讲解就是围绕这 30 个文件展开的。

> [!NOTE] 零基础承诺
> 讲解不假设你学过 ROS 2、Linux、C++、点云或 SLAM。凡是第一次出现的概念（节点、话题、TF、QoS、launch、remap、pluginlib、ICP、体素栅格……）都会当场用大白话解释一遍。代码片段全部来自仓库原文，保留行号，下面配「逐行拆解」；点行号可以跳到对应代码行。

### 这份讲解的结构

| 章节 | 回答的问题 | 适合什么时候看 |
| --- | --- | --- |
| 00 – 02 | 这是什么项目？ROS 2 的基本词是什么？文件和数据怎么摆？ | 第一次打开仓库 |
| 03 – 05 | README 怎么说？雷达数据从哪来？launch 文件怎么读？ | 准备动手跑起来 |
| 06 – 08 | 怎么一边定位一边建出三维点云和二维栅格地图？ | 看建图链路 |
| 09 – 10 | 已有地图时怎么找到自己在哪？一键启动为什么不会乱套？ | 看重定位链路 |
| 11 – 14 | Nav2 怎么规划路径？为什么要改代价地图插件和恢复行为？ | 看导航与避障 |
| 15 – 16 | 速度指令怎么变成底盘消息？消息和包是怎么编译出来的？ | 看执行端与工程结构 |
| 17 – 18 | 具体敲什么命令？报错怎么查？源码里有哪些坑？ | 实车联调 / 交作业前 |
| 19 – 23 | 有哪些包？常用的函数分别干什么？想改 X 该去哪找？ | 按包查 / 改代码 / 反查速查 |

### 页面上的三种标记

> [!NOTE] ◆ 概念
> 解释一个术语或机制。看到它，说明这里出现了一个后面会反复用到的概念。

> [!TIP] ✔ 要点
> 一句话点破「为什么这么写」或「这段在整体里的作用」。

> [!WARNING] ! 注意 / ✕ 坑
> 源码里的不一致、注释与实现不符、容易踩的雷。这类信息在联调时最值钱。

### 怎么用这个页面

- 桌面端在正文右侧查看目录，手机上点左下角「目录」。点击章节即可跳转，滚动时会自动高亮当前位置。
- 顶部搜索框可以搜概念、参数名、话题名、文件路径，例如 `transient_local`、`/terrain_map`、`min_obstacle_intensity`。
- 每个代码块右上角有「复制」和「折叠」；下面的「逐行拆解」可以点行号定位到代码行。
- 右上角 ◐ 切换深浅色；电脑上左右分栏阅读，手机上代码块可横向滑动。
- **电脑和手机打开同一个网址即可**，内容完全一样，只是排版自动适配屏幕。

> [!TIP] 一个建议的读法
> 不要按文件夹顺序读。按「数据流向」读：雷达 → 建图/定位 → 地形 → 代价地图 → 规划 → 速度 → 底盘。每读完一章，回到第 02 章的总图看一眼自己走到了哪一环，会清楚很多。

---

## 01 · 零基础概念速查（这一章最重要）

*把后面会反复出现的 30 多个词一次讲清楚。看不懂代码，八成是卡在这里。*

### 1.1 机器人导航到底在解决什么问题

想象你被蒙上眼睛放进一间屋子，只允许用手电筒四处照。要走到门口，你得连续回答四个问题：**我周围有什么**（感知）→ **我现在站在哪**（定位）→ **从这到门口怎么走不撞东西**（规划）→ **下一步脚该往哪个方向迈多快**（控制）。机器人导航就是让程序自动、每秒几十次地回答这四个问题。

1. **感知：激光雷达 + IMU**：雷达每秒发射大量激光，测出每个反射点的距离，得到一坨三维点，叫「点云」。IMU（惯性测量单元）高频报告角速度和加速度，用来感知机器人怎么动、怎么倾斜。
2. **定位：我在哪**：把当前这帧点云和上一帧/已建好的地图对齐，反推出机器人自己的位置和朝向。结果叫「里程计 / 位姿」。
3. **建图：把看到的东西记下来**：把每一帧点云按定位结果拼到同一个世界坐标系里，累积成一张三维点云地图（PCD），或投影成二维栅格地图（PNG + YAML）。
4. **可通行性判断：哪里能走**：地面点不算障碍，高出地面 30 cm 的台阶才算。这一步生成「地形点云 / 代价地图」。
5. **规划：全局路径**：在栅格地图上找一条从当前位置到目标点的无碰撞折线。本工程用 Theta* 算法。
6. **控制：局部避障 + 速度**：每 1/80 秒重新评估：沿全局路径走、躲开动态障碍、不超速。本工程用 MPPI 采样大量候选轨迹再挑最优的。
7. **执行：把速度发给底盘**：速度是「机器人坐标系下 x 方向 1.2 m/s」这种抽象量，还要按云台转角换算、封装成电控能懂的消息。
8. **循环**：以上每秒重复几十到上百次，机器人就动起来了。

> [!NOTE] 为什么需要「重定位」和「先验地图」
> 每次开机时，机器人不知道自己被放在场地的哪个角落。里程计只能告诉你「相对起点走了多远」，而且会越走越漂。所以要先拿当前看到的一帧点云，去和**上一轮建好并保存的地图**做匹配，求出「我在这张地图的什么位置、朝哪边」——这个动作叫重定位（relocalization），本工程用 ICP 点云配准实现。匹配出来的位置就是整个系统的坐标基准。

### 1.2 ROS 2 的十个基础词

ROS 2 不是一种语言，而是一套**让很多独立小程序互相传数据的规矩**。每个小程序叫「节点」，节点之间不直接函数调用，而是往有名字的「频道」里发消息，谁需要谁订阅。

- **节点 Node** — 一个独立运行的程序（进程里的一个对象）。例如 `fastlio_mapping`、`icp_node`、`terrainAnalysis` 都是节点。一个包可以编译出多个节点。
- **话题 Topic** — 有名字的数据频道，如 `/livox/lidar`、`/cmd_vel`。发的一方叫 publish（发布），收的一方叫 subscribe（订阅）。双方不需要知道对方是谁。
- **消息 Message** — 频道里传的数据结构，由 `.msg` 文件定义。如 `sensor_msgs/msg/PointCloud2`（点云）、`geometry_msgs/msg/Twist`（速度）、`nav_msgs/msg/Odometry`（位姿）。
- **回调 Callback** — 订阅到一条消息时自动被调用的函数。ROS 2 程序的主体往往就是一堆回调，加一个 `rclcpp::spin()` 事件循环一直等着。
- **服务 Service** — 一问一答的同步调用。例如 `/map_save` 服务：调用一次，FAST-LIO 把地图写到磁盘并返回成功/失败。
- **动作 Action** — 带进度反馈、可取消的长任务。Nav2 的 `navigate_to_pose`、`FollowPath`、`BackUp` 都是 Action。
- **参数 Parameter** — 节点启动时从 YAML 或命令行读入的可调数值，如 `fitness_score_thre: 0.9`。代码里用 `declare_parameter` 声明、`get_parameter` 读取。
- **QoS** — 服务质量策略：可靠还是尽量快、队列多长、是否保留最后一条消息。传感器数据常用 `SensorDataQoS`（允许丢包），只发一次的初始化数据必须用 `transient_local`（保留）。
- **launch 文件** — Python 或 XML 写的「启动清单」：一次拉起十几个节点、给它们塞参数、改话题名、设延时和条件。入口通常是 `ros2 launch 包名 文件.launch.py`。
- **remap 重映射** — 启动时不改源码，把节点内部写死的话题名换成另一个名字。本工程大量使用，是看懂数据流的关键（下一节细讲）。
- **包 Package / colcon** — 包是 ROS 2 的代码组织单位（一个 `package.xml` + `CMakeLists.txt`）。`colcon build` 把整个工作区所有包一次性编译到 `install/`。
- **工作区 Workspace** — 含 `src/`、`build/`、`install/`、`log/` 的目录。`source install/setup.bash` 让当前终端能找到这些包。每个新终端都要执行一次。

> [!TIP] 最小完整程序长什么样
> 几乎每个 C++ 节点都是这个骨架：构造函数里 `create_publisher` / `create_subscription` / `declare_parameter` → 回调函数里干活 → `main()` 里 `rclcpp::init(argc, argv); rclcpp::spin(std::make_shared<XX>()); rclcpp::shutdown();`。看到这三个函数，就知道这个文件是一个 ROS 2 节点。

### 1.3 点云、IMU 与坐标系

- **点云 PointCloud** — 一堆三维坐标点 `(x, y, z)`，每个点还可能带 `intensity`（反射强度/自定义数值）、时间戳。雷达一帧几万点。
- **PointCloud2** — ROS 标准点云消息类型。它是一块二进制数据 + 字段描述（有哪些字段、各占几字节），所以读取时要按字段名迭代。
- **CustomMsg** — Livox 驱动的私有点云格式，每个点额外带 `offset_time`（相对本帧起点的时间）、`line`（线号）、`tag`、`reflectivity`。FAST-LIO 需要 `offset_time` 做去畸变，所以本工程特意选它。
- **PCL / pcl::PointXYZI** — 点云库（Point Cloud Library）及其点类型。C++ 里用 `pcl::fromROSMsg` / `toROSMsg` 在 ROS 消息和 PCL 容器之间转换。`PointXYZI` 就是 XYZ + intensity。
- **IMU** — 惯性测量单元，输出角速度（`angular_velocity`）和线加速度（`linear_acceleration`），频率通常 200 Hz 以上，远高于雷达的 10 Hz。
- **去畸变 / de-skew** — 雷达扫完一帧要 100 ms，这期间机器人在动，第一个点和最后一个点其实是在不同位置测的。用高频 IMU 递推出每个点采集时刻的姿态，把整帧点补偿到同一时刻，否则点云会「糊」。
- **帧 frame_id** — 每条消息头里的坐标系名字，说明里面的坐标数值是相对哪个原点量的。常见：`map`（全局固定）、`odom`（里程计起点）、`base_link`（机身）、`imu_link`、`lidar_link`、`chassis_link`。
- **TF / TF 树** — 记录坐标系之间变换关系的一棵树。`map → odom → base_link → yaw_link → chassis_link`。每个节点只负责发布自己那条边；`lookupTransform` 可以查询任意两帧之间的关系。
- **里程计 Odometry** — 机器人相对起点的位姿估计，会持续输出但会漂移。`nav_msgs/Odometry` 消息里含位置、姿态、速度，以及 `header.frame_id`（父帧）和 `child_frame_id`（子帧）。
- **PCD 文件** — 点云地图的磁盘格式。本工程里 `GlobalMap.pcd` 是三维先验地图，给 ICP 和 FAST-LIO 定位用。
- **PNG + YAML** — 二维栅格地图的磁盘格式。PNG 是黑白灰图，YAML 写分辨率、原点、占用阈值。给 Nav2 规划用。**和 PCD 是两套不同的地图**。
- **体素栅格 VoxelGrid** — 把空间切成小立方体，每格只保留一个代表点，用来给点云降采样（减少计算量）。叶子尺寸常叫 `leaf_size`。
- **k-d 树 / ikd-Tree** — 快速查找「最近的点」的数据结构。FAST-LIO 用增量式 ikd-Tree 维护地图，避免每帧重建。
- **ICP** — Iterative Closest Point：给一个初始位置猜测，反复「给当前点找地图里的最近点 → 求一个最优刚体变换」，把两片点云对齐，用来算重定位位姿。
- **EKF / IEKF** — （迭代）扩展卡尔曼滤波：把 IMU 的预测和点云匹配的观测融合起来估计状态。FAST-LIO 的核心。

### 1.4 launch 与 remap：不改源码改接线

这是本工程最容易看漏的一层。源码里写的是 `/Odometry`，但启动文件里加一句重映射，实际频道就变成了 `/state_estimation`。**所以看代码时，永远要同时看 launch 里的 `remappings=`。**

**`src/sentry_bringup/launch/mapping.launch.py（节选）`** · 源码第 **41–49** 行

```py startLineNumber=41
  fast_lio_node = Node(
        package='fast_lio',
        executable='fastlio_mapping',
        parameters=[
          fast_lio_param
        ],
        output='screen',
        remappings=[('/Odometry','/state_estimation')]
    )
```

> 为什么这么干？因为上游 FAST-LIO 是第三方代码，它内部写死了 `/Odometry`；而本工程其余模块（地形分析、Nav2、门控脚本）统一用 `/state_estimation` 这个名字。remap 让两拨代码不用改一行就能接上。

**逐行拆解**

- **41–49** — **这 9 行启动一个节点**：`Node(...)` 是 launch 里的「启动声明」。
- **42** — `package='fast_lio'` + `executable='fastlio_mapping'`：等价于命令行 `ros2 run fast_lio fastlio_mapping`。
- **44–46** — `parameters=[fast_lio_param]`：把一份 YAML 参数文件塞给这个节点。YAML 里的值会覆盖源码里 `declare_parameter` 的默认值。
- **47** — `output='screen'`：日志打印到屏幕，方便调试。
- **48** — **核心**：`remappings=[('/Odometry','/state_estimation')]` 把源码里发布 `/Odometry` 的那一行，在运行时改名成 `/state_estimation`。下游地形分析、Nav2 全都订阅 `/state_estimation`。

> [!WARNING] 相对名与绝对名
> ROS 2 里 `"icp_result"`（无前导斜杠）和 `"/icp_result"` 通常解析到同一个话题，但受命名空间影响可能不同。本工程两种写法混用：`transform_publisher.cpp` 写的是相对名 `"icp_result"`，launch 里 remap 用的是 `'/pointcloud2'`。排查「明明发了却收不到」时，先用 `ros2 topic list` 看实际名字。

### 1.5 QoS：为什么「只发一次」的消息特别麻烦

ICP 配准成功后只发布**一次**位姿就停止工作。可 FAST-LIO、Nav2、甚至你手动 `ros2 topic echo` 都可能比它晚启动。如果按 ROS 默认的 `volatile`（发完即弃），晚来的订阅者永远收不到这条消息，整条重定位链路就断了。

| 名称 | 说明 |
| --- | --- |
| reliable() | 可靠传输：丢了会重传，保证送到。 |
| transient_local | **本地持久**：发布者替自己把最后一条消息「钉在布告栏上」，后加入的订阅者也能拿到。也叫 latched。 |
| QoS(1) | 队列深度 1，只保留最新一条。 |
| SensorDataQoS() | 传感器数据预设：允许丢包（best effort）、小队列，追求实时性不追求不丢。 |
| 兼容性 | 订阅方的 QoS 必须和发布方兼容。用 `ros2 topic echo` 看 `transient_local` 的话题时，必须加 `--qos-durability transient_local`，否则看不到数据。 |

**`命令行示例（README_USAGE.md §5.1）`** · 源码第 **1–2** 行

```bash
ros2 topic echo /icp_result geometry_msgs/msg/PoseWithCovarianceStamped --qos-durability transient_local --once
ros2 topic echo /localization_initial_pose geometry_msgs/msg/PoseWithCovarianceStamped --qos-durability transient_local --once
```

**逐行拆解**

- **1、2** — 读两条「只发一次」的位姿消息。`--once` 取一条就退出；`--qos-durability transient_local` 让自己的订阅策略与发布者匹配。

### 1.6 LifecycleNode、pluginlib：Nav2 的两个特殊机制

- **生命周期节点 LifecycleNode** — Nav2 的节点不是启动就干活，要依次经过 `configure → activate` 两个状态才真正工作。由 `nav2_lifecycle_manager` 统一按列表驱动。节点卡在 `inactive` 是常见故障。
- **pluginlib** — ROS 的插件机制：主程序只知道一个字符串（如 `costmap_intensity::ObstacleLayerIntensity`），运行时动态加载对应的 `.so` 库并实例化。所以**改 YAML 一行就能换掉整个算法**，不用重新编译主程序。
- **插件四件套** — ① C++ 里 `PLUGINLIB_EXPORT_CLASS(类, 基类)`；② XML 描述文件写 `name/type/base_class_type`；③ CMake 里 `pluginlib_export_plugin_description_file(...)`；④ `package.xml` 的 `<export>` 里注册。少一件就加载失败。
- **行为树 Behavior Tree** — 用 XML 描述「先规划、再跟随、失败就后退、再失败就清地图」这类决策流程。节点类型有控制节点（Sequence/Fallback/RecoveryNode）、装饰节点（RateController/Inverter）、动作叶节点（ComputePathToPose/FollowPath/BackUp）。
- **黑板 Blackboard** — 行为树节点之间共享的变量，写成形如 `{path}`、`{goal}`。规划节点把路径写进 `{path}`，跟随节点从 `{path}` 读。
- **代价地图 Costmap** — 把周围环境画成一张栅格，每格一个「代价」：0 空闲、254 致命障碍、255 未知，中间是越靠近障碍越高的代价。分「全局」（静态地图，规划用）和「局部」（实时点云，避障用）。
- **图层 Layer** — 代价地图是分层叠加的：静态层、障碍层、膨胀层各自算一份栅格，再按 `combination_method` 合成。本工程把障碍层换成了自定义插件。
- **Action / 恢复行为** — 卡住时 Nav2 会执行「恢复」：旋转、后退、清代价地图。本工程把「后退」换成了会主动找自由空间的自定义行为。

---

## 02 · 全局鸟瞰：14 个包与一条数据流

*先记住这张地图，后面每一章都是在往这张图上贴细节。*

### 2.1 src/ 下有哪些包，各自负责什么

| 包 | 文件数 | 职责（一句话） | 自研 / 上游 |
| --- | --- | --- | --- |
| `livox_ros_driver2` | 114 | Livox MID360 雷达驱动，发布点云 `/livox/lidar` 和 IMU `/livox/imu` | 上游（改配置） |
| `Livox-SDK2` | 239 | 雷达底层 C++ SDK，负责 UDP 收包、解析 | 第三方，不读 |
| `FAST_LIO` | 66 | 激光惯性里程计：融合雷达+IMU 做定位/建图，输出 `/cloud_registered`、`/Odometry` | 上游 + 本工程改动（先验地图定位） |
| `icp_relocalization` | 10 | 把当前扫描和先验 PCD 对齐，给出初始位姿并广播 `map→odom` | 自研 |
| `autonomous_exploration_development_environment` | 30 | 地形分析（普通版 / 扩展版）、字段交换、扫描坐标变换、坡度分析 | 上游 + 本工程接线 |
| `nav2_plugins` | 13 | 两个自定义包：`costmap_intensity`（按 intensity 过滤的障碍层）和 `behavior_ext_plugins`（朝自由空间后退） | **自研核心** |
| `cmd_chassis` | 7 | 速度坐标转换、`/cmd_vel` → `/chassis_cmd` | 自研 |
| `rm_interfaces` | 21 | 底盘/云台/裁判系统的 `.msg` 消息定义 | 自研（接口包） |
| `auto_aim_interfaces` | 10 | 自瞄系统消息定义 | 自研（接口包） |
| `sentry_bringup` | 39 | **总装车间**：所有 launch 文件、参数 YAML、行为树、地图、RViz 配置 | 自研（最重要） |
| `sentry_description` | 12 | 机器人 URDF 模型，发布静态 TF 树 | 自研 |
| `control_panel` | 8 | Qt 调试面板，模拟裁判系统发比赛状态 | 自研（可选） |

共 12 个顶层目录（README 里按 14 个包计，因为部分目录含多个 ROS 包）。真正要精读的是加粗和标「自研」的部分。

### 2.2 主数据流：从雷达到底盘

**`全链路（依据 README_USAGE.md §3 与 docs/CODEBASE_GUIDE.md 整理）`** · 源码第 **1–32** 行

```text
【建图模式】
MID360 ──UDP──> livox_ros_driver2
   ├─ /livox/lidar  (CustomMsg: x,y,z,offset_time,line,tag,reflectivity)
   └─ /livox/imu    (sensor_msgs/Imu)
        ↓
FAST_LIO (preprocess → IMU 去畸变 → IEKF + ikd-Tree)
   ├─ /Odometry  ──remap──> /state_estimation      + TF: odom → base_link
   ├─ /cloud_registered (世界系注册点云)
   ├─ /Laser_map  (逐帧累加的点云) ── /map_save 服务 ──> GlobalMap.pcd
   └─ /cloud_registered ──> terrainAnalysisExt
            ↓ /terrain_map_ext (intensity = 相对地面高度)
        exchangeField (z ↔ intensity 互换)
            ↓ /terrain_map_ext_exchanged
        sensorScanGeneration (同步里程计, 搬回传感器原点)
            ↓ /terrain_map_at_scan (frame: sensor_at_scan)
        octomap_server (resolution 0.1, min_z 0.15)
            ↓ /projected_map (OccupancyGrid)
        map_saver_cli ──> nav_map.png + nav_map.yaml

【重定位 + 导航模式】
独立扫描 ──> icp_node / sac_ia_gicp ──> /icp_result
   ↓
transform_publisher ──> TF: map → odom  +  /localization_initial_pose
   ↓ (transient_local, 只发一次)
FAST_LIO (locate_in_prior_map=true, 加载 GlobalMap.pcd, 不再增量建图)
   ↓ /state_estimation + /cloud_registered
   ├─ terrainAnalysis ──> /terrain_map ──> costmap_intensity 插件 ──> local_costmap
   └─ wait_for_localization.py 门禁通过 ──> Nav2
            planner(Theta*) → smoother → controller(MPPI) → /cmd_vel_nav
            → velocity_smoother → /cmd_vel
            → twist_transformer → /cmd_vel_in_yaw
            → twist2chassis_cmd → /chassis_cmd
```

**逐行拆解**

- **1–8** — **传感器层**：驱动把雷达的 UDP 数据变成两个 ROS 话题。注意点云是 Livox 私有 `CustomMsg` 而不是标准 `PointCloud2`，因为 FAST-LIO 需要每点时间戳。
- **9–12** — **定位层**：FAST_LIO 是核心，`/Odometry` 被 remap 成 `/state_estimation`，同时广播 `odom → base_link` 动态 TF。
- **13、14** — **地图副产物**：`/Laser_map` 是逐帧累加的点云，`/map_save` 服务把它写成 PCD。
- **15–23** — **二维栅格建图支路**：地形分析 → 字段交换 → 搬回传感器系 → OctoMap 投影 → 保存 PNG+YAML。这条链只在建图时跑。
- **25–29** — **重定位层**：ICP 算初始位姿，中继节点把它变成 `map → odom` 静态 TF 和一次性的初始位姿消息。
- **30–32** — FAST_LIO 在定位模式下加载先验 PCD，只输出里程计、不再往地图里加点。
- **33、34** — **感知→代价地图**：普通地形分析输出 `/terrain_map`，自定义插件按 intensity 过滤后写进局部代价地图；同时门控脚本确认定位就绪。
- **35–40** — **规划→执行**：Nav2 一系列服务器产出速度，经过平滑、坐标旋转、消息封装，最终到 `/chassis_cmd`。

把这张图记牢：**同一个 `/cloud_registered`，在建图时喂给 OctoMap 生成 2D 地图；在导航时喂给地形分析生成实时障碍。**同一个 `GlobalMap.pcd`，既给 ICP 做匹配目标，也给 FAST-LIO 定位模式做先验索引。

### 2.3 三条启动路径

| 入口 launch | 启动什么 | 什么时候用 |
| --- | --- | --- |
| `mapping.launch.py` | MID360 + 机器人模型 + 底盘桥 + RViz，**延时 8 秒**起 FAST-LIO 和 OctoMap 建图链路 | 第一次到新场地，采集环境生成 PCD 和 PNG |
| `relocalization.launch.py` | 模型 + 传感器 + ICP + 中继 + FAST-LIO（先验地图模式）+ RViz | 已有地图，先确认能定位成功 |
| `bringup_all_in_one.launch.py` | 在重定位之后挂一个门控脚本；定位就绪才启动 `navigation.launch.py`，超时 90 秒直接关闭启动 | 全部确认过之后的日常一键启动 |

另有实验入口 `bringup_without_relocalization.py`，用固定 `TimerAction(10.0)` 延时启动导航，不做定位检查。首次联调不要用。

> [!TIP] 为什么一定要分阶段
> 每一阶段都有可观测的验收点：话题有没有数据（`ros2 topic hz`）、TF 能不能查（`tf2_echo`）、RViz 里位置对不对。直接一键启动，出错时你无法知道是雷达没数据、ICP 没收敛、还是 Nav2 没激活。

### 2.4 两套地图千万别混

|   | PCD 三维点云地图 | PNG + YAML 二维栅格地图 |
| --- | --- | --- |
| 文件 | `GlobalMap.pcd` | `test_map.png` + `test_map.yaml` |
| 谁生成 | FAST-LIO 的 `/map_save` 服务 | OctoMap 的 `/projected_map` + `map_saver_cli` |
| 谁使用 | ICP 配准、FAST-LIO 定位模式的先验索引 | Nav2 `map_server` / 全局代价地图静态层 |
| 内容 | 几十万个三维点 `(x,y,z,intensity)` | 每个格子标注占用/空闲/未知，YAML 写分辨率与原点 |
| 坐标系 | `map`（配准时的基准） | `map`（YAML 里 `origin` 是左下角世界坐标） |

> [!CAUTION] 必须来自同一轮建图
> `docs/CODEBASE_GUIDE.md` 把「确认 PCD 与栅格 YAML 采用相同基准」列为联调第一优先项。混用不同轮次的地图，会出现「定位看起来对、导航却往墙上撞」。另外，二维地图 YAML 里的 `origin` 只是图片左下角坐标，**不能拿来当 ICP 的初始位姿猜测**。

### 2.5 坐标系 / TF 树

**`由 src/sentry_description/urdf/sentry_description.urdf 与各节点发布者整理`** · 源码第 **1–11** 行

```text
map                       ← 全局固定坐标系（世界的原点）
 └─ odom                  ← transform_publisher 发布（重定位）
                              或 OctoMap 入口发布单位变换（建图）
     └─ base_link         ← FAST_LIO 动态发布 odom → base_link
         ├─ gimbal_odom
         └─ yaw_link      ← 云台偏航（本模型里是 fixed 固定关节）
             ├─ pitch_link ─┬─ shoot_link
             │              └─ camera_link
             ├─ lidar_link ─── imu_link        ← 0.011 0.02329 -0.04412
             ├─ usb_camera_a_link / usb_camera_b_link
             └─ chassis_link                   ← 叶子节点
```

**逐行拆解**

- **1–4** — `map → odom` 是**定位模块**给出的修正量（消除里程计漂移）；`odom → base_link` 是**里程计**连续输出的相对运动。这两个由不同节点发布，绝不冲突。
- **5–13** — 其余静态边由 `robot_state_publisher` 读 URDF 后广播到 `/tf_static`。本工程所有关节都是 `fixed`，所以不需要 `joint_state_publisher`。
- **10** — `lidar_link → imu_link` 的平移 `[0.011, 0.02329, -0.04412]` 与 FAST-LIO YAML 的 `extrinsic_T: [-0.011,-0.02329,0.04412]` **方向相反**——这是同一段平移的两种写法，别照抄两遍。

> [!CAUTION] TF 树的一条边只能有一个发布者
> 建图入口的 OctoMap 子 launch 会发单位 `map → odom`；重定位入口的 `transform_publisher` 也会发 `map → odom`。**两个入口不能同时启动**，否则 `chassis_link` 出现双父坐标系，RViz 里机器人会疯狂跳动。历史遗留的 `fake_joint` 节点也会造成双父（它发 `odom → chassis_link`），所以默认入口已经不再启动它。

---

## 03 · 先读两份文档：README 与源码导读

*仓库自带的两份文档质量很高，先把它们逐段拆开，等于拿到了整份代码的索引。*

### 3.1 README.md：项目自述

**`README.md（节选）`** · 源码第 **1–10** 行

```text
1  # 青橙战队的哨兵导航代码
2
3  本项目是青橙战队哨兵机器人的 ROS 2 导航代码，涵盖激光雷达数据接入、
4  建图与重定位、地形分析、路径规划和底盘指令转换。代码基于 SCURM 火锅战队
5  开源的哨兵导航框架整理，保留各模块原有的版权声明与许可证。
...
7  ## 系统组成
9  导航系统通过 Livox 雷达采集环境数据，使用 FAST-LIO 进行建图与定位，
10 结合 ICP 完成重定位。地形分析结果用于构建导航代价地图，Nav2 负责路径规划、
11 运动控制和故障恢复，底盘控制模块完成速度指令转换。
```

**逐行拆解**

- **1** — 标题直接说明这是**哨兵机器人**（RoboMaster 比赛里自动巡逻的机器人）的导航代码。
- **3–5** — 一句话列出五大模块：雷达接入、建图/重定位、地形分析、路径规划、底盘指令。这正是第 02 章数据流图的文字版。同时说明代码来自上游开源并保留版权。
- **9–11** — 点名关键技术栈：Livox 雷达 → FAST-LIO（建图定位）→ ICP（重定位）→ 地形分析（代价地图）→ Nav2（规划/控制/恢复）→ 底盘转换。后面 06–15 章逐个拆。

README 后面还给了一张包目录表和「编译 / 启动 / 配置说明」三段命令。先看命令有个印象即可，**具体怎么用会在第 17 章展开**，因为那需要前面所有概念才读得懂。

### 3.2 docs/CODEBASE_GUIDE.md：三条启动路径与「从输入追到输出」

**`docs/CODEBASE_GUIDE.md（节选，第 15-20 行）`** · 源码第 **15–30** 行

```text startLineNumber=15
## 从输入追到输出

1. **传感器。** MID360 启动脚本选择 Livox 自定义点云格式。当前模型采用雷达正装，
   FAST-LIO 直接订阅 /livox/lidar 和 /livox/imu……MID360 的点云与 IMU 轴向一致，
   外参旋转为单位矩阵；URDF 和 FAST-LIO 分别用相反方向表示两个原点之间的平移。
2. **建图与定位。** laserMapping.cpp 同步点云和 IMU，输出 /cloud_registered
   和 /Odometry；建图和重定位入口都把里程计重映射到 /state_estimation……
   ICP 使用原始扫描和先验地图，保留 /icp_result；中继使用扫描到 IMU 的静态外参，
   广播 map → odom，并把同一个初始位姿保留在 /localization_initial_pose……
3. **地形与代价地图。** 默认导航启动 terrain_analysis，把它的 /registered_scan
   输入重映射到 /cloud_registered。该节点在输出 /terrain_map 中用 intensity
   表达点相对地面的高度差；自定义障碍层按这个字段过滤……
4. **规划与控制。** nav2_params.yaml 配置 Theta* 全局规划、MPPI 跟踪、行为树与
   恢复插件。控制器的速度从 /cmd_vel_nav 进入平滑器，经 /cmd_vel 交给
   twist_transformer.cpp 做坐标转换，再由 twist2chassis_cmd.cpp 封装成 /chassis_cmd。
   源码中能追到 ROS 消息发布，未看到消费这条消息并下发到电控的节点。
```

**逐行拆解**

- **17–19** — **传感器**：强调「雷达正装」和「点云/IMU 轴向一致」。这两句解释了为什么旧的 `rot_imu.cpp`（把 IMU 数据翻转 180°）被弃用——那是雷达倒装时代留下的。
- **20–23** — **建图定位**：确认 `/Odometry` 被 remap 成 `/state_estimation`；ICP 结果经过中继变成 `map → odom` 和一次性初始位姿。
- **24–26** — **地形**：一句话点破本工程最核心的技巧——`intensity` 字段被用来装「点相对地面有多高」，自定义插件再按它过滤。第 07、13 章会逐行拆。
- **27–30** — **规划控制**：速度链 4 跳。最后一句非常重要：**仓库里没有把 `/chassis_cmd` 下发到电控的节点**。也就是说导航算出了速度，但「最后一公里」的串口/ CAN 驱动不在这个工作区里。

> [!WARNING] 一个必须知道的边界
> 第 30 行直说：源码里只能追到 ROS 消息的发布，找不到消费 `/chassis_cmd` 并真正驱动电机/电控的节点。所以这套代码**不是开箱即走的完整机器人**，实车联调时需要自己补上底盘通信桥。README_USAGE.md 也提醒「在执行器断开条件下验证路径和速度」，否则控制器会一直报「进度不足」。

> 确认 `prior_map:=` 的 PCD 与 Nav2 参数里的栅格 YAML 采用相同基准，并在 RViz 对照固定结构。
>
> —— docs/CODEBASE_GUIDE.md「联调前优先确认」第 1 条

---

## 04 · 第一环：Livox MID360 雷达驱动

*所有数据的源头。理解它，才能理解后面 FAST-LIO 为什么那样配置。*

### 4.1 驱动启动脚本逐行

**`src/livox_ros_driver2/launch_ROS2/msg_MID360_launch.py（第 7-42 行）`** · 源码第 **7–41** 行

```py startLineNumber=7
 7  ################### user configure parameters for ros2 start ###################
 8  xfer_format   = 1    # 0-Pointcloud2(PointXYZRTL), 1-customized pointcloud format
 9  multi_topic   = 0    # 0-All LiDARs share the same topic, 1-One LiDAR one topic
10  data_src      = 0    # 0-lidar, others-Invalid data src
11  publish_freq  = 10.0 # freqency of publish, 5.0, 10.0, 20.0, 50.0, etc.
12  output_type   = 0
13  frame_id      = 'livox_frame'
14  lvx_file_path = '/home/livox/livox_test.lvx'
15  cmdline_bd_code = 'livox0000000001'
16
17  cur_path = os.path.split(os.path.realpath(__file__))[0] + '/'
18  cur_config_path = cur_path + '../config'
19  user_config_path = os.path.join(cur_config_path, 'MID360_config.json')
20  ################### user configure parameters for ros2 end #####################
21
22  livox_ros2_params = [
23      {"xfer_format": xfer_format},
24      {"multi_topic": multi_topic},
25      {"data_src": data_src},
26      {"publish_freq": publish_freq},
27      {"output_data_type": output_type},
28      {"frame_id": frame_id},
29      {"lvx_file_path": lvx_file_path},
30      {"user_config_path": user_config_path},
31      {"cmdline_input_bd_code": cmdline_bd_code}
32  ]
...
35  def generate_launch_description():
36      livox_driver = Node(
37          package='livox_ros_driver2',
38          executable='livox_ros_driver2_node',
39          name='livox_lidar_publisher',
40          output='screen',
41          parameters=livox_ros2_params
42          )
```

> 驱动节点内部（`src/lddc.cpp`）会根据 `xfer_format` 决定 `create_publisher<CustomMsg>` 还是 `<PointCloud2>`，话题名固定为 `livox/lidar` 和 `livox/imu`（`multi_topic=0` 时）。

**逐行拆解**

- **13–21** — **用户配置区**：这一段的变量就是给驱动节点的 ROS 参数，改这里等于改命令行 `-p`。
- **14** — `xfer_format = 1` → **Livox 自定义点云格式 `CustomMsg`**。改成 `0` 就变成标准 `PointCloud2`。这是整条链最关键的一个数字，后面 FAST-LIO 的 `lidar_type: 1` 必须与它配套。
- **15** — `multi_topic = 0` → 所有雷达共用一个话题 `/livox/lidar`；若为 1，会按 IP 分出 `/livox/lidar_192_168_1_12` 之类的话题。
- **16** — `data_src = 0` → 从真实雷达的 UDP 收数据；非 0 是播放 `.lvx` 录制文件（本工程不用）。
- **17** — `publish_freq = 10.0` → 点云以 10 Hz 发布，也就是**一帧扫描约 100 ms**。这正是必须做去畸变的原因。
- **19** — `frame_id = 'livox_frame'` → 发出的点云和 IMU 消息头里坐标系都叫这个名字。
- **20、21** — 回放文件路径和广播码（雷达序列号），本链路是占位值。
- **23–25** — 用 `__file__` 定位到包内 `config/MID360_config.json`，避免写死绝对路径。
- **28–38** — 把上面变量组装成 ROS 参数列表：注意列表里是**每项一个字典**的写法，ROS 2 launch 允许这样传。
- **35–42** — `generate_launch_description()` 是 Python launch 的固定入口，返回启动描述。这里只启动一个节点 `livox_lidar_publisher`。

### 4.2 点云消息里到底有哪些字段

**`src/livox_ros_driver2/msg/CustomMsg.msg（全文）`** · 源码第 **1–8** 行

```text
# Livox publish pointcloud msg format.

std_msgs/Header header    # ROS standard message header
uint64 timebase           # The time of first point
uint32 point_num          # Total number of pointclouds
uint8  lidar_id           # Lidar device id number
uint8[3]  rsvd            # Reserved use
CustomPoint[] points      # Pointcloud data
```

**逐行拆解**

- **1、2** — 注释：`#` 开头。`.msg` 文件不是程序，只是**接口定义**，编译时会生成 C++/Python 类。
- **3** — 标准消息头：含 `stamp`（时间戳）和 `frame_id`（坐标系名）。
- **4** — `timebase`：本帧第一个点的绝对时间（纳秒）。
- **5** — `point_num`：这帧一共多少点。
- **6、7** — 雷达设备 ID、保留字节。
- **8** — `CustomPoint[]`：变长数组，每个元素是一个点，类型定义在另一个 `.msg` 文件里。

**`src/livox_ros_driver2/msg/CustomPoint.msg（全文）`** · 源码第 **1–9** 行

```text
# Livox costom pointcloud format.

uint32 offset_time      # offset time relative to the base time
float32 x               # X axis, unit:m
float32 y               # Y axis, unit:m
float32 z               # Z axis, unit:m
uint8 reflectivity      # reflectivity, 0~255
uint8 tag               # livox tag
uint8 line              # laser number in lidar
```

**逐行拆解**

- **3** — **`offset_time` 是精华**：每个点相对本帧起点的时间偏移（纳秒）。有了它，FAST-LIO 才能逐点做运动补偿（去畸变）。标准 `PointCloud2` 默认没有这个字段。
- **4–6** — 点的三维坐标，单位米。
- **7** — 反射强度 0~255，后面会被写进 PCL 点的 `intensity` 字段。
- **8** — `tag`：Livox 打的点质量标记，FAST-LIO 用 `tag & 0x30` 过滤噪点。
- **9** — `line`：第几线激光，FAST-LIO 用 `line < N_SCANS` 过滤。

> [!TIP] 为什么不用标准 PointCloud2
> 因为去畸变需要每个点的精确采集时刻。Livox 的 `CustomMsg` 自带 `offset_time`；换成 `PointCloud2` 后 FAST-LIO 只能靠水平角反推时间（见 `preprocess.cpp` 的 `mid360_handler`），精度更差。所以 `xfer_format=1` 与 `lidar_type=1` 是绑定在一起的。

### 4.3 雷达 IP 与端口配置

**`src/livox_ros_driver2/config/MID360_config.json（全文）`** · 源码第 **1–37** 行

```json
{
  "lidar_summary_info" : {
    "lidar_type": 8
  },
  "MID360": {
    "lidar_net_info" : {
      "cmd_data_port": 56100,
      "push_msg_port": 56200,
      "point_data_port": 56300,
      "imu_data_port": 56400,
      "log_data_port": 56500
    },
    "host_net_info" : {
      "cmd_data_ip" : "192.168.1.5",
      "cmd_data_port": 56101,
      "push_msg_ip": "192.168.1.5",
      "push_msg_port": 56201,
      "point_data_ip": "192.168.1.5",
      "point_data_port": 56301,
      "imu_data_ip" : "192.168.1.5",
      "imu_data_port": 56401,
      "log_data_ip" : "",
      "log_data_port": 56501
    }
  },
  "lidar_configs" : [
    {
      "ip" : "192.168.1.12",
      "pcl_data_type" : 1,
      "pattern_mode" : 0,
      "extrinsic_parameter" : {
        "roll": 0.0, "pitch": 0.0, "yaw": 0.0,
        "x": 0, "y": 0, "z": 0
      }
    }
  ]
}
```

**逐行拆解**

- **2–4** — `lidar_type: 8` 是 Livox SDK 里代表 MID360 型号的编号。
- **6–12** — **雷达侧**的 5 个 UDP 端口：命令 56100、推送 56200、点云 56300、IMU 56400、日志 56500。
- **13–24** — **主机（工控机）侧**接收地址：IP 必须是 `192.168.1.5`，端口对应 56101/56201/56301/56401/56501。换机器时这里和网卡 IP 都要改。
- **26–36** — 雷达列表：这里只有一台，IP `192.168.1.12`。`extrinsic_parameter` 全 0，表示雷达自身不做额外安装变换（真正的安装外参在 URDF 和 FAST-LIO 参数里）。

> [!WARNING] 最常见的「启动没报错但没数据」
> 雷达是 `192.168.1.12`，主机网卡必须配成 `192.168.1.5` 且在同一网段，UDP 包才能到达。排查顺序：网卡 IP → 能否 ping 通雷达 → `ros2 topic hz /livox/lidar` 是否 10 Hz → 有没有第二个驱动进程抢数据 → 话题类型是 `CustomMsg` 还是 `PointCloud2`。

### 4.4 一条不能断的类型一致性链

| 环节 | 配置 / 代码 | 值 | 断了会怎样 |
| --- | --- | --- | --- |
| 驱动输出格式 | `msg_MID360_launch.py` `xfer_format` | `1` → `CustomMsg` | 改成 0 会发 PointCloud2 |
| FAST-LIO 订阅分支 | `laserMapping.cpp:423-425` `lidar_type == AVIA` | `1` (AVIA) | 若仍订阅 CustomMsg 就收不到消息，没有里程计 |
| 预处理函数 | `preprocess.cpp:49` `avia_handler(msg)` | 读 `offset_time` | 没有逐点时间，去畸变退化 |
| 参数文件 | `fast_lio_*_param.yaml` `preprocess.lidar_type` | `1` | 拼错会静默用默认值 |
| 话题名 | `common.lid_topic` / `imu_topic` | `/livox/lidar`、`/livox/imu` | 话题对不上，整条链静默 |

> [!CAUTION] 另一个 launch 不能混用
> 同目录还有 `rviz_MID360_launch.py`，它发布的是标准 `PointCloud2`（给 RViz 看的）。README_USAGE.md 明确提醒：这两个 launch **不能同时启动**，也不能拿 `rviz_MID360_launch.py` 替换 FAST-LIO 默认所需的 Livox `CustomMsg` 输入。

---

## 05 · launch 文件入门：逐行拆 mapping.launch.py

*学会读 launch，就学会了这个工程 80% 的「接线图」。*

### 5.1 launch 文件的语法零件

- **`generate_launch_description()`** — Python launch 的固定入口函数，返回一个 `LaunchDescription` 对象。
- **`DeclareLaunchArgument`** — 声明一个可以从命令行覆盖的启动参数：`ros2 launch ... prior_map:=/abs/path.pcd`。
- **`LaunchConfiguration('x')`** — 占位符，在别处引用上面声明的参数值；真正求值发生在启动时。
- **`Node(package=, executable=, ...)`** — 声明启动一个节点，可带 `parameters`、`remappings`、`arguments`、`condition`、`output`。
- **`IncludeLaunchDescription(...)`** — 嵌套启动另一个 launch 文件。`PythonLaunchDescriptionSource` 用于 `.py`，`FrontendLaunchDescriptionSource` 用于 `.launch` XML。
- **`TimerAction(period=, actions=[...])`** — 延时若干秒再执行一组动作。本工程用它等传感器先起来。
- **`GroupAction(condition=...)` / `IfCondition`** — 按条件决定是否执行一组动作。
- **`RegisterEventHandler(OnProcessExit(...))`** — 某个进程退出时触发回调——第 10 章的「定位门控」就是这么实现的。
- **`RewrittenYaml` / `ReplaceString` / `ParameterFile`** — 启动时动态改写 YAML：替换硬编码路径、覆盖 `use_sim_time` 等。第 11 章细讲。
- **`get_package_share_directory('pkg')`** — 拿到包在 `install/share/<pkg>/` 里的实际路径，避免写死绝对路径。

### 5.2 建图入口全文逐行

**`src/sentry_bringup/launch/mapping.launch.py（全文 82 行）`** · 源码第 **1–82** 行

```py
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource, FrontendLaunchDescriptionSource
from launch_ros.actions import Node
from launch.substitutions import LaunchConfiguration

def generate_launch_description():

  config_path = os.path.join(
      get_package_share_directory('sentry_bringup'), 'params')

  twist2chassis_cmd_node=Node(
    package='cmd_chassis',
    executable='twist2chassis_cmd',
    output='screen'
  )

  twist_transformer_node=Node(
    package='cmd_chassis',
    executable='twist_transformer',
    output='screen'
  )

  sentry_description = IncludeLaunchDescription(
    PythonLaunchDescriptionSource([os.path.join(
        get_package_share_directory('sentry_description'), 'launch', 'view_model.launch.py')])
  )

  # mid360
  mid360_node = IncludeLaunchDescription(
      PythonLaunchDescriptionSource([os.path.join(
          get_package_share_directory('livox_ros_driver2'), 'launch_ROS2', 'msg_MID360_launch.py')])
  )

  # fast-lio localization
  fast_lio_param = os.path.join(
      config_path, 'fast_lio_mapping_param.yaml')
  fast_lio_node = Node(
        package='fast_lio',
        executable='fastlio_mapping',
        parameters=[
          fast_lio_param
        ],
        output='screen',
        remappings=[('/Odometry','/state_estimation')]
    )

  start_octomap_server = IncludeLaunchDescription(
    PythonLaunchDescriptionSource([os.path.join(
        get_package_share_directory('sentry_bringup'), 'launch', 'octomap_server_intensity.launch.py')])
  )

  rviz_config_file = os.path.join(
    get_package_share_directory('sentry_bringup'), 'rviz', 'loam_livox.rviz')
  start_rviz = Node(
    package='rviz2',
    executable='rviz2',
    arguments=['-d', rviz_config_file,'--ros-args', '--log-level', 'warn'],
    output='screen'
  )

  delayed_start_mapping = TimerAction(
    period=8.0,
    actions=[
      fast_lio_node,
      start_octomap_server
    ]
  )

  ld = LaunchDescription()

  ld.add_action(twist2chassis_cmd_node)
  ld.add_action(twist_transformer_node)
  ld.add_action(sentry_description)
  ld.add_action(mid360_node)
  ld.add_action(start_rviz)
  ld.add_action(delayed_start_mapping)

  return ld
```

> 这个文件的「形状」很典型：先声明一堆节点对象（此时并没有启动），最后统一 add_action。读 launch 时先看最后 10 行，再回头看每个节点的定义。

**逐行拆解**

- **1–8** — 导入。注意第 5 行有 `TimerAction`，第 6 行有两种 launch 源（Python / XML），第 8 行的 `LaunchConfiguration` 本文件其实没用上（残留 import）。
- **10** — 固定的 `generate_launch_description()` 入口。
- **12、13** — 拼出参数目录：`install/share/sentry_bringup/params`。用 `get_package_share_directory` 而不是硬编码，换机器也能跑。
- **15–19** — 启动 `twist2chassis_cmd` 节点（速度 → 底盘消息）。建图时要遥控车走，所以底盘链也要起。
- **21–25** — 启动 `twist_transformer` 节点（按云台角度旋转速度坐标系）。
- **27–30** — 包含 `view_model.launch.py`：启动 `robot_state_publisher`，把 URDF 的静态 TF 树广播出来。
- **33–36** — 包含 MID360 驱动 launch（第 04 章那份），产出点云和 IMU。
- **39、40** — 选中**建图模式**的参数文件 `fast_lio_mapping_param.yaml`。
- **41–49** — 启动 FAST-LIO 主节点 `fastlio_mapping`，加载上面 YAML，并把 `/Odometry` 重映射成 `/state_estimation`。
- **51–54** — 包含 OctoMap 建图子链路（第 08 章逐行拆）。它负责 `map → odom` 单位变换和 `/projected_map`。
- **56–63** — 启动 RViz 并加载 `loam_livox.rviz` 配置，`--log-level warn` 减少刷屏。
- **65–71** — **关键**：`TimerAction(period=8.0)` 让 FAST-LIO 和 OctoMap 链路**晚 8 秒**启动，好让雷达驱动、URDF/TF 先就绪。注意其他节点是立即启动的。
- **73–80** — 把所有动作加进 `LaunchDescription` 并返回。`add_action` 的顺序**不等于**进程启动顺序，launch 框架会并发执行；唯一的时间保证来自 `TimerAction`。
- **82** — 返回给 `ros2 launch`。

> [!TIP] 为什么延时 8 秒而不是等就绪
> 这是**固定延时**，不是事件驱动。FAST-LIO 需要 IMU 静止几帧做初始化、需要 `base_link ↔ imu_link` 的 TF 已存在，8 秒是经验值。更可靠的做法见第 10 章的 `wait_for_localization.py`——它按「话题有数据 + TF 可查」来判定，而不是数秒。

### 5.3 建图时的 map → odom 从哪来

建图时还没有 ICP，机器人从零开始建，`map` 和 `odom` 暂时重合。所以 `octomap_server_intensity.launch.py` 的第一个节点就发布了一条**单位变换**：

**`src/sentry_bringup/launch/octomap_server_intensity.launch.py（第 12-20 行）`** · 源码第 **12–20** 行

```py startLineNumber=12
# send tf odom->map
  # ros2 run tf2_ros static_transform_publisher --frame-id map --child-frame-id odom --qx 0.0 --qw 1.0
odom_map_trans = Node(
    name="odom_map_trans",
    package='tf2_ros',
    executable='static_transform_publisher',
    arguments='--frame-id map --child-frame-id odom --qx 0.0 --qw 1.0'.split(' '),
    output='screen'
    )
```

**逐行拆解**

- **12、13** — 注释写明用途：发一条 `map → odom` 的静态变换；第 13 行是等价的命令行写法。
- **14–17** — 用 `tf2_ros` 包自带的 `static_transform_publisher`，不需要写 C++ 代码。
- **18** — 参数含义：`--frame-id map` 是父，`--child-frame-id odom` 是子，`--qx 0.0 --qw 1.0` 是单位四元数（不旋转）；平移省略即全 0。**这条变换是恒等的**，所以建图时 map 和 odom 完全重合。

> [!CAUTION] 与重定位入口二选一
> 重定位时 `transform_publisher` 会根据 ICP 结果发布**真实的** `map → odom`（带平移和旋转）。如果建图入口和重定位入口同时开，就有两个节点抢同一条 TF 边，机器人位置会跳。README_USAGE.md 把这条列为明确禁令。

---

## 06 · FAST-LIO：整个系统的心脏

*它把雷达点云和 IMU 融合成「我在哪」，并顺手攒出一张三维点云地图。*

### 6.1 它到底在算什么

FAST-LIO（Fast LiDAR-Inertial Odometry）做的是**激光惯性里程计**：IMU 频率高但会漂移，雷达点云准但只有 10 Hz 且一帧内机器人在动。它用 IMU 做高频预测（猜下一刻在哪），再用当前点云和已有地图做匹配来修正这个猜测，两者在一个迭代扩展卡尔曼滤波（IEKF）里融合。

> [!NOTE] 预测步 与 更新步
> **预测**（`kf.predict`）：拿 IMU 的角速度/加速度积分，推算这段时间机器人怎么动的，同时把每个激光点补偿到帧末时刻（去畸变）。
>
> **更新**（`kf.update_iterated_dyn_share_modified`）：把这一帧点云变换到世界系，在地图里给每个点找 5 个最近邻、拟合出一个平面，用「点到平面的距离」当误差，反过来修正位姿。反复迭代几次直到收敛。
>
> 地图用 **ikd-Tree**（增量 k-d 树）存，支持边走边插点、删掉远处的点，不用每帧重建。

### 6.2 三个必须先认识的数据结构

**`src/FAST_LIO/include/use-ikfom.hpp（第 12-21 行）`** · 源码第 **12–21** 行

```cpp startLineNumber=12
MTK_BUILD_MANIFOLD(state_ikfom,
((vect3, pos))
((SO3, rot))
((SO3, offset_R_L_I))
((vect3, offset_T_L_I))
((vect3, vel))
((vect3, bg))
((vect3, ba))
((S2, grav))
);
```

**逐行拆解**

- **12–21** — **EKF 的 23 维状态量**：位置 `pos`、姿态 `rot`、雷达→IMU 外参旋转/平移、速度 `vel`、陀螺零偏 `bg`、加计零偏 `ba`、重力方向 `grav`。
- **15、16** — 外参也作为状态在线估计（由 yaml 的 `extrinsic_est_en` 控制），说明这套代码认可「安装误差可以被算法补偿」。
- **18、19** — 零偏（bias）是 IMU 的固有误差：静止时陀螺也应该读 0，实际会有一个小常数，必须估出来减掉。

**`src/FAST_LIO/include/common_lib.h（第 53-64 行）`** · 源码第 **53–64** 行

```cpp startLineNumber=53
struct MeasureGroup     // Lidar data and imu dates for the curent process
{
    MeasureGroup()
    {
        lidar_beg_time = 0.0;
        this->lidar.reset(new PointCloudXYZI());
    };
    double lidar_beg_time;
    double lidar_end_time;
    PointCloudXYZI::Ptr lidar;
    deque<sensor_msgs::msg::Imu::ConstSharedPtr> imu;
};
```

**逐行拆解**

- **53–64** — **一帧雷达 + 覆盖这帧时间段的全部 IMU** 打包成一个 `MeasureGroup`。这是主循环一次处理的数据单位。
- **60、61** — 本帧起止时间。IMU 数据按时间戳落在这个区间内才会被选进来。
- **62** — 点云容器，类型是 `PointCloudXYZI`（PCL 的 XYZ + intensity）。
- **63** — IMU 消息队列（双端队列）。

还有一个贯穿全工程的技巧：`preprocess.h:11` 定义 `typedef pcl::PointXYZINormal PointType;`，其中 **`curvature` 字段被借用来存「该点相对帧起点的时间偏移（毫秒）」**，`intensity` 存反射率。字段名和用途不一致，是 FAST-LIO 的经典写法，读代码时极易误解。

### 6.3 节点构造：声明参数、订阅、发布、服务、定时器

**`src/FAST_LIO/src/laserMapping.cpp（第 291-332 行，参数声明节选）`** · 源码第 **291–320** 行

```cpp startLineNumber=291
291    this->declare_parameter<bool>("publish.path_en", true);
292    this->declare_parameter<bool>("publish.effect_map_en", false);
293    this->declare_parameter<bool>("publish.map_en", false);
294    this->declare_parameter<bool>("publish.ikd_tree_en", false);
295    this->declare_parameter<bool>("publish.scan_publish_en", true);
296    this->declare_parameter<bool>("publish.dense_publish_en", true);
297    this->declare_parameter<bool>("publish.scan_bodyframe_pub_en", true);
298    this->declare_parameter<int>("max_iteration", 4);
299    this->declare_parameter<string>("map_file_path", "");
300    this->declare_parameter<string>("common.lid_topic", "/livox/lidar");
301    this->declare_parameter<string>("common.imu_topic", "/livox/imu");
302    this->declare_parameter<bool>("common.time_sync_en", false);
303    this->declare_parameter<double>("common.time_offset_lidar_to_imu", 0.0);
304    this->declare_parameter<string>("common.odom_frame_id", "odom");
305    this->declare_parameter<string>("common.sensor_frame_id", "sensor");
306    this->declare_parameter<string>("common.base_frame_id", "base_frame");
307    this->declare_parameter<bool>("common.send_odom_base_tf", false);
...
318    this->declare_parameter<double>("preprocess.blind", 0.01);
319    this->declare_parameter<int>("preprocess.lidar_type", AVIA);
320    this->declare_parameter<int>("preprocess.scan_line", 16);
321    this->declare_parameter<int>("preprocess.timestamp_unit", US);
322    this->declare_parameter<int>("preprocess.scan_rate", 10);
323    this->declare_parameter<int>("point_filter_num", 2);
324    this->declare_parameter<bool>("feature_extract_enable", false);
326    this->declare_parameter<bool>("mapping.extrinsic_est_en", true);
327    this->declare_parameter<bool>("pcd_save.pcd_save_en", false);
328    this->declare_parameter<int>("pcd_save.interval", -1);
331    this->declare_parameter<bool>("locate_in_prior_map", false);
332    this->declare_parameter<string>("prior_map_path", "");
```

**逐行拆解**

- **291–297** — 一组「要不要发布某类点云/轨迹」的开关，全部由 YAML 覆盖。注意 `publish.map_en` 源码默认 **false**，而建图 YAML 里改成 true——原因见 6.10 的坑。
- **298** — IEKF 迭代次数上限，YAML 里设成 3。
- **300、301** — 订阅的点云/IMU 话题，与第 04 章驱动输出一致。
- **303** — 雷达与 IMU 之间的时间偏置（外参标定得到），IMU 回调里会统一减掉它；不知道就填 0。
- **304–307** — 输出坐标系：`odom` / `sensor`(=`imu_link`) / `base_frame`(=`base_link`)。`send_odom_base_tf` 决定发不发 `odom → base_link`，两个 YAML 都开成 true。
- **318** — `blind`：滤掉距离雷达太近的点（打到机器人自己身上的）。YAML 设 0.5 m。
- **319** — `lidar_type = AVIA`（枚举值 1）在这里代表**所有 Livox CustomMsg 雷达**，包括 MID360。与 `xfer_format=1` 配套。
- **320–322** — 线数、时间戳单位、扫描频率。两份 YAML 的 `timestamp_unit: 3` 对应纳秒 NS。
- **323** — `point_filter_num`：每 N 个点留 1 个（抽稀），YAML 设 3。
- **324** — 关掉 LOAM 式角点/面点特征提取——FAST-LIO 直接用全部点做点到平面匹配。
- **326** — 是否在线估计雷达-IMU 外参。建图 YAML 设 false（认为已标定），重定位设 true。
- **327、328** — `pcd_save_en` 决定 `/map_save` 能不能写盘；`interval` 虽声明并读入，但**全文没有任何地方使用**（见 6.10）。
- **331、332** — **模式总开关**：`locate_in_prior_map` false=从零建图，true=加载先验 PCD 只定位；`prior_map_path` 是先验地图路径，launch 里会被 `prior_map` 参数覆盖。

**`src/FAST_LIO/src/laserMapping.cpp（第 422-454 行）`** · 源码第 **422–454** 行

```cpp startLineNumber=422
/*** ROS subscribe initialization ***/
if (p_pre->lidar_type == AVIA)
{
    sub_pcl_livox_ = this->create_subscription<livox_ros_driver2::msg::CustomMsg>(lid_topic, 20, std::bind(&LaserMappingNode::livox_pcl_cbk, this, std::placeholders::_1));
}
else
{
    sub_pcl_pc_ = this->create_subscription<sensor_msgs::msg::PointCloud2>(lid_topic, rclcpp::SensorDataQoS(), std::bind(&LaserMappingNode::standard_pcl_cbk, this, std::placeholders::_1));
}
if (locate_in_prior_map)
{
    sub_init_pose_ = this->create_subscription<geometry_msgs::msg::PoseWithCovarianceStamped>(
        "/localization_initial_pose", rclcpp::QoS(1).reliable().transient_local(),
        std::bind(&LaserMappingNode::initial_pose_cbk, this, std::placeholders::_1));
}
sub_imu_ = this->create_subscription<sensor_msgs::msg::Imu>(imu_topic, 10, std::bind(&LaserMappingNode::imu_cbk, this, std::placeholders::_1));
pubLaserCloudFull_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/cloud_registered", 20);
pubLaserCloudFull_body_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/cloud_registered_body", 20);
pubLaserCloudEffect_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/cloud_effected", 20);
pubLaserCloudMap_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/Laser_map", 20);
pubIkdTree_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/ikd_tree", 20);
pubOdomAftMapped_ = this->create_publisher<nav_msgs::msg::Odometry>("/Odometry", 20);
pubPath_ = this->create_publisher<nav_msgs::msg::Path>("/path", 20);
tf_broadcaster_ = std::make_unique<tf2_ros::TransformBroadcaster>(*this);
tf_buffer_ = std::make_shared<tf2_ros::Buffer>(this->get_clock());
tf_listener_ = std::make_shared<tf2_ros::TransformListener>(*tf_buffer_);

auto period_ms = std::chrono::milliseconds(static_cast<int64_t>(1000.0 / 100.0));
timer_ = rclcpp::create_timer(this, this->get_clock(), period_ms, std::bind(&LaserMappingNode::timer_callback, this));
auto map_period_ms = std::chrono::milliseconds(static_cast<int64_t>(1000.0));
map_pub_timer_ = rclcpp::create_timer(this, this->get_clock(), map_period_ms, std::bind(&LaserMappingNode::map_publish_callback, this));

map_save_srv_ = this->create_service<std_srvs::srv::Trigger>("map_save", std::bind(&LaserMappingNode::map_save_callback, this, std::placeholders::_1, std::placeholders::_2));
```

**逐行拆解**

- **423–430** — **按雷达类型二选一订阅**：`AVIA` 走 Livox `CustomMsg`，其他走标准 `PointCloud2`。本工程固定走 425 行。
- **431–436** — **只在定位模式**才订阅 `/localization_initial_pose`，且用 `transient_local` QoS——因为 ICP 只发一次，FAST-LIO 可能晚启动（第 09 章细讲）。
- **437** — IMU 订阅，队列深度 10。
- **438** — `/cloud_registered`：去畸变后变换到世界系的注册点云。**下游地形分析、OctoMap 链路全靠它**。
- **439** — `/cloud_registered_body`：保持在 IMU 体系的点云，用于保存单帧扫描做离线 ICP 自检。
- **441** — `/Laser_map`：逐帧累加的全局点云，PCD 地图的数据源。
- **443** — `/Odometry`：里程计。在 launch 里被 remap 成 `/state_estimation`。
- **445–447** — TF 广播器 + 监听器：既发 `odom → base_link`，也查 `sensor → base` 外参。
- **449、450** — **100 Hz 主定时器**——所有真正的计算都在 `timer_callback` 里，回调只负责把数据塞进缓冲区。这是实时系统常见的「生产者-消费者」架构。
- **451、452** — 1 Hz 定时器：发布累计地图 `/Laser_map`。
- **454** — `/map_save` 服务，类型 `std_srvs/srv/Trigger`（无参数、返回 success + message）。

| 方向 | 话题 / 服务 | 内容 | 谁在用 |
| --- | --- | --- | --- |
| 订阅 | `/livox/lidar` | `CustomMsg` 点云 | 驱动 |
| 订阅 | `/livox/imu` | `Imu` | 驱动 |
| 订阅 | `/localization_initial_pose` | 初始位姿（仅定位模式） | ICP 中继 |
| 发布 | `/cloud_registered` | 世界系注册点云 | 地形分析、OctoMap 链路 |
| 发布 | `/Odometry` → `/state_estimation` | 位姿 + 速度 | 地形分析、Nav2、门控脚本 |
| 发布 | `/Laser_map` | 累计点云（1 Hz） | RViz、PCD 保存 |
| 发布 | `/path` | 轨迹 | RViz |
| 发布 TF | `odom → base_link` | 动态位姿 | 整棵 TF 树 |
| 服务 | `/map_save` | 写 PCD 到磁盘 | 人工调用 |

### 6.4 回调函数只做一件事：把数据塞进缓冲区

**`src/FAST_LIO/src/laserMapping.cpp（第 675-716 行，Livox 点云回调）`** · 源码第 **675–711** 行

```cpp startLineNumber=675
void livox_pcl_cbk(const livox_ros_driver2::msg::CustomMsg::UniquePtr msg)
{
    if (locate_in_prior_map && !initial_pose_received)
    {
        return;
    }
    mtx_buffer.lock();
    double cur_time = get_time_sec(msg->header.stamp);
    double preprocess_start_time = omp_get_wtime();
    scan_count++;
    if (!is_first_lidar && cur_time < last_timestamp_lidar)
    {
        std::cerr << "lidar loop back, clear buffer" << std::endl;
        lidar_buffer.clear();
    }
    if (is_first_lidar)
    {
        is_first_lidar = false;
    }
    last_timestamp_lidar = cur_time;

    if (!time_sync_en && abs(last_timestamp_imu - last_timestamp_lidar) > 10.0 && !imu_buffer.empty() && !lidar_buffer.empty())
    {
        printf("IMU and LiDAR not Synced, IMU time: %lf, lidar header time: %lf \n", last_timestamp_imu, last_timestamp_lidar);
    }

    if (time_sync_en && !timediff_set_flg && abs(last_timestamp_lidar - last_timestamp_imu) > 1 && !imu_buffer.empty())
    {
        timediff_set_flg = true;
        timediff_lidar_wrt_imu = last_timestamp_lidar + 0.1 - last_timestamp_imu;
        printf("Self sync IMU and LiDAR, time diff is %.10lf \n", timediff_lidar_wrt_imu);
    }

    PointCloudXYZI::Ptr ptr(new PointCloudXYZI());
    p_pre->process(msg, ptr);
    lidar_buffer.push_back(ptr);
    time_buffer.push_back(last_timestamp_lidar);
```

**逐行拆解**

- **677–680** — 定位模式下**没收到初始位姿就丢弃所有点云**——FAST-LIO 会一直等 ICP，不会用错误的初值乱算。
- **681** — 加锁，保护多线程共享的缓冲区（回调线程写、主循环读）。
- **682–684** — 取时间戳、记录处理耗时、帧计数。
- **685–689** — **时间回绕检测**：如果新帧时间戳比上一帧还小，说明雷达时钟重置/回放跳变，清空缓冲区重新来。
- **696–699** — 未开软件同步时，若 IMU 与雷达时间差超过 10 秒就打印警告（不中断）。
- **701–706** — 开启 `time_sync_en` 时，用第一次观测估计两者时间差并补偿。本工程两个 YAML 都是 false（依赖硬件/驱动时间）。
- **708–711** — **核心两行**：`p_pre->process(msg, ptr)` 把 ROS 消息转成 PCL 点云并打上逐点时间；然后压入 `lidar_buffer` 和 `time_buffer`。

**`src/FAST_LIO/src/laserMapping.cpp（第 718-749 行，IMU 回调）`** · 源码第 **718–749** 行

```cpp startLineNumber=718
void imu_cbk(const sensor_msgs::msg::Imu::UniquePtr msg_in)
{
    if (locate_in_prior_map && !initial_pose_received)
    {
        return;
    }
    publish_count++;
    sensor_msgs::msg::Imu::SharedPtr msg(new sensor_msgs::msg::Imu(*msg_in));

    msg->header.stamp = get_ros_time(get_time_sec(msg_in->header.stamp) - time_diff_lidar_to_imu);
    if (abs(timediff_lidar_wrt_imu) > 0.1 && time_sync_en)
    {
        msg->header.stamp =
            rclcpp::Time(timediff_lidar_wrt_imu + get_time_sec(msg_in->header.stamp));
    }

    double timestamp = get_time_sec(msg->header.stamp);

    mtx_buffer.lock();

    if (timestamp < last_timestamp_imu)
    {
        std::cerr << "lidar loop back, clear buffer" << std::endl;
        imu_buffer.clear();
    }

    last_timestamp_imu = timestamp;

    imu_buffer.push_back(msg);
    mtx_buffer.unlock();
    sig_buffer.notify_all();
}
```

**逐行拆解**

- **727** — 把 IMU 时间戳统一减去 `time_offset_lidar_to_imu`（yaml 里 0.0）。这是外参标定得到的时间偏置，**不管有没有开软件同步都会生效**。
- **728–732** — 开启软件同步时再叠加估计出的时差。
- **738–742** — 同样的时间回绕保护。
- **746–748** — 压入 `imu_buffer`，解锁，并用 `sig_buffer.notify_all()` 唤醒等待中的主循环。

`sync_packages()`（第 753-807 行）负责把「一帧点云 + 时间戳落在这帧区间内的所有 IMU」打包成 `MeasureGroup`。帧结束时间由最后一个点的 `curvature`（逐点时间偏移，单位毫秒）推算。如果最新 IMU 时间还没覆盖到帧末，就返回 false，主循环这轮什么都不做——**保证不会拿不完整的 IMU 数据硬算**。

### 6.5 主循环 timer_callback：把所有零件串起来

**`src/FAST_LIO/src/laserMapping.cpp（第 1057-1084 行）`** · 源码第 **1057–1084** 行

```cpp startLineNumber=1057
void timer_callback()
{
    if (locate_in_prior_map && !initial_pose_received)
    {
        RCLCPP_INFO_THROTTLE(this->get_logger(), *this->get_clock(), 3000, "Waiting for initial pose...");
        return;
    }
    if (sync_packages(Measures))
    {
        if (flg_first_scan)
        {
            first_lidar_time = Measures.lidar_beg_time;
            p_imu->first_lidar_time = first_lidar_time;
            flg_first_scan = false;
            return;
        }

        double t0, t1, t2, t3, t4, t5, match_start, solve_start, svd_time;

        match_time = 0;
        kdtree_search_time = 0.0;
        solve_time = 0;
        solve_const_H_time = 0;
        svd_time = 0;
        t0 = omp_get_wtime();
        p_imu->Process(Measures, kf, feats_undistort);
        state_point = kf.get_x();
        pos_lid = state_point.pos + state_point.rot * state_point.offset_T_L_I;
```

**逐行拆解**

- **1059–1063** — 定位模式等待初始位姿，每 3 秒打印一次「Waiting for initial pose...」。**如果你在日志里反复看到这句，说明 ICP 没成功或 QoS 没对上**。
- **1064** — `sync_packages` 成功才继续（数据齐了）。
- **1066–1072** — 第一帧只记录起始时间就返回，不做估计——留给 IMU 初始化。
- **1074–1081** — 一堆耗时统计变量（用于写性能日志）。
- **1082** — **IMU 处理 + 去畸变**：`p_imu->Process()` 内部先跑 `IMU_init`（静止 10 帧估重力/零偏），再跑 `UndistortPcl`。
- **1083、1084** — 取出 EKF 状态，算出雷达中心的世界位置（位置 + 旋转×外参平移）。

**`src/FAST_LIO/src/laserMapping.cpp（第 1176-1210 行，更新与发布）`** · 源码第 **1176–1205** 行

```cpp startLineNumber=1176
1176            /*** iterated state estimation ***/
1177            double t_update_start = omp_get_wtime();
1178            double solve_H_time = 0;
1179            kf.update_iterated_dyn_share_modified(LASER_POINT_COV, solve_H_time);
1180            state_point = kf.get_x();
1181            euler_cur = SO3ToEuler(state_point.rot);
1182            pos_lid = state_point.pos + state_point.rot * state_point.offset_T_L_I;
1183            geoQuat.x = state_point.rot.coeffs()[0];
...
1190            /******* Publish odometry *******/
1191            publish_odometry(pubOdomAftMapped_);
1192
1193            /*** add the feature points to map kdtree ***/
1194            t3 = omp_get_wtime();
1195            if (!locate_in_prior_map)
1196            {
1197                map_incremental();
1198            }
1199            t5 = omp_get_wtime();
1200
1201            /******* Publish points *******/
1202            if (path_en)
1203                publish_path(pubPath_);
1204            if (scan_pub_en)
1205                publish_frame_world(pubLaserCloudFull_);
1206            if (scan_pub_en && scan_body_pub_en)
1207                publish_frame_body(pubLaserCloudFull_body_);
1208            if (effect_pub_en)
1209                publish_effect_world(pubLaserCloudEffect_);
1210
```

**逐行拆解**

- **1179** — **IEKF 迭代更新**（观测步）：用点到平面残差修正状态。前面 `kf.init_dyn_share(...)` 把 `h_share_model` 注册成了观测模型。
- **1191** — 发布 `/Odometry`（实际是 `/state_estimation`）并广播 `odom → base_link` TF。
- **1195–1198** — **只有建图模式才往地图里加点**。定位模式下 ikd-Tree 里始终只有先验 PCD 的点，不会被实时扫描污染。
- **1202–1209** — 按开关发布轨迹、世界系点云、机体系点云、有效特征点。

### 6.6 先验地图定位：初始位姿唯一被使用的地方

**`src/FAST_LIO/src/laserMapping.cpp（第 1106-1139 行）`** · 源码第 **1106–1140** 行

```cpp startLineNumber=1106
if (ikdtree.Root_Node == nullptr)
{
    RCLCPP_INFO_ONCE(this->get_logger(), "Initialize the map kdtree");
    if (locate_in_prior_map)
    {
        // if (!initial_pose_received)
        // {
        //     RCLCPP_INFO_THROTTLE(this->get_logger(), *this->get_clock(), 3000, "Waiting for initial pose...");
        //     return;
        // }
        tf2::Transform trans;
        tf2::fromMsg(initial_pose.pose.pose, trans);
        pcl_ros::transformPointCloud(*feats_down_prior_map, *feats_down_prior_map, trans.inverse());

        // puiblish the transformed prior map
        sensor_msgs::msg::PointCloud2 prior_map_msg;
        pcl::toROSMsg(*feats_down_prior_map, prior_map_msg);
        prior_map_msg.header.stamp = this->get_clock()->now();
        prior_map_msg.header.frame_id = odom_frame;
        pubLaserCloudMap_->publish(prior_map_msg);

        ikdtree.Build(feats_down_prior_map->points);
    }
    else if (feats_down_size > 5)
    {
        ikdtree.set_downsample_param(filter_size_map_min);
        feats_down_world->resize(feats_down_size);
        for (int i = 0; i < feats_down_size; i++)
        {
            pointBodyToWorld(&(feats_down_body->points[i]), &(feats_down_world->points[i]));
        }
        ikdtree.Build(feats_down_world->points);
    }
    return;
}
```

**逐行拆解**

- **1106** — 只在 ikd-Tree 还没建（第一帧）时进入。
- **1109–1118** — **定位模式的核心**：把 ICP 给的初始位姿转成 `tf2::Transform`，然后取 **逆变换** `trans.inverse()` 把 `map` 系的先验点云搬到本次启动的 `odom` 系。
- **1116–1118** — 为什么要取逆？因为 `/localization_initial_pose` 表示的是「扫描原点在 map 中的位置」，而先验 PCD 的点坐标是 map 系的；要拿它当本次 odom 下的匹配目标，得反向变换。
- **1121–1125** — 把变换后的先验地图也发一份到 `/Laser_map`，方便在 RViz 里对照。
- **1127** — 用这份先验点云计算建 ikd-Tree，作为后续所有帧的匹配目标。
- **1129–1138** — **建图模式**的另一分支：没有先验地图，就用第一帧自己的点建树，从零开始长地图。
- **1139** — 初始化完直接返回，下一轮定时器才开始正常估计。

**`src/FAST_LIO/src/laserMapping.cpp（第 456-468 行，加载 PCD）`** · 源码第 **456–468** 行

```cpp startLineNumber=456
if (locate_in_prior_map)
{
    RCLCPP_INFO(this->get_logger(), "Loading prior map...");
    // load prior map
    if (pcl::io::loadPCDFile<PointType>(prior_map_path, *prior_map) < 0 || prior_map->empty())
    {
        throw std::runtime_error("FAST-LIO prior map is missing or empty: " + prior_map_path);
    }
    // downsample the prior map
    downSizeFilterMap.setInputCloud(prior_map);
    downSizeFilterMap.filter(*feats_down_prior_map);
}
RCLCPP_INFO(this->get_logger(), "Node init finished.");
```

**逐行拆解**

- **460–463** — 按 `PointType = pcl::PointXYZINormal` 读 PCD；文件缺失或为空**直接抛异常**，节点起不来。所以 ICP 和 FAST-LIO 必须指向同一份能读的 PCD。
- **465、466** — 用体素滤波给先验地图降采样，减少匹配计算量。

**`src/FAST_LIO/src/laserMapping.cpp（第 1265-1270 行）`** · 源码第 **1265–1270** 行

```cpp startLineNumber=1265
void initial_pose_cbk(const geometry_msgs::msg::PoseWithCovarianceStamped::SharedPtr msg)
{
    if (initial_pose_received) return;
    initial_pose = *msg;
    initial_pose_received = true;
}
```

**逐行拆解**

- **1267** — **只接受一次**初始位姿，之后再来的一律忽略，防止运行中被人误发位姿把定位搞乱。

### 6.7 预处理：CustomMsg → 带逐点时间的 PCL 点云

**`src/FAST_LIO/src/preprocess.cpp（第 166-190 行，avia_handler 的无特征提取分支）`** · 源码第 **166–190** 行

```cpp startLineNumber=166
else
{
  for (uint i = 1; i < plsize; i++)
  {
    if ((msg->points[i].line < N_SCANS) &&
        ((msg->points[i].tag & 0x30) == 0x10 || (msg->points[i].tag & 0x30) == 0x00))
    {
      valid_num++;
      if (valid_num % point_filter_num == 0)
      {
        pl_full[i].x = msg->points[i].x;
        pl_full[i].y = msg->points[i].y;
        pl_full[i].z = msg->points[i].z;
        pl_full[i].intensity = msg->points[i].reflectivity;
        pl_full[i].curvature = msg->points[i].offset_time /
                               float(1000000); // use curvature as time of each laser points, curvature unit: ms

        if ((abs(pl_full[i].x - pl_full[i - 1].x) > 1e-7) || (abs(pl_full[i].y - pl_full[i - 1].y) > 1e-7) || (abs(pl_full[i].z - pl_full[i - 1].z) > 1e-7) && (pl_full[i].x * pl_full[i].x + pl_full[i].y * pl_full[i].y + pl_full[i].z * pl_full[i].z > (blind * blind)))
        {
          pl_surf.push_back(pl_full[i]);
        }
      }
    }
  }
}
```

**逐行拆解**

- **166–168** — 因为 yaml 里 `feature_extract_enable: false`，走的是这个 else 分支：不做角点/面点提取，逐点处理。
- **170** — `line < N_SCANS`：只保留前 N 线（重定位 YAML 是 4，建图是 16）。
- **171** — `tag & 0x30` 位运算过滤噪点：只保留标记为 `0x10` 或 `0x00` 的有效点。
- **173–175** — `valid_num % point_filter_num == 0`：每 3 个有效点留 1 个，降采样。
- **176–179** — 拷贝 xyz，把 `reflectivity` 写进 `intensity`。
- **180、181** — **最关键一行**：`curvature = offset_time / 1e6`，把纳秒时间偏移换成毫秒，借 `curvature` 字段存起来。去畸变全靠它。
- **183** — 过滤与上一点重合的点，以及距离小于 `blind`（0.5 m）的近处点。注意这里 `&&` 优先级高于 `||`，实际只有 z 变化分支才检查盲区——这是上游代码的既有写法。
- **185** — 把合格的点放进 `pl_surf`，最终由 `process()` 赋给输出点云。

### 6.8 去畸变：为什么一帧点云需要「逐点搬回同一时刻」

**`src/FAST_LIO/src/IMU_Processing.hpp（第 212-224 行）`** · 源码第 **212–224** 行

```cpp startLineNumber=212
void ImuProcess::UndistortPcl(const MeasureGroup &meas, esekfom::esekf<state_ikfom, 12, input_ikfom> &kf_state, PointCloudXYZI &pcl_out)
{
  /*** add the imu of the last frame-tail to the of current frame-head ***/
  auto v_imu = meas.imu;
  v_imu.push_front(last_imu_);
  const double &imu_beg_time = rclcpp::Time(v_imu.front()->header.stamp).seconds();
  const double &imu_end_time = rclcpp::Time(v_imu.back()->header.stamp).seconds();
  const double &pcl_beg_time = meas.lidar_beg_time;
  const double &pcl_end_time = meas.lidar_end_time;

  /*** sort point clouds by offset time ***/
  pcl_out = *(meas.lidar);
  sort(pcl_out.points.begin(), pcl_out.points.end(), time_list);
```

**逐行拆解**

- **215、216** — 把上一帧末尾的最后一条 IMU 补到本帧头部，保证时间区间连续（否则两帧之间会缺一小段积分）。
- **217–220** — 取出 IMU 与本帧点云的起止时间。
- **223、224** — 按 `curvature`（也就是逐点时间偏移）**排序点云**，后面才能按时间顺序回溯补偿。

**`src/FAST_LIO/src/IMU_Processing.hpp（第 301-338 行，反向补偿）`** · 源码第 **301–325** 行

```cpp startLineNumber=301
301  /*** undistort each lidar point (backward propagation) ***/
302  if (pcl_out.points.begin() == pcl_out.points.end())
303    return;
304  auto it_pcl = pcl_out.points.end() - 1;
305  for (auto it_kp = IMUpose.end() - 1; it_kp != IMUpose.begin(); it_kp--)
306  {
307    auto head = it_kp - 1;
308    auto tail = it_kp;
...
316    for (; it_pcl->curvature / double(1000) > head->offset_time; it_pcl--)
317    {
318      dt = it_pcl->curvature / double(1000) - head->offset_time;
319
320      /* Transform to the 'end' frame, using only the rotation
321       * Note: Compensation direction is INVERSE of Frame's moving direction */
324      M3D R_i(R_imu * Exp(angvel_avr, dt));
325
326      V3D P_i(it_pcl->x, it_pcl->y, it_pcl->z);
327      V3D T_ei(pos_imu + vel_imu * dt + 0.5 * acc_imu * dt * dt - imu_state.pos);
328      V3D P_compensate = imu_state.offset_R_L_I.conjugate() * (imu_state.rot.conjugate() * (R_i * (imu_state.offset_R_L_I * P_i + imu_state.offset_T_L_I) + T_ei) - imu_state.offset_T_L_I); // not accurate!
329
331      // save Undistorted points and their rotation
332      it_pcl->x = P_compensate(0);
333      it_pcl->y = P_compensate(1);
334      it_pcl->z = P_compensate(2);
```

**逐行拆解**

- **304–308** — 从点云**末尾**（最新点）往前遍历，同时按 IMU 记录的时间段倒着走。
- **316–318** — 取出落在这个 IMU 区间内的所有点，`dt` 是该点相对区间起点的时间差（毫秒转秒）。
- **320、321** — 注释点明：补偿方向与机器人运动方向**相反**——我们要把点从「采集时刻的坐标系」搬回「帧末统一坐标系」。
- **324–328** — 用 IMU 递推出的位姿（`R_i`、`T_ei`）和雷达-IMU 外参做完整的坐标变换。源码自己在行尾标了 `// not accurate!`（近似），说明这是工程近似解。
- **331–334** — 把算出的新坐标写回这个点。全部点处理完，整帧点云就等价于「同一瞬间拍下的」。

> [!TIP] IMU 初始化为什么要「保持静止」
> `IMU_init()` 用前 10 帧 IMU 的加速度均值来估计重力方向和零偏。只有机器人静止时，加速度均值才等于纯重力。所以 `README_USAGE.md` 要求启动后先别动车，等日志打印 `IMU Initial Done` 再走。

### 6.9 三个输出函数：/Odometry、/cloud_registered、/Laser_map

**`src/FAST_LIO/src/laserMapping.cpp（第 975-980、1024-1039 行）`** · 源码第 **975–992** 行

```cpp startLineNumber=975
 975    void publish_odometry(const rclcpp::Publisher<nav_msgs::msg::Odometry>::SharedPtr pubOdomAftMapped)
 976    {
 977        odomAftMapped.header.frame_id = odom_frame;
 978        odomAftMapped.child_frame_id = sensor_frame;
 979        odomAftMapped.header.stamp = get_ros_time(lidar_end_time);
 980        set_posestamp(odomAftMapped.pose);
...
1024        geometry_msgs::msg::TransformStamped trans;
1025        trans.header.frame_id = odom_frame;
1026        trans.header.stamp = odomAftMapped.header.stamp;
1027        trans.child_frame_id = sensor_frame;
1028        if (send_odom_base_tf)
1029        {
1030            trans.child_frame_id = base_frame;
1031        }
1032        trans.transform.translation.x = odomAftMapped.pose.pose.position.x;
...
1039        tf_broadcaster_->sendTransform(trans);
```

**逐行拆解**

- **977–979** — 填充消息头：父帧 `odom`，子帧 `sensor`（或 `base_link`），时间戳用本帧结束时间。
- **1024–1031** — 构造 TF 变换。当 `send_odom_base_tf=true`，子帧改成 `base_frame`，即发布 `odom → base_link`。
- **1032–1039** — 把位姿写进变换并广播。这就是整棵 TF 树里那条动态边。

**`src/FAST_LIO/src/laserMapping.cpp（第 862-885 行）`** · 源码第 **862–885** 行

```cpp startLineNumber=862
void publish_frame_world(rclcpp::Publisher<sensor_msgs::msg::PointCloud2>::SharedPtr pubLaserCloudFull)
{
    if (scan_pub_en)
    {
        PointCloudXYZI::Ptr laserCloudFullRes(dense_pub_en ? feats_undistort : feats_down_body);
        int size = laserCloudFullRes->points.size();
        PointCloudXYZI::Ptr laserCloudWorld(
            new PointCloudXYZI(size, 1));

        for (int i = 0; i < size; i++)
        {
            RGBpointBodyToWorld(&laserCloudFullRes->points[i],
                                &laserCloudWorld->points[i]);
        }

        sensor_msgs::msg::PointCloud2 laserCloudmsg;
        pcl::toROSMsg(*laserCloudWorld, laserCloudmsg);
        // laserCloudmsg.header.stamp = ros::Time().fromSec(lidar_end_time);
        laserCloudmsg.header.stamp = get_ros_time(lidar_end_time);
        laserCloudmsg.header.frame_id = odom_frame;
        pubLaserCloudFull->publish(laserCloudmsg);
        publish_count -= PUBFRAME_PERIOD;
    }
}
```

**逐行拆解**

- **866** — `dense_pub_en` 决定发全部去畸变点还是只发下采样点。
- **871–875** — 逐点调用 `RGBpointBodyToWorld`，用当前最优位姿把点从机体系变换到世界系（`odom`）。
- **877–882** — 转成 ROS 消息，打上时间戳和 `frame_id = odom`，发布到 `/cloud_registered`。

### 6.10 /map_save 服务，以及三个真实的坑

**`src/FAST_LIO/src/laserMapping.cpp（第 957-961、1243-1263、1273-1288 行）`** · 源码第 **957–998** 行

```cpp startLineNumber=957
957    void save_to_pcd()
958    {
959        pcl::PCDWriter pcd_writer;
960        pcd_writer.writeBinary(map_file_path, *pcl_wait_pub);
961    }
...
1243    void map_publish_callback()
1244    {
1245        if (map_pub_en)
1246            publish_map(pubLaserCloudMap_);
1247    }
1248
1249    void map_save_callback(std_srvs::srv::Trigger::Request::ConstSharedPtr req, std_srvs::srv::Trigger::Response::SharedPtr res)
1250    {
1251        RCLCPP_INFO(this->get_logger(), "Saving map to %s...", map_file_path.c_str());
1252        if (pcd_save_en)
1253        {
1254            save_to_pcd();
1255            res->success = true;
1256            res->message = "Map saved.";
1257        }
1258        else
1259        {
1260            res->success = false;
1261            res->message = "Map save disabled.";
1262        }
1263    }
...
1273 int main(int argc, char **argv)
1274 {
1275     rclcpp::init(argc, argv);
1276
1277     rclcpp::spin(std::make_shared<LaserMappingNode>());
1278     /**************** save map ****************/
1281     if (pcl_wait_pub->size() > 0 && pcd_save_en)
1282     {
1283         string file_name = string("scans.pcd");
1284         string all_points_dir(string(string(ROOT_DIR) + "PCD/") + file_name);
1285         pcl::PCDWriter pcd_writer;
1286         cout << "current scan saved to /PCD/" << file_name << endl;
1287         pcd_writer.writeBinary(all_points_dir, *pcl_wait_pub);
1288     }
```

**逐行拆解**

- **957–961** — 写盘就是把全局累计点云 `pcl_wait_pub` 用 `PCDWriter::writeBinary` 写到 `map_file_path`（yaml 默认 `./test.pcd`，相对当前工作目录）。
- **1243–1247** — 1 Hz 定时器只有在 `map_pub_en=true` 时才调用 `publish_map()`。
- **1249–1263** — 服务回调：`pcd_save_en` 开了才写，否则返回 `success=false, "Map save disabled."`。
- **1273–1277** — `main()` 极简：init → spin → 收尾。所有实际工作都在定时器回调里。
- **1281–1288** — 程序正常退出时还会**额外**写一份 `src/FAST_LIO/PCD/scans.pcd`，路径与 `map_file_path` 不同，容易找错文件。

> [!CAUTION] 坑 1：pcd_save.interval 是个摆设
> 第 328 行声明并读入了 `pcd_save.interval`，注释说「每 N 帧存一个文件」，但**全文没有任何地方使用它**。实际行为是「所有帧累加进一个 `pcl_wait_pub`，一次性写出」。地图大时可能吃光内存。

> [!CAUTION] 坑 2：只开 pcd_save_en 会存出空地图
> `pcl_wait_pub` 只在 `publish_map()` 里累加（第 939 行 `*pcl_wait_pub += *laserCloudWorld;`），而 `publish_map()` 只在 `map_pub_en=true` 时被 1 Hz 定时器调用。所以 **`publish.map_en` 和 `pcd_save.pcd_save_en` 必须同时为 true**，否则 `/map_save` 写出一个空文件。README_USAGE.md §4.1 专门让人先 `ros2 param get` 这两个开关。

> [!WARNING] 坑 3：服务名与路径
> 源码里服务是相对名 `"map_save"`，命令行用 `/map_save`；`map_file_path` 默认 `./test.pcd` 相对于**你启动节点的当前目录**。退出时另写的 `scans.pcd` 在 `FAST_LIO/PCD/` 下。三个路径别搞混。

### 6.11 两份参数文件：建图 vs 重定位

**`src/sentry_bringup/params/fast_lio_mapping_param.yaml（全文）`** · 源码第 **1–53** 行

```yaml
 1 /**:
 2     ros__parameters:
 3         locate_in_prior_map: false
 4         feature_extract_enable: false
 5         point_filter_num: 3
 6         max_iteration: 3
 7         filter_size_surf: 0.5
 8         filter_size_map: 0.5
 9         cube_side_length: 1000.0
10         runtime_pos_log_enable: false
11         map_file_path: "./test.pcd"
12
13         common:
14             odom_frame_id: "odom"
15             sensor_frame_id: "imu_link"
16             base_frame_id: "base_link"
17             send_odom_base_tf: true
18             lid_topic:  "/livox/lidar"
19             imu_topic:  "/livox/imu"
20             time_sync_en: false
21             time_offset_lidar_to_imu: 0.0
...
24         preprocess:
25             lidar_type: 1
26             scan_line:  16
27             blind: 0.5
28             timestamp_unit: 3
29             scan_rate: 10
30
31         mapping:
32             acc_cov: 0.1
33             gyr_cov: 0.1
34             b_acc_cov: 0.0001
35             b_gyr_cov: 0.0001
36             fov_degree:    360.0
37             det_range:     57.0
38             extrinsic_est_en:  false
39             extrinsic_T: [ -0.011, -0.02329, 0.04412 ]
40             extrinsic_R: [ 1., 0., 0.,
41                            0., 1., 0.,
42                            0., 0., 1.]
43
44         publish:
45             path_en: true
46             effect_map_en: true
47             map_en: true
48             scan_publish_en:  true
49             dense_publish_en: true
50             scan_bodyframe_pub_en: true
51
52         pcd_save:
53             pcd_save_en: true
54             interval: -1
```

**逐行拆解**

- **1、2** — `/**:` 是 ROS 2 参数 YAML 的**通配节点名**写法，对任意节点名都生效；`ros__parameters` 是固定键。
- **3** — **建图模式**：不加载先验地图，从零开始。
- **4–6** — 关特征提取、每 3 点留 1、IEKF 迭代 3 次。
- **7–9** — 两个体素滤波器叶子尺寸 0.5 m；局部地图立方体边长 1000 m（很大，基本不裁剪）。
- **11** — PCD 输出路径 `./test.pcd`。
- **14–17** — 输出坐标系 `odom` / `imu_link` / `base_link`，并广播 `odom → base_link`。
- **18–21** — 输入话题与驱动一致；不做软件时间同步，时间偏置 0。
- **25–29** — `lidar_type: 1` = AVIA/CustomMsg；16 线；盲区 0.5 m；`timestamp_unit: 3` = 纳秒；10 Hz。
- **32–35** — IMU 噪声协方差与零偏随机游走协方差（EKF 的 Q 矩阵来源）。
- **36–38** — 视场 360°、检测距离 57 m；建图时**不在线估计外参**（认为已标定好）。
- **39–42** — 雷达→IMU 平移 `[-0.011,-0.02329,0.04412]` 与旋转单位阵。注意与 URDF 的 `lidar_link → imu_link` 平移是**反方向**。
- **44–50** — **`map_en: true` 是存图的前提**（见坑 2）；同时开轨迹、有效点、稠密点云等输出。
- **52–54** — 允许 `/map_save` 写盘；`interval` 无效。

| 参数 | 建图 `fast_lio_mapping_param.yaml` | 重定位 `fast_lio_relocalization_param.yaml` | 为什么 |
| --- | --- | --- | --- |
| `locate_in_prior_map` | `false` | `true` | 建图从零开始；定位加载先验 PCD |
| `prior_map_path` | 无此项 | `GlobalMap.pcd`（launch 会覆盖） | 只有定位需要地图 |
| `preprocess.scan_line` | `16` | `4` | 定位时先验地图已降采样，少线数够用，省算力 |
| `mapping.det_range` | `57.0` | `100.0` | 定位时可匹配更远的先验结构 |
| `mapping.extrinsic_est_en` | `false` | `true` | 建图时外参视为已标定；定位时允许在线补偿安装误差 |
| `publish.path_en` | `true` | `false` | 建图需要轨迹可视化 |
| `publish.effect_map_en` | `true` | `false` | 建图调试匹配点 |
| `publish.map_en` | **`true`** | `false` | **建图必须开**，否则存不出 PCD |
| `pcd_save.pcd_save_en` | `true` | `false` | 建图要存；定位禁止覆盖已有地图 |

另外 `FAST_LIO/config/mid360.yaml` 与 `mid360_pri.yaml` 是上游包自带配置，被 `FAST_LIO/launch/mapping.launch.py` 引用；工程实际使用的是 `sentry_bringup/params/` 下这两份。

> [!WARNING] 参数名必须与 declare_parameter 完全一致
> 包含 `common.`、`mapping.`、`publish.`、`pcd_save.` 这些命名空间前缀。拼错不会报错，会**静默使用代码里的默认值**——这是调 ROS 2 参数时最隐蔽的坑。用 `ros2 param get /laser_mapping_node publish.map_en` 验证真正生效的值。

---

## 07 · 地形分析：把「离地多高」塞进 intensity

*这是整个工程最巧妙、也最反直觉的一环，理解它才能看懂第 13 章的自定义代价地图插件。*

### 7.1 为什么不能直接用原始点云当代价地图

Nav2 原生障碍层只会按点的 **绝对高度 z** 判断是不是障碍。但真实场地有坡、有台阶、有斜坡：一个在坡上、z=0.4 m 的地面点，按高度看像障碍，其实可以走；一个在坑底、z=0.1 m 的凸起，按高度看像地面，其实会卡住底盘。

> [!NOTE] 解决办法：先估地面，再算相对高度
> `terrain_analysis` 把点云投到一张局部平面栅格里，对每个格子取所有点高度的**分位数**作为「这个位置的地面高度」，然后对每个点计算 `disZ = 点.z − 该格地面高度`。地面点 disZ≈0，障碍物 disZ 大。
>
> 最后把这个 `disZ` **写进点云的 `intensity` 字段**发出去。下游的自定义插件不看 z，只看 intensity，就能准确区分「坡」和「障碍」。

### 7.2 intensity 字段的三次变身（务必记住）

1. **① 输入时：临时当时间戳**：`laserCloudHandler` 里写 `point.intensity = laserCloudTime - systemInitTime`。后面判断「这个点是不是过期了」就靠它做时间差比较。
2. **② 输出时：当相对地面高度**：生成 `/terrain_map`（普通版）或 `/terrain_map_ext`（扩展版）时，把 `disZ` 写回 intensity。地面≈0，障碍越大越高。
3. **③ 建图支路：和 z 互换**：`exchangeField` 把 z 与 intensity 对调，让 OctoMap 按「相对地面高度」投影二维栅格（第 08 章）。

> The terrain analysis publishes 'sensor_msgs::PointCloud2' typed terrain map messages on ROS topic '/terrain_map', with 'pcl::PointXYZI' typed points in the messages. the larger the i value, the further this point is from the computed ground.
>
> —— src/autonomous_exploration_development_environment/README.md

### 7.3 订阅、发布与参数

**`src/.../terrain_analysis/src/terrainAnalysis.cpp（第 325-333 行）`** · 源码第 **325–333** 行

```cpp startLineNumber=325
auto subOdometry = nh->create_subscription<nav_msgs::msg::Odometry>("/state_estimation", 5, odometryHandler);

auto subLaserCloud = nh->create_subscription<sensor_msgs::msg::PointCloud2>("/registered_scan", 5, laserCloudHandler);

auto subJoystick = nh->create_subscription<sensor_msgs::msg::Joy>("/joy", 5, joystickHandler);

auto subClearing = nh->create_subscription<std_msgs::msg::Float32>("/map_clearing", 5, clearingHandler);

auto pubLaserCloud = nh->create_publisher<sensor_msgs::msg::PointCloud2>("/terrain_map", 2);
```

**逐行拆解**

- **325** — 订阅 `/state_estimation`（FAST-LIO 的 `/Odometry` remap 后），拿机器人当前位置和姿态。
- **327** — 订阅 `/registered_scan`，但 XML launch 里 `<remap from="/registered_scan" to="/cloud_registered"/>` 把它接到 FAST-LIO 的注册点云。**代码里写的名字和实际接的名字不一样**，这是 remap 在起作用。
- **329–331** — 手柄、清图指令两个可选输入。
- **333** — **输出 `/terrain_map`**，队列深度 2。它就是 Nav2 局部代价地图的数据源。

| 参数（源码默认） | 值 | 含义 |
| --- | --- | --- |
| `scanVoxelSize` | 0.05（launch 改 0.08） | 点云下采样体素边长 |
| `decayTime` | 2.0（launch 改 0.5） | 点存活时间（秒），超时丢弃 |
| `useSorting` | true | **开这个才能上坡**：用分位数而不是最低点当地面 |
| `quantileZ` | 0.25（launch 改 0.4） | 取高度的 40% 分位数作为地面 |
| `considerDrop` | false | 是否把「凹下去」也算障碍（对 disZ 取绝对值） |
| `vehicleHeight` | 1.5（launch 同） | 轮胎底部到传感器中心的距离；只有 `disZ < 1.5` 的点才输出 |
| `minRelZ` / `maxRelZ` | -1.5 / 0.2（launch 改 -2.5 / 2.5） | 点云有效高度范围，用来滤掉天花板和地板 |
| `terrainVoxelWidth` / `size` | 21 × 1.0 m | 滚动局部地图：21×21 个大格，每格 1 米 |
| `planarVoxelWidth` / `size` | 51 × 0.2 m | 精细平面栅格：51×51 格，每格 20 cm |
| `voxelPointUpdateThre` | 100 | 格内新增 100 个点就触发一次下采样 |

扩展版 `terrainAnalysisExt` 用 121×121 个 2.0 m 大格（覆盖 242 m）和 301×301 个 0.2 m 平面格，看得更远、保留更久（decayTime 10 s）。

### 7.4 输入回调：裁剪 + 把 intensity 当时间戳

**`src/.../terrain_analysis/src/terrainAnalysis.cpp（第 166-208 行）`** · 源码第 **166–208** 行

```cpp startLineNumber=166
void laserCloudHandler(const sensor_msgs::msg::PointCloud2::ConstSharedPtr laserCloud2) {
  laserCloudTime = rclcpp::Time(laserCloud2->header.stamp).seconds();
  if (!systemInited) {
    systemInitTime = laserCloudTime;
    systemInited = true;
  }

  laserCloud->clear();
  pcl::fromROSMsg(*laserCloud2, *laserCloud);

  pcl::PointXYZI point;
  laserCloudCrop->clear();
  int laserCloudSize = laserCloud->points.size();
  for (int i = 0; i < laserCloudSize; i++) {
    point = laserCloud->points[i];

    float pointX = point.x;
    float pointY = point.y;
    float pointZ = point.z;

    float dis = sqrt((pointX - vehicleX) * (pointX - vehicleX) +
                     (pointY - vehicleY) * (pointY - vehicleY));

    float disX_rel_to_vehicle = fabs(
        (pointX - vehicleX-sensorOffsetX) * cosVehicleYaw + (pointY - vehicleY-sensorOffsetY) * sinVehicleYaw);
    float disY_rel_to_vehicle = fabs(
        -(pointX - vehicleX-sensorOffsetX) * sinVehicleYaw + (pointY - vehicleY-sensorOffsetY) * cosVehicleYaw);

    if (pointZ - vehicleZ > minRelZ - disRatioZ * dis && //? what is disRatioZ
        pointZ - vehicleZ < maxRelZ + disRatioZ * dis &&
        dis < terrainVoxelSize * (terrainVoxelHalfWidth + 1) &&
        (disX_rel_to_vehicle > vehicleLength / 2 || // point is not in the vehicle
        disY_rel_to_vehicle > vehicleWidth / 2)) {
      point.x = pointX;
      point.y = pointY;
      point.z = pointZ;
      point.intensity = laserCloudTime - systemInitTime; //? what is intensity
      laserCloudCrop->push_back(point);
    }
  }

  newlaserCloud = true;
}
```

**逐行拆解**

- **167–171** — 记录本帧时间戳；第一帧记为系统启动时间，后面算「点的年龄」用。
- **173、174** — `pcl::fromROSMsg` 把 ROS 点云消息转成 PCL 容器 `PointXYZI`。
- **186、187** — 计算该点到机器人中心的水平距离 `dis`。
- **189–192** — 把点变换到「车体朝向」的局部坐标，算出沿车长/车宽方向的偏移，用来排除打到机器人自身的点。
- **194、195** — 高度裁剪：`minRelZ/maxRelZ` 加了一个随距离放宽的余量 `disRatioZ * dis`（远处允许更大高度差，考虑坡度）。
- **196** — 只保留滚动局部地图半径内的点（21 格 × 1 m）。
- **197、198** — 排除车身占据区域内的点，避免把机器人自己标成障碍。
- **202** — **第一次变身**：`intensity = 本帧时间 − 启动时间`，此刻它只是个时间戳。后面 `decayTime` 判断点是否过期就靠这个数。
- **203–207** — 放入裁剪后的点云，置 `newlaserCloud = true` 通知主循环有新数据。

### 7.5 主循环四步算法

1. **① 滚动体素地图**：维护 21×21 个 1 米大格。机器人移动时整体平移数组并清空新出现的边列，不重新分配内存——这就是「滚动窗口」。
2. **② 堆叠 + 下采样 + 衰减**：裁剪点按位置塞进大格；新增点数 ≥100 或距上次更新 ≥2 秒时做体素下采样，并按 `decayTime` 丢掉过期点（此时 intensity 是时间戳，正好用来算年龄）。
3. **③ 估计地面高度**：把中心区域的点投到 51×51 个 0.2 m 平面格，每个点向周围 3×3 格扩散；对每个格的高度集合排序，取 `quantileZ=0.4` 分位数作为地面高度 `planarVoxelElev`。
4. **④ 输出 disZ**：对每个点算 `disZ = 点.z − 所在格地面高度`，只保留 `0 ≤ disZ < vehicleHeight(1.5)` 且格内点数足够的点，把 disZ 写进 intensity，发布 `/terrain_map`。

**`src/.../terrain_analysis/src/terrainAnalysis.cpp（第 634-656 行，分位数地面）`** · 源码第 **634–654** 行

```cpp startLineNumber=634
if (useSorting) {
  for (int i = 0; i < planarVoxelNum; i++) { // plannarVoxelNum is the number of voxels in the planar voxel grid
    int planarPointElevSize = planarPointElev[i].size();
    if (planarPointElevSize > 0) {
      sort(planarPointElev[i].begin(), planarPointElev[i].end()); // sort the elevation of the points from low to high

      int quantileID = int(quantileZ * planarPointElevSize); // 分位数（Quantile），亦称分位点
      if (quantileID < 0)
        quantileID = 0;
      else if (quantileID >= planarPointElevSize)
        quantileID = planarPointElevSize - 1;  // limit the quantileID to the range of planarPointElevSize


      // the elevation of the voxel is the elevation of the point with quantileID
      if (planarPointElev[i][quantileID] > // if limitGroundLift, elevation is limited to lowest point elevation + maxGroundLift
              planarPointElev[i][0] + maxGroundLift &&
          limitGroundLift) {
        planarVoxelElev[i] = planarPointElev[i][0] + maxGroundLift;
      } else {
        planarVoxelElev[i] = planarPointElev[i][quantileID];
      }
```

> 为什么用分位数而不是最低点？坡面上点的高度有高有低，取最低点会让坡上所有点都变成「障碍」；取 40% 分位数能让坡面附近的点相对高度正负相抵，机器人就能上坡。仓库的中文注释专门解释了这一点（见 7.8）。

**逐行拆解**

- **634–638** — 开启 `useSorting` 时，把每个平面格收集到的高度值从小到大排序。
- **640–644** — 按 `quantileZ`（0.4）算出分位点下标，并做边界保护。
- **648–653** — 取该分位点的高度作为**这一格的地面高度**。`limitGroundLift` 打开时会限制地面抬升幅度。

### 7.6 输出：把 disZ 写进 intensity

**`src/.../terrain_analysis/src/terrainAnalysis.cpp（第 695-711、781-785 行）`** · 源码第 **695–717** 行

```cpp startLineNumber=695
695          if (indX >= 0 && indX < planarVoxelWidth && indY >= 0 &&
696              indY < planarVoxelWidth) {
697            if (planarVoxelDyObs[planarVoxelWidth * indX + indY] <
698                    minDyObsPointNum ||
699                !clearDyObs) {
700              float disZ = point.z - planarVoxelElev[planarVoxelWidth * indX + indY];
701              if (considerDrop)
702                disZ = fabs(disZ);
703              int planarPointElevSize =
704                  planarPointElev[planarVoxelWidth * indX + indY].size();
705              if (disZ >= 0 && disZ < vehicleHeight &&
706                  planarPointElevSize >= minBlockPointNum) {
707                terrainCloudElev->push_back(point);
708                terrainCloudElev->points[terrainCloudElevSize].intensity = disZ;
709
710                terrainCloudElevSize++;
711              }
...
781      sensor_msgs::msg::PointCloud2 terrainCloud2;
782      pcl::toROSMsg(*terrainCloudElev, terrainCloud2);
783      terrainCloud2.header.stamp = rclcpp::Time(static_cast<uint64_t>(laserCloudTime * 1e9));
784      terrainCloud2.header.frame_id = map_frame;
785      pubLaserCloud->publish(terrainCloud2);
```

**逐行拆解**

- **700** — **核心公式**：`disZ = 点.z − 该格估计地面高度`。
- **701、702** — `considerDrop` 打开时对 disZ 取绝对值，把「坑/落差」也算障碍。本工程关闭。
- **705** — 只输出 `0 ≤ disZ < 1.5`（车高）的点：低于地面的点丢掉，太高的（天花板）也丢掉。
- **706** — 格内点数 ≥ `minBlockPointNum` 才认，避免零星噪点造出假障碍。
- **708** — **第二次变身**：把 disZ 写进 intensity。此刻 intensity 已经不是时间戳，而是「离地高度」。
- **781–785** — 转成 ROS 消息，打上时间戳和 `frame_id`（launch 里设成 `odom`），发布 `/terrain_map`。

> [!TIP] 还有一个「无数据当障碍」的兜底
> 第 761 行附近，当 `noDataObstacle=true` 时，会给没有足够的点的格子补几个 `intensity = vehicleHeight` 的虚拟点，把未知区域标成障碍。本工程 launch 里设成 false。

### 7.7 扩展版 terrainAnalysisExt：建图支路用的远场版本

| 对比项 | 普通版 `terrainAnalysis` | 扩展版 `terrainAnalysisExt` |
| --- | --- | --- |
| 输出话题 | `/terrain_map` | `/terrain_map_ext` |
| 用途 | 导航时的**局部代价地图** | 建图时喂 OctoMap 生成**二维栅格** |
| 大格 / 覆盖 | 21×21 × 1.0 m ≈ 21 m | 121×121 × 2.0 m ≈ 242 m |
| 平面格 | 51×51 × 0.2 m | 301×301 × 0.2 m |
| `decayTime` 默认 | 2.0 s | 10.0 s |
| 额外输入 | 无 | 还订阅 `/terrain_map`，按 `localTerrainMapRadius` 合并近场结果 |
| 额外算法 | 无 | BFS 地形连通性检查，去掉天花板 |
| disZ | `point.z − 地面`（不取绝对值） | `fabs(point.z − 地面)` |

**`src/.../terrain_analysis_ext/src/terrainAnalysisExt.cpp（第 539-578 行，BFS 去天花板）`** · 源码第 **539–578** 行

```cpp startLineNumber=539
// check terrain connectivity to remove ceiling
if (checkTerrainConn)
{
  int ind = planarVoxelWidth * planarVoxelHalfWidth + planarVoxelHalfWidth;
  if (planarPointElev[ind].size() == 0)
    planarVoxelElev[ind] = vehicleZ + terrainUnderVehicle;

  planarVoxelQueue.push(ind);
  planarVoxelConn[ind] = 1;
  while (!planarVoxelQueue.empty())
  {
    int front = planarVoxelQueue.front();
    planarVoxelConn[front] = 2;
    planarVoxelQueue.pop();

    int indX = int(front / planarVoxelWidth);
    int indY = front % planarVoxelWidth;
    for (int dX = -10; dX <= 10; dX++)
    {
      for (int dY = -10; dY <= 10; dY++)
      {
        if (indX + dX >= 0 && indX + dX < planarVoxelWidth && indY + dY >= 0 && indY + dY < planarVoxelWidth)
        {
          ind = planarVoxelWidth * (indX + dX) + indY + dY;
          if (planarVoxelConn[ind] == 0 && planarPointElev[ind].size() > 0)
          {
            if (fabs(planarVoxelElev[front] - planarVoxelElev[ind]) < terrainConnThre)
            {
              planarVoxelQueue.push(ind);
              planarVoxelConn[ind] = 1;
            } else if (fabs(planarVoxelElev[front] - planarVoxelElev[ind]) > ceilingFilteringThre)
            {
              planarVoxelConn[ind] = -1;
            }
          }
        }
      }
    }
  }
}
```

> 这样能避免把上方的横梁、天花板投影成二维地图里的障碍。注意 `terrain_analysis_ext.launch` 里 `checkTerrainConn` 默认 **false**，源码默认才是 true——launch 覆盖了源码。

**逐行拆解**

- **540–544** — 从机器人正下方那个格子出发；若没数据，就用 `vehicleZ + terrainUnderVehicle`（-0.75 m）假想一个脚下地面。
- **546–552** — 标准 BFS 队列：取出一格，标记为 `2`（连通）。
- **556–560** — 遍历周围 21×21 邻域的格子。
- **565–568** — 与当前格高度差 `< 0.5 m` 的视为连通地面，入队继续扩散。
- **569–572** — 高度差 `> 2.0 m` 的标为 `-1`（天花板/悬空结构），后面输出时丢弃。

> [!WARNING] launch 会覆盖源码默认值
> `terrain_analysis_ext.launch` 里 `checkTerrainConn` 默认 false、`localTerrainMapRadius: 0.0`（源码默认 4.0）。所以实际建图时**不做 BFS、也不合并近场 `/terrain_map`**。README_USAGE.md 提醒：若把半径改大，近场必须同时接入普通地形分析。

### 7.8 中文注释最密集的 launch 文件

**`src/.../terrain_analysis/launch/terrain_analysis.launch（第 3-15 行）`** · 源码第 **3–15** 行

```xml startLineNumber=3
<node pkg="terrain_analysis" exec="terrainAnalysis" name="terrainAnalysis" output="screen">
  <remap from="/registered_scan" to="/cloud_registered"/>
  <param name="map_frame" value="odom"/>
  <param name="scanVoxelSize" value="0.08" /><!--点云下采样-->
  <param name="decayTime" value="0.5" /><!--点云时间差阈值 大于则不会被处理-->
  <param name="noDecayDis" value="0.0" /><!--点云距离阈值 小于该阈值不考虑时间差-->
  <param name="clearingDis" value="0.0" /><!--该距离外的点会被清除-->

  <param name="useSorting" value="true" /> <!--这个参数开起来就能上坡了；如果useSorting,那么就以周围点中的分位点作为地面点，否则以最低点作为地面点；周围其余点相对于地面点的高度作为通过代价，所以对于坡面，有的点的代价是正，有的是负，就相互抵消了；不要与considerDrop同时开启，计算上会有冲突-->
  <param name="quantileZ" value="0.4" /> <!--useful if useSorting is enabled.-->
  <param name="considerDrop" value="false" /><!--考虑凹下去的地面,开启则将相对于地面点的高度取绝对值，-->
  <param name="limitGroundLift" value="false" /> <!--useful if useSorting is enabled.-->
  <param name="maxGroundLift" value="0.25" /><!--useful if useSorting is enabled.-->
```

**逐行拆解**

- **5** — XML 格式 launch（所以父 launch 用 `FrontendLaunchDescriptionSource` 加载）。
- **6** — **把源码里的 `/registered_scan` 接到 `/cloud_registered`**。这条 remap 是整条链的关键。
- **7** — 输出点云的 `frame_id` 设成 `odom`（源码默认是 `map`）。
- **8–11** — 下采样尺寸、点存活 0.5 秒、距离相关参数。
- **13** — **最有价值的一行注释**：明确说明 `useSorting` 开起来就能上坡——用分位点当地面，坡面点的正负代价相互抵消；并警告不要与 `considerDrop` 同时开。
- **12–15** — 分位数取 0.4、不考虑凹陷、不限制地面抬升。

> [!TIP] 把这一章记住，第 13 章就顺了
> 自定义代价地图插件之所以能只靠 `min_obstacle_intensity: 0.3` 就把地面滤掉，是因为 `/terrain_map` 的 intensity 已经是「离地高度」：地面 ≈0，30 cm 以上的凸起才会被标成障碍。

---

## 08 · OctoMap 支路：从 3D 点云到 2D 栅格地图

*建图时走的一条旁路，产出 Nav2 需要的 PNG + YAML。四个节点环环相扣。*

### 8.1 为什么不能直接把 /cloud_registered 丢给 OctoMap

OctoMap 做二维投影时，内部用**光线投射（ray tracing）**：假设点云是从传感器原点 `(0,0,0)` 发出的一束射线，从原点到命中点之间是空闲、命中点处是占据。可 `/cloud_registered` 是世界系（`odom`）下的全局坐标，直接喂进去射线方向全错，栅格会糊成一片。

1. **① terrainAnalysisExt**：把 `/cloud_registered`（remap 成 `/registered_scan`）变成 `/terrain_map_ext`，`intensity = |z − 地面|`。
2. **② exchangeField**：**把 z 和 intensity 互换**：现在 `z` 里装的是「相对地面高度」，地面点 z≈0，障碍点 z 大。
3. **③ sensorScanGeneration**：同步里程计，把点云从 `odom` 系**搬回该帧扫描时刻的传感器原点**，并广播 `map → sensor_at_scan` 的 TF。
4. **④ octomap_server**：按 `resolution=0.1` 建八叉树，用 `point_cloud_min_z=0.15` 滤掉地面点，投影出 `/projected_map`。
5. **⑤ map_saver_cli**：把栅格存成 PNG + YAML，供 Nav2 `map_server` 加载。

### 8.2 exchangeField.cpp：全文只有 40 行，但它是关键

**`src/.../terrain_analysis/src/exchangeField.cpp（全文）`** · 源码第 **1–33** 行

```cpp
#include "rclcpp/rclcpp.hpp"
#include "sensor_msgs/point_cloud2_iterator.hpp"
#include "sensor_msgs/msg/point_cloud2.hpp"

class PointCloudProcessor : public rclcpp::Node
{
public:
  PointCloudProcessor()
  : Node("point_cloud_field_exchange")
  {
    publisher_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("output_topic", 10);
    subscription_ = this->create_subscription<sensor_msgs::msg::PointCloud2>(
      "input_topic", 10, std::bind(&PointCloudProcessor::topic_callback, this, std::placeholders::_1));
  }

private:
  void topic_callback(const sensor_msgs::msg::PointCloud2::SharedPtr msg)
  {
    sensor_msgs::PointCloud2Modifier pcd_modifier(*msg);
    sensor_msgs::PointCloud2Iterator<float> iter_z(*msg, "z");
    sensor_msgs::PointCloud2Iterator<float> iter_intensity(*msg, "intensity");

    for (; iter_z != iter_z.end(); ++iter_z, ++iter_intensity) {
      float temp = *iter_z;
      *iter_z = *iter_intensity;
      *iter_intensity = temp;
    }

    publisher_->publish(*msg);
  }
  rclcpp::Subscription<sensor_msgs::msg::PointCloud2>::SharedPtr subscription_;
  rclcpp::Publisher<sensor_msgs::msg::PointCloud2>::SharedPtr publisher_;
};
```

> 为什么要交换？因为 OctoMap 的 `point_cloud_min_z` 按 **z** 过滤，而地面信息在 intensity 里。交换后，OctoMap 配 `min_z=0.15` 就能把「离地不足 15 cm 的地面点」滤掉，只留下凸起的障碍。

**逐行拆解**

- **1–3** — 引入 ROS 2 与 `point_cloud2_iterator`——这是按字段名安全遍历二进制点云的工具。
- **9** — 节点名 `point_cloud_field_exchange`。
- **11–13** — 发布 `output_topic`、订阅 `input_topic`，**都是相对名**。`octomap_server_intensity.launch.py` 用带斜杠的 remap 把它们接到 `/terrain_map_ext` 和 `/terrain_map_ext_exchanged`。
- **19** — `PointCloud2Modifier` 准备修改消息（点云消息本质是二进制 buffer）。
- **20、21** — 创建两个迭代器，分别指向每个点的 `z` 字段和 `intensity` 字段，类型都是 `float`。
- **23–27** — **整个节点的核心**：逐点交换两个字段的值。交换后 `z` = 原来的 intensity = 相对地面高度；`intensity` = 原来的绝对高度。
- **29** — 原样把改过的消息发出去（连 `header` 都不变，所以 `frame_id` 仍是 `odom`）。

> [!WARNING] 文件名拼写是 Filed 不是 Field
> 独立启动用的 XML 文件叫 `exchangeFiled.launch`（多了个字母顺序错误），节点可执行名却是 `exchangeField`。这正是那种「照着印象敲命令就找不到文件」的坑。

### 8.3 sensorScanGeneration：把点云搬回传感器原点

**`src/.../sensor_scan_generation/src/sensorScanGeneration.cpp（第 47-105 行）`** · 源码第 **47–105** 行

```cpp startLineNumber=47
void laserCloudAndOdometryHandler(const nav_msgs::msg::Odometry::ConstSharedPtr odometry,
                                  const sensor_msgs::msg::PointCloud2::ConstSharedPtr laserCloud2)
{
  laserCloudIn->clear();
  laserCLoudInSensorFrame->clear();

  pcl::fromROSMsg(*laserCloud2, *laserCloudIn);

  odometryIn = *odometry;

  transformToMap.setOrigin(
      tf2::Vector3(odometryIn.pose.pose.position.x, odometryIn.pose.pose.position.y, odometryIn.pose.pose.position.z));
  transformToMap.setRotation(tf2::Quaternion(odometryIn.pose.pose.orientation.x, odometryIn.pose.pose.orientation.y,
                                            odometryIn.pose.pose.orientation.z, odometryIn.pose.pose.orientation.w));

  int laserCloudInNum = laserCloudIn->points.size();

  pcl::PointXYZI p1;
  tf2::Vector3 vec;

  for (int i = 0; i < laserCloudInNum; i++)
  {
    p1 = laserCloudIn->points[i];
    vec.setX(p1.x);
    vec.setY(p1.y);
    vec.setZ(p1.z);

    vec = transformToMap.inverse() * vec;

    p1.x = vec.x();
    p1.y = vec.y();
    p1.z = vec.z();
    try{
      p1.intensity = laserCloudIn->points[i].intensity;
    }
    catch(...){
      p1.intensity = 0;
    }

    laserCLoudInSensorFrame->points.push_back(p1);
  }

  odometryIn.header.stamp = laserCloud2->header.stamp;
  odometryIn.header.frame_id = "map";
  odometryIn.child_frame_id = "sensor_at_scan";
  pubOdometryPointer->publish(odometryIn);

  transformToMap.frame_id_ = "map";
  transformTfGeom = tf2::toMsg(transformToMap);
  transformTfGeom.header.stamp = laserCloud2->header.stamp;
  transformTfGeom.child_frame_id = "sensor_at_scan";
  tfBroadcasterPointer->sendTransform(transformTfGeom);

 sensor_msgs::msg::PointCloud2 scan_data;
 pcl::toROSMsg(*laserCLoudInSensorFrame, scan_data);
 scan_data.header.stamp = laserCloud2->header.stamp;
 scan_data.header.frame_id = "sensor_at_scan";
 pubLaserCloud->publish(scan_data);
}
```

**逐行拆解**

- **93、94** — 这个回调同时收到**里程计**和**点云**——由 `message_filters::ApproximateTime` 做时间同步后一起送进来。
- **99** — 点云转 PCL。
- **57–60** — 用里程计位姿构造一个 `transformToMap`（机器人当前在 map 中的位姿）。
- **67–78** — **核心**：对每个点计算 `transformToMap.inverse() * 点坐标`，把世界系点搬到「以该帧传感器为原点」的坐标系。这样射线投射才成立。
- **79–84** — intensity 原样保留（此时它是被交换后的绝对高度，不影响后续）。
- **89–92** — 发布同步后的里程计 `/state_estimation_at_scan`，父帧 `map`、子帧 `sensor_at_scan`。
- **94–98** — 广播 `map → sensor_at_scan` 的 TF，时间戳与点云一致。
- **100–104** — 发布 `/sensor_scan`（被 remap 成 `/terrain_map_at_scan`），`frame_id = sensor_at_scan`。

**`src/.../sensor_scan_generation/src/sensorScanGeneration.cpp（第 116-138 行）`** · 源码第 **116–124** 行

```cpp startLineNumber=116
116  typedef message_filters::sync_policies::ApproximateTime<nav_msgs::msg::Odometry, sensor_msgs::msg::PointCloud2> syncPolicy;
117  typedef message_filters::Synchronizer<syncPolicy> Sync;
118  boost::shared_ptr<Sync> sync_;
...
134  subOdometry.subscribe(nh, "/state_estimation", qos_profile);
135  subLaserCloud.subscribe(nh, "/registered_scan", qos_profile);
136  sync_.reset(new Sync(syncPolicy(100), subOdometry, subLaserCloud));
137  sync_->registerCallback(std::bind(laserCloudAndOdometryHandler, placeholders::_1, placeholders::_2));
138  pubOdometryPointer = nh->create_publisher<nav_msgs::msg::Odometry>("/state_estimation_at_scan", 5);
```

> **排障要点**：如果 `/cloud_registered` 有数据但 `/terrain_map_at_scan` 没有，第一时间比对里程计与地形点云的 `header.stamp`——时间戳对不上，ApproximateTime 就不会输出任何东西。

**逐行拆解**

- **116–118** — 定义近似时间同步策略：只有当里程计和点云的时间戳足够接近，才成对触发回调。
- **134、135** — 两个订阅：里程计 `/state_estimation`，点云 `/registered_scan`（被 remap 成 `/terrain_map_ext_exchanged`）。
- **136、137** — 队列长度 100，注册回调。

### 8.4 OctoMap 节点参数逐行

**`src/sentry_bringup/launch/octomap_server_intensity.launch.py（第 22-45、47-86 行）`** · 源码第 **22–62** 行

```py startLineNumber=22
22    # terrain analysis
23    terrain_analysis_ext = IncludeLaunchDescription(
24        FrontendLaunchDescriptionSource(os.path.join(
25        get_package_share_directory('terrain_analysis_ext'), 'launch', 'terrain_analysis_ext.launch')
26        ),
27    )
28
29    # exchange intensity and height filed of terrain analysis
30    exchange_filed=Node(
31        package='terrain_analysis',
32        executable='exchangeField',
33        output='screen',
34        remappings=[('/input_topic', '/terrain_map_ext'),
35                        ('/output_topic', '/terrain_map_ext_exchanged')]
36    )
37
38    # transform terrain_map_ext to sensor frame
39    sensor_scan_generation = Node(
40        package='sensor_scan_generation',
41        executable='sensorScanGeneration',
42        output='screen',
43        remappings=[('/registered_scan', '/terrain_map_ext_exchanged'),
44                        ('/sensor_scan', '/terrain_map_at_scan')]
45    )
...
47    # build octomap use terrain analysis result, that is, intensity field is used as height field
48    octomap_server_node = Node(
49    package='octomap_server',
50        executable='octomap_server_node',
51        output='screen',
52        parameters=[{
53            "frame_id": "map",#! MUST SET TO MAP
54            "base_frame_id": "sensor_at_scan",#! THIE MUST BE SPECIFIED IF YOU WANT TO SAVE MAP
62            "point_cloud_min_z":0.15,
68            "filter_speckles":True,
69            "filter_ground_plane":False,
80            "resolution": 0.1,
81            "latch": True,#! THIE MUST BE SPECIFIED IF YOU WANT TO SAVE MAP
84        }],
85            remappings=[('/cloud_in', '/terrain_map_at_scan')]
86    )
```

**逐行拆解**

- **44–48** — 用 `FrontendLaunchDescriptionSource` 加载 XML 格式的扩展地形分析 launch，产出 `/terrain_map_ext`。
- **50–57** — 启动字段交换节点，把输入接到 `/terrain_map_ext`、输出接到 `/terrain_map_ext_exchanged`。
- **38–45** — 启动扫描生成节点：输入是交换后的点云，输出 `/terrain_map_at_scan`。
- **47** — **作者的原注释**：「用地形分析结果建 octomap，也就是把 intensity 字段当作高度字段」——一句话点破整条链。
- **53** — `frame_id: "map"`：栅格地图发布在 map 系（必须）。
- **54** — `base_frame_id: "sensor_at_scan"`：告诉 OctoMap 传感器原点在哪，光线投射才有正确起点。
- **62** — `point_cloud_min_z: 0.15`：**滤掉 z &lt; 0.15 的点**。因为 z 已被换成「相对地面高度」，地面点 z≈0 被滤掉，凸起的障碍留下。
- **68、69** — 去掉孤立噪点；不再额外滤地面（地面已被地形分析处理）。
- **80** — 栅格分辨率 0.1 m/格。
- **81** — `latch: True`：以 `transient_local` 持久发布，`map_saver_cli` 才能订阅到这条只发一次的地图。
- **85** — 把 OctoMap 的输入 `/cloud_in` 接到 `/terrain_map_at_scan`。

| 节点 | 输入 | 输出 | 关键点 |
| --- | --- | --- | --- |
| `odom_map_trans` | — | TF `map → odom` | 单位变换；建图时 map/odom 重合 |
| `terrainAnalysisExt` | `/cloud_registered` + `/state_estimation` | `/terrain_map_ext` | intensity = 相对地面高度 |
| `exchangeField` | `/terrain_map_ext` | `/terrain_map_ext_exchanged` | z ↔ intensity 互换 |
| `sensorScanGeneration` | 交换后的点云 + 同步里程计 | `/terrain_map_at_scan` + TF | 搬回传感器原点；时间戳必须匹配 |
| `octomap_server_node` | `/terrain_map_at_scan` | `/projected_map` | min_z=0.15 滤地面，latch=true |

> [!CAUTION] octomap_server 不在这个仓库里
> 它是系统依赖包（apt 安装 `ros-humble-octomap-server`），源码不在工作区。所以 `/projected_map` 的具体生成逻辑要看上游包；这里能改的只有参数和输入话题。

### 8.5 保存二维地图

**`README.md / README_USAGE.md §4.2 的命令`** · 源码第 **1–5** 行

```bash
ros2 service call /map_save std_srvs/srv/Trigger
cp -i "$QCT_WS/test.pcd" "$QCT_MAP_DIR/GlobalMap.pcd"

ros2 run nav2_map_server map_saver_cli -t /projected_map \
  -f "$QCT_MAP_DIR/nav_map" --fmt png --mode trinary
```

**逐行拆解**

- **1** — 调 FAST-LIO 的 `/map_save` 服务，把累计点云写成 `./test.pcd`。前提：`publish.map_en` 与 `pcd_save.pcd_save_en` 都为 true。
- **2** — 把 PCD 拷到地图目录并命名为 `GlobalMap.pcd`（重定位入口的默认文件名）。
- **3、4** — 把 `/projected_map` 存成 `nav_map.png` + `nav_map.yaml`；`--mode trinary` 表示三值化（占用/空闲/未知）。

> [!TIP] 排查 /projected_map 没有数据的顺序
> `/terrain_map_ext` → `/terrain_map_ext_exchanged` → `/terrain_map_at_scan`。逐级用 `ros2 topic hz` 看哪一环断了；重点检查 `map → sensor_at_scan` 在点云时间戳上是否有效、过滤后还剩不剩点、OctoMap 有没有订阅到正确输入。

---

## 09 · ICP 重定位：开机时先搞清「我在哪」

*把一帧实时扫描和上次建好的 PCD 对齐，求出初始位姿，再把它变成 TF 树的一条边。*

### 9.1 为什么需要这一步

每次开机，机器人不知道自己被摆在场地哪个角。里程计只能给出「相对起点走了多远」而且会漂移。ICP（Iterative Closest Point）用一个初始猜测，反复把当前扫描和先验地图找最近点、求最优刚体变换，直到两片点云尽量重合。最终的 4×4 变换矩阵就是「扫描原点在 map 坐标系中的位姿」。

> [!NOTE] ICP 对初值极其敏感
> 如果初始猜测差太远（尤其是朝向错了 180°），ICP 会收敛到附近一段长得差不多的墙上，给出一个「看起来分数很好但位置完全错」的结果。所以 `initial_x/y/z/a` 是所有参数里最先要调的；`README_USAGE.md` 也强调「低得分不能确认位置正确，尤其是重复墙面」。

### 9.2 icp_node.cpp：参数、订阅、发布

**`src/icp_relocalization/src/icp_node.cpp（第 28-78 行）`** · 源码第 **28–63** 行

```cpp startLineNumber=28
28        this->declare_parameter("initial_x", 0.0);
29        this->declare_parameter("initial_y", 0.0);
30        this->declare_parameter("initial_z", 0.0);
31        this->declare_parameter("initial_a", 0.0);
32        this->declare_parameter("solver_max_iter", 75);
33        this->declare_parameter("max_correspondence_distance", 0.1);
34        this->declare_parameter("RANSAC_outlier_rejection_threshold", 1.0);
35        this->declare_parameter("map_path", "");
36        this->declare_parameter("map_frame_id", "map");
37        this->declare_parameter("fitness_score_thre", 0.0);
38        this->declare_parameter("map_voxel_leaf_size", 0.1);
39        this->declare_parameter("cloud_voxel_leaf_size", 0.1);
40        this->declare_parameter("converged_count_thre", 20);
41        this->declare_parameter("pcl_type","livox");
...
58        publisher_ = this->create_publisher<geometry_msgs::msg::PoseWithCovarianceStamped>(
59            "icp_result", rclcpp::QoS(1).reliable().transient_local());
60 #ifdef USE_LIVOX
61        if(pcl_type == "livox")
62        {
63            lvx_cloud_sub_ = this->create_subscription<livox_ros_driver2::msg::CustomMsg>(
64                "/livox/lidar", rclcpp::SensorDataQoS(), std::bind(&ICPNode::lvx_cloud_callback, this, std::placeholders::_1));
65        }
66        else
67        {
68            cloud_sub_ = this->create_subscription<sensor_msgs::msg::PointCloud2>(
69            "/pointcloud2", rclcpp::SensorDataQoS(), std::bind(&ICPNode::cloud_callback, this, std::placeholders::_1));
70        }
71 #else
72        cloud_sub_ = this->create_subscription<sensor_msgs::msg::PointCloud2>(
73            "/pointcloud2", rclcpp::SensorDataQoS(), std::bind(&ICPNode::cloud_callback, this, std::placeholders::_1));
73 #endif
74        pose_sub_ = this->create_subscription<geometry_msgs::msg::PoseWithCovarianceStamped>(
75            "initialpose", 10, std::bind(&ICPNode::pose_callback, this, std::placeholders::_1));
76        map_pub_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("prior_map", 10);
77        transformed_cloud_pub_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("transformed_cloud", 10);
```

**逐行拆解**

- **55–58** — 初始猜测位姿：`x/y/z` 和绕 Z 轴的偏航 `a`（弧度）。这是 ICP 的起点，调参第一优先。
- **59** — 单次 `align()` 的最大迭代次数。
- **60** — 找对应点时允许的最大距离（米）。太大会误匹配到相邻墙柱。
- **61** — RANSAC 内点阈值。注意源码里 `setRANSACIterations(100)` 被注释掉了，别把它当主要调参手段。
- **62、63** — 先验 PCD 路径；发布位姿的 `frame_id` 用 `map`。
- **37** — 得分上限：`fitness_score < 阈值` 才算通过。PCL 的 `getFitnessScore()` 是最近点平方距离的均值，**不是重叠率**，越小越贴合。
- **38、39** — 地图 / 输入扫描的体素降采样叶子尺寸，减少计算量。
- **40** — **连续通过多少帧才发布结果**，防止单帧偶然匹配成功就误报。
- **41** — 输入格式开关：`livox`（CustomMsg）或 `pointcloud2`。
- **58、59** — 发布 `icp_result`，QoS 是 `reliable + transient_local`，**只发一次但晚订阅者也能收到**。
- **60–73** — 编译期宏 `USE_LIVOX` 由 `CMakeLists.txt` 的 `set(USE_LIVOX 1)` 打开；运行时再按 `pcl_type` 二选一。`livox` 分支订阅 `/livox/lidar` 的 `CustomMsg`。
- **74、75** — 订阅 `initialpose`：RViz 的「2D Pose Estimate」工具可以重设初值。
- **76、77** — 发布下采样后的先验地图和配准后的点云，供 RViz 目视检查对齐效果。

> [!CAUTION] ICP 必须用「独立扫描」
> `relocalization.launch.py` 里有个 `validate_icp_input()` 防呆函数，禁止把 FAST-LIO 的输出（`/cloud_registered`、`/Laser_map` 等）当作 ICP 输入。原因很简单：FAST-LIO 在定位模式下要等 ICP 结果才能启动，拿它的输出喂 ICP 就是死锁。

### 9.3 初值矩阵与 PCD 加载

**`src/icp_relocalization/src/icp_node.cpp（第 80-115 行）`** · 源码第 **80–107** 行

```cpp startLineNumber=80
80        // init guess
81        initGuess = Eigen::Matrix4f::Identity();
82        initGuess(0, 3) = initial_x;
83        initGuess(1, 3) = initial_y;
84        initGuess(2, 3) = initial_z;
85        // You need to convert the quaternion to a rotation matrix and set it to the upper-left 3x3 part of the matrix
86        tf2::Quaternion q;
87        q.setRPY(0, 0, initial_a);
88        tf2::Matrix3x3 rot_mat(q);
89        for (int i = 0; i < 3; i++)
90        {
91            for (int j = 0; j < 3; j++)
92            {
93                initGuess(i, j) = rot_mat[i][j];
94            }
95        }
...
97        // Load the target point cloud from a PCD file
98        if (pcl::io::loadPCDFile<pcl::PointXYZ>(map_path, *target_cloud_) < 0 || target_cloud_->empty())
99        {
100            throw std::runtime_error("ICP target PCD is missing or empty: " + map_path);
101       }
...
103       // downsample the target cloud
104       pcl::VoxelGrid<pcl::PointXYZ> sor_map;
105       sor_map.setInputCloud(target_cloud_);
106       sor_map.setLeafSize(map_voxel_leaf_size, map_voxel_leaf_size, map_voxel_leaf_size);
107       sor_map.filter(*target_cloud_);
```

**逐行拆解**

- **81–84** — 构造 4×4 齐次变换矩阵：单位阵，第 4 列前三项填平移 (x,y,z)。
- **86–95** — 把偏航角 `initial_a` 转成旋转矩阵，填进左上 3×3。只支持绕 Z 转，不支持 roll/pitch。
- **98–101** — 加载先验 PCD（只读 XYZ）；失败或为空**直接抛异常**，节点启动即崩。`main()` 没有 try/catch。
- **103–107** — 按 `map_voxel_leaf_size`（0.5 m）给地图降采样，之后一直复用这份缓存。

### 9.4 ICP 迭代与收敛判据

**`src/icp_relocalization/src/icp_node.cpp（第 133-157 行）`** · 源码第 **133–157** 行

```cpp startLineNumber=133
// Perform ICP alignment
pcl::IterativeClosestPoint<pcl::PointXYZ, pcl::PointXYZ> icp;
icp.setInputSource(input_cloud);
icp.setInputTarget(target_cloud_);
icp.setMaximumIterations(solver_max_iter);
// icp.setTransformationEpsilon(1e-8);
icp.setMaxCorrespondenceDistance(max_correspondence_distance);
icp.setRANSACOutlierRejectionThreshold(RANSAC_outlier_rejection_threshold);
// icp.setRANSACIterations(100);
pcl::PointCloud<pcl::PointXYZ> final_cloud;
icp.align(final_cloud, initGuess);

// Get fitness score
double fitness_score = icp.getFitnessScore();
RCLCPP_INFO(this->get_logger(), "ICP fitness score: %f", fitness_score);

if (fitness_score < fitness_score_thre && icp.hasConverged())
{
    converged_count++;
    RCLCPP_INFO(this->get_logger(), "ICP converged, count: %d", converged_count);
    if(converged_count < converged_count_thre)
    {
        RCLCPP_INFO(this->get_logger(), "ICP converged, but not enough count, no pose is published");
        return;
    }
```

**逐行拆解**

- **134–136** — 创建 PCL 的 ICP 对象，设置源（当前扫描）和目标（先验地图）。
- **137–140** — 把 4 个参数塞进去：迭代上限、对应点最大距离、RANSAC 内点阈值。
- **141** — `setRANSACIterations` 被注释——所以 `RANSAC_outlier_rejection_threshold` 的作用有限。
- **142、143** — `align(final_cloud, initGuess)`：以初值开始迭代，结果保存在对象内部，配准后的点云放进 `final_cloud`。
- **146** — 取 `fitness_score`（最近点平方距离均值，越小越好）。
- **149** — **双重判据**：得分低于阈值 **且** ICP 自己判定收敛。
- **151–157** — 连续计数；没到 `converged_count_thre`（40 帧）就不发布，只打印「but not enough count」。任何一帧失败都会把计数清零。

| 参数（relocalization.launch.py 默认） | 值 | 怎么判断要调 |
| --- | --- | --- |
| `initial_x/y/z/a` | 全 `0.0` | **最先调**；避免重复结构中猜错朝向 |
| `map_voxel_leaf_size` / `cloud_voxel_leaf_size` | `0.5` / `0.3` m | 细小结构消失就减小；点数太多就增大 |
| `max_correspondence_distance` | `0.1` m | 初值差先改初值；放太大易匹配到相邻墙柱 |
| `solver_max_iter` | `100` | 增加次数救不了错误初值 |
| `RANSAC_outlier_rejection_threshold` | `0.5` | 源码 RANSAC 迭代行被注释，别当主力 |
| `fitness_score_thre` | `0.9` | 最近点平方距离均值，低分也可能对错位置 |
| `converged_count_thre` | `40` | 连续第 40 个通过帧才发布；失败重置 |
| `pcl_type` | `livox` | `CustomMsg`；改 `pointcloud2` 则走 `/pointcloud2` |

调参原则（README_USAGE.md）：一次只改一类参数；先确认 PCD 读到了且有效点数正常，再检查数据类型、初值、重叠与对应距离，最后才动得分门槛和通过帧数。

### 9.5 发布位姿：矩阵怎么变成 ROS 消息

**`src/icp_relocalization/src/icp_node.cpp（第 158-183 行）`** · 源码第 **158–178** 行

```cpp startLineNumber=158
158            // Convert the transformation_result result to a PoseWithCovarianceStamped message and publish it
159            Eigen::Matrix4f transformation_result = icp.getFinalTransformation();
160            geometry_msgs::msg::PoseWithCovarianceStamped pose_msg;
161            pose_msg.header.stamp = msg->header.stamp;
162            pose_msg.header.frame_id = map_frame;
163            pose_msg.pose.pose.position.x = transformation_result(0, 3);
164            pose_msg.pose.pose.position.y = transformation_result(1, 3);
165            pose_msg.pose.pose.position.z = transformation_result(2, 3);
166            // set orientation
167            Eigen::Matrix3f rotation = transformation_result.block<3, 3>(0, 0);
168            Eigen::Quaternionf q(rotation);
169            pose_msg.pose.pose.orientation.x = q.x();
170            pose_msg.pose.pose.orientation.y = q.y();
171            pose_msg.pose.pose.orientation.z = q.z();
172            pose_msg.pose.pose.orientation.w = q.w();
173            publisher_->publish(pose_msg);
174
175            // Transform the input cloud using the ICP result
176            pcl::transformPointCloud(*input_cloud, *input_cloud, transformation_result);
...
183            matched_ = true;
```

**逐行拆解**

- **159** — `getFinalTransformation()` 返回把**源点云变换到目标点云**的 4×4 矩阵 `T_map_scan`。
- **162** — `frame_id = map`：这个位姿是「扫描原点在 map 系中的位姿」，**不是 base_link 的位姿**。
- **163–165** — 平移取矩阵第 4 列前三项 `(0,3)(1,3)(2,3)`。
- **167–172** — 姿态取左上 3×3 旋转块，转成四元数填进 ROS 消息。
- **173** — 发布 `icp_result`（transient_local，只发一次）。
- **176** — 把当前扫描按结果变换到 map 系，发到 `/transformed_cloud` 供 RViz 目视对照。
- **183** — `matched_ = true` 后，所有回调开头的 guard 立即生效，**节点从此停止配准**。

### 9.6 transform_publisher.cpp：把位姿变成 TF 边（逐行精读）

**`src/icp_relocalization/src/transform_publisher.cpp（第 16-34 行）`** · 源码第 **16–32** 行

```cpp startLineNumber=16
16        this->declare_parameter<std::string>("odom_frame_id","odom");
17        this->declare_parameter<std::string>("map_frame_id","map");
18        // Empty source and origin preserve the standalone launch's direct mode.
19        source_frame_ = this->declare_parameter<std::string>("source_frame_id", "");
20        origin_frame_ = this->declare_parameter<std::string>("initial_odom_frame_id", "");
...
24        subscription_ = this->create_subscription<geometry_msgs::msg::PoseWithCovarianceStamped>(
25            "icp_result", rclcpp::QoS(1).reliable().transient_local(),
26            [this](geometry_msgs::msg::PoseWithCovarianceStamped::SharedPtr msg) {
27                if (!published_ && msg->header.frame_id == map_frame_id) pending_ = msg;
28            });
29        initial_pose_ = this->create_publisher<geometry_msgs::msg::PoseWithCovarianceStamped>(
30            "localization_initial_pose", rclcpp::QoS(1).reliable().transient_local());
31        buffer_ = std::make_unique<tf2_ros::Buffer>(get_clock());
32        listener_ = std::make_unique<tf2_ros::TransformListener>(*buffer_);
33        broadcaster_ = std::make_shared<tf2_ros::StaticTransformBroadcaster>(this);
34        timer_ = this->create_wall_timer(std::chrono::milliseconds(100), [this]() { publish_result(); });
```

**逐行拆解**

- **31、32** — 默认 `odom` / `map` 两个坐标系名。
- **18–20** — `source_frame_id`、`initial_odom_frame_id` 默认**空字符串**。空值 = 「直接模式」：不查外参，直接把 ICP 结果当 `map → odom`。独立 launch `icp.launch.py` 就是这么用的。
- **24–28** — 订阅 `icp_result`，QoS 与发布端一致。lambda **只把消息存进 `pending_`**，不在回调里干活；且只接受 `frame_id == map` 且自己还没发布过的消息。
- **29、30** — 发布 `localization_initial_pose`，同样 `transient_local`。
- **31、32** — TF Buffer + Listener：用来查询 URDF 里的静态外参。
- **33** — `StaticTransformBroadcaster`：发布 `/tf_static`，一次发布长期有效。
- **34** — **100 ms 定时器**轮询 `publish_result()`。为什么用定时器而不是回调里直接发？因为外参 TF 可能还没就绪，定时器可以反复重试。

**`src/icp_relocalization/src/transform_publisher.cpp（第 38-86 行）`** · 源码第 **38–86** 行

```cpp startLineNumber=38
void publish_result()
{
    if (!pending_ || published_) return;
    const auto& p = pending_->pose.pose.position;
    tf2::Quaternion q;
    tf2::fromMsg(pending_->pose.pose.orientation, q);
    if (!std::isfinite(p.x) || !std::isfinite(p.y) || !std::isfinite(p.z) ||
        !std::isfinite(q.length2()) || q.length2() < 1e-12)
    {
        RCLCPP_ERROR(get_logger(), "Ignoring invalid ICP pose");
        pending_.reset();
        return;
    }
    const tf2::Transform map_from_source(q.normalized(), tf2::Vector3(p.x, p.y, p.z));
    tf2::Transform map_from_odom = map_from_source;
    if (!source_frame_.empty() && !origin_frame_.empty() && source_frame_ != origin_frame_)
    {
        try
        {
            // FAST-LIO defines odom at the initial IMU pose. Use only the
            // sensor extrinsic here: odom -> base_link does not exist yet.
            const auto extrinsic = buffer_->lookupTransform(source_frame_, origin_frame_, tf2::TimePointZero);
            tf2::Transform source_from_origin;
            tf2::fromMsg(extrinsic.transform, source_from_origin);
            map_from_odom *= source_from_origin;
        }
        catch (const tf2::TransformException& ex)
        {
            RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 2000, "Waiting for ICP sensor extrinsic: %s", ex.what());
            return;
        }
    }
    geometry_msgs::msg::TransformStamped transform;
    transform.header.stamp = this->now();
    transform.header.frame_id = map_frame_id;
    transform.child_frame_id = odom_frame_id;
    transform.transform = tf2::toMsg(map_from_odom);

    broadcaster_->sendTransform(transform);
    auto pose = *pending_;
    pose.pose.pose.position.x = transform.transform.translation.x;
    pose.pose.pose.position.y = transform.transform.translation.y;
    pose.pose.pose.position.z = transform.transform.translation.z;
    pose.pose.pose.orientation = transform.transform.rotation;
    initial_pose_->publish(pose);
    published_ = true;
    pending_.reset();
    RCLCPP_INFO(get_logger(), "Published map -> odom and retained FAST-LIO initial pose");
}
```

**逐行拆解**

- **77** — 只处理一次：没消息或已发布过就直接返回。
- **44–50** — **有效性校验**：平移必须是有限数，四元数模长不能为 0，否则丢弃（NaN 位姿会让整棵 TF 树崩掉）。
- **51、52** — 把 ICP 位姿封装成 `tf2::Transform`，默认直接当作 `map_from_odom`。
- **53–62** — 若两个 frame 参数都非空，就查 `lookupTransform(source_frame_, origin_frame_, TimePointZero)` 拿外参，乘上去。总入口里这两个值是 `lidar_link` 和 `imu_link`。
- **57、58** — 注释解释动机：FAST-LIO 把 `odom` 定义在**初始 IMU 位姿**上，此刻 `odom → base_link` 还不存在，只能用传感器外参补齐。
- **64–68** — 外参还没就绪时打印限频警告并 `return`，下一轮定时器再试——这就是「等 TF 就绪」的实现。
- **70–76** — 构造并广播 `map → odom` 静态变换。
- **77–82** — 复制原始消息（保留 header、协方差），但把平移/姿态换成 `map_from_odom` 的结果，发到 `/localization_initial_pose`。
- **83–85** — 标记完成、清空缓存、打印日志。整个节点**一次性**完成使命。

> [!NOTE] 为什么 /localization_initial_pose 必须 transient_local
> 链条上有三个「只发一次」：`icp_result` → `localization_initial_pose` → FAST-LIO 订阅。而 FAST-LIO 可能比 ICP 晚启动、Nav2 可能更晚、你也可能事后才 `ros2 topic echo`。`transient_local` 让发布者把最后一条留在布告栏上，后来者都能取到。**订阅端必须声明兼容的 QoS**（第 25 行、`laserMapping.cpp:434` 都写了），否则连不上。

### 9.7 relocalization.launch.py：防呆、参数与条件分支

**`src/sentry_bringup/launch/relocalization.launch.py（第 12-18 行）`** · 源码第 **12–18** 行

```py startLineNumber=12
def validate_icp_input(context):
  method = LaunchConfiguration('icp_method').perform(context)
  input_type = LaunchConfiguration('icp_input_type').perform(context)
  topic = LaunchConfiguration('icp_pointcloud_topic').perform(context).strip('/')
  if (method == 'sac_ia_gicp' or input_type == 'pointcloud2') and topic.split('/')[-1] in {
      'cloud_registered', 'cloud_registered_body', 'cloud_effected', 'Laser_map'}:
    raise RuntimeError('ICP startup requires an independent PointCloud2 scan, not a FAST-LIO output')
```

**逐行拆解**

- **12–15** — 启动时读取三个 LaunchConfiguration 的实际值（`perform(context)` 求值）。
- **16–18** — **防呆检查**：若选 SAC-IA 或 PointCloud2 输入，而话题又是 FAST-LIO 的四个输出之一，直接抛错阻止启动——避免死锁和自证循环。

**`src/sentry_bringup/launch/relocalization.launch.py（第 51-58、60-92、106-118 行）`** · 源码第 **51–101** 行

```py startLineNumber=51
51  map_odom_trans = Node(
52      package='icp_relocalization',
53      executable='transform_publisher',
54      name='transform_publisher',
55      parameters=[{'source_frame_id': LaunchConfiguration('icp_source_frame'),
56                   'initial_odom_frame_id': 'imu_link'}],
57      output='screen'
58  )
...
60  icp_node = Node(
61      package='icp_relocalization',
62      executable='icp_node',
63      name='icp_node',
64      condition=LaunchConfigurationEquals('icp_method', 'icp'),
65      output='screen',
66      parameters=[
67          # --- Blue ---
68          # {'initial_x':14.16}, ...
73          # --- Red ---
74          {'initial_x':0.0},
75          {'initial_y':0.0},
76          {'initial_z':0.0},
77          {'initial_a':0.0},
78
79          {'map_voxel_leaf_size':0.5},
80          {'cloud_voxel_leaf_size':0.3},
81          {'map_frame_id':'map'},
82          {'solver_max_iter':100},
83          {'max_correspondence_distance':0.1},
84          {'RANSAC_outlier_rejection_threshold':0.5},
86          {'map_path': LaunchConfiguration('prior_map')},
87          {'fitness_score_thre':0.9}, # 是最近点距离的平均值，越小越严格
88          {'converged_count_thre':40},
89          {'pcl_type': LaunchConfiguration('icp_input_type')},
90      ],
91      remappings=[('/pointcloud2', LaunchConfiguration('icp_pointcloud_topic'))],
92  )
...
106  # fast-lio localization
107  fast_lio_param = os.path.join(
108      config_path, 'fast_lio_relocalization_param.yaml')
109  fast_lio_node = Node(
110      package='fast_lio',
111      executable='fastlio_mapping',
112      parameters=[
113          fast_lio_param,
114          {'prior_map_path': LaunchConfiguration('prior_map')}
115      ],
116      output='screen',
117      remappings=[('/Odometry','/state_estimation')]
118  )
```

**逐行拆解**

- **51–58** — 启动中继节点，并传入 `source_frame_id`（默认 `lidar_link`）与 `initial_odom_frame_id='imu_link'`——让它去查那条静态外参，而不是走直接模式。
- **60–64** — 启动 ICP 节点，但带 `condition=LaunchConfigurationEquals('icp_method','icp')`：只有选择普通 ICP 时才启动。
- **67–77** — 注释里保留了蓝方/红方两套初始位姿预设（红方全 0 生效）。换场地时优先改这里。
- **79–89** — 把 13 个 ICP 参数塞进去；`map_path` 来自启动参数 `prior_map`。
- **91** — 把 `/pointcloud2` remap 到 `icp_pointcloud_topic`（独立扫描源）。
- **106–118** — 启动 FAST-LIO，加载**重定位专用** YAML，并用同一个 `prior_map` 覆盖 `prior_map_path`，保证 ICP 与 FAST-LIO 读同一份 PCD；同样 remap 里程计。

| 参数 | `icp_node.cpp` 源码默认 | `icp.launch.py`（独立入口） | `relocalization.launch.py`（总入口） |
| --- | --- | --- | --- |
| `initial_x/y/z/a` | 0/0/0/0 | 0/0/0.1/-2.2 | 0/0/0/0 |
| `map_voxel_leaf_size` | 0.1 | 0.5 | 0.5 |
| `cloud_voxel_leaf_size` | 0.1 | 0.3 | 0.3 |
| `solver_max_iter` | 75 | 75 | 100 |
| `fitness_score_thre` | 0.0 | 0.1 | **0.9** |
| `converged_count_thre` | 20 | 50 | 40 |
| `map_path` | 空 | 硬编码 `/home/sentry_ws/...` | `LaunchConfiguration('prior_map')` |

README_USAGE.md 明确警告：**这三套默认值互不相同，不能混用**。改参数前先确认你实际启动的是哪个 launch。

> [!CAUTION] 参数优先级
> 源码 `declare_parameter` 默认值 &lt; launch 的 `parameters=[...]` &lt; 命令行 `--ros-args -p`。三套 ICP 默认差别极大（`fitness_score_thre` 从 0.0 到 0.9），照着 A 文档的数值去调 B 入口，会完全对不上。

### 9.8 另一条配准路线：SAC-IA + GICP

`icp_method:=sac_ia_gicp` 时改走 `sac_ia_gicp.cpp`：先用 **FPFH 特征 + SAC-IA** 做不依赖初值的全局粗配准，再用 ICP 精配准。适合完全不知道初始位置、或普通 ICP 收敛到错误重复结构的场合。总入口通过 `result_topic: '/icp_result'` 和 `one_shot: 'true'` 让它对下游表现得和普通 ICP 完全一样。

> [!WARNING] 名字叫 GICP，实际用的是普通 ICP
> `sac_ia_gicp.cpp` 虽然 include 了 `pcl/registration/gicp.h`，但第 185 行实例化的是 `pcl::IterativeClosestPoint`，并非 `GeneralizedIterativeClosestPoint`。日志、文件名、README 都称 GICP，**实现与命名不符**。另外 `icp_relocalization/README.md` 把文件名误写成 `san_ia_gicp`。

> [!WARNING] 低得分 ≠ 位置正确
> README_USAGE.md §6.3 特别提醒：SAC-IA/GICP 的低得分不能确认配准位置正确，尤其是重复墙面和规则结构。接入总入口前必须独立跑一次、在 RViz 里对照 `/template_cloud` 与 `/icp_cloud` 目视确认。

---

## 10 · 一键启动的门控：不让 Nav2 在没定位时乱跑

*一个 65 行的 launch + 一个 63 行的 Python 脚本，把「先定位、后导航」变成硬约束。*

### 10.1 bringup_all_in_one.launch.py 全文逐行

**`src/sentry_bringup/launch/bringup_all_in_one.launch.py（第 30-65 行）`** · 源码第 **30–65** 行

```py startLineNumber=30
def generate_launch_description():
    share = get_package_share_directory('sentry_bringup')

    def include(filename):
        return IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(share, 'launch', filename)))

    start_relocalization = include('relocalization.launch.py')
    start_navigation = include('navigation.launch.py')
    gate = Node(
        package='sentry_bringup',
        executable='wait_for_localization.py',
        parameters=[{'timeout': ParameterValue(
            LaunchConfiguration('localization_timeout'), value_type=float)}],
        output='screen',
    )

    def after_gate(event, context):
        if context.is_shutdown:
            return []
        if event.returncode == 0:
            return [start_navigation]
        get_logger('sentry_bringup').error('Localization did not become ready; Nav2 will not start.')
        return [EmitEvent(event=Shutdown(reason='Localization gate failed'))]

    return LaunchDescription([
        DeclareLaunchArgument('localization_timeout', default_value='90.0'),
        # Declare these before the gate so they are visible in --show-args.
        DeclareLaunchArgument('use_rviz', default_value='true'),
        DeclareLaunchArgument('use_livox_driver', default_value='true'),
        DeclareLaunchArgument('prior_map', default_value=os.path.join(share, 'maps', 'GlobalMap.pcd')),
        DeclareLaunchArgument('params_file', default_value=os.path.join(share, 'params', 'nav2_params.yaml')),
        RegisterEventHandler(OnProcessExit(target_action=gate, on_exit=after_gate)),
        start_relocalization,
        gate,
    ])
```

> 这是 ROS 2 launch 里非常漂亮的「事件驱动」写法：不用猜延时多久，而是由一个真正检查系统状态的进程来决定下一步。

**逐行拆解**

- **60** — 拿到包的安装 share 目录。
- **62–64** — 定义小工具 `include(filename)`，拼出 launch 文件的绝对路径并包装成 `IncludeLaunchDescription`。
- **37、38** — 先把「重定位」和「导航」两个 launch **声明为对象**（此刻还没启动）。
- **39–45** — 定义门禁节点 `wait_for_localization.py`，把 `localization_timeout` 转成 float 传进去。
- **42、43** — `ParameterValue(..., value_type=float)` 把命令行的字符串 `'90.0'` 转成真正的浮点数，否则 ROS 参数类型不对。
- **47–53** — **门控回调**：门禁进程退出时检查返回码。`returncode == 0`（定位就绪）才返回 `[start_navigation]` 启动导航；否则打印错误并 `Shutdown` 整个启动。
- **48、49** — 如果本来就在关闭过程中，什么都不做。
- **55–61** — 声明 5 个可从命令行覆盖的参数：超时 90 秒、RViz、雷达驱动、先验 PCD、Nav2 参数文件。注释说明「先声明，才能出现在 `--show-args` 里」。
- **62** — `RegisterEventHandler(OnProcessExit(target_action=gate, ...))`：把「gate 进程退出」这个事件绑定到 `after_gate`。
- **63、64** — **立即启动**重定位和门禁；导航不在列表里，要等事件触发。

### 10.2 wait_for_localization.py 全文逐行

**`src/sentry_bringup/scripts/wait_for_localization.py（全文）`** · 源码第 **1–63** 行

```py
#!/usr/bin/env python3
"""Wait for recent odometry and a complete TF chain before starting Nav2."""

import time

import rclpy
from nav_msgs.msg import Odometry
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from rclpy.time import Time
from tf2_ros import Buffer, TransformListener


class LocalizationGate(Node):
    def __init__(self):
        super().__init__('wait_for_localization')
        self.timeout = self.declare_parameter('timeout', 90.0).value
        self.buffer = Buffer()
        self.listener = TransformListener(self.buffer, self)
        self.latest = None
        self.received_at = 0.0
        self.previous_stamp = None
        self.subscribe_odom = self.create_subscription(
            Odometry, '/state_estimation', self.on_odometry, qos_profile_sensor_data)

    def on_odometry(self, msg):
        if msg.header.frame_id != 'odom' or msg.child_frame_id != 'base_link':
            return
        stamp = Time.from_msg(msg.header.stamp)
        if self.latest is not None and stamp <= self.latest:
            return
        self.previous_stamp = self.latest
        self.latest = stamp
        self.received_at = time.monotonic()

    def ready(self):
        return (
            self.previous_stamp is not None and time.monotonic() - self.received_at < 1.0
            and self.buffer.can_transform('map', 'chassis_link', self.latest)
        )


def main():
    rclpy.init()
    node = LocalizationGate()
    deadline = time.monotonic() + node.timeout
    try:
        while rclpy.ok() and time.monotonic() < deadline:
            rclpy.spin_once(node, timeout_sec=0.1)
            if node.ready():
                node.get_logger().info('Localization ready: odometry and map -> chassis_link are available')
                return 0
        node.get_logger().error('Localization not ready: check ICP, /state_estimation and map -> chassis_link')
        return 1
    except KeyboardInterrupt:
        return 1
    finally:
        node.destroy_node()
        rclpy.try_shutdown()


if __name__ == '__main__':
    raise SystemExit(main())
```

> 这个脚本很短，但把「定位到底算不算好了」写成了可执行的判据，而不是靠人眼看 RViz 或靠固定延时。

**逐行拆解**

- **1** — shebang：因为 `CMakeLists.txt` 用 `install(PROGRAMS ...)` 把它装成可执行程序，这一行必须有。
- **2** — 模块说明：等最近的里程计和完整的 TF 链，才允许启动 Nav2。
- **6–11** — 导入 rclpy、`Odometry` 消息、传感器 QoS、`Time`、`tf2_ros` 的 Buffer/Listener。
- **16、17** — 节点名 `wait_for_localization`；读 `timeout` 参数（默认 90 秒）。
- **18、19** — 创建 TF Buffer 和 Listener，用来查询变换是否可用。
- **20–22** — 三个状态变量：最新时间戳、收到时刻、上一个时间戳。
- **23、24** — 订阅 `/state_estimation`，用 `qos_profile_sensor_data`（与发布端传感器 QoS 兼容）。
- **26–28** — **坐标帧校验**：里程计的父帧必须是 `odom`、子帧必须是 `base_link`，否则丢弃。这能抓出 TF 配置错误。
- **29–31** — 把消息头时间戳转成 `Time`；若时间戳没有递增（重复/回放）就丢弃。
- **32–34** — 保存上一个时间戳、更新最新时间戳，并用 `time.monotonic()` 记下真实收到时刻（单调时钟，不受系统时间调整影响）。
- **36–40** — **三个就绪条件**：① 收到过至少两帧（`previous_stamp` 非空）；② 最近一帧在 1 秒内；③ `map → chassis_link` 这条 TF 在最新时刻可查询。
- **43–46** — 初始化 ROS、创建节点、算出绝对截止时间。
- **48–50** — 每 0.1 秒 `spin_once` 处理一次回调，并检查 `ready()`。
- **51、52** — 就绪 → 打印日志 → `return 0`（**退出码 0 就是给 launch 的信号**）。
- **53、54** — 超时 → 打印提示（检查 ICP、里程计、TF）→ `return 1`，launch 收到非 0 就关闭整个启动。
- **57–59** — `finally` 里销毁节点、关闭 rclpy，保证干净退出。
- **62、63** — `raise SystemExit(main())` 把 `main()` 的返回值变成进程退出码。

> [!TIP] 为什么用退出码通信
> ROS 2 launch 的 `OnProcessExit` 能拿到进程的 `event.returncode`。让一个一次性检查脚本用 `0/1` 表达「可以/不可以」，是最简单可靠的跨进程握手方式。

### 10.3 两种「等待」策略的对比

|   | 事件门控（推荐入口） | 固定定时（实验入口） |
| --- | --- | --- |
| 实现 | `wait_for_localization.py` + `OnProcessExit` | `TimerAction(period=10.0)` |
| 判据 | 两帧递增里程计 + 1 秒内有数据 + `map→chassis_link` 可查 | 只数 10 秒 |
| 失败行为 | 打印错误并 `Shutdown`，Nav2 不启动 | 到点照常启动 Nav2，可能带着错误定位乱跑 |
| 适用 | 实车 / 联调 / 日常 | 已知定位一定好的离线回放 |

> [!WARNING] 别在定位没好的时候直接开 navigation.launch.py
> 没有 `map → chassis_link` 的 TF，代价地图和路径无从谈起；Nav2 会在没有正确位姿的情况下规划，轻则不动，重则撞墙。`docs/CODEBASE_GUIDE.md` 把「定位就绪」列为联调第 3 优先确认项。

---

## 11 · Nav2 启动全景：navigation.launch.py

*一个文件拉起 8 个生命周期节点、地形分析和 RViz，并把速度话题改了三次名。*

### 11.1 最烧脑的一层：运行时改写参数文件

**`src/sentry_bringup/launch/navigation.launch.py（第 34-81 行）`** · 源码第 **34–75** 行

```py startLineNumber=34
34    bringup_dir = get_package_share_directory('sentry_bringup')
35    default_params = os.path.join(bringup_dir, 'params', 'nav2_params.yaml')
36
37    namespace = LaunchConfiguration('namespace')
38    use_sim_time = LaunchConfiguration('use_sim_time')
39    autostart = LaunchConfiguration('autostart')
40    params_file = LaunchConfiguration('params_file')
41    use_composition = LaunchConfiguration('use_composition')
42    container_name = LaunchConfiguration('container_name')
43    container_name_full = (namespace, '/', container_name)
44    use_respawn = LaunchConfiguration('use_respawn')
45    log_level = LaunchConfiguration('log_level')
46
47    lifecycle_nodes = [
48                       'map_server',
49                       'controller_server',
50                       'smoother_server',
51                       'planner_server',
52                       'behavior_server',
53                       'bt_navigator',
54                       'waypoint_follower',
55                       'velocity_smoother'
56                       ]
...
64    remappings = [('/tf', 'tf'),
65                  ('/tf_static', 'tf_static')]
66
67    # Create our own temporary YAML files that include substitutions
68    param_substitutions = {
69        'use_sim_time': use_sim_time,
70        'autostart': autostart}
71
72    configured_params = ParameterFile(
73        RewrittenYaml(
74            source_file=ReplaceString(
75                source_file=params_file,
76                replacements={'/home/sentry_ws/src/sentry_bringup': bringup_dir},
77                condition=LaunchConfigurationEquals('params_file', default_params)),
78            root_key=namespace,
79            param_rewrites=param_substitutions,
80            convert_types=True),
81        allow_substs=True)
```

> 为什么要这么绕？因为 `nav2_params.yaml` 第 53、54、360 行硬编码了 `/home/sentry_ws/...`。这层改写让同一份配置在别的机器上也能跑，代价是「传自定义 params_file 时替换失效」这个隐藏陷阱。

**逐行拆解**

- **67、68** — 默认参数文件指向**安装目录**（`install/share/sentry_bringup/params/nav2_params.yaml`），不是源码目录。改了源码 YAML 要重新 `colcon build` 才生效。
- **37–45** — 9 个 `LaunchConfiguration` 占位符，对应下面声明的启动参数。
- **47–56** — **8 个受生命周期管理的节点**。注意不含 `terrain_analysis`、不含 RViz、也不含 `amcl`——定位由 FAST-LIO+ICP 提供。
- **64、65** — 把全局 `/tf`、`/tf_static` 改成相对名，这是 Nav2 官方为多机器人命名空间准备的 workaround。
- **68–70** — 把启动参数 `use_sim_time`、`autostart` 覆盖进 YAML 的所有节点段。
- **72–81** — **三层嵌套**：`ReplaceString` 把 YAML 里硬编码的 `/home/sentry_ws/src/sentry_bringup` 换成实际安装目录；`RewrittenYaml` 再做命名空间与参数覆盖；`ParameterFile(allow_substs=True)` 生成临时 YAML。
- **76、77** — 替换**只在 `params_file` 等于默认值时生效**！如果你用 `params_file:=` 传自定义 YAML，就必须自己把里面的三个绝对路径写对（行为树 XML、地图 YAML）。

### 11.2 可从命令行覆盖的启动参数

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `namespace` | 空 | 顶层命名空间；本工程单机器人，保持空 |
| `use_sim_time` | `false` | 实车不用 Gazebo 时钟 |
| `params_file` | 安装目录的 `nav2_params.yaml` | 传自定义值会**跳过路径替换** |
| `autostart` | `true` | lifecycle_manager 自动 configure → activate |
| `use_composition` | `False` | 默认独立进程；True 则加载进组件容器 |
| `container_name` | `nav2_container` | 组合模式的容器名（本文件不创建容器） |
| `use_respawn` | `True` | 崩溃后重启，间隔 2 秒 |
| `log_level` | `error` | 所有节点的日志级别 |
| `use_rviz` | `true` | 第 342 行内联声明，控制 RViz |

> [!WARNING] planner_server 不会自动重启
> 第 158-159 行把 `planner_server` 的 `respawn` 和 `respawn_delay` **注释掉了**，而其他 7 个节点都有。规划器崩溃后不会拉起——这是调试遗留，实车跑长任务时要留意。

### 11.3 独立进程分支：节点是怎么被声明的

**`src/sentry_bringup/launch/navigation.launch.py（第 121-142、173-214 行）`** · 源码第 **121–167** 行

```py startLineNumber=121
121    load_nodes = GroupAction(
122        condition=IfCondition(PythonExpression(['not ', use_composition])),
123        actions=[
124            Node(
125                package='nav2_map_server',
126                executable='map_server',
127                name='map_server',
128                output='screen',
129                respawn=use_respawn,
130                respawn_delay=2.0,
131                parameters=[configured_params],
132                arguments=['--ros-args', '--log-level', log_level],
133                remappings=remappings),
134            Node(
135                package='nav2_controller',
136                executable='controller_server',
137                output='screen',
138                respawn=use_respawn,
139                respawn_delay=2.0,
140                parameters=[configured_params],
141                arguments=['--ros-args', '--log-level', log_level],
142                remappings=remappings + [('cmd_vel', 'cmd_vel_nav')]),
...
173            Node(
174                package='nav2_bt_navigator',
175                executable='bt_navigator',
176                name='bt_navigator',
...
190              Node(
191                package='nav2_velocity_smoother',
192                executable='velocity_smoother',
193                name='velocity_smoother',
...
201                remappings=remappings +
202                        [('cmd_vel', 'cmd_vel_nav'), ('cmd_vel_smoothed', 'cmd_vel')]),
...
204            Node(
205                package='nav2_lifecycle_manager',
206                executable='lifecycle_manager',
207                name='lifecycle_manager_navigation',
208                output='screen',
209                arguments=['--ros-args', '--log-level', log_level],
210                parameters=[{'use_sim_time': use_sim_time},
211                            {'autostart': autostart},
212                            {'node_names': lifecycle_nodes}]),
213        ]
214    )
```

**逐行拆解**

- **121–123** — `GroupAction` 带条件：只有「非组合模式」才执行这组动作。
- **124–133** — 典型节点声明：包名、可执行名、节点名、崩溃重启、参数文件、日志级别、TF remap。
- **134–142** — `controller_server` 没有显式 `name=`，节点名取可执行名。**关键 remap**：`('cmd_vel','cmd_vel_nav')` 把控制器输出改到 `/cmd_vel_nav`。
- **190–202** — 速度平滑器：输入 `cmd_vel` 被 remap 成 `cmd_vel_nav`（接控制器），输出 `cmd_vel_smoothed` 被 remap 成 `cmd_vel`（接底盘链）。**一个节点做了两次改名**。
- **204–212** — `lifecycle_manager_navigation` 按 `lifecycle_nodes` 列表依次把 8 个 LifecycleNode 从 `unconfigured` 推到 `active`。它自己**不在**列表里。

> [!NOTE] LifecycleNode 为什么需要 manager
> Nav2 的节点启动后默认停在 `unconfigured`，必须依次调用 `configure()`（读参数、建资源）和 `activate()`（开始发布/订阅）。如果 `autostart=false`，你得手工 `ros2 lifecycle set /map_server configure` 一个个来。排障时 `ros2 lifecycle get /map_server` 卡在 `inactive` 是常见现象。

### 11.4 速度链的四次改名

1. **controller_server（MPPI）**：内部以为自己发 `cmd_vel`，被 remap 到 **`/cmd_vel_nav`**
2. **velocity_smoother**：订阅 `cmd_vel_nav`，限加速度后把 `cmd_vel_smoothed` remap 成 **`/cmd_vel`**
3. **twist_transformer**：查 `chassis_link ↔ yaw_link` 的 TF，把速度旋转到云台 yaw 系，发 **`/cmd_vel_in_yaw`**
4. **twist2chassis_cmd**：把 Twist 封装成 `rm_interfaces/msg/ChassisCmd`，发 **`/chassis_cmd`**
5. **（本仓库缺失）**：把 `/chassis_cmd` 通过串口/CAN 下发给电控的驱动节点

> Nav2 控制器 → /cmd_vel_nav → 速度平滑器 → /cmd_vel → twist_transformer → /cmd_vel_in_yaw → twist2chassis_cmd → /chassis_cmd
>
> —— README_USAGE.md §7 指令链

### 11.5 地形分析与被注释掉的节点

**`src/sentry_bringup/launch/navigation.launch.py（第 279-300、310-325、327-353 行）`** · 源码第 **279–310** 行

```py startLineNumber=279
279    start_terrain_analysis = IncludeLaunchDescription(
280        FrontendLaunchDescriptionSource(os.path.join(
281        get_package_share_directory('terrain_analysis'), 'launch', 'terrain_analysis.launch')
282        )
283    )
...
289    start_terrain_analysis_ext = IncludeLaunchDescription(
290        FrontendLaunchDescriptionSource(os.path.join(
291        get_package_share_directory('terrain_analysis_ext'), 'launch', 'terrain_analysis_ext.launch')
292        ),
293    )
...
310    ground_segmentation_node_param = os.path.join(bringup_dir, 'params', 'segmentation_params.yaml')
311    ground_segmentation_node = Node(
312            package='linefit_ground_segmentation_ros',
313            executable='ground_segmentation_node',
314            output='screen',
315            parameters=[ground_segmentation_node_param])
...
327    ld = LaunchDescription()
...
340    ld.add_action(DeclareLaunchArgument('use_rviz', default_value='true'))
341    # add terrain analysis
342    ld.add_action(start_terrain_analysis)
343    # ld.add_action(start_terrain_analysis_ext)
344    # ld.add_action(ground_segmentation_node)
345    # Add the actions to launch all of the navigation nodes
346    ld.add_action(load_nodes)
347    ld.add_action(load_composable_nodes)
348    ld.add_action(start_rviz)
349
350    return ld
```

**逐行拆解**

- **279–283** — **默认启动普通地形分析**（XML launch）。它把 `/cloud_registered` 变成 `/terrain_map`，喂给局部代价地图。
- **289–293** — 定义了扩展地形分析对象，但第 343 行被注释 → 不启动。
- **310–315** — 定义 LineFit 地面分割节点，第 344 行被注释 → 不启动。它对应一套**被弃用的备选感知方案**（见第 12 章）。
- **342** — 只有普通地形分析真正加入启动列表。
- **346–348** — 导航节点组、组合模式节点组（条件不满足时为空）、RViz。
- **350** — 返回描述。

> [!TIP] 两条可选的「感知 → 代价地图」路线
> **方案 A（现行）**：`terrain_analysis` → `/terrain_map`（intensity=离地高度）→ 自定义 `ObstacleLayerIntensity`。
>
> **方案 B（注释保留）**：`linefit_ground_segmentation` → `/segmentation/obstacle` → Nav2 原生 `ObstacleLayer`（按 z 高度过滤）。`nav2_params.yaml:289-307` 整段注释就是方案 B 的配置。两套方案二选一，当前选 A，因为 A 能处理坡道。

> [!WARNING] navigation.launch.py 里没有 TimerAction
> 这个文件本身**不延时**。延时来自外层：推荐入口用第 10 章的事件门控；实验入口 `bringup_without_relocalization.py` 用 `TimerAction(period=10.0)`。另外它没有 `map:=` 参数，换地图只能改 YAML 的 `yaml_filename` 或传整个 `params_file:=`。

---

## 12 · nav2_params.yaml：552 行参数逐块拆解

*这份 YAML 决定了「怎么规划、怎么避障、卡住怎么办」。按决策 → 规划 → 控制 → 感知 → 恢复的顺序读。*

### 12.1 顶层有哪些配置段

| 配置段 | 行号 | 作用 | 本章小节 |
| --- | --- | --- | --- |
| `amcl`（整块注释） | 1-41 | 原本做概率定位；本工程定位由 FAST-LIO+ICP 负责，所以不用 | — |
| `bt_navigator` | 43-111 | 行为树导航器：全局/底盘坐标系、默认行为树路径、48 个 BT 节点插件 | 12.2 |
| `controller_server` + `FollowPath`(MPPI) | 113-247 | 80 Hz 局部控制器与它的 5 个评分器 | 12.3 / 12.4 |
| `local_costmap` | 249-311 | 滚动局部代价地图，接 `/terrain_map` | 12.5 |
| `global_costmap` | 313-352 | 静态栅格地图 + 膨胀层 | 12.6 |
| `map_server` / `map_saver` | 355-368 | 默认加载哪张 PNG+YAML，保存阈值 | 12.6 |
| `planner_server` | 373-444 | Theta* 全局规划器（其余算法注释保留） | 12.7 |
| `smoother_server` | 446-486 | ConstrainedSmoother 路径平滑 | 12.7 |
| `behavior_server` | 494-523 | 恢复行为插件，含自定义 BackUpTwzFree | 12.7 |
| `waypoint_follower` / `velocity_smoother` | 525-553 | 航点停留；速度/加速度限幅 | 12.7 |

### 12.2 bt_navigator：决策层

**`src/sentry_bringup/params/nav2_params.yaml（第 43-80 行）`** · 源码第 **43–76** 行

```yaml startLineNumber=43
bt_navigator:
  ros__parameters:
    use_sim_time: False
    global_frame: map
    robot_base_frame: chassis_link
    odom_topic: /state_estimation
    bt_loop_duration: 10
    default_server_timeout: 20
    # 'default_nav_through_poses_bt_xml' and 'default_nav_to_pose_bt_xml' are use defaults:
    # nav2_bt_navigator/navigate_to_pose_w_replanning_and_recovery.xml
    default_nav_through_poses_bt_xml: /home/sentry_ws/src/sentry_bringup/behavior_tree/navigate_through_pose_w_replanning_and_recovery.xml
    default_nav_to_pose_bt_xml: /home/sentry_ws/src/sentry_bringup/behavior_tree/navigate_to_pose_w_replanning_and_recovery.xml
    # They can be set here or via a RewrittenYaml remap from a parent launch file to Nav2.
    plugin_lib_names:
      - nav2_compute_path_to_pose_action_bt_node
      - nav2_compute_path_through_poses_action_bt_node
      - nav2_smooth_path_action_bt_node
      - nav2_follow_path_action_bt_node
      - nav2_spin_action_bt_node
      - nav2_wait_action_bt_node
      - nav2_assisted_teleop_action_bt_node
      - nav2_back_up_action_bt_node
      - nav2_drive_on_heading_bt_node
      - nav2_clear_costmap_service_bt_node
      - nav2_is_stuck_condition_bt_node
      - nav2_goal_reached_condition_bt_node
      - nav2_goal_updated_condition_bt_node
      - nav2_globally_updated_goal_condition_bt_node
      - nav2_is_path_valid_condition_bt_node
      - nav2_rate_controller_bt_node
      - nav2_distance_controller_bt_node
      - nav2_speed_controller_bt_node
      - nav2_recovery_node_bt_node
      - nav2_pipeline_sequence_bt_node
```

**逐行拆解**

- **46–48** — 全局帧 `map`、机体帧 `chassis_link`、里程计话题 `/state_estimation`（不是默认 `/odom`）。
- **49、50** — 行为树 tick 周期 10 ms；等待 action server 超时 20 秒。
- **53、54** — **默认行为树**是 `navigate_to_pose_w_replanning_and_recovery.xml`；多点航点用第 53 行那棵。路径硬编码 `/home/sentry_ws/...`，靠第 11 章的 `ReplaceString` 改写。
- **56–76** — `plugin_lib_names` 列出要加载的 BehaviorTree.CPP 节点插件（共 48 个）。**行为树 XML 里用到的每个节点都必须在这里登记**，否则启动时报 `Node not found`。

### 12.3 controller_server 与 MPPI 控制器

**`src/sentry_bringup/params/nav2_params.yaml（第 113-162 行）`** · 源码第 **113–162** 行

```yaml startLineNumber=113
controller_server:
  ros__parameters:
    use_sim_time: False
    controller_frequency: 80.0
    min_x_velocity_threshold: 0.05
    min_y_velocity_threshold: 0.05
    min_theta_velocity_threshold: 0.1
    failure_tolerance: 1.0
    odom_topic: "state_estimation"
    progress_checker_plugin: "progress_checker"
    goal_checker_plugins: ["general_goal_checker"]
    controller_plugins: ["FollowPath"]
    # Progress checker parameters
    progress_checker:
      plugin: "nav2_controller::SimpleProgressChecker"
      required_movement_radius: 0.5
      movement_time_allowance: 3.0
    # Goal checker parameters
    general_goal_checker:
      stateful: False
      plugin: "nav2_controller::SimpleGoalChecker"
      xy_goal_tolerance: 0.3
      yaw_goal_tolerance: 3.14
    FollowPath:
      plugin: "nav2_mppi_controller::MPPIController"
      #param
      adjustThre: 14.0
      minAngleDiff: 365.0
      adjustHeadingSpeed: 0.2
      #
      time_steps: 180
      model_dt: 0.014
      batch_size: 1500
      vx_std: 0.78
      vy_std: 0.78
      wz_std: 0.1
      vx_max: 1.4
      vx_min: -1.4
      vy_max: 1.4
      wz_max: 0.1
      iteration_count: 1
      prune_distance: 4.0
      transform_tolerance: 0.1
      temperature: 0.3
      gamma: 0.07
      motion_model: "Omni"
      visualize: false
      reset_period: 1.0
      regenerate_noises: false
      retry_attempt_limit: 3
```

**逐行拆解**

- **116** — **控制频率 80 Hz**，与 MPPI 的 `model_dt=0.014`、平滑器的 80 Hz 对齐。
- **120** — 插件连续失败 1 秒才报错。
- **121** — 里程计话题 `state_estimation`。
- **126–129** — 进度检查器：3 秒内必须移动 0.5 m，否则判定「卡住」，触发行为树恢复。
- **131–135** — 目标检查器：位置容差 0.3 m；**`yaw_goal_tolerance: 3.14`（≈180°）等于几乎不检查到达朝向**——全向底盘到位即可。
- **137** — 控制器插件是 MPPI（Model Predictive Path Integral）：随机采样大量候选轨迹，按代价加权挑最优。
- **139–141** — **这三个不是 Nav2 原生 MPPI 参数**：`adjustThre`（坡度超 14° 触发调整车头）、`minAngleDiff`、`adjustHeadingSpeed`。说明部署环境用了打过补丁的 `nav2_mppi_controller`；用官方 apt 包时会被忽略。`minAngleDiff: 365.0` 大于 360°，等于永不满足的占位值。
- **143–145** — 预测时域 `180 × 0.014 ≈ 2.52 s`（注释写 3 s）；每轮采样 1500 条轨迹。
- **149–152** — 速度上限 vx/vy 各 ±1.4 m/s，角速度仅 ±0.1 rad/s（全向底盘主要靠平移）。
- **158** — `motion_model: "Omni"` 全向模型——这决定了后面自定义恢复行为可以斜着平移撤离。

> [!NOTE] MPPI 在做什么
> 每个控制周期，它从当前状态出发，按噪声随机生成 1500 条未来 2.5 秒的速度序列，在代价地图上模拟每条轨迹会撞到什么、离全局路径多远、离目标多远，用 `temperature`/`gamma` 加权算出总分，取最优的第一帧速度发出去。下一周期重来。

### 12.4 critics：MPPI 的五个评分器

**`src/sentry_bringup/params/nav2_params.yaml（第 163-192 行）`** · 源码第 **163–187** 行

```yaml startLineNumber=163
163      TrajectoryVisualizer:
164        trajectory_step: 5
165        time_step: 3
166      critics: ["ObstaclesCritic", "GoalCritic", "PathAlignCritic", "PathFollowCritic", "TwirlingCritic"]
...
171      GoalCritic:
172        enabled: true
173        cost_power: 1
174        cost_weight: 5.0
175        threshold_to_consider: 0.7
176      PreferForwardCritic:
177        enabled: false
...
180      ObstaclesCritic: # 如果容易撞到低矮的障碍物，检查地形分析是否正确然后再调整这个参数
181        enabled: true
182        cost_power: 1
183        repulsion_weight: 0.2
184        critical_weight: 20.0
185        consider_footprint: false
186        collision_cost: 40.0
187        collision_margin_distance: 0.05
188        near_goal_distance: 0.1
189        inflation_radius: 0.4
190        cost_scaling_factor: 10.0
191        inflation_layer_name: ["local_inflation_layer","global_inflation_layer"]
```

**逐行拆解**

- **166** — 启用 5 个评分器：障碍、目标、路径对齐、路径跟随、抑制原地打转。`PreferForwardCritic` 关闭（全向车不偏好前进）。
- **171–175** — 目标评分器：离目标 0.7 m 以内才不再考虑距离代价。
- **180** — **这条中文注释直接连到第 07、13 章**：「如果容易撞到低矮的障碍物，检查地形分析是否正确然后再调整这个参数」——低矮障碍能不能进代价地图，取决于 `/terrain_map` 的 intensity 与插件阈值。
- **183–187** — 障碍排斥权重、致命权重、碰撞代价、碰撞边距。
- **189–191** — `inflation_radius: 0.4` / `cost_scaling_factor: 10.0` 注释要和膨胀层一致，但**实际 local_inflation_layer 是 0.4 / 5.0**，global 是 0.5 / 10.0，并不一致。

### 12.5 local_costmap：本工程定制化程度最高的一段

**`src/sentry_bringup/params/nav2_params.yaml（第 249-288 行）`** · 源码第 **249–285** 行

```yaml startLineNumber=249
249 local_costmap:
250   local_costmap:
251     ros__parameters:
252       update_frequency: 20.0
253       publish_frequency: 20.0
254       global_frame: map
255       robot_base_frame: chassis_link
256       use_sim_time: False
257       rolling_window: true
258       width: 7
259       height: 7
260       resolution: 0.05
261       robot_radius: 0.35
262       plugins: ["local_obstacle_layer", "local_inflation_layer"]
263       local_inflation_layer:
264         plugin: "nav2_costmap_2d::InflationLayer"
265         cost_scaling_factor: 5.0
266         inflation_radius: 0.4
...
271       local_obstacle_layer:
272         plugin: "costmap_intensity::ObstacleLayerIntensity"
273         enabled: True
274         footprint_clearing_enabled: True
275         max_obstacle_intensity: 2.0
276         min_obstacle_intensity: 0.3
277         observation_sources: pointcloud
278         pointcloud:  # no frame set, uses frame from message
279           topic: /terrain_map # produce error msg: can not compute xxxx, it is fine, just ignore it
280           max_obstacle_height: 2.0
281           min_obstacle_height: -2.0
282           obstacle_max_range: 7.0
283           obstacle_min_range: 0.15
284           raytrace_max_range: 8.0
285           raytrace_min_range: 0.1
286           clearing: True
287           marking: True
288           data_type: "PointCloud2"
```

**逐行拆解**

- **252、253** — 20 Hz 更新与发布。
- **254** — **`global_frame: map`**（很多工程用 `odom`）。因为 ICP 提供了 `map→odom`，地形点云也在 map/odom 系。
- **257–261** — 滚动窗口 7×7 m、分辨率 0.05 m、机器人半径 0.35 m。7 m 正好满足 MPPI 注释里「预测距离 3 m × 2」的要求。
- **262** — 只挂 2 层：自定义障碍层 + 膨胀层。
- **263–266** — 膨胀层：在障碍周围按指数衰减铺代价，`inflation_radius 0.4`、`cost_scaling_factor 5.0`。
- **272** — **`plugin: costmap_intensity::ObstacleLayerIntensity`** —— 换成自研插件（第 13 章逐行拆）。
- **275、276** — **本工程最重要的两个阈值**：`min_obstacle_intensity: 0.3` 丢掉离地不足 30 cm 的地面起伏；`max_obstacle_intensity: 2.0` 拦掉异常/无数据填充点。
- **277–279** — 观察源取名 `pointcloud`，订阅 `/terrain_map`。注释说「会报 can not compute xxx，忽略即可」——指的是点云没有 sensor frame 时的 TF 告警。
- **280–285** — 按高度/距离过滤：`obstacle_max_range 7.0`、`raytrace_max_range 8.0`（清障射线比标记范围更远）。
- **286–288** — 同一数据源既 `marking`（标障碍）又 `clearing`（清自由空间）；数据格式 `PointCloud2`。

> [!NOTE] 阈值为什么是 0.3 和 2.0
> 第 07 章说过：`/terrain_map` 的 `intensity = disZ = 点.z − 局部地面高度`，且只输出 `[0, vehicleHeight=1.5)` 的点。所以地面点 ≈0 被 `0.3` 滤掉；30 cm 以上的台阶/障碍保留；无数据填充点（intensity=1.5）和异常值被 `2.0` 兜住。**这是「把语义信息编码进点云字段」换来的极简过滤逻辑**。

> [!WARNING] 被注释的原生方案 & 预留的扩展层
> 第 289-307 行留有原生 `nav2_costmap_2d::ObstacleLayer` + `/segmentation/obstacle` 的完整配置（方案 B）；第 308-310 行定义了 `static_layer` 但**不在 `plugins` 列表里，因此不生效**；第 334-352 行还有一套接 `/terrain_map_ext` 的 `global_obstacle_layer`（`min_obstacle_intensity: 0.2`），与 launch 里被注释的 `start_terrain_analysis_ext` 配套，属于预留扩展。

### 12.6 global_costmap 与地图文件

**`src/sentry_bringup/params/nav2_params.yaml（第 313-333、355-368 行）`** · 源码第 **313–344** 行

```yaml startLineNumber=313
313 global_costmap:
314   global_costmap:
315     ros__parameters:
316       update_frequency: 1.0
317       publish_frequency: 1.0
318       global_frame: map
319       robot_base_frame: chassis_link
320       use_sim_time: False
321       robot_radius: 0.35
322       resolution: 0.1
323       track_unknown_space: true
324       plugins: ["static_layer", "global_inflation_layer"] # "global_obstacle_layer",
325       static_layer:
326         plugin: "nav2_costmap_2d::StaticLayer"
327         map_subscribe_transient_local: True
328       global_inflation_layer:
329         plugin: "nav2_costmap_2d::InflationLayer"
330         cost_scaling_factor: 10.0
331         inflation_radius: 0.5
...
355 map_server:
356   ros__parameters:
357     use_sim_time: False
360     yaml_filename: "/home/sentry_ws/src/sentry_bringup/maps/test_map.yaml"
361
362 map_saver:
363   ros__parameters:
364     use_sim_time: False
365     save_map_timeout: 5.0
366     free_thresh_default: 0.25
367     occupied_thresh_default: 0.65
368     map_subscribe_transient_local: True
```

**逐行拆解**

- **316、317** — 全局代价地图只要 1 Hz（静态地图 + 膨胀，变化慢）。
- **323** — 把未知区域也纳入考虑（三值化地图）。
- **324** — **只有静态层 + 膨胀层，完全不接实时点云**（`global_obstacle_layer` 被注释）。动态/地形障碍全靠局部代价地图。
- **327** — `map_subscribe_transient_local: True`：地图只发一次，用持久 QoS 才能收到。
- **360** — **默认加载 `test_map.yaml`**，硬编码路径靠第 11 章的 `ReplaceString` 改写。换地图要改这里或传自定义 `params_file`。
- **366、367** — 保存阈值 0.25（空闲）/ 0.65（占用），与 `maps/*.yaml` 里的值一致。

| 地图 YAML | 分辨率 | 原点 origin | 说明 |
| --- | --- | --- | --- |
| `test_map.yaml`（**默认**） | 0.1 m/像素 | `[-18.8, -21, 0]` | 大场地，默认生效 |
| `rmuc2024.yaml` | 0.3 m/像素 | `[-0.6, -0.6, 0]` | RMUC 2024 场地备选 |
| `RMUL.yaml` | 0.02 m/像素 | `[-2.5, -3.05, 0]` | RMUL 场地备选 |

YAML 的 `origin` 是图片左下角在 map 系中的坐标，`mode: trinary` 表示占用/空闲/未知三值。目录下还有 `GlobalMap.pcd` 等 3D 点云——**那是给 ICP/FAST-LIO 的定位地图，不是给 Nav2 的栅格地图**。

### 12.7 规划器、平滑器、恢复行为、速度平滑器

**`src/sentry_bringup/params/nav2_params.yaml（第 373-407 行节选）`** · 源码第 **373–389** 行

```yaml startLineNumber=373
373 # see this for selection of planner: https://navigation.ros.org/tuning/index.html
374 # NavFn will typically make broad, sweeping curves; Theta* prefers straight lines and supports them at any angle;
377 planner_server:
378   ros__parameters:
379     expected_planner_frequency: 20.0
380     use_sim_time: False
381     planner_plugins: ["GridBased"]
382     GridBased:
383       # ---- Dijkstra or A* ----
384       # plugin: "nav2_navfn_planner/NavfnPlanner"
...
397       # ---- Theta* ----
398       plugin: "nav2_theta_star_planner/ThetaStarPlanner"
399       how_many_corners: 8
400       w_euc_cost: 1.0
401       w_traversal_cost: 2.0
402       w_heuristic_cost: 1.0
```

**逐行拆解**

- **381** — 只启用一个规划插件，名字 `GridBased`——行为树里 `planner_id="GridBased"` 就是引用它。
- **383–396** — NavfnPlanner、SmacPlanner2D 等配置整段注释保留作备选。
- **398–402** — **Theta\***：8 邻域、欧氏代价权重 1.0、穿越代价权重 2.0、启发权重 1.0。相比 A* 它能产生任意角度的直线段，适合全向底盘。

**`src/sentry_bringup/params/nav2_params.yaml（第 446-475、494-523 行节选）`** · 源码第 **446–482** 行

```yaml startLineNumber=446
446 smoother_server:
447   ros__parameters:
448     use_sim_time: True
449     smoother_plugins: ["SmoothPath"]
450     SmoothPath:
451       # 3rd JUST SOSO
452       # plugin: "nav2_smoother::SimpleSmoother"
...
457       # 1st BEST
458       plugin: "nav2_constrained_smoother/ConstrainedSmoother"
459       reversing_enabled: false
460       path_downsampling_factor: 3
461       path_upsampling_factor: 1
462       minimum_turning_radius: 0.40
463       w_curve: 30.0
464       w_smooth: 2000000.0
465       w_cost: 100.0
...
494 behavior_server:
495   ros__parameters:
496     costmap_topic: local_costmap/costmap_raw
497     footprint_topic: local_costmap/published_footprint
498     cycle_frequency: 10.0
499     behavior_plugins: ["spin", "backup", "drive_on_heading", "assisted_teleop", "wait"]
500     spin:
501       plugin: "nav2_behaviors/Spin"
502     backup:
503       plugin: "nav2_behaviors/BackUpTwzFree"
504     drive_on_heading:
505       plugin: "nav2_behaviors/DriveOnHeading"
...
512     # param for BackUpTwzFree
513     robot_radius: 0.35
514     max_radius: 3.5
515     service_name: "global_costmap/get_costmap"
516     free_threshold: 3
517     visualization: True
```

**逐行拆解**

- **448** — **`use_sim_time: True` 是全文件唯一一个 True**，其他节点都是 False。launch 的 `param_substitutions` 会用启动参数 `false` 覆盖它；但单独 `ros2 run` 调试时行为不同。
- **458–465** — ConstrainedSmoother：`w_smooth: 2000000.0`（极强平滑）、`w_cost: 100.0`、`reversing_enabled: false`。注释里作者对比过 SimpleSmoother（JUST SOSO）等方案。
- **496、497** — 恢复行为服务器订阅局部代价地图原始栅格与机器人足迹。
- **499** — 5 个恢复行为：旋转、后退、沿朝向直行、辅助遥控、等待。
- **502、503** — **`backup` 槽位被换成 `nav2_behaviors/BackUpTwzFree`**。行为树里所有 `<BackUp>` 无需改名，实际执行的已是自定义类——这就是 pluginlib 的用法。
- **513–517** — 自定义后退行为专属参数：搜索半径上限 3.5 m、自由格阈值 3 个、**`service_name` 指向 `global_costmap/get_costmap`**（源码默认是 local）、开启可视化。

**`src/sentry_bringup/params/nav2_params.yaml（第 529-553 行）`** · 源码第 **529–553** 行

```yaml startLineNumber=529
waypoint_follower:
  ros__parameters:
    use_sim_time: False
    loop_rate: 20
    stop_on_failure: false
    waypoint_task_executor_plugin: "wait_at_waypoint"
    wait_at_waypoint:
      plugin: "nav2_waypoint_follower::WaitAtWaypoint"
      enabled: True
      waypoint_pause_duration: 200

velocity_smoother:
  ros__parameters:
    use_sim_time: False
    smoothing_frequency: 80.0
    scale_velocities: False
    feedback: "OPEN_LOOP"
    max_velocity: [1.2, 1.2, 1.0]
    min_velocity: [-1.2, -1.2, -1.0]
    max_accel: [3.0, 3.0, 1.0]
    max_decel: [-3.0, -3.0, -1.0]
    odom_topic: "state_estimation"
    odom_duration: 0.1
    deadband_velocity: [0.05, 0.05, 0.05]
    velocity_timeout: 1.0
```

**逐行拆解**

- **538** — 航点停留 200 秒（调试用，很长）。
- **543** — 平滑频率 80 Hz，与控制器一致。
- **545** — `OPEN_LOOP`：不做闭环反馈校正。
- **546–549** — 最大速度 `[1.2, 1.2, 1.0]`（**低于 MPPI 的 vx_max 1.4**，平滑器会再削一档）、加减速度限制。
- **553** — **1 秒没有新速度指令就停车**，是重要的安全兜底。

### 12.8 这份 YAML 里值得标红的不一致

| # | 位置 | 现象 | 影响 |
| --- | --- | --- | --- |
| 1 | 53 / 54 / 360 行 | 硬编码 `/home/sentry_ws/...`，靠 launch 改写 | 传自定义 `params_file` 时替换失效，行为树/地图加载失败 |
| 2 | 448 行 | `smoother_server.use_sim_time: True`（唯一） | launch 会覆盖；单独跑节点时不一致 |
| 3 | 139-141 行 | `adjustThre` 等非原生 MPPI 参数；`minAngleDiff: 365.0` | 官方 apt 包会忽略；365° 恒不满足 |
| 4 | 190-192 行 | MPPI `cost_scaling_factor: 10.0` vs local inflation `5.0` | 注释要求两者一致，避障行为可能偏离预期 |
| 5 | 308-310 行 | `static_layer` 定义了但不在 local `plugins` 列表 | 该层不生效 |
| 6 | 496 vs 515 行 | `costmap_topic` 是 local，`service_name` 是 global | 自定义后退行为「查全局找方向、查局部防碰撞」 |
| 7 | 135 行 | `yaw_goal_tolerance: 3.14` | 等于不检查到达朝向 |
| 8 | 289-307 / 334-352 行 | 两套被注释的备选配置 | 改配置时容易误以为生效 |

---

## 13 · 自定义代价地图插件 costmap_intensity（逐行精读）

*整个工程最核心的自研改动：只改了十几行，就让 Nav2 会「看相对地面高度」而不是绝对高度。*

### 13.1 它相对 Nav2 原生插件改了什么

`obstacle_layer.cpp`（726 行）和 `voxel_layer.cpp`（501 行）其实是 Nav2 Humble 原生 `nav2_costmap_2d::ObstacleLayer` / `VoxelLayer` 的**整份拷贝**（连 BSD 版权头、作者名、函数顺序都保留）。改动集中在四处：

| # | 改动 | 2D 版 `obstacle_layer.cpp` | 3D 版 `voxel_layer.cpp` |
| --- | --- | --- | --- |
| 1 | 命名空间 / 类名 | `costmap_intensity::ObstacleLayerIntensity : CostmapLayer` | `VoxelLayerIntensity : ObstacleLayerIntensity`（继承自己的 2D 类） |
| 2 | 新增参数 | `min_obstacle_intensity`(0.0) / `max_obstacle_intensity`(2.0) | 只有 `max_obstacle_intensity`(2.0)，**没有 min** |
| 3 | 过滤逻辑 | `updateBounds` 加 `iter_intensity`（`float`）+ 上下限过滤 | `iter_i` 是 **`uint8_t`**，且只有上限过滤 |
| 4 | 动态参数 | 两个阈值支持运行时热调 | 只支持 max |

> [!NOTE] 代价地图的「标记」与「清除」是两件事
> **标记（marking）**：把命中点所在的格子写成 `LETHAL_OBSTACLE`。
>
> **清除（clearing / raytrace）**：从传感器原点到命中点之间画一条射线，把沿途格子清成 `FREE_SPACE`。
>
> 本插件只在**标记**环节按 intensity 过滤；清除环节**保留所有点**（包括被判为地面的低 intensity 点）。这其实是合理的：地面点正好用来把「传感器到地面之间」清成空闲。这个不对称要记住。

### 13.2 pluginlib 四件套

**`src/nav2_plugins/costmap_intensity/plugins/obstacle_layer.cpp（第 1-12 行）`** · 源码第 **1–12** 行

```cpp
#include "costmap_intensity/obstacle_layer.hpp"

#include <algorithm>
#include <memory>
#include <string>
#include <vector>

#include "pluginlib/class_list_macros.hpp"
#include "sensor_msgs/point_cloud2_iterator.hpp"
#include <nav2_costmap_2d/costmap_math.hpp>

PLUGINLIB_EXPORT_CLASS(costmap_intensity::ObstacleLayerIntensity, nav2_costmap_2d::Layer)
```

**逐行拆解**

- **1** — 引入自己的头文件（类声明）。
- **9** — `point_cloud2_iterator`：按字段名迭代点云，正是 intensity 过滤要用到的工具。
- **12** — **① 导出宏**：告诉 pluginlib「这个类可以作为 `nav2_costmap_2d::Layer` 的插件被加载」。

**`src/nav2_plugins/costmap_intensity/costmap_intensity.xml（全文）`** · 源码第 **1–8** 行

```xml
<library path="costmap_intensity_core">
  <class name="costmap_intensity::ObstacleLayerIntensity" type="costmap_intensity::ObstacleLayerIntensity" base_class_type="nav2_costmap_2d::Layer">
    <description>Listens to laser scan and point cloud messages and marks and clears grid cells.</description>
  </class>
  <class name="costmap_intensity::VoxelLayerIntensity" type="costmap_intensity::VoxelLayerIntensity" base_class_type="nav2_costmap_2d::Layer">
    <description>Listens to laser scan and point cloud messages and marks and clears grid cells.</description>
  </class>
</library>
```

**逐行拆解**

- **1** — **② 描述 XML**：`path` 必须等于 CMake 产出的库名 `costmap_intensity_core`。
- **2、3** — YAML 里写的 `plugin: "costmap_intensity::ObstacleLayerIntensity"` 就是匹配这里的 `name`；`type` 是真实 C++ 类；`base_class_type` 是 Nav2 的图层基类。

**`src/nav2_plugins/costmap_intensity/CMakeLists.txt（第 55-74 行）`** · 源码第 **55–74** 行

```cmake startLineNumber=55
add_library(${lib_name} SHARED
  plugins/obstacle_layer.cpp
  plugins/voxel_layer.cpp
)

include_directories(
  include
)

ament_target_dependencies(${lib_name}
  ${dependencies}
)

install(TARGETS
  ${lib_name}
  DESTINATION lib
)

pluginlib_export_plugin_description_file(nav2_costmap_2d costmap_intensity.xml)
ament_package()
```

**逐行拆解**

- **55–58** — **③ 编成动态库 `.so`**（`SHARED`），不是可执行文件——因为要被 Nav2 运行时动态加载。
- **68–71** — 把库装到 `install/lib/`，否则运行时找不到。
- **73** — `pluginlib_export_plugin_description_file(nav2_costmap_2d, ...)`：把描述 XML 注册到 `nav2_costmap_2d` 这个「基类包」名下。

**④ `package.xml`** 里还要有 `<costmap_2d plugin="${prefix}/costmap_intensity.xml" />`，让 Nav2 的 `LayeredCostmap` 能按字符串找到插件。四件套齐了，YAML 改一行就能换算法。

### 13.3 onInitialize：新增的两个参数

**`src/nav2_plugins/costmap_intensity/plugins/obstacle_layer.cpp（第 33-60 行）`** · 源码第 **33–56** 行

```cpp startLineNumber=33
void ObstacleLayerIntensity::onInitialize()
{
  bool track_unknown_space;
  double transform_tolerance;

  // The topics that we'll subscribe to from the parameter server
  std::string topics_string;

  declareParameter("enabled", rclcpp::ParameterValue(true));
  declareParameter("footprint_clearing_enabled", rclcpp::ParameterValue(true));
  declareParameter("min_obstacle_intensity", rclcpp::ParameterValue(0.0));
  declareParameter("max_obstacle_intensity", rclcpp::ParameterValue(2.0));
  declareParameter("combination_method", rclcpp::ParameterValue(1));
  declareParameter("observation_sources", rclcpp::ParameterValue(std::string("")));

  auto node = node_.lock();
  if (!node) {
    throw std::runtime_error{"Failed to lock node"};
  }

  node->get_parameter(name_ + "." + "enabled", enabled_);
  node->get_parameter(name_ + "." + "footprint_clearing_enabled", footprint_clearing_enabled_);
  node->get_parameter(name_ + "." + "min_obstacle_intensity", min_obstacle_intensity_);
  node->get_parameter(name_ + "." + "max_obstacle_intensity", max_obstacle_intensity_);
```

**逐行拆解**

- **41–46** — 声明 6 个参数。**43-44 行是原生插件没有的两行**：强度下限默认 0.0、上限默认 2.0。
- **48–51** — 从弱指针拿到 LifecycleNode，失败抛异常。
- **53–56** — 读取参数时注意 `name_ + "." + ...` 前缀：YAML 里参数写在 `local_obstacle_layer:` 段下，而 `name_` 正是插件实例名。拼错命名空间就会静默拿默认值。

### 13.4 订阅与回调：过滤不在这里发生

**`src/nav2_plugins/costmap_intensity/plugins/obstacle_layer.cpp（第 216-240 行）`** · 源码第 **216–240** 行

```cpp startLineNumber=216
} else {
  auto sub = std::make_shared<message_filters::Subscriber<sensor_msgs::msg::PointCloud2,
      rclcpp_lifecycle::LifecycleNode>>(node, topic, custom_qos_profile, sub_opt);
  sub->unsubscribe();

  if (inf_is_valid) {
    RCLCPP_WARN(
      logger_,
      "obstacle_layer: inf_is_valid option is not applicable to PointCloud observations.");
  }

  auto filter = std::make_shared<tf2_ros::MessageFilter<sensor_msgs::msg::PointCloud2>>(
    *sub, *tf_, global_frame_, 50,
    node->get_node_logging_interface(),
    node->get_node_clock_interface(),
    tf2::durationFromSec(transform_tolerance));

  filter->registerCallback(
    std::bind(
      &ObstacleLayerIntensity::pointCloud2Callback, this, std::placeholders::_1,
      observation_buffers_.back()));

  observation_subscribers_.push_back(sub);
  observation_notifiers_.push_back(filter);
}
```

**逐行拆解**

- **216** — 本工程 YAML 写 `data_type: "PointCloud2"`，所以走这个 else 分支（另一个分支是 LaserScan）。
- **217–219** — 创建订阅后立刻 `unsubscribe()`，等生命周期节点 `activate()` 时再 `subscribe()`——LifecycleNode 的标准做法。
- **227–231** — 包一层 `tf2_ros::MessageFilter`：**只有 TF 变换可用时才把消息交给回调**，避免坐标转换失败。
- **233–236** — 注册 `pointCloud2Callback`。

**`src/nav2_plugins/costmap_intensity/plugins/obstacle_layer.cpp（第 362-371 行）`** · 源码第 **362–371** 行

```cpp startLineNumber=362
void
ObstacleLayerIntensity::pointCloud2Callback(
  sensor_msgs::msg::PointCloud2::ConstSharedPtr message,
  const std::shared_ptr<ObservationBuffer> & buffer)
{
  // buffer the point cloud
  buffer->lock();
  buffer->bufferCloud(*message);
  buffer->unlock();
}
```

**逐行拆解**

- **367–370** — 回调**完全不做 intensity 过滤**，只是把整帧点云加锁塞进 `ObservationBuffer`。`bufferCloud` 内部才会按 `min/max_obstacle_height` 过滤点。

### 13.5 updateBounds：真正的 intensity 过滤（全章重点）

**`src/nav2_plugins/costmap_intensity/plugins/obstacle_layer.cpp（第 404-467 行）`** · 源码第 **404–463** 行

```cpp startLineNumber=404
404    // place the new obstacles into a priority queue... each with a priority of zero to begin with
405    for (std::vector<Observation>::const_iterator it = observations.begin();
406      it != observations.end(); ++it)
407    {
408      const Observation & obs = *it;
409
410      const sensor_msgs::msg::PointCloud2 & cloud = *(obs.cloud_);
411
412      double sq_obstacle_max_range = obs.obstacle_max_range_ * obs.obstacle_max_range_;
413      double sq_obstacle_min_range = obs.obstacle_min_range_ * obs.obstacle_min_range_;
414
415      sensor_msgs::PointCloud2ConstIterator<float> iter_x(cloud, "x");
416      sensor_msgs::PointCloud2ConstIterator<float> iter_y(cloud, "y");
417      sensor_msgs::PointCloud2ConstIterator<float> iter_z(cloud, "z");
418      sensor_msgs::PointCloud2ConstIterator<float> iter_intensity(cloud, "intensity");
419
420      for (; iter_x != iter_x.end(); ++iter_x, ++iter_y, ++iter_z,++iter_intensity) {
421        double px = *iter_x, py = *iter_y, pz = *iter_z, pintensity = *iter_intensity;
422
423        // if the obstacle is too low, we won't add it
424        if (pintensity < min_obstacle_intensity_) {
425          RCLCPP_DEBUG(logger_, "The point's intensity is too low");
426          continue;
427        }
428
429        // if the obstacle is too high or too far away from the robot we won't add it
430        if (pintensity > max_obstacle_intensity_) {
431          RCLCPP_DEBUG(logger_, "The point's intensity is too high");
432          continue;
433        }
...
435      // compute the squared distance from the hitpoint to the pointcloud's origin
436      double sq_dist =
437        (px - obs.origin_.x) * (px - obs.origin_.x) + (py - obs.origin_.y) * (py - obs.origin_.y) +
438        (pz - obs.origin_.z) * (pz - obs.origin_.z);
439
440      // if the point is far enough away... we won't consider it
441      if (sq_dist >= sq_obstacle_max_range) {
442        continue;
443      }
444
445      // if the point is too close, do not conisder it
446      if (sq_dist < sq_obstacle_min_range) {
447        continue;
448      }
449
450      // now we need to compute the map coordinates for the observation
451      unsigned int mx, my;
452      if (!worldToMap(px, py, mx, my)) {
453        RCLCPP_WARN(logger_, "Computing map coords failed");
454        continue;
455      }
456
457      unsigned int index = getIndex(mx, my);
458      costmap_[index] = LETHAL_OBSTACLE;
459      touch(px, py, min_x, min_y, max_x, max_y);
460    }
461  }
462
463  updateFootprint(robot_x, robot_y, robot_yaw, min_x, min_y, max_x, max_y);
```

> 整个自研改动的价值就在 415-433 这十几行：**把判断依据从「绝对高度 z」换成了「相对地面高度 intensity」**，于是坡道能走、台阶会挡、天花板不会被误判。

**逐行拆解**

- **405–410** — 遍历所有缓存的观测帧，取出这一帧的点云。
- **412、413** — 预先算好距离范围的平方，后面用平方比较省掉开方。
- **415–418** — **原生插件只有 3 个迭代器，这里新增了第 4 个 `iter_intensity`（类型 `float`）**。它要求点云必须带名为 `intensity` 的 `PointField`——`pcl::PointXYZI` 正好满足。
- **420、421** — 四个迭代器同步前进（原文 `++iter_z,++iter_intensity` 少了空格），把 x/y/z/intensity 读进局部变量。
- **423–427** — **下限过滤**：`intensity < 0.3` → `continue`。离地不足 30 cm 的点视为地面/小起伏，不标障碍。
- **429–433** — **上限过滤**：`intensity > 2.0` → `continue`。注释写的是「太高或太远」，实际只判断强度——拷贝时注释没改。
- **435–448** — 接着才是原生逻辑：按距离过滤（`obstacle_max_range 7.0` / `min_range 0.15`）。
- **450–455** — `worldToMap` 把世界坐标换算成栅格下标；失败就跳过。
- **457–459** — 把这个格子写成 `LETHAL_OBSTACLE`（致命障碍），并 `touch` 扩大本次更新的边界矩形。
- **463** — 最后清掉机器人足迹下方的障碍（避免把自己标成障碍）。

**`src/nav2_plugins/costmap_intensity/plugins/obstacle_layer.cpp（第 607-620 行，清障射线）`** · 源码第 **607–614** 行

```cpp startLineNumber=607
// for each point in the cloud, we want to trace a line from the origin
// and clear obstacles along it
sensor_msgs::PointCloud2ConstIterator<float> iter_x(cloud, "x");
sensor_msgs::PointCloud2ConstIterator<float> iter_y(cloud, "y");

for (; iter_x != iter_x.end(); ++iter_x, ++iter_y) {
  double wx = *iter_x;
  double wy = *iter_y;
```

> 这个「标记过滤 / 清除不过滤」的不对称是有意的：地面点正好用来擦掉传感器与地面之间的旧障碍。

**逐行拆解**

- **609、610** — **注意：这里只有 x/y 两个迭代器，没有 intensity**。
- **612** — 也就是说所有点（包括刚才被判为地面的低 intensity 点）都参与清障射线，把沿途格子清成 FREE_SPACE。

### 13.6 支持运行时热调阈值

**`src/nav2_plugins/costmap_intensity/plugins/obstacle_layer.cpp（第 251-283 行节选）`** · 源码第 **251–266** 行

```cpp startLineNumber=251
251 rcl_interfaces::msg::SetParametersResult
252 ObstacleLayerIntensity::dynamicParametersCallback(
253   std::vector<rclcpp::Parameter> parameters)
254 {
255   std::lock_guard<Costmap2D::mutex_t> guard(*getMutex());
...
261     if (param_type == ParameterType::PARAMETER_DOUBLE) {
262       if (param_name == name_ + "." + "min_obstacle_intensity") {
263         min_obstacle_intensity_ = parameter.as_double();
264       } else if (param_name == name_ + "." + "max_obstacle_intensity") {
265         max_obstacle_intensity_ = parameter.as_double();
266       }
...
281   result.successful = true;
282   return result;
283 }
```

**逐行拆解**

- **255** — 改参数时加锁，避免与代价地图更新线程冲突。
- **261–266** — 两个 intensity 阈值支持**运行时热改**，联调时可以 `ros2 param set ... min_obstacle_intensity 0.4` 立刻试，不用重启。

> [!TIP] 现场调参的最短路径
> 局部障碍缺失 → 先 `ros2 topic echo /terrain_map` 看 intensity 分布 → 再热调 `min_obstacle_intensity`；整片被标成障碍 → 检查 `max_obstacle_intensity` 和 TF。README_USAGE.md §8 给的排查口径完全一致。

### 13.7 voxel_layer.cpp：3D 版，以及一个潜在 bug

**`src/nav2_plugins/costmap_intensity/plugins/voxel_layer.cpp（第 148-193 行）`** · 源码第 **148–178** 行

```cpp startLineNumber=148
148    sensor_msgs::PointCloud2ConstIterator<float> iter_x(cloud, "x");
149    sensor_msgs::PointCloud2ConstIterator<float> iter_y(cloud, "y");
150    sensor_msgs::PointCloud2ConstIterator<float> iter_z(cloud, "z");
151    sensor_msgs::PointCloud2ConstIterator<uint8_t> iter_i(cloud, "intensity");
152
153    for (; iter_x != iter_x.end(); ++iter_x, ++iter_y, ++iter_z, ++iter_i) {
154      // if the obstacle is too high or too far away from the robot we won't add it
155      if (*iter_i > max_obstacle_intensity_) {
156        continue;
157      }
158
159      // compute the squared distance from the hitpoint to the pointcloud's origin
160      double sq_dist = (*iter_x - obs.origin_.x) * (*iter_x - obs.origin_.x) +
161        (*iter_y - obs.origin_.y) * (*iter_y - obs.origin_.y) +
162        (*iter_z - obs.origin_.z) * (*iter_z - obs.origin_.z);
...
174      // now we need to compute the map coordinates for the observation
175      unsigned int mx, my, mz;
176      if (*iter_z < origin_z_) {
177        if (!worldToMap3D(*iter_x, *iter_y, origin_z_, mx, my, mz)) {
178          continue;
179        }
180      } else if (!worldToMap3D(*iter_x, *iter_y, *iter_z, mx, my, mz)) {
181        continue;
182      }
183
184      // mark the cell in the voxel grid and check if we should also mark it in the costmap
185      if (voxel_grid_.markVoxelInMap(mx, my, mz, mark_threshold_)) {
186        unsigned int index = getIndex(mx, my);
187
188        costmap_[index] = LETHAL_OBSTACLE;
```

**逐行拆解**

- **151** — **类型写成了 `uint8_t`**，而 `/terrain_map` 的 intensity 是 `float32`。按字节读 float 的首字节，数值语义与 2D 版完全不同——这是一个未完成的改动/潜在 bug。
- **155–157** — **只有上限过滤，没有 `min_obstacle_intensity`**。`onInitialize` 和动态参数回调也都只处理 max。
- **174–182** — 3D 版用 `worldToMap3D` 算出体素下标（多了 `mz`）。
- **185–188** — `markVoxelInMap` 达到阈值后，把对应 2D 格子标成致命障碍。

> [!CAUTION] voxel_layer 目前没被任何 costmap 启用
> `nav2_params.yaml` 的 `plugins` 列表里只有 `ObstacleLayerIntensity`（2D）。所以 `uint8_t` 读 `float` 这个问题暂时不会发作，属于实验代码。若要启用 3D 版，必须先修第 151 行的迭代器类型并补上 min 阈值。

---

## 14 · 行为树与自定义恢复行为 BackUpTwzFree

*卡住时机器人不是傻傻直退，而是查代价地图找一块空地，斜着平移过去。*

### 14.1 行为树节点语义（读 XML 前先补这一课）

行为树（Behavior Tree）用一棵树描述决策流程，每个节点每被 tick 一次就返回 `SUCCESS` / `FAILURE` / `RUNNING` 之一。父节点根据子节点的返回值决定下一步。

- **`RecoveryNode`** — 控制节点：先 tick 第 1 个子节点；若失败就 tick 第 2 个（恢复）子节点，最多 `number_of_retries` 次。
- **`PipelineSequence`** — 类似 Sequence，但当前序子节点还在 `RUNNING` 时**继续 tick 后续子节点**——这正是「边重规划边跟随」的实现。
- **`RateController hz`** — 装饰节点：限制子节点每秒被 tick 的次数，用来控制重规划频率。
- **`ReactiveSequence` / `ReactiveFallback`** — 每次 tick 都重新评估**所有**子节点，可被抢占（用于监测目标更新、路径变长）。
- **`RoundRobin`** — 每次轮到它时换下一个子节点执行，轮流尝试后退/旋转。
- **`Inverter`** — 把 SUCCESS ↔ FAILURE 取反。
- **`ComputePathToPose`** — 动作叶节点：调 `planner_server`，`planner_id="GridBased"`（Theta*），结果写入黑板 `{path}`。
- **`SmoothPath`** — 调 `smoother_server`，`{path}` → `{smoothed_path}`。
- **`FollowPath`** — 调 `controller_server`，`controller_id="FollowPath"`（MPPI）。
- **`BackUp` / `Spin` / `Wait`** — 调 `behavior_server` 的对应 action。**`backup` 已被换成自定义类**。
- **`ClearEntireCostmap`** — 调 `global_costmap/clear_entirely_*` 或 `local_costmap/clear_entirely_*` 服务。
- **`{goal}` / `{path}`** — 黑板（Blackboard）变量，节点之间传递路径与目标。

### 14.2 默认行为树逐行

**`src/sentry_bringup/behavior_tree/navigate_to_pose_w_replanning_and_recovery.xml（第 6-35 行）`** · 源码第 **6–36** 行

```xml startLineNumber=6
<root main_tree_to_execute="MainTree">
  <BehaviorTree ID="MainTree">
    <RecoveryNode number_of_retries="6" name="NavigateRecovery">
      <PipelineSequence name="NavigateWithReplanning">
        <RateController hz="0.5">
          <RecoveryNode number_of_retries="1" name="ComputePathToPose">
            <Sequence name="ComputeAndSmoothPath">
                <GoalUpdater input_goal="{goal}" output_goal="{updated_goal}">
                    <ComputePathToPose goal="{updated_goal}" path="{path}" planner_id="GridBased"/>
                </GoalUpdater>
                <SmoothPath unsmoothed_path="{path}" smoothed_path="{smoothed_path}"/>
            </Sequence>

            <ClearEntireCostmap name="ClearGlobalCostmap-Context" service_name="global_costmap/clear_entirely_global_costmap"/>
          </RecoveryNode>
        </RateController>
        <RecoveryNode number_of_retries="1" name="FollowPath">
          <FollowPath path="{smoothed_path}" controller_id="FollowPath"/>
          <ClearEntireCostmap name="ClearLocalCostmap-Context" service_name="local_costmap/clear_entirely_local_costmap"/>
        </RecoveryNode>
      </PipelineSequence>
      <ReactiveFallback name="RecoveryFallback">
        <GoalUpdated/>
        <RoundRobin name="RecoveryActions">
          <BackUp backup_dist="0.3" backup_speed="0.4"/>
          <BackUp backup_dist="0.5" backup_speed="0.4"/>
          <!-- <Spin spin_dist="0.523"/> -->
        </RoundRobin>
      </ReactiveFallback>
    </RecoveryNode>
  </BehaviorTree>
```

**逐行拆解**

- **11–13** — 根树 `MainTree`；最外层 `RecoveryNode` 最多重试 6 次。
- **14** — `PipelineSequence`：规划和跟随**并行推进**，不是「规划完才开始走」。
- **15、16** — `RateController hz="0.5"`：**每 2 秒重规划一次**（注意文件头注释写的是 1 Hz，与实际不符）。规划失败重试 1 次。
- **18–21** — `GoalUpdater` 允许运行中更新目标 → `ComputePathToPose` 用 Theta* 算路径写进 `{path}` → `SmoothPath` 平滑成 `{smoothed_path}`。
- **24** — 规划失败时先清空**全局**代价地图再重试。
- **27–30** — 跟随路径；失败时清空**局部**代价地图再重试。
- **32、33** — `ReactiveFallback` + `GoalUpdated`：如果收到新目标，立刻放弃恢复、重新开始。
- **29–33** — 恢复动作轮流执行：后退 0.3 m、后退 0.5 m（速度都是 0.4 m/s）。`<Spin>` 被注释掉，所以**默认不旋转**。这两个 BackUp 实际都由 `BackUpTwzFree` 执行。

### 14.3 五棵行为树对比

| 文件 | 重规划频率 | 重规划触发 | SmoothPath | 恢复动作 | 默认? |
| --- | --- | --- | --- | --- | --- |
| `navigate_to_pose_w_replanning_and_recovery.xml` | 0.5 Hz | 定时 + GoalUpdater | ✅ | BackUp 0.3 + 0.5，Spin 注释 | **★ 单点导航默认** |
| `navigate_through_pose_w_replanning_and_recovery.xml` | 0.333 Hz | 定时 + RemovePassedGoals | ❌ | BackUp 0.3 + 0.3 | ★ 航点默认 |
| `..._goal_patience_and_recovery.xml` | 1.0 Hz | 定时 + PathLongerOnApproach 等待 5 s | ❌ | BackUp×2 + Spin 0.523 | 否 |
| `navigate_w_recovery_and_replanning_only_if_path_becomes_invalid.xml` | 1.0 Hz | 仅 `IsPathValid` / 目标更新 | ❌ | BackUp×2 + Spin | 否 |
| `nav_to_pose_with_consistent_replanning_...xml` | 2.0 Hz | 上述 + `PathExpiringTimer(10s)` | ❌ | BackUp×2 + Spin | 否 |

共同骨架：外层 `RecoveryNode(6)` → `PipelineSequence` → (`RateController` 包规划 + `FollowPath`) → `ReactiveFallback(GoalUpdated, RoundRobin(...))`。所有 XML 中用到的 BT 节点都必须在 `nav2_params.yaml` 的 `plugin_lib_names` 里登记。

### 14.4 BackUpTwzFree：类定义与参数

**`src/nav2_plugins/behavior_ext_plugins/include/.../back_up_twz_free_action.hpp（第 26-52 行）`** · 源码第 **26–51** 行

```cpp startLineNumber=26
using BackUpAction = nav2_msgs::action::BackUp;


namespace nav2_behaviors
{
class BackUpTwzFree : public DriveOnHeading<nav2_msgs::action::BackUp>
{
public:
  Status onRun(const std::shared_ptr<const BackUpAction::Goal> command) override;
  Status onCycleUpdate();

protected:
  void onConfigure() override;

private:
  // client to get local costmap
  rclcpp::Client<nav2_msgs::srv::GetCostmap>::SharedPtr costmap_client_;
  rclcpp::Publisher<visualization_msgs::msg::MarkerArray>::SharedPtr marker_pub_;
  std::string service_name_;
  double twist_x_, twist_y_;
  double max_radius_, robot_radius_;
  int free_threshold_;
  double cost_threshold_;
  bool visualization_;
};
}
```

**逐行拆解**

- **31** — **继承 `DriveOnHeading<BackUp>`，不是原生的 `BackUp`**。这样白拿基类的 `isCollisionFree()`、`vel_pub_`、`feedback_`、`stopRobot()` 等能力。
- **34、35** — 重写 `onRun`（启动时执行一次）和 `onCycleUpdate`（每周期执行）。
- **42** — 一个 `GetCostmap` 服务客户端——这是它和原生 BackUp 的本质区别：**会主动查代价地图**。
- **43** — 可视化 MarkerArray 发布器。
- **45–49** — 速度分解结果、搜索半径、自由格阈值、代价阈值、可视化开关。

**`src/nav2_plugins/behavior_ext_plugins/plugins/back_up_twz_free_action.cpp（第 20-68 行）`** · 源码第 **20–47** 行

```cpp startLineNumber=20
20   void BackUpTwzFree::onConfigure()
21   {
22     auto node = this->node_.lock();
...
28     nav2_util::declare_parameter_if_not_declared(
29       node, "robot_radius", rclcpp::ParameterValue(0.1));
30     node->get_parameter("robot_radius", robot_radius_);
31
32     nav2_util::declare_parameter_if_not_declared(
33       node, "max_radius", rclcpp::ParameterValue(1.0));
34     node->get_parameter("max_radius", max_radius_);
35
36     if(max_radius_ < robot_radius_)
37     {
38       RCLCPP_WARN(node->get_logger(), "max_radius is smaller than robot_radius. Setting max_radius to robot_radius");
39       max_radius_ = robot_radius_;
40     }
41
42     nav2_util::declare_parameter_if_not_declared(
43       node, "service_name", rclcpp::ParameterValue(std::string("local_costmap/get_costmap")));
44     node->get_parameter("service_name", service_name_);
45
46     nav2_util::declare_parameter_if_not_declared(
47       node, "free_threshold", rclcpp::ParameterValue(5));
48     node->get_parameter("free_threshold", free_threshold_);
...
56     costmap_client_ = node->create_client<nav2_msgs::srv::GetCostmap>(service_name_);
57     marker_pub_ = node->create_publisher<visualization_msgs::msg::MarkerArray>("back_up_twz_free_markers", 1);
```

**逐行拆解**

- **28–30** — `robot_radius` 默认 0.1，YAML 覆盖成 0.35。
- **32–40** — `max_radius` 默认 1.0，YAML 覆盖成 3.5；若配得比机器人半径还小，自动抬升，避免死循环。
- **42–44** — `service_name` **源码默认 `local_costmap/get_costmap`，YAML 覆盖成 `global_costmap/get_costmap`**。
- **46–48** — 自由格数量阈值默认 5，YAML 设 3。
- **56** — 创建服务客户端。`cost_threshold`（默认 0.1）YAML 没给，用默认值。
- **57** — 发布 `back_up_twz_free_markers` 话题（MarkerArray），RViz 里能看到搜到的自由点。

### 14.5 扩张圆搜索自由空间（算法核心）

**`src/nav2_plugins/behavior_ext_plugins/plugins/back_up_twz_free_action.cpp（第 139-190 行）`** · 源码第 **139–189** 行

```cpp startLineNumber=139
// expand circle until free space is found
auto radius = robot_radius_;
std::vector<geometry_msgs::msg::Point> free_points;
while (!free_space_found && radius <= max_radius_)
{
  // calculate sum of free space in circle
  int free_space_sum = 0;
  for (auto i = 0; i < costmap.metadata.size_x; i++)
  {
    for (auto j = 0; j < costmap.metadata.size_y; j++)
    {
      auto costmap_index = i + j * costmap.metadata.size_x;
      auto x = i * costmap.metadata.resolution + costmap.metadata.origin.position.x;
      auto y = j * costmap.metadata.resolution + costmap.metadata.origin.position.y;
      auto distance_to_center = std::hypot(x - pose_x, y - pose_y);
      if (distance_to_center <= radius)
      {
        if (costmap.data[costmap_index] <= cost_threshold_)
        {
          free_space_sum++;
          free_points.push_back(geometry_msgs::msg::Point());
          free_points.back().x = x;
          free_points.back().y = y;
        }
      }
    }
  }

  if (free_space_sum > free_threshold_)
  {
    free_space_found = true;
    RCLCPP_WARN(node->get_logger(), "free space found at radius: %f", radius);
    break;
  }
  else
  {
    RCLCPP_WARN(node->get_logger(), "free space not found at radius: %f", radius);
    radius += 0.1;
  }
}

// calculate avg position of free space
auto avg_x = 0.0;
auto avg_y = 0.0;
for (auto i = 0; i < free_points.size(); i++)
{
  avg_x += free_points[i].x;
  avg_y += free_points[i].y;
}
avg_x /= free_points.size();
avg_y /= free_points.size();
```

> 名字 `BackUpTwzFree` ≈ BackUp + Towards + Free，即「朝自由空间后退」。它用全局代价地图找方向、用局部代价地图做碰撞前视。

**逐行拆解**

- **140–142** — 从 `radius = robot_radius_`（0.35 m）开始，每次加 0.1 m，最多到 `max_radius_`（3.5 m）。
- **146–149** — **每个半径都暴力遍历整张代价地图的所有格子**（O(半径次数 × 全图格数)）。
- **151、152** — 把栅格下标换算成世界坐标（分辨率 + 原点）。
- **153、154** — 只看到机器人当前位置距离 ≤ radius 的格子。
- **156–162** — `costmap.data[index] <= cost_threshold_`（0.1，即 FREE/极低代价）的格子记为自由点，收集坐标。
- **167–177** — 自由点数超过 `free_threshold_`（3）就认为找到，跳出；否则扩大半径继续找。
- **180–189** — 求所有自由点的**质心** `(avg_x, avg_y)`，作为撤离方向。

> [!CAUTION] 两个实现缺陷
> ① `free_points` 在每轮扩张时**不清空**，跨半径累积，所以质心包含之前小半径内找到的点。
>
> ② 若始终没找到自由空间，`free_points.size() == 0`，第 188-189 行会**除以零**。
>
> 另外这是暴力扫描，对大尺寸全局地图有明显性能隐患。

### 14.6 方向解算：把世界角度分解成 vx / vy

**`src/nav2_plugins/behavior_ext_plugins/plugins/back_up_twz_free_action.cpp（第 231-263 行）`** · 源码第 **231–252** 行

```cpp startLineNumber=231
231    // calculate angle to free space
232    auto angle_to_free_space = std::atan2(avg_y - pose_y, avg_x - pose_x);
233    auto angle_diff = angle_to_free_space - yaw;
234    if (angle_diff > M_PI)
235    {
236      angle_diff -= 2 * M_PI;
237    }
238    else if (angle_diff < -M_PI)
239    {
240      angle_diff += 2 * M_PI;
241    }
...
244    // calculate move command
245    twist_x_ = std::cos(angle_diff) * command->speed;
246    twist_y_ = std::sin(angle_diff) * command->speed;
247    command_x_ = command->target.x;
248    command_time_allowance_ = command->time_allowance;
249
250    end_time_ = this->clock_->now() + command_time_allowance_;
...
261    return Status::SUCCEEDED;
262  }
```

**逐行拆解**

- **232、233** — 算出「从机器人指向自由空间质心」的世界系角度，减去当前 `yaw` 得到**机体系中的夹角** `angle_diff`。
- **234–241** — 把角度归一化到 ±π（只加减一次 2π）。
- **245、246** — **与原生 BackUp 最本质的区别**：把速度按 `cos/sin` 分解到机体系 x/y 两轴，机器人**不用先转身**，直接全向斜向平移撤离。这依赖 MPPI 的 `motion_model: "Omni"`。
- **247、248** — `command->target.x` 是行为树 `<BackUp backup_dist="0.3">` 传的撤离距离；`command->speed` 是 0.4 m/s。
- **250** — 算出绝对超时时刻。
- **261** — `onRun` 返回 SUCCEEDED，进入 `onCycleUpdate` 周期循环。

**`src/nav2_plugins/behavior_ext_plugins/plugins/back_up_twz_free_action.cpp（第 265-318 行）`** · 源码第 **265–300** 行

```cpp startLineNumber=265
265  Status BackUpTwzFree::onCycleUpdate()
266  {
267    rclcpp::Duration time_remaining = end_time_ - this->clock_->now();
268    if (time_remaining.seconds() < 0.0 && command_time_allowance_.seconds() > 0.0)
269    {
270      this->stopRobot();
271      return Status::FAILED;
272    }
...
283    double diff_x = initial_pose_.pose.position.x - current_pose.pose.position.x;
284    double diff_y = initial_pose_.pose.position.y - current_pose.pose.position.y;
285    double distance = hypot(diff_x, diff_y);
286
287    feedback_->distance_traveled = distance;
288    this->action_server_->publish_feedback(feedback_);
289
290    if (distance >= std::fabs(command_x_))
291    {
292      this->stopRobot();
293      return Status::SUCCEEDED;
294    }
...
299    auto cmd_vel = std::make_unique<geometry_msgs::msg::Twist>();
300    cmd_vel->linear.y = twist_y_;
301    cmd_vel->linear.x = twist_x_;
...
309    if (!isCollisionFree(distance, cmd_vel.get(), pose2d))
310    {
311      this->stopRobot();
312      return Status::FAILED;
313    }
314
315    this->vel_pub_->publish(std::move(cmd_vel));
316
317    return Status::RUNNING;
318  }
```

**逐行拆解**

- **267–272** — 超时 → `stopRobot()` + `FAILED`。
- **283–288** — 算已移动距离，发布 action 反馈 `distance_traveled`。
- **290–294** — 达到 `backup_dist` → 停车 + `SUCCEEDED`。
- **299–301** — 组装速度消息：**只填 `linear.x/y`，没有 `angular.z`**（不旋转）。
- **309–313** — 用基类的 `isCollisionFree()` 做前视碰撞检查（受 `simulate_ahead_time: 2.0` 影响），不安全就停车失败。
- **315–317** — 发布速度，返回 `RUNNING`，下一周期继续。

| 维度 | 原生 `nav2_behaviors/BackUp` | `BackUpTwzFree` |
| --- | --- | --- |
| 基类 | `TimedBehavior<BackUpAction>` | `DriveOnHeading<BackUpAction>` |
| 运动方向 | 固定沿机体 −x 直线后退 | 朝代价地图检测出的自由空间质心，分解为 vx + vy 斜向平移 |
| 查代价地图 | 否（只做前视碰撞检查） | 主动调 `GetCostmap` 服务，扩张圆搜索自由格 |
| 可视化 | 无 | 发布 `back_up_twz_free_markers` |
| 触发方式 | BT `<BackUp>` → `backup` action | **完全相同**（YAML 只换了 `backup` 槽位的插件） |

---

## 15 · 速度指令的最后一公里：底盘与消息接口

*从 Nav2 的抽象速度，到电控能理解的 ChassisCmd，中间只隔两个 60 行的小节点。*

### 15.1 twist_transformer.cpp：按云台角度旋转速度坐标系

Nav2 算出的速度是「相对机器人/底盘坐标系」的。但哨兵机器人的云台会相对底盘转动，如果上层决策是「往云台前方走」，就需要把速度向量旋转一个偏航角。这个节点干的就是这件事。

**`src/cmd_chassis/src/twist_transformer.cpp（全文）`** · 源码第 **1–68** 行

```cpp
#include <rclcpp/rclcpp.hpp>
#include <geometry_msgs/msg/twist.hpp>
#include <tf2_ros/transform_listener.h>
#include <tf2_ros/buffer.h>
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>
#include <tf2/LinearMath/Quaternion.h>
#include <tf2/LinearMath/Matrix3x3.h>

class TwistTransformer : public rclcpp::Node
{
public:
    TwistTransformer() : Node("twist_transformer"), tfBuffer(get_clock()), tfListener(tfBuffer)
    {
        this->declare_parameter<std::string>("chassis_frame", "chassis_link");
        this->get_parameter<std::string>("chassis_frame", chassis_frame_);
        cmd_in_yaw_publisher_ = this->create_publisher<geometry_msgs::msg::Twist>("/cmd_vel_in_yaw", 10);
        subscription_ = this->create_subscription<geometry_msgs::msg::Twist>(
            "/cmd_vel", 20, std::bind(&TwistTransformer::listener_callback, this, std::placeholders::_1));
    }

private:
    void listener_callback(const geometry_msgs::msg::Twist::SharedPtr msg)
    {
        geometry_msgs::msg::TransformStamped transformStamped;
        try
        {
            transformStamped = tfBuffer.lookupTransform(chassis_frame_, "yaw_link", tf2::TimePointZero);
        }
        catch (tf2::TransformException &ex)
        {
            RCLCPP_WARN(this->get_logger(), "%s", ex.what());
            return;
        }

        tf2::Quaternion q(
            transformStamped.transform.rotation.x,
            transformStamped.transform.rotation.y,
            transformStamped.transform.rotation.z,
            transformStamped.transform.rotation.w);
        tf2::Matrix3x3 m(q);
        double roll, pitch, yaw;
        m.getRPY(roll, pitch, yaw);

        auto twist_in_yaw = std::make_shared<geometry_msgs::msg::Twist>();
        twist_in_yaw->linear.x = msg->linear.x * cos(yaw) + msg->linear.y * sin(yaw);
        twist_in_yaw->linear.y = msg->linear.y * cos(yaw) - msg->linear.x * sin(yaw);
        twist_in_yaw->angular.x = msg->angular.x;
        twist_in_yaw->angular.y = msg->angular.y;
        twist_in_yaw->angular.z = msg->angular.z;

        cmd_in_yaw_publisher_->publish(*twist_in_yaw);
    }

    rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_in_yaw_publisher_;
    rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr subscription_;
    tf2_ros::Buffer tfBuffer;
    tf2_ros::TransformListener tfListener;

    std::string chassis_frame_;
};

int main(int argc, char *argv[])
{
    rclcpp::init(argc, argv);
    rclcpp::spin(std::make_shared<TwistTransformer>());
    rclcpp::shutdown();
    return 0;
}
```

> 注意 `relocalization.launch.py:35` 用 `arguments=['--ros-args','-p','chassis_frame:=chassis_link']` 显式指定了底盘帧，说明这个参数在实车上必须和 URDF 对得上。

**逐行拆解**

- **1–7** — 引入 ROS 2、Twist 消息、tf2 的 Buffer/Listener/四元数/旋转矩阵工具。
- **12** — 构造函数初始化列表里同时创建 `tfBuffer` 和 `tfListener`——后者自动订阅 `/tf`、`/tf_static` 填充前者。
- **14、15** — 声明并读取 `chassis_frame` 参数（默认 `chassis_link`）。重定位入口通过命令行把它显式设成 `chassis_link`。
- **16** — 发布 `/cmd_vel_in_yaw`（转换后的速度）。
- **17、18** — 订阅 `/cmd_vel`（velocity_smoother 的输出），队列 20，回调是 `listener_callback`。
- **24–33** — **查 TF**：`lookupTransform(chassis_frame_, "yaw_link", TimePointZero)` 取底盘到云台的最新变换。查不到就告警并直接丢弃这一帧速度（宁可不发也不发错的）。
- **35–42** — 把变换里的四元数转成旋转矩阵，取 RPY 里的 `yaw`（绕 Z 的偏航角）。
- **44–46** — **核心两行：二维旋转公式**。把 `(vx, vy)` 按 `yaw` 旋转，得到云台 yaw 系下的速度。
- **47–49** — 三个角速度分量原样透传（不做旋转）。
- **51** — 发布结果。
- **54–59** — 成员变量：发布器、订阅器、TF Buffer/Listener、坐标系名。
- **62–68** — 标准 `main`：init → spin → shutdown。

### 15.2 twist2chassis_cmd.cpp：把 Twist 装进自定义消息

**`src/cmd_chassis/src/twist2chassis_cmd.cpp（全文）`** · 源码第 **1–61** 行

```cpp
#include <rclcpp/rclcpp.hpp>
#include <geometry_msgs/msg/twist.hpp>
#include <rm_interfaces/msg/chassis_cmd.hpp>
#include <std_msgs/msg/int8.hpp>

class CmdChassisNode : public rclcpp::Node
{
public:
    CmdChassisNode()
    : Node("twist_to_chassis_cmd")
    {
        this->declare_parameter<std::string>("twist_topic", "cmd_vel_in_yaw");
        this->declare_parameter<std::string>("chassis_topic", "chassis_cmd");
        this->declare_parameter<std::string>("chassis_type_topic", "chassis_type");

        twist_topic_ = this->get_parameter("twist_topic").as_string();
        chassis_topic_ = this->get_parameter("chassis_topic").as_string();
        chassis_type_topic_ = this->get_parameter("chassis_type_topic").as_string();

        cmd_vel_sub_ = this->create_subscription<geometry_msgs::msg::Twist>(
            twist_topic_, 10, std::bind(&CmdChassisNode::twist_cbk, this, std::placeholders::_1));
        chassis_type_sub_ = this->create_subscription<std_msgs::msg::Int8>(
            chassis_type_topic_, 10, std::bind(&CmdChassisNode::chassis_type_cbk, this, std::placeholders::_1));

        chassis_pub_ = this->create_publisher<rm_interfaces::msg::ChassisCmd>(chassis_topic_, 10);

        chassis_msg_.type = 2;
    }

private:
    void twist_cbk(const geometry_msgs::msg::Twist::SharedPtr msg)
    {
        chassis_msg_.twist = *msg;
        chassis_pub_->publish(chassis_msg_);
    }

    void chassis_type_cbk(const std_msgs::msg::Int8::SharedPtr msg)
    {
        chassis_msg_.type = msg->data;
        chassis_pub_->publish(chassis_msg_);
    }

    std::string twist_topic_;
    std::string chassis_topic_;
    std::string chassis_type_topic_;

    rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr cmd_vel_sub_;
    rclcpp::Subscription<std_msgs::msg::Int8>::SharedPtr chassis_type_sub_;

    rclcpp::Publisher<rm_interfaces::msg::ChassisCmd>::SharedPtr chassis_pub_;

    rm_interfaces::msg::ChassisCmd chassis_msg_;
};

int main(int argc, char ** argv)
{
    rclcpp::init(argc, argv);
    rclcpp::spin(std::make_shared<CmdChassisNode>());
    rclcpp::shutdown();
    return 0;
}
```

> 这个节点非常薄，但它是「Nav2 世界」和「电控世界」的边界：`Twist` 是 ROS 通用速度类型，`ChassisCmd` 是战队自定义的控制帧。

**逐行拆解**

- **3** — 引入自定义消息头文件 `rm_interfaces/msg/chassis_cmd.hpp`——它由 `.msg` 文件在编译时生成（见 15.4）。
- **12–18** — 三个话题名都可配置：输入速度、输出底盘指令、底盘模式话题。
- **20、21** — 订阅 `cmd_vel_in_yaw`（相对名，解析为 `/cmd_vel_in_yaw`）。
- **22、23** — 订阅 `chassis_type`（`Int8`）：允许外部切换底盘运动模式。
- **25** — 发布 `/chassis_cmd`，类型是自定义 `ChassisCmd`。
- **27** — **默认 `type = 2`**，对应 `FOLLOW_GIMBAL`（速度跟随云台 yaw 系）。这与上一个节点做的坐标旋转正好配套。
- **31–35** — 收到速度 → 把整条 Twist 塞进 `chassis_msg_.twist` → 立刻发布。注意用的是**成员变量**，所以 `type` 会保持上次设置的值。
- **37–41** — 收到模式 → 只更新 `type`，并顺手再发一次当前消息。
- **52** — 消息对象作为成员复用，不是每次新建。

### 15.3 ChassisCmd.msg 逐行

**`src/rm_interfaces/msg/ChassisCmd.msg（全文）`** · 源码第 **1–15** 行

```text
# cmd msg for controlling chassis
# constants for control type
uint8 VELOCITY = 1         # velocity control, (vx,vy,w) in chassis frame.
uint8 FOLLOW_GIMBAL = 2    # velocity control, follow gimbal's yaw stick automatically,
                           # (vx,vy) in gimbal's yaw frame.
uint8 SWING = 3            # velocity control, swing around gimbal's yaw automatically,
                           # (vx,vy) in gimbal's yaw frame.
uint8 SPIN = 4             # velocity control, spin at an angular velocity automatically,
                           # (vx,vy) in gimbal's yaw frame.

# control type
uint8 type 1

# control data
geometry_msgs/Twist twist
```

**逐行拆解**

- **1、2** — 注释说明这是底盘控制消息。
- **3** — 常量 `VELOCITY = 1`：速度控制，`(vx,vy,w)` 在**底盘坐标系**。
- **4、5** — `FOLLOW_GIMBAL = 2`：自动跟随云台偏航，`(vx,vy)` 在**云台 yaw 坐标系**。`twist2chassis_cmd.cpp` 默认用的就是它。
- **6、7** — `SWING = 3`：绕云台摆动的自动模式。
- **8、9** — `SPIN = 4`：以给定角速度自旋。
- **12** — `uint8 type 1`：注意末尾的 `1` 是 **ROS 2 msg 的默认值语法**，不是常量定义。字段 `type` 默认取 1。
- **15** — `geometry_msgs/Twist twist`：引用另一个包的消息类型，所以 `CMakeLists.txt` 的 `DEPENDENCIES` 必须写 `geometry_msgs`。

> [!WARNING] 接口包里也有被注释掉的 .msg
> `src/rm_interfaces/msg/referee/GameStatus.msg` 定义了 `GAME_*` 常量，但它在 `CMakeLists.txt` 里被注释、**不会生成类型**。实际被 `control_panel` 使用的是 `GameState.msg`。另外 `SentryCmd.msg`、`GameStatus.msg` 在 `msg/referee/` 子目录，不在 `msg/` 根目录。读 `.msg` 时一定要同时看 `rosidl_generate_interfaces` 里列了哪些。

### 15.4 消息是怎么「编译」出来的

**`src/rm_interfaces/CMakeLists.txt（第 8-43 行节选）`** · 源码第 **8–36** 行

```cmake startLineNumber=8
 8 # find dependencies
 9 find_package(ament_cmake REQUIRED)
10 find_package(rosidl_default_generators REQUIRED)
11 find_package(std_msgs REQUIRED)
12 find_package(geometry_msgs REQUIRED)
13 find_package(rosidl_default_runtime REQUIRED)
14 find_package(nav_msgs REQUIRED)
15
16 rosidl_generate_interfaces(${PROJECT_NAME}
17   # "msg/referee/EventData.msg"
18   # "msg/referee/GameResult.msg"
...
22   # "msg/referee/GameStatus.msg"
...
28   "msg/referee/GameState.msg"
29   "msg/referee/SentryCmd.msg"
30   "msg/ChassisCmd.msg"
31   "msg/Gimbal.msg"
32   "msg/GimbalCmd.msg"
33   "msg/ShootCmd.msg"
34
35 DEPENDENCIES
36   std_msgs
37   geometry_msgs
38   nav_msgs
39 )
40
41 ament_export_dependencies(rosidl_default_runtime)
42 ament_package()
```

**逐行拆解**

- **16–21** — `find_package` 找构建工具和依赖包；`rosidl_default_generators` 是把 `.msg` 编译成 C++/Python 类型的生成器。
- **16–33** — **只有列在这里（且没被注释）的 6 个 `.msg` 会生成类型**：`GameState`、`SentryCmd`、`ChassisCmd`、`Gimbal`、`GimbalCmd`、`ShootCmd`。其余 11 个 referee 消息都被注释了。
- **35–39** — `DEPENDENCIES`：消息里引用了 `geometry_msgs/Twist`、`std_msgs/Header` 等外部类型，必须声明。
- **41、42** — 导出运行时依赖；`ament_package()` 必须是最后一行。

编译后，C++ 里可以用 `#include <rm_interfaces/msg/chassis_cmd.hpp>` 和 `rm_interfaces::msg::ChassisCmd`，Python 里用 `from rm_interfaces.msg import GameState`。验证命令：`ros2 interface show rm_interfaces/msg/ChassisCmd`。

> [!NOTE] 为什么消息要单独放一个包
> 多个节点（发布方、订阅方、调试工具）共享同一个类型定义，避免各写一份导致字段不一致。接口包本身**不运行任何节点**，只是被别的包依赖。`package.xml` 里 `<member_of_group>rosidl_interface_packages</member_of_group>` 保证它先于使用方编译。

### 15.5 链路的终点在哪里

1. **Nav2 `controller_server`**：发布速度到 `/cmd_vel_nav`
2. **`velocity_smoother`**：限加速度，输出 `/cmd_vel`
3. **`twist_transformer`**：按云台 yaw 旋转，输出 `/cmd_vel_in_yaw`
4. **`twist2chassis_cmd`**：封装成 `ChassisCmd`，输出 `/chassis_cmd`
5. ****缺失的一环****：把 `/chassis_cmd` 通过串口/CAN 下发给电控，并回报轮速/IMU

> [!CAUTION] 这不是一套开箱即走的完整机器人
> `docs/CODEBASE_GUIDE.md:20` 与 `README.md` 都明确：源码中能追到 ROS 消息发布，**未看到消费 `/chassis_cmd` 并下发到电控的节点**。实车联调时必须自己补这层驱动，否则路径、速度都算出来了，轮子不会动；而控制器因为里程计不变化，会一直报「进度不足」。

---

## 16 · 构建体系、坐标系模型与调试面板

*看懂 CMakeLists / package.xml / URDF，才知道「改了文件为什么没生效」。*

### 16.1 三层构建关系

| 名称 | 说明 |
| --- | --- |
| `colcon build` | 工作区级构建器：扫描 `src/` 下所有包，按依赖顺序逐个调用各自的构建系统，产物进 `install/`。 |
| `ament_cmake` | ROS 2 给 CMake 加的一套宏：`ament_target_dependencies`、`ament_package()`、`pluginlib_export_plugin_description_file`。 |
| `ament_python` | 纯 Python 包走 `setup.py` / `setup.cfg`，用 `entry_points.console_scripts` 声明 `ros2 run` 入口。 |
| `install/` | **`ros2 run` 和 launch 查的是这里，不是 `src/`，也不是 `build/`**。改了 launch、YAML、URDF 后必须重新构建（或用 `--symlink-install`）。 |
| `source install/setup.bash` | 把 ROS 环境和本工作区加进当前终端的环境变量；**每个新终端都要执行一次**。 |

### 16.2 典型 C++ 包：cmd_chassis 的 CMakeLists

**`src/cmd_chassis/CMakeLists.txt（第 1-56 行节选）`** · 源码第 **1–43** 行

```cmake
 1 cmake_minimum_required(VERSION 3.11)
 2 project(cmd_chassis)
 3
 4 if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
 5   add_compile_options(-Wall -Wextra -Wpedantic)
 6 endif()
 7
 8 # find dependencies
 9 find_package(ament_cmake REQUIRED)
10 find_package(rclcpp REQUIRED)
11 find_package(rm_interfaces REQUIRED)
...
18 set(ros_dependencies
19   rclcpp
20   rm_interfaces
21   nav_msgs
22   nav2_msgs
23   geometry_msgs
24   tf2
25   tf2_ros
26   tf2_geometry_msgs
27   sensor_msgs
28 )
29
33 add_executable(fake_joint src/fake_joint.cpp)
34 ament_target_dependencies(fake_joint ${ros_dependencies})
35
36 add_executable(rot_imu src/rot_imu.cpp)
37 ament_target_dependencies(rot_imu ${ros_dependencies})
38
39 add_executable(twist_transformer src/twist_transformer.cpp)
40 ament_target_dependencies(twist_transformer ${ros_dependencies})
41
42 add_executable(twist2chassis_cmd src/twist2chassis_cmd.cpp)
43 ament_target_dependencies(twist2chassis_cmd ${ros_dependencies})
44
46 # Install nodes
47 install(
48   TARGETS fake_joint rot_imu twist_transformer twist2chassis_cmd
49   DESTINATION lib/${PROJECT_NAME}
50 )
51
52 ament_package()
```

**逐行拆解**

- **1、2** — CMake 最低版本 + 包名（`${PROJECT_NAME}` 后面全靠它）。
- **4–6** — 打开编译警告。
- **9–17** — `find_package(... REQUIRED)` 声明依赖，找不到就构建失败。这里共找了 9 个包。
- **18–28** — 把依赖列表存成变量，下面 4 个目标复用，避免重复写。
- **33–43** — **`add_executable(名字 源文件)`**：每个 `.cpp` 编译成一个可用 `ros2 run cmd_chassis 名字` 启动的程序。`ament_target_dependencies` 自动配好头文件路径和链接库。
- **47–50** — `install(TARGETS ... DESTINATION lib/${PROJECT_NAME})`：把可执行文件装进 `install/lib/cmd_chassis/`。**少了这步 `ros2 run` 找不到程序**。
- **52** — `ament_package()` 注册包，必须放最后。

> [!WARNING] package.xml 与 CMakeLists 不一致
> `cmd_chassis/package.xml` 只声明了 `geometry_msgs` 和 `rm_interfaces`，而 CMakeLists 里 `find_package` 了 9 个包。`rosdep` 按 `package.xml` 装依赖，本机可能碰巧都装了所以能编译，换一台机器就会失败。

### 16.3 纯资源包：sentry_bringup

**`src/sentry_bringup/CMakeLists.txt（全文 38 行节选）`** · 源码第 **1–20** 行

```cmake
 1 cmake_minimum_required(VERSION 3.8)
 2 project(sentry_bringup)
...
 8 find_package(ament_cmake REQUIRED)
 9 find_package(nav2_bringup REQUIRED)
...
22 # 1 add_executable
23
24 # 2 ament_target_dependencies
25
26 # 3 install
27 install(DIRECTORY launch maps params behavior_tree rviz
28   DESTINATION share/${PROJECT_NAME})
29 install(PROGRAMS scripts/wait_for_localization.py
30   DESTINATION lib/${PROJECT_NAME})
31
32
33 # 4 include
34
35 ament_package()
```

**逐行拆解**

- **22–24** — 注释 `# 1 add_executable` / `# 2 ament_target_dependencies` 是模板占位——**这个包没有任何 C++ 源码**。
- **27、28** — `install(DIRECTORY launch maps params behavior_tree rviz ...)`：把 5 类资源装到 `install/share/sentry_bringup/`。这正是 `get_package_share_directory('sentry_bringup')` 能找到它们的理由。
- **29、30** — `install(PROGRAMS scripts/wait_for_localization.py DESTINATION lib/${PROJECT_NAME})`：把 Python 门控脚本装成可执行程序，所以 launch 里能写 `Node(package='sentry_bringup', executable='wait_for_localization.py', ...)`。脚本必须有 shebang。
- **35** — `ament_package()` 收尾。

> [!TIP] 改了 YAML 却不生效？
> 因为 `get_package_share_directory` 指向的是 `install/share/`，不是 `src/`。用 `ros2 pkg prefix --share sentry_bringup` 查运行节点实际读的目录；改完配置记得重新 `colcon build`（或首次构建时用 `--symlink-install`）。

### 16.4 package.xml 里各种 depend 标签

| 标签 | 含义 | 本工程例子 |
| --- | --- | --- |
| `<buildtool_depend>` | 构建工具，不导出给下游 | `ament_cmake` |
| `<build_depend>` | 仅编译期需要 | `rosidl_default_generators` |
| `<exec_depend>` | 仅运行期需要 | `sentry_bringup` 几乎全部依赖、`python_qt_binding` |
| `<depend>` | 编译 + 运行 + 导出，最常用 | `rclcpp`、`geometry_msgs` |
| `<test_depend>` | 仅测试期 | `ament_lint_auto` |
| `<member_of_group>` | 声明属于某组，影响构建顺序 | 接口包的 `rosidl_interface_packages` |
| `<export><build_type>` | 声明构建系统 | `ament_cmake` / `ament_python` |
| `<export><costmap_2d plugin=>` | 向 Nav2 注册插件描述文件 | `costmap_intensity` 包 |

> [!CAUTION] 一个残留声明
> `src/sentry_bringup/package.xml` 第 36 行写了 `<costmap_2d plugin="${prefix}/costmap_plugins.xml" />`，但工作区里**并没有 `costmap_plugins.xml` 这个文件**。属于历史残留，不影响当前运行，但会让人误以为这里也导出了插件。

### 16.5 URDF 与静态 TF 树

**`src/sentry_description/urdf/sentry_description.urdf（第 357-369、477-495 行）`** · 源码第 **357–384** 行

```xml startLineNumber=357
357   <joint
358     name="lidar_joint"
359     type="fixed">
360     <origin
361       xyz="0 0 0.316500899999999"
362       rpy="0 0 0" />
363     <parent
364       link="yaw_link" />
365     <child
366       link="lidar_link" />
367     <axis
368       xyz="0 0 0" />
369   </joint>
...
477   <link name="imu_link"/>
478   <joint name="imu_joint" type="fixed">
479     <origin xyz="0.011 0.02329 -0.04412" rpy="0 0 0"/>
480     <parent link="lidar_link" />
481     <child link="imu_link" />
482   </joint>
483
484   <link name="chassis_link"/>
485   <joint name="chassis_joint" type="fixed">
486     <origin xyz="0 0 0" rpy="0 0 0"/>
487     <parent link="yaw_link" />
488     <child link="chassis_link" />
489     <axis xyz="0 0 -1" />
490   </joint>
```

> 整个 URDF 的所有 joint 都是 `fixed`（固定），所以模型不提供任何可动关节反馈。实车上云台若相对底盘转动，固定模型不能代替真实关节 TF。

**逐行拆解**

- **357–369** — `lidar_link` 挂在 `yaw_link` 下，Z 方向偏移 0.3165 m（雷达安装高度）。
- **477–482** — `imu_link` 挂在 **`lidar_link`** 下，平移 `[0.011, 0.02329, -0.04412]`。这就是第 09 章 `transform_publisher` 查的那条外参。
- **484–490** — `chassis_link` 是 **`yaw_link` 的叶子**，不是 `imu_link`/`lidar_link` 的父节点——和很多人的直觉相反。

**`src/sentry_description/launch/view_model.launch.py（第 16-42 行节选）`** · 源码第 **16–41** 行

```py startLineNumber=16
16     robot_state_publisher_node = Node(
17         package='robot_state_publisher',
18         executable='robot_state_publisher',
19         arguments=[urdf_model_path]
20         )
...
23     joint_state_publisher_node = Node(
24         package='joint_state_publisher_gui',
25         executable='joint_state_publisher_gui',
26         name='joint_state_publisher_gui',
27         arguments=[urdf_model_path]
28         )
29
30     rviz2_node = Node(
31         package='rviz2',
32         executable='rviz2',
33         name='rviz2',
34         output='screen',
35         arguments=['-d', rviz_config_path],
36         )
37
38     ld.add_action(robot_state_publisher_node)
39     # ld.add_action(joint_state_publisher_node)
40     # ld.add_action(rviz2_node)
41
42     return ld
```

**逐行拆解**

- **31–35** — 启动 `robot_state_publisher`，把 URDF 路径作为命令行参数传进去。它读模型后把固定关节广播到 `/tf_static`。
- **23–28** — 定义了 `joint_state_publisher_gui` 对象，但第 39 行被注释。
- **30–36** — 定义了 RViz，第 40 行被注释。
- **38–40** — **实际只启动 1 个节点**。因为所有关节都是 fixed，根本不需要 `/joint_states`；GUI 滑块和 RViz 都不必开。

> [!NOTE] robot_state_publisher vs joint_state_publisher
> `joint_state_publisher` 发布可动关节的角度（`/joint_states`）；`robot_state_publisher` 读 URDF + 订阅 `/joint_states`，把整棵 link 树变成 TF。全 fixed 的模型只需后者。若以后把 `yaw_joint` 改成可动，就必须同时提供关节反馈。

### 16.6 两个已弃用的历史节点

| 节点 | 原本做什么 | 为什么停用 |
| --- | --- | --- |
| `fake_joint.cpp` | 把 `/state_estimation` 转成 `odom → chassis_link` 动态 TF | 与 URDF 的 `yaw_link → chassis_link` 造成**双父坐标系冲突**；且旋转被硬编码成单位四元数，丢姿态。默认入口已不启动。 |
| `rot_imu.cpp` | 把 Livox IMU 绕 X 轴翻 180° 后重发 `imu/data` | 那是雷达倒装时代的做法。当前 MID360 **正装**、点云与 IMU 轴向一致、外参旋转为单位阵，所以弃用。 |

> [!WARNING] 别把外参平移抄两遍
> URDF 的 `lidar_link → imu_link` 是 `[0.011, 0.02329, -0.04412]`，FAST-LIO YAML 的 `extrinsic_T` 是 `[-0.011, -0.02329, 0.04412]`——**同一段平移的反方向**。README_USAGE.md 专门提醒不要照抄两遍。

### 16.7 control_panel：可选的 Qt 调试面板

**`src/control_panel/control_panel/publisher.py（全文 45 行节选）`** · 源码第 **1–35** 行

```py
 1 import rclpy
 2 from rclpy.node import Node
 3 from rm_interfaces.msg import GameState
 4 from auto_aim_interfaces.msg import Target
 5 from std_msgs.msg import String,Bool,Int16,Int8
 6 from geometry_msgs.msg import PoseStamped
 7 import time
 8
 9
10 class Panel_Publisher(Node):
11
12     def __init__(self,node_name='control_panel_pub'):
13         super().__init__(node_name)
14         self.game_state_publisher_=self.create_publisher(GameState,'game_state_sim',10)
15         self.timer_=self.create_timer(1,self.timer_callback)
16
17
18         self.game_state=GameState()
19         self.game_state.game_progress=0
20         self.game_state.stage_remain_time=32767
21         self.game_state.current_hp=700
22         self.game_state.projectile_allowance_17mm=400
23         self.game_state.my_outpost_hp=1000
24         self.game_state.enemy_outpost_hp=1000
25         self.game_state.my_base_hp=1000
26         self.game_state.enemy_base_hp=1000
27
28     def set_game_state(self,game_progress,stage_remain_time,current_hp,projectile_allowance_17mm,my_outpost_hp,enemy_outpost_hp,my_base_hp,enemy_base_hp):
29         self.game_state.game_progress=game_progress
...
37     def timer_callback(self):
38         if(self.game_state.stage_remain_time>0):
39             self.game_state.stage_remain_time=self.game_state.stage_remain_time-1
40         else:
41             self.game_state.game_progress=5
```

**逐行拆解**

- **3** — 使用 `rm_interfaces/msg/GameState`（不是被注释掉的 `GameStatus`）。
- **4–7** — `Target`、若干 std_msgs、`PoseStamped`、`time` 都导入了但**没用到**，说明原本计划发更多话题。
- **14** — **唯一发布的话题**：`game_state_sim`，类型 `GameState`，队列 10。
- **15** — 1 Hz 定时器驱动倒计时。
- **18–26** — 构造开局状态：未开始、剩余 32767 秒、HP 700、弹量 400、双方前哨站/基地 1000。
- **28–35** — 界面按钮回调会调它，把 8 个字段覆盖成人工输入值。
- **37–41** — 每秒把 `stage_remain_time` 减 1，减到 0 就把 `game_progress` 置 5（`GAME_STOP`）。

`gui.py` 是一个 Qt 窗口，8 个输入框对应 `GameState` 的业务字段，一个「set game status」按钮。它的 `loop()` 在子线程里 `rclpy.spin_once` 并**高频持续发布**当前状态（约每 10 ms 一次），按钮只是修改对象字段——这更接近真实裁判系统周期性下发的行为。Qt 的 `app.exec_()` 占主线程，ROS 轮询放子线程，是 Python GUI + ROS 的常见套路。

> [!TIP] 默认总入口不启动它
> `docs/CODEBASE_GUIDE.md` 说明当前 `control_panel` 只发布模拟比赛状态，**不启动导航或比赛决策**，默认总入口没有启用它。它是可选调试工具，需要图形环境和 `python_qt_binding`。启动命令来自 `setup.py` 的 `console_scripts`：`ros2 run control_panel control_panel`。

---

## 17 · 实战速查：命令、验收点与排障清单

*把前面所有概念落到「终端里敲什么」。首次使用务必分阶段，每段都有可观测的验收点。*

### 17.1 推荐顺序

| 阶段 | 入口 / 命令 | 验收点 |
| --- | --- | --- |
| 0 编译 | `colcon build ...` + `source install/setup.bash` | `ros2 pkg list` 能看到各包 |
| 1 检查传感器与 TF | `msg_MID360_launch.py` + `view_model.launch.py` | `/livox/lidar` 10 Hz、`base_link → imu_link` 可查 |
| 2 建图 | `ros2 launch sentry_bringup mapping.launch.py` | `/cloud_registered`、`/Laser_map`、`/projected_map` 都有数据 |
| 3 保存地图 | `/map_save` + `map_saver_cli` | `GlobalMap.pcd` + `nav_map.png/.yaml` |
| 4 重定位 | `relocalization.launch.py` | `/icp_result`、`map → odom`、RViz 位置正确 |
| 5 导航 | `navigation.launch.py` 或一键入口 | `/map` 激活、`/cmd_vel` → `/chassis_cmd` |

已有同一场地、同一坐标基准的两种地图时，可以从第 4 阶段开始。

### 17.2 编译与环境

**`README_USAGE.md §1.1 的核心命令`** · 源码第 **1–10** 行

```bash
cmake -S "$QCT_WS/src/Livox-SDK2" -B "$QCT_WS/build-sdk2" -DCMAKE_BUILD_TYPE=Release
cmake --build "$QCT_WS/build-sdk2" --parallel
sudo cmake --install "$QCT_WS/build-sdk2"
sudo ldconfig

rosdep update
rosdep install --from-paths src --ignore-src -r -y --rosdistro humble
colcon build --base-paths src --packages-skip livox_sdk2 \
  --cmake-args -DROS_EDITION=ROS2 -DDISTRO_ROS=humble
source install/setup.bash
```

**逐行拆解**

- **1–4** — 先单独编译安装 Livox-SDK2（系统级库），`ldconfig` 刷新动态库缓存。
- **6、7** — `rosdep` 按各包 `package.xml` 安装系统依赖。
- **8、9** — `colcon build` 编译工作区；`--packages-skip livox_sdk2` 跳过已单独装的 SDK；两个 CMake 参数告诉驱动用 ROS 2 / Humble。
- **10** — 加载本工作区环境。

**`每个新终端都要执行`** · 源码第 **1–4** 行

```bash
source /opt/ros/humble/setup.bash
cd ~/QCT-Nva
export QCT_WS="$PWD"
source "$QCT_WS/install/setup.bash"
```

**逐行拆解**

- **1–4** — 环境变量**不会跨终端共享**。跨机器联调还要保持 `ROS_DOMAIN_ID` 一致。

> [!CAUTION] 不要在工作区里跑驱动的 build.sh
> README_USAGE.md 明确提醒：直接执行 Livox 驱动自带的 `build.sh` 会清理外层的 `build/`、`install/`，把整个工作区搞坏。用上面的 `colcon build` 统一构建。

### 17.3 检查传感器与坐标系

**`README_USAGE.md §2 的验收命令`** · 源码第 **1–7** 行

```bash
ros2 launch livox_ros_driver2 msg_MID360_launch.py
# ros2 topic type /livox/lidar     -> livox_ros_driver2/msg/CustomMsg
# ros2 topic type /livox/imu       -> sensor_msgs/msg/Imu
# ros2 topic hz /livox/lidar       # 10 Hz
ros2 launch sentry_description view_model.launch.py
ros2 run tf2_ros tf2_echo base_link imu_link
ros2 run tf2_ros tf2_echo yaw_link chassis_link
```

**逐行拆解**

- **1** — 只起驱动，先确认雷达有数据。
- **2–4** — 检查话题类型和频率。**类型必须是 `CustomMsg`**，否则 FAST-LIO 收不到。
- **5** — 起机器人模型（只有 `robot_state_publisher`）。
- **6、7** — 查两条静态 TF 是否存在。查不到说明 URDF 或 `view_model.launch.py` 没起来。

### 17.4 建图与保存地图

**`README_USAGE.md §3-4 的核心命令`** · 源码第 **1–14** 行

```bash
ros2 launch sentry_bringup mapping.launch.py
# ros2 topic hz /state_estimation ; ros2 topic hz /cloud_registered
# ros2 topic hz /Laser_map ; ros2 topic hz /terrain_map_ext
# ros2 topic hz /terrain_map_ext_exchanged ; ros2 topic hz /terrain_map_at_scan
ros2 topic echo /projected_map --once --qos-durability transient_local --field info

export QCT_MAP_DIR="$QCT_WS/map_runs/site_01"
mkdir -p "$QCT_MAP_DIR"
ros2 param get /laser_mapping_node publish.map_en
ros2 param get /laser_mapping_node pcd_save.pcd_save_en
ros2 service call /map_save std_srvs/srv/Trigger '{}'
cp -i "$QCT_WS/test.pcd" "$QCT_MAP_DIR/GlobalMap.pcd"
ros2 run nav2_map_server map_saver_cli -t /projected_map \
  -f "$QCT_MAP_DIR/nav_map" --fmt png --mode trinary
```

**逐行拆解**

- **1** — 启动建图（8 秒后 FAST-LIO + OctoMap 才起）。先保持机器人静止等 IMU 初始化。
- **2–4** — **逐级验收**：里程计 → 注册点云 → 累计点云 → 扩展地形 → 字段交换 → 扫描坐标变换。哪一环没数据就定位到哪。
- **5** — 确认 `/projected_map` 的元数据（注意用持久 QoS）。
- **8、9** — **存图前必查的两个开关**（第 06 章坑 2）。
- **10、11** — 调服务写 PCD，并拷成 `GlobalMap.pcd`。
- **12、13** — 保存二维栅格 PNG + YAML。

> [!WARNING] 自制地图要成套替换
> PCD + PNG + YAML 必须来自**同一轮建图**、同一坐标基准。另外二维地图 YAML 的 `origin` 只是图片左下角坐标，**不能拿来做 ICP 初值**。`map_saver_cli` 保存超时可加 `--ros-args -p map_subscribe_transient_local:=false`。

### 17.5 重定位验收

**`README_USAGE.md §5.1 的命令`** · 源码第 **1–9** 行

```bash
# 终端 B（先监听，持久 QoS）
ros2 topic echo /icp_result geometry_msgs/msg/PoseWithCovarianceStamped --qos-durability transient_local --once
ros2 topic echo /localization_initial_pose geometry_msgs/msg/PoseWithCovarianceStamped --qos-durability transient_local --once
# 终端 A
ros2 launch sentry_bringup relocalization.launch.py
# 自制地图追加 prior_map:="$QCT_MAP_DIR/GlobalMap.pcd"
ros2 run tf2_ros tf2_echo map odom
ros2 topic hz /state_estimation
ros2 topic hz /cloud_registered
```

**逐行拆解**

- **2、3** — **先开监听再启动**：这两条消息只发一次，且必须用 `--qos-durability transient_local`。
- **5** — 启动重定位；自制地图用 `prior_map:=` 传绝对路径。
- **7–9** — 验收：`map → odom` 可查、位姿与现场一致、里程计与注册点云持续更新。配准成功后 `/prior_map` 与 `/transformed_cloud` 不再刷新。

### 17.6 导航与一键启动

**`README_USAGE.md §7 的核心命令`** · 源码第 **1–9** 行

```bash
ros2 launch sentry_bringup bringup_all_in_one.launch.py
# 无界面录包回放追加 use_livox_driver:=false use_rviz:=false
# 自定义地图追加 prior_map:=<PCD绝对路径> params_file:=<Nav2参数绝对路径>
ros2 launch sentry_bringup navigation.launch.py log_level:=info
ros2 lifecycle get /map_server
ros2 topic echo /map --once --qos-durability transient_local --field info
ros2 action info /navigate_to_pose
# ros2 topic echo /cmd_vel_nav --once ; /cmd_vel ; /cmd_vel_in_yaw ; /chassis_cmd
ros2 interface show rm_interfaces/msg/ChassisCmd
```

**逐行拆解**

- **1** — 一键入口：定位就绪门控通过后才起 Nav2，超时 90 秒自动关闭。
- **3、4** — 也可以单独起导航（**必须确认定位已好**）；`log_level:=info` 便于看日志。
- **5–8** — 检查生命周期状态、地图、导航 action、消息类型。
- **9** — **速度链逐级排查**：`/cmd_vel_nav` → `/cmd_vel` → `/cmd_vel_in_yaw` → `/chassis_cmd`。

### 17.7 常见报错排查表

| 现象 | 按这个顺序检查 |
| --- | --- |
| 新终端找不到包或 launch | 先 `source /opt/ros/humble/setup.bash` 再 `source install/setup.bash`；用 `ros2 pkg prefix` 确认没选错工作区。 |
| 驱动启动但没点云/IMU | 网卡 IP（192.168.1.5）、雷达 IP（192.168.1.12）、UDP 是否到达、是否有第二个驱动；检查 `CustomMsg` / `PointCloud2` 类型。 |
| 建图有雷达但没里程计 | 看 FAST-LIO 日志；核对点云/IMU 时间戳和 `base_link ↔ imu_link`。定位模式还要看 `/icp_result` 是否到达。 |
| `/cloud_registered` 有数据但没 `/projected_map` | 按 `/terrain_map_ext` → `/terrain_map_ext_exchanged` → `/terrain_map_at_scan` 逐级查；看 `map → sensor_at_scan` 在点云时间戳是否有效、过滤后是否还剩点。 |
| PCD 没生成 / 点数为零 | 检查 `/Laser_map` 是否有有效点、`publish.map_en` 与 `pcd_save.pcd_save_en`、路径权限、内存磁盘空间。 |
| ICP 一直不收敛或卡在累计 | 看目标点数、输入话题和初值；检查两云是否有足够重叠、是否落在错误的重复结构上；确认需要**连续帧**通过才会发布。 |
| `/icp_result` 出过但 FAST-LIO 仍等待 | 先用持久 QoS 读 `/localization_initial_pose`；没有就查扫描到 IMU 的静态外参，有就查 FAST-LIO 的先验 PCD、点云/IMU 时间戳与 `map → chassis_link`。 |
| Nav2 地图不显示或节点停在 `inactive` | 看生命周期日志最先失败的节点；检查 PNG/YAML、行为树路径、MPPI/Theta*/平滑器和自定义插件是否安装；`ros2 param get /map_server yaml_filename`。 |
| 地图正常但机器人位置跳动 | 用 `view_frames` 和 `tf2_echo` 查 `chassis_link` 双父坐标系、重复 `map → odom`、时间戳或地图配对错误。 |
| 有路径但没 `/chassis_cmd` | 从 `/cmd_vel_nav`、`/cmd_vel`、`/cmd_vel_in_yaw` 逐级查发布者与订阅者；速度转换依赖底盘与 `yaw_link` 的 TF。 |
| Docker 里定位就绪但 Nav2 生命周期服务偶发失败 | 本次验证用 Cyclone DDS：装 `ros-humble-rmw-cyclonedds-cpp`，设 `RMW_IMPLEMENTATION=rmw_cyclonedds_cpp` 后重试。 |

来源：README_USAGE.md §8 排障表。收尾顺序：先取消导航目标并结束导航，再结束定位/建图；建图退出前先完成保存。

> [!TIP] 执行器断开时「进度不足」是正常的
> 控制器靠里程计判断有没有真的在动。执行器没接、车不动，就会一直报进度检查失败——这是预期行为，不要当成定位或规划故障。

---

## 18 · 全量陷阱清单与联调优先级

*把散落在各章的「不一致 / 未闭环 / 易错点」集中起来，交作业或实车前过一遍。*

### 18.1 配置与实现不一致（都是真的，不是猜测）

| # | 位置 | 现象 | 后果 / 建议 |
| --- | --- | --- | --- |
| 1 | `nav2_params.yaml:53,54,360` | 硬编码 `/home/sentry_ws/...`，靠 launch `ReplaceString` 改写 | 传自定义 `params_file` 时替换**不生效**，行为树/地图加载失败 |
| 2 | `nav2_params.yaml:448` | `smoother_server.use_sim_time: True`（全文件唯一） | launch 会覆盖；单独 `ros2 run` 调试时不一致 |
| 3 | `nav2_params.yaml:139-141` | `adjustThre/minAngleDiff/adjustHeadingSpeed` 非原生 MPPI 参数；`minAngleDiff: 365.0` | 用官方 apt 包会被忽略；365° 恒不满足 |
| 4 | `nav2_params.yaml:190-192` | MPPI `cost_scaling_factor: 10.0` vs local inflation `5.0` | 注释要求一致，避障行为可能偏离预期 |
| 5 | `nav2_params.yaml:308-310` | `static_layer` 定义了但不在 local `plugins` | 该层不生效 |
| 6 | `nav2_params.yaml:135` | `yaw_goal_tolerance: 3.14` | 等于不检查到达朝向 |
| 7 | `navigation.launch.py:158-159` | `planner_server` 的 respawn 被注释 | 规划器崩溃不会自动重启 |
| 8 | `navigation.launch.py:343-344` | 扩展地形分析、地面分割节点被注释 | 方案 B 未启用，别以为在跑 |
| 9 | 行为树默认文件第 10 行 | 注释写 1 Hz，实际 `RateController hz="0.5"` | 重规划其实是每 2 秒一次 |
| 10 | 行为树默认文件第 32 行 | `<Spin>` 被注释 | 恢复动作只有两次 BackUp，不旋转 |
| 11 | `obstacle_layer.cpp:429` | 注释「too high or too far away」，实际只判 intensity 上限 | 拷贝未改注释，容易误读 |
| 12 | `voxel_layer.cpp:151` | 用 `uint8_t` 迭代器读 `float32` intensity，且无 min 阈值 | 潜在 bug；该插件当前未被启用 |
| 13 | `back_up_twz_free_action.cpp:188-189` | 未找到自由空间时 `free_points.size()==0` 会除零；跨半径累积不清空 | 恢复行为可能崩溃 / 质心偏斜 |
| 14 | `laserMapping.cpp:328/371` | `pcd_save.interval` 声明读入但从未使用 | 按注释调它不会有任何效果 |
| 15 | `laserMapping.cpp:939/1245` | 只开 `pcd_save_en` 而关 `publish.map_en` 会存出空地图 | 两个开关必须同时为 true |
| 16 | `icp_node.cpp` / 两个 launch | 三套 ICP 默认参数互不相同（得分阈值 0.0 / 0.1 / 0.9） | 改参数前先确认实际启动的是哪个入口 |
| 17 | `sac_ia_gicp.cpp:185` | 文件名/文档称 GICP，实际实例化普通 `IterativeClosestPoint` | 命名与实现不符 |
| 18 | `rm_interfaces/CMakeLists.txt:22` | `GameStatus.msg` 被注释，不生成类型 | 实际用的是 `GameState.msg` |
| 19 | `sentry_bringup/package.xml:36` | 声明了不存在的 `costmap_plugins.xml` | 残留声明 |
| 20 | `cmd_chassis` | CMakeLists 找 9 个包，`package.xml` 只声明 2 个 | 换机器编译时依赖可能缺失 |
| 21 | `view_model.launch.py:39-40` | 创建了 joint_state_publisher 和 RViz 对象但被注释 | 实际只起 1 个节点 |
| 22 | 驱动 launch | `msg_MID360_launch.py`(CustomMsg) 与 `rviz_MID360_launch.py`(PointCloud2) | 不能同时启动，也不能互相替换 |

### 18.2 功能边界：哪些事这套代码没做

- **没有 `/chassis_cmd` 的消费者**：找不到把底盘指令下发到电控的节点，实车要自己补串口/CAN 驱动。
- **所有 URDF 关节都是 fixed**：云台相对底盘转动时，固定模型不能代替真实关节反馈。
- **`control_panel` 不在默认入口**：只发模拟比赛状态，不启动导航或比赛决策。
- **`octomap_server` / Nav2 / PCL / MPPI 都是系统包**：源码不在本工作区，能改的只有参数与接线。
- **定位精度与底盘闭环尚未在实车验证**：README 说明只在 Humble Docker 中用合成点云/IMU 验证过默认链路。

### 18.3 联调前优先确认（源码导读给的顺序）

1. **地图坐标**：确认 `prior_map:=` 的 PCD 与 Nav2 栅格 YAML 采用相同基准，并在 RViz 对照固定结构。
2. **传感器外参**：核对扫描坐标系和 URDF 的 IMU、雷达安装关系；实车云台与底盘若相对转动，需要真实关节反馈。
3. **定位就绪**：检查 `/icp_result`、`/localization_initial_pose`、`/state_estimation` 和 `map → chassis_link`，同时确认 RViz 中的实际位置与朝向。
4. **运动闭环**：在执行器断开或仿真条件下验证路径、速度和恢复行为；仓库中未找到把 `/chassis_cmd` 下发到电控的节点。

### 18.4 最后一句话

> [!TIP] 这套代码的主线其实很清晰
> 雷达给点 → FAST-LIO 给位姿 → 地形分析把「离地多高」写进 intensity → 自定义插件据此画代价地图 → Nav2 用 Theta* + MPPI 算路径和速度 → 两个小节点把速度转成底盘消息。**所有复杂的、看起来吓人的文件，都是在这条主线上做「数据格式与坐标系的搬运」**。按这条线读，632 个文件就不再是 632 个谜题。

需要回头查细节时，用页面顶部搜索框直接搜话题名、参数名或文件路径；想看整体，回第 02 章的总图。祝联调顺利。

---

## 19 · 常用包全景：14 个包各自干什么、谁依赖谁

*前面按数据流讲完了代码，这一章换成「按包查」：想改某个功能，先知道该进哪个目录。*

ROS 2 里的「包（package）」不是文件夹的俗称，而是**一个带 `package.xml` 的构建单元**。`colcon build` 以包为单位编译，`ros2 run 包名 可执行文件名` 里的「包名」取的正是 `package.xml` 里 `<name>` 标签的值，不是目录名。这一点在本工程里特别容易搞错。

### 19.1 先纠正直觉：12 个顶层目录，其实是 14 个包 + 1 个系统库

`src/` 下有 12 个顶层目录，但包的数量不是 12：`autonomous_exploration_development_environment` 里套了 3 个包、`nav2_plugins` 里套了 2 个包；而 `Livox-SDK2` 是纯 CMake 的 C++ SDK，**没有 `package.xml`**，不能被 `colcon build` 当作 ROS 包编译，必须先单独 `cmake --install`。

| 顶层目录 | 包名（package.xml 的 name） | 来源 | 一句话作用 | 主要产出 |
| --- | --- | --- | --- | --- |
| `FAST_LIO` | `fast_lio` | 上游改造 | 激光惯性里程计：一边算自己在哪，一边把点云拼成地图 | 节点 `fastlio_mapping`、`Pose6D.msg`、yaml、rviz 配置 |
| `Livox-SDK2` | 无（CMake project `livox_sdk2`） | 第三方 SDK | MID360 雷达的底层 UDP 通信库 | `liblivox_lidar_sdk_shared.so`、头文件、samples |
| `auto_aim_interfaces` | `auto_aim_interfaces` | 自研接口 | 自瞄装甲板/目标的数据结构 | 8 个 `.msg` |
| `autonomous_exploration_development_environment` | `terrain_analysis` | 上游 CMU 移植 | 把点云换算成「离地高度」，输出 `/terrain_map` | 节点 `terrainAnalysis`、`exchangeField`、XML launch |
| `autonomous_exploration_development_environment` | `terrain_analysis_ext` | 上游 CMU 移植 | 扩展版地形分析（分位数高程、考虑落差） | 节点 `terrainAnalysisExt`、`PCDPublisherNode`、`PCDSaverNode`、`pathNorm` |
| `autonomous_exploration_development_environment` | `sensor_scan_generation` | 上游 CMU 移植 | 把注册点云搬回传感器原点，给 OctoMap 用 | 节点 `sensorScanGeneration` |
| `cmd_chassis` | `cmd_chassis` | 自研 | 速度指令坐标变换 + 封装成底盘消息 | 节点 `twist2chassis_cmd`、`twist_transformer`、`fake_joint`、`rot_imu` |
| `control_panel` | `control_panel` | 自研（ament_python） | Qt 界面模拟裁判系统，发比赛状态 | `control_panel.gui:main`、`publisher.py` |
| `icp_relocalization` | `icp_relocalization` | 自研 | 开机时把当前扫描对齐到已有地图，求出初始位姿 | 节点 `icp_node`、`transform_publisher`、`sac_ia_gicp`；2 个 launch |
| `livox_ros_driver2` | `livox_ros_driver2` | 第三方上游 | 把雷达原始数据包装成 ROS 2 话题 | 组件节点、`CustomMsg/CustomPoint.msg`、`launch_ROS2/`、config |
| `nav2_plugins` | `costmap_intensity` | Nav2 插件改造 | 按 intensity（离地高度）过滤障碍点 | 共享库 `ObstacleLayerIntensity` / `VoxelLayerIntensity` + plugin XML |
| `nav2_plugins` | `behavior_ext_plugins` | Nav2 插件改造 | 自定义恢复行为 `BackUpTwzFree` | 共享库 + plugin XML |
| `rm_interfaces` | `rm_interfaces` | 自研接口 | 底盘/云台/发射/裁判系统消息 | 17 个 `.msg`（只有 6 个被编译） |
| `sentry_bringup` | `sentry_bringup` | 自研总装 | 所有启动入口、参数、地图、行为树、门控脚本 | 7 个 launch、`params/*.yaml`、`maps/*.pcd`、`behavior_tree/*.xml` |
| `sentry_description` | `sentry_description` | 自研 | 机器人 URDF 模型，定义静态 TF 树 | urdf、meshes、`view_model.launch.py` |

包名一列才是 `ros2 run` / `ros2 launch` 里该写的名字。

> [!WARNING] 三个最容易写错的名字
> ① 目录 `FAST_LIO` 的包名是小写 `fast_lio`；② 目录 `nav2_plugins`、`autonomous_exploration_development_environment` 都不是包，命令行里写它们一定报「package not found」；③ `Livox-SDK2` 压根不是 ROS 包，所以编译命令里才有 `--packages-skip livox_sdk2`。

### 19.2 按「什么时候被用到」把包分成四组

| 组 | 包 | 什么时候被用到 |
| --- | --- | --- |
| 全程都要 | `livox_ros_driver2`、`fast_lio`、`sentry_description`、`sentry_bringup`、`cmd_chassis` | 四条启动路径都会拉起；雷达、定位、TF、启动脚本、底盘转换缺一不可 |
| 只在建图 | `terrain_analysis`、`sensor_scan_generation`、`octomap_server`（系统包） | `mapping.launch.py` 里延时 8 秒后启动，配合 `/map_save` 存 PCD 和 PNG |
| 只在重定位 | `icp_relocalization` | `relocalization.launch.py` 与一键入口；算出 `/icp_result` 后发 `map → odom` |
| 只在导航 | `costmap_intensity`、`behavior_ext_plugins`、`nav2_*`（系统包） | `navigation.launch.py`；插件由 pluginlib 在运行期按 `nav2_params.yaml` 动态加载 |
| 只在编译期 | `rm_interfaces`、`auto_aim_interfaces`、`Livox-SDK2` | 只提供消息类型/链接库，不产生运行时进程（`control_panel` 是可选调试工具） |

1. **编译期：接口与 SDK**：`rm_interfaces` 生成 `ChassisCmd` 等消息类型；`Livox-SDK2` 提供 `.so`，`livox_ros_driver2` 链接它。
2. **启动期：`sentry_bringup` 是总开关**：它一个包里放了 7 个 launch 文件，用 `IncludeLaunchDescription` 把别的包的 launch 串起来。
3. **运行期：数据流跨包传递**：雷达话题 → `fast_lio` → `/state_estimation`、`/terrain_map` → `costmap_intensity` → Nav2 → `/cmd_vel` → `cmd_chassis` → `/chassis_cmd`。
4. **插件期：不写在启动文件里**：`costmap_intensity` 和 `behavior_ext_plugins` 编译成 `.so`；Nav2 读 yaml 里的 `plugin:` 字符串，用 pluginlib 动态加载，launch 里看不到它们。

### 19.3 package.xml 逐行拆：一个包怎么声明「我依赖谁」

以总装包 `sentry_bringup` 为例。它是全工程依赖最多、也最能说明 ROS 2 依赖语义的一份清单。

**`src/sentry_bringup/package.xml（全文 38 行）`** · 源码第 **1–38** 行

```xml
<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <name>sentry_bringup</name>
  <version>0.0.0</version>
  <description>TODO: Package description</description>
  <maintainer email="scurm@todo.todo">scurm</maintainer>
  <license>TODO: License declaration</license>

  <buildtool_depend>ament_cmake</buildtool_depend>

  <depend>nav2_bringup</depend>
  <exec_depend>nav2_mppi_controller</exec_depend>
  <exec_depend>nav2_constrained_smoother</exec_depend>
  <exec_depend>rclpy</exec_depend>
  <exec_depend>nav_msgs</exec_depend>
  <exec_depend>tf2_ros</exec_depend>
  <exec_depend>icp_relocalization</exec_depend>
  <exec_depend>fast_lio</exec_depend>
  <exec_depend>livox_ros_driver2</exec_depend>
  <exec_depend>sentry_description</exec_depend>
  <exec_depend>cmd_chassis</exec_depend>
  <exec_depend>terrain_analysis</exec_depend>
  <exec_depend>terrain_analysis_ext</exec_depend>
  <exec_depend>sensor_scan_generation</exec_depend>
  <exec_depend>octomap_server</exec_depend>
  <exec_depend>rviz2</exec_depend>
  <exec_depend>costmap_intensity</exec_depend>
  <exec_depend>behavior_ext_plugins</exec_depend>

  <test_depend>ament_lint_auto</test_depend>
  <test_depend>ament_lint_common</test_depend>

  <export>
    <build_type>ament_cmake</build_type>
    <costmap_2d plugin="${prefix}/costmap_plugins.xml" />
  </export>
</package>
```

> 为什么全是 `exec_depend`？因为 `sentry_bringup` 里几乎没有 C++ 源码，它只是 launch + YAML + 脚本，编译阶段不需要链接任何库；但运行时必须保证这些包都已经安装，否则 `ros2 launch` 会找不到节点。

**逐行拆解**

- **3、4** — `<package format="3">` 是格式版本；`<name>` 决定包名，也是 `ros2 pkg list` 显示的名字。
- **5–8** — 版本、描述、维护者、许可证。这里全是 `TODO`，属于模板没填完，不影响编译但不规范。
- **10** — `buildtool_depend`：编译这个包**所需要的构建工具**，不是代码依赖。C++ 包写 `ament_cmake`，Python 包写 `ament_python`。
- **12** — 唯一的 `<depend>`：等价于同时写了 build/exec/export 三种依赖，表示编译和运行都要。这里依赖 Nav2 官方启动包。
- **13–29** — **17 条 `exec_depend`**：只在「运行」时需要，编译不依赖。这份清单几乎就是本工程的运行时组件表：MPPI 控制器、平滑器、雷达驱动、FAST-LIO、ICP、地形分析、OctoMap、RViz、两个自研插件。
- **15–17** — `rclpy` / `nav_msgs` / `tf2_ros` 是**门控脚本**（`wait_for_localization.py`）要用的 Python 客户端库和消息/TF 库。
- **23–25** — 三个 CMU 地形分析包。注意它们是三个独立包，名字和目录名都不一样。
- **31、32** — `test_depend`：只有跑 `colcon test` 时才需要，这里是代码风格检查工具。
- **34–37** — `<export>` 里声明构建类型；`<costmap_2d plugin=...>` 把插件描述 XML 注册给代价地图框架，pluginlib 靠它找到 `.so`。

| 标签 | 含义 | 什么时候生效 | 少了会怎样 |
| --- | --- | --- | --- |
| `buildtool_depend` | 构建工具本身 | `colcon build` 开始时 | 找不到构建系统，直接不编译 |
| `depend` | 编译 + 运行 + 导出都要 | 全程 | 最常见、最保险的写法 |
| `build_depend` | 只要编译时需要（头文件） | 编译 | 头文件找不到 |
| `exec_depend` | 只要运行/启动时存在 | `ros2 launch` 时 | 编译能过，一运行报「package not found」 |
| `test_depend` | 只有跑测试时需要 | `colcon test` | 测试失败 |
| `<export>` | 向别的包导出信息（构建类型、插件 XML） | 被别的包 find_package / pluginlib 查询时 | 插件加载不到 |

### 19.4 外部依赖：四类「别人写好的包」

下面这些包不在 `src/` 里，而是 ROS 2 系统或 apt 安装的。读懂它们的分类，就能判断一个报错是「消息类型没装」「中间件问题」「算法库缺失」还是「构建工具没配好」。

| 类别 | 代表包 | 在本工程干什么 |
| --- | --- | --- |
| ROS 消息包 | `std_msgs`、`builtin_interfaces`、`geometry_msgs`、`nav_msgs`、`sensor_msgs`、`visualization_msgs`、`std_srvs` | 提供 `Header`、`Twist`、`Odometry`、`PointCloud2`、`MarkerArray`、`Trigger` 等数据结构；接口包的 `rosidl_generate_interfaces` 要依赖它们 |
| ROS 消息包（Nav2 专用） | `nav2_msgs`、`map_msgs`、`action_msgs`、`rcl_interfaces` | Nav2 的动作/服务消息、`GetCostmap` 服务、代价地图消息 |
| 中间件与客户端库 | `rclcpp`、`rclpy`、`rclcpp_components`、`rclcpp_action`、`rclcpp_lifecycle`、`rmw`、`rcutils` | 节点、组件注册、动作、生命周期节点、底层通信 |
| 坐标变换 | `tf2`、`tf2_ros`、`tf2_geometry_msgs`、`tf2_sensor_msgs` | TF 树、静态外参、`lookupTransform`、四元数转 RPY |
| 点云桥接 | `pcl_ros`、`pcl_conversions`、`libpcl-all-dev` | ROS 点云 ↔ PCL 点云转换、滤波、配准 |
| launch 框架 | `launch`、`launch_ros`、`ament_index_python`、`nav2_common` | `LaunchDescription`、`Node`、`RewrittenYaml`、`ReplaceString`、`get_package_share_directory` |
| 插件机制 | `pluginlib` | 把 `costmap_intensity` / `behavior_ext_plugins` 导出成可动态加载的插件 |
| Nav2 运行时栈 | `nav2_bringup`、`nav2_map_server`、`nav2_controller`、`nav2_planner`、`nav2_bt_navigator`、`nav2_behaviors`、`nav2_velocity_smoother`、`nav2_lifecycle_manager`、`nav2_mppi_controller`、`nav2_constrained_smoother` | `navigation.launch.py` 里 9 个被 lifecycle_manager 管理的节点 + MPPI 控制器 + 平滑器 |
| 可视化与工具 | `rviz2`、`robot_state_publisher`、`joint_state_publisher_gui`、`xacro`、`rosbag2`、`octomap_server` | 显示点云/地图、发布 URDF 静态 TF、录包、生成二维栅格地图 |
| 界面与图像 | `python_qt_binding`、`cv_bridge`、`foxglove_msgs` | `control_panel` 的 Qt 窗口、`view_map.py` 的图像显示 |
| 算法库 | `PCL`、`Eigen3`、`OpenMP`、`ikd-Tree`、`IKFoM_toolkit`、`Livox-SDK2` | 点云滤波/配准、矩阵与流形运算、并行加速；后三个内嵌在 `FAST_LIO/include/` |
| 构建工具 | `ament_cmake`、`ament_cmake_auto`、`rosidl_default_generators`、`rosidl_default_runtime`、`setuptools`、`PkgConfig` | C++ 包构建、`.msg` 生成代码、Python 包打包、探测系统库 |

> [!NOTE] 「包」和「库」不是一回事
> `rclcpp`、`geometry_msgs`、`nav2_bringup` 是 ROS **包**，用 `ros2 pkg list` 能查到；`PCL`、`Eigen3`、`OpenMP` 是 C++ **库**，在 `CMakeLists.txt` 里用 `find_package(PCL REQUIRED)` 找，用 `target_link_libraries` 链接。前者是 ROS 世界的组织单位，后者是编译世界的链接单位。

### 19.5 消息接口包：rosidl_generate_interfaces 逐行

`.msg` 文件只是文本，必须靠 `rosidl_generate_interfaces` 在编译期生成 C++/Python 类，才能在代码里 `#include <rm_interfaces/msg/chassis_cmd.hpp>`。

**`src/rm_interfaces/CMakeLists.txt（第 9-43 行）`** · 源码第 **9–43** 行

```cmake startLineNumber=9
find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED)
find_package(std_msgs REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(rosidl_default_runtime REQUIRED)
find_package(nav_msgs REQUIRED)

rosidl_generate_interfaces(${PROJECT_NAME}
  # "msg/referee/EventData.msg"
  # "msg/referee/GameResult.msg"
  # "msg/referee/GameRobotHp.msg"
  # "msg/referee/RobotPos.msg"
  # "msg/referee/RobotStatus.msg"
  # "msg/referee/GameStatus.msg"
  # "msg/referee/PowerHeatData.msg"
  # "msg/referee/RobotBuff.msg"
  # "msg/referee/HurtData.msg"
  # "msg/referee/RobotInteractiveData.msg"
  # "msg/referee/ShootData.msg"

  "msg/referee/GameState.msg"
  "msg/referee/SentryCmd.msg"
  "msg/ChassisCmd.msg"
  "msg/Gimbal.msg"
  "msg/GimbalCmd.msg"
  "msg/ShootCmd.msg"

DEPENDENCIES
  std_msgs
  geometry_msgs
  nav_msgs
)

ament_export_dependencies(rosidl_default_runtime)
ament_package()
```

**逐行拆解**

- **17–22** — 先 `find_package` 把构建工具和消息依赖找出来；少了 `rosidl_default_generators` 就没有代码生成器。
- **24** — `rosidl_generate_interfaces(${PROJECT_NAME} ...)`：把下面列出的 `.msg` 生成 C++/Python 类型。`${PROJECT_NAME}` 就是 `rm_interfaces`。
- **25–35** — **11 个 `.msg` 被注释掉了**：文件还在磁盘上，但没有生成任何代码，`#include` 它们会编译失败。
- **37–42** — 实际只编译 6 个：裁判系统状态/指令、底盘指令、云台状态/指令、发射指令。
- **36–39** — `DEPENDENCIES` 列出被消息内部引用到的其他消息包；`ChassisCmd.msg` 里的 `geometry_msgs/Twist` 就需要它。
- **42、43** — 把运行时依赖导出给使用本包的其他包，最后以 `ament_package()` 收尾（每个 ament_cmake 包都必须有）。

**`src/rm_interfaces/msg/ChassisCmd.msg（全文 15 行）`** · 源码第 **1–15** 行

```text
# cmd msg for controlling chassis
# constants for control type
uint8 VELOCITY = 1         # velocity control, (vx,vy,w) in chassis frame.
uint8 FOLLOW_GIMBAL = 2    # velocity control, follow gimbal's yaw stick automatically,
                           # (vx,vy) in gimbal's yaw frame.
uint8 SWING = 3            # velocity control, swing around gimbal's yaw automatically,
                           # (vx,vy) in gimbal's yaw frame.
uint8 SPIN = 4             # velocity control, spin at an angular velocity automatically,
                           # (vx,vy) in gimbal's yaw frame.

# control type
uint8 type 1

# control data
geometry_msgs/Twist twist
```

**逐行拆解**

- **3–9** — 4 个**常量**：`VELOCITY=1`（底盘系速度）、`FOLLOW_GIMBAL=2`（跟随云台 yaw）、`SWING=3`（小陀螺）、`SPIN=4`（定角速度自旋）。生成代码后可用 `ChassisCmd::FOLLOW_GIMBAL`。
- **12** — `uint8 type 1`：字段 `type` 的**默认值是 1**。这是 ROS 2 msg 的默认值语法，不是数组长度、也不是注释。`twist2chassis_cmd.cpp` 又把它硬改成 2。
- **15** — 控制量本体是 `geometry_msgs/Twist`，即 `linear.x/y/z` + `angular.x/y/z`。引用别的包的消息类型，正是 `DEPENDENCIES geometry_msgs` 存在的原因。

> [!WARNING] 17 个 .msg，只有 6 个能用
> `msg/referee/` 下 13 个文件里有 11 个被 CMakeLists 注释掉，包括看起来很像在用的 `GameStatus.msg`。`control_panel/publisher.py` 导入的其实是 `GameState.msg`。**看消息能不能用，要看 CMakeLists 而不是看目录里有没有文件。**

### 19.6 按场景查包：我想改 X，该进哪个目录

| 我想… | 该看的包 | 具体文件 / 位置 |
| --- | --- | --- |
| 改雷达 IP、端口、点云格式 | `livox_ros_driver2` + `sentry_bringup` | `config/MID360_config.json`、`launch_ROS2/msg_MID360_launch.py` |
| 改建图 / 定位算法参数 | `fast_lio` | `config/*.yaml`、`sentry_bringup/params/fast_lio_*_param.yaml` |
| 改初始位姿匹配阈值 | `icp_relocalization` | `src/icp_node.cpp`（`fitness_score_thre`、`converged_count_thre`） |
| 改「什么算障碍」 | `costmap_intensity` + `terrain_analysis` | `obstacle_layer.cpp` 的 intensity 过滤；yaml 的 `min/max_obstacle_intensity` |
| 改路径规划 / 控制器 | `sentry_bringup` | `params/nav2_params.yaml`（Theta*、MPPI、costmap） |
| 改行为树逻辑 | `sentry_bringup` | `behavior_tree/*.xml`、`nav2_params.yaml` 里的 `bt_navigator` |
| 改恢复行为 | `behavior_ext_plugins` | `plugins/back_up_twz_free_action.cpp` |
| 改速度指令到电控的封装 | `cmd_chassis` + `rm_interfaces` | `twist2chassis_cmd.cpp`、`msg/ChassisCmd.msg` |
| 改机器人尺寸 / 传感器外参 | `sentry_description` | `urdf/sentry_description.urdf` |
| 改启动顺序 / 加一个节点 | `sentry_bringup` | `launch/*.py` |
| 改定位就绪的判定条件 | `sentry_bringup` | `scripts/wait_for_localization.py` 的 `ready()` |
| 改地图文件路径 | `sentry_bringup` | `params/nav2_params.yaml`、`launch/relocalization.launch.py` 的 `prior_map` |

> [!WARNING] 文档里提到、磁盘上不存在的 launch 文件
> `sentry_bringup/ReadMe.md` 列了 `bringup.launch.py`、`localization_launch.py`、`navigation_launch.py`、`fastlio_mapping.launch.py`、`sentry_bringup.launch.py` 等名字，但 `launch/` 目录下**没有这些文件**。实际能跑的只有 `mapping.launch.py`、`relocalization.launch.py`、`navigation.launch.py`、`bringup_all_in_one.launch.py`、`bringup_without_relocalization.py`、`octomap_server_intensity.launch.py`、`view_map.py`。以实际文件为准。

---

## 20 · C++ 常用函数逐行拆解：节点骨架与消息收发

*把散落在各章的 rclcpp / QoS / tf2 调用抽出来，集中讲「这个函数到底在干什么」。*

这一章只讲**在本仓库里真实出现、而且反复出现**的函数。所有示例都带真实行号，点「逐行拆解」的行号可以跳到代码里对应位置。读懂这一章，再看任何一个新节点都会是同一套骨架。

### 20.1 一个 ROS 2 节点从生到死，只有三行

**`src/icp_relocalization/src/icp_node.cpp（第 354-360 行）`** · 源码第 **354–360** 行

```cpp startLineNumber=354
int main(int argc, char *argv[])
{
    rclcpp::init(argc, argv);
    rclcpp::spin(std::make_shared<ICPNode>());
    rclcpp::shutdown();
    return 0;
}
```

**逐行拆解**

- **354** — 标准 C++ 入口，命令行参数交给 ROS 初始化。
- **356** — `rclcpp::init`：启动 ROS 2 中间件（DDS）、解析 `--ros-args`。**每个进程只调一次**，且必须在创建任何节点之前。
- **357** — `std::make_shared<ICPNode>()` 构造节点（构造函数里会做参数声明、建发布订阅、建定时器）；`rclcpp::spin` 进入**阻塞的消息循环**，有消息就调对应回调，直到 Ctrl-C。
- **358** — `rclcpp::shutdown()`：只有 `spin` 返回后才执行，负责关闭中间件。本工程 12 个 main 都是这个结构，**没有自己注册 SIGINT 处理函数**。
- **359、360** — 返回 0 表示正常退出。

> [!TIP] 两种消息循环
> 多数节点用阻塞的 `rclcpp::spin(node)`；但 `terrainAnalysis.cpp` 那类 CMU 移植节点用的是 `rclcpp::spin_some(nh)` 配一个手写 `while` 循环（一次只处理已到达的消息，立刻返回继续算）。而门控脚本用的是 Python 的 `rclpy.spin_once(node, timeout_sec=0.1)`。三者是同一个思路的不同写法。

### 20.2 rclcpp 函数速查表

| 函数 / 类 | 白话作用 | 本仓库里的位置 | 最容易踩的坑 |
| --- | --- | --- | --- |
| `rclcpp::init` / `spin` / `shutdown` | 开机 / 进入消息循环 / 关机 | `icp_node.cpp:356-358` | `spin` 会阻塞，后面的代码要等 Ctrl-C |
| `rclcpp::Node("名字")` | 构造一个节点，名字会出现在 `ros2 node list` | `twist2chassis_cmd.cpp:10` | 节点名重复会让监控混乱 |
| `declare_parameter<T>` | **先声明**一个参数及其默认值 | `twist2chassis_cmd.cpp:12`、`terrainAnalysisExt.cpp:230-261` | ROS 2 必须先 declare 再 get，否则抛异常 |
| `get_parameter` / `get_parameter_or` | 读取参数值 | `twist2chassis_cmd.cpp:16`、`transform_publisher.cpp:22-23` | `.as_string()` / `.value` 类型要匹配 |
| `create_publisher<T>(topic, qos)` | 造一个「喇叭」，往话题发消息 | `laserMapping.cpp:438-444` | 句柄必须存成员变量，局部对象析构后就发不出去 |
| `create_subscription<T>(topic, qos, cb)` | 造一个「耳朵」，收到消息就调回调 | `laserMapping.cpp:425-437` | 第二个参数可以是整数队列深度，也可以是 QoS 对象 |
| `create_wall_timer` | 按固定周期执行回调 | `transform_publisher.cpp:34` | 全仓库只有 2 处；FAST-LIO 用的是自由函数版 |
| `rclcpp::create_timer(node, clock, period, cb)` | 自由函数版定时器，要显式传 node 和 clock | `laserMapping.cpp:450,452` | 少传 `this->get_clock()` 会编译不过 |
| `create_service<T>` | 提供一个可被 `ros2 service call` 调用的服务 | `laserMapping.cpp:454`（`/map_save`） | 回调要 `_1, _2` 两个占位符（请求 + 响应） |
| `create_client<T>` / `wait_for_service` / `async_send_request` | 调用别人的服务 | `back_up_twz_free_action.cpp:64,79,90` | 不 `wait_for_service` 请求会落空；异步结果要判超时 |
| `std::bind(&类::方法, this, _1)` | 把成员函数绑成回调 | `laserMapping.cpp:425,429,435` | 漏 `this` 或少 `_1` 编译失败；也可以直接用 lambda |
| `RCLCPP_INFO/WARN/ERROR` / `_THROTTLE` | 打日志 / 限频打日志 | `laserMapping.cpp:468,1061` | 第一参数必须是 `get_logger()`；THROTTLE 第二参数是 `*get_clock()`，单位是毫秒 |
| `this->now()` / `get_clock()->now()` | 取 ROS 时间戳 | `icp_node.cpp:113` | 别用系统时间，否则和 TF / 消息时间不同步 |

### 20.3 一段代码看全「发布 / 订阅 / QoS / TF / 定时器 / 服务」

**`src/FAST_LIO/src/laserMapping.cpp（第 425-454 行）`** · 源码第 **425–454** 行

```cpp startLineNumber=425
    sub_pcl_livox_ = this->create_subscription<livox_ros_driver2::msg::CustomMsg>(lid_topic, 20, std::bind(&LaserMappingNode::livox_pcl_cbk, this, std::placeholders::_1));
}
else
{
    sub_pcl_pc_ = this->create_subscription<sensor_msgs::msg::PointCloud2>(lid_topic, rclcpp::SensorDataQoS(), std::bind(&LaserMappingNode::standard_pcl_cbk, this, std::placeholders::_1));
}
if (locate_in_prior_map)
{
    sub_init_pose_ = this->create_subscription<geometry_msgs::msg::PoseWithCovarianceStamped>(
        "/localization_initial_pose", rclcpp::QoS(1).reliable().transient_local(),
        std::bind(&LaserMappingNode::initial_pose_cbk, this, std::placeholders::_1));
}
sub_imu_ = this->create_subscription<sensor_msgs::msg::Imu>(imu_topic, 10, std::bind(&LaserMappingNode::imu_cbk, this, std::placeholders::_1));
pubLaserCloudFull_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/cloud_registered", 20);
pubLaserCloudFull_body_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/cloud_registered_body", 20);
pubLaserCloudEffect_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/cloud_effected", 20);
pubLaserCloudMap_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/Laser_map", 20);
pubIkdTree_ = this->create_publisher<sensor_msgs::msg::PointCloud2>("/ikd_tree", 20);
pubOdomAftMapped_ = this->create_publisher<nav_msgs::msg::Odometry>("/Odometry", 20);
pubPath_ = this->create_publisher<nav_msgs::msg::Path>("/path", 20);
tf_broadcaster_ = std::make_unique<tf2_ros::TransformBroadcaster>(*this);
tf_buffer_ = std::make_shared<tf2_ros::Buffer>(this->get_clock());
tf_listener_ = std::make_shared<tf2_ros::TransformListener>(*tf_buffer_);

auto period_ms = std::chrono::milliseconds(static_cast<int64_t>(1000.0 / 100.0));
timer_ = rclcpp::create_timer(this, this->get_clock(), period_ms, std::bind(&LaserMappingNode::timer_callback, this));
auto map_period_ms = std::chrono::milliseconds(static_cast<int64_t>(1000.0));
map_pub_timer_ = rclcpp::create_timer(this, this->get_clock(), map_period_ms, std::bind(&LaserMappingNode::map_publish_callback, this));

map_save_srv_ = this->create_service<std_srvs::srv::Trigger>("map_save", std::bind(&LaserMappingNode::map_save_callback, this, std::placeholders::_1, std::placeholders::_2));
```

> 这段是整个系统最密集的一段「接线代码」。读任何新节点时，先找 4 类东西：订阅了什么、发布了什么、用了什么 QoS、有没有定时器/服务，节点的职责基本就清楚了。

**逐行拆解**

- **425–429** — 按雷达格式二选一订阅：`CustomMsg`（Livox 私有格式，队列深度 20）或标准 `PointCloud2`（用 `SensorDataQoS()`）。注意同一个 `lid_topic`，由参数决定走哪条分支。
- **431–436** — **只有在先验地图定位模式下**才订阅 `/localization_initial_pose`，并且用 `QoS(1).reliable().transient_local()`：只留最新一条、必须送达、晚连上也能补收到。这正是「初始位姿只发一次」场景的标准配置。
- **437** — 订阅 IMU，队列深度 10（整数写法，等价于 `rclcpp::QoS(10)`）。
- **438–444** — 7 个发布者：注册点云、body 系点云、有效点、累计地图、ikd-Tree 可视化、里程计、轨迹。**`/Odometry` 在 launch 里被 remap 成 `/state_estimation`**。
- **445–447** — TF 三件套：广播器（发变换）、Buffer（缓存变换）、Listener（自动收 `/tf`）。Buffer 必须喂 `get_clock()`，Listener 要传 `*tf_buffer_`（解引用）。三者都是成员变量。
- **449、450** — 100 Hz 主循环定时器：`1000.0/100.0 = 10` 毫秒。`std::chrono::milliseconds` 要整数，所以 `static_cast<int64_t>`。
- **451、452** — 1 Hz 的地图发布定时器，和主循环分开，避免每帧都发整张地图。
- **454** — `/map_save` 服务：`std_srvs/srv/Trigger`，建完图用 `ros2 service call /map_save std_srvs/srv/Trigger` 触发保存 PCD。服务回调需要 `_1`（请求）和 `_2`（响应）两个占位符。

### 20.4 QoS：为什么同一个工程里有两种写法

**`src/icp_relocalization/src/transform_publisher.cpp（第 24-34 行）`** · 源码第 **24–34** 行

```cpp startLineNumber=24
subscription_ = this->create_subscription<geometry_msgs::msg::PoseWithCovarianceStamped>(
    "icp_result", rclcpp::QoS(1).reliable().transient_local(),
    [this](geometry_msgs::msg::PoseWithCovarianceStamped::SharedPtr msg) {
        if (!published_ && msg->header.frame_id == map_frame_id) pending_ = msg;
    });
initial_pose_ = this->create_publisher<geometry_msgs::msg::PoseWithCovarianceStamped>(
    "localization_initial_pose", rclcpp::QoS(1).reliable().transient_local());
buffer_ = std::make_unique<tf2_ros::Buffer>(get_clock());
listener_ = std::make_unique<tf2_ros::TransformListener>(*buffer_);
broadcaster_ = std::make_shared<tf2_ros::StaticTransformBroadcaster>(this);
timer_ = this->create_wall_timer(std::chrono::milliseconds(100), [this]() { publish_result(); });
```

**逐行拆解**

- **24、25** — 订阅 `/icp_result`。`QoS(1).reliable().transient_local()` = 队列只留 1 条 + 必须送达 + 为「晚连上的订阅者」保留最后一条。
- **26–28** — 这里用 **lambda** 而不是 `std::bind`，效果一样：收到消息先存进 `pending_`，并且只处理一次（`!published_`）。回调签名 `::SharedPtr` 必须和订阅类型一致。
- **29、30** — 发布 `/localization_initial_pose`，用**完全相同**的 QoS。发布端与订阅端 QoS 不兼容会直接收不到消息，这是最隐蔽的调试坑。
- **31、32** — Buffer + Listener 用来查 `map → odom` 相关的外参。
- **33** — `StaticTransformBroadcaster`：静态变换发一次就够（latched），和每帧变化的 `TransformBroadcaster` 不要混用。
- **34** — 100 ms 定时器反复尝试发布，直到 `pending_` 有值且只发一次——这是「等一次性结果」的常见写法。

| 写法 | 内部语义 | 本工程用在哪 | 为什么 |
| --- | --- | --- | --- |
| `rclcpp::SensorDataQoS()` | best_effort（允许丢包）+ keep_last | 雷达点云、IMU、`/state_estimation` | 传感器数据高频、旧帧没价值，丢一两帧无所谓 |
| `rclcpp::QoS(1).reliable().transient_local()` | reliable（必须送达）+ 保留最后一条 | `/icp_result`、`/localization_initial_pose` | 一次性结果，晚启动的节点也必须能收到 |
| `rclcpp::QoS(20)` 或整数 `20` | reliable + 队列 20 | `/cloud_registered`、`/Laser_map` 等 | 默认够用，允许短时积压 |
| `rclcpp::QoS(rclcpp::KeepLast(1)).transient_local().reliable()` | 同上，显式构造 | `voxel_layer.cpp:54` | Nav2 插件风格，和 `QoS(1)` 等价 |

> [!WARNING] QoS 不兼容 = 静默失联
> `reliable` 的发布者可以配 `best_effort` 的订阅者，但**反过来不行**。用 `ros2 topic info /话题 --verbose` 查两端的 Reliability / Durability，比反复看代码快得多。

### 20.5 tf2：查一次变换的完整套路

**`src/cmd_chassis/src/twist_transformer.cpp（第 24-33 行）`** · 源码第 **24–33** 行

```cpp startLineNumber=24
geometry_msgs::msg::TransformStamped transformStamped;
try
{
    transformStamped = tfBuffer.lookupTransform(chassis_frame_, "yaw_link", tf2::TimePointZero);
}
catch (tf2::TransformException &ex)
{
    RCLCPP_WARN(this->get_logger(), "%s", ex.what());
    return;
}
```

**逐行拆解**

- **24** — 准备一个 `TransformStamped`（带时间戳的变换）容器。
- **25–28** — `lookupTransform(目标系, 源系, 时间)`：参数顺序是 **target 在前、source 在后**，写反拿到的是逆变换。`tf2::TimePointZero` 表示「取最新可用的一条」。
- **29–33** — **必须 try/catch**：TF 树可能还没建好、外参还没广播，此时会抛 `tf2::TransformException`。这里打警告后直接 `return`，这一帧速度就不转发了。

| tf2 函数 / 类 | 白话作用 | 位置 | 坑 |
| --- | --- | --- | --- |
| `tf2_ros::Buffer(get_clock())` | 存所有坐标变换的缓存本 | `laserMapping.cpp:446` | 不喂 clock 时间戳会错 |
| `tf2_ros::TransformListener(*buffer)` | 自动订阅 `/tf`、`/tf_static` 填缓存 | `laserMapping.cpp:447` | 传的是解引用后的 `*buffer` |
| `lookupTransform(target, source, t)` | 查两个坐标系之间的变换 | `twist_transformer.cpp:27`、`transform_publisher.cpp:59` | 顺序是 target→source；要 catch 异常 |
| `can_transform(...)` | 只判断能不能查到，不取值 | `wait_for_localization.py:39` | Python 侧门控用它 |
| `tf2_ros::TransformBroadcaster` | 广播每帧变化的变换（odom） | `laserMapping.cpp:445` | 和静态版别混 |
| `tf2_ros::StaticTransformBroadcaster` | 广播不变的外参（latched） | `transform_publisher.cpp:33` | 发一次即可 |
| `tf2::Quaternion` + `Matrix3x3::getRPY` | 四元数 → 滚转/俯仰/偏航 | `twist_transformer.cpp:35-42` | 构造顺序是 `(x,y,z,w)`；getRPY 是输出引用 |
| `tf2::fromMsg` | ROS 消息 → tf2 对象 | `transform_publisher.cpp:43,61` | 和 `toMsg` 方向别搞反 |

### 20.6 纠偏：这些「常见函数」在本仓库其实没有出现

网上抄 ROS 2 教程时很容易把这些名字带进来。实际全仓库 grep 是 0 命中，讲错了会误导排查方向。

| 你以为有 | 实际情况 |
| --- | --- |
| `pcl::GeneralizedIterativeClosestPoint` | 类名 `SACIAGICPNode` 容易骗人：`sac_ia_gicp.cpp` 只 include 了 `gicp.h`，真正用的是普通 `pcl::IterativeClosestPoint` |
| `BT::TreeNode` / `tick()` / `getInput` / Blackboard | 本仓库**没有自研行为树插件**。行为树是 Nav2 自带的 XML，配置在 `behavior_tree/*.xml` |
| `Sophus::SO3` | FAST-LIO 用的是 IKFoM 的 `MTK::SO3`（`use-ikfom.hpp:7`），不依赖 Sophus |
| `kf_state.update(...)` | 实际是 `kf.update_iterated_dyn_share_modified(...)`（`laserMapping.cpp:1179`） |
| `ikdForest` / `Delete_Point` | 只有一个 `KD_TREE` 实例；删除用的是 `Delete_Point_Boxes`（按盒子批量删） |
| `signal(SIGINT, ...)` | 12 个 main 统一用 `rclcpp::shutdown()`；只有 Livox-SDK2 的 samples 示例里才有 SIGINT |
| `doTransform` / `rclcpp::PublisherOptions` | 0 命中；tf2 只用 `lookupTransform` + `fromMsg` |
| `std::sort` 求分位数 | `terrainAnalysisExt.cpp` 里是手写下标 `int(quantileZ * size)`，`pathNorm.cpp` 的 `std::sort` 被注释掉了 |

### 20.7 一句话把函数串成主链路

1. **`rclcpp::init` → `Node` 构造函数**：`declare_parameter` 读 yaml → `create_subscription(SensorDataQoS)` 收雷达/IMU → 建好发布者与 TF 三件套。
2. **回调里：`pcl::fromROSMsg`**：ROS 点云字节流翻译成 PCL 点云，再做体素下采样。
3. **主循环定时器里：`ikdtree.Nearest_Search` + IEKF**：找地图中的邻近平面点算残差 → `update_iterated_dyn_share_modified` 更新位姿 → `get_x()` 取结果。
4. **`pcl::toROSMsg` + `publish` → `sendTransform`**：发布 `/cloud_registered`、`/Odometry`（remap 成 `/state_estimation`），并广播 odom → base_link。
5. **Nav2 插件：`PointCloud2ConstIterator` + `updateCosts`**：按 intensity 过滤 `/terrain_map`，把障碍写进代价地图，规划器再算 `/cmd_vel`。
6. **终端：`rclcpp::shutdown()`**：Ctrl-C 时 spin 返回，收尾退出。

---

## 21 · launch 与 Python 常用函数逐行拆解

*不改一行 C++，只靠 launch 就能换话题名、换参数、改启动顺序。这一章讲清每个函数。*

`launch` 文件是 Python 脚本，但**不是普通脚本**：它不直接启动进程，而是构造一棵「动作描述树」，由 `ros2 launch` 解释执行。所以很多对象（如 `LaunchConfiguration`）在写的时候还没有值，要到运行期才能 `.perform(context)` 求值——这是新手最不适应的一点。

### 21.1 最小骨架与那个著名的 8 秒延时

**`src/sentry_bringup/launch/mapping.launch.py（第 65-82 行）`** · 源码第 **65–82** 行

```py startLineNumber=65
delayed_start_mapping = TimerAction(
  period=8.0,
  actions=[
    fast_lio_node,
    start_octomap_server
  ]
)

ld = LaunchDescription()

ld.add_action(twist2chassis_cmd_node)
ld.add_action(twist_transformer_node)
ld.add_action(sentry_description)
ld.add_action(mid360_node)
ld.add_action(start_rviz)
ld.add_action(delayed_start_mapping)

return ld
```

**逐行拆解**

- **65–71** — `TimerAction(period=8.0, actions=[...])`：**8 秒后**才启动 FAST-LIO 和 OctoMap。因为雷达驱动和 `robot_state_publisher` 需要时间把点云话题与 TF 树建起来，FAST-LIO 一上来就要有 `/livox/lidar` 和 `lidar_link → imu_link`。
- **68、69** — 注意 `actions` 里放的是**前面已经构造好的 Node / IncludeLaunchDescription 对象**，不是字符串。同一对象只能被一个动作持有。
- **73** — `LaunchDescription()` 是最终要返回的「动作清单」，所有动作都必须挂到它上面。
- **75–79** — 立即启动的 5 个：两个底盘节点、URDF/静态 TF、雷达驱动、RViz。
- **80** — 把延时动作挂上去。
- **82** — **必须有 `return ld`**，且函数名必须是 `generate_launch_description`，否则 `ros2 launch` 报「no launch description」。

> [!WARNING] 固定 8 秒不等于「等就绪」
> `TimerAction` 是纯计时器，不检测话题是否真的有数据。慢机器 / 雷达晚启动时会失效。`bringup_without_relocalization.py` 里还有 10 秒版本；真正靠谱的是一键入口的 `OnProcessExit` + `wait_for_localization.py` 事件门控（见 21.5）。

### 21.2 launch 函数速查表

| 函数 / 类 | 白话作用 | 真实位置 | 最容易踩的坑 |
| --- | --- | --- | --- |
| `generate_launch_description()` | `ros2 launch` 唯一识别的入口函数 | `mapping.launch.py:10` | 改名/不 return 直接报找不到 launch description |
| `LaunchDescription()` + `add_action` | 装所有动作的清单 | `mapping.launch.py:73-80` | 只创建对象不 add_action，启动后什么也不干 |
| `Node(package, executable, ...)` | 声明要运行的一个节点 | `mapping.launch.py:41` | `package` 是包名、`executable` 是 CMake 目标名，常写反 |
| `DeclareLaunchArgument` | 声明命令行 `x:=y` 能覆盖的参数 | `navigation.launch.py:86`、`bringup_all_in_one.launch.py:56-61` | 只声明不配 `LaunchConfiguration` 等于没用 |
| `LaunchConfiguration('x')` | 运行期取参数值的替换对象 | `relocalization.launch.py:13-15` | 不是字符串，不能直接 `==`；要 `.perform(context)` |
| `OpaqueFunction(function=...)` | 启动期执行任意 Python 代码 | `relocalization.launch.py:144` | 回调签名 `(context)`，读值必须 `.perform()` |
| `TimerAction(period, actions)` | 延时若干秒再执行一组动作 | `mapping.launch.py:65` | 固定延时不检测就绪 |
| `IncludeLaunchDescription` | 嵌套另一个 launch 文件 | `mapping.launch.py:27,33,51` | 参数不会自动透传，要 `launch_arguments={...}.items()` |
| `PythonLaunchDescriptionSource` | 指向 `.py` 格式的 launch 源 | `mapping.launch.py:28,34,52` | 路径拼错在导入期不报错 |
| `FrontendLaunchDescriptionSource` | 指向老式 XML `.launch` | `navigation.launch.py:280` | CMU 上游包只有 XML，不能换成 Python 版 |
| `SetEnvironmentVariable` | 给子进程设环境变量 | `navigation.launch.py:83` | 必须 `ld.add_action` 才生效 |
| `RegisterEventHandler` + `OnProcessExit` | 某进程退出时触发回调 | `bringup_all_in_one.launch.py:62` | `target_action` 必须引用同一个对象；`on_exit` 返回动作列表 |
| `EmitEvent` / `Shutdown` | 主动发事件 / 关掉整个 launch | `bringup_all_in_one.launch.py:53` | `Shutdown` 在 `launch.events`，不在 `launch.actions` |
| `get_logger('包名')` | launch 侧打日志 | `bringup_all_in_one.launch.py:52` | 和节点内的 `self.get_logger()` 不是一回事 |
| `GroupAction` | 把一组动作打包、整体加条件 | `navigation.launch.py:121` | 条件写在 Group 上，内部节点别重复写 |
| `IfCondition` / `LaunchConfigurationEquals` / `PythonExpression` | 三种条件：判真 / 判等 / 表达式 | `FAST_LIO/launch/mapping.launch.py:57`、`relocalization.launch.py:64`、`navigation.launch.py:122` | 字符串 `"false"` 对 `IfCondition` 也是真；`PythonExpression` 参数必须是列表 |
| `ParameterFile(..., allow_substs=True)` | 把 YAML 当节点参数文件传入 | `navigation.launch.py:72,81` | 不加 `allow_substs=True` 替换不会被求值 |
| `RewrittenYaml` | 改写 YAML 生成临时参数文件 | `navigation.launch.py:73` | `root_key` 用错会让多机参数串台 |
| `ReplaceString` | 替换 YAML 里硬编码的绝对路径 | `navigation.launch.py:74` | **仅当 `params_file` 为默认值时生效**（`:77`） |
| `ParameterValue(x, value_type=float)` | 强制替换值的类型 | `bringup_all_in_one.launch.py:42-43`、`sac_ia_gicp.launch.py:15` | 不加会把 `"false"` 当字符串，参数类型不匹配直接崩 |
| `FindPackageShare` / `get_package_share_directory` | 查包安装后的 share 路径 | `view_model.launch.py:13`、`navigation.launch.py:34` | 传的是 package.xml 的 name，`fast_lio` ≠ 目录 `FAST_LIO` |
| `LoadComposableNodes` / `ComposableNode` | 组合模式加载 Nav2 节点 | `navigation.launch.py:216,220` | 要 `target_container` 已存在、`plugin` 写全限定类名 |

### 21.3 LaunchConfiguration + OpaqueFunction：启动期防呆逐行

**`src/sentry_bringup/launch/relocalization.launch.py（第 12-18 行）`** · 源码第 **12–18** 行

```py startLineNumber=12
def validate_icp_input(context):
  method = LaunchConfiguration('icp_method').perform(context)
  input_type = LaunchConfiguration('icp_input_type').perform(context)
  topic = LaunchConfiguration('icp_pointcloud_topic').perform(context).strip('/')
  if (method == 'sac_ia_gicp' or input_type == 'pointcloud2') and topic.split('/')[-1] in {
      'cloud_registered', 'cloud_registered_body', 'cloud_effected', 'Laser_map'}:
    raise RuntimeError('ICP startup requires an independent PointCloud2 scan, not a FAST-LIO output')
```

> 这是一段很值得学习的「防呆」代码：把配置错误挡在启动阶段，而不是等到实车跑飞了再排查。

**逐行拆解**

- **12** — 这是 `OpaqueFunction` 的回调，参数是 `context`（启动上下文）。它会在 launch 被解释时执行，可以写任意 Python。
- **13–15** — `LaunchConfiguration('名字')` 拿到的是**替换对象**，必须 `.perform(context)` 才能变成真正的字符串。`.strip('/')` 去掉前导斜杠便于比较。
- **16、17** — 如果选了 SAC-IA+GICP 或 PointCloud2 输入，却把点云话题指到 FAST-LIO 的**输出**（`cloud_registered` / `Laser_map` 等），说明用户把「独立原始扫描」和「已配准地图」搞混了。
- **18** — 直接 `raise RuntimeError` 让 `ros2 launch` 立刻失败并打印原因，比让 ICP 默默算出错误位姿安全得多。

### 21.4 三层参数改写逐行：ReplaceString → RewrittenYaml → ParameterFile

**`src/sentry_bringup/launch/navigation.launch.py（第 68-81 行）`** · 源码第 **68–81** 行

```py startLineNumber=68
param_substitutions = {
    'use_sim_time': use_sim_time,
    'autostart': autostart}

configured_params = ParameterFile(
    RewrittenYaml(
        source_file=ReplaceString(
            source_file=params_file,
            replacements={'/home/sentry_ws/src/sentry_bringup': bringup_dir},
            condition=LaunchConfigurationEquals('params_file', default_params)),
        root_key=namespace,
        param_rewrites=param_substitutions,
        convert_types=True),
    allow_substs=True)
```

**逐行拆解**

- **68–70** — 准备要覆盖的参数：`use_sim_time`、`autostart` 来自命令行启动参数。
- **74–77** — **第一层 `ReplaceString`**：`nav2_params.yaml` 里硬编码了 `/home/sentry_ws/src/sentry_bringup`（行为树 XML、地图 YAML 的路径），换成本机实际的 `bringup_dir`。`condition=` 保证**只有用默认 params_file 时才替换**。
- **73–80** — **第二层 `RewrittenYaml`**：`root_key=namespace` 给所有节点段套命名空间，`param_rewrites` 覆盖参数，`convert_types=True` 把字符串转成 bool/int 等正确类型。
- **72–81** — **第三层 `ParameterFile(allow_substs=True)`**：把前两层的结果做成一个临时 YAML 文件路径，之后作为 `parameters=[configured_params]` 传给 9 个 Nav2 节点。

> [!WARNING] 自定义 params_file 会让路径替换失效
> 一旦用 `params_file:=xxx.yaml` 传了自定义配置，第 77 行的 `LaunchConfigurationEquals` 条件不成立，硬编码的 `/home/sentry_ws/...` 就不会被替换，Nav2 会找不到行为树 XML 或地图文件。这时必须自己把自定义 YAML 里的三个绝对路径改对。

### 21.5 事件门控逐行：OnProcessExit 怎么决定要不要启动 Nav2

**`src/sentry_bringup/launch/bringup_all_in_one.launch.py（第 39-65 行）`** · 源码第 **39–65** 行

```py startLineNumber=39
gate = Node(
    package='sentry_bringup',
    executable='wait_for_localization.py',
    parameters=[{'timeout': ParameterValue(
        LaunchConfiguration('localization_timeout'), value_type=float)}],
    output='screen',
)

def after_gate(event, context):
    if context.is_shutdown:
        return []
    if event.returncode == 0:
        return [start_navigation]
    get_logger('sentry_bringup').error('Localization did not become ready; Nav2 will not start.')
    return [EmitEvent(event=Shutdown(reason='Localization gate failed'))]

return LaunchDescription([
    DeclareLaunchArgument('localization_timeout', default_value='90.0'),
    # Declare these before the gate so they are visible in --show-args.
    DeclareLaunchArgument('use_rviz', default_value='true'),
    DeclareLaunchArgument('use_livox_driver', default_value='true'),
    DeclareLaunchArgument('prior_map', default_value=os.path.join(share, 'maps', 'GlobalMap.pcd')),
    DeclareLaunchArgument('params_file', default_value=os.path.join(share, 'params', 'nav2_params.yaml')),
    RegisterEventHandler(OnProcessExit(target_action=gate, on_exit=after_gate)),
    start_relocalization,
    gate,
])
```

**逐行拆解**

- **39–45** — `gate` 是一个普通的 Python 节点（门控脚本），和重定位同时启动；`ParameterValue(..., value_type=float)` 把命令行的 `"90.0"` 明确转成浮点数，否则参数类型不匹配。
- **47–53** — `after_gate` 是 `OnProcessExit` 的回调：`event.returncode == 0` 表示门控脚本判定定位就绪，返回 `[start_navigation]` 动作列表；否则打日志并 `EmitEvent(Shutdown(...))` 关掉整个 launch。
- **50、51** — **关键设计**：不是「定时等一会儿」，而是「等一个进程明确告诉我 OK」，返回值就是新的动作。
- **55–61** — 4 个 `DeclareLaunchArgument`，让用户能用 `localization_timeout:=120` 等形式覆盖。
- **62** — `RegisterEventHandler(OnProcessExit(target_action=gate, on_exit=after_gate))`：把「gate 退出」这个事件绑到回调上。`target_action` 必须引用第 39 行同一个对象。
- **63、64** — 先启动重定位，再启动门控脚本，两者并行；Nav2 **不在初始清单里**，只由回调动态加进来。

**`src/sentry_bringup/scripts/wait_for_localization.py（第 23-40 行）`** · 源码第 **23–40** 行

```py startLineNumber=23
    self.subscribe_odom = self.create_subscription(
        Odometry, '/state_estimation', self.on_odometry, qos_profile_sensor_data)

def on_odometry(self, msg):
    if msg.header.frame_id != 'odom' or msg.child_frame_id != 'base_link':
        return
    stamp = Time.from_msg(msg.header.stamp)
    if self.latest is not None and stamp <= self.latest:
        return
    self.previous_stamp = self.latest
    self.latest = stamp
    self.received_at = time.monotonic()

def ready(self):
    return (
        self.previous_stamp is not None and time.monotonic() - self.received_at < 1.0
        and self.buffer.can_transform('map', 'chassis_link', self.latest)
    )
```

**逐行拆解**

- **23、24** — 订阅 `/state_estimation`，QoS 用 `qos_profile_sensor_data`（和 FAST-LIO 发布端兼容）。句柄存成成员变量。
- **27、28** — 先校验坐标系：`frame_id` 必须是 `odom`、`child_frame_id` 必须是 `base_link`，否则这一帧不算数。
- **29–31** — `Time.from_msg` 把消息时间戳转成 rclpy 的 Time；时间戳不前进（重复或乱序）就丢弃。
- **32–34** — `previous_stamp` 非空等价于「至少收到过 2 帧递增的里程计」；`time.monotonic()` 记录本机收到时间（单调时钟不受 NTP 校时跳变影响）。
- **36–40** — `ready()` 三个条件同时满足：至少 2 帧、最近 1 秒内有新数据、TF 能查到 `map → chassis_link`。第三个条件确保 ICP 已经把 `map → odom` 发出去了。

1. **`rclpy.init()` + `LocalizationGate()`**：建节点和订阅者。
2. **`while rclpy.ok() and time.monotonic() < deadline`**：最多等 `timeout`（默认 90 秒），期间反复轮询。
3. **`rclpy.spin_once(node, timeout_sec=0.1)`**：每次只处理 0.1 秒内到达的消息，不阻塞主循环。
4. **`node.ready()` 为真 → `return 0`**：`main()` 返回 0 → `raise SystemExit(main())` 让进程退出码为 0。
5. **退出码 0 → `after_gate` 返回 `[start_navigation]`**：Nav2 这才被启动；超时或失败则退出码 1 → `Shutdown`。

### 21.6 rclpy / 标准库常用函数

| 函数 | 白话作用 | 位置 | 坑 |
| --- | --- | --- | --- |
| `rclpy.init()` / `try_shutdown()` | 初始化 / 收尾 | `wait_for_localization.py:44,59` | 要放在 `try/finally` 里保证收尾 |
| `Node('名字')` + `super().__init__` | 构造 Python 节点 | `wait_for_localization.py:14-16` | Python 侧类名和节点名分开 |
| `declare_parameter(...).value` | 声明并读取参数（返回 Parameter 对象，取 `.value`） | `wait_for_localization.py:17` | 和 C++ 的 `get_parameter` 返回值不同 |
| `create_subscription(类型, 话题, 回调, qos)` | 订阅话题 | `wait_for_localization.py:23` | 参数顺序和 C++ 不一样，QoS 放第 4 位 |
| `spin_once(node, timeout_sec=0.1)` | 处理一次就返回 | `wait_for_localization.py:49` | 别用阻塞的 `spin()`，否则手写循环跑不动 |
| `Buffer()` / `TransformListener(buffer, node)` | TF 缓存与监听 | `wait_for_localization.py:18-19` | Python 侧 Buffer 不用传 clock |
| `can_transform('map','chassis_link',t)` | 判断 TF 链是否完整 | `wait_for_localization.py:39` | 只判断存在，不返回变换值 |
| `Time.from_msg(msg.header.stamp)` | 消息时间戳 → rclpy Time | `wait_for_localization.py:29` | 直接比较 `msg.header.stamp` 会类型不匹配 |
| `time.monotonic()` | 单调时钟，算超时和新鲜度 | `wait_for_localization.py:34,38,46` | 不要用 `time.time()`，NTP 校时会让时间跳变 |
| `get_logger().info/error` | 打日志 | `wait_for_localization.py:51,53` | 和 launch 侧的 `get_logger('包名')` 不同 |
| `destroy_node()` | 销毁节点 | `wait_for_localization.py:58` | 放 `finally` 里 |
| `os.path.join` / `get_package_share_directory` | 拼安装目录路径 | 所有 launch 文件 | 源码目录 ≠ 安装目录，改了源码要重新 `colcon build` |

> [!TIP] 本工程没用到的常见 launch/Python 函数
> `ExecuteProcess`、`LogInfo`、`SetParameter`、`SetRemap`、`TextSubstitution`、`EnvironmentVariable`、`argparse`、`yaml.safe_load`、`subprocess`、`create_node` 全仓库 0 命中；`PathJoinSubstitution` / `PushRosNamespace` 只是 import 了没调用。别照着通用教程往里加。

---

## 22 · 算法与数学库函数逐行：PCL / Eigen / ikd-Tree / ICP / IEKF

*前面讲的是「搬运数据的函数」，这一章讲「真正算东西的函数」。*

点云、姿态、地图匹配都是数学运算。这一章把主链路上高频出现的库函数按「消息翻译 → 降采样 → 特征提取 → 状态估计 → 配准」的顺序讲一遍，每个都配真实源码和逐行拆解。

### 22.1 函数速查表

| 类别 | 函数 / 类 | 白话作用 | 位置 | 坑 |
| --- | --- | --- | --- | --- |
| 消息翻译 | `pcl::fromROSMsg` / `toROSMsg` | ROS PointCloud2 ↔ PCL 点云 | `terrainAnalysisExt.cpp:141`、`laserMapping.cpp:878` | 目标是解引用后的 `*cloud`，传指针会报错 |
| 消息翻译 | `sensor_msgs::PointCloud2ConstIterator<float>` | 不转 PCL，按字段名直接逐点读 | `obstacle_layer.cpp:415-418` | 模板类型必须和字段真实类型一致 |
| 降采样 | `pcl::VoxelGrid` + `setInputCloud` + `setLeafSize` + `filter` | 把空间切成小立方体，每格只留一个点 | `terrainAnalysisExt.cpp:303,420`、`icp_node.cpp:128-130` | 必须先 `setInputCloud`；`filter` 是覆盖式写入 |
| 点搬运 | `pcl::transformPointCloud` | 用 4×4 矩阵整体搬动点云 | `icp_node.cpp:176` | 输入输出可以是同一对象（原地变换） |
| 点搬运 | `pcl_ros::transformPointCloud` | 带 TF 的版本 | `laserMapping.cpp:1118` | 命名空间是 `pcl_ros` 不是 `pcl` |
| 字段读写 | `point.x/y/z/intensity/curvature` | 逐点读写字段 | `preprocess.cpp:219-232` | `curvature` 被借来存时间戳 |
| 文件 IO | `pcl::io::loadPCDFile` / `savePCDFileASCII` | 读 / 存 PCD 先验地图 | `laserMapping.cpp:460`、`PCDSaverNode.cpp:28` | 返回值 `< 0` 才是失败；还要检查 `empty()` |
| 配准 | `pcl::IterativeClosestPoint` + `setInputSource/Target` + `align` | 把当前扫描对齐到地图 | `icp_node.cpp:134-143` | Source 是要被搬动的当前帧，设反结果全错 |
| 配准 | `getFitnessScore()` / `hasConverged()` / `getFinalTransformation()` | 评估配准质量 / 取 4×4 变换 | `icp_node.cpp:146-159` | fitness 越小越好，但密度不同时绝对值不可比 |
| 粗配准 | `pcl::SampleConsensusInitialAlignment` + `FPFHEstimationOMP` | SAC-IA 给 ICP 一个好初值 | `sac_ia_gicp.cpp:147-163,282-299` | 必须额外 `setSourceFeatures`/`setTargetFeatures` |
| 地图结构 | `KD_TREE<PointType>::Build` / `Nearest_Search` / `Add_Points` / `Delete_Point_Boxes` | 增量 k-d 树：建图、找近邻、插点、按盒子删点 | `laserMapping.cpp:196,856,639,1127` | `Nearest_Search` 返回的是**平方距离** |
| 状态估计 | `esekfom::esekf<state_ikfom,12,input_ikfom>` + `predict` | IMU 推一步（迭代误差状态卡尔曼滤波） | `laserMapping.cpp:145`、`IMU_Processing.hpp:278` | 本仓库没有 `update()` |
| 状态估计 | `update_iterated_dyn_share_modified` / `get_x()` | 用点云残差迭代更新 / 取状态 | `laserMapping.cpp:1179-1180` | `get_x()` 返回拷贝，写回要用 `change_x()` |
| 数学 | `Eigen::Matrix4f::block<3,3>(0,0)` | 从 4×4 变换里取旋转块 | `icp_node.cpp:167` | 块尺寸是编译期模板参数，起点是运行期参数 |
| 数学 | `std::atan2` / `hypot` / 手写 quantile | 求角度 / 距离 / 分位数高程 | `back_up_twz_free_action.cpp:232,288`、`terrainAnalysisExt.cpp:495` | `atan2(y,x)` 返回弧度，转角度要 `*57.3` |
| 四元数 | `tf2::Quaternion` / `Matrix3x3::getRPY` | 四元数 ↔ RPY | `terrainAnalysis.cpp:127-129` | 构造顺序 `(x,y,z,w)` |

### 22.2 消息翻译 + 降采样逐行

**`src/autonomous_exploration_development_environment/src/terrain_analysis_ext/src/terrainAnalysisExt.cpp（第 140-146 行）`** · 源码第 **140–146** 行

```cpp startLineNumber=140
laserCloud->clear();
pcl::fromROSMsg(*laserCloud2, *laserCloud);

pcl::PointXYZI point;
laserCloudCrop->clear();
int laserCloudSize = laserCloud->points.size();
for (int i = 0; i < laserCloudSize; i++)
```

**逐行拆解**

- **140** — 先清空目标点云，避免上一帧数据残留。
- **141** — `pcl::fromROSMsg(*laserCloud2, *laserCloud)`：把 ROS 的 `PointCloud2`（本质是带字段描述的字节流）翻译成 PCL 的强类型点云。**两个参数都是解引用后的对象**。
- **143** — 准备一个 `PointXYZI` 临时点（x/y/z + intensity）。
- **144–146** — 清空裁剪结果容器，然后遍历刚翻译出来的所有点，逐点做距离/高度判断。

**`src/icp_relocalization/src/icp_node.cpp（第 128-131 行）`** · 源码第 **128–131** 行

```cpp startLineNumber=128
sor_scan.setInputCloud(input_cloud);
sor_scan.setLeafSize(cloud_voxel_leaf_size, cloud_voxel_leaf_size, cloud_voxel_leaf_size);
sor_scan.filter(*input_cloud);
RCLCPP_INFO(this->get_logger(), "Downsampled input cloud to %d data points", input_cloud->width * input_cloud->height);
```

**逐行拆解**

- **128** — `setInputCloud`：告诉体素滤波器要处理哪份点云。
- **129** — `setLeafSize(a,a,a)`：把空间切成边长 `a` 米的小立方体，每格只保留一个代表点。值越大，点越少、越快、越粗糙。
- **130** — `filter(*input_cloud)`：**输出覆盖写回同一个对象**（原地降采样），不是生成新副本。
- **131** — 打日志输出剩余点数；PCL 点云的 `width * height` 就是点总数。

> [!TIP] 为什么到处都要降采样
> MID360 一帧可能有几万个点，逐点做最近邻/配准太慢。体素滤波把点数压到几千，既保留几何形状又省算力。建图、地形分析、ICP 三处各降一次，参数分别是 `scanVoxelSize`、`cloud_voxel_leaf_size` 等，可在各自的 yaml 里调。

### 22.3 不转 PCL，按字段名直接遍历：PointCloud2ConstIterator 逐行

**`src/nav2_plugins/costmap_intensity/plugins/obstacle_layer.cpp（第 415-433 行）`** · 源码第 **415–433** 行

```cpp startLineNumber=415
sensor_msgs::PointCloud2ConstIterator<float> iter_x(cloud, "x");
sensor_msgs::PointCloud2ConstIterator<float> iter_y(cloud, "y");
sensor_msgs::PointCloud2ConstIterator<float> iter_z(cloud, "z");
sensor_msgs::PointCloud2ConstIterator<float> iter_intensity(cloud, "intensity");

for (; iter_x != iter_x.end(); ++iter_x, ++iter_y, ++iter_z,++iter_intensity) {
  double px = *iter_x, py = *iter_y, pz = *iter_z, pintensity = *iter_intensity;

  // if the obstacle is too low, we won't add it
  if (pintensity < min_obstacle_intensity_) {
    RCLCPP_DEBUG(logger_, "The point's intensity is too low");
    continue;
  }

  // if the obstacle is too high or too far away from the robot we won't add it
  if (pintensity > max_obstacle_intensity_) {
    RCLCPP_DEBUG(logger_, "The point's intensity is too high");
    continue;
  }
```

**逐行拆解**

- **415–418** — 为 4 个字段各建一个迭代器，模板参数 `<float>` 必须和字段在 `PointCloud2` 里的真实类型一致（`float32`）。这样不必把整帧点云转成 PCL 就能逐点读。
- **420** — 4 个迭代器**必须同步 `++`**，漏一个就会整体错位，读出来的 x/y/z 不属于同一个点。
- **421** — 解引用取出当前点的 4 个值。这里 `pintensity` 不是反射率，而是 `terrainAnalysis` 写进去的**离地高度 `disZ`**。
- **424–427** — 低于 `min_obstacle_intensity_`（yaml 默认 0.3）说明贴着地面，不当障碍，跳过。
- **430–433** — 高于 `max_obstacle_intensity_`（默认 2.0）说明太高或太远，也跳过。这就是「只把 0.3~2.0 米高度的地面凸起当障碍」的实现。

> [!CAUTION] voxel_layer.cpp 里有一个真实的类型错配
> `costmap_intensity/plugins/voxel_layer.cpp:151` 用 `PointCloud2ConstIterator<uint8_t>` 去读 `intensity`，但 `/terrain_map` 的 intensity 是 `float32`；而且它没有 `min_obstacle_intensity` 下限判断。如果 yaml 把插件从 `ObstacleLayerIntensity` 换成 `VoxelLayerIntensity`，过滤行为会完全不同。

### 22.4 ICP 配准逐行：开机时怎么算出「我在哪」

**`src/icp_relocalization/src/icp_node.cpp（第 133-165 行）`** · 源码第 **133–165** 行

```cpp startLineNumber=133
// Perform ICP alignment
pcl::IterativeClosestPoint<pcl::PointXYZ, pcl::PointXYZ> icp;
icp.setInputSource(input_cloud);
icp.setInputTarget(target_cloud_);
icp.setMaximumIterations(solver_max_iter);
// icp.setTransformationEpsilon(1e-8);
icp.setMaxCorrespondenceDistance(max_correspondence_distance);
icp.setRANSACOutlierRejectionThreshold(RANSAC_outlier_rejection_threshold);
// icp.setRANSACIterations(100);
pcl::PointCloud<pcl::PointXYZ> final_cloud;
icp.align(final_cloud, initGuess);

// Get fitness score
double fitness_score = icp.getFitnessScore();
RCLCPP_INFO(this->get_logger(), "ICP fitness score: %f", fitness_score);

if (fitness_score < fitness_score_thre && icp.hasConverged())
{
    converged_count++;
    RCLCPP_INFO(this->get_logger(), "ICP converged, count: %d", converged_count);
    if(converged_count < converged_count_thre)
    {
        RCLCPP_INFO(this->get_logger(), "ICP converged, but not enough count, no pose is published");
        return;
    }
    // Convert the transformation_result result to a PoseWithCovarianceStamped message and publish it
    Eigen::Matrix4f transformation_result = icp.getFinalTransformation();
    geometry_msgs::msg::PoseWithCovarianceStamped pose_msg;
    pose_msg.header.stamp = msg->header.stamp;
    pose_msg.header.frame_id = map_frame;
    pose_msg.pose.pose.position.x = transformation_result(0, 3);
    pose_msg.pose.pose.position.y = transformation_result(1, 3);
    pose_msg.pose.pose.position.z = transformation_result(2, 3);
```

> 再往下（第 167 行起）用 `transformation_result.block<3,3>(0,0)` 取旋转块转成四元数，最后经 `QoS(1).reliable().transient_local()` 发布到 `/icp_result`。

**逐行拆解**

- **134** — 创建 ICP 对象，点类型都是 `PointXYZ`（只用坐标，不用 intensity）。
- **135、136** — **最关键的两行**：`Source` 是当前这帧要被搬动的扫描，`Target` 是不动的先验地图。设反了算出来的位姿完全错误。
- **137–140** — 设最大迭代次数、对应点最大距离、RANSAC 外点阈值。注释掉的两行说明作者调过参数但最后没启用。
- **142、143** — `align(输出点云, 初始猜测)`：第二参数 `initGuess` 是 4×4 初始变换。不给初值就从单位阵硬收敛，很容易掉进局部最优。
- **146、147** — `getFitnessScore()` 是配准后对应点的**均方距离**，越小越好。打印出来便于现场调阈值。
- **149** — 两个条件同时满足才算成功：分数低于 `fitness_score_thre`，且 `hasConverged()` 为真。
- **151–157** — 还要**连续 N 次**都收敛才发布位姿，防止某一帧偶然匹配好就误报。没攒够就直接 `return`。
- **159** — `getFinalTransformation()` 取出 4×4 的 `Eigen::Matrix4f`（注意是 float）。
- **160–162** — 构造 `PoseWithCovarianceStamped`，时间戳沿用输入点云的，`frame_id` 设为 `map`。
- **163–165** — 4×4 矩阵的最后一列前三项就是平移 `(x,y,z)`，填进 `pose.pose.position`（两层 `pose` 别写少）。

### 22.5 IEKF 状态估计逐行：FAST-LIO 的心脏

**`src/FAST_LIO/include/use-ikfom.hpp（第 6-21 行）`** · 源码第 **6–21** 行

```cpp startLineNumber=6
typedef MTK::vect<3, double> vect3;
typedef MTK::SO3<double> SO3;
typedef MTK::S2<double, 98090, 10000, 1> S2; 
typedef MTK::vect<1, double> vect1;
typedef MTK::vect<2, double> vect2;

MTK_BUILD_MANIFOLD(state_ikfom,
((vect3, pos))
((SO3, rot))
((SO3, offset_R_L_I))
((vect3, offset_T_L_I))
((vect3, vel))
((vect3, bg))
((vect3, ba))
((S2, grav))
);
```

**逐行拆解**

- **11–15** — 给 IKFoM 工具包的流形类型起短别名：`vect3` 三维向量、`SO3` 三维旋转、`S2` 球面（用来表示二维的重力方向）。
- **12–21** — `MTK_BUILD_MANIFOLD` 用宏生成状态结构体 `state_ikfom`：位置、姿态、雷达→IMU 外参旋转/平移、速度、陀螺零偏、加计零偏、重力方向。
- **20** — 重力字段叫 **`grav`** 且是 `S2` 二维流形，不是 `gravity`。`IMU_Processing.hpp` 里用的是 `imu_state.grav[i]`。
- **19** — `rot` 是 `MTK::SO3` 不是 `Eigen::Quaterniond`；取旋转矩阵要 `.toRotationMatrix()`。

**`src/FAST_LIO/src/laserMapping.cpp（第 1179-1186 行）`** · 源码第 **1179–1186** 行

```cpp startLineNumber=1179
kf.update_iterated_dyn_share_modified(LASER_POINT_COV, solve_H_time);
state_point = kf.get_x();
euler_cur = SO3ToEuler(state_point.rot);
pos_lid = state_point.pos + state_point.rot * state_point.offset_T_L_I;
geoQuat.x = state_point.rot.coeffs()[0];
geoQuat.y = state_point.rot.coeffs()[1];
geoQuat.z = state_point.rot.coeffs()[2];
geoQuat.w = state_point.rot.coeffs()[3];
```

**逐行拆解**

- **1179** — **观测更新**：用点云到地图平面的残差迭代修正滤波状态。`LASER_POINT_COV` 是单点测距噪声，`solve_H_time` 带出求解耗时。IMU 的预测步在 `IMU_Processing.hpp` 的 `kf_state.predict(dt, Q, in)`。
- **1180** — `get_x()` 取当前最优状态（**返回拷贝**，改它不会改滤波器内部；要写回得用 `change_x()`）。
- **1181** — 把 `SO3` 旋转转成欧拉角，用于日志/调试。
- **1182** — 把 IMU 系位置换算成雷达系位置：加上经姿态旋转后的雷达→IMU 外参平移。
- **1183–1186** — `rot.coeffs()` 给出四元数四个分量，按顺序填进 `geometry_msgs::msg::Quaternion`，随后用于 `/Odometry` 和 TF 广播。

### 22.6 ikd-Tree：增量地图的最近邻搜索

**`src/FAST_LIO/src/laserMapping.cpp（第 191-198 行）`** · 源码第 **191–199** 行

```cpp startLineNumber=191
auto &points_near = Nearest_Points[i];

if (ekfom_data.converge)
{
    /** Find the closest surfaces in the map **/
    ikdtree.Nearest_Search(point_world, NUM_MATCH_POINTS, points_near, pointSearchSqDis);
    point_selected_surf[i] = points_near.size() < NUM_MATCH_POINTS ? false : pointSearchSqDis[NUM_MATCH_POINTS - 1] > 5 ? false
                                                                                                                       : true;
}
```

**逐行拆解**

- **191** — 取当前点的近邻结果数组引用。
- **193** — 只有滤波器已经收敛才做匹配，否则地图还不可信。
- **196** — `Nearest_Search(点, k, 输出点集, 输出距离)`：在增量 k-d 树里找 `NUM_MATCH_POINTS` 个最近邻，用来拟合局部平面、构造点到平面的残差。
- **197、198** — 两个条件筛掉坏点：近邻数量不够 k，或第 k 个近邻的**平方距离**大于 5（约 2.2 m）说明周围没东西，这个点不能用来约束位姿。

| ikd-Tree 函数 | 作用 | 位置 | 备注 |
| --- | --- | --- | --- |
| `KD_TREE<PointType> ikdtree` | 全局唯一的地图树对象 | `laserMapping.cpp:134` | 不是 PCL 的 KdTreeFLANN |
| `Build(points)` | 用先验地图点云建树 | `laserMapping.cpp:1127` | 参数是 `std::vector`，即 `->points` |
| `Nearest_Search` | k 近邻搜索 | `laserMapping.cpp:196` | 距离是**平方距离** |
| `Add_Points(vec, bool)` | 增量插点；bool 控制插入时是否下采样 | `laserMapping.cpp:856-857` | 两批点分别传 true/false |
| `Delete_Point_Boxes(boxes)` | 按立方体批量删除滑窗外的点 | `laserMapping.cpp:639` | 不是 `Delete_Point` |

全库业务调用集中在 `laserMapping.cpp` 一个文件，实现约 1300 行在 `FAST_LIO/include/ikd-Tree/ikd_Tree.cpp`。

### 22.7 一个必须记住的「字段挪用」：curvature 其实是时间戳

**`src/FAST_LIO/src/preprocess.cpp（第 218-232 行）`** · 源码第 **218–232** 行

```cpp startLineNumber=218
PointType added_pt;
added_pt.x = pl_orig.points[i].x;
added_pt.y = pl_orig.points[i].y;
added_pt.z = pl_orig.points[i].z;
added_pt.intensity = pl_orig.points[i].intensity;
added_pt.normal_x = 0;
added_pt.normal_y = 0;
added_pt.normal_z = 0;
double yaw_angle = atan2(added_pt.y, added_pt.x) * 57.3;
if (yaw_angle >= 180.0)
  yaw_angle -= 360.0;
if (yaw_angle <= -180.0)
  yaw_angle += 360.0;

added_pt.curvature = pl_orig.points[i].t * time_unit_scale;
```

**逐行拆解**

- **218** — `PointType` 是 `pcl::PointXYZINormal`（x/y/z + intensity + 法向量 + curvature）。
- **219–222** — 把 Livox 原始点的坐标与反射率搬过来。`intensity` 存的是**反射率**。
- **223–225** — 法向量三个分量手动置 0——这里并没有真的估算法向量。
- **226–230** — `atan2(y, x)` 返回**弧度**，乘 57.3 转角度，再夹到 (-180, 180]。用来判断这个点属于哪条扫描线/方位。
- **232** — **关键坑**：`curvature` 被借来存「该点相对帧起点的时间偏移」，`pl_orig.points[i].t` 是微秒级时间戳，`time_unit_scale` 把它换算成毫秒。后面 `IMU_Processing.hpp::UndistortPcl()` 靠这个值做去畸变。

> [!NOTE] 为什么需要逐点时间戳
> 雷达一帧不是「同一瞬间拍的照片」，而是激光头转一圈扫出来的，第一个点和最后一个点差几十毫秒；这段时间里机器人在动，点云会被「拖歪」。有了每个点的时间偏移，就能用 IMU 把每个点补偿到同一时刻，这叫**去畸变 / de-skew**。同理，`terrain_analysis` 输出的 `intensity` 也被挪用了——那里存的是离地高度 `disZ`。**读这份代码时，永远先确认字段的真实语义，别被名字骗了。**

### 22.8 Nav2 插件里的服务客户端逐行

**`src/nav2_plugins/behavior_ext_plugins/plugins/back_up_twz_free_action.cpp（第 59-95 行）`** · 源码第 **59–95** 行

```cpp startLineNumber=59
  nav2_util::declare_parameter_if_not_declared(
    node,
    "visualization", rclcpp::ParameterValue(false));
  node->get_parameter("visualization", visualization_);

  costmap_client_ = node->create_client<nav2_msgs::srv::GetCostmap>(service_name_);
  marker_pub_ = node->create_publisher<visualization_msgs::msg::MarkerArray>("back_up_twz_free_markers", 1);

  RCLCPP_DEBUG(node->get_logger(), "back_up_twz_free_action plugin initialized.");
}

Status BackUpTwzFree::onRun(const std::shared_ptr<const BackUpAction::Goal> command)
{
  // send request to get costmap
  auto node = this->node_.lock();
  if (!node)
  {
    throw std::runtime_error{"Failed to lock node"};
  }

  while (!costmap_client_->wait_for_service(std::chrono::seconds(1)))
  {
    if (!rclcpp::ok())
    {
      RCLCPP_ERROR(node->get_logger(), "Interrupted while waiting for the service. Exiting.");
      return Status::FAILED;
    }
    RCLCPP_WARN(node->get_logger(), "service not available, waiting again...");
  }

  auto request = std::make_shared<nav2_msgs::srv::GetCostmap::Request>();
  auto result = costmap_client_->async_send_request(request);
  if(result.wait_for(std::chrono::seconds(1)) == std::future_status::timeout)
  {
    RCLCPP_ERROR(node->get_logger(), "Interrupted while waiting for the service. Exiting.");
    return Status::FAILED;
  }
```

**逐行拆解**

- **59–62** — Nav2 插件用 `declare_parameter_if_not_declared`（不是 `this->declare_parameter`），避免和主节点重复声明；`rclcpp::ParameterValue(false)` 明确是 bool 类型。
- **64** — 创建 `GetCostmap` 服务客户端——恢复行为要拿到当前代价地图才能找自由空间。
- **65** — 再建一个 MarkerArray 发布者，用于 RViz 里把找到的自由方向画出来。
- **70–77** — `onRun` 是行为插件的回调。`node_` 是 `weak_ptr`，必须 `.lock()` 成 `shared_ptr` 并检查是否失效。
- **79–87** — 循环 `wait_for_service(1s)`，服务没起来就一直等；期间检查 `rclcpp::ok()` 以便 Ctrl-C 能退出。
- **89、90** — 构造请求并 `async_send_request`，返回的是 `std::shared_future`。
- **91–95** — 用 `wait_for(1s)` 判超时，**不要直接 `.get()` 死等**，否则服务挂了整个行为线程会卡住。

| Nav2 插件接口函数 | 作用 | 位置 | 坑 |
| --- | --- | --- | --- |
| `PLUGINLIB_EXPORT_CLASS(类, 基类)` | 把 C++ 类注册成可动态加载的插件 | `voxel_layer.cpp:13` | 第二个参数必须写基类（`Layer` / `nav2_core::Behavior`） |
| `onInitialize()` | 插件被加载时初始化参数 | `voxel_layer.cpp:23`、`obstacle_layer.hpp:68` | 继承时先调父类的 `onInitialize()` |
| `declareParameter(name, ParameterValue)` | Layer 自带的参数声明 | `voxel_layer.cpp:27-34` | 参数名要和 yaml 完全一致 |
| `updateBounds(...)` / `updateCosts(...)` | 每轮更新：先算更新范围，再写代价值 | `obstacle_layer.cpp:374,485` | `updateBounds` 的 4 个 `double*` 是输出参数 |
| `matchSize()` | 代价地图尺寸变化时重新分配内存 | `voxel_layer.cpp:81` | 要同时 `voxel_grid_.resize(...)` |
| `onConfigure` / `onRun` / `onCycleUpdate` | 行为插件的生命周期回调 | `back_up_twz_free_action.hpp:31-38` | 本仓库从 `DriveOnHeading` 继承，没有直接写 `TimedBehavior` |

---

## 23 · 函数与包速查索引：想改 X，该去哪、调什么

*把前面 22 章压成一张反查表。实车联调、交作业、面试讲解时直接翻这一章。*

这一章不引入新概念，只做**反查**：从「我想干什么」出发，定位到包、文件、函数、参数。

### 23.1 需求 → 包 / 文件 / 函数

| 我想… | 包 | 文件 + 函数 / 参数 |
| --- | --- | --- |
| 让雷达出数 | `livox_ros_driver2` | `config/MID360_config.json`（IP、端口、`xfer_format=1`）、`msg_MID360_launch.py` |
| 让 FAST-LIO 用自定义点云格式 | `fast_lio` | `preprocess.cpp::livox_pcl_cbk` / `standard_pcl_cbk`，由 yaml 的 `lid_type` 决定 |
| 调整定位精度 / 频率 | `fast_lio` | `laserMapping.cpp::create_timer`（100 Hz）、`LASER_POINT_COV`、`fast_lio_*_param.yaml` |
| 保存 / 加载先验地图 | `fast_lio` | `create_service("map_save")`、`pcl::io::loadPCDFile`、`locate_in_prior_map`、`prior_map_path` |
| 改 ICP 匹配阈值 | `icp_relocalization` | `icp_node.cpp`：`fitness_score_thre`、`converged_count_thre`、`max_correspondence_distance` |
| 改初始位姿发布时间 | `icp_relocalization` | `transform_publisher.cpp::publish_result`、`create_wall_timer(100ms)` |
| 改地形判定 | `terrain_analysis` / `terrain_analysis_ext` | `terrainAnalysis.cpp`（`disZ` 写入 intensity）、`quantileZ`、`useSorting`、`considerDrop`、`vehicleHeight` |
| 改障碍高度过滤 | `costmap_intensity` | `obstacle_layer.cpp:424-433`；yaml 的 `min/max_obstacle_intensity` |
| 改全局规划器 / 控制器 | `sentry_bringup` | `params/nav2_params.yaml`：`GridBased.plugin`（Theta*）、`FollowPath`（MPPI） |
| 改恢复行为 | `behavior_ext_plugins` | `back_up_twz_free_action.cpp::onCycleUpdate`（自由方向 → `vx/vy`） |
| 改底盘指令类型 | `cmd_chassis` + `rm_interfaces` | `twist2chassis_cmd.cpp`（`chassis_msg_.type = 2`）、`ChassisCmd.msg` |
| 改速度坐标系旋转 | `cmd_chassis` | `twist_transformer.cpp::lookupTransform` + `cos/sin(yaw)` |
| 改 TF 外参 | `sentry_description` | `urdf/sentry_description.urdf` 的 `imu_joint` 等固定关节 |
| 改启动顺序 | `sentry_bringup` | `mapping.launch.py::TimerAction`、`bringup_all_in_one.launch.py::after_gate` |
| 改定位就绪判定 | `sentry_bringup` | `scripts/wait_for_localization.py::ready()` |
| 加一个新消息类型 | `rm_interfaces` | `msg/*.msg` + `CMakeLists.txt::rosidl_generate_interfaces` |
| 加一个插件 | `nav2_plugins` | `PLUGINLIB_EXPORT_CLASS` + plugin XML + `nav2_params.yaml` 的 `plugin:` |

### 23.2 函数 → 归属包（看到陌生函数先查这张表）

| 函数 / 类 | 来自哪里 | 属于哪一层 |
| --- | --- | --- |
| `rclcpp::*` / `RCLCPP_*` | ROS 2 客户端库 `rclcpp` | 中间件 |
| `rclpy.*` / `qos_profile_sensor_data` | ROS 2 Python 客户端库 `rclpy` | 中间件 |
| `LaunchDescription` / `Node` / `TimerAction` | `launch` / `launch_ros` | 启动编排 |
| `RewrittenYaml` / `ReplaceString` / `ParameterFile` | `nav2_common` / `launch_ros` | 启动编排（参数改写） |
| `sensor_msgs` / `geometry_msgs` / `nav_msgs` | ROS 标准消息包 | 数据结构 |
| `livox_ros_driver2::msg::CustomMsg` | `livox_ros_driver2` | 雷达私有消息 |
| `rm_interfaces::msg::ChassisCmd` | `rm_interfaces` | 自研消息 |
| `tf2_ros::Buffer` / `lookupTransform` / `getRPY` | `tf2` / `tf2_ros` | 坐标变换 |
| `pcl::fromROSMsg` / `VoxelGrid` / `IterativeClosestPoint` | PCL（经 `pcl_ros` / `pcl_conversions`） | 点云算法 |
| `Eigen::Matrix4f` / `.block<3,3>` | Eigen3 | 线性代数 |
| `MTK_BUILD_MANIFOLD` / `esekfom::esekf` | `IKFoM_toolkit`（内嵌在 FAST_LIO） | 状态估计 |
| `KD_TREE::Nearest_Search` | `ikd-Tree`（内嵌在 FAST_LIO） | 地图数据结构 |
| `nav2_costmap_2d::Layer` / `updateCosts` | `nav2_costmap_2d` | Nav2 插件接口 |
| `nav2_msgs::srv::GetCostmap` | `nav2_msgs` | Nav2 服务 |
| `PLUGINLIB_EXPORT_CLASS` | `pluginlib` | 插件注册 |
| `rosidl_generate_interfaces` / `ament_package()` | `rosidl_default_generators` / `ament_cmake` | 构建工具 |
| `validate_icp_input` / `after_gate` / `ready()` | `sentry_bringup`（自定义） | 本工程自研逻辑 |

### 23.3 常用命令速查

**`终端命令速查（依据 README_USAGE.md 与 docs/CODEBASE_GUIDE.md 整理）`** · 源码第 **1–16** 行

```bash
source /opt/ros/humble/setup.bash
source install/setup.bash

ros2 pkg list | grep -E 'fast_lio|icp|terrain|costmap|bringup'
ros2 launch sentry_bringup mapping.launch.py
ros2 launch sentry_bringup relocalization.launch.py
ros2 launch sentry_bringup navigation.launch.py
ros2 launch sentry_bringup bringup_all_in_one.launch.py

ros2 topic hz /livox/lidar
ros2 topic echo /state_estimation --once
ros2 topic info /icp_result --verbose
ros2 run tf2_tools view_frames
ros2 service call /map_save std_srvs/srv/Trigger
ros2 param get /fastlio_mapping locate_in_prior_map
ros2 lifecycle get /map_server
```

**逐行拆解**

- **1、2** — 每个新终端都要先加载 ROS 环境，再加载本工作区环境（顺序不能反）。
- **4** — 确认 14 个包都编译安装成功；包名是 `fast_lio` 不是 `FAST_LIO`。
- **5–8** — 四条路径：建图 → 重定位 → 导航 → 一键（含定位门控）。
- **10–12** — 查雷达频率、看一帧里程计、查 `/icp_result` 两端的 QoS 是否兼容。
- **13** — 导出 TF 树 PDF，检查 `map → odom → base_link → yaw_link → chassis_link` 是否完整。
- **14** — 建完图触发保存 PCD（对应 `create_service("map_save")`）。
- **15、16** — 查 FAST-LIO 是否处于先验地图模式、查 Nav2 生命周期节点状态。

### 23.4 新手最常踩的 10 个坑（按出现频率排）

1. **把目录名当包名**：`FAST_LIO` 目录的包叫 `fast_lio`；`nav2_plugins` 目录里是 2 个包；`Livox-SDK2` 不是 ROS 包。
2. **只看源码不看 launch 的 remap**：源码发布 `/Odometry`，实际频道是 `/state_estimation`；漏看会以为下游没数据。
3. **QoS 不兼容导致静默失联**：`transient_local` 只给一次性结果，雷达点云必须用 `SensorDataQoS`；两端要匹配。
4. **把字段名当语义**：FAST-LIO 的 `curvature` 是时间戳，`terrain_map` 的 `intensity` 是离地高度，都不是字面意思。
5. **忘了先 declare 再 get_parameter**：ROS 2 未声明的参数读出来会抛异常；插件里要用 `declareParameter`。
6. **`params_file:=` 让绝对路径替换失效**：`ReplaceString` 只在默认参数文件时生效。
7. **以为 8 秒延时等于等就绪**：`TimerAction` 纯计时；一键入口才用事件门控。
8. **`PointCloud2ConstIterator` 类型写错或迭代器不同步 `++`**：`voxel_layer.cpp` 用 `uint8_t` 读 `float32` intensity 是现成的反例。
9. **ICP 的 Source / Target 设反**：Source 是要被搬动的当前帧，Target 是不动的地图。
10. **以为 `.msg` 文件存在就能用**：`rm_interfaces` 17 个消息只有 6 个被 `rosidl_generate_interfaces` 编译。

### 23.5 最后一句话

> [!TIP] 读这份代码的心法
> **先找数据的入口和出口，再看中间怎么算，最后才看算法细节。** 每个节点都逃不出「订阅什么 → 在回调里算什么 → 发布什么 → 广播什么 TF」这四步；每个包都逃不出「package.xml 声明依赖 → CMakeLists 声明产物 → launch 决定何时启动」这三步。把这两套骨架记住，632 个文件就不再是 632 个问题。

> 源码里能追到 ROS 消息发布，未看到消费这条消息并下发到电控的节点。
>
> —— docs/CODEBASE_GUIDE.md —— 这是全工程最值得记住的一处「链路断点」：`/chassis_cmd` 之后需要电控侧对接。

---

## 写在最后

全部讲解基于 src/ 目录下的当前生效源码，行号与文件原文一致。第三方库（Livox-SDK2、FAST_LIO 上游算法）只讲与本工程接线相关的部分。
