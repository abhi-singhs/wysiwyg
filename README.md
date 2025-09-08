# Quick Notes - Solutions Engineering

A lightning-fast note-taking web application that seamlessly integrates with GitHub Issues. Perfect for Solutions Engineers who need to capture notes during meetings and quickly save them to the right repository.

## 🚀 **[Try the Live Demo]**

```bash
git clone https://github.com/gupta-kartik/wysiwyg.git
cd wysiwyg
npm install
npm run dev
```

## Features

- **🚀 Lightning-fast note capture** - Minimal UI focused on speed
- **🔍 Smart Issue search** - Auto-suggest Issues based on keywords with debounced search
- **💾 Seamless GitHub integration** - Save notes as comments or create new Issues
- **🏷️ Label management** - Select from repository labels when creating Issues
- **⌨️ Keyboard shortcuts** - Ctrl/Cmd+Enter to save instantly
- **🔑 Simple authentication** - GitHub Personal Access Token (no OAuth setup needed)
- **⚙️ Configurable repositories** - Switch between repositories on-the-fly
- **📱 Responsive design** - Works great on desktop and tablet
- **♿ Accessible** - WCAG AA compliant with proper focus management

![Main Interface](https://github.com/user-attachments/assets/894d54aa-e857-4c8f-9cba-ae8cdc5862de)

## Quick Start

### 💻 **Run Locally** 

```bash
git clone https://github.com/gupta-kartik/wysiwyg.git
cd wysiwyg
npm install
npm run dev
```

Visit `http://localhost:3000` for local development.

## Core User Stories

1. **Capture & save notes to existing Issues** - Type notes and save them as comments to selected Issues
2. **Smart Issue suggestions** - Auto-suggest Issues based on typed keywords
3. **Create new Issues** - Create Issues with titles, descriptions, and labels
4. **Quick label selection** - Multi-select from predefined repository labels
5. **Simple authentication** - GitHub Personal Access Token for quick setup

![New Issue Creation](https://github.com/user-attachments/assets/3377ae0c-d513-4896-a399-2edc4fde0050)

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Authentication**: GitHub Personal Access Token
- **GitHub Integration**: Octokit REST API
- **Icons**: Lucide React
- **Styling**: Tailwind CSS with custom responsive design
- **Deployment**: Vercel with custom domain

## GitHub Personal Access Token Setup

To use the app (live or locally), you'll need a GitHub PAT:

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens/new)
2. Click "Generate new token (classic)"
3. Give it a name like "Quick Notes App"
4. Select these scopes:
   - `repo` - Full control of repositories
   - `read:user` - Read user profile data
5. Click "Generate token" and copy it
6. Enter it in the app when prompted

## Usage

### First Time Setup
1. **Run the app**
2. **Enter your GitHub PAT** when prompted
3. **Configure repository** (optional) using the settings panel
4. You're ready to capture notes!

### Adding Notes to Existing Issues
1. **Type your notes** in the main textarea
2. **Search for Issues** by typing keywords in the Issue search box
3. **Select an Issue** from the auto-suggestions
4. **Save** using the button or Ctrl/Cmd+Enter

### Creating New Issues
1. **Type your notes** that will become the Issue description
2. **Click "Create new issue"**
3. **Enter a title** for the Issue
4. **Select labels** from the available options
5. **Save** to create the Issue with your notes as the description

### Repository Configuration
- **Settings Panel**: Click the settings icon in the header
- **Change on-the-fly**: Switch repositories without restarting
- **Persistent**: Settings are saved in browser storage

## Development Setup

### Environment Variables (Optional)
For local development, you can set default repository:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your preferred defaults:

```bash
# Default Repository Configuration (optional)
GITHUB_REPO_OWNER=your-org
GITHUB_REPO_NAME=your-repo
```

### API Routes
The application includes these API endpoints:

- `GET /api/github/user` - Validate PAT and get user info
- `GET /api/github/search-issues?q=query&owner=owner&repo=repo` - Search repository Issues  
- `POST /api/github/create-issue` - Create new Issue with labels
- `POST /api/github/add-comment` - Add comment to existing Issue
- `GET /api/github/labels?owner=owner&repo=repo` - Fetch repository labels

## Required GitHub Token Scopes

- **`repo`**: Required to create issues, add comments, and search issues
- **`read:user`**: Required to get user information for attribution

## Security Features

- **PAT Authentication** - Simple and secure token-based authentication
- **Client-side storage** - Token stored in browser localStorage only
- **API Protection** - All GitHub API routes require valid token
- **Easy revocation** - Users can revoke/rotate tokens anytime in GitHub settings

## Accessibility

- **WCAG AA compliant** - Proper contrast ratios and focus management
- **Keyboard navigation** - Full keyboard support with shortcuts
- **Screen reader friendly** - Proper ARIA labels and semantic HTML
- **Focus management** - Clear focus indicators and logical tab order

## Troubleshooting

### Invalid Token Error
- Ensure your PAT has the correct scopes (`repo`, `read:user`)
- Check if the token is still valid in GitHub Settings
- Generate a new token if needed

### Repository Not Found
- Verify the repository owner and name are correct
- Ensure your token has access to the repository
- Check if the repository is private and your token has appropriate permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
