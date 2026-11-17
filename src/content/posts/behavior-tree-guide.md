---
title: 'BehaviorTree：行为树从入门到实践'
published: 2026-11-17
description: 整理 BehaviorTree.CPP 4.x 的核心概念、节点、黑板与端口、C++ 开发、调试和 ROS 2 集成，附实战示例与速查表。
tags: [BehaviorTree, 行为树, C++, ROS 2]
category: 资源整理
readingPalette: ocean
---

> 官方资料：
> - 文档 <https://www.behaviortree.dev/> ／ <https://www.behaviortree.dev/docs/intro>
> - GitHub <https://github.com/BehaviorTree/BehaviorTree.CPP>
> - Groot2 <https://www.behaviortree.dev/groot>
> - BehaviorTree.ROS2 <https://github.com/BehaviorTree/BehaviorTree.ROS2>
>
> **知识库阅读说明**：本文以概念理解为主，代码示例按 **BehaviorTree.CPP 4.x** 整理；涉及 `BehaviorTree.ROS2` 的示例还需满足该仓库对应版本的兼容要求。不同小版本的内置节点、端口和包装器 API 可能变化，实际开发时应以项目锁定版本的头文件和官方文档为准。文中的 XML 片段不一定都是可独立运行的完整工程。

## 第一部分 核心概念入门

> 来源：入门版《第一部分：入门概念》＋ 详解版《一、核心概念与节点基础》

### 1.1 什么是行为树

行为树（Behavior Tree, BT）是一种让机器人（或游戏 AI）"自己做决定"的方法。（入门版）

想象你在给巡检机器人安排任务：

- "先走到巡检点"
- "如果看到标签就扫码"
- "否则继续巡检"

行为树就是把这套决策逻辑组织成一棵可执行的树。（入门版）

（详解版补充）行为树是一种在正确时机、正确条件调用回调函数的机制，这些回调函数内部做什么完全取决于自己。部署行为树时，是基于 XML 脚本语言来创建和组合节点的。

### 1.2 为什么选择行为树（对比状态机）

> 来源：入门版。

| 特点 | 行为树 | 状态机 (FSM) |
|---|---|---|
| 层级结构 | 天然支持，可以嵌套子树 | 扁平，状态多了就乱 |
| 可读性 | 图形化一目了然 | 箭头满天飞，看晕了 |
| 复用性 | 像乐高积木，随意组装 | 复制粘贴，改一处漏十处 |
| 扩展性 | 新增行为只加节点 | 新增状态要改很多连线 |

### 1.3 三大核心返回值

> 来源：入门版。

每个节点执行后，通常会报告三种主要状态之一：

| 状态 | 含义 | 比喻 |
|---|---|---|
| `SUCCESS` | 任务完成了 | "报告，搞定了！" |
| `FAILURE` | 任务失败了 | "报告，搞砸了！" |
| `RUNNING` | 任务还在进行中 | "报告，还在干！" |

（详解版补充）此外还有 `IDLE`（空闲，尚未被 tick）与 `SKIPPED`（被前置条件跳过）两个辅助状态。

### 1.4 Tick（心跳）机制

> 来源：入门版。

**什么是 Tick？** Tick 是驱动行为树执行的一次更新。应用程序通常从根节点开始 tick，控制节点再按自身语义 tick 子节点。BT.CPP 不规定固定频率；频率由应用自己的循环、定时器、`tickWhileRunning()` 的参数以及唤醒机制决定。机器人项目常见的频率可能是 10–100 Hz，但这只是应用选择，不是库的默认行为。

**为什么需要持续 Tick？** 因为世界和异步任务的状态会变化。持续 tick 可以让条件节点重新读取最新状态，让正在运行的动作检查结果，并让反应式控制节点决定是否中止子节点。需要注意：普通 `Sequence` 不会每次重新执行已经成功的前置节点；只有反应式控制节点或相应的前置条件配置才会持续检查。

（详解版）任何树节点都可以看作是一种回调函数的机制：

```cpp
// 可以封装到行为树动作中的最简单的回调函数
BT::NodeStatus HelloTick() {
    std::cout << "Hello World\n";
    return BT::NodeStatus::SUCCESS;
}

// 允许库创建调用 HelloTick() 的动作节点
factory.registerSimpleAction("Hello", std::bind(HelloTick));
```

上述代码通过函数指针（依赖注入）的方式，创建了一种调用 `HelloTick` 的特定类型的树节点。在定义自定义树节点时，应从 `TreeNode` 类继承，或继承其派生类：`ActionNodeBase`、`ConditionNode`、`DecoratorNode`。

### 1.5 节点的生命周期

> 来源：入门版。

一个行为树节点就像一个"小工人"，它有三种工作状态。每次 Tick 的流程：

```
┌─────────────────────────────────────┐
│ 信号从根节点出发                     │
│ ↓                                   │
│ 按规则传递给子节点                   │
│ ↓                                   │
│ 叶子节点执行回调函数                 │
│ ↓                                   │
│ 返回 SUCCESS / FAILURE / RUNNING     │
└─────────────────────────────────────┘
```

节点生命周期状态图（入门版原文）：

```
┌─────────────────────────────────────────────────────────┐
│ 节点生命周期                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [空闲] ──(被Tick)──> [onStart] ──> [RUNNING]            │
│                           │            │                │
│                           │      (继续Tick)             │
│                           │            ↓                │
│                           │        [onRunning]          │
│                           │            │                │
│                           │            ↓ ↓              │
│     [SUCCESS/FAILURE] <───┘            │                │
│              │                         │                │
│        (被父节点打断)                    │                │
│              ↓                         │                │
│         [onHalted] <────────────────────┘                │
│              │                                          │
│              ↓                                          │
│           [空闲]                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.6 节点类型总览

> 来源：入门版《第二部分：节点类型总览》＋ 详解版《一、核心概念与节点基础》。

```
┌─────────────┐
│  TreeNode   │
└──────┬──────┘
┌───────────────┼───────────────┐
↓               ↓               ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Control  │  │ Decorator│  │   Leaf   │
│  Nodes   │  │  Nodes   │  │  Nodes   │
│(控制节点) │  │(装饰节点) │  │(叶子节点) │
└──────────┘  └──────────┘  └──────────┘
   Sequence     Inverter      Action
   Fallback     Repeat        Condition
   Reactive...  Retry...
```

详解版给出的节点类型表：

| 节点类型 | 英文名 | 子节点数量 | 说明 |
|---|---|---|---|
| 控制节点 | ControlNode | 1…N | 通常根据兄弟节点的结果和/或自身状态来 tick 一个子节点 |
| 装饰节点 | DecoratorNode | 1 | 除其他功能外，可以改变子节点的结果，或多次 tick 子节点 |
| 条件节点 | ConditionNode | 0 | 不应改变系统状态，不得返回"运行中" |
| 动作节点 | ActionNode | 0 | 这是"执行操作"的节点 |

**同步与异步的准确含义**：异步动作通常意味着动作的 I/O 或长时工作不会阻塞行为树线程，并且节点会返回 `RUNNING`。这不代表行为树会立即执行该节点后面的兄弟节点；在 `Sequence` 中，后续兄弟节点通常要等当前子节点返回 `SUCCESS` 后才会被 tick。异步通信、协程和多线程是三个不同概念：ROS Action 的通信可以是异步的；协程是协作式让出；多线程则需要线程、`std::async` 或线程池等执行机制。

**叶子节点（Leaf Nodes）** 没有子节点，是树的最末端，负责真正的"干活"。（入门版）

- **同步动作** `SyncActionNode`：一次 `executeTick()` 内完成，并应返回 `SUCCESS` 或 `FAILURE`；不能返回 `RUNNING`。
  - **异步/长时动作**：动作本身可以立即发起一个操作并返回 `RUNNING`，后续 tick 再检查结果；`StatefulActionNode` 是实现请求—响应动作的常用基类。
  - **线程动作**：`ThreadedAction` 会在线程中执行动作，但需要自行正确处理中止和共享数据。
  - **协程动作**：`CoroActionNode` 允许在同一执行线程中协作式让出控制权；协程本身不等于创建线程。
- **Condition（条件节点）**：通常只返回 `SUCCESS` 或 `FAILURE`，不应有副作用；如果检查本身需要异步等待，应重新考虑节点类型和控制流设计。

**控制节点的"执行顺序"说明**（入门版）：在 Groot2 图形界面中，子节点横向排列，执行顺序从左到右；在 XML 文件中，子节点纵向书写，执行顺序从上到下。本质相同：都是按"排列/书写顺序"依次执行。

最基本的控制节点是**序列节点**：其子节点总是有序的，在图形中执行顺序从左到右。装饰节点根据类型不同，其目标可以是：转换从子节点接收到的结果、停止子节点的执行、重复 tick 子节点。

---

## 第二部分 创建第一棵行为树

> 来源：详解版《二、创建第一个行为树》完整内容＋入门版《7.4 节点注册与树创建》相关部分

行为树是一种在正确时机、正确条件调用回调函数的机制，这些回调函数内部做什么完全取决于自己。

### 2.1 默认方式：通过继承创建树节点

创建树节点默认方式是通过继承。自定义一个类名（类的名字相当于 XML 中所定义的标签名），继承自 BT 库中的 `SyncActionNode`（同步动作节点）：

```cpp
// 自定义同步动作节点（无端口）的示例
class ApproachObject : public BT::SyncActionNode {
public:
    ApproachObject(const std::string& name) : BT::SyncActionNode(name, {}) {}

    // 必须重写虚函数 tick()
    BT::NodeStatus tick() override {
        std::cout << "ApproachObject: " << this->name() << std::endl;
        return BT::NodeStatus::SUCCESS;
    }
};
```

- 在构造函数中，接收一个名字（比如在 XML 中对 name 属性的定义），然后传给 `SyncActionNode`。`{}` 表示这个节点没有输入/输出端口。
- `tick()` 函数是节点的核心。当行为树执行到这个节点时就会调用。它必须始终返回一个 `NodeStatus`，即 `RUNNING`、`SUCCESS` 或 `FAILURE`。

**带输入端口的同步动作节点**（详解版《三、数据共享》中的 SaySomething）：

```cpp
class SaySomething : public BT::SyncActionNode {
public:
    // 如果你的节点有端口，你必须使用这个构造函数签名
    SaySomething(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}

    // 必须定义这个静态方法
    static BT::PortsList providedPorts() {
        // 这个动作有一个名为 "message" 的输入端口
        return { BT::InputPort<std::string>("message") };
    }

    // 重写虚函数 tick()
    BT::NodeStatus tick() override {
        BT::Expected<std::string> msg = getInput<std::string>("message");
        // 检查期望值是否有效。如果无效，抛出错误
        if (!msg) throw BT::RuntimeError("缺少必需的输入 [message]: ", msg.error());
        // 使用 value() 方法提取有效的消息
        std::cout << "机器人说: " << msg.value() << std::endl;
        return BT::NodeStatus::SUCCESS;
    }
};
```

- `providedPorts()` 告诉工厂这个节点有一个输入端口，名为 `message`，类型是 `std::string`。
- 在 `tick()` 中用 `getInput<T>("端口名")` 读取数据（返回一个 `Expected<T>` 对象，需要检查有效性）。
- 输出端口类似，用 `setOutput("端口名", 值)` 写入黑板值。

### 2.2 通过函数指针包装节点

可以把普通函数或类成员函数包装成节点。创建的时候，函数的格式必须严格遵守下面的样式：

```cpp
BT::NodeStatus myFunction(BT::TreeNode& self)
```

- 返回类型必须是 `BT::NodeStatus`。
- 参数列表必须只能有一个参数：`BT::TreeNode& self`，它是一个节点的引用，代表当前正在执行的这个节点本身。

**普通函数示例**：

```cpp
BT::NodeStatus CheckBattery() {
    std::cout << "[ Battery: OK ]" << std::endl;
    return BT::NodeStatus::SUCCESS;
}
```

**类成员函数示例**：

```cpp
using namespace BT;

// 我们想把 open() 和 close() 方法包装进动作节点
class GripperInterface {
public:
    GripperInterface() : _open(true) {}
    NodeStatus open() {
        _open = true;
        std::cout << "GripperInterface::open" << std::endl;
        return NodeStatus::SUCCESS;
    }
    NodeStatus close() {
        std::cout << "GripperInterface::close" << std::endl;
        _open = false;
        return NodeStatus::SUCCESS;
    }
private:
    bool _open;   // 共享信息
};
```

### 2.3 用 XML 定义树

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence name="root_sequence">
      <CheckBattery   name="check_battery"/>
      <OpenGripper    name="open_gripper"/>
      <ApproachObject name="approach_object"/>
      <CloseGripper   name="close_gripper"/>
    </Sequence>
  </BehaviorTree>
</root>
```

- 必须先将自定义的树节点注册到 `BehaviorTreeFactory` 中，然后从文件或文本加载 XML。
- 标签名（如 `CheckBattery`）必须和注册时用的 ID 一致。
- `name` 属性是实例名称，方便调试，可重复。

### 2.4 在 C++ 中注册节点并加载树

```cpp
#include "behaviortree_cpp/bt_factory.h"
#include "dummy_nodes.h"   // 包含自定义节点定义的文件
using namespace DummyNodes;

int main() {
    // 使用 BehaviorTreeFactory 注册我们的自定义节点
    BT::BehaviorTreeFactory factory;

    // 创建节点的推荐方式是通过继承
    factory.registerNodeType<ApproachObject>("ApproachObject");

    // 使用函数指针注册 SimpleActionNode，可以使用 C++11 lambda 或 std::bind
    factory.registerSimpleCondition("CheckBattery", [&](BT::TreeNode&) {
        return CheckBattery();
    });

    // 也可以使用类的方法创建 SimpleActionNode
    GripperInterface gripper;
    factory.registerSimpleAction("OpenGripper", [&](BT::TreeNode&){
        return gripper.open();
    });
    factory.registerSimpleAction("CloseGripper", [&](BT::TreeNode&){
        return gripper.close();
    });

    // 树是在部署时创建的（即运行时，但只在开始时创建一次）
    // 重要：当 "tree" 对象超出作用域时，所有树节点都会被销毁
    auto tree = factory.createTreeFromFile("./my_tree.xml");

    // 要"执行"一棵树，你需要对它"滴答"
    // 滴答信号根据树的逻辑传播给子节点
    // 在此例中，因为序列的所有子节点都返回 SUCCESS，所以整个序列被执行
    tree.tickWhileRunning();

    return 0;
}

/* 预期输出：
* [ Battery: OK ]
* GripperInterface::open
* ApproachObject: approach_object
* GripperInterface::close
*/
```

**另一种执行方式：手动 tick 循环**（详解版《八、序列节点族》中的示例，便于观察 RUNNING 中间状态）：

```cpp
// 此处，我们不使用 tree.tickWhileRunning()，而是采用我们自己的循环
std::cout << "--- ticking\n";
auto status = tree.tickOnce();
std::cout << "--- status: " << toStr(status) << "\n\n";

while (status == BT::NodeStatus::RUNNING) {
    // 休眠以避免忙循环
    // 不要使用其他休眠函数！较小的休眠时间是可以的，
    // 这里我们使用较大的值只是为了在控制台上少输出一些消息
    tree.sleep(std::chrono::milliseconds(100));
    std::cout << "--- ticking\n";
    status = tree.tickOnce();
    std::cout << "--- status: " << toStr(status) << "\n\n";
}
```

**输入/输出端口连接的完整示例**（详解版《三、数据共享》示例）：

树由三个动作组成：动作 1 从静态字符串读取输入信息；动作 2 将一些内容写入黑板中名为 `the_answer` 的条目；动作 3 从黑板中名为 `the_answer` 的条目读取输入消息。

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence name="root_sequence">
      <SaySomething   message="hello" />
      <ThinkWhatToSay text="{the_answer}"/>
      <SaySomething   message="{the_answer}" />
    </Sequence>
  </BehaviorTree>
</root>
```

我们使用相同的键（`the_answer`）将输出端口"连接"到输入端口；换句话说，它们"指向"黑板的同一个条目：

- 第一个 `SaySomething` 直接输出静态字符串 "hello"；
- `ThinkWhatToSay` 将 "The answer is 42" 写入黑板的 `the_answer` 键；
- 第二个 `SaySomething` 从黑板读取 `the_answer` 并输出。

注册并执行树的 C++ 代码：

```cpp
#include "behaviortree_cpp/bt_factory.h"
#include "dummy_nodes.h"
using namespace DummyNodes;

int main() {
    BT::BehaviorTreeFactory factory;
    factory.registerNodeType<SaySomething>("SaySomething");
    factory.registerNodeType<ThinkWhatToSay>("ThinkWhatToSay");

    auto tree = factory.createTreeFromFile("./my_tree.xml");
    tree.tickWhileRunning();
    return 0;
}
/* 预期输出:
机器人说: hello
机器人说: 答案是42
*/
```

---

## 第三部分 控制节点

> 来源：入门版《第三部分：控制节点详解》＋ 详解版《七、回退节点族》《八、序列节点族》《九、并行节点》《十、条件控制与 Switch 节点》

控制节点有多个子节点，决定了子节点的执行顺序和逻辑。

### 3.1 Sequence 系列

#### 3.1.1 Sequence（顺序节点）

> 入门版口诀：**一个失败，全盘皆输。**

```xml
<MoveTo target="{goal_position}"/>
<GrabObject object_id="{target_id}"/>
<IsLabelVisible/>
<IsBatteryLow threshold="20"/>
```

**执行规则**（入门版）：

1. 按顺序依次执行子节点（XML 中从上到下，图形中从左到右）；
2. 如果某个子节点返回 `SUCCESS`，继续执行下一个子节点；
3. 如果某个子节点返回 `FAILURE`，立刻停止，整个 Sequence 返回 `FAILURE`；
4. 如果所有子节点都返回 `SUCCESS`，整个 Sequence 返回 `SUCCESS`。

**生活比喻**（入门版）：做菜流程——洗菜 → 切菜 → 炒菜 → 装盘。任何一步失败，这道菜就做不出来。

**详解版补充**：序列节点是最简单的控制节点，它会依次执行其子节点，并且如果所有子节点都返回成功，那么它本身也会返回成功。

- 第一次 tick 会将序列节点设置为"运行中"（橙色状态）；
- 序列节点 tick 其第一个子节点"开门"，该子节点最终返回"成功"；
- 结果，第二个子节点"行走"以及随后的节点"关门"会被依次 tick；
- 一旦最后一个子节点完成，整个序列节点返回 SUCCESS。
- 序列节点会依次 tick 其所有节点，只要它们返回"成功"；如果任何子节点返回"失败"，序列将被中止。

目前常见的 Sequence 控制节点包括：`Sequence`、`SequenceWithMemory`、`ReactiveSequence`，以及部分 4.x 版本提供的 `AsyncSequence`。其中 `AsyncSequence` 是否可用、具体让出执行权的时机，应以项目所用 BT.CPP 版本的注册列表和文档为准；不要仅凭名称假定所有 4.x 小版本都支持完全相同的行为。

- 在 tick 第一个子节点之前，节点状态变为"运行中"；
- 如果一个子节点返回"成功"，则 tick 下一个子节点；
- 如果最后一个子节点也返回"成功"，则所有子节点都会被中止，并且序列节点返回"成功"。

```xml
<Sequence>
  <OpenDoor/>
  <WalkThrough/>
  <CloseDoor/>
</Sequence>
```

依次执行：开门 → 穿过 → 关门。如果某一步失败，整个序列立即失效，不再执行后续步骤，并且下次 tick 会从头开始。

#### 3.1.2 ReactiveSequence（反应式顺序）

> 入门版口诀：**时刻警惕，随时撤退。**

与普通 Sequence 的区别：

- 普通 Sequence：前面的子节点成功后，不再检查它；
- `ReactiveSequence`：每次 Tick 都从头重新检查所有子节点。

**使用场景**（入门版）：

```xml
<!-- 每次 tick 都重新检查标签是否可见。不可见时，中断正在执行的接近动作。 -->
<ReactiveSequence>
  <IsLabelVisible/>   <!-- 每次 tick 都检查标签是否可见 -->
  <ApproachLabel/>    <!-- 持续接近标签 -->
</ReactiveSequence>

<!-- 持续检查电池，如果电量不足则中断任务 -->
<ReactiveSequence>
  <IsBatteryOK/>
  <Sequence>
    <MoveToGoal goal="A"/>
    <MoveToGoal goal="B"/>
  </Sequence>
</ReactiveSequence>
```

**详解版**：行为与 Sequence 类似，但每当一个子节点返回 `RUNNING` 时，下一次 tick 会从序列的第一个子节点重新开始执行。它会在每次 tick 时重新评估前置条件，如果条件不再满足（例如电池变为 FAILURE），则可以立即中止正在运行的异步动作并退出。

对比示例——普通 Sequence：

```xml
<root BTCPP_format="4">
  <BehaviorTree>
    <Sequence>
      <BatteryOK/>
      <SaySomething message="mission started..." />
      <MoveBase goal="1;2;3"/>
      <SaySomething message="mission completed!" />
    </Sequence>
  </BehaviorTree>
</root>
```

主程序：

```cpp
int main() {
    BT::BehaviorTreeFactory factory;
    factory.registerSimpleCondition("BatteryOK", std::bind(CheckBattery));
    factory.registerNodeType<MoveBaseAction>("MoveBase");
    factory.registerNodeType<SaySomething>("SaySomething");

    auto tree = factory.createTreeFromText(xml_text);

    std::cout << "--- ticking\n";
    auto status = tree.tickOnce();
    std::cout << "--- status: " << toStr(status) << "\n\n";

    while (status == BT::NodeStatus::RUNNING) {
        tree.sleep(std::chrono::milliseconds(100));
        std::cout << "--- ticking\n";
        status = tree.tickOnce();
        std::cout << "--- status: " << toStr(status) << "\n\n";
    }
    return 0;
}
```

**执行流程（输出）**：

```
--- ticking
[Battery: OK]
Robot says: mission started...
[MoveBase: 发送请求]. 目标: x=1.0 y=2.0 theta=3.0
--- status: RUNNING

--- ticking
--- status: RUNNING

--- ticking
[MoveBase: 完成]
Robot says: mission completed!
--- status: SUCCESS
```

当调用 `executeTick()` 时，`MoveBase` 第一次和第二次返回 RUNNING，最终第三次返回 SUCCESS，**`BatteryOK` 只执行了一次**。

对比示例——ReactiveSequence：

```xml
<root>
  <BehaviorTree>
    <ReactiveSequence>
      <BatteryOK/>
      <Sequence>
        <SaySomething message="mission started..." />
        <MoveBase goal="1;2;3"/>
        <SaySomething message="mission completed!" />
      </Sequence>
    </ReactiveSequence>
  </BehaviorTree>
</root>
```

执行流程：

```
--- ticking
[Battery: OK]
Robot says: mission started...
[MoveBase: 发送请求]. 目标: x=1.0 y=2.0 theta=3.0
--- status: RUNNING

--- ticking
[Battery: OK]
--- status: RUNNING

--- ticking
[Battery: OK]
[MoveBase: 完成]
Robot says: mission completed!
--- status: SUCCESS
```

**区别**：在 ReactiveSequence 中，`BatteryOK` 每次 tick 都会被重新执行。如果某次 `BatteryOK` 返回 FAILURE（比如电量突然低了），ReactiveSequence 会立即停止内部序列（并调用内部动作的 `onHalted()`），然后整体返回失败。这样就能实现对外部条件变化的快速响应。

另一个持续监控示例：

```xml
<ReactiveSequence>
  <IsBatteryOK/>      <!-- 条件节点 -->
  <MoveToGoal/>       <!-- 异步动作 -->
  <UnloadCargo/>
