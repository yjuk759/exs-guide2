// ===== 상태 =====
let state = {
  categories: [],
  manuals: [],
  admin: false,
  adminPassHash: null,
  search: ''
};

// ===== 유틸 =====
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

// ===== 저장 =====
const LS_KEYS = {
  cats: 'exs_categories',
  mans: 'exs_manuals',
  ver : 'exs_data_version' // manuals.json에 version 필드가 들어오면 비교
};

function saveToLocal(version=null){
  localStorage.setItem(LS_KEYS.cats, JSON.stringify(state.categories));
  localStorage.setItem(LS_KEYS.mans, JSON.stringify(state.manuals));
  if (version !== null && version !== undefined) {
    localStorage.setItem(LS_KEYS.ver, String(version));
  }
}

function loadFromLocal(){
  const c = localStorage.getItem(LS_KEYS.cats);
  const m = localStorage.getItem(LS_KEYS.mans);
  if(c){ try { state.categories = JSON.parse(c) || []; } catch(e){} }
  if(m){ try { state.manuals   = JSON.parse(m) || []; } catch(e){} }
}

function getLocalVersion(){
  return localStorage.getItem(LS_KEYS.ver);
}

// ===== 관리자 =====
// ▶ 중앙 모달로 로그인 처리
function enterAdmin(){
  showModal('관리자 로그인', `
    <div class="form-row full">
      <label>비밀번호</label>
      <input id="admin_pass" type="password" placeholder="관리자 비밀번호 입력">
    </div>
  `, () => {
    const pass = byId('admin_pass').value.trim();
    if (pass === 'exsadmin'){
      state.admin = true;
      byId('adminBar')?.classList.remove('hidden');
      render();
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  });

  // 입력창 자동 포커스 + Enter로 제출
  setTimeout(() => {
    const inp = byId('admin_pass');
    if (!inp) return;
    inp.focus();
    inp.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') byId('modalSubmit')?.click();
    });
  }, 0);
}

function exitAdmin(){
  state.admin = false;
  byId('adminBar')?.classList.add('hidden');
  render();
}

function showAddCategory(){
  showModal('카테고리 추가', `
    <div class="form-row"><div><label>카테고리 ID</label><input id="cat_id" placeholder="CAT_OPS"></div>
    <div><label>정렬순서</label><input id="cat_order" type="number" placeholder="1"></div></div>
    <div class="form-row full"><div><label>이름</label><input id="cat_name" placeholder="영업운영"></div></div>
    <div class="form-row full"><div><label>아이콘(이모지)</label><input id="cat_icon" placeholder="🧭"></div></div>
    <div class="info">ID는 manuals의 category_id와 연결됩니다.</div>
  `, () => {
    const id = byId('cat_id').value.trim();
    const order = Number(byId('cat_order').value||0);
    const name = byId('cat_name').value.trim();
    const icon = (byId('cat_icon')?.value.trim()) || '📄';
    if(!id || !name) return alert('ID와 이름은 필수입니다.');
    state.categories.push({id, name, order, icon});
    saveToLocal(getLocalVersion());
    render();
  });
}

function showAddManual(){
  const catOptions = state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
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
    saveToLocal(getLocalVersion());
    render();
  });
}

