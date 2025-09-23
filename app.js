// Simple PWA manual app with in-memory admin edits + export
// ===== 상태 =====
let state = {
  categories: [],
  manuals: [],
  admin: false,
  adminPassHash: null,
  search: ''
};

// --- 유틸 ---
function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }
function byId(id){ return document.getElementById(id); }
function navigate(page, params={}){ window.location.hash = page + (Object.keys(params).length ? ('?' + new URLSearchParams(params).toString()) : ''); }
function parseHash(){
  const h = window.location.hash.replace(/^#/, '') || 'home';
  const [page, query] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return {page, params};
}
function onSearch(val){ state.search = (val||'').trim().toLowerCase(); render(); }
function filterBySearch(list){
  if(!state.search) return list;
  return list.filter(x => ((x.title||'')+(x.summary||'')+(x.tags||'')).toLowerCase().includes(state.search));
}
function saveToLocal(){
  localStorage.setItem('exs_categories', JSON.stringify(state.categories));
  localStorage.setItem('exs_manuals', JSON.stringify(state.manuals));
}
function loadFromLocal(){
  const c = localStorage.getItem('exs_categories');
  const m = localStorage.getItem('exs_manuals');
  if(c && m){ try { state.categories = JSON.parse(c); state.manuals = JSON.parse(m); } catch(e){} }
}

// --- 관리자 ---
function enterAdmin(){
  const pass = prompt('관리자 비밀번호를 입력하세요 (임시: exsadmin)');
  if(pass === 'exsadmin'){
    state.admin = true;
    const bar = byId('adminBar');
    if (bar) bar.classList.remove('hidden');
  } else {
    alert('비밀번호가 올바르지 않습니다.');
  }
}
function exitAdmin(){
  state.admin = false;
  const bar = byId('adminBar');
  if (bar) bar.classList.add('hidden');
}

function showAddCategory(){
  showModal('카테고리 추가', `
    <div class="form-row"><div><label>카테고리 ID</label><input id="cat_id" placeholder="CAT_OPS"></div>
    <div><label>정렬순서</label><input id="cat_order" type="number" placeholder="1"></div></div>
    <div class="form-row"><div><label>이름</label><input id="cat_name" placeholder="영업운영"></div>
    <div class="form-row"><div><label>아이콘(이모지)</label><input id="cat_icon" placeholder="🧭"></div></div>
    <div class="info">ID는 manuals의 category_id와 연결됩니다.</div>
  `, () => {
    const id = byId('cat_id').value.trim();
    const order = Number(byId('cat_order').value||0);
    const name = byId('cat_name').value.trim();
    const icon = (byId('cat_icon')?.value.trim()) || '📄';
    if(!id || !name) return alert('ID와 이름은 필수입니다.');
    state.categories.push({id, name, order, icon});
    saveToLocal();
    render();
  });
}

function showAddManual(){
  const catOptions = state.categories.map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('');
  showModal('매뉴얼 추가', `
    <div class="form-row"><div><label>문서 ID</label><input id="m_id" placeholder="MNL_OPS_003"></div>
    <div><label>카테고리</label><select id="m_cat">${catOptions}</select></div></div>
    <div class="form-row full"><div><label>제목</label><input id="m_title" placeholder="통행권 분실 처리 절차"></div></div>
    <div class="form-row full"><div><label>요약</label><input id="m_summary" placeholder="차량번호 확인 및 임시통행권"></div></div>
    <div class="form-row full"><div><label>내용</label><textarea id="m_content" rows="6" placeholder="1) 확인 ... 2) 발급 ..."></textarea></div></div>
    <div class="form-row"><div><label>태그(콤마)</label><input id="m_tags" placeholder="분실, 임시통행권, 민원"></div>
    <div><label>첨부 URL</label><input id="m_attach" placeholder="https://...pdf"></div></div>
  `, () => {
    const id = byId('m_id').value.trim();
    const category_id = byId('m_cat').value;
    const title = byId('m_title').value.trim();
    const summary = byId('m_summary').value.trim();
    const content = byId('m_content').value.trim();
    const tags = byId('m_tags').value.trim();
    const attachment_url = byId('m_attach').value.trim();
    if(!id || !category_id || !title) return alert('ID, 카테고리, 제목은 필수입니다.');
    state.manuals.push({id, category_id, title, summary, content, tags, attachment_url});
    saveToLocal();
    render();
  });
}

function exportData(){
  const data = { categories: state.categories, manuals: state.manuals, exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'manuals.json';
  a.click();
  URL.revokeObjectURL(url);
  alert('manuals.json 파일이 다운로드되었습니다. 이 파일을 저장소에 덮어쓰면 즉시 반영됩니다.');
}

// --- 수정/삭제 기능 ---
function showEditCategory(catId){
  const c = state.categories.find(x=>x.id===catId);
  if(!c) return alert('카테고리를 찾을 수 없습니다.');
  showModal('카테고리 수정', `
    <div class="form-row"><div><label>ID</label><input value="${c.id}" disabled></div>
    <div><label>정렬순서</label><input id="cat_order" type="number" value="${c.order||0}"></div></div>
    <div class="form-row"><div><label>이름</label><input id="cat_name" value="${c.name||''}"></div>
    <div><label>아이콘</label><input id="cat_icon" value="${c.icon||''}"></div></div>
  `, () => {
    c.name = byId('cat_name').value.trim();
    c.icon = byId('cat_icon').value.trim();
    c.order = Number(byId('cat_order').value||0);
    saveToLocal(); render();
  });
}
function deleteCategory(catId){
  if(!confirm('해당 카테고리와 소속 매뉴얼을 모두 삭제할까요?')) return;
  state.manuals = state.manuals.filter(m=>m.category_id!==catId);
  state.categories = state.categories.filter(c=>c.id!==catId);
  saveToLocal(); render();
}
function showEditManual(mId){
  const m = state.manuals.find(x=>x.id===mId);
  if(!m) return alert('문서를 찾을 수 없습니다.');
  const catOptions = state.categories.map(c =>
    `<option value="${c.id}" ${c.id===m.category_id?'selected':''}>${c.name} (${c.id})</option>`).join('');
  showModal('매뉴얼 수정', `
    <div class="form-row"><div><label>ID</label><input value="${m.id}" disabled></div>
    <div><label>카테고리</label><select id="m_cat">${catOptions}</select></div></div>
    <div class="form-row full"><div><label>제목</label><input id="m_title" value="${m.title||''}"></div></div>
    <div class="form-row full"><div><label>요약</label><input id="m_summary" value="${m.summary||''}"></div></div>
    <div class="form-row full"><div><label>내용</label><textarea id="m_content" rows="6">${m.content||''}</textarea></div></div>
    <div class="form-row"><div><label>태그</label><input id="m_tags" value="${m.tags||''}"></div>
    <div><label>첨부 URL</label><input id="m_attach" value="${m.attachment_url||''}"></div></div>
  `, () => {
    m.category_id = byId('m_cat').value;
    m.title = byId('m_title').value.trim();
    m.summary = byId('m_summary').value.trim();
    m.content = byId('m_content').value.trim();
    m.tags = byId('m_tags').value.trim();
    m.attachment_url = byId('m_attach').value.trim();
    saveToLocal(); render();
  });
}
function deleteManual(mId){
  if(!confirm('이 문서를 삭제할까요?')) return;
  state.manuals = state.manuals.filter(x=>x.id!==mId);
  saveToLocal(); render();
}

// --- 모달 ---
function showModal(title, bodyHTML, onSubmit){
  const modal = byId('modal');
  const body = byId('modalBody');
  const titleEl = byId('modalTitle');
  const submit = byId('modalSubmit');
  if(!modal || !body || !titleEl || !submit){ console.warn('Modal DOM not found'); return; }
  titleEl.textContent = title || '입력';
  body.innerHTML = bodyHTML || '';
  submit.onclick = () => { try { onSubmit && onSubmit(); } finally { hideModal(); } };
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.removeAttribute('aria-hidden');
}
function hideModal(){
  const m = byId('modal');
  if (m) {
    m.classList.add('hidden');
    m.style.display = 'none';
    m.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('.modal').forEach(el => {
    el.classList.add('hidden');
    el.style.display = 'none';
  });
}
function closeModal(e){ if(e.target && e.target.id === 'modal'){ hideModal(); } }

// --- 렌더링 ---
function render(){
  const root = byId('app'); if(!root) return;
  root.innerHTML = '';
  const {page, params} = parseHash();
  if(page === 'home'){ renderHome(root); }
  else if(page === 'category'){ renderCategory(root, params.id); }
  else if(page === 'manual'){ renderManual(root, params.id); }
  else if(page === 'about'){ renderAbout(root); }
  else { renderHome(root); }
}
function renderHome(root){
  const c = el('<div class="container"></div>');
  c.appendChild(el('<div class="page-title">카테고리</div>'));
  const grid = el('<div class="grid"></div>');
  const cats = [...state.categories].sort((a,b)=> (a.order||0)-(b.order||0));
  cats.forEach(cat => {
    const card = el(`<div class="card">
      <div class="badge">${cat.icon||'📁'} ${cat.id}</div>
      <div class="title">${cat.name}</div>
      <div class="sub">${(state.manuals.filter(m=>m.category_id===cat.id).length)}개 문서</div>
    </div>`);
    card.onclick = ()=> navigate('category', {id: cat.id});
    // 관리자 전용 버튼
    if(state.admin){
      const actions = el('<div class="action-row"></div>');
      const eBtn = el('<button class="button ghost">수정</button>');
      eBtn.onclick = ev=>{ ev.stopPropagation(); showEditCategory(cat.id); };
      const dBtn = el('<button class="button">삭제</button>');
      dBtn.onclick = ev=>{ ev.stopPropagation(); deleteCategory(cat.id); };
      actions.appendChild(eBtn); actions.appendChild(dBtn);
      card.appendChild(actions);
    }
    grid.appendChild(card);
  });
  c.appendChild(grid); root.appendChild(c);
}
function renderCategory(root, catId){
  const cat = state.categories.find(x=>x.id===catId);
  const c = el('<div class="container"></div>');
  c.appendChild(el(`<div class="breadcrumbs"><a href="#" onclick="navigate('home')">홈</a> · ${cat ? cat.name : catId}</div>`));
  c.appendChild(el(`<div class="page-title">${cat ? cat.name : catId}</div>`));
  const manuals = state.manuals.filter(m=>m.category_id===catId);
  const withScore = filterBySearch(manuals).map(m => ({...m, emergency:(m.tags||'').includes('긴급')}));
  withScore.sort((a,b)=> (b.emergency?1:0)-(a.emergency?1:0) || (a.title||'').localeCompare(b.title||''));
  const list = el('<div class="list"></div>');
  withScore.forEach(m => {
    const item = el(`<div class="item">
      <div class="title">${m.title}</div>
      <div class="sub">${m.summary||''}</div>
      ${m.tags ? `<div class="chips">`+m.tags.split(',').map(t=>`<span class="chip">${t.trim()}</span>`).join('')+`</div>`:''}
    </div>`);
    item.onclick = ()=> navigate('manual',{id:m.id});
    if(state.admin){
      const actions = el('<div class="action-row"></div>');
      const eBtn = el('<button class="button ghost">수정</button>');
      eBtn.onclick = ev=>{ ev.stopPropagation(); showEditManual(m.id); };
      const dBtn = el('<button class="button">삭제</button>');
      dBtn.onclick = ev=>{ ev.stopPropagation(); deleteManual(m.id); };
      actions.appendChild(eBtn); actions.appendChild(dBtn);
      item.appendChild(actions);
    }
    list.appendChild(item);
  });
  c.appendChild(list); root.appendChild(c);
}
function renderManual(root, id){
  const m = state.manuals.find(x=>x.id===id);
  const cat = m ? state.categories.find(c=>c.id===m.category_id) : null;
  const c = el('<div class="container"></div>');
  c.appendChild(el(`<div class="breadcrumbs"><a href="#" onclick="navigate('home')">홈</a> · <a href="#" onclick="navigate('category',{id:'${cat?cat.id:''}'})">${cat?cat.name:m?.category_id||''}</a></div>`));
  c.appendChild(el(`<div class="page-title">${m?m.title:'문서를 찾을 수 없습니다'}</div>`));
  if(m){
    const rt = el('<div></div>');
    m.content.split('\n').forEach(line=> rt.appendChild(el('<p>'+line.replace(/\s/g,'&nbsp;')+'</p>')));
    c.appendChild(rt);
    const actions = el('<div class="action-row"></div>');
    if(m.attachment_url){
      const btn = el('<a class="button" target="_blank">첨부 열기</a>'); btn.href=m.attachment_url; actions.appendChild(btn);
    }
    const share = el('<button class="button ghost">링크 복사</button>');
    share.onclick = ()=>{ navigator.clipboard.writeText(location.href); alert('문서 링크가 복사되었습니다.'); };
    actions.appendChild(share);
    c.appendChild(actions);
    if(state.admin){
      const adminRow = el('<div class="action-row"></div>');
      const eBtn = el('<button class="button ghost">문서 수정</button>');
      eBtn.onclick = ()=> showEditManual(m.id);
      const dBtn = el('<button class="button">문서 삭제</button>');
      dBtn.onclick = ()=> deleteManual(m.id);
      adminRow.appendChild(eBtn); adminRow.appendChild(dBtn);
      c.appendChild(adminRow);
    }
  }
  root.appendChild(c);
}
function renderAbout(root){
  const c = el('<div class="container"></div>');
  c.appendChild(el('<div class="page-title">앱 정보</div>'));
  c.appendChild(el('<p>EXS Guide — 영업운영 · 민원응대 · 긴급상황 매뉴얼 뷰어</p>'));
  c.appendChild(el('<p>오프라인 사용: 최근 본 화면은 캐시되어 네트워크 불안정 시에도 열람 가능합니다.</p>'));
  root.appendChild(c);
}

// --- 부팅 ---
async function boot(){
  loadFromLocal();
  try{
    if(state.categories.length===0 || state.manuals.length===0){
      const res = await fetch('manuals.json?ts=' + Date.now());
      const data = await res.json();
      state.categories = data.categories || [];
      state.manuals = data.manuals || [];
      saveToLocal();
    }
  }catch(e){ console.warn('manuals.json load failed', e); }
  render();
}
window.addEventListener('click',(e)=>{ const m=byId('modal'); if(m&&!m.classList.contains('hidden')&&e.target===m){hideModal();}});
window.addEventListener('hashchange', render);
boot();

// --- 전역 바인딩 ---
window.enterAdmin=enterAdmin;
window.exitAdmin=exitAdmin;
window.showAddCategory=showAddCategory;
window.showAddManual=showAddManual;
window.exportData=exportData;
window.showEditCategory=showEditCategory;
window.deleteCategory=deleteCategory;
window.showEditManual=showEditManual;
window.deleteManual=deleteManual;
window.showModal=showModal;
window.hideModal=hideModal;
window.closeModal=closeModal;
window.onSearch=onSearch;
window.navigate=navigate;