</ReactiveSequence>
```

- 每次 tick 都会从第一个子节点开始执行；
- 如果电池不足（`IsBatteryOK` 返回 FAILURE），则整个序列失效，`MoveToGoal` 会被中止；
- 适合需要持续监控前置条件的场景。

#### 3.1.3 SequenceWithMemory（带记忆的顺序）

> 入门版口诀：**做过的不重做。**

与普通 Sequence 的区别：

- 普通 Sequence：如果被打断，下次从头开始；
- `SequenceWithMemory`：记住上次执行到哪里，从那里继续。

**使用场景**（入门版）：如果 `GoTo(B)` 失败，下次执行会从 B 继续，不会重复执行已成功的 A。

```xml
<Sequence>
  <OpenDoor/>   <!-- 第1步：先开门 -->
  <Walk/>       <!-- 第2步：再走进去 -->
  <CloseDoor/>  <!-- 第3步：最后关门 -->
</Sequence>

<SequenceWithMemory>
  <GoTo_A/>   <!-- 去A点，成功后不再执行 -->
  <GoTo_B/>   <!-- 去B点，失败后下次从这里继续 -->
  <GoTo_C/>   <!-- 去C点 -->
</SequenceWithMemory>

<!-- 巡逻任务：访问 A、B、C，不重复 -->
<ReactiveSequence>
  <IsBatteryOK/>
  <SequenceWithMemory>
    <GoTo goal="A"/>
    <GoTo goal="B"/>
    <GoTo goal="C"/>
  </SequenceWithMemory>
</ReactiveSequence>
```

**详解版**：特点是一旦某个子节点成功，它就不会被再次执行；即使后续子节点失效，也不会重置已成功的子节点。适用于需要"一次性任务"且不重复的场景。

```xml
<SequenceWithMemory>
  <GoToLocation A="10,20"/>
  <GoToLocation B="30,40"/>
  <GoToLocation C="50,60"/>
</SequenceWithMemory>
```

- 假设 `GoToLocation A` 成功，机器人记住了 A 点已完成；
- 接下来尝试 B 点，如果 B 点失败（例如路径阻塞），`SequenceWithMemory` 不会重新执行 A 点，而是继续尝试 B 点（下次 tick 仍然在 B 点重试），直到 B 点成功；
- B 点成功后，再执行 C 点，如果 C 点失败，同样会持续重试 C 点，不会回退到 A 或 B；
- 当所有子节点都成功时，整个序列返回 SUCCESS。

#### 3.1.4 AsyncSequence（让出控制权）

**详解版**：`Sequence` 和 `AsyncSequence` 共享相同的逻辑，但在处理子节点之间的转换方式上有所不同：

- `Sequence`：在树的单次 tick 中 tick 所有子节点，当一个子节点返回"成功"时，下一个子节点会在同一次调用中立即被 tick；
- `AsyncSequence`：在每个子节点成功后将执行权交还给树，返回"运行中"并发出唤醒信号。这使得序列节点在子节点之间是可中断的，允许树的其他部分（例如一个 `ReactiveSequence` 父节点）在下一个子节点启动之前重新评估条件。
- 当序列位于反应式父节点内部，并且需要在每一步之间重新检查条件时，需使用 `AsyncSequence`。

```xml
<ReactiveSequence>
  <IsLabelVisible/>
  <AsyncSequence>
    <AlignScanner/>
    <ScanLabel/>
    <SaveScan/>
  </AsyncSequence>
</ReactiveSequence>
```

- 每次成功执行一个子节点后，`AsyncSequence` 会返回 RUNNING，让树有机会重新检查 `IsLabelVisible`；
- 如果标签不再可见，这个序列可以被中断，避免继续执行后续动作。

#### 3.1.5 Sequence 系列对比总结

**入门版对比表：**

Sequence 系列对比：

| 类型 | 子节点返回 RUNNING | 子节点返回 FAILURE |
|---|---|---|
| Sequence | 下次从同一子节点继续 | 停止，返回 FAILURE |
| ReactiveSequence | 从第一个子节点重新开始 | 停止，返回 FAILURE |
| SequenceWithMemory | 下次从同一子节点继续 | 停止，返回 FAILURE；已成功的子节点不再执行 |

**详解版对比表（更完整）：**

| 控制节点类型 | 子节点返回"失败"时 | 子节点返回"运行中"时 | 是否在子节点之间让出执行权 |
|---|---|---|---|
| Sequence | 重启 | 再次 tick | 否 |
| AsyncSequence | 重启 | 再次 tick | 是 |
| ReactiveSequence | 重启 | 重启 | 否 |
| SequenceWithMemory | 再次 tick | 再次 tick | 否 |

- "重启"意味着整个序列从列表的第一个子节点开始执行；
- "再次 tick"意味着下一次序列被 tick 时，同一个子节点会被再次 tick，之前已经返回"成功"的兄弟节点不会被再次 tick。

### 3.2 Fallback 系列

#### 3.2.1 Fallback（回退节点）

> 入门版口诀：**一个成功，万事大吉。** 别名：Selector（选择器）、Priority（优先级）。

**执行规则**（入门版）：

1. 按顺序依次尝试子节点；
2. 如果某个子节点返回 `SUCCESS`，立刻停止，整个 Fallback 返回 `SUCCESS`；
3. 如果某个子节点返回 `FAILURE`，尝试下一个子节点；
4. 如果所有子节点都返回 `FAILURE`，整个 Fallback 返回 `FAILURE`。

**生活比喻**（入门版）：备胎计划——先问小明借钱 → 不借就问小红 → 再不行就刷信用卡。只要有一个方法成功，问题就解决了。

```xml
<Fallback>
  <OpenDoor/>   <!-- 方案1：先试着开门 -->
  <PickLock/>   <!-- 方案2：不行就撬锁 -->
  <SmashDoor/>  <!-- 方案3：再不行就砸门 -->
</Fallback>
```

**详解版**：回退节点（也称为"选择节点"）能够表达回退策略，即当一个子节点返回"失败"时下一步该做什么。它会按顺序 tick 子节点，并且：

- 如果一个子节点返回"失败"，则 tick 下一个子节点；
- 如果一个子节点返回"成功"，则不再 tick 后续子节点，并且该回退节点返回"成功"；
- 如果所有子节点都返回"失败"，那么该回退节点也返回"失败"。
- 这类节点在其他框架中被称为"选择器"或"优先级节点"，其目的是尝试不同的策略，直到找到一种"有效"的策略。

目前框架提供三种节点：`Fallback`、`AsyncFallback`、`ReactiveFallback`。它们遵循以下规则：

- 在 tick 第一个子节点之前，节点状态变为"运行中"；
- 如果一个子节点返回"失败"，则回退节点会 tick 下一个子节点；
- 如果最后一个子节点也返回"失败"，则所有子节点都会被中止，并且回退节点返回"失败"；
- 如果一个子节点返回"成功"，则回退节点停止并返回"成功"，所有子节点都会被中止。

```xml
<Fallback>
  <IsDoorOpen/>  <!-- 如果门已开，直接成功 -->
  <OpenDoor/>    <!-- 尝试开门 -->
  <PickLock/>    <!-- 尝试撬锁 -->
  <SmashDoor/>   <!-- 最后砸门 -->
</Fallback>
```

- 如果门已开，`IsDoorOpen` 返回 SUCCESS，Fallback 结束，不会尝试后续动作；
- 如果门关着，`IsDoorOpen` 返回 FAILURE，Fallback 依次尝试 `OpenDoor`、`PickLock`、`SmashDoor`，直到某个成功或全部失败。

#### 3.2.2 AsyncFallback（异步回退）

**详解版**：行为类似于 Fallback，但在每个子节点返回"失败"后将执行权交还给树，它返回"运行中"并发出唤醒信号，允许反应式父节点在下一个子节点被 tick 之前重新评估条件。

```xml
<ReactiveSequence>
  <IsRobotHungry/>
  <AsyncFallback>
    <FindFoodInBackpack/>
    <FindNearbyRestaurant/>
    <OrderFoodDelivery/>
  </AsyncFallback>
</ReactiveSequence>
```

在此示例中，`IsRobotHungry` 会在 `AsyncFallback` 的每次尝试之间被重新检查。如果在 `FindFoodInBackpack` 失败后机器人不再饥饿，则在 `FindNearbyRestaurant` 开始之前，回退节点会被中断。

**同步 vs 异步**（详解版）：`Fallback` 和 `AsyncFallback` 共享相同的逻辑，但在处理子节点之间的转换方式上有所不同：

- `Fallback`：在树的单次 tick 中 tick 所有子节点，当一个子节点返回"失败"时，下一个子节点会在同一次调用中立即被 tick；
- `AsyncFallback`：在每个子节点失败后将执行权交换给树，返回"运行中"并发出唤醒信号。这使得回退节点在子节点之间是可中断的，允许树的其他部分（例如一个 `ReactiveSequence` 父节点）在下一个子节点启动之前重新评估条件。

对比表：

| 控制节点类型 | 子节点返回"运行中" | 是否在子节点之间让出执行权 |
|---|---|---|
| Fallback | 再次 tick | 否 |
| AsyncFallback | 再次 tick | 是 |
| ReactiveFallback | 重新开始 | 否 |

- "再次 tick"意味着下一次回退节点被 tick 时，同一个子节点会再次被 tick。之前已经返回"失败"的兄弟节点不会被再次 tick；
- "重新开始"意味着整个回退节点从列表第一个子节点重新开始执行。

#### 3.2.3 ReactiveFallback（反应式回退）

> 入门版口诀：**条件一变，立刻切换。** 用途：当条件节点的结果变化时，能立刻中断正在执行的动作。

**详解版**：行为与 Fallback 类似，但一旦有某个先前的条件节点从 FAILURE 变为 SUCCESS，它会立即中断当前正在运行的异步子节点，并从第一个子节点重新开始。适用于需要持续监控优先级条件的场景。

```xml
<ReactiveFallback>
  <AreYouRested/>              <!-- 条件：是否已休息好 -->
  <Timeout msec="28800000">    <!-- 8小时超时 -->
    <Sleep/>
  </Timeout>
</ReactiveFallback>
```

- 初始时 `AreYouRested` 返回 FAILURE（未休息好），Fallback 进入 Timeout 子节点，开始睡眠（异步）；
- 在睡眠过程中，每次 tick 都会重新检查 `AreYouRested`。一旦条件变为 SUCCESS（比如睡眠已足够），`ReactiveFallback` 会立即中止 Timeout 子节点，并从第一个子节点重新开始。此时 `AreYouRested` 成功，Fallback 返回 SUCCESS，结束整个睡眠行为。

（入门版示例）

```xml
<!-- 睡够了就不睡了 -->
<ReactiveFallback>
  <AreYouRested/>
  <Sleep/>
</ReactiveFallback>
```

#### 3.2.4 Fallback 系列对比总结

**入门版对比表：**

| 类型 | 子节点返回 RUNNING | 子节点返回 SUCCESS |
|---|---|---|
| Fallback | 下次从同一子节点继续 | 停止，返回 SUCCESS |
| ReactiveFallback | 从第一个子节点重新开始 | 停止，返回 SUCCESS |

**详解版对比表：**

| 控制节点类型 | 子节点返回"运行中" | 是否在子节点之间让出执行权 |
|---|---|---|
| Fallback | 再次 tick | 否 |
| AsyncFallback | 再次 tick | 是 |
| ReactiveFallback | 重新开始 | 否 |

### 3.3 并行节点

> 来源：详解版《九、并行节点》＋入门版《十一、并发与执行模型》

并行节点会并发执行其所有子节点，但并非在单独的线程中执行。在树的首次 tick 中，所有子节点会按顺序被 tick，但多个子节点可以同时处于"运行中"状态。

**注意**：

- "并行"指的是多个子节点可以同时处于"运行中"状态这一事实。子节点仍然在同一线程内按顺序被 tick。
- 需要注意：子节点写成异步节点（如 `StatefulActionNode`）并不等于多线程，它仍可能在行为树线程中被轮询。真正的多线程执行需要 `ThreadedAction`、`std::async` 或外部线程池等机制，并由你自己负责同步与中止。
- 并行节点是唯一允许同时有多个子节点处于"运行中"状态的节点。

框架提供两种节点：`Parallel` 和 `ParallelAll`。其中 `ParallelAll` 是较后期 4.x 版本新增的节点；如果项目使用较早的 BT.CPP 4.x，可能尚未注册该节点，使用前请确认目标版本节点列表。

#### 3.3.1 Parallel

当达到成功或失败的阈值时，该节点完成。任何剩余处于"运行中"的子节点将被中止。

| 端口 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `success_count` | 输入端口\<int\> | -1 | 需要成功才能返回"成功"的子节点数量 |
| `failure_count` | 输入端口\<int\> | 1 | 需要失败才能返回"失败"的子节点数量 |

阈值支持 Python 风格的负索引：`-1` 等同于子节点的总数。例如对于 4 个子节点，`success_count="-1"` 意味着所有 4 个子节点都必须成功。

默认行为（`success_count=-1`，`failure_count=1`）：所有子节点都必须成功；如果任何一个子节点失败，该节点返回"失败"，和 Sequence 类似，但允许子节点同时运行。

```xml
<Parallel success_count="2" failure_count="2">
  <ActionA/>
  <ActionB/>
  <ActionC/>
</Parallel>
```

在这个包含 3 个子节点的示例中：

- 如果有 2 个子节点返回"成功"（在 2 个子节点失败之前），该节点返回"成功"；
- 如果有 2 个子节点返回"失败"（在 2 个子节点成功之前），该节点返回"失败"；
- 当达到任一阈值时，剩余处于"运行中"的子节点将被终止。

**Parallel 示例**：机器人同时尝试用视觉和红外定位，只要有一种定位成功就继续；或者多个备用方案，只要其中一个完成即成功。

#### 3.3.2 ParallelAll

与 Parallel 不同，`ParallelAll` 节点总是执行所有子节点直至完成。它永远不会提前中止子节点。当需要所有副作用都完成时非常有用。

| 端口 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `max_failures` | 输入端口\<int\> | 1 | 在返回"失败"之前允许的子节点最大失败次数 |

- 如果失败次数小于 `max_failures`，则返回"成功"；
- 如果失败次数等于或超过 `max_failures`，则返回"失败"；
- 使用 `max_failures="-1"`（子节点数量）将忽略子节点结果，始终返回"成功"。

```xml
<ParallelAll max_failures="2">
  <ActionA/>
  <ActionB/>
  <ActionC/>
</ParallelAll>
```

**Parallel 与 ParallelAll 对比：**

| 特性 | Parallel | ParallelAll |
|---|---|---|
| 提前终止 | 是（达到阈值时中止子节点） | 否（总是运行所有子节点） |
| 成功阈值 | 可配置 (`success_count`) | 所有未失败子节点 |
| 失败阈值 | 可配置 (`failure_count`) | 可配置 (`max_failures`) |
| 适用场景 | 竞争条件，N 选 M 成功 | 所有任务都必须尝试完成 |

**ParallelAll 示例**：机器人在关闭前需要同时执行保存日志、关闭电机、释放资源，这些动作无论成败都需尝试执行，且不允许因某个失败而跳过其他任务。

（入门版对应示例）

```xml
<Parallel success_count="2" failure_count="1">
  <ActionA/>
  <ActionB/>
  <ActionC/>
</Parallel>

<ParallelAll max_failures="0">
  <ArmMoveTo target="A"/>
  <BaseMoveTo target="B"/>
</ParallelAll>
```

#### 3.3.3 澄清概念：并发 ≠ 并行

> 来源：入门版《十一、并发与执行模型》。

| 概念 | 含义 | BT.CPP 中的实现 |
|---|---|---|
| 并发 (Concurrency) | 多个任务"交替"执行，看起来同时 | 支持，通过 Tick 机制 |
| 并行 (Parallelism) | 多个任务"真正"同时执行（多核） | 需要自己实现 |

`ParallelNode` 实现的是逻辑并发，而不是多线程并行。执行规则：

1. 每次 Tick 时，按顺序 tick 所有子节点（不是同时）；
2. 当达到 `success_count` 个成功时，返回 SUCCESS；
3. 当达到 `failure_count` 个失败时，返回 FAILURE。

参数：`success_count`（需要多少个子节点成功才返回 SUCCESS，默认全部）、`failure_count`（需要多少个子节点失败才返回 FAILURE，默认 1）。

**实现真正的并行**：`Parallel` 本身只提供单线程的逻辑并发：一次 tick 按顺序调用各子节点，但多个子节点可以同时保持 `RUNNING`。`CoroActionNode` 只是协作式让出执行权，不会自动创建线程。若确实需要多线程，应由动作内部或外部执行器使用 `std::async`、线程池等机制，并自行处理停止、生命周期、黑板和共享对象的同步。下面的示例使用 `std::async` 才真正创建了后台工作线程；`setStatusRunningAndYield()` 只是让行为树线程让出控制权。

```cpp
class AsyncAction : public BT::CoroActionNode {
public:
    AsyncAction(const std::string& name, const BT::NodeConfig& config)
        : BT::CoroActionNode(name, config) {}

    BT::NodeStatus tick() override {
        // 启动异步操作
        auto future = std::async(std::launch::async, [this]() { return doHeavyWork(); });
        // 协程等待
        while (future.wait_for(std::chrono::milliseconds(10)) != std::future_status::ready) {
            setStatusRunningAndYield();  // 暂停，让其他节点执行
        }
        return future.get() ? BT::NodeStatus::SUCCESS : BT::NodeStatus::FAILURE;
    }
};
```

### 3.4 条件控制与 Switch 节点

> 来源：详解版《十、条件控制与 Switch 节点》＋入门版《6.2 子树切换》

这些控制节点根据条件（第一个子节点）的结果来选择执行哪个子节点。目前框架提供 `IfThenElse` 和 `WhileDoElse` 两种，都必须恰好有 2 个或 3 个子节点。

#### 3.4.1 IfThenElse：一次性条件判断

`IfThenElse` 是一个非反应式条件节点：

- 第一个子节点是条件（"if"）；
- 如果条件返回"成功"，则执行第二个子节点（"then"）；
- 如果条件返回"失败"，则返回第三个子节点（可选，"else"）；
- 如果只提供了 2 个子节点且条件返回"失败"，则该节点返回"失败"（相当于 `AlwaysFailure`）作为第三个子节点；
- 条件仅评估一次，如果第二个或第三个子节点返回"运行中"，则在后续 tick 中不会重新评估条件。

```xml
<IfThenElse>
  <IsDoorOpen/>       <!-- 条件 -->
  <WalkThrough/>      <!-- 则分支 -->
  <TryAnotherPath/>   <!-- 否则分支（可选） -->
</IfThenElse>
```

#### 3.4.2 WhileDoElse：条件循环控制

`WhileDoElse` 用于根据条件选择 `do` 或 `else` 分支。它与 `IfThenElse` 的主要区别是控制流语义，而不是简单地把它理解成“每次 tick 都无条件重新评估并立即中止当前分支”。不同版本实现可能包含分支记忆和重新进入规则；如果需要明确的持续监控和中止语义，优先使用 `ReactiveSequence`/`ReactiveFallback`，并确保长时动作正确实现 `halt()` 或 `onHalted()`。

- 第一个子节点是条件；
- 条件返回 `SUCCESS` 时选择 `do` 分支；
- 条件返回 `FAILURE` 时选择可选的 `else` 分支；
- 分支切换是否会中止正在运行的子节点，应以目标版本源码为准，不能仅依赖“反应式变体”的概括。

#### 3.4.3 两者之间的区别

| 特性 | IfThenElse | WhileDoElse |
|---|---|---|
| 条件的评估时机 | 仅一次（进入时） | 每次 tick 都重新评估 |
| 反应式切换 | 不支持 | 支持（条件变化时自动中止并切换） |
| 适用场景 | 一次性决策 | 持续监控、反应式行为 |
| 分支执行期间 | 不重新评估条件 | 持续评估，条件变化时切换 |

#### 3.4.4 Switch 节点

`Switch` 节点等同于 switch 语句：它根据黑板变量的值选择执行哪个子节点。

可用的变体有：`Switch2`、`Switch3`、`Switch4`、`Switch5`、`Switch6`，其中数字表示支持的 case 分支数量。一个 `SwitchN` 节点必须恰好有 N+1 个子节点：N 个 case 分支加上一个默认分支（始终是最后一个子节点）。

| 端口 | 类型 | 描述 |
|---|---|---|
| `variable` | 输入端口\<string\> | 用于与 case 值进行比较的黑板变量 |
| `case_1` | 输入端口\<string\> | 与第一个子节点匹配的值 |
| `case_2` | 输入端口\<string\> | 与第二个子节点匹配的值 |
| ... | ... | 最多 N 个附加 case |
| `case_N` | 输入端口\<string\> | 与第 N 个子节点匹配的值 |

变量值按顺序与每个 `case_N` 字符串进行比较，执行第一个匹配项对应的子节点。如果没有 case 匹配，则执行最后一个子节点（默认分支）。比较支持字符串、整数和双精度浮点数。通过 `ScriptingEnumsRegistry` 注册的枚举值也受支持。

```xml
<Switch3 variable="{robot_state}" case_1="IDLE" case_2="WORKING" case_3="ERROR">
  <HandleIdle/>          <!-- 当 robot_state == "IDLE" 时执行 -->
  <HandleWorking/>       <!-- 当 robot_state == "WORKING" 时执行 -->
  <HandleError/>         <!-- 当 robot_state == "ERROR" 时执行 -->
  <HandleUnknownState/>  <!-- 默认：当没有 case 匹配时执行 -->
</Switch3>
```

每次 tick 都会重新检查变量。如果当前正在运行的子节点所属的 case 不再匹配（因为变量值改变了），节点会先中止（halt）当前运行的子节点，然后立即切换到新匹配的 case（或 default）分支。这让 Switch 能够对变量的变化做出即时响应，而不需要等待当前动作完成。同样的行为可以通过使用多个序列、回退和条件来实现，但 Switch 节点更加简洁和易读。

（入门版"子树切换 SubTreeSwitch"示例，动态切换要执行的子树，类似函数指针）

```xml
<ReactiveSequence>
  <Script code="current_task := 'TaskA'"/>
  <Switch3 variable="{current_task}" case_1="TaskA" case_2="TaskB" case_3="TaskC">
    <SubTree ID="TaskA"/>
    <SubTree ID="TaskB"/>
    <SubTree ID="TaskC"/>
    <AlwaysFailure/>   <!-- 默认情况 -->
  </Switch3>
</ReactiveSequence>
```

---

## 第四部分 装饰节点大全

> 来源：入门版《第四部分：装饰节点详解》＋ 详解版《十一、装饰节点大全》＋入门版《第九部分：前置条件和后置条件》的 Precondition 部分

装饰节点只有一个子节点，用于修改子节点的行为或结果。装饰器决定是否、何时以及多少次 tick 其子节点。

### 4.1 结果修改类

#### 4.1.1 Inverter（取反器 / 反转节点）

**作用**：把子节点的结果反过来。

转换规则（入门版）：

- `SUCCESS` → `FAILURE`
- `FAILURE` → `SUCCESS`
- `RUNNING` → `RUNNING`（保持不变）

**详解版**：tick 子节点一次，如果子节点失败则返回成功，如果子节点成功则返回失败；如果子节点返回"运行中"，则该节点也返回"运行中"。

```xml
<Inverter>
  <IsDoorOpen/>
