export const webhookTemplatePresets = [
  {
    id: "lark-interactive",
    name: "Lark / Feishu (Interactive Card)",
    template: `{
  "msg_type": "interactive",
  "card": {
    "header": {
      "template": "blue",
      "title": {
        "content": "📅 Subscription Reminder: {{name}}",
        "tag": "plain_text"
      }
    },
    "elements": [
      {
        "tag": "div",
        "fields": [
          {
            "is_short": true,
            "text": {
              "tag": "lark_md",
              "content": "**Price:**\\n{{display_price}}"
            }
          },
          {
            "is_short": true,
            "text": {
              "tag": "lark_md",
              "content": "**Due Date:**\\n{{due_date}}"
            }
          }
        ]
      },
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "⚠️ This subscription is due in **{{days_left}} days**."
        }
      }
    ]
  }
}`
  },
  {
    id: "discord",
    name: "Discord",
    template: `{
  "content": "📅 **Subscription Reminder: {{name}}**\\n💰 Price: {{display_price}}\\n⏰ Due: {{due_date}}\\n⚠️ Days left: {{days_left}}"
}`
  },
  {
    id: "slack",
    name: "Slack",
    template: `{
  "text": "📅 *Subscription Reminder: {{name}}*\\n💰 Price: {{display_price}}\\n⏰ Due: {{due_date}}\\n⚠️ Days left: {{days_left}}"
}`
  }
];