// ===== 관리자: 수정 =====
function showEditCategory(catId){
  const cat = state.categories.find(c=>c.id===catId);
  if(!cat) return alert('카테고리를 찾을 수 없습니다.');

  showModal('카테고리 수정', `
    <div class="form-row"><div><label>카테고리 ID</label><input id="cat_id" value="${cat.id}"></div>
    <div><label>정렬순서</label><input id="cat_order" type="number" value="${cat.order||0}"></div></div>
    <div class="form-row full"><div><label>이름</label><input id="cat_name" value="${cat.name}"></div></div>
    <div class="form-row full"><div><label>아이콘(이모지)</label><input id="cat_icon" value="${cat.icon||'📄'}"></div></div>
    <div class="info">ID 변경 시 이 카테고리에 연결된 매뉴얼의 category_id도 함께 변경됩니다.</div>
  `, () => {
    const newId   = byId('cat_id').value.trim();
    const newName = byId('cat_name').value.trim();
    const newOrd  = Number(byId('cat_order').value||0);
    const newIcon = byId('cat_icon').value.trim() || '📄';
    if(!newId || !newName) return alert('ID와 이름은 필수입니다.');

    const oldId = cat.id;

    // 카테고리 갱신
    cat.id    = newId;
    cat.name  = newName;
    cat.order = newOrd;
    cat.icon  = newIcon;

    // ID 바뀌면 연결 매뉴얼의 category_id 변경
    if (oldId !== newId) {
      state.manuals.forEach(m => { if (m.category_id === oldId) m.category_id = newId; });
    }

    saveToLocal(getLocalVersion());
    render();
  });
}

function showEditManual(manualId){
  const m = state.manuals.find(x=>x.id===manualId);
  if(!m) return alert('매뉴얼을 찾을 수 없습니다.');

  const catOptions = state.categories
    .map(c => `<option value="${c.id}" ${c.id===m.category_id?'selected':''}>${c.name}</option>`)
    .join('');

  showModal('매뉴얼 수정', `
    <div class="form-row"><div><label>문서 ID</label><input id="m_id" value="${m.id}"></div>
    <div><label>카테고리</label><select id="m_cat">${catOptions}</select></div></div>
    <div class="form-row full"><div><label>제목</label><input id="m_title" value="${m.title}"></div></div>
    <div class="form-row full"><div><label>요약</label><input id="m_summary" value="${m.summary||''}"></div></div>
    <div class="form-row full"><div><label>내용</label><textarea id="m_content" rows="6">${(m.content||'').replace(/</g,'&lt;')}</textarea></div></div>
    <div class="form-row"><div><label>태그(콤마)</label><input id="m_tags" value="${m.tags||''}"></div>
    <div><label>첨부 URL</label><input id="m_attach" value="${m.attachment_url||''}"></div></div>
  `, () => {
    const newId  = byId('m_id').value.trim();
    const catId  = byId('m_cat').value;
    const title  = byId('m_title').value.trim();
    if(!newId || !catId || !title) return alert('ID/카테고리/제목은 필수입니다.');

    m.id             = newId;
    m.category_id    = catId;
    m.title          = title;
    m.summary        = byId('m_summary').value.trim();
    m.content        = byId('m_content').value.trim();
    m.tags           = byId('m_tags').value.trim();
    m.attachment_url = byId('m_attach').value.trim();

    saveToLocal(getLocalVersion());
    navigate('manual', {id: m.id});
    render();
  });
}

// ===== 삭제 함수 =====
function deleteCategory(catId) {
  if (!confirm("이 카테고리를 삭제하시겠습니까? (관련 매뉴얼도 함께 삭제됩니다)")) return;
  state.categories = state.categories.filter(c => c.id !== catId);
  state.manuals = state.manuals.filter(m => m.category_id !== catId);
  saveToLocal(getLocalVersion());
  // 홈으로 이동
  navigate('home');
  render();
}

function deleteManual(manualId) {
  if (!confirm("이 매뉴얼을 삭제하시겠습니까?")) return;
  const m = state.manuals.find(x=>x.id===manualId);
  state.manuals = state.manuals.filter(m => m.id !== manualId);
  saveToLocal(getLocalVersion());
  // 해당 카테고리 목록으로 이동
  navigate('category', { id: m?.category_id || '' });
  render();
}

// (선택) 관리자에서 수동 초기화가 필요할 때 쓸 수 있는 버튼용
function resetLocal(){
  localStorage.removeItem(LS_KEYS.cats);
  localStorage.removeItem(LS_KEYS.mans);
  alert('로컬 데이터 초기화 완료. 서버 데이터를 다시 불러옵니다.');
  boot();
}

// ===== 모달 =====
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
    el.setAttribute('aria-hidden', 'true');
  });
}
function closeModal(e){ if(e.target && e.target.id === 'modal'){ hideModal(); } }

