/**
 * Curated library of MCP server templates and presets.
 */
export const PRESETS = [
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'Database',
    description: 'PostgreSQL database inspector and query execution via official MCP server.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://username:password@localhost:5432/dbname'],
    },
    variables: [
      { key: 'connectionString', label: 'PostgreSQL Connection URL', default: 'postgresql://username:password@localhost:5432/dbname', inArgIndex: 2 }
    ]
  },
  {
    id: 'mysql',
    name: 'MySQL Server',
    category: 'Database',
    description: 'MySQL database inspector and query runner.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@fangjunjie/mysql-mcp-server', '--host', 'localhost', '--port', '3306', '--user', 'root', '--password', 'root', '--database', 'mydb'],
    }
  },
  {
    id: 'sqlite',
    name: 'SQLite Database',
    category: 'Database',
    description: 'Query and explore local SQLite database files.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '/path/to/database.db'],
    }
  },
  {
    id: 'github',
    name: 'GitHub Official',
    category: 'DevOps & Cloud',
    description: 'Manage repos, issues, pull requests, files, and branches on GitHub.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_your_token_here'
      }
    }
  },
  {
    id: 'ssh-server',
    name: 'SSH Remote Server',
    category: 'DevOps & Cloud',
    description: 'Execute remote shell commands, upload/download files via SSH tunnel.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@fangjunjie/ssh-mcp-server', '--host', '192.168.1.100', '--port', '22', '--username', 'root', '--password', 'password'],
    }
  },
  {
    id: 'yunxiao',
    name: 'Alibaba Cloud Yunxiao',
    category: 'DevOps & Cloud',
    description: 'Alibaba Cloud Yunxiao DevOps platform integration (Pipelines, Projects, Repos).',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', 'alibabacloud-devops-mcp-server'],
      env: {
        YUNXIAO_ACCESS_TOKEN: 'your_token_here'
      }
    }
  },
  {
    id: 'chrome-devtools',
    name: 'Chrome DevTools',
    category: 'Web & Search',
    description: 'Automate browser navigation, inspect console, evaluate DOM, capture screenshots.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['chrome-devtools-mcp@latest', '--autoConnect'],
    }
  },
  {
    id: 'context7',
    name: 'Context7 Docs & Libraries',
    category: 'Web & Search',
    description: 'Real-time documentation search for popular frameworks, SDKs, and libraries.',
    type: 'http',
    defaultConfig: {
      url: 'https://mcp.context7.com/mcp',
      headers: {
        Authorization: 'Bearer your_context7_token_here'
      }
    }
  },
  {
    id: 'filesystem',
    name: 'Local Filesystem',
    category: 'System & Tools',
    description: 'Securely expose authorized local directories to Antigravity agents.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', 'A:/code'],
    }
  },
  {
    id: 'brave-search',
    name: 'Brave Web Search',
    category: 'Web & Search',
    description: 'Perform real-time web searches using the Brave Search API.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: {
        BRAVE_API_KEY: 'your_brave_api_key'
      }
    }
  },
  {
    id: 'fetch',
    name: 'Fetch Web Content',
    category: 'Web & Search',
    description: 'Fetch and parse HTML/Markdown directly from web URLs.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    }
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer Headless Browser',
    category: 'Web & Search',
    description: 'Headless browser automation for complex dynamic SPAs and screenshots.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    }
  },
  {
    id: 'lark-mcp',
    name: 'Feishu / Lark',
    category: 'Collaboration',
    description: 'Feishu/Lark integration: Bitables, Docs, Chats, and Messages.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@larksuiteoapi/lark-mcp', 'mcp', '-a', 'your_app_id', '-s', 'your_app_secret'],
    }
  },
  {
    id: 'figma',
    name: 'Figma Design',
    category: 'Collaboration',
    description: 'Inspect Figma designs, design tokens, nodes, and comments.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', 'figma-mcp'],
      env: {
        FIGMA_ACCESS_TOKEN: 'your_figma_token_here'
      }
    }
  },
  {
    id: 'memory',
    name: 'Knowledge Graph Memory',
    category: 'System & Tools',
    description: 'Persistent knowledge graph memory across agent conversations.',
    type: 'stdio',
    defaultConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    }
  }
];
