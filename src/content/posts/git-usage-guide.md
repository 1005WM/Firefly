---
title: 'Git 使用教程：从入门到实战'
published: 2026-11-16
description: 从 Git 安装和第一次提交开始，练习分支协作、合并冲突和版本回退，附常用命令速查表。
image: './images/git-usage-guide-cover.avif'
tags: [Git, 版本控制, 开发工具]
category: 优质工具
readingPalette: ocean
---

> 面向零基础到初中级使用者。目标是看完能独立用 Git 管理代码、分支协作、处理冲突与回退错误。

## 一、Git 是什么，为什么要用

Git 是一个**分布式版本控制系统**。它把项目的每一次改动都记录下来，让你随时能回到过去的任意版本，也支持多人同时开发同一项目而互不覆盖。

- **集中式（SVN）**：只有服务器存完整历史，本地只有当前版本；断网基本干不了活。
- **分布式（Git）**：每个人本地都有一份完整仓库（含全部历史），提交、分支、回退都在本地完成，只在需要时与远程同步。

典型用途：代码版本管理、多人协作、代码审查、发布打 tag、出错快速回滚。

---

## 二、安装与初始配置

### 安装

- Windows：下载 [Git for Windows](https://git-scm.com/download/win)，一路默认安装；装完有 "Git Bash" 终端。
- macOS：`brew install git`（或安装 Xcode Command Line Tools）。
- Linux（Debian/Ubuntu）：`sudo apt install git`

验证：

```bash
git --version
```

### 首次配置（必做，只需一次）

```bash
git config --global user.name "你的名字"
git config --global user.email "your@email.com"
```

这两行会写进 `~/.gitconfig`，之后每次 commit 都用这个身份。

常用优化配置：

```bash
git config --global init.defaultBranch main      # 新仓库默认分支叫 main
git config --global core.editor "code --wait"   # 用 VS Code 作默认编辑器
git config --global core.autocrlf input         # Linux/macOS；Windows 用 true
git config --global pull.rebase false           # pull 默认用 merge
```

查看配置：

```bash
git config --list
```

---

## 三、核心概念：四个区域与三种状态

理解这四个区域，就理解了 Git 的一半：

| 区域 | 英文 | 说明 |
|---|---|---|
| 工作区 | Working Directory | 你能看到、直接编辑的项目文件夹 |
| 暂存区 | Staging Area / Index | 一个"待提交清单"，挑选要打包的改动 |
| 本地仓库 | Local Repository | `.git` 目录，保存所有提交历史 |
| 远程仓库 | Remote Repository | GitHub / GitLab / Gitee 等服务器上的仓库 |

文件的三种状态：

- **已修改（modified）**：改了但还没放进暂存区。
- **已暂存（staged）**：标记了下次 commit 要包含它。
- **已提交（committed）**：已安全存进本地仓库。

标准流程：`工作区 --git add--> 暂存区 --git commit--> 本地仓库 --git push--> 远程仓库`

---

## 四、第一个仓库：add 与 commit

### 方式一：新建仓库

```bash
mkdir my-project && cd my-project
git init                      # 在当前目录初始化一个空仓库（生成 .git）
echo "# My Project" > README.md
git add README.md             # 把文件加入暂存区
git commit -m "初始提交：添加 README"
```

### 方式二：克隆已有仓库

```bash
git clone https://github.com/user/repo.git
cd repo
```

### add 的常见写法

```bash
git add file.txt              # 添加单个文件
git add dir/                  # 添加整个目录
git add .                     # 添加当前目录下所有改动（不含删除）
git add -A                    # 添加所有改动（含删除、重命名）
git add -p                    # 交互式，逐块挑选要暂存的改动 ← 强烈推荐
```

### commit

```bash
git commit -m "清晰的提交说明"
git commit -am "跳过 add，直接提交已跟踪文件的修改"   # 新文件不行
git commit --amend -m "修正上一次提交"                 # 改上一条提交
```

**提交信息建议**：用祈使句、简短说明"做了什么"，例如 `修复登录页空指针异常`、`添加用户注册接口`。避免 `update`、`修改`、`123` 这类无意义信息。

查看当前状态（`git status` 是你最常用的命令）：

```bash
git status
git status -s                 # 简短输出：M 修改 / A 新增 / D 删除 / ?? 未跟踪
```

### 完整实战：一次标准的代码提交

前面拆开讲了每条命令，这里用一个真实场景把它们串起来。假设你要给项目加"用户登录"功能，改了 2 个旧文件、新增 1 个文件。

**第 1 步：改完代码，先看状态**

```bash
$ git status
On branch main
Changes not staged for commit:
  modified:   src/app.js
  modified:   src/route.js
Untracked files:
  src/login.js
```

**第 2 步：看看到底改了什么（提交前必看，避免误提交）**

```bash
git diff                 # 检查两个旧文件的改动是否符合预期
git diff --staged        # 此时暂存区为空，无输出
```

**第 3 步：确认没有误入的调试代码 / 密码 / 临时文件**

```bash
git status --short       # 快速扫一遍所有变动
# 发现 node_modules/ 或 .env 之类？先加进 .gitignore，别提交
```

**第 4 步：分批暂存（推荐按功能分组，别无脑 git add .）**

```bash
git add src/login.js src/app.js src/route.js
```

**第 5 步：提交前复查暂存区**

```bash
git diff --staged        # 确认这次要提交的就这几处改动
```

**第 6 步：提交，写好提交信息**

```bash
git commit -m "feat: 添加用户登录功能与路由"
```

**第 7 步：推送到远程仓库**

```bash
git push                 # 已有上游关联时
git push -u origin main  # 首次推送
```

一次标准提交就完成了。核心习惯是：**先看（status/diff）→ 再暂存 → 再复查 → 后提交 → 最后推送**，每一步都确认过，能挡掉绝大多数误提交。

**提交信息规范：约定式提交（Conventional Commits）**

团队协作推荐统一格式 `类型: 简短说明`，常见类型：

| 类型 | 含义 | 示例 |
|---|---|---|
| `feat` | 新功能 | `feat: 添加用户登录功能` |
| `fix` | 修 bug | `fix: 修复登录后跳转失效` |
| `docs` | 文档 | `docs: 更新接口说明` |
| `style` | 格式调整（不影响逻辑） | `style: 统一缩进` |
| `refactor` | 重构 | `refactor: 抽取鉴权逻辑` |
| `test` | 测试 | `test: 补充登录单测` |
| `chore` | 杂项（依赖、构建） | `chore: 升级依赖版本` |

> 一次提交只做一件事。改了登录又顺手改了样式？拆成两个提交，日后回滚和排查都轻松得多。

---

## 五、查看历史与差异

```bash
git log                              # 完整提交历史
git log --oneline                    # 每条提交压缩成一行
git log --oneline --graph --all      # 带分支图的漂亮历史
git log -5                           # 只看最近 5 条
git log --author="张三"              # 按作者筛选
git log --since="2026-01-01"         # 按时间筛选

git diff                             # 工作区 vs 暂存区（还没 add 的改动）
git diff --staged                    # 暂存区 vs 本地仓库（已 add 未 commit 的改动）
git diff HEAD                        # 工作区 vs 最新提交
git diff <commit1> <commit2>         # 比较两个提交
```

> 小技巧：`git log --oneline --graph --decorate --all` 配成别名 `git lg`，看分支极其舒服（配置见"实用技巧"）。

---

## 六、分支管理

分支是 Git 最强大的功能：**每条分支是一条独立的开发线**，互不干扰，随时合并。

```bash
git branch                    # 列出本地分支（* 表示当前）
git branch dev                # 创建 dev 分支
git switch dev                # 切换到 dev（旧写法 git checkout dev）
git switch -c feature/login   # 创建并切换到新分支 ← 常用
git branch -d dev             # 删除已合并的 dev 分支
git branch -D dev             # 强制删除未合并分支（小心）
```

### 合并分支：merge 与 rebase

假设你在 `feature` 分支开发完，要并回 `main`：

```bash
# 方式 A：merge（保留分叉历史，最安全）
git switch main
git merge feature

# 方式 B：rebase（把提交"接"到 main 顶端，历史是一条直线）
git switch feature
git rebase main
git switch main
git merge feature             # 此时通常是快进合并
```

**区别与选择**：

| | merge | rebase |
|---|---|---|
| 历史 | 保留真实分叉，有 merge commit | 线性、干净 |
| 安全性 | 不改写已有提交，安全 | 改写提交哈希，**不要对已 push 的公共分支用** |
| 适用 | 合并公共分支、多人协作分支 | 整理自己本地未推送的提交 |

> 黄金法则：**不要 rebase 已经推送到远程、别人可能基于它开发的提交。**

---

## 七、远程仓库协作

### 关联远程

```bash
git remote -v                                    # 查看已配置的远程
git remote add origin https://github.com/user/repo.git   # 添加远程（习惯叫 origin）
git remote remove origin                         # 移除远程
```

### 推送与拉取

```bash
git push -u origin main       # 首次推送，并建立上游跟踪关系
git push                      # 之后直接推（已有关联）
git push origin dev           # 推送指定分支

git fetch origin              # 只下载远程更新，不改工作区
git pull                      # fetch + merge，直接更新当前分支
git pull --rebase             # fetch + rebase，历史更干净
```

`fetch` 与 `pull` 的区别：`fetch` 只是把远程数据取回来放到 `origin/main`，不合并；`pull` 会立刻合并到当前分支。想先看看别人改了什么再决定，就用 `fetch`。

### SSH 免密配置（推荐）

```bash
ssh-keygen -t ed25519 -C "your@email.com"   # 生成密钥，一路回车
cat ~/.ssh/id_ed25519.pub                    # 复制公钥内容
```

把公钥粘贴到 GitHub / GitLab → Settings → SSH Keys。之后用 `git@github.com:user/repo.git` 地址克隆和推送，不用每次输密码。

---

## 八、撤销、回退与找回

按"改动到了哪一步"选对应命令：

| 场景 | 命令 | 效果 |
|---|---|---|
| 改乱了工作区文件，还没 add | `git restore file.txt` | 丢弃工作区改动，回到上次 add/commit 的状态 |
| 已 add，想撤回暂存 | `git restore --staged file.txt` | 从暂存区移回工作区（文件改动还在） |
| 已 commit，想撤销但保留改动 | `git reset --soft HEAD~1` | 回到上一个提交，改动留在暂存区 |
| 已 commit，想撤销并保留改动在工作区 | `git reset HEAD~1`（默认 mixed） | 改动留在工作区，未暂存 |
| 已 commit，想彻底丢弃 | `git reset --hard HEAD~1` | ⚠️ 改动全部丢失，慎用 |
| 已 push，要安全撤销 | `git revert <commit>` | 生成一个"反向提交"，不改历史，协作推荐 |
| 误操作丢了提交 | `git reflog` → `git reset --hard <hash>` | 用 reflog 找回"丢失"的提交 |

**重点区分**：

- `reset` 会**移动分支指针**，改写历史；对已 push 的提交慎用。
- `revert` 是**新增一次提交来抵消旧提交**，历史保留，适合公共分支。
- `--hard` 会丢弃所有未提交改动，执行前先 `git status` 确认。

---

## 九、解决合并冲突

当两个分支改了同一文件的同一行，`git merge` / `git pull` 会报冲突：

```
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

解决步骤：

1. `git status` 查看哪些文件冲突。
2. 打开冲突文件，会看到标记：

   ```text
   <<<<<<< HEAD
   这里是当前分支（你）的内容
   =======
   这里是对方分支的内容
   >>>>>>> feature
   ```

3. 手动编辑成正确内容，**删掉 `<<<<<<<`、`=======`、`>>>>>>>` 标记**。
4. 标记已解决：

```bash
git add index.html
git commit -m "解决与 feature 分支的合并冲突"
```

5. 如果是 rebase 中的冲突：解决后 `git add .` 然后 `git rebase --continue`（放弃则 `git rebase --abort`）。

> 冲突不是错误，是 Git 无法替你决定保留哪版。解决后务必测试，确认两边的功能都还在。

---

## 十、实用技巧

### .gitignore：忽略不该提交的文件

在项目根目录建 `.gitignore`：

```
*.log
node_modules/
dist/
build/
.env
__pycache__/
*.pyc
.DS_Store
.vscode/
```

如果文件已经被跟踪了，加进 `.gitignore` 也不会生效，需先移除跟踪：

```bash
git rm --cached -r node_modules/
git commit -m "停止跟踪 node_modules"
```

### git stash：临时存起当前改动

```bash
git stash              # 把当前改动收起来，工作区变干净
git stash push -m "临时保存"
git stash list         # 查看保存列表
git stash pop          # 恢复最近一次 stash 并删除记录
git stash apply        # 恢复但保留记录
```

场景：手上改到一半，突然要切分支修紧急 bug——先 stash，修完再 pop 回来。

### tag：给版本打标签

```bash
git tag v1.0.0                 # 轻量标签
git tag -a v1.0.0 -m "首个正式版"   # 附注标签（推荐）
git tag                        # 列出标签
git push origin v1.0.0         # 推送标签
git push origin --tags         # 推送所有标签
```

### 配置别名，提升效率

```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.lg "log --oneline --graph --decorate --all"
```

之后 `git lg`、`git st` 就能用了。

### 其他常用

```bash
git show <commit>              # 查看某次提交的具体改动
git blame file.txt             # 逐行显示是谁在什么时候改的
git cherry-pick <commit>       # 把某个提交"摘"到当前分支
git clean -nd                  # 预览会删除哪些未跟踪文件（-f 真正删除，慎用）
git mv old.txt new.txt         # 重命名文件（保留历史）
```

---

## 十一、协作工作流与最佳实践

### 常见工作流

1. **功能分支工作流（最常用）**：`main` 永远可发布；每个功能/修复开一个 `feature/xxx` 或 `fix/xxx` 分支，开发完发 Pull Request / Merge Request，审核通过后合并。
2. **Forking 工作流**：开源项目常用，贡献者 fork 到自己账号，改完向原仓库提 PR。
3. **Git Flow**：`main` + `develop` + feature/release/hotfix 分支，流程重，适合有固定发版节奏的团队。

### 提交规范建议

- 一个提交只做一件事，改得越细越好回滚。
- 提交前 `git status` + `git diff --staged` 检查一遍，别把临时文件、密码、调试代码提交进去。
- 遵循约定式提交（Conventional Commits）：`feat: 添加登录功能`、`fix: 修复空指针`、`docs: 更新 README`、`refactor: 重构支付模块`。

### 三条铁律

1. **勤提交**：小步快跑，别攒一大堆改动一次性提交。
2. **pull 前先 commit**：本地有未提交改动时 pull 容易产生冲突。
3. **公共分支勿强推**：`git push --force` 会覆盖别人的提交，如必须用 `git push --force-with-lease`。

---

## 十二、命令速查表

```bash
# 初始化 / 获取仓库
git init                          # 初始化本地仓库
git clone <url>                   # 克隆远程仓库

# 日常提交
git status                        # 查看状态
git add .                         # 暂存所有改动
git add -p                        # 逐块暂存
git commit -m "msg"               # 提交
git commit --amend                # 修正上次提交

# 查看
git log --oneline --graph --all   # 图形化历史
git diff                          # 查看未暂存改动
git diff --staged                 # 查看已暂存改动

# 分支
git branch                        # 列出分支
git switch -c <name>              # 创建并切换分支
git switch <name>                 # 切换分支
git merge <branch>                # 合并分支
git rebase <branch>               # 变基
git branch -d <name>              # 删除分支

# 远程
git remote -v                     # 查看远程
git push -u origin main           # 首次推送
git push                          # 推送
git fetch                         # 获取远程更新（不合并）
git pull                          # 获取并合并
git clone <url>                   # 克隆

# 撤销 / 回退
git restore <file>                # 丢弃工作区改动
git restore --staged <file>       # 取消暂存
git reset --soft HEAD~1           # 撤销提交，保留在暂存区
git reset --hard HEAD~1           # 彻底回退（危险）
git revert <commit>               # 安全撤销（生成反向提交）
git reflog                        # 查看所有操作记录，用于找回

# 临时 / 辅助
git stash                         # 暂存当前改动
git stash pop                     # 恢复改动
git tag -a v1.0 -m "说明"         # 打标签
git blame <file>                  # 追溯每行作者
git cherry-pick <commit>          # 摘取提交
```

---

## 附录：遇到问题怎么办

- 先看 `git status`——它通常会告诉你下一步该做什么。
- 报错信息读最后一行，多数能直接搜到答案。
- 不确定某命令会不会破坏数据？先 `git status`，不确定就先 `git stash` 或新建分支试验。
- 想系统学习：推荐免费互动教程 [Learn Git Branching](https://learngitbranching.js.org/)（可视化练习分支操作）与 Pro Git 中文书（https://git-scm.com/book/zh/v2）。

> 记住：Git 里绝大多数"灾难"都能通过 `reflog` 找回。放心大胆地用分支练习，别怕犯错。
