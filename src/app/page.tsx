'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Save, Plus, User, LogOut, Github, Key, Settings, Moon, Sun } from 'lucide-react';

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
  description?: string;
}

interface UserInfo {
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export default function Home() {
  const [pat, setPat] = useState<string>('');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [repoOwner, setRepoOwner] = useState('github');
  const [repoName, setRepoName] = useState('solutions-engineering');

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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [mounted, setMounted] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  // Filtered labels based on search query
  const filteredLabels = availableLabels.filter(label => 
    label.name.toLowerCase().includes(labelSearchQuery.toLowerCase()) &&
    !selectedLabels.includes(label.name)
  );

  const validatePat = useCallback(async (token: string) => {
    if (!token.trim()) {
      setUser(null);
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch('/api/github/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('github-pat', token);
      } else {
        setUser(null);
        localStorage.removeItem('github-pat');
        showNotification('Invalid GitHub Personal Access Token', 'error');
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      setUser(null);
      localStorage.removeItem('github-pat');
      showNotification('Failed to validate token', 'error');
    } finally {
      setIsValidating(false);
    }
  }, []);

  const fetchLabels = useCallback(async () => {
    try {
      const response = await fetch(`/api/github/labels?owner=${encodeURIComponent(repoOwner)}&repo=${encodeURIComponent(repoName)}`, {
        headers: {
          'Authorization': `Bearer ${pat}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableLabels(data.labels);
      }
    } catch (error) {
      console.error('Failed to fetch labels:', error);
    }
  }, [pat, repoOwner, repoName]);

  const showNotification = (message: string, type: 'success' | 'error', link?: string) => {
    setNotification({ message, type, link });
    setTimeout(() => setNotification(null), 5000); // Increased timeout for link clicks
  };

  // Load PAT from localStorage on mount
  useEffect(() => {
  setMounted(true);
    // Apply saved theme early
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    const savedPat = localStorage.getItem('github-pat');
    const savedRepoOwner = localStorage.getItem('repo-owner');
    const savedRepoName = localStorage.getItem('repo-name');
    
    if (savedPat) {
      setPat(savedPat);
      validatePat(savedPat);
    }
    if (savedRepoOwner) setRepoOwner(savedRepoOwner);
    if (savedRepoName) setRepoName(savedRepoName);
  }, [validatePat]); // Include validatePat dependency

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
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [note]);

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

  const handleLogout = () => {
    setPat('');
    setUser(null);
    localStorage.removeItem('github-pat');
    setNote('');
    setSelectedIssue(null);
    setShowNewIssue(false);
    setNewIssueTitle('');
    setSelectedLabels([]);
    setLabelSearchQuery('');
    setShowLabelDropdown(false);
    setSearchQuery('');
  };

  const updateRepoSettings = () => {
    localStorage.setItem('repo-owner', repoOwner);
    localStorage.setItem('repo-name', repoName);
    setShowSettings(false);
    if (user && pat) {
      fetchLabels(); // Refresh labels for new repo
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim() && user && pat) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`/api/github/search-issues?q=${encodeURIComponent(searchQuery)}&owner=${encodeURIComponent(repoOwner)}&repo=${encodeURIComponent(repoName)}`, {
            headers: {
              'Authorization': `Bearer ${pat}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            setSuggestions(data.issues);
          } else {
            setSuggestions([]);
          }
        } catch (error) {
          console.error('Search failed:', error);
          setSuggestions([]);
        } finally {
          setIsSearching(false);
        }
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

  // Keyboard shortcuts
  const handleSave = useCallback(async () => {
    if (!note.trim() || !user || !pat) return;
    
    setIsSaving(true);
    try {
      if (showNewIssue) {
        // Create new issue
        const response = await fetch('/api/github/create-issue', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pat}`,
          },
          body: JSON.stringify({
            title: newIssueTitle,
            body: note,
            labels: selectedLabels,
            repoOwner,
            repoName,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          showNotification(`New issue #${data.number} created successfully!`, 'success', data.url);
        } else {
          throw new Error('Failed to create issue');
        }
      } else if (selectedIssue) {
        // Add comment to existing issue
        const response = await fetch('/api/github/add-comment', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pat}`,
          },
          body: JSON.stringify({
            issueNumber: selectedIssue.number,
            body: note,
            repoOwner,
            repoName,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          showNotification(`Comment added to issue #${selectedIssue.number} successfully!`, 'success', data.url);
        } else {
          throw new Error('Failed to add comment');
        }
      } else {
        showNotification('Please select an issue or create a new one', 'error');
        return;
      }
      
      // Reset form
      setNote('');
      setSelectedIssue(null);
      setShowNewIssue(false);
      setNewIssueTitle('');
      setSelectedLabels([]);
      setLabelSearchQuery('');
      setShowLabelDropdown(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Save failed:', error);
      showNotification('Failed to save note. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [note, showNewIssue, newIssueTitle, selectedLabels, selectedIssue, user, pat, repoOwner, repoName]); // Include repo dependencies

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

  // Close label dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
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
              <strong>Required scopes:</strong> <code>repo</code>, <code>read:user</code>
            </p>
            <p>
              Create a token at{' '}
              <a 
                href="https://github.com/settings/tokens/new" 
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
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <Settings className="h-4 w-4" />
              Repository Settings
            </button>
            
            {showSettings && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Repository Owner
                  </label>
                  <input
                    type="text"
                    value={repoOwner}
                    onChange={(e) => setRepoOwner(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="github"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="solutions-engineering"
                  />
                </div>
                <button
                  onClick={updateRepoSettings}
                  className="w-full bg-blue-600 text-white px-3 py-2 text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  Save Settings
                </button>
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-700">{user.name || user.login}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title={mounted && theme === 'light' ? 'Switch to dark mode' : mounted && theme === 'dark' ? 'Switch to light mode' : 'Toggle color mode'}
              aria-label={mounted && theme === 'light' ? 'Enable dark mode' : mounted && theme === 'dark' ? 'Enable light mode' : 'Toggle color mode'}
            >
              {mounted ? (theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />) : <Moon className="h-5 w-5 opacity-0" aria-hidden="true" />}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Repository Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t bg-gray-50 px-4 py-3">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Repository Owner
                  </label>
                  <input
                    type="text"
                    value={repoOwner}
                    onChange={(e) => setRepoOwner(e.target.value)}
                    className="p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="github"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="solutions-engineering"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">&nbsp;</label>
                  <button
                    onClick={updateRepoSettings}
                    className="bg-blue-600 text-white px-4 py-2 text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            {/* Notes Textarea */}
            <div className="mb-6">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                ref={textareaRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Start typing your notes here... (Ctrl/Cmd+Enter to save)"
                className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                rows={4}
              />
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
                          title="Remove label"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Label Search */}
            <div className="mb-6" ref={labelDropdownRef}>
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
                        className="w-full text-left p-3 border-b border-gray-100 dark:border-[color-mix(in_srgb,var(--border)_60%,transparent)] last:border-b-0 flex items-center gap-2 text-gray-700 dark:text-[var(--foreground)] hover:bg-gray-50 dark:hover:bg-[color-mix(in_srgb,var(--surface-subtle)_85%,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] transition-colors cursor-pointer"
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

            {/* Issue Selection */}
            <div className="mb-6">
              <label htmlFor="issue-search" className="block text-sm font-medium text-gray-700 mb-2">
                Issue
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  id="issue-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for existing issues..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
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
                        className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                      >
                        <div className="font-medium text-sm">#{issue.number}</div>
                        <div className="text-sm text-gray-600">{issue.title}</div>
                        {issue.state && (
                          <div className={`text-xs mt-1 ${issue.state === 'open' ? 'text-green-600' : 'text-gray-500'}`}>
                            {issue.state}
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
    </div>
  );
}
