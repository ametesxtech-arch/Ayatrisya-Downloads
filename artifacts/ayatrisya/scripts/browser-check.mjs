// Replit's Chromium and Node 24 are used; no hosted test account or app data is touched.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=await fs.mkdtemp('/tmp/ayatrisya-browser-');
const processHandle=spawn('chromium',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${dir}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const passed=[],errors=[],uploads=[];
let reloadCounter=0;
let socket;
try {
  let port;
  for(let n=0;n<80;n++){try{port=(await fs.readFile(`${dir}/DevToolsActivePort`,'utf8')).split('\n')[0];break;}catch{await delay(100);}}
  assert(port,'Chromium did not start');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;
  const pending=new Map();
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const entry=pending.get(message.id);pending.delete(message.id);message.error?entry?.reject(Error(JSON.stringify(message.error))):entry?.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
    if(message.method==='Network.requestWillBeSent'&&!['GET','OPTIONS'].includes(message.params.request.method))uploads.push(message.params.request.method);
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
    return result.result.value;
  };
  const wait=async(expression,label=expression)=>{
    for(let n=0;n<100;n++){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await delay(100);}
    throw Error(`Timed out: ${label}; page: ${await evaluate('document.body.innerText.slice(0,500)')}`);
  };
  const click=selector=>evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing '+${JSON.stringify(selector)}+' on '+location.pathname+'; aria buttons='+[...document.querySelectorAll('button[aria-label]')].map(x=>x.getAttribute('aria-label')).join('|')+'; messages='+[...document.querySelectorAll('[data-testid^="message-"]')].map(x=>x.textContent).join(' || '));element.click();})()`);
   const clickText=text=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Button not found: '+${JSON.stringify(text)}+'; path='+location.pathname+'; buttons='+[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).join('|')+'; body='+document.body.innerText.slice(0,800));button.click();})()`);
  const input=async(selector,text)=>{await evaluate(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});field.focus();field.select();})()`);await call('Input.insertText',{text});};
  const go=async path=>{await call('Page.navigate',{url:`http://127.0.0.1:80${path}`});await wait(`document.querySelector('[aria-label="Model"]')`,'workspace load');await delay(200);};
  const reloadPage=async()=>{const marker=`browser-check-${++reloadCounter}`;await evaluate(`window.__browserCheckReloadMarker=${JSON.stringify(marker)}`);await call('Page.reload');await wait(`window.__browserCheckReloadMarker!==${JSON.stringify(marker)}`,'page reload');await wait(`document.querySelector('[aria-label="Model"]')`,'workspace reload');};
  const setWorkspaceMode=async mode=>{await wait(`document.querySelector('[aria-label="Workspace mode"]')`,'workspace mode selector');await evaluate(`(()=>{const select=document.querySelector('[aria-label="Workspace mode"]');select.value=${JSON.stringify(mode)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(`document.querySelector('.workspace-shell')?.dataset.workspaceMode===${JSON.stringify(mode)}`,`${mode} mode setting`);};
  const counts=()=>evaluate(`new Promise((resolve,reject)=>{const request=indexedDB.open('ayatrisya-local');request.onerror=()=>reject(request.error);request.onsuccess=async()=>{const db=request.result,names=['conversations','messages','projects','projectItems','attachments'];const values=await Promise.all(names.map(name=>new Promise((res,rej)=>{const query=db.transaction(name).objectStore(name).count();query.onsuccess=()=>res(query.result);query.onerror=()=>rej(query.error);})));db.close();resolve(Object.fromEntries(names.map((name,i)=>[name,values[i]])));};})`);
  const savedPreferences=()=>evaluate(`new Promise((resolve,reject)=>{const request=indexedDB.open('ayatrisya-local');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,query=db.transaction('preferences').objectStore('preferences').getAll();query.onsuccess=()=>{db.close();resolve(query.result);};query.onerror=()=>reject(query.error);};})`);
  const setFile=async(selector,path)=>{const document=await call('DOM.getDocument');const node=await call('DOM.querySelector',{nodeId:document.root.nodeId,selector});await call('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[path]});};
  const setViewport=async(width,height,mobile)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await delay(160);};
  const assertNoHorizontalOverflow=async(label)=>{const size=await evaluate(`({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth})`);if(size.document>size.viewport||size.body>size.viewport)throw Error(`${label} overflows horizontally: ${JSON.stringify(size)}`);};
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
  await setViewport(1440,1000,false);
  await call('Page.navigate',{url:'http://127.0.0.1:80/'});
  await wait(`document.querySelector('a[aria-label="Get Ayatrisya Desktop"]')`,'desktop download action');
  assert(await evaluate(`!/(maximum-scale\\s*=\\s*1|user-scalable\\s*=\\s*no)/i.test(document.querySelector('meta[name="viewport"]')?.content||'')`),'Mobile zoom must remain available');
  const faviconResponses=await evaluate(`Promise.all([...document.querySelectorAll('link[rel~="icon"]')].map(async link=>{const response=await fetch(link.href);return {path:new URL(link.href).pathname,ok:response.ok};}))`);
  assert(faviconResponses.some(icon=>icon.path.endsWith('/favicon.ico')&&icon.ok),'ICO Ayatrisya favicon must load');
  assert(faviconResponses.some(icon=>icon.path.endsWith('/favicon.svg')&&icon.ok),'SVG Ayatrisya favicon must load');
  assert(faviconResponses.some(icon=>icon.path.endsWith('/ayatrisya-desktop.png')&&icon.ok),'PNG Ayatrisya favicon fallback must load');
  const wallpaperLayout=await evaluate(`(()=>{const root=document.documentElement,wasActive=root.dataset.wallpaperActive,previous=root.style.getPropertyValue('--workspace-wallpaper');root.dataset.wallpaperActive='true';root.style.setProperty('--workspace-wallpaper','url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 2 2%27%3E%3Crect width=%272%27 height=%272%27 fill=%27%237c6ceb%27/%3E%3C/svg%3E")');const shell=document.createElement('div'),main=document.createElement('main');shell.className='workspace-shell';shell.append(main);document.body.append(shell);const style=getComputedStyle(shell);const result={size:style.backgroundSize,position:style.backgroundPosition,repeat:style.backgroundRepeat,attachment:style.backgroundAttachment,mainBackground:getComputedStyle(main).backgroundColor};shell.remove();if(wasActive===undefined)delete root.dataset.wallpaperActive;else root.dataset.wallpaperActive=wasActive;if(previous)root.style.setProperty('--workspace-wallpaper',previous);else root.style.removeProperty('--workspace-wallpaper');return result;})()`);
  assert(wallpaperLayout.size.split(',').every(value=>value.trim()==='cover'),'Workspace wallpaper layers should cover the full shell');
  assert(wallpaperLayout.repeat.split(',').every(value=>value.trim()==='no-repeat'),'Workspace wallpaper layers should not tile');
  assert(wallpaperLayout.attachment.split(',').every(value=>value.trim()==='scroll'),'Workspace wallpaper should follow the shell on mobile');
  passed.push('ICO, SVG, and PNG brand icons load; wallpaper covers the shell without mobile fixed-background cropping');
  for(const width of [320,390,768,1024,1440]){await setViewport(width,width<640?844:1000,width<1024);await assertNoHorizontalOverflow(`Landing at ${width}px`);}
  await setViewport(768,1000,true);
  const tabletHeroTracks=await evaluate(`getComputedStyle(document.querySelector('main > section')).gridTemplateColumns.split(' ').length`);
  assert.equal(tabletHeroTracks,1,'Landing hero should stack at tablet width');
  await setViewport(1024,1000,false);
  const desktopHeroTracks=await evaluate(`getComputedStyle(document.querySelector('main > section')).gridTemplateColumns.split(' ').length`);
  assert.equal(desktopHeroTracks,2,'Landing hero should use two columns on wide screens');
  await setViewport(1440,1000,false);
  passed.push('Landing layout adapts without horizontal overflow from 320px phones through desktop');
  const desktopUrl=await evaluate(`document.querySelector('a[aria-label="Get Ayatrisya Desktop"]').href`);
  if(new URL(desktopUrl).pathname==='/desktop'){
    await click('a[aria-label="Get Ayatrisya Desktop"]');
    await wait(`location.pathname==='/desktop'`,'desktop download page');
    assert(await evaluate(`document.body.innerText.includes('Installer status')`),'Desktop installer status is missing');
     for(const width of [320,768,1440]){await setViewport(width,width<640?844:1000,width<1024);await assertNoHorizontalOverflow(`Desktop downloads at ${width}px`);}
  }else{
    assert.equal(new URL(desktopUrl).protocol,'https:','Desktop download links must use HTTPS');
  }
  passed.push('Desktop action opens the download/status page or a secure configured installer URL');
  const publicInfoRoutes=[
    ['/documentation','Documentation'],
    ['/privacy','Privacy Policy'],
    ['/terms','Terms of Service'],
    ['/contact','Contact'],
    ['/copyright','Copyright and intellectual property'],
    ['/licenses','Third-party licenses and attributions'],
    ['/cookies','Cookies and storage notice'],
  ];
  for(const [route,title] of publicInfoRoutes){
    await call('Page.navigate',{url:`http://127.0.0.1:80${route}`});
    await wait(`location.pathname===${JSON.stringify(route)}`,`${route} route`);
    await wait(`document.querySelector('h1')?.textContent.toLowerCase().includes(${JSON.stringify(title.toLowerCase())})`,`${route} heading`);
    assert(await evaluate(`!!document.querySelector('footer a[href="/privacy"]')&&!!document.querySelector('footer a[href="/copyright"]')&&!!document.querySelector('footer a[href="/terms"]')&&!!document.querySelector('footer a[href="/documentation"]')`),`${route} is missing a required public policy/documentation footer link`);
    for(const width of [360,390,768,1366,1920]){await setViewport(width,width<640?844:1000,width<1024);await assertNoHorizontalOverflow(`${route} at ${width}px`);}
  }
  await call('Page.navigate',{url:'http://127.0.0.1:80/documentation'});
  await wait(`document.querySelector('[data-testid="input-documentation-search"]')`,'documentation search');
  await click('footer a[href="/privacy"]');
  await wait(`location.pathname==='/privacy'&&document.querySelector('h1')?.textContent.includes('Privacy Policy')`,'footer privacy link navigation');
  assert(await evaluate(`document.querySelector('[data-testid="legal-page-unpublished"]')?.textContent.includes('Privacy Policy is not yet published')`),'Privacy route must remain unpublished');
  assert(await evaluate(`document.querySelector('[data-testid="legal-page-unpublished"]')?.textContent.includes('Effective date: Pending owner and qualified legal approval')`),'Privacy effective date must remain pending');
  assert.equal(await evaluate(`document.body.innerText.includes('Owner review required before publishing')`),false,'Internal privacy draft must not be rendered on the public route');
  await call('Page.navigate',{url:'http://127.0.0.1:80/contact'});
  await wait(`document.querySelector('[data-testid="legal-page-unpublished"]')?.textContent.includes('No verified, monitored contact channel')`,'contact publication gate');
  await call('Page.navigate',{url:'http://127.0.0.1:80/copyright'});
  await wait(`document.querySelector('h1')?.textContent.includes('Copyright and intellectual property')`,'copyright page');
  assert(await evaluate(`document.body.innerText.includes('Draft for owner and legal review')&&document.body.innerText.includes('Rights-request contact: pending owner configuration')`),'Copyright page must remain visibly gated on owner review and a verified rights contact');
   assert(await evaluate(`document.body.innerText.includes('Ayatrisya is a product of Ametesx, as confirmed by its owner.')&&document.body.innerText.includes('does not by itself establish authorship, copyright assignment')`),'Copyright page must state the owner-confirmed product relationship without implying all assets are owned');
  await call('Page.navigate',{url:'http://127.0.0.1:80/documentation'});
  await wait(`document.querySelector('[data-testid="input-documentation-search"]')`,'documentation search after footer navigation');
  await input('[data-testid="input-documentation-search"]','loopback');
  await wait(`document.body.innerText.toLowerCase().includes('loopback')`,'documentation search results');
  passed.push('Documentation and legal routes load with shared footer links; Privacy stays unpublished with a pending effective date; Copyright remains a draft; responsive widths 360, 390, 768, 1366, and 1920px; documentation search works');
  await call('Page.navigate',{url:'http://127.0.0.1:80/'});
  await wait(`document.querySelector('a[aria-label="Get Ayatrisya Desktop"]')`,'landing page after desktop status check');
  const testEmail=process.env.AYATRISYA_TEST_EMAIL,testPassword=process.env.AYATRISYA_TEST_PASSWORD;
  if(!testEmail||!testPassword){
    await call('Page.navigate',{url:'http://127.0.0.1:80/workspace'});
    await wait(`location.pathname==='/auth/sign-in'`,'workspace account gate');
    await wait(`document.querySelector('[data-testid="input-email"]')`,'email sign-in form');
     for(const width of [320,768,1440]){await setViewport(width,width<640?844:1000,width<1024);await assertNoHorizontalOverflow(`Sign-in at ${width}px`);}
     await setViewport(1440,1000,false);
     assert(await evaluate(`document.body.innerText.includes('Continue as guest')`),'Guest access option is missing');
    await call('Page.navigate',{url:'http://127.0.0.1:80/auth/create-account'});
    await wait(`document.querySelector('[data-testid="input-confirm"]')`,'email/password account form');
     for(const width of [320,768,1440]){await setViewport(width,width<640?844:1000,width<1024);await assertNoHorizontalOverflow(`Create account at ${width}px`);}
     await setViewport(1440,1000,false);
    assert(await evaluate(`[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Continue with Google'))`),'Google sign-in button is missing');
    assert(await evaluate(`[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Continue with GitHub'))`),'GitHub sign-in button is missing');
    await call('Page.navigate',{url:'http://127.0.0.1:80/intro'});
    await wait(`location.pathname==='/auth/create-account'`,'legacy intro route redirect');
    await call('Page.navigate',{url:'http://127.0.0.1:80/onboarding'});
    await wait(`location.pathname==='/auth/sign-in'`,'onboarding account gate');
     await wait(`[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Continue as guest')`,'guest entry button');
     await clickText('Continue as guest');
     await wait(`location.pathname==='/workspace/chat'`,'guest workspace');
     await wait(`document.querySelector('.guest-workspace')`,'limited guest shell');
     assert(await evaluate(`document.body.innerText.includes('unlimited chats')`),'Guest chat allowance is missing');
     assert(await evaluate(`document.body.innerText.includes('2 images')`),'Guest image allowance is missing');
     assert.equal(await evaluate(`!!document.querySelector('[aria-label="Workspace mode"]')`),false,'Guest mode selector must stay hidden');
      await setViewport(320,844,true);
      await assertNoHorizontalOverflow('Guest workspace at 320px');
      await setViewport(390,844,true);
      await assertNoHorizontalOverflow('Guest workspace at 390px');
      await setViewport(768,1024,true);
      await assertNoHorizontalOverflow('Guest workspace at 768px');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guest-workspace>aside')).display`),'none','Guest sidebar should stay collapsed on tablet');
      assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.guest-workspace > div > nav[aria-label="Guest workspace"]')).display`),'none','Guest tab navigation should remain visible on tablet');
      await setViewport(1024,900,false);
      await assertNoHorizontalOverflow('Guest workspace at 1024px');
      assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.guest-workspace>aside')).display`),'none','Guest sidebar should appear on wide screens');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guest-workspace > div > nav[aria-label="Guest workspace"]')).display`),'none','Guest mobile tabs should hide on wide screens');
      await setViewport(1440,1000,false);
      await assertNoHorizontalOverflow('Guest workspace at 1440px');
      await setViewport(390,844,true);
     await wait(`document.querySelector('[data-testid="guest-new-chat"]')`,'mobile guest new-chat control');
     await click('[data-testid="guest-new-chat"]');
     await wait(`location.pathname.startsWith('/workspace/chat/')`,'mobile guest chat creation');
     await wait(`document.querySelectorAll('nav[aria-label="Guest workspace"] a[href^="/workspace/chat/"]').length>0`,'mobile recent guest chat');
     await call('Page.navigate',{url:'http://127.0.0.1:80/workspace/projects'});
     await wait(`location.pathname==='/workspace/chat'`,'guest feature restriction');
     await call('Page.navigate',{url:'http://127.0.0.1:80/workspace/images'});
     await wait(`document.body.innerText.includes('Two image generations')`,'guest image allowance page');
      assert(await evaluate(`document.querySelector('[data-testid="status-image"]')?.textContent.includes('No Ayatrisya image model is connected')`),'Unavailable image generation is not explained');
     await call('Page.reload');
     await wait(`document.querySelector('.guest-workspace')`,'persisted guest session');
    assert.deepEqual(uploads,[]);
    assert.deepEqual(errors,[]);
     passed.push('Guest access persists and is limited to chat and image generation; other workspace routes remain account-gated');
    console.log(JSON.stringify({passed,authenticatedWorkspaceChecks:'skipped: set AYATRISYA_TEST_EMAIL and AYATRISYA_TEST_PASSWORD in the test environment',privateUploads:uploads.length,browserErrors:errors},null,2));
  } else {
  await call('Page.navigate',{url:'http://127.0.0.1:80/auth/sign-in'});
  await wait(`document.querySelector('[data-testid="input-email"]')`,'test account sign-in form');
  await input('[data-testid="input-email"]',testEmail);
  await input('[data-testid="input-password"]',testPassword);
  await click('button[type="submit"]');
  await wait(`document.querySelector('[aria-label="Model"]')`,'authenticated workspace sign-in');
  const tag=Date.now().toString(36),chat=`Persistence ${tag}`,project=`Release ${tag}`,documentTitle=`Draft ${tag}`,body=`Saved body ${tag}`;
await go('/workspace');await wait(`document.body.innerText.toLowerCase().includes('personal workspace')`,'home dashboard');
await click('[data-testid="button-create-document"]');await wait(`location.pathname.startsWith('/workspace/documents/')`,'direct document creation');
await wait(`document.querySelector('[data-testid="input-content"]')`,'new document editor');
passed.push('Home dashboard shows real workspace state and creates a document directly');
await go('/workspace');await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))`);
await wait(`document.querySelector('[aria-label="Search your workspace"]')`,'command palette');
await input('[aria-label="Search your workspace"]','slides');await wait(`document.body.innerText.includes('Open presentations')`,'command keyword search');
await evaluate(`(()=>{const option=[...document.querySelectorAll('[role="option"]')].find(x=>x.textContent.includes('Open presentations'));if(!option)throw Error('Presentation command is missing');option.click()})()`);
await wait(`location.pathname==='/workspace/presentations'`,'presentation command navigation');
await go('/workspace');await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))`);
const prefRows=await savedPreferences();if(!prefRows.some(row=>row.id==='ui'&&row.value.recentCommands?.includes('presentations')))throw Error(`Command history was not persisted: ${JSON.stringify(prefRows)}`);
await wait(`document.body.innerText.toLowerCase().includes('recent commands')`,'recent commands');
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
await wait(`!document.querySelector('[role="dialog"]')`,'close command palette');
await setWorkspaceMode('focus');
await wait(`document.querySelector('.workspace-sidebar')?.getBoundingClientRect().width<1`,'focus navigation transition');
const focusWidth=await evaluate(`document.querySelector('.workspace-sidebar')?.getBoundingClientRect().width`);
if(focusWidth!==0)throw Error(`Focus mode did not collapse desktop navigation: width=${focusWidth}`);
await setWorkspaceMode('compact');
await delay(250);
await reloadPage();await wait(`document.querySelector('.workspace-shell')?.dataset.workspaceMode==='compact'`,'persisted workspace mode');
await setWorkspaceMode('standard');
await delay(250);
await setWorkspaceMode('developer');await wait(`document.querySelector('[aria-label="Developer diagnostics"]')`,'developer status');
await setWorkspaceMode('standard');
passed.push('Command search, recent commands, and persisted Focus/Compact workspace modes');
await go('/workspace');await click('[data-testid="button-new-chat"]');
  await wait(`location.pathname.startsWith('/workspace/chat/')`);
  const chatPath=await evaluate('location.pathname');
  await input('[data-testid="input-message"]',chat);await click('[data-testid="button-send"]');
  await wait(`document.querySelector('[data-testid="status-not-sent"]')`);
  await reloadPage();await wait(`document.querySelector('[data-testid^="message-"]')?.textContent.includes(${JSON.stringify(chat)})`);
  await click('[aria-label="Edit message"]');await input('#edit-msg',`${chat} edited`);await clickText('Save edit');
  await wait(`document.body.innerText.includes(${JSON.stringify(chat+' edited')})`);
  await setWorkspaceMode('studio');
  await wait(`[...document.querySelectorAll('*')].some(element=>element.classList.contains('max-w-[1100px]'))`,'studio chat width');
  await setWorkspaceMode('standard');
  passed.push('UI chat creation, local send, reload persistence and message edit');
  await go('/workspace/projects');await wait(`document.querySelector('[data-testid="button-new-project"]')`,'project page');await click('[data-testid="button-new-project"]');
  await wait(`document.querySelector('[data-testid="input-project-title"]')`);
  await input('[data-testid="input-project-title"]',project);await click('[data-testid="button-save-project"]');
  await wait(`document.body.innerText.includes(${JSON.stringify(project)})`);
  passed.push('UI project creation and listing');
  await go('/workspace/documents');await wait(`document.querySelector('[data-testid="button-new"]')`,'documents page');await click('[data-testid="button-new"]');
  await wait(`document.querySelector('[role="dialog"] input')`);await input('[role="dialog"] input',documentTitle);
  await click('[role="dialog"] button[type="submit"]');
  await wait(`document.querySelector('[data-testid="input-content"]')`);
  await input('[data-testid="input-content"]',body);await click('[data-testid="button-save"]');
  await wait(`document.querySelector('[data-testid="status-save"]')?.textContent==='Saved in this browser'`);
  const documentPath=await evaluate('location.pathname');
   await reloadPage();await wait(`document.querySelector('[data-testid="input-content"]')?.value===${JSON.stringify(body)}`);
  passed.push('UI document edit, save and reload persistence');
  const file=`${dir}/verification.txt`;
  await fs.writeFile(file,`Actual file bytes ${tag}`);await go('/workspace/library');
  await wait(`document.querySelector('input[type="file"]')`);await setFile('input[type="file"]',file);
  await wait(`document.body.innerText.includes('verification.txt')`);
  await go('/workspace/storage');await wait(`document.querySelector('[data-testid="storage-stats"]')`);
  const before=await counts();await clickText('Export backup');
  let backupPath;
  for(let n=0;n<100;n++){const found=(await fs.readdir(dir)).find(name=>name.startsWith('ayatrisya-backup-')&&name.endsWith('.json'));if(found){backupPath=`${dir}/${found}`;break;}await delay(100);}
  assert(backupPath,'Backup download missing');
  const backup=JSON.parse(await fs.readFile(backupPath,'utf8'));
  assert(backup.messages.some(message=>message.content===`${chat} edited`));
  assert(backup.items.some(item=>item.content===body));
  assert(backup.assets.some(asset=>Buffer.from(asset.base64,'base64').toString()===`Actual file bytes ${tag}`));
  passed.push('UI upload and backup download preserve real text and binary bytes');
  await setFile('[data-testid="input-import"]',backupPath);await wait(`document.querySelector('[role="dialog"]')`);
  await clickText('Merge');await wait(`!document.querySelector('[role="dialog"]')`);
  assert.deepEqual(await counts(),before);
  const malformed=`${dir}/malformed.json`;await fs.writeFile(malformed,'{"format":"invalid"}');
  await setFile('[data-testid="input-import"]',malformed);await wait(`document.body.innerText.includes('Not a valid backup')`);
  assert.deepEqual(await counts(),before);
  passed.push('UI duplicate Merge and malformed-import protection');
  await go('/workspace');await click('[data-testid="button-new-chat"]');
  await wait(`location.pathname.startsWith('/workspace/chat/')`);
  await go('/workspace/storage');await setFile('[data-testid="input-import"]',backupPath);
  await wait(`document.querySelector('[role="dialog"]')`);await clickText('Replace');
  await wait(`document.body.innerText.includes('This clears every record')`);await clickText('Replace');
  await wait(`!document.querySelector('[role="dialog"]')`);assert.deepEqual(await counts(),before);
  await go(chatPath);await wait(`document.body.innerText.includes(${JSON.stringify(chat+' edited')})`);
  await go(documentPath);await wait(`document.querySelector('[data-testid="input-content"]')?.value===${JSON.stringify(body)}`);
  passed.push('UI confirmed Replace removes new scratch records and restores originals');
  await go('/workspace/settings');
  await evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(x=>x.textContent.trim().startsWith('Theme'));const select=label.querySelector('select');select.value='Light';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.documentElement.dataset.appearance==='light'`);
  await fs.writeFile(`${dir}/light.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await go(chatPath);await setViewport(390,844,true);
  await click('[aria-label="Open navigation"]');await wait(`document.querySelector('aside[role="dialog"]')`);
  assert(await evaluate(`document.querySelector('aside').contains(document.activeElement)`));
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  await wait(`document.querySelector('aside').inert===true`);
  assert(await evaluate(`document.activeElement.getAttribute('aria-label')==='Open navigation'`));
  assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth && document.querySelector('[data-testid="input-message"]').getBoundingClientRect().bottom<=innerHeight`));
  await fs.writeFile(`${dir}/mobile.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  passed.push('Light theme, mobile drawer focus/Escape/inert, no overflow and visible composer');
   await setViewport(768,1024,true);await assertNoHorizontalOverflow('Workspace shell at 768px');
   assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('[aria-label="Open navigation"]')).display`),'none','Workspace drawer control should remain available on tablet');
   await setViewport(1024,900,false);await assertNoHorizontalOverflow('Workspace shell at 1024px');
   assert.equal(await evaluate(`getComputedStyle(document.querySelector('[aria-label="Open navigation"]')).display`),'none','Workspace drawer control should hide on wide screens');
   assert.equal(await evaluate(`getComputedStyle(document.querySelector('.workspace-sidebar')).position`),'relative','Workspace sidebar should become part of the wide-screen layout');
  assert.deepEqual(uploads,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed,counts:before,privateUploads:uploads.length,browserErrors:errors,screenshots:[`${dir}/light.png`,`${dir}/mobile.png`]},null,2));
  }
} catch(error) {
  console.error(JSON.stringify({failed:error.message,passed,errors},null,2));
  process.exitCode=1;
} finally {
  socket?.close();processHandle.kill('SIGTERM');
}