</Inverter>
<!-- 相当于 "门是否关着？" -->

<Inverter>
  <IsDoorClosed/>  <!-- 假设门关着时返回 SUCCESS，取反后变成 FAILURE -->
</Inverter>
```

#### 4.1.2 ForceSuccess / ForceFailure

**详解版**：

- `ForceSuccess`：如果子节点返回"运行中"，则该节点也返回"运行中"；否则，它总是返回成功。
- `ForceFailure`：如果子节点返回"运行中"，则该节点也返回"运行中"；否则，它总是返回失败。

```xml
<!-- 无论子节点结果如何，都返回 SUCCESS -->
<ForceSuccess>
  <TryOpenDoor/>
</ForceSuccess>

<!-- 无论子节点结果如何，都返回 FAILURE -->
<ForceFailure>
  <SomeAction/>
</ForceFailure>
```

### 4.2 执行控制类

#### 4.2.1 Retry / RetryUntilSuccessful（重试）

**入门版**：作用——子节点失败时自动重试。参数 `num_attempts`：最大重试次数。

**详解版**：只要子节点返回失败，就 tick 子节点，最多 N 次。

| 端口 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `num_attempts` | 输入端口\<int\> | （必需） | 尝试次数，使用 -1 表示无限重试 |

- 如果子节点返回成功，则立即返回成功（循环中断）；
- 如果所有 N 次尝试都耗尽，则返回失败；
- 如果子节点返回"运行中"，则返回"运行中"；尝试计数器不会递增，并且在下一次 tick 时继续执行同一迭代；
- 如果子节点返回"已跳过"，子节点会被重置，并返回"已跳过"。

```xml
<RetryUntilSuccessful num_attempts="3">
  <OpenDoor/>
</RetryUntilSuccessful>
<!-- 最多尝试3次，任意一次成功就返回 SUCCESS -->
<!-- 注意：BT.CPP 4.x 默认注册的节点名是 RetryUntilSuccessful；
     若使用 <Retry>，需确认所用版本是否注册了该别名，否则 XML 加载会失败 -->
```

#### 4.2.2 Repeat（重复）

**入门版**：作用——让子节点重复执行多次。参数 `num_cycles`：重复次数（-1 表示无限重复）。

**详解版**：只要子节点返回成功，就 tick 子节点，最多 N 次。

| 端口 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `num_cycles` | 输入端口\<int\> | （必需） | 重复次数，使用 -1 表示无限循环 |

- 如果所有 N 次重复都成功完成，则返回成功；
- 如果子节点返回失败，则立即返回失败（循环终止）；
- 如果子节点返回"运行中"，则返回"运行中"；计数器不会递增，并且在下一次 tick 时继续执行同一次迭代；
- 如果子节点返回"已跳过"，子节点会被重置，计数器不会递增。

```xml
<Repeat num_cycles="5">
  <CaptureFrame/>
</Repeat>
<!-- 拍摄 5 帧 -->

<Repeat num_cycles="3">
  <ClapYourHandsOnce/>
</Repeat>
```

#### 4.2.3 Timeout（超时）

**入门版**：作用——限制子节点的执行时间。

**详解版**：如果运行中的子节点运行时间超过给定持续时间，则中止它。这与 Delay 相反：Delay 在 tick 子节点之前等待，而 Timeout 则会中断耗时过长的子节点。

| 端口 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `msec` | 输入端口\<unsigned\> | （必需） | 超时持续时间（毫秒） |

- 如果子节点在超时之前完成（成功或失败），则返回其状态；
- 如果超时时间到期时子节点仍处于"运行中"状态，则它会被中止，并返回失败。

```xml
<Timeout msec="5000">
  <SearchForObject/>
</Timeout>
<!-- 搜索最多5秒，超时返回 FAILURE -->

<Timeout msec="5000">
  <KeepYourBreath/>
</Timeout>
```

> 提示：将 Timeout 与 RetryUntilSuccessful 结合使用，可以形成一个强大的带超时的重试模式：

```xml
<!-- 重试超时模式：最多尝试 3 次，每次超时 5 秒 -->
<RetryUntilSuccessful num_attempts="3">
  <Timeout msec="5000">
    <LongRunningAction/>
  </Timeout>
</RetryUntilSuccessful>
```

#### 4.2.4 Delay（延迟）

**入门版**：作用——在执行子节点前等待一段时间。

**详解版**：在指定的时间过去后 tick 子节点，延迟时间通过输入端口 `delay_msec` 指定。如果子节点返回"运行中"，则该节点也返回"运行中"，并将在 Delay 节点的下一次 tick 时 tick 子节点；否则，返回子节点的状态。

```xml
<Delay delay_msec="2000">
  <StartInspection/>
</Delay>
<!-- 等待 2 秒后再启动巡检 -->

<Delay delay_msec="3000">
  <SaySomething message="Delay finished!"/>
</Delay>
```

#### 4.2.5 KeepRunningUntilFailure

**入门版**：作用——只要子节点成功，就一直执行。

转换规则：

- `SUCCESS` → `RUNNING`（继续执行）
- `FAILURE` → `FAILURE`（停止）
- `RUNNING` → `RUNNING`

**详解版**：`KeepRunningUntilFailure` 节点总是返回失败（子节点失败）或运行中（子节点成功或运行中）。

```xml
<KeepRunningUntilFailure>
  <Patrol/>
</KeepRunningUntilFailure>

<KeepRunningUntilFailure>
  <MonitorBattery/>
  <!-- 假设 MonitorBattery 一直返回 SUCCESS，
       则 KeepRunningUntilFailure 永远返回 RUNNING，直到电池耗尽返回 FAILURE -->
</KeepRunningUntilFailure>
```

#### 4.2.6 RunOnce

**入门版**：作用——子节点只执行一次，之后跳过。

```xml
<RunOnce>
  <Initialize/>
</RunOnce>
<!-- 初始化只做一次 -->
```

**详解版**：当你想只执行子节点一次时使用 `RunOnce` 节点；如果子节点是异步的，它会持续 tick 直到返回成功或失败。在首次执行后，可以将输入端口 `then_skip` 的值设置为：

- `TRUE`（默认），该节点将来会被跳过；
- `FALSE`，同步返回子节点返回的状态，永久如此。

```xml
<RunOnce then_skip="true">
  <InitializeRobot/>
</RunOnce>
```

#### 4.2.7 Precondition（前置条件节点）

**详解版**：`Precondition` 装饰器在 tick 其子节点之前评估一个脚本条件。

| 端口 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `if` | 输入端口\<string\> | （必需） | 要评估的脚本条件 |
| `else` | 输入端口\<NodeStatus\> | FAILURE | 如果条件为假，则返回的状态 |

- `Precondition` 装饰器在 tick 子节点前根据 `if` 脚本决定是否执行，并由 `else` 指定条件不满足时的返回状态。
- 不同 4.x 小版本对条件在子节点处于 `RUNNING` 时是否重评估、以及分支切换时是否 halt 子节点，可能存在实现差异；`else="RUNNING"` 不应被理解为“自动停止动作并重新开始”。
- 如果必须在动作运行期间持续检查条件并中止动作，优先使用 `_while` 前置条件或 `ReactiveSequence`/`ReactiveFallback`，并在动作的 `halt()`/`onHalted()` 中实现真正的取消逻辑。

```xml
<Precondition if="battery_level > 20" else="FAILURE">
  <MoveToGoal/>
</Precondition>
```

如果需要在子节点运行时持续检查条件，不要把 `else="RUNNING"` 当成通用的中止机制；请使用目标版本明确支持的 `_while` 前置条件或反应式控制节点：

```xml
<Precondition if="battery_ok" else="RUNNING">
  <LongRunningAction/>
</Precondition>
```

使用 `else="RUNNING"`，如果条件变为假，装饰器返回 "运行中" 而不是 "失败"，从而不会直接让父节点按失败处理。

但请特别注意：这只改变返回值语义，**不等于自动中止子节点**。要真正中止正在运行的动作，必须使用 `_while` 前置条件或反应式控制节点触发 `halt()`，并在节点中实现 `onHalted()`/取消逻辑。

（入门版同一示例）

```xml
<!-- 仅在电池电量高于 20 时执行，否则返回 FAILURE -->
<Precondition if="battery_level > 20" else="FAILURE">
  <MoveToGoal/>
</Precondition>
```

#### 4.2.8 SubTree 与 SimpleDecoratorNode

**SubTree**（子树节点）：参阅第六部分"子树与模块化开发"。需要在 C++ 中注册其他的装饰器，例如使用 `factory.registerNodeType<ConsumeQueue<Pose2D>>("ConsumeQueue")` 进行注册，可参考 `t18_waypoints.cpp`。

**SimpleDecoratorNode**：使用 `void BehaviorTreeFactory::registerSimpleDecorator("MyDecorator", tick_function, ports)` 注册一个简单的装饰器节点，该函数内部使用 `SimpleDecoratorNode`。其中 `tick_function` 是一个签名为 `std::function<NodeStatus(NodeStatus, TreeNode&)>` 的函数，而 `ports` 是一个 `PortsList` 类型的变量。

#### 4.3 装饰节点执行规则汇总（入门版）

- **Inverter**：反转结果（SUCCESS↔FAILURE，RUNNING 不变）。
- **ForceSuccess / ForceFailure**：无论子节点结果如何，强制返回 SUCCESS / FAILURE（RUNNING 保持）。
- **Retry**：子节点失败时自动重试，`num_attempts` 控制次数。
- **Repeat**：子节点重复执行，`num_cycles` 控制次数（-1 无限）。
- **Timeout**：限制子节点执行时间，超时返回 FAILURE。
- **Delay**：执行子节点前等待 `delay_msec` 毫秒。
- **KeepRunningUntilFailure**：只要子节点成功就一直执行。
- **RunOnce**：子节点只执行一次。

---

## 第五部分 数据流：黑板与端口

> 来源：入门版《第五部分：数据流与黑板》＋ 详解版《三、数据共享：黑板与端口》《四、进阶数据流：泛型端口》《五、最佳实践：端口与黑板的关系》《十三、节点参数与默认值配置》《十五、全局黑板与数据架构》

### 5.1 黑板（Blackboard）概念

**入门版**：在同一黑板作用域内，黑板就像一块共享的“白板”；进入子树后，还要考虑子树黑板的作用域和端口重映射。

```
┌─────────────────────────────────────────┐
│ 黑板 (Blackboard)                       │
├─────────────────────────────────────────┤
│ enemy_position = {x: 10, y: 20}         │
│ battery_level  = 85                     │
│ target_id      = "robot_001"            │
│ ...                                     │
└─────────────────────────────────────────┘
     ↑          ↑          ↑
   节点A写入   节点B读取   节点C读写
```

**详解版**：在 BehaviorTree.CPP 中，黑板是按树和子树作用域组织的键值存储，用于在节点之间共享数据。节点通常通过端口声明数据依赖，再用 XML 重映射把端口连接到当前作用域或父作用域的黑板键；因此它不是一个无条件的全局变量表。

**黑板的作用**：

- **数据共享**：让树中的不同节点（比如条件节点、动作节点）能够访问共同的数据，例如机器人的目标位置、传感器读数、状态标志等；
- **解耦节点**：节点不再需要知道数据来自哪个具体的节点，只需要知道黑板上的某个键（key）即可，这使得节点可以被复用，只要黑板上有它需要的数据；
- **支持端口映射**：节点通过端口（port）声明自己需要哪些输入数据、会产生哪些输出数据。在 XML 中，可以将这些端口"重映射"到黑板的某个键上，从而把节点的数据和黑板连接起来。

**黑板在 XML 中的使用**：在 XML 中，黑板键用花括号 `{}` 表示：

```xml
<SaySomething message="{my_message}"/>
<!-- 表示 SaySomething 节点的 message 端口会从黑板上读取键名为 my_message 的值，
     如果黑板上有 my_message，那么节点就会用这个值来输出 -->

<StoreValue value="{result}"/>
<!-- 同样也可以把节点的输出写入黑板 -->
```

### 5.2 端口（Ports）系统

**入门版**：端口是节点与黑板之间的"数据接口"。

| 端口类型 | 作用 | 比喻 |
|---|---|---|
| `InputPort` | 从黑板读取数据 | 输入管道 |
| `OutputPort` | 向黑板写入数据 | 输出管道 |
| `BidirectionalPort` | 既读又写 | 双向管道 |

**什么时候用 BidirectionalPort？** 使用场景：节点需要读取某个值然后修改它；多个节点需要共享并更新同一个变量；计数器、累加器、状态标记等。

```xml
<!-- 大括号 {} 表示从黑板读取变量 -->
<MoveTo goal="{target_position}"/>

<!-- 不带大括号，表示直接赋值 -->
<MoveTo goal="1;2;3"/>

<!-- 输出到黑板 -->
<ScanForTarget target="{detected_enemy}"/>

<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence>
      <!-- 第一个节点初始化 counter -->
      <MyNode counter="{counter}" />
      <!-- 第二个节点读取并修改 counter -->
      <MyNode counter="{counter}" />
      <!-- 第三个节点继续读取并修改 -->
      <MyNode counter="{counter}" />
    </Sequence>
  </BehaviorTree>
</root>
```

**详解版端口概念**：端口是声明自己需要哪些输入、会产生哪些输出的接口。在 XML 中，端口的赋值有两种方式：

- **静态字符串**：直接写值，例如 `message="hello world"`；
- **黑板键引用**：用大括号括起来，例如 `message="{greetings}"`，表示从黑板的 `greetings` 读取键值（或写入键值）。

```xml
<SaySomething name="first"  message="hello world" />
<SaySomething name="second" message="{greetings}" />
```

第一个节点中，端口接收到字符串 "hello world"；第二个节点中，被要求使用条目 `greetings` 在黑板上查找该值。

**定义带端口的节点**（详解版完整讲解）：

```cpp
// 带输入端口的同步动作节点
class SaySomething : public BT::SyncActionNode {
public:
    // 如果你的节点有端口，你必须使用这个构造函数签名
    SaySomething(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}

    // 必须定义这个静态方法
    static BT::PortsList providedPorts() {
        return { BT::InputPort<std::string>("message") };
    }

    BT::NodeStatus tick() override {
        BT::Expected<std::string> msg = getInput<std::string>("message");
        if (!msg) throw BT::RuntimeError("缺少必需的输入 [message]: ", msg.error());
        std::cout << "机器人说: " << msg.value() << std::endl;
        return BT::NodeStatus::SUCCESS;
    }
};
```

**输出端口**（用输出端口将字符串写入条目的节点示例）：

```cpp
class ThinkWhatToSay : public BT::SyncActionNode {
public:
    ThinkWhatToSay(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}

    static BT::PortsList providedPorts() {
        return { BT::OutputPort<std::string>("text") };
    }

    // 这个动作将一个值写入端口 "text"
    BT::NodeStatus tick() override {
        // 输出可能在每次 tick() 时改变。这里我们保持简单。
        setOutput("text", "答案是42");
        return BT::NodeStatus::SUCCESS;
    }
};
```

为了调试，可以使用名为 `Script` 的内置动作将一个静态值写入条目：

```xml
<Script code="the_answer:='答案是42'" />
```

**输入端口和输出端口连接**：通过相同的黑板键实现连接。

```xml
<Sequence>
  <SaySomething   message="hello" />              <!-- 静态输入 -->
  <ThinkWhatToSay text="{the_answer}" />          <!-- 输出到黑板键 the_answer -->
  <SaySomething   message="{the_answer}" />       <!-- 从黑板键 the_answer 输入 -->
</Sequence>
```

### 5.3 进阶数据流：泛型端口

> 来源：详解版《四、进阶数据流：泛型端口》

**泛型端口的作用**：在实际机器人应用中，节点之间传递的数据往往不是简单的字符串，可能是坐标、速度、姿态等自定义结构体。泛型端口允许直接在节点间传递这些类型，同时保持 XML 的灵活性。

**核心机制：字符串 ↔ 自定义类型的转换**。由于 XML 中所有属性值本质都是字符串，当端口类型不是 `std::string` 时，库需要知道如何将字符串解析成自定义类型。这个转换是通过特化 `BT::convertFromString` 模板函数实现的。

例如，我们想使用这个自定义类型：

```cpp
struct Position2D { double x; double y; };
```

为了允许 XML 从字符串实例化 `Position2D`，需要提供一个 `BT::convertFromString<Position2D>(StringView)` 的模板特化：

```cpp
// 模板特化，用于将字符串转换为 Position2D
namespace BT {
template <> inline Position2D convertFromString(StringView str) {
    // 我们期望由分号分隔的实数
    auto parts = splitString(str, ';');
    if (parts.size() != 2) {
        throw RuntimeError("无效输入");
    } else {
        Position2D output;
        output.x = convertFromString<double>(parts[0]);
        output.y = convertFromString<double>(parts[1]);
        return output;
    }
}
} // end namespace BT
```

- `StringView` 是轻量级字符串，可接受 `std::string` 或 `const char*`；
- `splitString` 是库提供的辅助函数，也可以使用其他字符串分割方法；
- `convertFromString<double>` 是库内置的 double 转换，这里复用它来转换每个坐标分量；
- 这样，当 XML 中出现 `"-1;3"` 这样的字符串并赋值给 `Position2D` 端口时，库会自动调用这个特化函数完成转换。

**示例 1：一写一读两个自定义动作**

```cpp
class CalculateGoal : public BT::SyncActionNode {
public:
    CalculateGoal(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}
    static BT::PortsList providedPorts() {
        return { BT::OutputPort<Position2D>("goal") };
    }
    BT::NodeStatus tick() override {
        Position2D mygoal = {1.1, 2.3};
        setOutput<Position2D>("goal", mygoal);
        return BT::NodeStatus::SUCCESS;
    }
};

class PrintTarget : public BT::SyncActionNode {
public:
    PrintTarget(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}
    static BT::PortsList providedPorts() {
        const char* description = "在控制台上简单地打印目标...";
        return { BT::InputPort<Position2D>("target", description) };
    }
    BT::NodeStatus tick() override {
        auto res = getInput<Position2D>("target");
        if (!res) throw BT::RuntimeError("读取端口 [target] 时出错:", res.error());
        Position2D target = res.value();
        printf("目标位置: [ %.1f, %.1f ]\n", target.x, target.y);
        return BT::NodeStatus::SUCCESS;
    }
};
```

**第一部分 `CalculateGoal` 类（输出节点）**：

- **作用**：计算一个目标位置（这里是硬编码的 (1.1, 2.3)），并将它写入黑板，供其他节点使用。这是一个输出节点：通过输出端口将数据"发布"到黑板。
- **关键**：
  - 构造函数：必须接受 `name` 和 `config`，并传递给基类 `SyncActionNode`，因为带端口的节点需要 `NodeConfig` 来获取黑板引用等信息；
  - `providedPorts()`：静态方法，声明拥有的端口，这里声明了一个名为 "goal" 的输出端口，类型为 `Position2D`；
  - `tick()`：创建一个 `Position2D` 对象 `mygoal`；调用 `setOutput<Position2D>("goal", mygoal)` 将 `mygoal` 的值写入与该输出端口关联的黑板条目（具体的黑板键由 XML 中的重映射决定）；返回 SUCCESS 表示动作立即完成。

**第二部分 `PrintTarget` 类（输入节点）**：

- **作用**：从黑板读取一个目标位置，并打印到控制台。它是一个输入节点：通过输入端口从黑板获取数据。
- **关键**：
  - 构造函数：同样需要 `name` 和 `config`；
  - `providedPorts()`：声明一个名为 "target" 的输入端口，类型为 `Position2D`，并附带一个描述字符串（可选）；
  - `tick()`：调用 `getInput<Position2D>("target")` 从黑板取值，返回值是一个 `Expected<Position2D>` 对象，它封装了可能存在的错误；检查 `res` 是否有效：如果无效（例如端口未赋值、类型不匹配或黑板键不存在），则抛出运行时异常；如果有效，通过 `res.value()` 获取实际的 `Position2D` 对象，并打印其坐标；返回 SUCCESS。

**示例 2**：这个示例中的树是一个由 4 个动作组成的序列：

- 使用 `CalculateGoal` 动作，在 `GoalPosition` 条目中存储一个 `Position2D` 值；
- 调用 `PrintTarget`，其输入 "target" 将从黑板条目 `GoalPosition` 中读取；
- 使用内置动作 `Script` 将字符串 "-1;3" 赋值给键 `OtherGoal`。从字符串到 `Position2D` 的转换将自动完成；
- 再次调用 `PrintTarget`，其输入 "target" 将从条目 `OtherGoal` 中读取。

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence name="root">
      <CalculateGoal goal="{GoalPosition}" />
      <PrintTarget   target="{GoalPosition}" />
      <Script code="OtherGoal:='-1;3'" />
      <PrintTarget   target="{OtherGoal}" />
    </Sequence>
  </BehaviorTree>
</root>
```

这个序列节点包含了四个子节点，按顺序执行：

- `<CalculateGoal goal="{GoalPosition}" />`：调用自定义节点 `CalculateGoal`，其输出端口 `goal` 被重映射到黑板键 `GoalPosition`，节点执行时会将一个硬编码的 `Position2D` 值写入；
- `<PrintTarget target="{GoalPosition}" />`：调用自定义节点 `PrintTarget`，其输入端口 `target` 重映射到同一个黑板键 `GoalPosition`，因此它会读取之前写入的值并打印；
- `<Script code="OtherGoal:='-1;3'" />`：内置的 `Script` 节点执行一段简单的脚本，将字符串 "-1;3" 赋值给黑板键 `OtherGoal`。语法 `OtherGoal:='-1;3'` 表示将该字符串写入黑板键；
- `<PrintTarget target="{OtherGoal}" />`：再次调用 `PrintTarget`，但这次输入端口 `target` 重映射到黑板键 `OtherGoal`。由于该键存储的是字符串 "-1;3"，而 `PrintTarget` 的端口类型是 `Position2D`，库会自动调用 `convertFromString` 将字符串解析为 `Position2D(-1.0, 3.0)`，然后打印。

C++ 调用：

```cpp
static const char* xml_text = R"(
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence name="root">
      <CalculateGoal goal="{GoalPosition}" />
      <PrintTarget target="{GoalPosition}" />
      <Script code="OtherGoal:='-1;3'" />
      <PrintTarget target="{OtherGoal}" />
    </Sequence>
  </BehaviorTree>
</root>
)";

int main() {
    BT::BehaviorTreeFactory factory;
    factory.registerNodeType<CalculateGoal>("CalculateGoal");
    factory.registerNodeType<PrintTarget>("PrintTarget");
    auto tree = factory.createTreeFromText(xml_text);
    tree.tickWhileRunning();
    return 0;
}
/* 预期输出:
目标位置: [ 1.1, 2.3 ]
转换字符串: "-1;3"
目标位置: [ -1.0, 3.0 ]
*/
```

- 使用 BT 库内置的工厂类，用于注册自定义节点类型；
- 注册节点：将 `CalculateGoal` 和 `PrintTarget` 类分别与 XML 标签名关联；
- 从文本创建树：`createTreeFromText` 解析 XML 字符串，构建行为树实例。此时，工厂会检查端口类型是否匹配，并建立黑板与端口的连接；
- 执行树：`tickWhileRunning()` 反复 tick 根节点（这里是序列），直到树返回成功或失败。由于所有子节点都返回 SUCCESS，序列会一次执行所有子节点，然后返回成功，`tickWhileRunning` 停止。