// ===== 렌더링 =====
function render(){
  const root = byId('app'); if(!root) return;
  root.innerHTML = '';
  const {page, params} = parseHash();
  if(page === 'home'){ renderHome(root); }
  else if(page === 'category'){ renderCategory(root, params.id); }
  else if(page === 'manual'){ renderManual(root, params.id); }
  else if(page === 'about'){ renderAbout(root); }
  else { renderHome(root); }

  const dbg = byId('dbgCounts');
  if (dbg) dbg.textContent = `카테고리 ${state.categories.length} · 매뉴얼 ${state.manuals.length}`;
}

function renderHome(root){
  const c = el('<div class="container"></div>');
  c.appendChild(el('<div class="page-title">카테고리</div>'));
  const grid = el('<div class="grid"></div>');
  const cats = [...state.categories].sort((a,b)=> (a.order||0)-(b.order||0));
  cats.forEach(cat => {
    const count = state.manuals.filter(m=>m.category_id===cat.id).length;
    const card = el(`<div class="card">
      <div class="badge">${cat.icon || '📁'}</div>
      <div class="title">${cat.name}</div>
      <div class="sub">${count}개 문서</div>
    </div>`);
    // 카드 눌렀을 때 이동
    card.onclick = ()=> navigate('category', {id: cat.id});

    // 관리자 미니버튼 (카드 클릭 막기 위해 stopPropagation)
    if (state.admin) {
      const adminRow = el(`<div class="admin-mini" style="margin-top:8px; display:flex; gap:6px;">
        <button class="mini ghost">수정</button>
        <button class="mini danger">삭제</button>
      </div>`);
      adminRow.children[0].onclick = (e)=>{ e.stopPropagation(); showEditCategory(cat.id); };
      adminRow.children[1].onclick = (e)=>{ e.stopPropagation(); deleteCategory(cat.id); };
      card.appendChild(adminRow);
    }

    grid.appendChild(card);
  });
  c.appendChild(grid);
  root.appendChild(c);
}

function renderCategory(root, catId){
  const cat = state.categories.find(x=>x.id===catId);
  const c = el('<div class="container"></div>');
  c.appendChild(el(`<div class="breadcrumbs"><a href="#" onclick="navigate('home')">홈</a> · ${cat ? cat.name : ''}</div>`));
  c.appendChild(el(`<div class="page-title">${cat ? cat.name : '카테고리'}</div>`));

  // 카테고리 헤더에도 관리자 버튼(선택)
  if (state.admin && cat) {
    const headerActions = el(`<div class="action-row" style="margin-bottom:10px;">
      <button class="button ghost">카테고리 수정</button>
      <button class="button danger">카테고리 삭제</button>
    </div>`);
    headerActions.children[0].onclick = ()=> showEditCategory(cat.id);
    headerActions.children[1].onclick = ()=> deleteCategory(cat.id);
    c.appendChild(headerActions);
  }

  const manuals = state.manuals.filter(m=>m.category_id===catId);
  const withScore = filterBySearch(manuals).map(m => ({...m, emergency: (m.tags||'').includes('긴급')}));
  withScore.sort((a,b)=> (b.emergency?1:0) - (a.emergency?1:0) || (a.title||'').localeCompare(b.title||''));

  const list = el('<div class="list"></div>');
  if (withScore.length === 0) {
    list.appendChild(el('<div class="item"><div class="sub">이 카테고리에 등록된 매뉴얼이 없습니다.</div></div>'));
  } else {
    withScore.forEach(m => {
      const item = el(`<div class="item">
        <div class="title">${m.title}</div>
        <div class="sub">${m.summary||''}</div>
        ${m.tags ? `<div class="chips">` + m.tags.split(',').map(t=>`<span class="chip">${t.trim()}</span>`).join('') + `</div>` : ''}
      </div>`);
      item.onclick = ()=> navigate('manual', {id: m.id});

      if (state.admin) {
        const adminRow = el(`<div class="admin-mini" style="margin-top:8px; display:flex; gap:6px;">
          <button class="mini ghost">수정</button>
          <button class="mini danger">삭제</button>
        </div>`);
        adminRow.children[0].onclick = (e)=>{ e.stopPropagation(); showEditManual(m.id); };
        adminRow.children[1].onclick = (e)=>{ e.stopPropagation(); deleteManual(m.id); };
        item.appendChild(adminRow);
      }

      list.appendChild(item);
    });
  }

  c.appendChild(list);
  root.appendChild(c);
}

