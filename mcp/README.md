# RepoMind MCP Server

Exposes RepoMind's tools as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server,
so you can use them directly inside **Claude Desktop**, **Cursor**, or any MCP-compatible IDE.

## Available tools

| Tool | Description |
|---|---|
| `search_code` | Semantic search across code + commits |
| `open_file` | Read a file from the indexed repo |
| `grep_repo` | Regex search across all files |
| `get_commit` | Get full details of a git commit |

## Setup

### 1. Find your repo ID

```bash
# After running npm run db:migrate and indexing a repo,
# check the DB:
npm run db:studio
# Or query directly:
psql postgresql://postgres:postgres@localhost:5432/repomind -c "SELECT id, name FROM repos;"
```

### 2. Claude Desktop

Edit `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "repomind": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/repomind/mcp/server.ts", "--repoId=1"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/repomind",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### 3. Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "repomind": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/repomind/mcp/server.ts", "--repoId=1"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/repomind",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Restart Claude Desktop or Cursor after editing the config.
