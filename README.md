# Netsurit Innovate Plugins

A Claude Code plugin marketplace from the Netsurit Innovation Team.

## Installation

Add this marketplace to your Claude Code settings:

```bash
claude plugins:add github:louisdk/netsurit-innovate-plugins
```

Or add it manually to your `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "questionpad@netsurit-innovate-plugins": true
  }
}
```

## Available Plugins

### QuestionPad

Collects structured user feedback via an interactive browser UI with typed cards. Instead of copy-pasting Claude's output and typing inline responses, QuestionPad presents an interactive card-based form in your browser via Playwright MCP.

**Supported card types:**
- Multiple choice (pick one)
- Multi-select (pick many)
- Yes / No toggle
- Approve / Reject
- Free text
- Rating (stars)
- Slider (single value)
- Range slider (min-max)

**Requires:** [Playwright MCP plugin](https://github.com/anthropics/claude-code-plugins) enabled in Claude Code.

## Adding New Plugins

To add a plugin to this marketplace:

1. Create a new directory under `plugins/` with your plugin name
2. Follow the [Claude Code plugin structure](https://docs.anthropic.com/en/docs/claude-code/plugins)
3. Add an entry to `.claude-plugin/marketplace.json`
4. Submit a pull request

## License

MIT
