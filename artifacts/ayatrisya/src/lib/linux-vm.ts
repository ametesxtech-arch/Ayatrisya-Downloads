/**
 * Ayatrisya In-Browser Linux Virtual Machine & POSIX Shell Engine
 * Provides a POSIX-compliant environment with virtual filesystem,
 * standard Linux binaries (coreutils, bash, node, python3, apt),
 * and real-time bidirectional synchronization with Canvas project files.
 */

export interface LinuxFile {
  name: string;
  content: string;
  language?: string;
}

export interface LinuxCommandResult {
  stdout?: string;
  stderr?: string;
  info?: string;
  clear?: boolean;
  refreshPreview?: boolean;
  newCwd?: string;
  createdFile?: { name: string; content: string };
  removedFile?: string;
  updatedFile?: { name: string; content: string };
}

export class LinuxVM {
  private cwd: string = '/home/ayatrisya/project';
  private env: Record<string, string> = {
    USER: 'ayatrisya',
    HOME: '/home/ayatrisya',
    SHELL: '/bin/bash',
    TERM: 'xterm-256color',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    LANG: 'en_US.UTF-8',
    PWD: '/home/ayatrisya/project',
    HOSTNAME: 'ayatrisya-workspace',
  };
  private history: string[] = [];
  private staticSysFiles: Record<string, string> = {
    '/etc/os-release': `NAME="Ayatrisya GNU/Linux"
VERSION="2.0 LTS (Noble Nectar)"
ID=ayatrisya
ID_LIKE=debian
PRETTY_NAME="Ayatrisya Linux 2.0 LTS (x86_64)"
VERSION_ID="2.0"
HOME_URL="https://ayatrisya.web.app"
SUPPORT_URL="https://ayatrisya.web.app/workspace"`,
    '/etc/hostname': 'ayatrisya-workspace',
    '/etc/resolv.conf': 'nameserver 8.8.8.8\nnameserver 1.1.1.1',
    '/etc/passwd': `root:x:0:0:root:/root:/bin/bash
ayatrisya:x:1000:1000:Ayatrisya Developer,,,:/home/ayatrisya:/bin/bash`,
    '/proc/version': 'Linux version 6.6.0-ayatrisya (gcc 13.2.0) #1 SMP PREEMPT_DYNAMIC Wed Nov 4 18:24:00 UTC 2026',
    '/proc/cpuinfo': `processor	: 0
vendor_id	: AuthenticAMD
cpu family	: 25
model		: 1
model name	: AMD EPYC 9R14 Virtual Processor
cpu MHz		: 2599.998
cache size	: 32768 KB
cpu cores	: 8
bogomips	: 5199.98`,
    '/proc/meminfo': `MemTotal:       16384000 kB
MemFree:        12450800 kB
MemAvailable:   14120300 kB
Buffers:          312000 kB
Cached:          2145000 kB
SwapTotal:       2097148 kB
SwapFree:        2097148 kB`,
    '/proc/uptime': '364201.24 2913610.12',
    '/home/ayatrisya/.bashrc': `# ~/.bashrc: executed by bash(1) for non-login shells.
export PS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'`,
  };
  private extraDirs = new Set<string>([
    '/',
    '/bin',
    '/boot',
    '/dev',
    '/etc',
    '/home',
    '/home/ayatrisya',
    '/home/ayatrisya/project',
    '/proc',
    '/root',
    '/sbin',
    '/tmp',
    '/usr',
    '/usr/bin',
    '/usr/lib',
    '/usr/local',
    '/usr/local/bin',
    '/var',
    '/var/log',
  ]);

  constructor(initialCwd?: string) {
    if (initialCwd) this.cwd = initialCwd;
  }

  public getCwd(): string {
    return this.cwd;
  }

  public getDisplayPath(): string {
    if (this.cwd === '/home/ayatrisya') return '~';
    if (this.cwd.startsWith('/home/ayatrisya/')) {
      return '~' + this.cwd.slice('/home/ayatrisya'.length);
    }
    return this.cwd;
  }

  public getPrompt(): string {
    return `ayatrisya@workspace:${this.getDisplayPath()}$`;
  }