### 5.4 最佳实践：端口与黑板的关系

> 来源：详解版《五、最佳实践：端口与黑板的关系》

端口是一种为黑板添加了一层间接寻址和额外语义的接口。

**1. 本质区别**

- 黑板是按树/子树作用域管理的键值存储；节点直接访问黑板时，访问的是自己所属配置中的黑板，而不是无条件的全局存储；
- 端口是在节点上定义的接口，通过它声明需要哪些输入、产生哪些输出，然后在 XML 中将端口重映射到当前作用域或父作用域的黑板键；
- 端口相当于在黑板上增加了一层间接访问和语义约束，让数据流更清晰、可维护。

**2. 推荐使用端口的原因**

**2.1 支持模型驱动开发**

节点之间的数据流的描述必须是模型的一部分。此外，还想明确表达黑板条目是被写入（输出）、读取（输入）还是两者兼具。如果输入/输出端口是模型的一部分，节点的意图及其与其他节点的关系就变得更加明确。

端口是节点模型的一部分。可以通过查看节点的 `providedPorts()`，知道它需要什么输入、会产生什么输出，而无需阅读代码或文档。外部工具如 Groot2 可以利用这些模型来提供可视化编辑、静态检查等功能。对比：如果节点直接读写黑板，只能通过阅读源码或文档来了解它的数据依赖，这容易出错且难以维护。

**2.2 节点的可组合性与子树作用域**

理想情况下，允许行为设计者构建由不同供应商/用户实现的树（即"组合节点"）。但是，当直接使用黑板时，名称冲突会立即成为一个问题：

- 不同开发者编写的节点可能使用相同的黑板键名（如 `target`），但含义和类型可能完全不同。如果直接使用黑板，这些节点就无法在同一个树中共存；
- 端口通过重映射解决了这个问题：即使节点内部使用 `target` 端口，可以在 XML 上将它映射到任何黑板键（如 `move_target` 或 `grasp_target`），从而避免冲突。

每个子树拥有独立的黑板实例，端口重映射让子树内部使用的键名与外部解耦，保证了子树的复用性和隔离性。如果节点直接读写黑板，则会破坏这种隔离，使得子树内部的黑板键与外部混合，难以复用。

**3. 直接访问黑板的坏处**

应该这样写：

```cpp
// 在你的 tick() 中的示例代码
getInput("goal", goal);
setOutput("result", result);
```

不应该这样写：

```cpp
// 不推荐：直接访问黑板
config().blackboard->get("goal", goal);
config().blackboard->set("result", result);
```

- 硬编码键名："goal" 和 "result" 固定在了代码中，要改变它们必须重新编译程序，而使用端口时，可以在 XML 中动态重映射；
- 缺乏自描述：别人无法通过节点声明知道它使用了哪些黑板键，只能阅读源码或文档；
- 工厂无法检查：`BehaviorTreeFactory` 在加载 XML 时无法验证这些直接访问的键是否有效、类型是否正确，容易在运行时出错；
- 与子树机制不兼容：直接访问黑板会绕过子树的隔离性，导致数据混乱；
- 转换函数失效：如果为自定义类型定义了 `convertFromString`，它只会在端口赋值时自动调用；直接使用黑板则不会触发这个转换，导致类型解析困难。

**4. 黑板的零拷贝访问（进阶）**

在 BehaviorTree.CPP 中，默认情况下黑板使用值语义，即通过 `getInput` 和 `setOutput` 读写黑板条目时，会复制数据。这对于小型数据没有问题，但是对于大型或不可拷贝对象（如点云、图像等），复制开销很大，甚至不可能。此时需要引用语义——直接访问黑板中存储的对象本身。

**方法一：使用 `std::shared_ptr` 包装对象（值语义的"假引用"）**

假设有这样一个行为树：

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="SegmentCup">
    <Sequence>
      <AcquirePointCloud cloud="{pointcloud}"/>
      <SegmentObject obj_name="cup" cloud="{pointcloud}" obj_pose="{pose}"/>
    </Sequence>
  </BehaviorTree>
</root>
```

`AcquirePointCloud` 将写入黑板条目 `pointcloud`，`SegmentObject` 将从该条目读取。使用端口进行访问：

```cpp
BT::PortsList AcquirePointCloud::providedPorts() {
    return { BT::OutputPort<std::shared_ptr<Pointcloud>>("cloud") };
}
BT::PortsList SegmentObject::providedPorts() {
    return { BT::InputPort<std::string>("obj_name"),
             BT::InputPort<std::shared_ptr<Pointcloud>>("cloud"),
             BT::OutputPort<Pose3D>("obj_pose") };
}
```

- 如代码所示，在端口中声明类型为 `std::shared_ptr<T>`，这样 `getInput`/`setOutput` 复制的是智能指针（开销小），但多个节点通过指针共享同一个堆上的 T 对象；
- `getInput` 和 `setOutput` 方法可以像往常一样使用，并且仍然具有值语义，但由于被复制的对象是 `shared_ptr`，实际上是通过引用来访问 `Pointcloud` 实例；
- 缺点：不是线程安全。如果多个节点（尤其是异步节点）在不同线程中同时访问同一个裸指针指向的对象，可能产生数据竞争，因此不推荐在多线程环境使用。

**方法二：使用 `getLockedPortContent` + `castPtr`（线程安全）**

首先，在创建端口时，可以直接使用普通的 `Pointcloud`，无需将其包装在 `std::shared_ptr` 中：

```cpp
BT::PortsList AcquirePointCloud::providedPorts() {
    return { BT::OutputPort<Pointcloud>("cloud") };
}
BT::PortsList SegmentObject::providedPorts() {
    return { BT::InputPort<std::string>("obj_name"),
             BT::InputPort<Pointcloud>("cloud"),
             BT::OutputPort<Pose3D>("obj_pose") };
}
```

然后通过指针/引用访问 `Pointcloud` 的实例：

```cpp
// 在下面的作用域内，只要 "any_locked" 存在，保护 "cloud" 实例的互斥锁就会保持锁定状态
if (auto any_locked = getLockedPortContent("cloud")) {
    if (any_locked->empty()) {
        // 黑板中的条目尚未初始化。可以通过以下方式初始化它：
        any_locked.assign(my_initial_pointcloud);
    } else if (Pointcloud* cloud_ptr = any_locked->castPtr<Pointcloud>()) {
        // 成功转换为 Pointcloud*（原始类型）。使用 cloud_ptr 修改 pointcloud 实例
    }
}
```

- 端口声明时，使用原始类型（如 `Pointcloud`），不包裹智能指针；在需要访问时，调用 `getLockedPortContent("port_name")` 获得一个 `LockedPortContent` 对象，它持有黑板条目的锁，然后通过 `castPtr<T>()` 获取类型安全的指针；
- 如果条目尚未初始化，可以调用 `assign()` 赋值；
- 必须在 `tick()` 中获取锁，并且尽快释放（即让 `LockedPortContent` 对象析构），避免长时间锁住黑板。

### 5.5 向节点传递额外参数（C++ 侧）

> 来源：详解版《十三、节点参数与默认值配置》

前面的示例中我们被"强制"提供一个具有以上签名的构造函数：

```cpp
MyCustomNode(const std::string& name, const BT::NodeConfig& config);
```

在某些情况下，会希望向类的构造函数传递额外的参数、指针、引用。从理论上来说，这些参数可以使用输入端口传递，但如果满足以下条件，这样做就是错误的方式：

- 黑板/端口适合运行时动态变化的数据，比如传感器读数、目标位置等；
- 如果参数在构建树时就已经确定（例如算法参数、硬件接口指针），并且不会在运行时改变，那么用黑板/端口反而会增加不必要的复杂性和开销；
- 文档强调：不要滥用黑板，固定参数应该直接通过构造函数或初始化函数传入。

**方法一：修改构造函数，直接传递参数**

原理：在自定义节点的构造函数中，除了必需的 `name` 和 `config`，再添加需要的参数；注册节点时，将这些参数一并传给工厂。

```cpp
class Action_A : public BT::SyncActionNode {
public:
    Action_A(const std::string& name, const BT::NodeConfig& config,
             int arg_int, std::string arg_str)
        : BT::SyncActionNode(name, config), _arg1(arg_int), _arg2(arg_str) {}

    static BT::PortsList providedPorts() { return {}; }  // 此示例不需要任何端口
    BT::NodeStatus tick() override { /* tick() 可以访问私有成员 */ }
private:
    int _arg1;
    std::string _arg2;
};

// 注册方式
BT::BehaviorTreeFactory factory;
// 将参数 42 和 "hello world" 传递给每个新建的 Action_A 实例
factory.registerNodeType<Action_A>("Action_A", 42, "hello world");
// 或者显式指定模板参数类型
// factory.registerNodeType<Action_A, int, std::string>("Action_A", 42, "hello world");
```

- 工厂在创建 `Action_A` 节点时，会自动调用带这些参数的构造函数；
- 注意：所有用 "Action_A" 标签创建的节点都会获得相同的参数值。如果每个实例需要不同值，看方法二。

**方法二：使用 initialize 方法，按需初始化**

适用场景：同一个节点类型的不同实例需要不同的参数值（例如多个移动目标点，但每个点的坐标固定且已知）；希望 XML 中只写标签，参数值在代码中按实例分别设置。

原理：节点仍然使用标准构造函数（只有 `name` 和 `config`）；添加一个自定义的 `initialize(...)` 方法，在树创建后、执行前，通过遍历树的方式为每个节点实例设置参数。

```cpp
class Action_B : public BT::SyncActionNode {
public:
    Action_B(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}

    // 我们希望这个方法在第一次 tick() 之前被调用一次
    void initialize(int arg_int, const std::string& arg_str) {
        _arg1 = arg_int; _arg2 = arg_str;
    }
    static BT::PortsList providedPorts() { return {}; }
    BT::NodeStatus tick() override;
private:
    int _arg1;
    std::string _arg2;
};

// 注册与初始化
BT::BehaviorTreeFactory factory;
factory.registerNodeType<Action_B>("Action_B");   // 标准注册
auto tree = factory.createTreeFromText(xml_text); // 树中包含多个 <Action_B> 标签

// 定义一个访问器，遍历所有节点，找到 Action_B 实例并调用 initialize
auto visitor = [](BT::TreeNode* node) {
    if (auto* action_b = dynamic_cast<Action_B*>(node)) {
        action_b->initialize(69, "interesting_value"); // 每个实例可传不同值
    }
};
tree.applyVisitor(visitor); // 应用访问器，初始化所有 Action_B 节点
```

- `applyVisitor` 会遍历树中的所有节点，对每个节点调用 visitor 函数；
- 在 visitor 中，可以根据节点的名称或其他属性，给不同的实例传入不同的值；
- 这样，XML 中的每个 `<Action_B>` 标签都可以在代码中被赋予个性化的参数。

**入门版补充的四种传参方式汇总**：

| 方法 | 推荐使用场景 |
|---|---|
| 用黑板 | 当多个节点需要访问同一份数据（如机器人 API、传感器数据） |
| 用 NodeBuilder | 当节点需要外部依赖（如数据库连接、API 客户端），但参数固定 |
| 用 initialize | 当 XML 中同一个节点类型出现多次，每次需要不同参数 |
| 用扩展构造函数 | 当参数是简单的固定值（如超时时间、阈值） |

NodeBuilder 示例（入门版）：

```cpp
// 自定义构造函数
class ActionWithExtraArg : public BT::SyncActionNode {
    std::shared_ptr<RobotAPI> robot_;
public:
    ActionWithExtraArg(const std::string& name, const BT::NodeConfig& config,
                       std::shared_ptr<RobotAPI> robot)
        : BT::SyncActionNode(name, config), robot_(robot) {}
    // ...
};

// 注册时使用 builder
factory.registerBuilder<ActionWithExtraArg>(
    "ActionWithExtraArg",
    [robot](const std::string& name, const BT::NodeConfig& config) {
        return std::make_unique<ActionWithExtraArg>(name, config, robot);
    });
```

扩展构造函数示例（入门版）：

```cpp
class Action_A : public BT::SyncActionNode {
public:
    Action_A(const std::string& name, const BT::NodeConfig& config,
             int arg_int, std::string arg_str)
        : BT::SyncActionNode(name, config), _arg1(arg_int), _arg2(arg_str) {}
    static BT::PortsList providedPorts() { return {}; }
    BT::NodeStatus tick() override { /* 使用 _arg1 和 _arg2 */ }
private:
    int _arg1;
    std::string _arg2;
};
// 注册时传递额外参数
factory.registerNodeType<Action_A>("Action_A", 42, "hello world");
```

通过黑板共享资源（入门版）：

```cpp
// 在创建树之前设置
auto blackboard = BT::Blackboard::create();
blackboard->set<std::shared_ptr<RobotAPI>>("robot_api", robot);
auto tree = factory.createTree("MainTree", blackboard);

// 在节点中获取
class MyAction : public BT::SyncActionNode {
    BT::NodeStatus tick() override {
        auto robot = config().blackboard->get<std::shared_ptr<RobotAPI>>("robot_api");
        robot->doSomething();
        return BT::NodeStatus::SUCCESS;
    }
};
```

### 5.6 默认端口值

> 来源：详解版《十三、节点参数与默认值配置》第 2 节

在大型行为树中，很多端口经常使用相同的值（例如固定的坐标、常用的黑板键），每次在 XML 中写一遍会很冗余。通过为端口设置默认值，可以让 XML 更简洁。

**输入端口（InputPort）的默认值设置**——在 `providedPorts()` 中声明输入端口时，可以附加一个默认值参数，支持四种方式：

```cpp
static BT::PortsList providedPorts() {
    return {
        BT::InputPort<Point2D>("input"),                             // 无默认值，必须提供
        BT::InputPort<Point2D>("pointA", Point2D{1, 2}, "默认值为 x=1,y=2"),
        BT::InputPort<Point2D>("pointB", "3,4", "默认值为 x=3,y=4"),
        BT::InputPort<Point2D>("pointC", "{point}", "默认从黑板 point 读取"),
        BT::InputPort<Point2D>("pointD", "{=}", "默认从同名黑板键 pointD 读取")
    };
}
```

- 第一个端口（`input`）没有默认值，因此必须在 XML 中提供值或黑板条目。

**2.1.1 直接提供 C++ 值**：

```cpp
BT::InputPort<Point2D>("pointA", Point2D{1, 2}, "描述：默认值为 x=1, y=2");
// 当 XML 中没有为 pointA 指定值时，节点将收到默认的 Point2D(1,2)
```

**2.1.2 提供字符串（利用 convertFromString 转换）**：

```cpp
BT::InputPort<Point2D>("pointB", "3,4", "默认值为 x=3, y=4");
// 前提是已经为 Point2D 特化了 convertFromString（例如能从 "3,4" 解析出坐标）。
// 最终效果与直接给 Point2D{3,4} 相同，但允许用字符串表达默认值，更适合在 XML 中直接写
```

**2.1.3 默认指向某个黑板条目**：

```cpp
BT::InputPort<Point2D>("pointC", "{point}", "默认从黑板 point 读取");
// 如果 XML 中没有为 pointC 指定值，节点会默认尝试从黑板的 point 键读取输入
// 这是一种"间接默认值"，适用于数据通常来自黑板的情况
```

**2.1.4 特殊语法 "{=}"**：

```cpp
BT::InputPort<Point2D>("pointD", "{=}", "默认从同名的黑板键 pointD 读取");
// "{=}" 是简写，表示默认使用与端口名相同的黑板键
```

**2.2 输出端口（OutputPort）的默认值**：输出端口的默认值相对受限，因为它们只能指向黑板条目（不能直接给一个固定值），仍然可以用 `{=}` 简写：

```cpp
BT::OutputPort<Point2D>("result", "{target}", "默认写入黑板 target");
// 如果 XML 中没有为 result 指定黑板键，则默认写入 target 键
// 如果希望默认写入与端口同名的键，可用 "{=}"
```

注意：输出端口不能设置固定的数值默认值，因为输出端口的作用就是向黑板写数据，所以默认值必须是一个黑板键。

### 5.7 全局黑板与数据架构

> 来源：详解版《十五、全局黑板与数据架构》

通常情况下，BT.CPP 强调"作用域黑板"，即每个子树拥有自己独立的黑板，通过端口重映射来传递数据。这有助于模块化，避免命名冲突。但在某些场景下，需要一块"全局黑板"真正共享全局的数据：

- 全局单例对象（如硬件接口、日志器）无法通过端口简单传递；
- 机器人的全局状态（如电池电量、当前模式）；
- 在主循环（行为树外部）读写的数据，例如传感器输入、用户交互。

全局黑板提供了一种便捷的方式，让所有子树都能直接访问同一份数据，而无需每次都写重映射。

**1. 黑板的层次结构**：每个子树都有自己的黑板，它们形成父子关系，与树的层级一致。例如主树有自己的黑板 BB1；主树下的 SubTreeA 和 SubATreeB 分别有自己的黑板 BB2、BB3，它们的父黑板是 BB1。这些独立黑板的生命周期与其各自的子树耦合。

可以实现一个外部的"全局黑板"：

```cpp
auto global_bb   = BT::Blackboard::create();           // 全局黑板（最顶层）
auto maintree_bb = BT::Blackboard::create(global_bb);  // 主树黑板，父为 global_bb
auto tree = factory.createTree("MainTree", maintree_bb);
```

这样，`global_bb` 成为整个黑板层次结构的根，所有子树在查找键时，如果自己及祖先（直到主树）都没有，就会最终找到 `global_bb`。并且 `global_bb` 的生命周期独立于树，即使树被销毁，它仍然存在。此外，使用 `set` 和 `get` 方法也可以轻松访问。

**2. 在 XML 和脚本中访问全局黑板**：为了能够明确指定从顶层黑板（即 `global_bb`）读取或写入，而不是经过中间的父子查找，BT.CPP 引入了 `@` 前缀：

- 在 XML 端口赋值时：`<PrintNumber val="{@value}" />` 表示端口 `val` 将直接绑定到顶层黑板的 `value` 键，而不是本地或父级黑板；
- 在脚本语言中也可以使用：`<Script code="@value_sqr := @value * @value" />` 表示读取顶层黑板中的 `value`，计算结果后写入顶层黑板的 `value_sqr`。

这样，任何子树（无论嵌套多深）都可以通过 `@` 直接访问全局数据，无需进行任何重映射。

**3. 完整示例**：示例中有两个节点——`PrintNumber`（输入端口 `val`，打印该值）；主树 `MainTree` 包含一个 `PrintNumber`（名为 `main_print`）和一个子树 `MySub`；子树 `MySub` 包含一个 `PrintNumber`（名为 `sub_print`）和一个 `Script` 节点。

XML：

```xml
<BehaviorTree ID="MainTree">
  <Sequence>
    <PrintNumber name="main_print" val="{@value}" />
    <SubTree ID="MySub"/>
  </Sequence>
</BehaviorTree>

<BehaviorTree ID="MySub">
  <Sequence>
    <PrintNumber name="sub_print" val="{@value}" />
    <Script code="@value_sqr := @value * @value" />
  </Sequence>
</BehaviorTree>
```

- 两个 `PrintNumber` 都通过 `{@value}` 读取顶层黑板的 `value` 键；
- `Script` 读取顶层黑板的 `value`，计算平方后写入顶层黑板的 `value_sqr`。

C++：

```cpp
class PrintNumber : public BT::SyncActionNode {
public:
    PrintNumber(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}
    static BT::PortsList providedPorts() {
        return { BT::InputPort<int>("val") };
    }
    BT::NodeStatus tick() override {
        const int val = getInput<int>("val").value();
        std::cout << "[" << name() << "] val: " << val << std::endl;
        return BT::NodeStatus::SUCCESS;
    }
};

int main() {
    BT::BehaviorTreeFactory factory;
    factory.registerNodeType<PrintNumber>("PrintNumber");
    factory.registerBehaviorTreeFromText(xml_main);

    // 没有人会拥有此黑板的所有权
    auto global_bb   = BT::Blackboard::create();
    // "MainTree" 将拥有 maintree_bb
    auto maintree_bb = BT::Blackboard::create(global_bb);
    auto tree = factory.createTree("MainTree", maintree_bb);

    // 我们可以直接与 global_bb 交互
    for (int i = 1; i <= 3; i++) {
        global_bb->set("value", i);        // 写入条目 "value"
        tree.tickOnce();                   // 滴答树
        auto value_sqr = global_bb->get<int>("value_sqr");  // 读取条目 "value_sqr"
        std::cout << "[主循环] value: " << i << " value_sqr: " << value_sqr << "\n\n";
    }
    return 0;
}
```

**执行结果**：

```
[main_print] val: 1
[sub_print] val: 1
[主循环] value: 1 value_sqr: 1

[main_print] val: 2
[sub_print] val: 2
[主循环] value: 2 value_sqr: 4

[main_print] val: 3
[sub_print] val: 3
[主循环] value: 3 value_sqr: 9
```

**执行过程**：

1. 主循环每次将 `i` 写入全局黑板 `value`；
2. `tree.tickOnce()` 执行一次树：
   - `main_print` 通过 `{@value}` 读取全局 `value`，打印；
   - 进入子树 `MySub`，`sub_print` 同样读取全局 `value`，打印；
   - 脚本 `@value_sqr := @value * @value` 读取全局 `value`，计算平方后写入全局 `value_sqr`；
3. 主循环读取全局 `value_sqr` 并打印。

输出展示了全局黑板在不同子树和主循环之间的共享效果。

---

## 第六部分 子树与模块化开发

> 来源：入门版《第六部分：XML 语法详解》＋ 详解版《十二、子树与模块化开发》＋ 详解版《十九、附录：xml模式参考》

### 6.1 使用子树的原因

> 详解版：我们可以通过将较小且可重用的行为插入到较大的行为中来构建大规模行为树，换句话说，我们希望创建层次化的行为树，并使树具有可组合性。可以通过在 XML 定义多个树，并使用 `SubTree` 节点将一个树包含到另一个树中来实现。

子树让你可以复用行为树的一部分（入门版）。

### 6.2 基本结构：哪个是主树

> 来源：入门版《6.1 基本结构》

**为什么 MainTree 是主行为树？两种指定方式：**

**方式 1：显式指定（推荐）**

```xml
<root BTCPP_format="4" main_tree_to_execute="MainTree">
  <!-- 主树：调度各个子树 -->
  <BehaviorTree ID="MainTree">
    <Sequence>
      <SubTree ID="MCAreaTree"/>
      <SubTree ID="MFAreaTree"/>
      <SubTree ID="InspectionAreaTree"/>
    </Sequence>
  </BehaviorTree>

  <!-- 子树1：武馆区 -->
  <BehaviorTree ID="MCAreaTree">...</BehaviorTree>
  <!-- 子树2：梅林区 -->
  <BehaviorTree ID="MFAreaTree">...</BehaviorTree>
  <!-- 子树3：巡检区 -->
  <BehaviorTree ID="InspectionAreaTree">...</BehaviorTree>
</root>
```

**方式 2：默认第一个**

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">...</BehaviorTree>
  <BehaviorTree ID="SubTree1">...</BehaviorTree>
</root>
```

### 6.3 定义和调用子树

> 来源：入门版《6.2 子树》

```xml
<root BTCPP_format="4">
  <!-- 主树 -->
  <BehaviorTree ID="MainTree">
    <Sequence>
      <SubTree ID="GrabBeer"/>        <!-- 调用子树 -->
      <SaySomething message="喝酒!"/>
    </Sequence>
  </BehaviorTree>

  <!-- 子树定义 -->
  <BehaviorTree ID="GrabBeer">
    <Sequence>
      <OpenFridge/>
      <GrabBottle/>
      <CloseFridge/>
    </Sequence>
  </BehaviorTree>
</root>
```

