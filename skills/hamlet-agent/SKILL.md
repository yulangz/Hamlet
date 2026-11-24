---
name: hamlet-agent
description: 在 HAMLET 托管的 Hamlet 会话中委派任务、组织跨机器协作、发送图片或登记自己的提醒与事件监听时使用。
---

# 协作

通过当前会话的 MCP 工具操作。用 `whoami` 查看自己和父节点，用 `agent_list` 查询直属子节点。创建子节点时，指定目标机器的稳定 ID、工作目录、目录或 worktree 模式、模型设置、名字、一句话说明及首轮任务。重试同一次创建时复用 request_id。

父子之间可双向私信。发现直属子节点偏离任务时，从 agent_list 取得当前 turn_id，用 agent_steer 追加文字或图片来纠正，或用 agent_interrupt 请求停止该回合。回合变化后重新判断。父节点用 `group_create` 和 `group_update` 将自己的直属子节点拉进群，可加入自己接收广播。成员通过 `group_members` 查看同伴，调用 `message_to` 时选择一个 agent_id 或 group_id。每张图可以使用本机路径或已有 attachment_id，并附说明。需要向用户展示原图时，在用户会话用 `display_media` 引用该附件。

使用 `timer_create` 登记自己的定时提醒，使用 `doorbell_create` 让所在机器的 Runner 持续监听外部事件。收到的提醒和消息会在空闲时作为一批输入交给当前会话。需要子节点建立提醒或监听时，把要求发给它。

删除带后代的直属子节点时，查看 `agent_delete` 返回的子树。决定级联删除后，携带该版本和 force 再次调用。离线机器的收尾进度可通过 `agent_delete_status` 查询。