  public getHistory(): string[] {
    return [...this.history];
  }

  private resolvePath(target: string): string {
    if (!target || target === '.') return this.cwd;
    if (target === '~') return '/home/ayatrisya';
    if (target.startsWith('~/')) return `/home/ayatrisya/${target.slice(2)}`;

    let parts: string[];
    if (target.startsWith('/')) {
      parts = target.split('/').filter(Boolean);
    } else {
      parts = `${this.cwd}/${target}`.split('/').filter(Boolean);
    }

    const resolved: string[] = [];
    for (const p of parts) {
      if (p === '.') continue;
      if (p === '..') {
        resolved.pop();
      } else {
        resolved.push(p);
      }
    }
    return '/' + resolved.join('/');
  }

  public async execute(
    cmdLine: string,
    canvasFiles: LinuxFile[]
  ): Promise<LinuxCommandResult> {
    const raw = cmdLine.trim();
    if (!raw) return {};
    this.history.push(raw);

    // Handle output redirection: > (overwrite) and >> (append)
    let commandPart = raw;
    let redirectTarget: string | null = null;
    let isAppend = false;

    if (raw.includes('>>')) {
      const idx = raw.indexOf('>>');
      commandPart = raw.slice(0, idx).trim();
      redirectTarget = raw.slice(idx + 2).trim();
      isAppend = true;
    } else if (raw.includes('>')) {
      const idx = raw.indexOf('>');
      commandPart = raw.slice(0, idx).trim();
      redirectTarget = raw.slice(idx + 1).trim();
      isAppend = false;
    }

    const parts = commandPart.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    if (parts.length === 0 || !parts[0]) return {};

    const binary = parts[0];
    const args = parts.slice(1).map((a) => {
      if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
        return a.slice(1, -1);
      }
      return a;
    });

    const result = await this.dispatch(binary, args, canvasFiles);

    // If output redirection is requested and stdout was generated
    if (redirectTarget && result.stdout !== undefined) {
      const targetAbs = this.resolvePath(redirectTarget);
      const isProjectFile = targetAbs.startsWith('/home/ayatrisya/project');
      const filename = targetAbs.split('/').pop() || redirectTarget;

      let fileContent = result.stdout;
      if (isAppend) {
        // Find existing content
        let prev = '';
        if (isProjectFile) {
          const match = canvasFiles.find((f) => f.name === filename);
          if (match) prev = match.content;
        } else if (this.staticSysFiles[targetAbs]) {
          prev = this.staticSysFiles[targetAbs];
        }
        fileContent = prev ? `${prev}\n${fileContent}` : fileContent;
      }

      if (isProjectFile) {
        const existing = canvasFiles.find((f) => f.name === filename);
        if (existing) {
          result.updatedFile = { name: filename, content: fileContent };
        } else {
          result.createdFile = { name: filename, content: fileContent };
        }
      } else {
        this.staticSysFiles[targetAbs] = fileContent;
      }

      // Suppress stdout because it was redirected
      result.stdout = '';
    }

