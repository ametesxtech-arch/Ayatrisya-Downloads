import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  FileDigit,
  Plus,
  FolderPlus,
  Trash2,
  Edit2,
  Copy,
  ChevronRight,
  ChevronDown,
  Search,
  MoreVertical,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { CanvasFile } from './types';
import { cx } from '@/lib/cx';

interface CanvasFileTreeProps {
  files: CanvasFile[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onCreateFile: (name: string) => void;
  onCreateFolder: (folderName: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  onDuplicateFile: (id: string) => void;
  onDeleteFile: (id: string) => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  file?: CanvasFile;
  children: Record<string, TreeNode>;
}

export function CanvasFileTree({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
}: CanvasFileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [inputName, setInputName] = useState('');

  // Context / Action State
  const [renameTarget, setRenameTarget] = useState<CanvasFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CanvasFile | null>(null);

  // Build hierarchical folder structure
  const rootNode = useMemo(() => {
    const root: TreeNode = {
      name: 'root',
      fullPath: '',
      isFolder: true,
      children: {},
    };

    const filtered = files.filter((f) =>
      searchQuery ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
    );

    for (const file of filtered) {
      const parts = file.name.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isLast) {
          current.children[part] = {
            name: part,
            fullPath: currentPath,
            isFolder: false,
            file,
            children: {},
          };
        } else {
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              fullPath: currentPath,
              isFolder: true,
              children: {},
            };
          }
          current = current.children[part];
        }
      }
    }

    return root;
  }, [files, searchQuery]);

  const toggleFolder = (path: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    onCreateFile(inputName.trim());
    setInputName('');
    setIsCreatingFile(false);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    onCreateFolder(inputName.trim());
    setInputName('');
    setIsCreatingFolder(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !inputName.trim()) return;
    onRenameFile(renameTarget.id, inputName.trim());
    setRenameTarget(null);
    setInputName('');
  };

  const renderFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html':
      case 'xml':
        return <FileCode size={13} className="text-orange-400 shrink-0" />;
      case 'css':
      case 'scss':
        return <FileCode size={13} className="text-blue-400 shrink-0" />;
      case 'js':
      case 'jsx':
        return <FileCode size={13} className="text-amber-400 shrink-0" />;
      case 'ts':
      case 'tsx':
        return <FileCode size={13} className="text-sky-400 shrink-0" />;
      case 'py':
        return <FileDigit size={13} className="text-emerald-400 shrink-0" />;
      case 'json':
        return <FileJson size={13} className="text-yellow-300 shrink-0" />;
      case 'md':
        return <FileText size={13} className="text-purple-400 shrink-0" />;
      default:
        return <FileCode size={13} className="text-slate-400 shrink-0" />;
    }
  };

  const renderTree = (node: TreeNode, depth: number = 0) => {
    const sortedKeys = Object.keys(node.children).sort((a, b) => {
      const nodeA = node.children[a];
      const nodeB = node.children[b];
      // Folders first
      if (nodeA.isFolder && !nodeB.isFolder) return -1;
      if (!nodeA.isFolder && nodeB.isFolder) return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((key) => {
      const child = node.children[key];
      const isCollapsed = collapsedFolders[child.fullPath];

      if (child.isFolder) {
        return (
          <div key={child.fullPath} className="select-none">
            <div
              onClick={() => toggleFolder(child.fullPath)}
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              className="flex items-center gap-1.5 py-1 text-xs text-slate-300 hover:bg-white/[.04] cursor-pointer rounded transition group"
            >
              {isCollapsed ? (
                <ChevronRight size={13} className="text-slate-500 shrink-0" />
              ) : (
                <ChevronDown size={13} className="text-slate-500 shrink-0" />
              )}
              {isCollapsed ? (
                <Folder size={14} className="text-violet-400 shrink-0" />
              ) : (
                <FolderOpen size={14} className="text-violet-400 shrink-0" />
              )}
              <span className="truncate font-medium">{child.name}</span>
            </div>
            {!isCollapsed && <div>{renderTree(child, depth + 1)}</div>}
          </div>
        );
      }

      // File item
      const file = child.file!;
      const isActive = file.id === activeFileId;

      return (
        <div
          key={file.id}
          onClick={() => onSelectFile(file.id)}
          style={{ paddingLeft: `${depth * 14 + 18}px` }}
          className={cx(
            'group flex items-center justify-between py-1.5 pr-2 text-xs font-mono cursor-pointer transition select-none rounded',
            isActive
              ? 'bg-violet-500/15 text-violet-200 font-semibold border-l-2 border-violet-400'
              : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-200'
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {renderFileIcon(child.name)}
            <span className="truncate">{child.name}</span>
            {file.modified && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRenameTarget(file);
                setInputName(file.name);
              }}
              className="p-0.5 text-slate-500 hover:text-white"
              title="Rename file"
            >
              <Edit2 size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateFile(file.id);
              }}
              className="p-0.5 text-slate-500 hover:text-white"
              title="Duplicate file"
            >
              <Copy size={11} />
            </button>
            {files.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(file);
                }}
                className="p-0.5 text-slate-500 hover:text-rose-400"
                title="Delete file"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#111018] border-r border-white/[.07] select-none text-xs">
      {/* File Explorer Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[.06]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Project Files</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setIsCreatingFile(true);
              setIsCreatingFolder(false);
              setInputName('');
            }}
            className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white transition"
            title="New File"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreatingFolder(true);
              setIsCreatingFile(false);
              setInputName('');
            }}
            className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white transition"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="p-2 border-b border-white/[.04]">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full rounded-md bg-black/40 pl-7 pr-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 border border-white/[.06]"
          />
        </div>
      </div>

      {/* Creation Input Form */}
      {(isCreatingFile || isCreatingFolder) && (
        <form
          onSubmit={isCreatingFile ? handleCreateFileSubmit : handleCreateFolderSubmit}
          className="p-2 border-b border-violet-500/30 bg-violet-500/10"
        >
          <label className="text-[10px] text-violet-300 font-semibold mb-1 block">
            {isCreatingFile ? 'Create File (e.g. src/app.js):' : 'Create Folder (e.g. components):'}
          </label>
          <input
            autoFocus
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder={isCreatingFile ? 'filename.js' : 'folder-name'}
            className="w-full rounded bg-black/60 px-2 py-1 text-xs text-white border border-violet-500/50 focus:outline-none"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
              }}
              className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-violet-600 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-500"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {renderTree(rootNode)}
      </div>

      {/* Confirmation Modal for File Deletion */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-rose-500/40 bg-[#161424] p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle size={18} />
              <h3 className="font-semibold text-sm text-white">Delete File?</h3>
            </div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-mono font-bold text-white">{deleteTarget.name}</span>? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteFile(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleRenameSubmit}
            className="w-full max-w-sm rounded-xl border border-violet-500/40 bg-[#161424] p-5 shadow-2xl"
          >
            <h3 className="font-semibold text-sm text-white">Rename File</h3>
            <p className="mt-1 text-xs text-slate-400">Enter a new path or filename:</p>
            <input
              autoFocus
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="mt-3 w-full rounded bg-black/60 px-2.5 py-1.5 text-xs text-white border border-violet-500/50 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
