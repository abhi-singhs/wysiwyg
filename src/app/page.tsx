'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Save, Plus, User, LogOut, Github, Key, Settings, Moon, Sun, Wand2, X, Eye, EyeOff, SlidersHorizontal } from 'lucide-react';
import { Markdown } from '../components/Markdown';
import { useAIFormatter } from './useAIFormatter';
import { MODEL_SYSTEM_PROMPT, AVAILABLE_MODELS as CURATED_MODELS } from '@/lib/modelClient';
import { fetchLabels as ghFetchLabels, fetchUser as ghFetchUser, searchIssues as ghSearchIssues, createIssue as ghCreateIssue, addComment as ghAddComment, fetchProject as ghFetchProject, listModels as ghListModels } from '@/lib/github';

interface Issue {
  number: number;
  title: string;
  url: string;
  state?: string;
  updated_at?: string;
}

interface Label {
  name: string;
  color: string;
  description?: string | null;
}

interface UserInfo {
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export default function Home() {
  const [pat, setPat] = useState<string>('');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [repoOwner, setRepoOwner] = useState('github');
  const [repoName, setRepoName] = useState('solutions-engineering');
  // Project (ProjectV2) association via URL
  const [projectUrl, setProjectUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectNumber, setProjectNumber] = useState<number | null>(null);
  const [projectNodeId, setProjectNodeId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<'in-progress' | 'no-status' | 'done'>('in-progress');

  const [note, setNote] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Issue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; link?: string } | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [notePreview, setNotePreview] = useState(false); // markdown preview toggle
  // AI preview default: show raw markdown source first (requested change)
  const [showRaw, setShowRaw] = useState(true);
  // AI Settings (model + system prompt)
  const [aiModel, setAiModel] = useState<string>(() => (typeof window !== 'undefined' && localStorage.getItem('ai-model')) || 'openai/gpt-4.1');
  const [availableModels, setAvailableModels] = useState<{ id: string; label: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [aiSystemPrompt, setAiSystemPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return MODEL_SYSTEM_PROMPT;
    return localStorage.getItem('ai-system-prompt') || MODEL_SYSTEM_PROMPT;
  });
  const [showAISettings, setShowAISettings] = useState(false);
  const { formatted: formattedMarkdown, isFormatting, error: aiError, start: startFormatting, abort: abortFormatting } = useAIFormatter({ token: pat, orgOwner: repoOwner, modelId: aiModel, systemPrompt: aiSystemPrompt || undefined });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [mounted, setMounted] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiPreviewRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);
  const repoSettingsRef = useRef<HTMLDivElement>(null);
  const aiSettingsRef = useRef<HTMLDivElement>(null);
  const repoSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const aiSettingsButtonRef = useRef<HTMLButtonElement>(null);