**详解版组合子树示例：CrossDoor 行为**（同时使用装饰节点和回退节点的实际示例）。定义两棵行为树：

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence>
      <Fallback>
        <Inverter>
          <IsDoorClosed/>
        </Inverter>
        <SubTree ID="DoorClosed"/>
      </Fallback>
      <PassThroughDoor/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="DoorClosed">
    <Fallback>
      <OpenDoor/>
      <RetryUntilSuccessful num_attempts="5">
        <PickLock/>
      </RetryUntilSuccessful>
      <SmashDoor/>
    </Fallback>
  </BehaviorTree>
</root>
```

**主树逻辑**：

- 首先是一个 `Fallback`（回退节点），它有两个子节点；
- 第一个子节点是 `Inverter`（取反器），里面是条件节点 `IsDoorClosed`（询问"门是否关着"）。所以这个组合的意思是：如果门不是关着的（即门是开着的），则取反器返回 SUCCESS，`Fallback` 就会成功，跳过第二个子节点；
- 第二个子节点是 `SubTree`，引用了 `ID="DoorClosed"` 的子树，只有当门是关着的（第一个子节点失败）时，才会执行这个子树。

**子树的逻辑（门关着时执行）**：这是一个 `Fallback`，依次尝试三种方法开门：

- 先尝试 `OpenDoor`（正常开门）。如果成功，`Fallback` 结束；
- 如果开门失败，就执行 `RetryUntilSuccessful` 装饰节点，它会重复执行子节点 `PickLock` 最多五次，直到成功；
- 如果撬锁也失败，最后尝试 `SmashDoor`（砸门），一定会成功；
- 只要其中任何一种方法成功，子树就返回 SUCCESS，否则返回 FAILURE（但砸门总是成功，所以实际上子树总会成功）。

### 6.4 子树端口重映射

> 来源：详解版《十二、子树与模块化开发》3.1–3.3＋入门版《6.2 子树端口映射》

当一棵树包含子树时，每个子树拥有自己独立的黑板。为了避免不同树的黑板键名冲突，需要通过重映射将主树的端口与子树的端口显式连接起来。

**端口重映射的语法**：在 `<SubTree>` 标签中，通过属性将主树的端口（或黑板条目）传递给子树的端口：

```xml
<SubTree ID="MoveRobot" target="{move_goal}" result="{move_result}" />
```

- `target="{move_goal}"` 表示：子树的 `target` 输入端口将读取主树黑板中 `move_goal` 键的值；
- `result="{move_result}"` 表示：子树的 `result` 输出端口将写入主树黑板中 `move_result` 键的值（子树内部通过 `setOutput` 写入自己的 `result` 端口，但实际数据会被映射到主树的 `move_result`）。
- 这里的 `target` 和 `result` 是子树内部定义的端口名，`move_goal` 和 `move_result` 是主树黑板上的键名。

**入门版对应示例——子树定义声明输入参数、主树调用传参**：

```xml
<!-- 子树定义，声明需要输入参数 -->
<BehaviorTree ID="MoveRobot">
  <MoveTo goal="{target}"/>
</BehaviorTree>

<!-- 主树调用，传递参数 -->
<BehaviorTree ID="MainTree">
  <Sequence>
    <SubTree ID="MoveRobot" target="{waypoint_A}"/>
    <SubTree ID="MoveRobot" target="{waypoint_B}"/>
  </Sequence>
</BehaviorTree>
```

**详解版完整示例**：

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence>
      <!-- 在主树黑板上写入一个键 move_goal，值为字符串 "1;2;3" -->
      <Script code="move_goal='1;2;3'" />
      <!-- 调用子树 MoveRobot，并将主树的 move_goal 映射到子树的 target，
           将子树的 result 映射到主树的 move_result -->
      <SubTree ID="MoveRobot" target="{move_goal}" result="{move_result}" />
      <!-- 读取主树的 move_result 并打印 -->
      <SaySomething message="{move_result}"/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="MoveRobot">
    <Fallback>
      <Sequence>
        <!-- 子树的 target 输入端口接收来自主树的值（1;2;3） -->
        <MoveBase goal="{target}"/>
        <!-- 向子树的 result 输出端口写入字符串 "goal reached"，
             该值会被映射到主树的 move_result -->
        <Script code="result:='goal reached'" />
      </Sequence>
      <ForceFailure>
        <Script code="result:='error'" />
      </ForceFailure>
    </Fallback>
  </BehaviorTree>
</root>
```

**执行流程**：

- 主树执行 `<Script>`，将字符串 "1;2;3" 写入主树黑板的 `move_goal` 键；
- 进入子树 `MoveRobot`：
  - 子树的 `target` 端口被重映射到主树的 `move_goal`，因此子树内部读取 `target` 时，实际上得到的是 "1;2;3"；
  - 子树执行 `<MoveBase goal="{target}"/>`，用该值作为导航目标；
  - 如果导航成功，接着执行 `<Script code="result:='goal reached'"/>`，将字符串 "goal reached" 写入子树的 `result` 端口。由于该端口被重映射到主树的 `move_result`，实际上数据被写入了主树黑板的 `move_result` 键；
  - 如果导航失败，`Fallback` 的第二个分支会执行 `<Script code="result:='error'"/>`，将 "error" 写入主树的 `move_result`；
- 子树返回后，主树执行 `<SaySomething message="{move_result}"/>`，从主树黑板读取 `move_result` 并打印。

**通过 C++ 代码观察黑板内容**：

```cpp
int main() {
    BT::BehaviorTreeFactory factory;
    factory.registerNodeType<SaySomething>("SaySomething");
    factory.registerNodeType<MoveBaseAction>("MoveBase");
    factory.registerBehaviorTreeFromText(xml_text);
    auto tree = factory.createTree("MainTree");

    tree.tickWhileRunning();   // 持续滴答直到结束

    // 让我们查看一些关于黑板当前状态的信息
    std::cout << "\n------ 第一个黑板 ------" << std::endl;
    tree.subtrees[0]->blackboard->debugMessage();
    std::cout << "\n------ 第二个黑板 ------" << std::endl;
    tree.subtrees[1]->blackboard->debugMessage();
    return 0;
}
/* 预期输出：
------ 第一个黑板 ------
move_result (std::string)
move_goal (Pose2D)

------ 第二个黑板 ------
[result] 重映射到父树的端口 [move_result]
[target] 重映射到父树的端口 [move_goal]
*/
```

- 主树黑板（First BB）中有两个键：`move_goal` 和 `move_result`；
- 子树黑板（Second BB）显示，它的端口 `result` 和 `target` 被重映射到了父树的对应端口，因此子树黑板本身不存储这些键的值，而是通过重映射访问父黑板。

### 6.5 子树模型与自动重映射

> 来源：详解版《十二、子树与模块化开发》3.4

当在多个地方使用同一个子树时，需要复制粘贴同样冗长的 XML 标签：

```xml
<SubTree ID="MoveRobot" target="{move_goal}" frame="world" result="{error_code}" />
```

不希望每次复制粘贴 `target`、`frame` 和 `result` 这三个 XML 属性，除非值确实不同。

**3.4.1 为子树定义默认端口映射**：在 `<TreeNodesModel>` 中定义它们的默认值：

```xml
<TreeNodesModel>
  <SubTree ID="MoveRobot">
    <input_port  name="target" default="{move_goal}"/>
    <input_port  name="frame"  default="world"/>
    <output_port name="result" default="{error_code}"/>
  </SubTree>
</TreeNodesModel>
```

可以在 XML 中的 `<TreeNodesModel>` 中为这个子树声明端口的默认重映射值，就像给普通节点端口设置默认值一样。之后调用该子树时，如果不显式指定这些属性，就会自动使用默认映射。

**调用时覆盖默认**：

```xml
<SubTree ID="MoveRobot" frame="map" />
<!-- 只覆盖了 frame，将其映射到黑板键 map（注意这里 frame 是子树的端口名，
     "map" 是黑板键还是字符串取决于端口类型） -->
<!-- 其他端口 target 和 result 仍然使用默认映射 {move_goal} 和 {error_code} -->
```

**3.4.2 自动重映射 `_autoremap`**：当子树中的端口名与主树中想要使用的黑板键名完全相同时，手动写 `port="{port}"` 显得很啰嗦，`_autoremap="true"` 就是用来解决这个问题的。

原始写法：

```xml
<SubTree ID="MoveRobot" target="{target}" frame="{frame}" result="{result}" />
<!-- 每个端口都映射到同名的黑板键，代码重复 -->
```

使用 `_autoremap`：

```xml
<SubTree ID="MoveRobot" _autoremap="true" />
<!-- 这告诉子树：对于它内部使用的所有端口，默认都去主树黑板上找同名的键进行映射。
     即子树内部的 target 端口自动映射到主树的 {target}，frame 映射到 {frame}，
     result 映射到 {result} -->
```

部分覆盖 + autoremap：

```xml
<SubTree ID="MoveRobot" _autoremap="true" frame="world" />
<!-- 先应用自动重映射（target→{target}，result→{result}），
     但 frame 被显式覆盖为固定字符串 "world"（而不是黑板键 {frame}）。
     这提供了最大灵活性：大部分端口自动匹配，个别端口特殊处理 -->
```

**3.4.3 关于私有条目的约定**：如果一个子树内部有某些黑板条目不想被自动重映射影响（即希望它们是子树私有的，不与父树共享），可以在这些条目的名字前加下划线 `_`。当 `_autoremap="true"` 时，所有以下划线开头的条目不会被自动重映射，它们依然保留在子树自己的黑板中，不会去父树查找同名键。这是一种简单的"私有变量"约定。

### 6.6 管理多个 XML 文件

> 来源：入门版《6.3 多文件管理》＋ 详解版《十二、子树与模块化开发》4

随着项目变大，将所有行为树定义放在一个 XML 文件中会变得臃肿、难以维护。将每个子树独立成文件，可以实现模块化和复用。

**方法一：手动加载所有 XML 文件（C++ 遍历目录）**

子树1 `subtree_A.xml`：

```xml
<root>
  <BehaviorTree ID="SubTreeA">
    <SaySomething message="Executing Sub_A" />
  </BehaviorTree>
</root>
```

子树2 `subtree_B.xml`：

```xml
<root>
  <BehaviorTree ID="SubTreeB">
    <SaySomething message="Executing Sub_B" />
  </BehaviorTree>
</root>
```

主树 `main_tree.xml`，包含其他两个文件：

```xml
<root>
  <BehaviorTree ID="MainTree">
    <Sequence>
      <SaySomething message="starting MainTree" />
      <SubTree ID="SubTreeA" />
      <SubTree ID="SubTreeB" />
    </Sequence>
  </BehaviorTree>
</root>
```

通过 C++ 代码加载：

```cpp
int main() {
    BT::BehaviorTreeFactory factory;
    factory.registerNodeType<DummyNodes::SaySomething>("SaySomething");

    // 查找文件夹中的所有 XML 文件并注册它们
    // 我们将使用 std::filesystem::directory_iterator
    std::string search_directory = "./";
    using std::filesystem::directory_iterator;
    for (auto const& entry : directory_iterator(search_directory)) {
        if (entry.path().extension() == ".xml") {
            factory.registerBehaviorTreeFromFile(entry.path().string());
        }
    }
    // 在我们这个特定案例中，相当于：
    // factory.registerBehaviorTreeFromFile("./main_tree.xml");
    // factory.registerBehaviorTreeFromFile("./subtree_A.xml");
    // factory.registerBehaviorTreeFromFile("./subtree_B.xml");

    // 你可以创建 MainTree，子树将被自动添加
    std::cout << "----- MainTree tick ----" << std::endl;
    auto main_tree = factory.createTree("MainTree");
    main_tree.tickWhileRunning();

    // ... 或者你也可以只创建其中一个子树
    std::cout << "----- SubA tick ----" << std::endl;
    auto subA_tree = factory.createTree("SubTreeA");
    subA_tree.tickWhileRunning();
    return 0;
}
/* 预期输出：
已注册的行为树：
- MainTree
- SubTreeA
- SubTreeB

----- MainTree tick ----
Robot says: starting MainTree
Robot says: Executing Sub_A
Robot says: Executing Sub_B

----- SubA tick ----
Robot says: Executing Sub_A
*/
```

**方法二：在 XML 中使用 `<include>` 标签**

修改 `main_tree.xml`：

```xml
<root BTCPP_format="4">
  <include path="./subtree_A.xml" />
  <include path="./subtree_B.xml" />
  <BehaviorTree ID="MainTree">
    <Sequence>
      <SaySomething message="starting MainTree" />
      <SubTree ID="SubTreeA" />
      <SubTree ID="SubTreeB" />
    </Sequence>
  </BehaviorTree>
</root>
```

- `<include path="...">` 告诉加载器在解析 `main_tree.xml` 时，先去加载指定的文件；
- 路径是相对于当前 XML 文件的；
- 在像往常一样创建树：`factory.createTreeFromFile("main_tree.xml")`。

**入门版补充：相对路径与 ROS 包**

```xml
<!-- main_tree.xml -->
<root BTCPP_format="4">
  <include path="subtrees/navigation.xml"/>
  <include path="subtrees/manipulation.xml"/>
  <BehaviorTree ID="MainTree">
    <Sequence>
      <SubTree ID="NavigateTo"/>
      <SubTree ID="PickObject"/>
    </Sequence>
  </BehaviorTree>
</root>

<!-- subtrees/navigation.xml -->
<root BTCPP_format="4">
  <BehaviorTree ID="NavigateTo">
    <Sequence>
      <ComputePath goal="{target}"/>
      <FollowPath path="{computed_path}"/>
    </Sequence>
  </BehaviorTree>
</root>

<!-- ros_package_name 会解析为 ROS 包的路径 -->
<include ros_pkg="my_robot_bt" path="trees/subtree.xml"/>
```

**C++ 中加载多文件**（入门版）：

```cpp
BT::BehaviorTreeFactory factory;

// 方式1：逐个注册文件
factory.registerBehaviorTreeFromFile("path/to/main.xml");
factory.registerBehaviorTreeFromFile("path/to/subtrees.xml");

// 方式2：注册整个目录
factory.registerBehaviorTreeFromDirectory("path/to/bt_directory");

// 创建树
auto tree = factory.createTree("MainTree");
```

---

## 第七部分 C++ 开发详解：同步、异步与并发

> 来源：详解版《六、异步动作：原理与实现》＋ 入门版《第七部分：C++ 开发详解》《第十部分：调试与监控》的 Logger 部分、《第十一部分》的 CoroActionNode 部分

### 7.1 同步动作节点 (SyncActionNode)

> 来源：入门版《7.1 同步动作节点》

**瞬间完成的事情**：

- `tick()` 执行完才继续下一个节点；
- 检查一个变量的值；
- 发送一条消息；
- 设置一个标志位；
- 简单的数学计算。

**判断方式**：函数执行到 `return` 语句，框架收到返回值就认为这次 `tick()` 执行完成。

```cpp
class SaySomething : public BT::SyncActionNode {
public:
    SaySomething(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}
    static BT::PortsList providedPorts() {
        return { BT::InputPort<std::string>("message") };
    }
    BT::NodeStatus tick() override {
        auto msg = getInput<std::string>("message");
        if (!msg) throw BT::RuntimeError("Missing message");
        std::cout << msg.value() << std::endl;
        return BT::NodeStatus::SUCCESS;
    }
};
```

**详解版同步动作 vs 异步动作**：

- **真正的异步动作**应满足：被 tick 时可能返回 RUNNING 而不是立即完成；必须能够快速中止——当树的逻辑发生变化（如父节点被中断）时，需要能立即停止该动作并清理资源。
- **同步动作**则是一次性执行完毕并返回成功/失败，不会返回 RUNNING。

### 7.2 异步动作：原理与实现

> 来源：详解版《六、异步动作：原理与实现》

**异步动作的概念**：指那些不会立即完成，需要花费较长时间才能返回成功/失败的动作（例如导航、移动机械臂等）。一个异步动作需要满足以下要求：

- 它不应该在 `tick()` 方法中阻塞太长时间，执行流程应尽快返回，不能使用 `sleep` 长时间等待；
- 如果树的其他部分不再需要这个动作（例如条件失败），应该通过 `halt()` 方法立即停止它。

**实现异步动作 — StatefulActionNode**：`StatefulActionNode` 是 BehaviorTree.CPP 提供的辅助类，专门用于实现有状态的异步动作。它把 `tick()` 拆分成三个回调函数，基于 `StatefulActionNode` 的派生类必须重写以下虚方法，而不是 `tick()`：

| 方法 | 何时调用 | 作用 |
|---|---|---|
| `onStart()` | 节点第一次从空闲（IDLE）转为运行中 | 初始化动作、发送请求等；可以立即返回 SUCCESS/FAILURE，或者返回 RUNNING 表示开始执行 |
| `onRunning()` | 当节点处于 RUNNING 状态时，每次 tick 都会调用 | 检查进度、轮询结果。如果完成则返回 SUCCESS/FAILURE，否则继续 RUNNING |
| `onHalted()` | 当节点被其它节点中断时调用（例如父节点不再需要它） | 清理资源、取消请求等 |

**示例（MoveBaseAction）**：

```cpp
// 自定义类型
struct Pose2D { double x, y, theta; };
namespace chr = std::chrono;

class MoveBaseAction : public BT::StatefulActionNode {
public:
    // 任何带有端口的树节点都必须使用此签名的构造函数
    MoveBaseAction(const std::string& name, const BT::NodeConfig& config)
        : BT::StatefulActionNode(name, config) {}

    // 必须定义此静态方法
    static BT::PortsList providedPorts() {
        return { BT::InputPort<Pose2D>("goal") };
    }

    // 此函数在开始时被调用一次
    BT::NodeStatus onStart() override;
    // 1.读取输入目标
    // 2.发送导航请求
    // 3.设置预计完成时间（这里模拟220ms后完成）
    // 4.返回RUNNING

    // 如果 onStart() 返回 RUNNING，我们将持续调用
    // 此方法，直到它返回除 RUNNING 以外的内容
    BT::NodeStatus onRunning() override;
    // 每次tick检查是否到达完成时间
    // 如果到了，返回SUCCESS，否则返回RUNNING

    // 如果动作被另一个节点中止，则执行此回调
    void onHalted() override;
private:
    Pose2D _goal;
    chr::system_clock::time_point _completion_time;
};

BT::NodeStatus MoveBaseAction::onStart() {
    if (!getInput<Pose2D>("goal", _goal)) {
        throw BT::RuntimeError("缺少必需的输入 [goal]");
    }
    printf("[ MoveBase: 发送请求 ]. 目标: x=%f y=%f theta=%f\n",
           _goal.x, _goal.y, _goal.theta);
    // 我们使用此计数器模拟需要一定时间（200 毫秒）才能完成的操作
    _completion_time = chr::system_clock::now() + chr::milliseconds(220);
    return BT::NodeStatus::RUNNING;
}

BT::NodeStatus MoveBaseAction::onRunning() {
    // 假装我们正在检查是否已收到回复
    // 你不希望在此函数内阻塞太长时间
    std::this_thread::sleep_for(chr::milliseconds(10));
    // 假装经过一定时间后，操作已完成
    if (chr::system_clock::now() >= _completion_time) {
        std::cout << "[ MoveBase: 完成 ]" << std::endl;
        return BT::NodeStatus::SUCCESS;
    }
    return BT::NodeStatus::RUNNING;
}

void MoveBaseAction::onHalted() { printf("[ MoveBase: 已中止 ]"); }
```

> 说明：`onRunning()` 中使用了 `sleep_for(10ms)` 来模拟轮询间隙，但真实的代码不应阻塞这么久，而应该检查非阻塞的信号或状态，这里 sleep 只是为了演示。

**入门版 StatefulActionNode 示例（MoveBase）**：

```cpp
class MoveBase : public BT::StatefulActionNode {
public:
    MoveBase(const std::string& name, const BT::NodeConfig& config)
        : BT::StatefulActionNode(name, config) {}
    static BT::PortsList providedPorts() { return { BT::InputPort<Pose2D>("goal") }; }

    // 第一次被 Tick 时调用
    BT::NodeStatus onStart() override {
        auto goal = getInput<Pose2D>("goal");
        if (!goal) throw BT::RuntimeError("Missing goal");
        startMoving(goal.value());
        return BT::NodeStatus::RUNNING;
    }
    // 后续每次 Tick 调用（当状态为 RUNNING 时）
    BT::NodeStatus onRunning() override {
        if (hasReachedGoal()) return BT::NodeStatus::SUCCESS;
        if (hasCollided())    return BT::NodeStatus::FAILURE;
        return BT::NodeStatus::RUNNING;
    }
    // 被父节点打断时调用
    void onHalted() override { stopMoving(); }
};
```

**详解版 SleepNode 示例**：

在下面的例子中，"ActionE" 是异步的并处于"运行中"状态；当一个节点处于"运行中"时，通常其父节点也会返回运行中。

```cpp
using namespace std::chrono;

// 使用 StatefulActionNode 作为基类的异步节点示例
class SleepNode : public BT::StatefulActionNode {
public:
    SleepNode(const std::string& name, const BT::NodeConfig& config)
        : BT::StatefulActionNode(name, config) {}

    static BT::PortsList providedPorts() {
        return { BT::InputPort<int>("msec") };   // 我们想要休眠的毫秒数
    }

    BT::NodeStatus onStart() override {
        int msec = 0;
        getInput("msec", msec);
        if (msec <= 0) {
            return BT::NodeStatus::SUCCESS;      // 无需进入运行中状态
        } else {
            // 一旦达到截止时间，我们将返回成功
            deadline_ = system_clock::now() + milliseconds(msec);
            return BT::NodeStatus::RUNNING;
        }
    }

    BT::NodeStatus onRunning() override {
        if (system_clock::now() >= deadline_) {
            return BT::NodeStatus::SUCCESS;
        } else {
            return BT::NodeStatus::RUNNING;
        }
    }

    void onHalted() override {
        std::cout << "SleepNode interrupted" << std::endl;
    }
private:
    system_clock::time_point deadline_;
};
```

- 当 `SleepNode` 第一次 tick 时，会执行 `onStart()` 方法。如果睡眠时间为 0，它会立即返回"成功"；否则返回"运行中"；
- 应该在一个循环中持续 tick 树。这样会调用 `onRunning()` 方法，它可能再次返回"运行中"，或者最终返回"成功"；
- 另一个节点可能触发 `halt()` 信号。在这种情况下，会调用 `onHalted()` 方法。

### 7.3 常见错误：阻塞 tick()

> 来源：详解版《六、异步动作》6

实现 `SleepNode` 的错误方式如下：

```cpp
// 这是该节点的同步版本。可能不是我们想要的。
class BadSleepNode : public BT::ActionNodeBase {
public:
    BadSleepNode(const std::string& name, const BT::NodeConfig& config)
        : BT::ActionNodeBase(name, config) {}
    static BT::PortsList providedPorts() {
        return { BT::InputPort<int>("msec") };
    }
    BT::NodeStatus tick() override {
        int msec = 0;
        getInput("msec", msec);
        // 这个阻塞函数会冻结整个树 :(
        std::this_thread::sleep_for(milliseconds(msec));
        return BT::NodeStatus::SUCCESS;
    }
    void halt() override {
        // 因为我冻结了树，没有人能调用这个方法。
        // 即使这个方法可以执行，我也无法中断 std::this_thread::sleep_for()
    }
};
```

