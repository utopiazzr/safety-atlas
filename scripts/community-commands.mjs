export function claimAction(event, issue) {
  const command = event.comment?.body?.trim(),
    login = event.comment?.user?.login;
  if (
    event.action !== "created" ||
    event.issue?.pull_request ||
    issue.pull_request ||
    issue.state !== "open" ||
    event.comment?.user?.type === "Bot" ||
    !/^\w(?:[\w-]{0,38})$/.test(login || "") ||
    event.sender?.login !== login
  )
    return null;
  const assignees = issue.assignees || [],
    labels = issue.labels || [];
  if (
    command === "/claim" &&
    labels.some((l) => l.name === "help wanted") &&
    assignees.length === 0
  )
    return { action: "claim", login };
  if (command === "/unclaim" && assignees.some((a) => a.login === login))
    return { action: "unclaim", login };
  return null;
}