  // Close settings panels when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (showSettings) {
        if (
          repoSettingsRef.current &&
          !repoSettingsRef.current.contains(target) &&
          repoSettingsButtonRef.current &&
          !repoSettingsButtonRef.current.contains(target)
        ) {
          setShowSettings(false);
        }
      }
      if (showAISettings) {
        if (
          aiSettingsRef.current &&
          !aiSettingsRef.current.contains(target) &&
          aiSettingsButtonRef.current &&
          !aiSettingsButtonRef.current.contains(target)
        ) {
          setShowAISettings(false);
        }
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSettings, showAISettings]);

  // Filtered labels based on search query
  const filteredLabels = availableLabels.filter(label => 
    label.name.toLowerCase().includes(labelSearchQuery.toLowerCase()) &&
    !selectedLabels.includes(label.name)
  );

  const showNotification = useCallback((message: string, type: 'success' | 'error', link?: string) => {
    setNotification({ message, type, link });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const fetchLabels = useCallback(async () => {
    if (!user || !pat) return;
    try {
  const labels = await ghFetchLabels(pat, repoOwner, repoName);
  setAvailableLabels(labels as Label[]);
    } catch (e) {
      console.error('Failed to load labels', e);
    }
  }, [user, pat, repoOwner, repoName]);

  // Validate PAT and load user
  const validatePat = useCallback(async (token: string) => {
    if (!token) return;
    setIsValidating(true);
    try {
  const data = await ghFetchUser(token);
  setUser(data as UserInfo);
      showNotification('Authenticated with GitHub', 'success');
      localStorage.setItem('github-pat', token);
    } catch (e) {
      console.error(e);
      setUser(null);
      showNotification('Invalid or insufficient token', 'error');
    } finally { setIsValidating(false); }
  }, [showNotification]);

  // Save logic (create issue or add comment)
  const handleSave = useCallback(async () => {
    if (!note.trim() || !user || !pat) return;
    setIsSaving(true);
    try {
      if (showNewIssue) {
        const data = await ghCreateIssue(pat, { title: newIssueTitle, body: note, labels: selectedLabels, owner: repoOwner, repo: repoName, projectNodeId, projectStatus: projectNodeId ? projectStatus : undefined });
        showNotification(`New issue #${data.number} created successfully!`, 'success', data.url);
      } else if (selectedIssue) {
        const data = await ghAddComment(pat, { issueNumber: selectedIssue.number, body: note, owner: repoOwner, repo: repoName, projectNodeId, projectStatus: projectNodeId ? projectStatus : undefined });
        showNotification(`Comment added to issue #${selectedIssue.number} successfully!`, 'success', data.url);
      } else { showNotification('Please select an issue or create a new one', 'error'); return; }
      setNote('');
      setSelectedIssue(null);
      setShowNewIssue(false);
      setNewIssueTitle('');
      setSelectedLabels([]);
    } catch (e) {
      console.error(e);
      showNotification('Failed to save note', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [note, user, pat, showNewIssue, newIssueTitle, selectedLabels, selectedIssue, repoOwner, repoName, projectNodeId, projectStatus, showNotification]);

  // Mount: load persisted settings (PAT, repo, project, AI) & theme
  useEffect(() => {
    setMounted(true);
    try {
      const savedPat = localStorage.getItem('github-pat');
      const savedRepoOwner = localStorage.getItem('repo-owner');
      const savedRepoName = localStorage.getItem('repo-name');
      const savedProjectUrl = localStorage.getItem('project-url');
      const savedProjectName = localStorage.getItem('project-name');
      const savedProjectNumber = localStorage.getItem('project-number');
      const savedProjectNodeId = localStorage.getItem('project-node-id');
      const savedProjectStatus = localStorage.getItem('project-status');
      const savedModel = localStorage.getItem('ai-model');
      const savedPrompt = localStorage.getItem('ai-system-prompt');

      if (savedPat) {
        setPat(savedPat);
        validatePat(savedPat);
      }
      if (savedRepoOwner) setRepoOwner(savedRepoOwner);
      if (savedRepoName) setRepoName(savedRepoName);
      if (savedProjectUrl) setProjectUrl(savedProjectUrl);
      if (savedProjectName) setProjectName(savedProjectName);
      if (savedProjectNumber) setProjectNumber(parseInt(savedProjectNumber, 10));
      if (savedProjectNodeId) setProjectNodeId(savedProjectNodeId);
      if (savedProjectStatus === 'in-progress' || savedProjectStatus === 'no-status' || savedProjectStatus === 'done') {
        setProjectStatus(savedProjectStatus);
      }
      if (savedModel) setAiModel(savedModel);
      if (savedPrompt) setAiSystemPrompt(savedPrompt); else setAiSystemPrompt(MODEL_SYSTEM_PROMPT);
    } catch (e) {
      console.warn('Failed loading saved settings', e);
    }
  }, [validatePat]);

  // Persist/apply theme when changed
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(theme === 'dark' ? 'dark' : 'light');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      const maxPx = 400; // ~20-22 lines depending on content
      const needed = el.scrollHeight;
      el.style.height = `${Math.min(needed, maxPx)}px`;
      // If exceeding max, allow vertical scroll
      if (needed > maxPx) {
        el.style.overflowY = 'auto';
      } else {
        el.style.overflowY = 'hidden';
      }
    }
  }, [note]);

  // Auto scroll AI preview while streaming, but only if user is already near bottom
  useEffect(() => {
    if (!isFormatting) return; // only during live stream
    const container = aiPreviewRef.current;
    if (!container) return;
    const threshold = 80; // px from bottom considered "at bottom"
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    if (atBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [formattedMarkdown, isFormatting]);

  // Load labels when authenticated
  useEffect(() => {
    if (user && pat) {
      fetchLabels();
    }
  }, [user, pat, repoOwner, repoName, fetchLabels]); // Include fetchLabels dependency

  const handlePATSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validatePat(pat);
  };

  const LOCALSTORAGE_KEYS_TO_CLEAR = [
    'github-pat',
    'project-url',
    'project-name',
    'project-number',
    'project-node-id',
    'project-status',
    'ai-model',
    'ai-system-prompt',
    // Legacy keys cleanup (older implementation used these)
    'project',
    'project-id',
  ];

  const handleLogout = () => {
    setPat('');
    setUser(null);
    LOCALSTORAGE_KEYS_TO_CLEAR.forEach(key => localStorage.removeItem(key));
    setNote('');
    setSelectedIssue(null);
    setShowNewIssue(false);
    setNewIssueTitle('');
    setSelectedLabels([]);
    setLabelSearchQuery('');
    setShowLabelDropdown(false);
    setSearchQuery('');
    setProjectUrl('');
    setProjectName('');
    setProjectNumber(null);
    setProjectNodeId(null);
    setProjectStatus('in-progress');
  };

  // Live persistence of repository & project settings
  useEffect(() => { localStorage.setItem('repo-owner', repoOwner); }, [repoOwner]);
  useEffect(() => { localStorage.setItem('repo-name', repoName); }, [repoName]);
  useEffect(() => {
    if (projectUrl) localStorage.setItem('project-url', projectUrl); else localStorage.removeItem('project-url');
  }, [projectUrl]);
  useEffect(() => {
    if (projectName) localStorage.setItem('project-name', projectName); else localStorage.removeItem('project-name');
  }, [projectName]);
  useEffect(() => {
    if (projectNumber != null) localStorage.setItem('project-number', String(projectNumber)); else localStorage.removeItem('project-number');
  }, [projectNumber]);
  useEffect(() => {
    if (projectNodeId) localStorage.setItem('project-node-id', projectNodeId); else localStorage.removeItem('project-node-id');
  }, [projectNodeId]);
  useEffect(() => {
    if (projectStatus) localStorage.setItem('project-status', projectStatus); else localStorage.removeItem('project-status');
  }, [projectStatus]);
  // Refresh labels when repo owner/name change and authenticated
  useEffect(() => { if (user && pat) fetchLabels(); }, [repoOwner, repoName, user, pat, fetchLabels]);

  // Fetch models dynamically from public catalog after auth or owner change.
  useEffect(() => {
    if (!user || !pat) return;
    let cancelled = false;
    (async () => {
      setModelsLoading(true); setModelsError(null);
      try {
        const models = await ghListModels(pat);
        if (cancelled) return;
        if (!models.length) throw new Error('No models returned');
        setAvailableModels(models);
        if (!models.some(m => m.id === aiModel)) setAiModel(models[0].id);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setModelsError(e instanceof Error ? e.message : 'Failed loading models');
          setAvailableModels(CURATED_MODELS);
          if (!CURATED_MODELS.some(m => m.id === aiModel)) setAiModel(CURATED_MODELS[0].id);
        }
      } finally { if (!cancelled) setModelsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user, pat, repoOwner, aiModel]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim() && user && pat) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const issues = await ghSearchIssues(pat, repoOwner, repoName, searchQuery);
          setSuggestions(issues);
        } catch (error) { console.error('Search failed:', error); setSuggestions([]); } finally { setIsSearching(false); }
      }, 300);
    } else {
      setSuggestions([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, user, pat, repoOwner, repoName]); // Include repo dependencies

  // Keyboard shortcuts (listener added below) - handleSave defined earlier

  const handleAIFormat = useCallback(() => {
    if (!note.trim()) return showNotification('Nothing to format – notes are empty', 'error');
    if (!pat) return showNotification('Authenticate with GitHub first', 'error');
    // Ensure each new formatting session starts in raw mode
    setShowRaw(true);
    setShowAIModal(true);
    startFormatting(note);
  }, [note, pat, startFormatting, showNotification]);

  // Persist AI settings when changed
  useEffect(() => {
    if (aiModel) localStorage.setItem('ai-model', aiModel);
  }, [aiModel]);
  useEffect(() => {
  if (aiSystemPrompt && aiSystemPrompt !== MODEL_SYSTEM_PROMPT) localStorage.setItem('ai-system-prompt', aiSystemPrompt); else localStorage.removeItem('ai-system-prompt');
  }, [aiSystemPrompt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const parseProjectUrl = (url: string) => {
    try {
      const u = new URL(url.trim());
      if (u.hostname !== 'github.com') return null;
      const parts = u.pathname.split('/').filter(Boolean);
      const orgsIdx = parts.indexOf('orgs');
      if (orgsIdx === -1 || parts.length < orgsIdx + 4) return null;
      const org = parts[orgsIdx + 1];
      if (parts[orgsIdx + 2] !== 'projects') return null;
      const number = parseInt(parts[orgsIdx + 3], 10);
      if (Number.isNaN(number)) return null;
      return { org, number };
    } catch { return null; }
  };

  // Project link helper (exposed for button handlers)
  const fetchProjectFromUrl = async () => {
    if (!projectUrl.trim()) { showNotification('Enter a GitHub Project URL', 'error'); return; }
    const parsed = parseProjectUrl(projectUrl);
    if (!parsed) { showNotification('Invalid project URL format', 'error'); return; }
    if (!pat) { showNotification('Authenticate first', 'error'); return; }
    try {
      const p = await ghFetchProject(pat, parsed.org, parsed.number);
      setProjectName(p.name); setProjectNumber(p.number || null); setProjectNodeId(p.id); localStorage.setItem('project-node-id', p.id);
      localStorage.setItem('project-url', projectUrl); localStorage.setItem('project-name', p.name || ''); if (p.number != null) localStorage.setItem('project-number', String(p.number)); showNotification('Project linked', 'success');
    } catch (e) { console.error(e); showNotification('Failed to fetch project', 'error'); }
  };

  // Unauthenticated UI
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <Github className="mx-auto h-12 w-12 text-gray-900 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Quick Notes</h1>
            <p className="text-gray-600">Solutions Engineering</p>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                aria-label={mounted && theme === 'light' ? 'Enable dark mode' : mounted && theme === 'dark' ? 'Enable light mode' : 'Toggle color mode'}
              >
                {mounted ? (theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />) : <Moon className="h-4 w-4 opacity-0" aria-hidden="true" />}
                {mounted && <span suppressHydrationWarning>{theme === 'light' ? 'Dark' : 'Light'} mode</span>}
              </button>
            </div>
          </div>

          <form onSubmit={handlePATSubmit} className="space-y-4">
            <div>
              <label htmlFor="pat" className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Personal Access Token
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  id="pat"
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isValidating || !pat.trim()}
              className="w-full bg-gray-900 text-white px-4 py-3 rounded-md hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>Loading...</>
              ) : (
                <>
                  <Github className="h-4 w-4" />
                  Connect to GitHub
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-xs text-gray-500 space-y-2">
            <p>
              <strong>Required scopes:</strong> <code>issues</code>, <code>organization_models</code>, <code>organization_projects</code>
            </p>
            <p>
              Create a token at{' '}
              <a
                href={`https://github.com/settings/personal-access-tokens/new?target_name=${repoOwner}&description=Used+for+QuickNotes&name=GitHub+QuickNotes+token&metadata=read&issues=write&organization_models=read&organization_projects=write`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                GitHub Settings
              </a>
            </p>
          </div>

          <div className="mt-4 border-t pt-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              ref={repoSettingsButtonRef}
              className={`${showSettings ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-gray-500 hover:text-gray-700'} transition-colors border border-transparent rounded-md p-1.5 cursor-pointer`}
              aria-label="Toggle Repository Settings"
              data-tip="Repository Settings"
              aria-pressed={showSettings}
            >
              <Settings className="h-5 w-5" />
            </button>
            
            {showSettings && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">Repository Owner</label>
                  <input
                    type="text"
                    value={repoOwner}
                    onChange={(e) => setRepoOwner(e.target.value)}
                    className="p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="github"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">Repository Name</label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="solutions-engineering"
                  />
                </div>
                <div className="flex flex-col sm:col-span-2">
                  <label className="text-xs font-medium text-gray-700 mb-1">GitHub Project URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={projectUrl}
                      onChange={(e) => setProjectUrl(e.target.value)}
                      placeholder="https://github.com/orgs/my-org/projects/123"
                      className="flex-1 p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={fetchProjectFromUrl}
                      className="px-3 py-2 text-xs font-medium rounded bg-gray-800 text-white hover:bg-gray-900 transition-colors"
                      title="Link project from URL"
                      aria-label="Link project from URL"
                    >Link</button>
                  </div>
                  {projectName && (
                    <p className="mt-1 text-xs text-gray-600">Linked: <span className="font-medium">{projectName}</span>{projectNumber !== null && ` (#${projectNumber})`}</p>
                  )}
                </div>
                {/* Removed explicit save button – settings persist live */}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="h-6 w-6 text-gray-900" />
            <h1 className="text-xl font-semibold text-gray-900">Quick Notes</h1>
            <span className="text-sm text-gray-500">→ {repoOwner}/{repoName}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-700">{user.name || user.login}</span>
            </div>
            <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              aria-label={mounted && theme === 'light' ? 'Enable dark mode' : mounted && theme === 'dark' ? 'Enable light mode' : 'Toggle color mode'}
              data-tip={mounted && theme === 'light' ? 'Dark mode' : mounted && theme === 'dark' ? 'Light mode' : 'Toggle theme'}
            >
              {mounted ? (theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />) : <Moon className="h-5 w-5 opacity-0" aria-hidden="true" />}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              ref={repoSettingsButtonRef}
              className={`${showSettings ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-gray-500 hover:text-gray-700'} transition-colors border border-transparent rounded-md p-1.5 cursor-pointer`}
              aria-label="Toggle Repository Settings"
              data-tip="Repository Settings"
              aria-pressed={showSettings}
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowAISettings(s => !s)}
              ref={aiSettingsButtonRef}
              className={`${showAISettings ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-gray-500 hover:text-gray-700'} transition-colors border border-transparent rounded-md p-1.5 cursor-pointer`}
              aria-label="Toggle AI Settings"
              data-tip="AI Settings"
              aria-expanded={showAISettings}
              aria-controls="ai-settings-panel"
              aria-pressed={showAISettings}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              aria-label="Log out"
              data-tip="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            </div>
          </div>
        </div>

  {/* Repository Settings Panel */}
  {showSettings && (
          <div className="border-t bg-gray-50 px-4 py-3" ref={repoSettingsRef}>
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">Repository Owner</label>
                  <input
                    type="text"
                    value={repoOwner}
                    onChange={(e) => setRepoOwner(e.target.value)}
                    className="p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="github"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">Repository Name</label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="solutions-engineering"
                  />
                </div>
                <div className="flex flex-col md:col-span-2">
                  <label className="text-xs font-medium text-gray-700 mb-1">GitHub Project URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={projectUrl}
                      onChange={(e) => setProjectUrl(e.target.value)}
                      placeholder="https://github.com/orgs/my-org/projects/123"
                      className="flex-1 p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={fetchProjectFromUrl}
                      className="px-3 py-2 text-xs font-medium rounded bg-gray-800 text-white hover:bg-gray-900 transition-colors"
                      title="Link project from URL"
                      aria-label="Link project from URL"
                    >Link</button>
                  </div>
                  {projectName && (
                    <p className="mt-1 text-[11px] text-gray-600">{projectName}{projectNumber !== null && ` (#${projectNumber})`}</p>
                  )}
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">Project Number</label>
                  <input
                    type="number"
                    value={projectNumber !== null ? projectNumber : ''}
                    onChange={(e) => setProjectNumber(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123"
                  />
                </div>
                {/* Removed explicit update button – changes persist live */}
              </div>
            </div>
          </div>
        )}
        {/* AI Settings Panel (separate) */}
        {showAISettings && (
          <div className="border-t bg-gray-50 px-4 py-3" id="ai-settings-panel" ref={aiSettingsRef}>
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-50"
                    disabled={modelsLoading || !!modelsError}
                    aria-busy={modelsLoading}
                    aria-describedby={modelsError ? 'models-error' : undefined}
                  >
                    {modelsLoading && <option>Loading models…</option>}
                    {modelsError && <option>Error loading models</option>}
                    {!modelsLoading && !modelsError && availableModels.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  {modelsError && (
                    <div id="models-error" className="mt-1 text-[11px] text-red-600">{modelsError}</div>
                  )}
                </div>
                <div className="md:col-span-3 flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1 flex items-center justify-between">System Prompt <button type="button" onClick={() => setAiSystemPrompt(MODEL_SYSTEM_PROMPT)} className="text-[10px] underline text-blue-600 hover:text-blue-800" title="Reset to default system prompt" aria-label="Reset system prompt to default">Reset</button></label>
                  <textarea
                    value={aiSystemPrompt}
                    onChange={(e) => setAiSystemPrompt(e.target.value)}
                    placeholder="Custom system prompt (leave blank for default)."
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-y"
                  />
                </div>
                <div className="md:col-span-5 text-[11px] text-gray-500">Changes persist locally; cleared on logout.</div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            {/* Notes Textarea + AI Format */}
            <div className="mb-6">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-xs text-gray-500 flex-1">Raw notes you can later save as comment or issue.</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotePreview(p => !p)}
                    aria-pressed={notePreview}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                    aria-label={notePreview ? 'Switch to edit mode' : 'Switch to markdown preview'}
                    data-tip={notePreview ? 'Show editable raw notes' : 'Preview rendered markdown'}
                  >
                    {notePreview ? 'Edit' : 'Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAIFormat}
                    disabled={isFormatting || !note.trim()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                    aria-label="Format notes with AI"
                    data-tip={isFormatting ? 'Formatting in progress' : (!note.trim() ? 'Enter some notes first' : 'Format notes with AI')}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {isFormatting ? 'Formatting…' : 'AI Format'}
                  </button>
                </div>
              </div>
              {notePreview ? (
                <div className="w-full p-3 border border-gray-300 rounded-md bg-gray-50 prose prose-sm max-h-[400px] overflow-y-auto dark:bg-[var(--surface-subtle)] dark:prose-invert">
                  {note.trim() ? (
                    <Markdown source={note} />
                  ) : (
                    <p className="text-xs text-gray-400 italic">Nothing to preview.</p>
                  )}
                </div>
              ) : (
                <textarea
                  id="notes"
                  ref={textareaRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Start typing your notes here... (Ctrl/Cmd+Enter to save)"
                  className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] max-h-[400px] overflow-y-auto"
                  rows={12}
                />
              )}
            </div>

            {/* Selected Labels - Always Visible */}
            {selectedLabels.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Labels
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedLabels.map((labelName) => {
                    const label = availableLabels.find(l => l.name === labelName);
                    return (
                      <div
                        key={labelName}
                        className="flex items-center gap-1 px-3 py-1 text-xs rounded-full border"
                        style={{
                          backgroundColor: label ? `#${label.color}20` : '#f3f4f6',
                          borderColor: label ? `#${label.color}60` : '#d1d5db',
                          color: label ? `#${label.color}` : '#374151'
                        }}
                      >
                        {labelName}
                        <button
                          onClick={() => setSelectedLabels(selectedLabels.filter(l => l !== labelName))}
                          className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5"
                          title={`Remove label ${labelName}`}
                          aria-label={`Remove label ${labelName}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Label Search + Status (if project) */}
            <div className="mb-6" ref={labelDropdownRef}>
              <div className="flex items-end gap-4 mb-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Labels
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={labelSearchQuery}
                      onChange={(e) => {
                        setLabelSearchQuery(e.target.value);
                        setShowLabelDropdown(true);
                      }}
                      onFocus={() => setShowLabelDropdown(true)}
                      placeholder="Type to search labels..."
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {/* Label Dropdown */}
                    {showLabelDropdown && filteredLabels.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[var(--surface)] border border-gray-300 dark:border-[var(--border)] rounded-md shadow-lg max-h-48 overflow-y-auto" role="listbox">
                        {filteredLabels.map((label) => (
                          <button
                            key={label.name}
                            onClick={() => {
                              setSelectedLabels([...selectedLabels, label.name]);
                              setLabelSearchQuery('');
                              setShowLabelDropdown(false);
                            }}
                            role="option"
                            aria-selected={false}
                            className="w-full text-left p-3 border-b border-gray-100 dark:border-[color-mix(in_srgb,var(--border)_60%,transparent)] last:border-b-0 flex items-center gap-2 text-gray-700 dark:text-[var(--foreground)] hover:bg-gray-50 dark:hover:bg-[color-mix(in_srgb,var(--surface-subtle)_85%,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] transition-colors cursor-pointer"
                            title={`Add label ${label.name}`}
                            aria-label={`Add label ${label.name}`}
                          >
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: `#${label.color}` }}
                            />
                            <div>
                              <div className="font-medium text-sm leading-snug">{label.name}</div>
                              {label.description && (
                                <div className="text-xs text-gray-500 dark:text-[var(--text-muted)] leading-snug">{label.description}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {projectNodeId && (
                  <div className="w-44">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={projectStatus}
                      onChange={(e) => setProjectStatus(e.target.value as 'in-progress' | 'no-status' | 'done')}
                      className="w-full h-12 px-3 border border-gray-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      style={{ lineHeight: '1.25rem' }}
                    >
                      <option value="in-progress">In Progress</option>
                      <option value="no-status">No Status</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Issue Selection */}
            <div className="mb-6">
              <div className="flex items-end gap-4 mb-2">
                <div className="flex-1">
                  <label htmlFor="issue-search" className="block text-sm font-medium text-gray-700 mb-2">
                    Issue
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="issue-search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for existing issues..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                {/* Status dropdown moved above into label row */}
              </div>

              {/* Issue Suggestions */}
              {(suggestions.length > 0 || isSearching) && (
                <div className="mt-2 bg-white border border-gray-300 rounded-md shadow-sm">
                  {isSearching ? (
                    <div className="p-3 text-sm text-gray-500">Searching...</div>
                  ) : (
                    suggestions.map((issue) => (
                      <button
                        key={issue.number}
                        onClick={() => {
                          setSelectedIssue(issue);
                          setSearchQuery(`#${issue.number} ${issue.title}`);
                          setSuggestions([]);
                          setShowNewIssue(false);
                        }}
                        className="w-full text-left p-3 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:bg-gray-100 dark:hover:bg-[color-mix(in_srgb,var(--surface-subtle)_70%,black)] dark:bg-[var(--surface)]"
                        title={`Select issue #${issue.number}`}
                        aria-label={`Select issue #${issue.number}: ${issue.title}`}
                      >
                        <div className="font-medium text-sm">#{issue.number}</div>
                        <div className="text-sm text-gray-600">{issue.title}</div>
                        {issue.state && (
                          <div
                            className={`text-xs mt-1 font-medium tracking-wide ${
                              issue.state.toLowerCase() === 'open'
                                ? 'text-green-600'
                                : issue.state.toLowerCase() === 'closed'
                                  ? 'text-red-600'
                                  : 'text-gray-500'
                            }`}
                            aria-label={`Issue is ${issue.state.toUpperCase()}`}
                          >
                            {issue.state.toUpperCase()}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Create New Issue Option */}
              <button
                onClick={() => {
                  if (showNewIssue) {
                    // Collapse panel
                    setShowNewIssue(false);
                    setNewIssueTitle('');
                  } else {
                    // Open panel (reset issue selection context)
                    setShowNewIssue(true);
                    setSelectedIssue(null);
                    setSearchQuery('');
                    setSuggestions([]);
                  }
                }}
                className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                aria-expanded={showNewIssue}
                aria-controls="new-issue-panel"
              >
                <Plus className="h-4 w-4" />
                Create new issue
              </button>
            </div>

            {/* New Issue Form */}
            {showNewIssue && (
              <div id="new-issue-panel" className="mb-6 p-4 rounded-md border bg-blue-50 border-blue-200 dark:bg-[color-mix(in_srgb,var(--surface-subtle)_90%,#1e3a8a)] dark:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]">
                <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--foreground)] mb-3">Create New Issue</h3>
                <div className="mb-4">
                  <label htmlFor="issue-title" className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    id="issue-title"
                    type="text"
                    value={newIssueTitle}
                    onChange={(e) => setNewIssueTitle(e.target.value)}
                    placeholder="Issue title..."
                    className="w-full p-2 border border-gray-300 dark:border-[var(--border)] rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-[var(--foreground)] placeholder-gray-500 dark:placeholder-[var(--text-placeholder)]"
                  />
                </div>
                <div className="text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  Use the &quot;Add Labels&quot; section above to select labels for this issue.
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={!note.trim() || isSaving || (showNewIssue && !newIssueTitle.trim())}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : showNewIssue ? 'Create Issue' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg max-w-sm ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="flex flex-col gap-2">
            <div>{notification.message}</div>
            {notification.link && (
              <a
                href={notification.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline hover:no-underline text-sm font-medium"
              >
                View on GitHub →
              </a>
            )}
          </div>
        </div>
      )}

      {/* AI Preview Modal */}
      {showAIModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="AI formatted notes preview"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAIModal(false)} />
          <div className="relative bg-white dark:bg-[var(--surface)] border border-gray-200 dark:border-[var(--border)] rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-[var(--border)]">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-[var(--foreground)]">AI Formatted Preview</h2>
              <button
                onClick={() => setShowAIModal(false)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[color-mix(in_srgb,var(--surface-subtle)_70%,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div ref={aiPreviewRef} className="overflow-y-auto p-5 prose prose-sm max-w-none dark:prose-invert">
              {aiError && <div className="text-xs mb-2 text-red-600">{aiError}</div>}
              {!formattedMarkdown && isFormatting && (
                <div className="text-xs text-gray-500">Formatting in progress…</div>
              )}
              {formattedMarkdown && !showRaw && (
                <Markdown source={formattedMarkdown} />
              )}
              {formattedMarkdown && showRaw && (
                <pre
                  className="text-xs whitespace-pre-wrap bg-gray-100 dark:bg-[var(--surface-subtle)] dark:text-[var(--foreground)] p-3 rounded-md border border-gray-200 dark:border-[var(--border)] overflow-x-auto max-h-[60vh] font-mono leading-relaxed"
                >
                  {formattedMarkdown}
                </pre>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-[var(--border)] bg-gray-50 dark:bg-[var(--surface-subtle)]">
              {isFormatting ? (
                <button
                  onClick={() => abortFormatting()}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title="Stop formatting"
                  aria-label="Stop formatting"
                >
                  Stop
                </button>
              ) : (
                formattedMarkdown && (
                  <button
                    onClick={() => setShowRaw(r => !r)}
                    className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 inline-flex items-center gap-2"
                    title={showRaw ? 'Show formatted preview' : 'Show raw markdown source'}
                    aria-label={showRaw ? 'Show formatted preview' : 'Show raw markdown source'}
                  >
                    {showRaw ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {showRaw ? 'Show Preview' : 'Show Raw'}
                  </button>
                )
              )}
              <button
                onClick={() => {
                  abortFormatting();
                  setShowAIModal(false);
                }}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setNote(formattedMarkdown);
                  setShowAIModal(false);
                  showNotification('Applied AI formatting', 'success');
                }}
                disabled={!formattedMarkdown.trim() || isFormatting}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Replace current notes with AI formatted content"
                aria-label="Accept AI formatted content and replace current notes"
              >
                {isFormatting && !formattedMarkdown ? 'Waiting…' : 'Accept & Replace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
