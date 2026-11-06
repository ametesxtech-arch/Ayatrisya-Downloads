import { describe, it, expect } from 'vitest';
import { LinuxVM } from '@/lib/linux-vm';

describe('Ayatrisya Linux Virtual Machine', () => {
  it('initializes with default user, host, and working directory', () => {
    const vm = new LinuxVM();
    expect(vm.getCwd()).toBe('/home/ayatrisya/project');
    expect(vm.getDisplayPath()).toBe('~/project');
    expect(vm.getPrompt()).toContain('ayatrisya@workspace:~/project$');
  });

  it('executes core system queries: uname, whoami, hostname, id', async () => {
    const vm = new LinuxVM();
    const u = await vm.execute('uname -a', []);
    expect(u.stdout).toContain('Linux ayatrisya-workspace 6.6.0-ayatrisya');

    const w = await vm.execute('whoami', []);
    expect(w.stdout).toBe('ayatrisya');

    const h = await vm.execute('hostname', []);
    expect(h.stdout).toBe('ayatrisya-workspace');

    const id = await vm.execute('id', []);
    expect(id.stdout).toContain('uid=1000(ayatrisya)');
  });

  it('lists files and navigates directories', async () => {
    const vm = new LinuxVM();
    const files = [
      { name: 'index.html', content: '<h1>Hello</h1>' },
      { name: 'app.js', content: 'console.log("hi");' },
    ];

    const ls = await vm.execute('ls -la', files);
    expect(ls.stdout).toContain('index.html');
    expect(ls.stdout).toContain('app.js');

    const cd = await vm.execute('cd /etc', files);
    expect(vm.getCwd()).toBe('/etc');
    expect(vm.getDisplayPath()).toBe('/etc');

    const catRelease = await vm.execute('cat os-release', files);
    expect(catRelease.stdout).toContain('Ayatrisya GNU/Linux');
  });

  it('supports node execution and output capturing', async () => {
    const vm = new LinuxVM();
    const files = [{ name: 'test.js', content: 'console.log(10 + 20);' }];
    const res = await vm.execute('node test.js', files);
    expect(res.stdout).toContain('30');
  });

  it('supports python3 execution and arithmetic', async () => {
    const vm = new LinuxVM();
    const res = await vm.execute('python3 -c "print(42 * 2)"', []);
    expect(res.stdout).toContain('84');
  });

  it('supports file creation and output redirection', async () => {
    const vm = new LinuxVM();
    const touch = await vm.execute('touch newfile.txt', []);
    expect(touch.createdFile?.name).toBe('newfile.txt');

    const redir = await vm.execute('echo "Hello World" > hello.txt', []);
    expect(redir.createdFile?.name).toBe('hello.txt');
    expect(redir.createdFile?.content).toBe('Hello World');
  });
});
