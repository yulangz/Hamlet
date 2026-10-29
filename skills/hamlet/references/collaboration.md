# Leader / Worker 协作

Leader/Worker 是本例的任务分工名称，不是系统身份；权限仍由 admin/worker 配置。本例使用一个 Leader 和若干 Worker，同组、fork 模式、各有独立目录，以消息通知完成。人数、模型、资源和工作目录按实际任务配置；Worker 的本次分工由 Leader 决定。

## 任务与交接

Leader 负责拆分、派发和验收。每项任务说明目标、输入、输出路径、验收标准、任务版本和真实回复地址；按任务需要安排派发与后续处理。

共享记录至少包含 task_id、version、状态、结果路径，以及以下地址：

| 字段 | 来源与用途 |
| --- | --- |
| logical_id | 创建 Agent 返回的短 ID，用于派发新任务 |
| working_instance_id | 接收者从 whoami / HAMLET_INSTANCE_ID 读取的长 ID，用于继续该任务 |
| reply_to_instance_id | 派发者自己的真实长 ID，用于返回结果 |

例如任务 research-01 v1，Leader 是 `aaaaaa-1`，Worker 的逻辑 ID 是 `bbbbbb`。Leader 用实例 CLI 派发：

```bash
"$HAMLET_NODE" "$HAMLET_CLI" call message_to --stdin <<'JSON'
{"target":"bbbbbb","prompt":"research-01 v1：验证方案 A 的吞吐。输入 /shared/input.json；输出 /shared/results/R1-v1.json，包含测量条件、结果和复现命令。登记 working_instance_id；完成或阻塞时通知 reply_to_instance_id=aaaaaa-1。","dedup_key":"research-01-v1-R1-submit","dedup_window":"7d"}
JSON
```

这是向逻辑节点派发，创建新的 Worker 会话。以下假设 Worker 实际登记为 `bbbbbb-1`，不是预先猜测的序号。Worker 写好结果后通知：

```bash
"$HAMLET_NODE" "$HAMLET_CLI" call message_to --stdin <<'JSON'
{"target":"aaaaaa-1","prompt":"DONE research-01 v1 R1；working_instance_id=bbbbbb-1；结果 /shared/results/R1-v1.json。","dedup_key":"research-01-v1-R1-done","dedup_window":"7d"}
JSON
```

这是向真实实例回复，resume 原 Leader。需修复时，Leader 将修复任务发给 `bbbbbb-1`，附新的请求版本和去重键；独立新任务才发给 `bbbbbb`。目标归档后不能 resume，先核实任务状态，不自动改发逻辑 ID。

## 汇总与失败处理

Worker 各写自己的状态和结果文件，Leader 写汇总 manifest，避免并发覆盖。新 fork 从持久记录恢复任务背景，不继承旧会话。

Leader 被唤醒后检查当前版本的全部结果，而非只处理通知中提到的一份。可结合结果文件和通知判断进展，结果齐备后验收并安排下一步。每条被接受的消息都会触发一轮执行，包括给自己的消息；消息不会插入正在执行的回合。

可恢复的阻塞由 Worker 发送一次 BLOCKED，包含失败步骤、证据和需要的决策。模型调用或进程失败可能让 Worker 无法发送通知；Owner 或预先配置的监控应检查失败 run，查看已有产物后决定恢复。同一任务恢复使用已登记的真实实例 ID，避免重复派发。

消息按发送者 + target + dedup_key 在窗口内去重，业务文件和消费记录仍需按任务版本保证重复执行安全。入队回执只确认提交，不能当作结果或等待中的实时 ACK。

## 外部事件：doorbell

等待训练、评测、Slurm 作业、文件变化或周期事件时，优先用 doorbell 承担持续检测。Agent 提交作业并写入任务记录后结束本回合；脚本发现成功、失败或超时等需要处理的事件，才唤醒 Agent。模型负责判断与行动，脚本负责等待与检测。

例如：训练 Agent 提交 Slurm 作业并记录 job_id、任务版本和 working_instance_id → doorbell 查询作业状态 → 进入终态后唤醒训练 Agent → Agent 校验 checkpoint、完成评测并通过 message_to 交接。Slurm 的查询失败或暂时查不到记录不等于作业完成；应核对调度器终态与产物。完成、失败和超时都应有处理路径。

配置时按以下步骤落实：

1. 确定事件来源、检查间隔、任务版本、唤醒目标和停止条件；写入用户确认的创建方案。需要继续同一任务时，任务记录保存真实实例 ID。
2. 将可执行脚本保存到 daemon 能访问的稳定绝对路径，使用持久状态记录已处理事件。脚本在服务所在机器运行，不随 Agent worktree 切换；外部命令、路径和资源访问需在该环境可用。
3. 用事件样例和替代的 ring 函数本地验证“无变化不通知、变化通知一次、重复检查不重复通知、失败/超时可处理”，不向真实 Agent 发送测试任务。
4. `agent_create` 或 `agent_update` 设置 `doorbell_script` 和 `doorbell_enabled:false`，所需路径通过 `extra_env` 传入。获得对应触发授权后用 `doorbell_control {logical_id,action:"start"}` 启用，再用 `doorbell_logs {logical_id}` 检查运行和错误。`doorbell_script_save` 会立即启用并重启，不用于仅保存待审脚本。

脚本凭据只能 ring 绑定的逻辑 Agent 或它的实例，不能向其他成员派发，也不能查询管理 API。默认 `ring()` 发送到绑定的逻辑 ID：fork 模式新建会话，resident 模式复用常驻会话。要 resume 同一任务，显式传任务记录中的真实实例 ID；不能猜序号。负责通知多个下游时，先唤醒协调 Agent，由它派发。

下面以已原子写入的外部事件文件为例；`id` 应包含任务版本与事件类型，`working_instance_id` 来自该绑定 Agent 的实际运行记录：

```python
#!/usr/bin/env doorbell-python
import json, os
from pathlib import Path
from doorbell import ring, state, every

@every(seconds=60)
def check():
    path = Path(os.environ['EVENT_FILE'])
    if not path.exists():
        return
    event = json.loads(path.read_text())
    if event['id'] != state.get('last_event'):
        ring(target=event['working_instance_id'],
             prompt=f"处理事件 {event['id']}，读取 {path} 核对任务版本与结果",
             dedup_key=f"external-{event['id']}", dedup_window="7d")
        state.set('last_event', event['id'])
```

本例使用 EVENT_FILE 环境变量，首次立即检查，此后每轮完成再等 60 秒。单个文件适用于只有一个待处理事件的任务；可能连续产生多个事件时，使用逐事件文件或带游标的日志，避免覆盖丢失。事件 ID 应随任务版本变化，去重窗口覆盖可能的重试周期；ring 成功后才保存游标。实际业务仍需检查事件是否已消费。

需要延迟提醒时，在脚本中保存提交时间、到期时间和已提醒标记；prompt 中写“稍后执行”不会延迟入队。积压拒绝或目标归档时保留错误及拒绝消息 ID，交给 Owner 处理，不换键反复发送；doorbell 无权强推。Owner 可通过 doorbell_logs 检查脚本错误；脚本退出会触发重启退避，不能用正常退出表示监控已收尾。

收尾先写终态，再停止 doorbell；Owner 查询并取消过期 queued 消息，按约定保留或归档资源。Worker 通知完成即可，不假设自己拥有清理权限。