在 `tick()` 中直接调用 `std::this_thread::sleep_for` 会阻塞整个行为树的执行，导致无法响应其他节点或中止请求。

### 7.4 多线程的问题

> 来源：详解版《六、异步动作》7

早期版本中，有人尝试为每个异步动作创建新线程。这带来了：

1. 线程安全复杂（黑板访问需要同步）；
2. 很难正确实现 `halt()` 来中止线程；
3. 通常并不需要真正的并行，只需非阻塞的轮询。

`ThreadedAction` 基类虽然存在，但推荐避免使用。如果一定要用，需要在线程内部定期检查 `isHaltRequested()`，并短时间休眠，以确保可以快速响应中止。但这样实现起来比 `StatefulActionNode` 复杂得多。

**错误示范（自建线程但无法中止）**：

```cpp
// 这会创建它自己的线程。但在被中止时仍然存在问题
class BadSleepNode : public BT::ThreadedAction {
public:
    BadSleepNode(const std::string& name, const BT::NodeConfig& config)
        : BT::ThreadedAction(name, config) {}
    static BT::PortsList providedPorts() { return { BT::InputPort<int>("msec") }; }
    BT::NodeStatus tick() override {
        // 这段代码在其自己的线程中运行，因此树仍在运行。
        // 这看起来不错，但线程仍然无法被中止
        int msec = 0;
        getInput("msec", msec);
        std::this_thread::sleep_for(std::chrono::milliseconds(msec));
        return BT::NodeStatus::SUCCESS;
    }
    // halt() 方法无法杀死生成的线程 :(
};
```

**正确的版本**：

```cpp
// 我将在这里创建自己的线程，但并没有充分的理由
class ThreadedSleepNode : public BT::ThreadedAction {
public:
    ThreadedSleepNode(const std::string& name, const BT::NodeConfig& config)
        : BT::ThreadedAction(name, config) {}
    static BT::PortsList providedPorts() { return { BT::InputPort<int>("msec") }; }
    BT::NodeStatus tick() override {
        // 这段代码在其自己的线程中运行，因此树仍在运行。
        int msec = 0;
        getInput("msec", msec);
        using namespace std::chrono;
        const auto deadline = system_clock::now() + milliseconds(msec);

        // 定期检查 isHaltRequested()
        // 并且仅休眠一小段时间（1 毫秒）
        while (!isHaltRequested() && system_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
        return BT::NodeStatus::SUCCESS;
    }
    // halt() 方法会将 isHaltRequested() 设置为 true
    // 并停止生成线程中的 while 循环
};
```

### 7.5 高级示例：客户端/服务器通信

> 来源：详解版《六、异步动作》8

在许多机器人框架中（如 ROS ActionLib），动作执行是在另一个进程中完成的，这种通信模式天然契合异步动作：

- 提供一个非阻塞的启动函数（如发送目标）；
- 通过轮询或回调检查状态；
- 能够预占（preempt）正在执行的动作；
- 不需要自己创建线程，只需要在 `onRunning` 中检查通信状态；
- 这些操作都不是"阻塞"的，因此不需要创建自己的线程。

### 7.6 onHalted 详解与中断条件

> 来源：入门版《7.2 异步动作节点》

**中断条件表：**

| 父节点类型 | 中断条件 |
|---|---|
| Sequence | 子节点返回 FAILURE |
| Fallback | 子节点返回 SUCCESS |
| ReactiveSequence | 任何子节点状态变化（重新评估） |
| ReactiveFallback | 任何子节点状态变化（重新评估） |
| 手动停止树 | 整个树停止运行 |

**没有 `onHalted()` 的后果**：

- 节点被中断后，机器人还在继续移动；
- 后续节点可能和移动冲突；
- 资源泄漏（电机、线程等）。

**什么时候调用**：

- 父节点决定不再执行该节点；
- 树被手动停止；
- 节点返回 RUNNING 时被中断。

**必须实现**：任何有副作用（启动线程、发送命令、占用资源）的异步节点都应该实现 `onHalted()`。

### 7.7 条件节点 (ConditionNode)

> 来源：入门版《7.3 条件节点》

**条件节点的作用**：核心功能是判断真假，决定行为树的走向。具体来说：

1. **检查条件**：每次 tick 时检查某个条件是否满足（比如电池是否低于阈值）；
2. **返回结果**：只返回两种状态——SUCCESS（条件满足）、FAILURE（条件不满足）；
3. **控制流程**：根据返回结果，行为树会走不同的分支——如果返回 SUCCESS → 继续执行子节点；如果返回 FAILURE → 跳过子节点，尝试其他分支。

```cpp
class IsBatteryLow : public BT::ConditionNode {
public:
    IsBatteryLow(const std::string& name, const BT::NodeConfig& config)
        : BT::ConditionNode(name, config) {}
    static BT::PortsList providedPorts() {
        return { BT::InputPort<int>("threshold", 20) };   // 默认值 20
    }
    BT::NodeStatus tick() override {
        int threshold = getInput<int>("threshold").value();
        int battery = getBatteryLevel();
        return battery < threshold ? BT::NodeStatus::SUCCESS : BT::NodeStatus::FAILURE;
    }
};
```

### 7.8 节点注册与树创建

> 来源：入门版《7.4 节点注册与树创建》

```cpp
int main() {
    BT::BehaviorTreeFactory factory;

    // 注册自定义节点
    factory.registerNodeType<SaySomething>("SaySomething");
    factory.registerNodeType<MoveBase>("MoveBase");
    factory.registerNodeType<IsBatteryLow>("IsBatteryLow");

    // 从文件创建树
    auto tree = factory.createTreeFromFile("my_tree.xml");

    // 执行树
    while (true) {
        BT::NodeStatus status = tree.tickOnce();
        if (status == BT::NodeStatus::SUCCESS) {
            std::cout << "任务完成！" << std::endl;
            break;
        }
        if (status == BT::NodeStatus::FAILURE) {
            std::cout << "任务失败！" << std::endl;
            break;
        }
        // status == RUNNING，继续 tick
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    return 0;
}
```

### 7.9 并发 ≠ 并行（概念澄清）

> 来源：详解版《六、异步动作》3＋入门版《十一、并发与执行模型》

- **并发**：多个任务可以在时间上重叠地开始、运行和完成，但不一定要同时运行。在单线程中，通过快速切换也能实现并发；
- **并行**：多个任务真正同时运行，通常需要多核处理器和多线程。

BT.CPP 的树执行引擎是**单线程**的，所有节点的 `tick()` 方法顺序执行。如果一个 `tick()` 阻塞（如长时间 sleep），整个树就会被冻结。为了实现响应式行为，BT.CPP 依赖并发并非并行：即异步动作应尽快返回 RUNNING，让树处理其他节点，然后通过后续的 tick 轮询检查状态。

**CoroActionNode 实现真正并行**（入门版）：

```cpp
class AsyncAction : public BT::CoroActionNode {
public:
    AsyncAction(const std::string& name, const BT::NodeConfig& config)
        : BT::CoroActionNode(name, config) {}
    BT::NodeStatus tick() override {
        // 启动异步操作
        auto future = std::async(std::launch::async, [this]() { return doHeavyWork(); });
        // 协程等待
        while (future.wait_for(std::chrono::milliseconds(10)) != std::future_status::ready) {
            setStatusRunningAndYield();   // 暂停，让其他节点执行
        }
        return future.get() ? BT::NodeStatus::SUCCESS : BT::NodeStatus::FAILURE;
    }
};
```

---

## 第八部分 脚本语言与前置/后置条件

> 来源：入门版《第八部分：脚本语言》《第九部分：前置条件和后置条件》＋ 详解版《十四、脚本语言与前后置条件》

### 8.1 脚本语言简介

BT.CPP 支持在 XML 中直接编写简单的脚本代码（无需编写额外的 C++ 节点）。引入这套内置脚本语言主要用于：

- 初始化或修改黑板条目（如 `<Script code="...">`）；
- 在 `<Precondition>` 节点中编写条件表达式，动态决定是否执行子树。

脚本中的变量名就是黑板键名，读写它们相当于操作黑板。（详解版）

### 8.2 基本语法与数据类型

#### 8.2.1 赋值

```cpp
变量名 := 值   // 如果黑板中不存在该变量，则创建新条目
变量名 = 值    // 如果黑板中不存在该变量，则抛出异常
```

- `:=` 用于首次赋值或后续修改，自动创建条目；
- `=` 只能用于已存在条目，否则报错。

示例：

```cpp
msg  := 'hello world'   // 字符串（必须用单引号）
A    := 42              // 整数
B    = 3.14             // 浮点数（假设 B 已存在）
flag := true            // 布尔值（true/false）
```

#### 8.2.2 算术运算符

支持 `+ - * /` 及其对应的赋值运算符 `+= -= *= /=`。`+` 也可用于字符串拼接。

```cpp
A := 7
B := 5
B *= 2              // B = 10
C := (A * 3) + B    // C = 21 + 10 = 31
```

#### 8.2.3 位运算符

只能用于整数，否则异常。支持 `|`（或）、`&`（与）、`^`（异或）、`~`（取反）。

```cpp
value := 0x7F
val_A := value & 0x0F   // 按位与 → 0x0F
val_B := value | 0xF0   // 按位或 → 0xFF
val_C := ~value         // 按位取反
```

#### 8.2.4 逻辑与比较运算符

返回布尔值。比较运算符：`== != < <= > >=`；逻辑运算符：`&& || !`；布尔字面量：`true / false`（注意必须小写，保存到黑板时为 1 和 0）。

```cpp
val_A := true
val_B := 5 > 3           // true
val_C := (val_A == val_B) // true
val_D := (val_A && val_B) || !val_C // true
```

#### 8.2.5 三元运算符

```cpp
result := (条件) ? 值1 : 值2
val_B := (val_A > 1) ? 42 : 24
```

#### 8.2.6 字符串拼接

```cpp
greeting := 'Hello, ' + name   // name 是另一个字符串变量
```

#### 8.2.7 多语句书写

用分号分割多个语句：

```cpp
A := 42; B := 24; msg := 'ok'
```

**入门版运算符表**：

| 运算符 | 含义 | 示例 |
|---|---|---|
| `:=` | 赋值 | `x := 10` |
| `+ - * /` | 算术运算 | `x := a + b * 2` |
| `== != < > <= >=` | 比较运算 | `x < 10` |
| `&& \|\| !` | 逻辑运算 | `a && b` |
| `? :` | 三元运算 | `x := (a > b) ? a : b` |

**入门版内置函数表**：

| 函数 | 描述 | 示例 |
|---|---|---|
| `min(a, b)` | 返回较小值 | `min(5, 3)` → 3 |
| `max(a, b)` | 返回较大值 | `max(5, 3)` → 5 |
| `abs(x)` | 绝对值 | `abs(-5)` → 5 |
| `sqrt(x)` | 平方根 | `sqrt(16)` → 4 |
| `now()` | 当前时间戳 | `start_time := now()` |

### 8.3 在 XML 中使用脚本

#### 8.3.1 Script 节点

内置动作节点，用于执行一段脚本。脚本中对黑板的修改会立即生效，后续节点可通过端口读取。

```xml
<Script code="counter := 0"/>
<Script code="target_pos := '1.5;2.0;0.0'"/>
<Script code="counter := counter + 1"/>
<Script code="msg:='hello world'" />
<Script code="A:=THE_ANSWER; B:=3.14; color:=RED" />
```

#### 8.3.2 Precondition 节点

用于条件判断，只有条件成立时才执行其唯一子节点，否则返回指定状态。

```xml
<Precondition if="A > B && color != BLUE" else="FAILURE">
  <Sequence>
    <!-- 子节点 -->
  </Sequence>
</Precondition>
```

- `if` 后跟一个布尔表达式；
- `else` 可选，指定条件不成立时返回的状态（默认为 FAILURE，也可设为 SUCCESS）。

### 8.4 完整 C++ 示例（含注册枚举）

```cpp
#include "behaviortree_cpp/bt_factory.h"
#include "dummy_nodes.h"   // 包含 SaySomething 等

enum Color { RED = 1, BLUE = 2, GREEN = 3 };

int main() {
    BT::BehaviorTreeFactory factory;
    factory.registerNodeType<DummyNodes::SaySomething>("SaySomething");

    // 注册枚举类型，脚本中可直接使用 RED、BLUE、GREEN
    factory.registerScriptingEnums<Color>();          // 注意 magic_enum 默认范围 [-128,128]
    // 手动注册一个常量，不受范围限制
    factory.registerScriptingEnum("THE_ANSWER", 42);

    const char* xml_text = R"(
    <root BTCPP_format="4">
      <BehaviorTree>
        <Sequence>
          <Script code="msg:='hello world'" />
          <Script code="A:=THE_ANSWER; B:=3.14; color:=RED" />
          <Precondition if="A>B && color!=BLUE" else="FAILURE">
            <Sequence>
              <SaySomething message="{A}"/>
              <SaySomething message="{B}"/>
              <SaySomething message="{msg}"/>
              <SaySomething message="{color}"/>
            </Sequence>
          </Precondition>
        </Sequence>
      </BehaviorTree>
    </root>
    )";

    auto tree = factory.createTreeFromText(xml_text);
    tree.tickWhileRunning();
    return 0;
}
```

输出：

```
Robot says: 42.000000
Robot says: 3.140000
Robot says: hello world
Robot says: 1.000000
```

### 8.5 前置条件与后置条件

借助脚本语言功能，BT.CPP 引入了前置条件和后置条件的概念，即可以在节点的实际 `tick()` 之前或之后运行脚本。**所有的节点都支持前置条件和后置条件，并且不需要对 C++ 代码进行任何修改**（脚本的目标不是编写复杂的代码，而是在非常简单的用例中提高对树的可读性并减少对自定义 C++ 节点的需求）。

#### 8.5.1 前置条件

前置条件是在节点开始执行（即从 IDLE 变为其他状态）之前检查的脚本，支持四种属性：

| 属性 | 作用 | 评估时机 |
|---|---|---|
| `_skipIf` | 如果条件为真，则跳过该节点（相当于节点未执行，返回 SKIPPED） | 仅在空闲（IDLE）状态时（一次） |
| `_failureIf` | 如果条件为真，则跳过并直接返回 FAILURE | 仅在空闲（IDLE）状态时（一次） |
| `_successIf` | 如果条件为真，则跳过并直接返回 SUCCESS | 仅在空闲（IDLE）状态时（一次） |
| `_while` | 条件为假时跳过节点；若节点正在运行且条件变假，则立即中止 | 空闲和运行中（每次滴答） |

**重要区别**：

- `_skipIf` / `_failureIf` / `_successIf` 仅在节点第一次从 IDLE 状态被 tick 时检查一次，之后即使条件变化也不再重新评估；
- `_while` 在每次 tick 时都会检查，包括节点处于 RUNNING 状态时。如果条件变为假，会立即中止节点（调用 `onHalted`）并返回 SKIPPED。

**评估顺序**：当一个节点同时定义了多个前置条件时，评估顺序为 `_failureIf → _successIf → _skipIf → _while`，一旦某个条件满足，后续条件不再检查。

```xml
<!-- 队列中有待处理任务时才执行扫描 -->
<Action ID="ScanLabel" _skipIf="items_pending <= 0"/>
<!-- 如果没有标签编号，直接返回 FAILURE -->
<Action ID="ReadLabel" _failureIf="label_id == ''"/>
<!-- 如果已完成，直接返回 SUCCESS -->
<Action ID="Initialize" _successIf="initialized == true"/>
<MoveToGoal _while="battery_ok"/>
```

**示例：替代 Fallback + Inverter**。以前如果想实现"如果门关着就开门"，需要用 `Fallback + Inverter + IsDoorClosed`：

```xml
<Fallback>
  <Inverter>
    <IsDoorClosed/>
  </Inverter>
  <OpenDoor/>
</Fallback>
```

如果不使用自定义的条件节点 `IsDoorOpen`，而是将布尔值存储在一个名为 `door_closed` 的条目中，需要在 `OpenDoor` 上加上一个前置条件：

```xml
<OpenDoor _skipIf="!door_closed"/>
```

**使用 `<Precondition>` 进行每次 tick 评估**：当你需要在每次 tick 时（不仅仅是节点启动时）检查一个条件时，需要使用 `<Precondition>` 装饰节点，而不是内联属性。这在反应式序列（`ReactiveSequence`）或反应式回退（`ReactiveFallback`）中特别有用。

```xml
<!-- 这会在每次滴答时检查条件 -->
<Precondition if="battery_ok" else="RUNNING">
  <MoveToGoal/>
</Precondition>
```

当使用 `else="RUNNING"` 时，如果条件在子节点运行时变为假，装饰器会返回运行中（RUNNING）（保持树存活），而不是立即返回失败或已跳过。

将此与内联属性进行比较：

```xml
<!-- 这仅在 MoveToGoal 启动时检查条件 -->
<MoveToGoal _successIf="battery_ok"/>
```

内联 `_successIf` 仅在 `MoveToGoal` 从空闲（IDLE）状态转换时评估一次，如果 `battery_ok` 在 `MoveToGoal` 运行时发生变化，该变化将被忽略。

#### 8.5.2 后置条件（Post Conditions）

后置条件在节点执行完成后（无论返回什么状态）执行脚本，用于根据结果更新黑板或进行其他处理。

| 属性 | 作用 | 触发时机 |
|---|---|---|
| `_onSuccess` | 节点返回 SUCCESS 时执行 | 成功时 |
| `_onFailure` | 节点返回 FAILURE 时执行 | 失败时 |
| `_post` | 无论成功或失败都执行 | 成功或失败时 |
| `_onHalted` | 节点被中止（halt）时执行 | 中止时 |

**示例：替代 Fallback + SetBlackboard**。以前想根据导航结果设置错误码，需要用一个 Fallback 嵌套 Sequence 和 ForceFailure：

```xml
<Fallback>
  <Sequence>
    <MoveBase goal="{target}"/>
    <SetBlackboard output_key="result" value="0" />
  </Sequence>
  <ForceFailure>
    <SetBlackboard output_key="result" value="-1" />
  </ForceFailure>
</Fallback>
```

现在只需要在 `MoveBase` 上直接加后置条件：

```xml
<MoveBase goal="{target}" _onSuccess="result:=OK" _onFailure="result:=ERROR"/>
```

**入门版完整示例（含执行顺序）**：

```xml
<Sequence>
  <!-- 初始化：第一次执行后设置标志 -->
  <Action ID="Setup" _skipIf="setup_done == true" _onSuccess="setup_done := true"/>
  <!-- 有足够存储空间时才记录巡检结果 -->
  <Action ID="SaveInspection" _failureIf="remaining_slots < 10"
                      _onSuccess="remaining_slots := remaining_slots - 1; saved := saved + 1"/>
  <!-- 记录最后执行时间 -->
  <Action ID="Report" _post="last_report_time := now()"/>
</Sequence>
```

```xml
<Action ID="CollectCoin"
        _onSuccess="coins := coins + 1"
        _onFailure="failed_attempts := failed_attempts + 1"/>
```

**执行顺序**（入门版）：

1. 检查 `_skipIf` → 如果为真，跳过节点；
2. 检查 `_failureIf` → 如果为真，返回 FAILURE；
3. 检查 `_successIf` → 如果为真，返回 SUCCESS；
4. 执行节点的 `tick()`；
5. 根据结果执行 `_onSuccess` / `_onFailure` / `_onHalted`；
6. 执行 `_post`。

**入门版条件脚本示例**（条件脚本结合前后置条件）：

```xml
<Action ID="SaveInspection" _onSuccess="saved := saved + 1" _failureIf="remaining_slots <= 0"/>
```

#### 8.5.3 设计模式：错误码

**根据错误码选择分支**：有时动作的失败原因不同，需要走不同的处理路径。可以在动作节点当中设置一个错误码输出端口，然后在后续分支中用前置条件检查该错误码：

```xml
<Sequence>
  <MoveBase goal="{target}" error_code="{error}"/>
  <Fallback>
    <Condition _skipIf="error != 1"/>  <!-- 错误码为1时的处理 -->
    <Condition _skipIf="error != 2"/>  <!-- 错误码为2时的处理 -->
  </Fallback>
</Sequence>
```

这样就不用写复杂的 Fallback 嵌套。

**状态机风格的节点**：可以在节点上加上状态前置/后置条件，使节点的行为依赖于机器人所处的状态，并自动更新状态。例如着陆节点：

```xml
<Lander altitude="{alt}"
        _skipIf="state != DO_LANDING"    <!-- 只有在 DO_LANDING 状态才执行 -->
        _onSuccess="state:=LANDED"       <!-- 成功后切换到 LANDED -->
        _onFailure="state:=LANDING_FAILED"/>  <!-- 失败后切换 -->
```

这样节点变成声明式：它明确表示"只有特定状态才执行，执行后更新状态"。可以将这个节点自由地移动到树的任何位置，而不用修改内部逻辑。

---

## 第九部分 调试、监控、测试与可视化

> 来源：入门版《第十部分：调试与监控》《附录 C：常见问题》＋ 详解版《十六、模拟测试与节点替换》《十七、日志与状态监控》《十八、Groot2可视化与实时监控》

### 9.1 Logger 接口

> 来源：入门版《10.1 Logger 接口》

Logger 用于记录行为树的执行日志。

**内置 Logger**：

```cpp
#include "behaviortree_cpp/loggers/bt_cout_logger.h"
#include "behaviortree_cpp/loggers/bt_file_logger_v2.h"

auto tree = factory.createTree("MainTree");

// 控制台日志
BT::StdCoutLogger logger_cout(tree);
// 文件日志（可用 Groot2 回放）
BT::FileLogger2 logger_file(tree, "bt_trace.btlog");

tree.tickWhileRunning();
```

**自定义 Logger**：

```cpp
class MyLogger : public BT::StatusChangeLogger {
public:
    MyLogger(const BT::Tree& tree) : BT::StatusChangeLogger(tree.rootNode()) {}
    void callback(BT::Duration timestamp, const BT::TreeNode& node,
                  BT::NodeStatus prev_status, BT::NodeStatus status) override {
        std::cout << "[" << timestamp.count() << "ms] "
                  << node.name() << ": " << prev_status << " -> " << status << std::endl;
    }
    void flush() override {}
};
```

**详解版回调接口**：日志记录器是一个类，它有一个回调函数，每当树节点改变其状态时就会被调用；这是观察者模式的一种非侵入式实现。通常在树创建之后、开始 tick 之前进行添加。

```cpp
virtual void callback(
    BT::Duration timestamp,          // 状态转换发生的时间
    const BT::TreeNode& node,        // 改变状态的节点
    BT::NodeStatus prev_status,      // 之前的状态
    BT::NodeStatus status            // 新的状态
);
```

可以继承这个接口实现自己的日志器，记录每次状态的变化。

### 9.2 TreeObserver（内置的统计日志器）

> 来源：详解版《十七、日志与状态监控》＋入门版《10.2 TreeObserver》

`TreeObserver` 是一个简单的日志记录器实现，它为树中的每个节点收集以下统计信息，对单元测试非常有用（可以验证某个节点是否按预期执行了特定次数）：