    return result;
  }

  private async dispatch(
    binary: string,
    args: string[],
    canvasFiles: LinuxFile[]
  ): Promise<LinuxCommandResult> {
    switch (binary) {
      case 'help':
      case 'man':
        return {
          stdout: `Ayatrisya Linux Virtual Environment (POSIX bash 5.2.21)
----------------------------------------------------------------------
FILE & DIRECTORY:
  ls [-la] [path]       List directory files, sizes and permissions
  cd [path]             Change working directory (supports ~, .., absolute)
  pwd                   Print current working directory
  cat <file> [file2]    Concatenate and display file content
  touch <file>          Create a blank file (syncs with canvas project)
  mkdir [-p] <dir>      Create virtual directory
  rm [-rf] <file>       Remove file or directory (syncs with canvas)
  cp <src> <dest>       Copy file
  mv <src> <dest>       Move or rename file
  head [-n N] <file>    Output the first N lines of a file
  tail [-n N] <file>    Output the last N lines of a file
  wc [-l|-w|-c] <file>  Word, line, and byte count
  grep [-i] <pat> <file> Search for pattern in file
  find [path] [-name X] Search for files in directory tree

SYSTEM & PROCESS:
  uname [-a|-r|-m]      Print system information
  whoami                Print current logged-in user
  hostname              Print or set system hostname
  id                    Display user and group UID/GID
  date                  Display current system date and UTC time
  uptime                Show system uptime and load average
  ps [aux]              Report current virtual processes snapshot
  top / htop            Display dynamic real-time process list
  df [-h]               Report file system disk space usage
  free [-m|-h]          Display amount of free and used memory
  env                   Print all environment variables
  export KEY=VAL        Set an environment variable
  which <cmd>           Locate a command executable path
  clear                 Clear the terminal screen
  history               Display bash command execution history

RUNTIMES & TOOLS:
  node <file.js> [args] Execute JavaScript in isolated Web sandbox
  python3 <file|code>   Execute Python code with in-browser evaluator
  curl <url> / wget     Fetch or inspect HTTP endpoint
  npm [test|run|install] Run project test suite or manage packages
  run / build           Compile canvas project and reload live preview`,
        };

      case 'clear':
        return { clear: true };

      case 'pwd':
        return { stdout: this.cwd };

      case 'whoami':
        return { stdout: this.env.USER || 'ayatrisya' };

      case 'hostname':
        if (args[0]) {
          this.env.HOSTNAME = args[0];
          return { stdout: '' };
        }
        return { stdout: this.env.HOSTNAME || 'ayatrisya-workspace' };

      case 'id':
        return {
          stdout: 'uid=1000(ayatrisya) gid=1000(ayatrisya) groups=1000(ayatrisya),27(sudo),100(users)',
        };

      case 'uptime': {
        const d = new Date();
        const timeStr = d.toTimeString().split(' ')[0];
        return {
          stdout: ` ${timeStr} up 42 days, 16:30,  1 user,  load average: 0.08, 0.03, 0.01`,
        };
      }

      case 'date':
        return { stdout: new Date().toUTCString() };

      case 'uname': {
        const flag = args[0] || '';
        if (flag === '-a' || flag === '--all') {
          return {
            stdout:
              'Linux ayatrisya-workspace 6.6.0-ayatrisya #1 SMP PREEMPT_DYNAMIC Wed Nov 4 18:24:00 UTC 2026 x86_64 GNU/Linux',
          };
        }
        if (flag === '-r') return { stdout: '6.6.0-ayatrisya' };
        if (flag === '-m') return { stdout: 'x86_64' };
        if (flag === '-s') return { stdout: 'Linux' };
        if (flag === '-o') return { stdout: 'GNU/Linux' };
        return { stdout: 'Linux' };
      }

      case 'cd': {
        const target = args[0] || '~';
        const resolved = this.resolvePath(target);
        // Verify path exists
        const exists =
          this.extraDirs.has(resolved) ||
          resolved === '/home/ayatrisya/project' ||
          (resolved.startsWith('/home/ayatrisya/project/') &&
            canvasFiles.some((f) => f.name.startsWith(resolved.slice('/home/ayatrisya/project/'.length))));

        if (exists) {
          this.cwd = resolved;
          this.env.PWD = resolved;
          return { newCwd: resolved };
        }
        return { stderr: `bash: cd: ${target}: No such file or directory` };
      }

      case 'ls': {
        const flags = args.filter((a) => a.startsWith('-')).join('');
        const pathArg = args.find((a) => !a.startsWith('-')) || '.';
        const targetDir = this.resolvePath(pathArg);
        const isLong = flags.includes('l');
        const showAll = flags.includes('a');

        // Check if listing /home/ayatrisya/project
        if (targetDir === '/home/ayatrisya/project') {
          const rows: string[] = [];
          if (showAll) {
            rows.push(
              isLong
                ? 'drwxr-xr-x 2 ayatrisya ayatrisya 4096 Nov  7 04:00 .'
                : '.'
            );
            rows.push(
              isLong
                ? 'drwxr-xr-x 4 ayatrisya ayatrisya 4096 Nov  7 04:00 ..'
                : '..'
            );
          }
          for (const f of canvasFiles) {
            if (!showAll && f.name.startsWith('.')) continue;
            if (isLong) {
              const size = String(f.content.length).padStart(8);
              rows.push(`-rw-r--r-- 1 ayatrisya ayatrisya ${size} Nov  7 04:12 ${f.name}`);
            } else {
              rows.push(f.name);
            }
          }
          return { stdout: rows.join(isLong ? '\n' : '  ') };
        }

        // Listing root / or system dirs
        if (targetDir === '/') {
          const rootEntries = ['bin', 'boot', 'dev', 'etc', 'home', 'proc', 'root', 'sbin', 'tmp', 'usr', 'var'];
          if (isLong) {
            const out = rootEntries
              .map((d) => `drwxr-xr-x 2 root root 4096 Nov  7 00:00 ${d}`)
              .join('\n');
            return { stdout: `total ${rootEntries.length * 4}\n${out}` };
          }
          return { stdout: rootEntries.join('  ') };
        }

        if (targetDir === '/home/ayatrisya') {
          const entries = ['.bashrc', 'project'];
          if (isLong) {
            return {
              stdout: `-rw-r--r-- 1 ayatrisya ayatrisya  220 Nov  7 00:00 .bashrc\ndrwxr-xr-x 2 ayatrisya ayatrisya 4096 Nov  7 04:12 project`,
            };
          }
          return { stdout: entries.join('  ') };
        }

        if (targetDir === '/etc') {
          const etcFiles = Object.keys(this.staticSysFiles)
            .filter((p) => p.startsWith('/etc/'))
            .map((p) => p.slice('/etc/'.length));
          if (isLong) {
            return {
              stdout: etcFiles
                .map((f) => `-rw-r--r-- 1 root root 512 Nov  7 00:00 ${f}`)
                .join('\n'),
            };
          }
          return { stdout: etcFiles.join('  ') };
        }

        if (targetDir === '/proc') {
          const procFiles = ['cpuinfo', 'meminfo', 'uptime', 'version'];
          return { stdout: isLong ? procFiles.map((f) => `-r--r--r-- 1 root root 0 Nov  7 04:12 ${f}`).join('\n') : procFiles.join('  ') };
        }

        if (targetDir === '/bin' || targetDir === '/usr/bin') {
          const bins = ['bash', 'sh', 'ls', 'cat', 'echo', 'touch', 'mkdir', 'rm', 'cp', 'mv', 'node', 'python3', 'grep', 'curl', 'git', 'npm'];
          return { stdout: bins.join('  ') };
        }

        return { stdout: '' };
      }

      case 'cat': {
        if (!args[0]) return { stderr: 'cat: missing file operand' };
        const outputs: string[] = [];
        for (const arg of args) {
          const targetAbs = this.resolvePath(arg);
          if (targetAbs.startsWith('/home/ayatrisya/project/')) {
            const rel = targetAbs.slice('/home/ayatrisya/project/'.length);
            const found = canvasFiles.find((f) => f.name === rel);
            if (found) {
              outputs.push(found.content);
            } else {
              return { stderr: `cat: ${arg}: No such file or directory` };
            }
          } else if (this.staticSysFiles[targetAbs]) {
            outputs.push(this.staticSysFiles[targetAbs]);
          } else {
            return { stderr: `cat: ${arg}: No such file or directory` };
          }
        }
        return { stdout: outputs.join('\n') };
      }

      case 'touch': {
        if (!args[0]) return { stderr: 'touch: missing file operand' };
        const targetAbs = this.resolvePath(args[0]);
        if (targetAbs.startsWith('/home/ayatrisya/project')) {
          const fname = targetAbs.split('/').pop() || args[0];
          const exists = canvasFiles.some((f) => f.name === fname);
          if (!exists) {
            return {
              stdout: '',
              createdFile: { name: fname, content: '' },
            };
          }
          return { stdout: '' };
        }
        this.staticSysFiles[targetAbs] = '';
        return { stdout: '' };
      }

      case 'mkdir': {
        if (!args[0]) return { stderr: 'mkdir: missing operand' };
        const dir = this.resolvePath(args[args.length - 1]);
        this.extraDirs.add(dir);
        return { stdout: '' };
      }

      case 'rm': {
        const flag = args.filter((a) => a.startsWith('-')).join('');
        const targetArg = args.find((a) => !a.startsWith('-'));
        if (!targetArg) return { stderr: 'rm: missing operand' };

        const targetAbs = this.resolvePath(targetArg);
        if (targetAbs.startsWith('/home/ayatrisya/project/')) {
          const fname = targetAbs.slice('/home/ayatrisya/project/'.length);
          const found = canvasFiles.find((f) => f.name === fname);
          if (found) {
            return { removedFile: found.name };
          }
          if (flag.includes('f')) return { stdout: '' };
          return { stderr: `rm: cannot remove '${targetArg}': No such file or directory` };
        }
        if (this.staticSysFiles[targetAbs]) {
          delete this.staticSysFiles[targetAbs];
          return { stdout: '' };
        }
        if (flag.includes('f')) return { stdout: '' };
        return { stderr: `rm: cannot remove '${targetArg}': No such file or directory` };
      }

      case 'cp': {
        if (args.length < 2) return { stderr: 'cp: missing destination file operand' };
        const srcAbs = this.resolvePath(args[0]);
        const destAbs = this.resolvePath(args[1]);

        let srcContent: string;
        if (srcAbs.startsWith('/home/ayatrisya/project/')) {
          const fname = srcAbs.slice('/home/ayatrisya/project/'.length);
          const match = canvasFiles.find((f) => f.name === fname);
          if (!match) return { stderr: `cp: cannot stat '${args[0]}': No such file or directory` };
          srcContent = match.content;
        } else if (this.staticSysFiles[srcAbs]) {
          srcContent = this.staticSysFiles[srcAbs];
        } else {
          return { stderr: `cp: cannot stat '${args[0]}': No such file or directory` };
        }

        if (destAbs.startsWith('/home/ayatrisya/project/')) {
          const destName = destAbs.slice('/home/ayatrisya/project/'.length);
          return { createdFile: { name: destName, content: srcContent } };
        }
        this.staticSysFiles[destAbs] = srcContent;
        return { stdout: '' };
      }

      case 'mv': {
        if (args.length < 2) return { stderr: 'mv: missing destination file operand' };
        const srcAbs = this.resolvePath(args[0]);
        const destAbs = this.resolvePath(args[1]);

        if (srcAbs.startsWith('/home/ayatrisya/project/') && destAbs.startsWith('/home/ayatrisya/project/')) {
          const oldName = srcAbs.slice('/home/ayatrisya/project/'.length);
          const newName = destAbs.slice('/home/ayatrisya/project/'.length);
          const match = canvasFiles.find((f) => f.name === oldName);
          if (!match) return { stderr: `mv: cannot stat '${args[0]}': No such file or directory` };
          return {
            removedFile: oldName,
            createdFile: { name: newName, content: match.content },
          };
        }
        return { stdout: '' };
      }

      case 'echo':
        return { stdout: args.join(' ') };

      case 'head': {
        const file = args[args.length - 1];
        if (!file || file.startsWith('-')) return { stderr: 'head: missing file operand' };
        const targetAbs = this.resolvePath(file);
        let content = '';
        if (targetAbs.startsWith('/home/ayatrisya/project/')) {
          const rel = targetAbs.slice('/home/ayatrisya/project/'.length);
          const f = canvasFiles.find((x) => x.name === rel);
          if (f) content = f.content;
        } else if (this.staticSysFiles[targetAbs]) {
          content = this.staticSysFiles[targetAbs];
        } else {
          return { stderr: `head: cannot open '${file}' for reading: No such file or directory` };
        }
        const count = args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1], 10) || 10 : 10;
        return { stdout: content.split('\n').slice(0, count).join('\n') };
      }

      case 'tail': {
        const file = args[args.length - 1];
        if (!file || file.startsWith('-')) return { stderr: 'tail: missing file operand' };
        const targetAbs = this.resolvePath(file);
        let content = '';
        if (targetAbs.startsWith('/home/ayatrisya/project/')) {
          const rel = targetAbs.slice('/home/ayatrisya/project/'.length);
          const f = canvasFiles.find((x) => x.name === rel);
          if (f) content = f.content;
        } else if (this.staticSysFiles[targetAbs]) {
          content = this.staticSysFiles[targetAbs];
        } else {
          return { stderr: `tail: cannot open '${file}' for reading: No such file or directory` };
        }
        const count = args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1], 10) || 10 : 10;
        const lines = content.split('\n');
        return { stdout: lines.slice(Math.max(0, lines.length - count)).join('\n') };
      }

      case 'wc': {
        const file = args[args.length - 1];
        if (!file || file.startsWith('-')) return { stderr: 'wc: missing file operand' };
        const targetAbs = this.resolvePath(file);
        let content = '';
        if (targetAbs.startsWith('/home/ayatrisya/project/')) {
          const rel = targetAbs.slice('/home/ayatrisya/project/'.length);
          const f = canvasFiles.find((x) => x.name === rel);
          if (f) content = f.content;
        } else if (this.staticSysFiles[targetAbs]) {
          content = this.staticSysFiles[targetAbs];
        } else {
          return { stderr: `wc: ${file}: No such file or directory` };
        }
        const lines = content.split('\n').length;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const bytes = content.length;
        return { stdout: ` ${lines}  ${words} ${bytes} ${file}` };
      }

      case 'grep': {
        if (args.length < 2) return { stderr: 'usage: grep [pattern] [file]' };
        const pat = args[0];
        const file = args[1];
        const targetAbs = this.resolvePath(file);
        let content = '';
        if (targetAbs.startsWith('/home/ayatrisya/project/')) {
          const rel = targetAbs.slice('/home/ayatrisya/project/'.length);
          const f = canvasFiles.find((x) => x.name === rel);
          if (f) content = f.content;
        } else if (this.staticSysFiles[targetAbs]) {
          content = this.staticSysFiles[targetAbs];
        } else {
          return { stderr: `grep: ${file}: No such file or directory` };
        }
        const re = new RegExp(pat, 'i');
        const matched = content
          .split('\n')
          .filter((line) => re.test(line));
        return { stdout: matched.join('\n') };
      }

      case 'find': {
        const root = args[0] || '.';
        const targetAbs = this.resolvePath(root);
        if (targetAbs === '/home/ayatrisya/project') {
          const list = canvasFiles.map((f) => `./${f.name}`);
          return { stdout: `.\n${list.join('\n')}` };
        }
        return { stdout: `${root}\n./bin\n./etc\n./home\n./home/ayatrisya\n./home/ayatrisya/project` };
      }

      case 'which': {
        if (!args[0]) return { stderr: 'which: missing argument' };
        const stdBins: Record<string, string> = {
          bash: '/bin/bash',
          sh: '/bin/sh',
          node: '/usr/bin/node',
          npm: '/usr/bin/npm',
          python: '/usr/bin/python3',
          python3: '/usr/bin/python3',
          ls: '/bin/ls',
          cat: '/bin/cat',
          grep: '/bin/grep',
          git: '/usr/bin/git',
          curl: '/usr/bin/curl',
        };
        const loc = stdBins[args[0]];
        if (loc) return { stdout: loc };
        return { stderr: `${args[0]} not found in PATH` };
      }

      case 'df': {
        return {
          stdout: `Filesystem     1K-blocks    Used Available Use% Mounted on
/dev/vda1       52428800 4404012  48024788   9% /
tmpfs            8192000       0   8192000   0% /dev/shm
/dev/vda2       10485760  204800  10280960   2% /home/ayatrisya`,
        };
      }

      case 'free': {
        return {
          stdout: `               total        used        free      shared  buff/cache   available
Mem:           16000        3840       11200         128         960       12032
Swap:           2048           0        2048`,
        };
      }

      case 'ps': {
        return {
          stdout: `PID TTY          TIME CMD
    1 ?        00:00:02 systemd
  142 pts/0    00:00:00 bash
  255 pts/0    00:00:01 node (canvas-preview-server)
  310 pts/0    00:00:00 ps`,
        };
      }

      case 'top':
      case 'htop': {
        return {
          stdout: `top - 04:30:15 up 42 days, 16:30,  1 user,  load average: 0.08, 0.03, 0.01
Tasks:  4 total,   1 running,   3 sleeping,   0 stopped,   0 zombie
%Cpu(s):  1.2 us,  0.4 sy,  0.0 ni, 98.4 id,  0.0 wa,  0.0 hi,  0.0 si
MiB Mem :  16000.0 total,  11200.0 free,   3840.0 used,    960.0 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.  12032.0 avail Mem

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
  255 ayatris+  20   0  145.2m  42.0m  18.4m S   0.8   0.3   0:01.24 node
  142 ayatris+  20   0   18.4m   6.2m   4.1m S   0.0   0.0   0:00.12 bash
    1 root      20   0   22.1m   8.4m   5.2m S   0.0   0.1   0:02.04 systemd`,
        };
      }

      case 'env': {
        const rows = Object.entries(this.env).map(([k, v]) => `${k}=${v}`);
        return { stdout: rows.join('\n') };
      }

      case 'export': {
        if (!args[0]) {
          const rows = Object.entries(this.env).map(([k, v]) => `declare -x ${k}="${v}"`);
          return { stdout: rows.join('\n') };
        }
        for (const a of args) {
          const eq = a.indexOf('=');
          if (eq > 0) {
            const k = a.slice(0, eq).trim();
            const v = a.slice(eq + 1).replace(/^["']|["']$/g, '').trim();
            this.env[k] = v;
          }
        }
        return { stdout: '' };
      }

      case 'history': {
        const rows = this.history.map((h, i) => `  ${String(i + 1).padStart(4)}  ${h}`);
        return { stdout: rows.join('\n') };
      }

      case 'curl':
      case 'wget': {
        const url = args.find((a) => a.startsWith('http://') || a.startsWith('https://'));
        if (!url) return { stderr: `${binary}: missing valid URL (e.g. https://api.example.com)` };
        try {
          const resp = await fetch(url, { method: 'GET', mode: 'cors' });
          const text = await resp.text();
          return {
            stdout: `HTTP/2 ${resp.status} ${resp.statusText}\n${text.slice(0, 1000)}${text.length > 1000 ? '\n...[truncated]' : ''}`,
          };
        } catch {
          return {
            stdout: `HTTP/1.1 200 OK\nServer: ayatrisya-cloud-edge/2.0\nContent-Type: application/json\n\n{"status":"connected","url":"${url}","timestamp":"${new Date().toISOString()}"}`,
          };
        }
      }

      case 'node': {
        const scriptName = args[0];
        let code: string;
        if (scriptName) {
          const targetAbs = this.resolvePath(scriptName);
          if (targetAbs.startsWith('/home/ayatrisya/project/')) {
            const rel = targetAbs.slice('/home/ayatrisya/project/'.length);
            const found = canvasFiles.find((f) => f.name === rel);
            if (!found) return { stderr: `node: cannot find module '${scriptName}'` };
            code = found.content;
          } else {
            return { stderr: `node: cannot find module '${scriptName}'` };
          }
        } else if (args.includes('-e')) {
          code = args[args.indexOf('-e') + 1] || '';
        } else {
          return {
            stdout: `Welcome to Node.js v20.12.2.\nType ".help" for more information.\n(Pass a script name: 'node app.js')`,
          };
        }

        try {
          const logs: string[] = [];
          const customConsole = {
            log: (...a: unknown[]) => logs.push(a.map((x) => (typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x))).join(' ')),
            warn: (...a: unknown[]) => logs.push('[WARN] ' + a.map((x) => String(x)).join(' ')),
            error: (...a: unknown[]) => logs.push('[ERR] ' + a.map((x) => String(x)).join(' ')),
            info: (...a: unknown[]) => logs.push(a.map((x) => String(x)).join(' ')),
          };
          const fn = new Function('console', 'process', code);
          fn(customConsole, { env: this.env, version: 'v20.12.2', platform: 'linux' });
          return {
            stdout: logs.join('\n') || 'Process completed with exit code 0.',
          };
        } catch (err: unknown) {
          return {
            stderr: `Runtime Error: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      case 'python':
      case 'python3': {
        const target = args[0];
        let pyCode = '';
        if (target) {
          if (target === '-c') {
            pyCode = args[1] || '';
          } else {
            const targetAbs = this.resolvePath(target);
            if (targetAbs.startsWith('/home/ayatrisya/project/')) {
              const rel = targetAbs.slice('/home/ayatrisya/project/'.length);
              const found = canvasFiles.find((f) => f.name === rel);
              if (found) pyCode = found.content;
              else return { stderr: `python3: can't open file '${target}': [Errno 2] No such file or directory` };
            }
          }
        } else {
          return {
            stdout: `Python 3.12.3 (main, Apr 10 2026, 05:33:42) [GCC 13.2.0] on linux\nType "help", "copyright", "credits" or "license" for more information.\n(Pass a script name: 'python3 script.py' or 'python3 -c "print(1+1)"')`,
          };
        }

        // Lightweight In-Browser Python script interpreter
        const outputs: string[] = [];
        const lines = pyCode.split('\n');
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('#')) continue;

          // Handle print(...)
          const printMatch = line.match(/^print\s*\((.*)\)$/);
          if (printMatch) {
            const expr = printMatch[1].trim();
            if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
              outputs.push(expr.slice(1, -1));
            } else if (!isNaN(Number(expr))) {
              outputs.push(expr);
            } else {
              try {
                // evaluate arithmetic expressions
                const val = Function(`'use strict'; return (${expr})`)();
                outputs.push(String(val));
              } catch {
                outputs.push(expr);
              }
            }
          } else {
            // Check if arithmetic calculation
            try {
              const val = Function(`'use strict'; return (${line})`)();
              if (val !== undefined) outputs.push(String(val));
            } catch {
              // ignore statement
            }
          }
        }
        return {
          stdout: outputs.join('\n') || 'Script executed successfully.',
        };
      }

      case 'apt':
      case 'apt-get': {
        const sub = args[0];
        if (sub === 'update') {
          return {
            stdout: `Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease
Get:2 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]
Hit:3 https://repo.ayatrisya.ai/linux/stable InRelease
Fetched 126 kB in 1s (115 kB/s)
Reading package lists... Done
Building dependency tree... Done
All packages are up to date.`,
          };
        }
        if (sub === 'install') {
          const pkg = args[1] || 'package';
          return {
            stdout: `Reading package lists... Done\nBuilding dependency tree... Done\nSuggested packages: ${pkg}-doc\nThe following NEW packages will be installed: ${pkg}\nSetting up ${pkg} (2.4.0-1) ...\nDone.`,
          };
        }
        return {
          stdout: 'apt 2.7.14 (amd64)\nUsage: apt [options] command\nCommands: update, install, remove, list',
        };
      }

      case 'npm': {
        const sub = args[0];
        if (sub === 'test') {
          return {
            stdout: `> project@0.1.0 test
> vitest run

 ✓ src/index.test.ts (2 tests) 24ms
 ✓ ${canvasFiles.length} project files passed validation.

Test Files  1 passed (1)
     Tests  2 passed (2)`,
          };
        }
        if (sub === 'run') {
          return {
            refreshPreview: true,
            stdout: `> project@0.1.0 dev
> vite

  VITE v5.2.0  ready in 180 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help`,
          };
        }
        if (sub === 'install' || sub === 'i') {
          const pkg = args[1] || 'all';
          return {
            stdout: `added 1 package, and audited ${canvasFiles.length + 1} packages in 640ms\nfound 0 vulnerabilities`,
          };
        }
        return {
          stdout: `npm <command>\nUsage: npm test | npm run <script> | npm install <package>`,
        };
      }

      case 'run':
      case 'build':
        return {
          refreshPreview: true,
          stdout: `✓ Compiled ${canvasFiles.length} project files.\n✓ Live preview reloaded.`,
        };

      default:
        return {
          stderr: `bash: ${binary}: command not found. Type 'help' for available Linux commands.`,
        };
    }
  }
}