function renderManual(root, id){
  const m = state.manuals.find(x=>x.id===id);
  const cat = m ? state.categories.find(c=>c.id===m.category_id) : null;
  const c = el('<div class="container"></div>');

  c.appendChild(el(
    `<div class="breadcrumbs">
       <a href="#" onclick="navigate('home')">홈</a> · 
       ${cat ? `<a href="#" onclick="navigate('category',{id:'${cat.id}'})">${cat.name}</a>` : '카테고리'}
     </div>`
  ));

  c.appendChild(el(`<div class="page-title">${m?m.title:'문서를 찾을 수 없습니다'}</div>`));

  if(m){
    const rt = el('<div></div>');
    m.content.split('\n').forEach(line => rt.appendChild(el('<p>'+line.replace(/\s/g,'&nbsp;')+'</p>')));
    c.appendChild(rt);

    const actions = el('<div class="action-row"></div>');
    if(m.attachment_url){
      const btn = el('<a class="button" target="_blank">첨부 열기</a>');
      btn.href = m.attachment_url;
      actions.appendChild(btn);
    }
    const share = el('<button class="button ghost">링크 복사</button>');
    share.onclick = ()=> { navigator.clipboard.writeText(location.href); alert('문서 링크가 복사되었습니다.'); };
    actions.appendChild(share);
    c.appendChild(actions);

    // 관리자 전용 수정/삭제
    if (state.admin) {
      const adminRow = el(`<div class="action-row">
        <button class="button ghost">수정</button>
        <button class="button danger">삭제</button>
      </div>`);
      adminRow.children[0].onclick = ()=> showEditManual(m.id);
      adminRow.children[1].onclick = ()=> deleteManual(m.id);
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

// ===== 부팅 (서버 우선, 성공 시 로컬 덮어쓰기) =====
async function boot(){
  // 0) 로컬 1차 렌더(있으면)
  loadFromLocal();
  render();

  // 1) 서버 최신 manuals.json (캐시 무력화)
  try {
    const res = await fetch('manuals.json?ts=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();

      const remoteVersion = (data && (data.version ?? data.exported_at)) || null;
      const localVersion  = getLocalVersion();

      if (Array.isArray(data.categories)) state.categories = data.categories;
      if (Array.isArray(data.manuals))    state.manuals    = data.manuals;

      saveToLocal(remoteVersion ?? localVersion ?? null);
      render();
    } else {
      console.warn('manuals.json fetch status:', res.status);
    }
  } catch (e) {
    console.warn('manuals.json fetch failed', e);
  }
}

// ===== 이벤트/시작 =====
window.addEventListener('click', (e) => {
  const m = byId('modal');
  if (m && !m.classList.contains('hidden') && e.target === m) { hideModal(); }
});
window.addEventListener('hashchange', render);
boot();

// ===== 전역 바인딩 =====
window.enterAdmin      = enterAdmin;
window.exitAdmin       = exitAdmin;
window.showAddCategory = showAddCategory;
window.showAddManual   = showAddManual;
window.exportData      = exportData;
window.resetLocal      = resetLocal;

window.showModal = showModal;
window.hideModal = hideModal;
window.closeModal= closeModal;

window.onSearch = onSearch;
window.navigate = navigate;

// 관리자용 편의: 전역 바인딩(수정/삭제)
window.showEditCategory = showEditCategory;
window.showEditManual   = showEditManual;
window.deleteCategory   = deleteCategory;
window.deleteManual     = deleteManual;
