import {createImageSession,createBrowserAdapters,probeBrowserCapabilities} from './image-session.mjs';
import {strings as zh} from './locales/zh-Hant.mjs';
import {strings as en} from './locales/en.mjs';
const el=id=>document.getElementById(id);
const t=document.documentElement.lang==='en'?en:zh;const {errors,messages}=t;
const number=new Intl.NumberFormat(t.locale);const formatBytes=bytes=>t.bytes(number.format(bytes),number.format(Math.round(bytes/1024)));
let capabilities={supported:false,webp:false};let session;let currentTab='source';let lastPreview='';let lastStatus='';
function activateTab(name,focus=false) {
  currentTab=name==='result'&&session?.snapshot().output?'result':'source';
  for(const tab of ['source','result']) {const active=tab===currentTab;el(`${tab}-tab`).setAttribute('aria-selected',String(active));el(`${tab}-tab`).tabIndex=active?0:-1;el(`${tab}-panel`).hidden=!active;}
  if(focus) el(`${currentTab}-tab`).focus();
}
function drawPreview(state) {
  const key=JSON.stringify([state.source,state.dimensions,state.settings.mime]);if(key===lastPreview) return;lastPreview=key;
  const canvas=el('preview');canvas.width=canvas.height=1;canvas.hidden=!state.source;
  el('empty').hidden=!!state.source;el('source-panel').classList.toggle('checker',!!state.source&&state.settings.mime!=='image/jpeg');
  if(!state.source) return;
  const dims=state.dimensions.ok?state.dimensions.value:state.source;
  const ratio=Math.min(1,1000/Math.max(dims.width,dims.height));canvas.width=Math.max(1,Math.round(dims.width*ratio));canvas.height=Math.max(1,Math.round(dims.height*ratio));
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  if(state.settings.mime==='image/jpeg') {ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);}
  const bitmap=session.sourceBitmap();if(bitmap) ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
}
function render(state) {
  const busy=['checking','decoding','encoding'].includes(state.status);
  el('file').disabled=!capabilities.supported||busy;el('fields').disabled=!state.source||busy;el('clear').disabled=!capabilities.supported||state.status==='idle'&&!state.source;
  el('cancel').hidden=!busy;el('generate').disabled=!state.source||busy||!state.dimensions.ok||!state.quality.ok;el('generate').textContent=state.status==='encoding'?t.generating:t.generate;
  el('generate').classList.toggle('primary',!!state.source&&state.status!=='success');
  el('drop-zone').setAttribute('aria-busy',String(busy));
  for(const [id,key] of [['mode','mode'],['size','value'],['format','mime'],['quality','quality']]) if(el(id).value!==state.settings[key]) el(id).value=state.settings[key];
  el('quality-field').hidden=state.settings.mime==='image/png';el('jpeg-note').hidden=state.settings.mime!=='image/jpeg';el('webp-note').hidden=capabilities.webp;
  for(const [id,valid,errorCode] of [['size',state.dimensions.ok,'SIZE_INVALID'],['quality',state.quality.ok,'QUALITY_INVALID']]) {
    const invalid=!!state.source&&!valid;el(id).setAttribute('aria-invalid',String(invalid));el(`${id}-error`).hidden=!invalid;el(`${id}-error`).textContent=invalid?errors[errorCode]:'';
  }
  el('filename').textContent=state.source?.name||'';
  el('source-info').textContent=state.source?`${t.original} ${number.format(state.source.width)} × ${number.format(state.source.height)} px · ${state.source.format.toUpperCase()}`:t.noSource;
  el('dimensions').textContent=state.source?(state.dimensions.ok?`${t.output} ${number.format(state.dimensions.value.width)} × ${number.format(state.dimensions.value.height)} px`:t.fixDimensions):t.noDimensions;
  drawPreview(state);
  el('result-tab').disabled=!state.output;el('download').disabled=!state.output;el('result-summary').hidden=!state.output;
  if(state.output) {
    if(el('result-image').getAttribute('src')!==state.output.url) el('result-image').src=state.output.url;
    el('output-info').textContent=`${state.output.mime} · ${number.format(state.output.width)} × ${number.format(state.output.height)} px · ${formatBytes(state.output.bytes)}`;
    el('fallback').hidden=state.notice!=='FORMAT_FALLBACK';el('fallback').textContent=state.notice==='FORMAT_FALLBACK'?t.fallback:'';
    if(state.status==='success'&&lastStatus!==`${state.id}:success`) activateTab('result');
  } else {el('result-image').removeAttribute('src');el('output-info').textContent='';el('fallback').textContent='';activateTab('source');}
  const statusKey=`${state.id}:${state.status}:${state.code}:${state.notice}`;
  if(lastStatus!==statusKey) {
    el('status').textContent=state.code?errors[state.code]:state.notice==='CANCELLED'?messages.cancelled:state.status==='success'?t.success(number.format(state.output.width),number.format(state.output.height),state.output.extension.toUpperCase(),formatBytes(state.output.bytes)):messages[state.status]||messages.idle;
    el('status').classList.toggle('error',!!state.code);lastStatus=statusKey;
  }
  document.documentElement.dataset.state=state.status;
  if(state.status==='idle') el('file').value='';
}
async function init() {
  capabilities=await probeBrowserCapabilities();
  el('webp-option').disabled=!capabilities.webp;
  session=createImageSession({...createBrowserAdapters(),webp:capabilities.webp,onChange:render});
  if(!capabilities.supported) {session.reject('BROWSER_UNSUPPORTED');return;}
  render(session.snapshot());
  el('file').addEventListener('change',event=>{const files=Array.from(event.target.files||[]);if(files.length) session.select(files);});
  el('clear').addEventListener('click',()=>{session.clear();el('file').value='';el('file').focus();});
  el('cancel').addEventListener('click',()=>{session.cancel();if(session.snapshot().source) el('generate').focus();else el('file').focus();});
  el('settings').addEventListener('submit',event=>{event.preventDefault();session.generate();});
  for(const [id,key] of [['mode','mode'],['size','value'],['format','mime'],['quality','quality']]) el(id).addEventListener(['size','quality'].includes(id)?'input':'change',()=>session.update({[key]:el(id).value}));
  el('download').addEventListener('click',()=>{const output=session.snapshot().output;if(!output) return;const link=document.createElement('a');link.href=output.url;link.download=output.filename;link.click();});
  for(const name of ['source','result']) {
    el(`${name}-tab`).addEventListener('click',()=>activateTab(name));
    el(`${name}-tab`).addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;event.preventDefault();activateTab(event.key==='Home'?'source':event.key==='End'?'result':currentTab==='source'?'result':'source',true);});
  }
  document.addEventListener('dragover',event=>{event.preventDefault();if(!['checking','decoding','encoding'].includes(session.snapshot().status)) el('drop-zone').classList.add('drag-active');});
  document.addEventListener('dragleave',()=>el('drop-zone').classList.remove('drag-active'));
  document.addEventListener('drop',event=>{
    event.preventDefault();el('drop-zone').classList.remove('drag-active');if(['checking','decoding','encoding'].includes(session.snapshot().status)) return;
    const files=Array.from(event.dataTransfer?.files||[]);const items=Array.from(event.dataTransfer?.items||[]);
    if(files.length>1) session.reject('MULTIPLE_FILES');else if(!files.length||items.some(item=>item.kind!=='file')) session.reject('FORMAT_UNSUPPORTED');else session.select(files);
  });
  window.addEventListener('pagehide',()=>session.clear());
}
init().catch(()=>{el('status').textContent=errors.BROWSER_UNSUPPORTED;document.documentElement.dataset.state='unsupported';});