```cpp
struct NodeStatistics {
    BT::NodeStatus last_result;      // 最后一个有效结果，SUCCESS 或 FAILURE
    BT::NodeStatus current_status;   // 最后一个状态，可以是任何状态，包括 IDLE 或 SKIPPED
    unsigned transitions_count;      // 状态转换次数，不包括转换到 IDLE 的次数
    unsigned success_count;          // 转换到 SUCCESS 的次数
    unsigned failure_count;          // 转换到 FAILURE 的次数
    unsigned skip_count;             // 转换到 SKIPPED 的次数
    BT::Duration last_timestamp;     // 最后一次转换的时间戳
};
```

**唯一标识一个节点**：树中可能有多个同名节点，需要一种方式精确指定要查看哪个节点的统计信息。

- `TreeNode::UID()`：一个唯一的数字，对应于树的深度优先遍历顺序；
- `TreeNode::fullPath()`：一个字符串，类似于文件路径，反映了节点在树层次结构中的位置。例如 `"mysub/sub_nested/action_subB"` 表示在 `mysub` 子树下的 `sub_nested` 子树中的 `action_subB` 节点。如果 XML 中没有指定 `name` 属性，路径会自动生成如 `"Sequence::5"` 这样的形式。

**XML 示例**：

```xml
<root>
  <BehaviorTree ID="MainTree">
    <Sequence>
      <Fallback>
        <AlwaysFailure name="failing_action"/>
        <SubTree ID="SubTreeA" name="mysub"/>
      </Fallback>
      <AlwaysSuccess name="last_action"/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="SubTreeA">
    <Sequence>
      <AlwaysSuccess name="action_subA"/>
      <SubTree ID="SubTreeB" name="sub_nested"/>
      <SubTree ID="SubTreeB" />
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="SubTreeB">
    <AlwaysSuccess name="action_subB"/>
  </BehaviorTree>
</root>
```

有些节点具有 XML 属性 `name`，而另一些则没有。相应的 UID——fullPath 对列表是：

```
1  -> Sequence::1
2  -> Fallback::2
3  -> failing_action
4  -> mysub
5  -> mysub/Sequence::5
6  -> mysub/action_subA
7  -> mysub/sub_nested
8  -> mysub/sub_nested/action_subB
9  -> mysub/SubTreeB::9
10 -> mysub/SubTreeB::9/action_subB
11 -> last_action
```

**C++ 示例**：下列程序将递归打印树结构、将 `TreeObserver` 附加到树上、打印 UID/fullPath 对、收集名为 "last_action" 的特定节点的统计信息、显示观察者收集的所有统计信息：

```cpp
int main() {
    BT::BehaviorTreeFactory factory;
    factory.registerBehaviorTreeFromText(xml_text);
    auto tree = factory.createTree("MainTree");

    // 辅助函数，用于打印树
    BT::printTreeRecursively(tree.rootNode());

    // 观察者的目的是保存关于某个节点返回 SUCCESS 或 FAILURE 次数的统计信息
    // 这对于创建单元测试以及检查是否按预期发生了一组转换特别有用
    BT::TreeObserver observer(tree);

    // 打印唯一的 ID 和相应的人类可读路径（路径也应该是唯一的）
    std::map<uint16_t, std::string> ordered_UID_to_path;
    for (const auto& [name, uid] : observer.pathToUID()) {
        ordered_UID_to_path[uid] = name;
    }
    for (const auto& [uid, name] : ordered_UID_to_path) {
        std::cout << uid << " -> " << name << std::endl;
    }

    tree.tickWhileRunning();

    // 你可以使用其完整路径或 UID 访问特定的统计信息
    const auto& last_action_stats = observer.getStatistics("last_action");
    assert(last_action_stats.transitions_count > 0);

    std::cout << "----------------" << std::endl;
    // 打印所有统计信息
    for (const auto& [uid, name] : ordered_UID_to_path) {
        const auto& stats = observer.getStatistics(uid);
        std::cout << "[" << name << "] \tT/S/F: "
                  << stats.transitions_count << "/"
                  << stats.success_count << "/"
                  << stats.failure_count << std::endl;
    }
    return 0;
}
```

**入门版 TreeObserver 补充示例**：

```cpp
BT::TreeObserver observer(tree);
tree.tickWhileRunning();
// 获取统计信息
for (const auto& [uid, stats] : observer.statistics()) {
    std::cout << "节点 " << uid << ": "
              << "成功 " << stats.success_count << ", 失败 " << stats.failure_count
              << ", 跳过 " << stats.skip_count << std::endl;
}
```

### 9.3 Groot2 可视化工具

> 来源：入门版《10.3 Groot2 可视化工具》＋ 详解版《十八、Groot2可视化与实时监控》

Groot2 是官方的图形化编辑器和调试工具：

- 拖拽式编辑行为树；
- 实时监控执行状态；
- 回放历史日志；
- 安装：<https://www.behaviortree.dev/groot>

**连接实时监控**（入门版）：

```cpp
#include "behaviortree_cpp/loggers/groot2_publisher.h"
BT::Groot2Publisher publisher(tree, 1667);   // 端口 1667
// 在 Groot2 中连接 localhost:1667
```

**树节点模型**（详解版）：Groot2 需要一个"树节点模型"。例如 Groot2 需要知道用户定义的节点 `ThinkWhatToSay` 和 `SaySomething` 存在，此外还需要：节点类型、端口的名称和类型（输入/输出）。这些模型都将用 XML 表示：

```xml
<TreeNodesModel>
  <Action ID="SaySomething">
    <input_port name="message"/>
  </Action>
  <Action ID="ThinkWhatToSay">
    <output_port name="text"/>
  </Action>
</TreeNodesModel>
```

无需手动编写，BT.CPP 提供了自动生成函数：

```cpp
BT::BehaviorTreeFactory factory;
// ... 注册所有自定义节点 ...
std::string xml_models = BT::writeTreeNodesModelXML(factory);
// 保存 xml_models 到文件，然后在 Groot2 中导入
```

可以将这个 XML 保存为文件（如 `models.xml`），然后在 Groot2 中点击 "ImportModels" 导入；或者直接将模型内容添加到你的 `.xml` 或 `.btproj` 文件中。

**实时可视化连接**（只有 Groot 专业版支持）：在 C++ 代码中添加一行：

```cpp
BT::Groot2Publisher publisher(tree);
```

这将在 BT.CPP 执行器和 Groot2 之间创建一个进程间通信服务，该服务：

- 将整个树结构发送给 Groot2，包括上面提到的模型；
- 定期更新各个节点的状态（运行中、成功、失败、空闲）；
- 发送黑板的值；基本类型如整数、浮点数、字符串等，其他类型需要手动添加；
- 允许 Groot2 插入断电、执行节点替换或故障注入。

**完整示例**：

XML：

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence>
      <Script code="door_open:=false" />
      <Fallback>
        <Inverter>
          <IsDoorClosed/>
        </Inverter>
        <SubTree ID="DoorClosed" _autoremap="true" door_open="{door_open}"/>
      </Fallback>
      <PassThroughDoor/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="DoorClosed">
    <Fallback name="tryOpen" _onSuccess="door_open:=true">
      <OpenDoor/>
      <RetryUntilSuccessful num_attempts="5">
        <PickLock/>
      </RetryUntilSuccessful>
      <SmashDoor/>
    </Fallback>
  </BehaviorTree>
</root>
```

CPP：

```cpp
int main() {
    BT::BehaviorTreeFactory factory;

    // 我们的一组与 CrossDoor 相关的简单节点
    CrossDoor cross_door;
    cross_door.registerNodes(factory);

    // Groot2 编辑器需要您注册节点的模型。
    // 您无需手动编写，可以使用以下命令自动生成。
    std::string xml_models = BT::writeTreeNodesModelXML(factory);

    factory.registerBehaviorTreeFromText(xml_text);
    auto tree = factory.createTree("MainTree");

    // 连接 Groot2Publisher。这将允许 Groot2 获取树并轮询状态更新。
    BT::Groot2Publisher publisher(tree);

    // 我们希望无限运行此程序
    while (1) {
        std::cout << "开始" << std::endl;
        cross_door.reset();
        tree.tickWhileRunning();
        std::this_thread::sleep_for(std::chrono::milliseconds(3000));
    }
    return 0;
}
```

**自定义类型在黑板上的可视化**：Groot2 通过 JSON 格式接收黑板中的内容。基本类型已内置支持，但如果黑板中存储了自定义类型（如 `Position2D`），则需要为其提供 JSON 序列化方法。

**使用宏 `BT_JSON_CONVERTER`**：给定一个用户定义的类型：

```cpp
struct Position2D { double x; double y; };
```

在文件作用域（任何函数之外）定义转换器：

```cpp
#include "behaviortree_cpp/json_export.h"

BT_JSON_CONVERTER(Position2D, pos) {
    add_field("x", &pos.x);
    add_field("y", &pos.y);
}
```

也适用于嵌套类型：

```cpp
struct Waypoint {
    std::string name;
    Position2D position;
    double speed = 1.0;
};

BT_JSON_CONVERTER(Waypoint, wp) {
    add_field("name", &wp.name);
    add_field("position", &wp.position);
    add_field("speed", &wp.speed);
}
```

然后在 main 函数中（创建树之前）注册这些类型：

```cpp
BT::RegisterJsonDefinition<Position2D>();
BT::RegisterJsonDefinition<Waypoint>();
```

**手动方式**：可以自己编写转换函数并注册：

```cpp
void PositionToJson(nlohmann::json& dest, const Position2D& pos) {
    dest["x"] = pos.x;
    dest["y"] = pos.y;
}
// 在 main() 中注册
BT::RegisterJsonDefinition<Position2D>(PositionToJson);
```

**完整示例（Groot2 深度集成）**：

```cpp
#include "crossdoor_nodes.h"
#include "behaviortree_cpp/bt_factory.h"
#include "behaviortree_cpp/json_export.h"
#include "behaviortree_cpp/loggers/bt_file_logger_v2.h"
#include "behaviortree_cpp/loggers/bt_minitrace_logger.h"
#include "behaviortree_cpp/loggers/groot2_publisher.h"
#include "behaviortree_cpp/xml_parsing.h"
#include <cstdlib>
#include <string>
#include <vector>

// 一个自定义结构体，我们希望在 Groot2 中可视化
struct Position2D { double x; double y; };

// 这个宏将生成将对象转换为/从 JSON 转换所需的代码。
// 仍然需要在 main() 中调用 BT::RegisterJsonDefinition<Position2D>()
BT_JSON_CONVERTER(Position2D, pos) {
    add_field("x", &pos.x);
    add_field("y", &pos.y);
}

struct Waypoint {
    std::string name;
    Position2D position;
    double speed = 1.0;
};
BT_JSON_CONVERTER(Waypoint, wp) {
    add_field("name", &wp.name);
    add_field("position", &wp.position);
    add_field("speed", &wp.speed);
}

// 简单的动作，更新黑板中的 Position2D 实例，并输出向量以复现 Groot2 issue #55/#77
// 自定义同步动作节点 UpdatePosition
// 每次tick都会更新黑板中的 Position2D 值（增加偏移）并生成随机变化的
// std::vector<double>、std::vector<std::string>、std::vector<Waypoint>（动态改变数量，演示复杂类型的可视化）
class UpdatePosition : public BT::SyncActionNode {
public:
    UpdatePosition(const std::string& name, const BT::NodeConfig& config)
        : BT::SyncActionNode(name, config) {}

    BT::NodeStatus tick() override {
        _pos.x += 0.2;
        _pos.y += 0.1;
        setOutput("pos", _pos);

        // 触发 Groot2 issue #55/#77 的向量（查看黑板时崩溃）
        std::vector<double> doubles = { 1.1, 2.2, 3.3, 4.4, 5.5 };
        setOutput("vec_double", doubles);
        std::vector<std::string> strings = { "hello", "world", "test" };
        setOutput("vec_string", strings);

        // 生成随机偏移量的辅助函数 [-range, +range]
        auto randOffset = [](double range) {
            return (static_cast<double>(std::rand()) / RAND_MAX - 0.5) * 2.0 * range;
        };

        // 自定义类型的向量 - 在2个和3个航点之间交替
        std::vector<Waypoint> waypoints;
        if (_execution_count % 2 == 0) {
            // 偶数次执行：2个航点
            waypoints = {
                { "start", { randOffset(5.0), randOffset(5.0) }, 1.0 + randOffset(0.3) },
                { "goal",  { 100.0 + randOffset(10.0), 50.0 + randOffset(10.0) }, 0.5 + randOffset(0.2) },
            };
        } else {
            // 奇数次执行：3个航点
            waypoints = {
                { "start",      { randOffset(5.0), randOffset(5.0) }, 1.0 + randOffset(0.3) },
                { "checkpoint", { 50.0 + randOffset(15.0), 25.0 + randOffset(15.0) }, 2.0 + randOffset(0.5) },
                { "goal",       { 100.0 + randOffset(10.0), 50.0 + randOffset(10.0) }, 0.5 + randOffset(0.2) },
            };
        }
        setOutput("waypoints", waypoints);
        _execution_count++;
        return BT::NodeStatus::SUCCESS;
    }

    static BT::PortsList providedPorts() {
        return {
            BT::OutputPort<Position2D>("pos"),
            BT::OutputPort<std::vector<double>>("vec_double", "double类型向量"),
            BT::OutputPort<std::vector<std::string>>("vec_string", "字符串向量"),
            BT::OutputPort<std::vector<Waypoint>>("waypoints", "航点向量"),
        };
    }
private:
    Position2D _pos = {0, 0};
    int _execution_count = 0;
};

namespace {
const char* xml_text = R"(
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence>
      <Script code="door_open:=false" />
      <UpdatePosition pos="{pos_2D}" vec_double="{doubles}" vec_string="{strings}" waypoints="{waypoints}"/>
      <Fallback>
        <Inverter><IsDoorClosed/></Inverter>
        <SubTree ID="DoorClosed" _autoremap="true" door_open="{door_open}"/>
      </Fallback>
      <PassThroughDoor/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="DoorClosed">
    <Fallback name="tryOpen" _onSuccess="door_open:=true">
      <OpenDoor/>
      <RetryUntilSuccessful num_attempts="5"><PickLock/></RetryUntilSuccessful>
      <SmashDoor/>
    </Fallback>
  </BehaviorTree>
</root>
)";
}

int main() {
    BT::BehaviorTreeFactory factory;

    // 照常注册节点
    CrossDoor cross_door;
    cross_door.registerNodes(factory);
    factory.registerNodeType<UpdatePosition>("UpdatePosition");

    // Groot2 编辑器需要您注册节点的模型。您无需手动编写。
    const std::string xml_models = BT::writeTreeNodesModelXML(factory);

    factory.registerBehaviorTreeFromText(xml_text);

    // 添加此行以允许 Groot2 可视化您的自定义类型
    BT::RegisterJsonDefinition<Position2D>();
    BT::RegisterJsonDefinition<Waypoint>();

    auto tree = factory.createTree("MainTree");
    std::cout << "----------- XML 文件 ----------\n"
              << BT::WriteTreeToXML(tree, false, false)
              << "--------------------------------\n";

    // 连接 Groot2Publisher。这将允许 Groot2 获取树并轮询状态更新。
    const unsigned port = 1667;
    BT::Groot2Publisher publisher(tree, port);

    // 添加另外两个日志记录器，将状态转换保存到文件。两种格式都与 Groot2 兼容
    // 使用轻量级序列化的日志记录
    BT::FileLogger2 logger2(tree, "t11_groot_howto.btlog");
    BT::MinitraceLogger minilog(tree, "minitrace.json");

    while (true) {
        std::cout << "开始" << std::endl;
        cross_door.reset();
        tree.tickWhileRunning();
        std::this_thread::sleep_for(std::chrono::milliseconds(2000));
    }
    return 0;
}
```

这个示例展示了如何将行为树与 Groot2 深度集成，包括：

- 自定义类型的可视化；
- 实时监控节点状态和黑板数据；
- 录制日志用于后续回放或分析；
- 通过 Groot2Publisher 实现调试交互。

### 9.4 模拟测试与节点替换

> 来源：详解版《十六、模拟测试与节点替换》

在真实系统中，某些节点可能依赖硬件（如机器人底盘）、外部服务（如导航）或复杂计算，在测试时难以直接使用。BT.CPP 提供了替换规则，可以在创建树之前，指定哪些节点应该被替换成什么。

**替换规则的基本用法**：每个节点都有一个 `fullPath`，像文件系统中的路径，反映了节点在子树中的位置：

- 如果 XML 中有 `<SaySomething name="talk"/>`，那么该节点 `fullPath` 就是 `"talk"`（因为它在主树顶层，没有前缀）；
- 如果有 `<SubTree ID="MySub" name="mysub"/>` 内部又有 `<AlwaysSuccess name="action_subA"/>`，那么 `action_subA` 的 `fullPath` 就是 `"mysub/action_subA"`。

替换规则通过 `BehaviorTreeFactory` 的 `addSubstitutionRule` 方法添加，规则由两部分组成：

- **匹配模式**：一个字符串（可含通配符 `*`），与被替换节点的 `fullPath` 进行匹配；
- **目标节点类型或配置**：指定替换成哪个已注册的节点类型，或者提供一个 `TestNodeConfig` 配置对象。

```cpp
factory.addSubstitutionRule("talk", "TestMessage");           // 精确匹配
factory.addSubstitutionRule("mysub/action_*", "TestAction");  // 通配符匹配
```

**内置的 TestNode**：`TestNode` 是一个内置的动作节点，专为测试设计，可以灵活配置：

- 返回状态：可以设置为 SUCCESS 或 FAILURE；
- 同步/异步：可以设置为异步，并指定一个延迟时间（`async_delay`），在此期间返回 RUNNING，超时后返回指定状态；
- 后置脚本：执行后可以运行一段脚本（`post_script`），用于模拟输出端口或修改黑板。

配置示例：

```cpp
BT::TestNodeConfig test_config;
test_config.async_delay = std::chrono::milliseconds(2000);   // 异步等待 2 秒
test_config.return_status = BT::NodeStatus::SUCCESS;         // 最终返回成功
test_config.post_script = "msg :='message SUBSTITUED'";      // 执行后修改黑板
factory.addSubstitutionRule("last_action", test_config);
```

将 `fullPath` 为 "last_action" 的节点替换为一个配置好的 `TestNode`，该节点会先返回 2 秒 RUNNING，然后返回 SUCCESS，并执行脚本将黑板上的 `msg` 改为指定值。

**完整实例**：在此示例中，将看到使用替换规则将一个节点替换为另一个节点、如何使用内置的 TestNode、通配符匹配的示例、如何在运行时通过 JSON 文件传递这些规则。

XML：

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence>
      <SaySomething name="talk" message="hello world"/>
      <Fallback>
        <AlwaysFailure name="failing_action"/>
        <SubTree ID="MySub" name="mysub"/>
      </Fallback>
      <SaySomething message="before last_action"/>
      <Script code="msg:='after last_action'"/>
      <AlwaysSuccess name="last_action"/>
      <SaySomething message="{msg}"/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="MySub">
    <Sequence>
      <AlwaysSuccess name="action_subA"/>
      <AlwaysSuccess name="action_subB"/>
    </Sequence>
  </BehaviorTree>
</root>
```

C++：

```cpp
int main(int argc, char** argv) {
    BT::BehaviorTreeFactory factory;
    factory.registerNodeType<SaySomething>("SaySomething");

    // 我们使用 lambda 和 registerSimpleAction 来创建一个"虚拟"节点
    // 简单节点，只打印其名称并返回 SUCCESS
    factory.registerSimpleAction("DummyAction", [](BT::TreeNode& self) {
        std::cout << "DummyAction 正在替换: " << self.name() << std::endl;
        return BT::NodeStatus::SUCCESS;
    });

    // 旨在替换 SaySomething 的动作节点。它将尝试使用输入端口 "message"
    factory.registerSimpleAction("TestSaySomething", [](BT::TreeNode& self) {
        auto msg = self.getInput<std::string>("message");
        if (!msg) throw BT::RuntimeError("缺少必需的输入 [message]: ", msg.error());
        std::cout << "TestSaySomething: " << msg.value() << std::endl;
        return BT::NodeStatus::SUCCESS;
    });

    // 将 "no_sub" 作为第一个参数传递，以避免添加规则
    bool skip_substitution = (argc == 2) && std::string(argv[1]) == "no_sub";
    if (!skip_substitution) {
        // 我们可以使用 JSON 文件来配置替换规则，或者手动进行配置
        bool const USE_JSON = true;
        if (USE_JSON) {
            factory.loadSubstitutionRuleFromJSON(json_text);
        } else {
            // 将匹配此通配符模式的节点替换为 TestAction
            factory.addSubstitutionRule("mysub/action_*", "TestAction");
            // 将名为 [talk] 的节点替换为 TestSaySomething
            factory.addSubstitutionRule("talk", "TestSaySomething");
            // 此配置将传递给 TestNode
            BT::TestNodeConfig test_config;
            // 将节点转换为异步并等待 2000 毫秒
            test_config.async_delay = std::chrono::milliseconds(2000);
            // 完成后执行此后置条件
            test_config.post_script = "msg ='message SUBSTITUED'";
            // 将名为 [last_action] 的节点替换为 TestNode，使用 test_config 配置
            factory.addSubstitutionRule("last_action", test_config);
        }
    }

    factory.registerBehaviorTreeFromText(xml_text);

    // 在树的构建阶段，替换规则将用于实例化测试节点，而不是原始节点。
    auto tree = factory.createTree("MainTree");
    tree.tickWhileRunning();
    return 0;
}
```

**JSON 格式**：如果不想在代码中写规则，可以准备一个 JSON 文件，然后在运行时加载：

```json
{
  "TestNodeConfigs": {
    "MyTest": {
      "async_delay": 2000,
      "return_status": "SUCCESS",
      "post_script": "msg ='message SUBSTITUED'"
    }
  },
  "SubstitutionRules": {
    "mysub/action_*": "TestAction",
    "talk": "TestSaySomething",
    "last_action": "MyTest"
  }
}
```

- `TestNodeConfigs`：定义了一个名为 "MyTest" 的 TestNode 配置；
- `SubstitutionRules`：将匹配模式映射到目标。"last_action" 映射到配置名 "MyTest"，其他映射到节点类型名称。

之后在 C++ 中加载：

```cpp
factory.loadSubstitutionRuleFromJSON(json_text);  // json_text 是字符串或文件路径
```

之后创建树，规则就会生效。

---

## 第十部分 ROS2 集成

> 来源：入门版《第十二部分：ROS2 集成》＋ 详解版《二十、BT.CPP与ROS2的集成》

### 10.1 BehaviorTree.ROS2 包

- **版本提示**：当前 `BehaviorTree.ROS2` 官方仓库 README 明确要求 **BT.CPP 4.6 或更高版本、ROS 2 Humble 或更高版本**。如果项目使用较早的 BT.CPP/ROS2 组合，类名、端口和构造参数可能不同，应以项目实际依赖版本为准。

**安装**：

```bash
sudo apt install ros-humble-behaviortree-ros2

# 或从源码编译
cd ~/ros2_ws/src
git clone https://github.com/BehaviorTree/BehaviorTree.ROS2
colcon build
```

**系统架构方面应该**：

- 应该有一个集中的"协调器"ROS 节点，负责行为的执行。这将在下文称为"任务规划器"，并将使用 BT.CPP 实现；
- 系统的所有其他元素都应是"面向服务"组件，并应将任何业务逻辑和决策制定委托给任务规划器。

**术语区分**：

- ROS2 节点（`rclcpp::Node`）：ROS2 中通信基本单元；
- BT 节点（`BT::TreeNode`）：行为树中的节点；
- ROS Action（`rclcpp_action`）：ROS2 中用于长时间运行任务的通信机制；
- BT Action（`BT::ActionNodeBase`）：行为树中执行具体动作的节点。

### 10.2 异步 ROS Action 封装

与 ROS 交互的推荐方式是通过 `rclcpp_action`，因为：

- 它们的 API 是异步的，即用户无需担心创建单独的线程；
- 它们可以被中止，这是实现 `TreeNode::halt()` 和构建反应式行为所需的功能。

**详解版 FibonacciAction 完整示例**：

```cpp
#include <behaviortree_ros2/bt_action_node.hpp>
#include "action_tutorials_interfaces/action/fibonacci.hpp"

// 为简洁起见，我们定义这些类型
using Fibonacci = action_tutorials_interfaces::action::Fibonacci;
using GoalHandleFibonacci = rclcpp_action::ServerGoalHandle<Fibonacci>;
using namespace BT;

class FibonacciAction : public RosActionNode<Fibonacci> {
public:
    FibonacciAction(const std::string& name,
                    const BT::NodeConfig& conf,
                    const BT::RosNodeParams& params)
        : RosActionNode<Fibonacci>(name, conf, params) {}

    // 此派生类的特定端口
    // 应使用 RosActionNode::providedBasicPorts() 与基类的端口合并
    static BT::PortsList providedPorts() {
        return providedBasicPorts({ BT::InputPort<unsigned>("order") });
    }

    // 当 TreeNode 被滴答时调用此方法，它应向动作服务器发送请求
    bool setGoal(RosActionNode::Goal& goal) override {
        // 从输入端口获取 "order"
        getInput("order", goal.order);
        // 如果成功设置目标，则返回 true
        return true;
    }

    // 收到回复时执行的回调。根据回复，可以决定返回 SUCCESS 或 FAILURE
    BT::NodeStatus onResultReceived(const WrappedResult& wr) override {
        std::stringstream ss;
        ss << "收到结果: ";
        for (auto number : wr.result->sequence) ss << number << " ";
        RCLCPP_INFO(logger(), "%s", ss.str().c_str());
        return BT::NodeStatus::SUCCESS;
    }

    // 当客户端和服务器之间的通信出现错误时调用的回调。
    // 这将根据返回值将 TreeNode 的状态设置为 SUCCESS 或 FAILURE。
    // 如果不重写，默认返回 FAILURE。
    virtual BT::NodeStatus onFailure(BT::ActionNodeErrorCode error) override {
        RCLCPP_ERROR(logger(), "错误码: %d", static_cast<int>(error));
        return BT::NodeStatus::FAILURE;
    }

    // 我们也支持反馈的回调。
    // 通常，此回调应返回 RUNNING，但你可以根据反馈的值决定中止动作，
    // 并认为 TreeNode 已完成。在这种情况下，返回 SUCCESS 或 FAILURE。
    // 取消请求将自动发送到服务器。
    BT::NodeStatus onFeedback(const std::shared_ptr<const Feedback> feedback) {
        std::stringstream ss;
        ss << "收到序列中的下一个数字: ";
        for (auto number : feedback->partial_sequence) ss << number << " ";
        RCLCPP_INFO(logger(), "%s", ss.str().c_str());
        return BT::NodeStatus::RUNNING;
    }
};
```

**步骤**：

- 包含头文件 `<behaviortree_ros2/bt_action_node.hpp>`；
- 继承 `RosActionNode<ActionType>`；
- 重写关键方法：
  - `setGoal()`：填充目标请求，返回 true 表示成功；
  - `onResultReceived()`：处理最终结果，返回 SUCCESS 或 FAILURE；
  - `onFeedback()`（可选）：处理反馈，通常返回 RUNNING；若需中止，可返回 SUCCESS/FAILURE；
  - `onFailure()`（可选）：处理通信错误，返回状态；
- 在 `providedPorts()` 中，除了自定义端口，还要调用 `providedBasicPorts()` 合并基类端口（如服务名称）；
- 注册节点时，需要传递 `RosNodeParams` 结构，包含 ROS 节点句柄和服务名称。

动作客户端的 BT 版本比原始版本更简单，因为大部分样板代码都封装在 `BT::RosActionNode` 包装器中。注册此节点，需要使用 `BT::RosNodeParams` 传递 `rclcpp::Node` 和其他参数：

```cpp
// 在 main() 函数中
BT::BehaviorTreeFactory factory;
auto node = std::make_shared<rclcpp::Node>("fibonacci_action_client");
// 提供 ROS 节点和动作服务的名称
BT::RosNodeParams params;
params.nh = node;
params.default_port_value = "fibonacci";
factory.registerNodeType<FibonacciAction>("Fibonacci", params);
```

**入门版 ROS Action 客户端节点示例（Nav2 NavigateToPose）**：

```cpp
#include "behaviortree_ros2/bt_action_node.hpp"

class MoveBaseAction : public BT::RosActionNode<nav2_msgs::action::NavigateToPose> {
public:
    MoveBaseAction(const std::string& name, const BT::NodeConfig& config,
                   const BT::RosNodeParams& params)
        : BT::RosActionNode<nav2_msgs::action::NavigateToPose>(name, config, params) {}

    static BT::PortsList providedPorts() {
        return providedBasicPorts({
            BT::InputPort<geometry_msgs::msg::PoseStamped>("goal")
        });
    }

    bool setGoal(Goal& goal) override {
        auto input = getInput<geometry_msgs::msg::PoseStamped>("goal");
        if (!input) {
            RCLCPP_ERROR(logger(), "%s", input.error().c_str());
            return false;
        }
        goal.pose = input.value();
        return true;
    }

    BT::NodeStatus onResultReceived(const WrappedResult& result) override {
        if (result.code == rclcpp_action::ResultCode::SUCCEEDED) {
            return BT::NodeStatus::SUCCESS;
        }
        return BT::NodeStatus::FAILURE;
    }

    BT::NodeStatus onFailure(BT::ActionNodeErrorCode error) override {
        RCLCPP_ERROR(logger(), "Action failed: %d", static_cast<int>(error));
        return BT::NodeStatus::FAILURE;
    }
};
```

### 10.3 ROS Service 客户端节点

**详解版（rclcpp::Client 服务）**：对于 ROS 服务客户端，也有一个类似的包装器可用，将使用异步接口。下面的示例基于官方教程：

```cpp
#include <behaviortree_ros2/bt_service_node.hpp>
#include "example_interfaces/srv/add_two_ints.hpp"

using AddTwoInts = example_interfaces::srv::AddTwoInts;
using namespace BT;

class AddTwoIntsNode : public RosServiceNode<AddTwoInts> {
public:
    AddTwoIntsNode(const std::string& name,
                   const BT::NodeConfig& conf,
                   const BT::RosNodeParams& params)
        : RosServiceNode<AddTwoInts>(name, conf, params) {}

    // 此派生类的特定端口
    // 应使用 RosServiceNode::providedBasicPorts() 与基类的端口合并
    static BT::PortsList providedPorts() {
        return providedBasicPorts({ BT::InputPort<unsigned>("A"),
                                    BT::InputPort<unsigned>("B") });
    }

    // 当 TreeNode 被滴答时调用此方法，它应向服务提供者发送请求
    bool setRequest(Request::SharedPtr& request) override {
        // 使用输入端口设置 A 和 B
        getInput("A", request->a);
        getInput("B", request->b);
        // 如果准备好发送请求，必须返回 true
        return true;
    }

    // 收到应答时调用的回调。必须返回 SUCCESS 或 FAILURE
    BT::NodeStatus onResponseReceived(const Response::SharedPtr& response) override {
        RCLCPP_INFO(logger(), "和: %ld", response->sum);
        return BT::NodeStatus::SUCCESS;
    }

    // 当客户端和服务器之间的通信出现错误时调用的回调。
    // 如果不重写，默认返回 FAILURE。
    virtual BT::NodeStatus onFailure(BT::ServiceNodeErrorCode error) override {
        RCLCPP_ERROR(logger(), "错误码: %d", static_cast<int>(error));
        return BT::NodeStatus::FAILURE;
    }
};
```

**入门版 ROS Service 客户端节点示例（GetPose）**：

> 注意：`robot_msgs::srv::GetPose` 属于**自定义接口**，既不是 ROS2 标准接口也不是 `example_interfaces` 中的类型。若要跟着示例练习，可以换成 `example_interfaces::srv::AddTwoInts` 等已有接口。

```cpp
#include "behaviortree_ros2/bt_service_node.hpp"

class GetPoseService : public BT::RosServiceNode<robot_msgs::srv::GetPose> {
public:
    GetPoseService(const std::string& name, const BT::NodeConfig& config,
                   const BT::RosNodeParams& params)
        : BT::RosServiceNode<robot_msgs::srv::GetPose>(name, config, params) {}

    static BT::PortsList providedPorts() {
        return { BT::OutputPort<geometry_msgs::msg::Pose>("pose") };
    }

    bool setRequest(Request::SharedPtr& request) override {
        request->frame_id = "base_link";
        return true;
    }

    BT::NodeStatus onResponseReceived(const Response::SharedPtr& response) override {
        setOutput("pose", response->pose);
        return BT::NodeStatus::SUCCESS;
    }
};
```

### 10.4 注册和使用（含主循环）

**入门版完整 main**：

```cpp
int main(int argc, char** argv) {
    rclcpp::init(argc, argv);
    auto node = std::make_shared<rclcpp::Node>("bt_node");

    BT::BehaviorTreeFactory factory;
    BT::RosNodeParams params;
    params.nh = node;
    params.default_port_value = "navigate_to_pose";

    factory.registerNodeType<MoveBaseAction>("MoveBase", params);
    factory.registerNodeType<GetPoseService>("GetPose", params);

    auto tree = factory.createTreeFromFile("robot_bt.xml");

    while (rclcpp::ok()) {
        const auto status = tree.tickOnce();
        rclcpp::spin_some(node);
        if (status != BT::NodeStatus::RUNNING) {
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    rclcpp::shutdown();
    return 0;
}
```

---

## 第十一部分 实战案例

> 来源：入门版《第十三部分：实战案例》＋ 详解版《十二、子树与模块化开发》的 CrossDoor C++ 实现

### 11.1 案例一：巡逻机器人

需求：机器人在 A、B、C 三个点之间巡逻，电量低时回充电站（入门版）。

**解析**（入门版）：

1. `ReactiveFallback` 保证电量检查始终优先；
2. `ReactiveSequence` 让充电条件持续被检查；
3. `SequenceWithMemory` 记住巡逻进度。

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="PatrolRobot">
    <ReactiveFallback>
      <!-- 优先级最高：电量低时去充电 -->
      <ReactiveSequence>
        <IsBatteryLow threshold="20"/>
        <GoToCharger/>
        <Charge/>
      </ReactiveSequence>

      <!-- 正常巡逻 -->
      <SequenceWithMemory>
        <Patrol point="A"/>
        <Patrol point="B"/>
        <Patrol point="C"/>
      </SequenceWithMemory>
    </ReactiveFallback>
  </BehaviorTree>
</root>
```

### 11.2 案例二：取物机器人

需求：找到目标物品，抓取并放置到指定位置（入门版）。

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="PickAndPlace">
    <Sequence>
      <!-- 寻找目标 -->
      <Fallback>
        <IsObjectKnown object="{target}"/>
        <Sequence>
          <LookAround/>
          <DetectObject object="{target}"/>
        </Sequence>
      </Fallback>

      <!-- 移动到物品位置（带重试） -->
      <Retry num_attempts="3">
        <MoveTo goal="{target_pose}"/>
      </Retry>

      <!-- 抓取 -->
      <Sequence>
        <OpenGripper/>
        <ApproachObject/>
        <CloseGripper/>
      </Sequence>

      <!-- 放置 -->
      <MoveTo goal="{place_pose}"/>
      <OpenGripper/>
      <Retreat/>
    </Sequence>
  </BehaviorTree>
</root>
```

### 11.3 案例三：CrossDoor（子树 + 装饰器 + 回退组合）

> 来源：详解版《十二、子树与模块化开发》2.2

**C++ 代码，动作的实现和注册**：

```cpp
class CrossDoor {
public:
    void registerNodes(BT::BehaviorTreeFactory& factory);

    // 如果 _door_open != true 则返回 SUCCESS
    BT::NodeStatus isDoorClosed();
    // 如果 _door_open == true 则返回 SUCCESS
    BT::NodeStatus passThroughDoor();
    // 尝试若干次后，将打开一扇锁着的门
    BT::NodeStatus pickLock();
    // 如果门锁着则返回 FAILURE
    BT::NodeStatus openDoor();
    // 总是能打开门
    BT::NodeStatus smashDoor();
private:
    bool _door_open = false;
    bool _door_locked = true;
    int _pick_attempts = 0;
};

// 辅助方法，使注册对用户更简单
void CrossDoor::registerNodes(BT::BehaviorTreeFactory& factory) {
    factory.registerSimpleCondition("IsDoorClosed", std::bind(&CrossDoor::isDoorClosed, this));
    factory.registerSimpleAction("PassThroughDoor", std::bind(&CrossDoor::passThroughDoor, this));
    factory.registerSimpleAction("OpenDoor", std::bind(&CrossDoor::openDoor, this));
    factory.registerSimpleAction("PickLock", std::bind(&CrossDoor::pickLock, this));
    factory.registerSimpleCondition("SmashDoor", std::bind(&CrossDoor::smashDoor, this));
}

int main() {
    BT::BehaviorTreeFactory factory;
    CrossDoor cross_door;
    cross_door.registerNodes(factory);

    // 在这个例子中，单个 XML 包含多个 <BehaviorTree>
    // 要确定哪一个是"主树"，应该先注册 XML，然后使用其 ID 分配特定的树
    factory.registerBehaviorTreeFromText(xml_text);
    auto tree = factory.createTree("MainTree");

    // 辅助函数，用于打印树
    BT::printTreeRecursively(tree.rootNode());
    tree.tickWhileRunning();
    return 0;
}
```

**整体行为**：

- 初始状态：门是关着的（`_door_open=false`），并且锁着（`_door_locked=true`），撬锁次数为 0；
- 第一次 tick：
  - 主树的 `Fallback` 先执行 `Inverter(IsDoorClosed)`：因为门关着，`IsDoorClosed` 返回 SUCCESS，取反后变成 FAILURE，所以 `Fallback` 继续执行第二个子节点 `SubTree`；
  - 进入子树 `DoorClosed`：
    - 先尝试 `OpenDoor`：门锁着，返回 FAILURE；
    - 然后执行 `RetryUntilSuccessful(PickLock)`：`PickLock` 第一次尝试失败（因为还没到 3 次），返回 FAILURE，重试节点会再次 tick 它。这样经过三次 tick，`PickLock` 成功（假设第三次成功），子树返回 SUCCESS；
  - 子树成功后，主树的 `Fallback` 返回 SUCCESS，接着执行 `PassThroughDoor`，成功穿过，主树返回 SUCCESS；
- 如果在撬锁过程中门的状态被外部改变（比如锁被解开），`PickLock` 可能更早成功；
- 如果 `OpenDoor` 成功（例如门没锁），子树会立即返回成功，不会尝试撬锁或砸门。

---

## 第十二部分 附录：XML 模式、速查表、FAQ

### 12.1 XML 模式参考

> 来源：详解版《十九、附录：xml模式参考》

可以看到一棵简单的用 XML 编写的树：

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence name="root_sequence">
      <SaySomething   name="action_hello"    message="Hello"/>
      <OpenGripper    name="open_gripper"/>
      <ApproachObject name="approach_object"/>
      <CloseGripper   name="close_gripper"/>
    </Sequence>
  </BehaviorTree>
</root>
```

- 在这棵树中，首先需要的是 `<root>` 根节点，它的下面可以包含一个或多个叶节点；
- 在下面的叶节点中，标签 `<BehaviorTree>` 具有属性 `ID`；
- 在 root 节点中，要添加属性 `BTCPP_format`；
- 每个树节点都应该设置一个标签，标签可设置属性 `name`；
- 标签的名称是用于工厂中注册该树节点的 ID；
- 属性 `name` 指的是实例名称，且为可选项；
- 需要添加端口进行配置时，需要输入端口 `message`。

**1. 端口重映射与指向黑板条目的指针**：输入/输出端口可以使用黑板中的条目名称（即黑板键/值对的键）进行重映射。黑板键使用以下语法表示：`{key_name}`。

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence name="root_sequence">
      <SaySomething message="Hello"/>
      <SaySomething message="{my_message}"/>
    </Sequence>
  </BehaviorTree>
</root>
<!-- 序列的第一个子节点打印 "hello"
     第二个子节点读取并写入黑板中名为 "my_message" 的条目所包含的值 -->
```

**2. 紧凑表示法与显式表示法**：以下两种语法都是有效的：

```xml
<SaySomething name="action_hello" message="Hello World"/>
<Action ID="SaySomething" name="action_hello" message="Hello World"/>
```

将前者称为"紧凑"语法，后者称为"显式"语法。即使紧凑语法更方便、更易编写，但提供的关于树节点模型的信息太少，像 Groot 这样的工具需要显式语法或额外信息。这些信息可以使用 `<TreeNodesModel>` 标签添加：

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence name="root_sequence">
      <SaySomething   name="action_hello"/>
      <OpenGripper    name="open_gripper"/>
      <ApproachObject name="approach_object"/>
      <CloseGripper   name="close_gripper"/>
    </Sequence>
  </BehaviorTree>

  <!-- 行为树执行器不需要这个，但 Groot 需要 -->
  <TreeNodeModel>
    <Action ID="SaySomething">
      <input_port name="message" type="std::string" />
    </Action>
    <Action ID="OpenGripper"/>
    <Action ID="ApproachObject"/>
    <Action ID="CloseGripper"/>
  </TreeNodeModel>
</root>
```

**3. 子树**：可以将子树包含在另一个树中，避免在多个位置"复制粘贴"相同的树，降低复杂性。假设想将一些动作封装到名为 `GraspObject` 的行为树中（省略可选属性 `name`）：

```xml
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence>
      <Action ID="SaySomething" message="Hello World"/>
      <SubTree ID="GraspObject"/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="GraspObject">
    <Sequence>
      <Action ID="OpenGripper"/>
      <Action ID="ApproachObject"/>
      <Action ID="CloseGripper"/>
    </Sequence>
  </BehaviorTree>
</root>
```

整个树 `GraspObject` 会在 `SaySomething` 之后执行。

**4. 包含外部文件**：可以包含外部文件，类似于 C++ 中的 `#include <file>`。可以使用 `<include path="relative_or_absolute_path_to_file">` 标签来实现。可以将行为树分割到两个文件中：

```xml
<!-- 文件 maintree.xml -->
<root BTCPP_format="4">
  <include path="grasp.xml"/>
  <BehaviorTree ID="MainTree">
    <Sequence>
      <Action ID="SaySomething" message="Hello World"/>
      <SubTree ID="GraspObject"/>
    </Sequence>
  </BehaviorTree>
</root>

<!-- 文件 grasp.xml -->
<root BTCPP_format="4">
  <BehaviorTree ID="GraspObject">
    <Sequence>
      <Action ID="OpenGripper"/>
      <Action ID="ApproachObject"/>
      <Action ID="CloseGripper"/>
    </Sequence>
  </BehaviorTree>
</root>
```

如果想在 ROS 功能包内查找该文件，可以使用以下语法：

```xml
<include ros_pkg="name_package" path="path_relative_to_pkg/grasp.xml"/>
```

### 12.2 速查表

> 来源：入门版《附录 A：速查表》

**控制节点：**

| 节点 | 成功条件 | 失败条件 |
|---|---|---|
| Sequence | 所有子节点成功 | 任一子节点失败 |
| Fallback | 任一子节点成功 | 所有子节点失败 |
| Parallel | N 个成功 | M 个失败 |

**装饰节点：**

| 节点 | 作用 |
|---|---|
| Inverter | 反转结果 |
| Retry | 失败时重试 |
| Repeat | 重复执行 |
| Timeout | 限制时间 |
| ForceSuccess | 强制成功 |

**前置/后置条件：**

| 属性 | 作用 |
|---|---|
| `_skipIf` | 条件为真时跳过 |
| `_failureIf` | 条件为真时失败 |
| `_successIf` | 条件为真时成功 |
| `_onSuccess` | 成功后执行脚本 |
| `_onFailure` | 失败后执行脚本 |

### 12.3 端口类型转换（自定义类型）

> 来源：入门版《附录 B：端口类型转换》

当端口类型与黑板变量类型不匹配时，需要提供类型转换：

```cpp
// 自定义类型
struct Point3D { double x, y, z; };

// 提供字符串转换
namespace BT {
template <> inline Point3D convertFromString(StringView str) {
    auto parts = splitString(str, ';');
    Point3D p;
    p.x = std::stod(parts[0]);
    p.y = std::stod(parts[1]);
    p.z = std::stod(parts[2]);
    return p;
}
} // namespace BT
```

XML 中使用：

```xml
<MoveTo goal="1.0;2.0;3.0"/>   <!-- 自动调用 convertFromString -->
```

### 12.4 常见问题（FAQ）

> 来源：入门版《附录 C：常见问题》

**Q1：为什么我的节点不执行？**

可能原因：

1. 节点没有注册到 factory；
2. XML 中的 ID 与注册名不匹配；
3. 父节点提前返回了。

排查方法：添加 `StdCoutLogger` 查看执行流程。

**Q2：端口读取返回空值？**

可能原因：

1. XML 中没有提供端口值；
2. 黑板变量名写错了；
3. 输出端口还没有被写入。

解决方法：

```cpp
auto result = getInput<T>("port_name");
if (!result) { throw BT::RuntimeError(result.error()); }
```

**Q3：StatefulActionNode 的 onRunning 不被调用？**

原因：`onStart()` 没有返回 RUNNING。

正确做法：

```cpp
BT::NodeStatus onStart() override {
    startAsyncOperation();
    return BT::NodeStatus::RUNNING;   // 必须返回 RUNNING
}
```

**Q4：如何在节点之间共享复杂对象？**

方法：使用黑板存储 `shared_ptr`。

```cpp
// 创建时
blackboard->set<std::shared_ptr<MyClass>>("shared_obj", obj);
// 使用时
auto obj = blackboard->get<std::shared_ptr<MyClass>>("shared_obj");
```

### 12.5 版本信息与资源

> 来源：入门版《附录 D：版本信息》＋详解版《结尾》

- **BehaviorTree.CPP 4.x**：本教程适用版本；
- 官方文档：<https://www.behaviortree.dev/>
- 官方文档（intro）：<https://www.behaviortree.dev/docs/intro>
- GitHub：<https://github.com/BehaviorTree/BehaviorTree.CPP>
- Groot2 下载：<https://www.behaviortree.dev/groot>
- BehaviorTree.ROS2：<https://github.com/BehaviorTree/BehaviorTree.ROS2>

> **版本兼容提醒**：BehaviorTree.ROS2 官方 README 当前要求 **BT.CPP 4.6+ 且 ROS 2 Humble+**；本文其余内容基于 BehaviorTree.CPP 4.x 主线，部分节点（如 `ParallelAll`、`AsyncSequence`）和个别 API 在早期 4.x 中可能尚未提供或行为不同，请以项目锁定版本为准。

本教程内容整理自 BehaviorTree.CPP 官方文档，如有更新请参考官网。详解版结尾说明：参考了官方文档，使用了 AI 进行英文翻译以及部分总结。

---

*全文完。本文保留了原整理稿的章节结构，发布时统一了标题层级，部分示例改为巡检与扫码场景。*
