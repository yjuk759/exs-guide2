// ---- 강제 리셋 핸들러 (?reset=1로 진입하면 SW/캐시/로컬 초기화) ----
(function(){
  try {
    const url = new URL(location.href);
    if (url.searchParams.get('reset') === '1') {
      // 1) 서비스워커 해제
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
      }
      // 2) 캐시 비우기
      if (window.caches) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      }
      // 3) 로컬 데이터 초기화 (카테고리/매뉴얼)
      localStorage.removeItem('exs_categories');
      localStorage.removeItem('exs_manuals');
      // 4) 부트 파라미터로 강제 새로고침
      const clean = location.origin + location.pathname + '?boot=' + Date.now();
      location.replace(clean);
    }
  } catch(e){ /* noop */ }
})();

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
// ▶ prompt() 대신 중앙 모달로 로그인 처리
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
      if (e.key === 'Enter') {
        byId('modalSubmit')?.click();
      }
    });
  }, 0);
}

function exitAdmin(){
  state.admin = false;
  byId('adminBar')?.classList.add('hidden');
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

function exportData(){
  const now = new Date();
  
  // 사람이 보기 좋은 버전 문자열 (예: 20250924-153045)
  const version = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-' 
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');

  const data = { 
    version: version,                  // 새로 추가
    categories: state.categories, 
    manuals: state.manuals, 
    exported_at: now.toISOString()     // 기존 ISO 형식도 유지
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'manuals.json';
  a.click();
  URL.revokeObjectURL(url);

  alert('manuals.json 파일이 다운로드되었습니다. 이 파일을 저장소에 덮어쓰면 즉시 반영됩니다.');
}

// (선택) 관리자에서 수동 초기화가 필요할 때 쓸 수 있는 버튼용
function resetLocal(){
  localStorage.removeItem(LS_KEYS.cats);
  localStorage.removeItem(LS_KEYS.mans);
  // 버전은 유지(서버와 비교를 위해)
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

  // (선택) 디버그 카운트가 있으면 표시
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
    card.onclick = ()=> navigate('category', {id: cat.id});
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

  // 빵부스러기: ID 절대 노출 안 함
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
  // 0) 우선 빈화면 방지를 위해 로컬로 1차 렌더 (있으면)
  loadFromLocal();
  render();

  // 1) 서버에서 항상 최신 manuals.json 가져오기 (캐시 무력화)
  try {
    const res = await fetch('manuals.json?ts=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();

      // (선택) manuals.json에 version 필드가 있으면 비교해서 다르면 로컬 덮어쓰기
      const remoteVersion = (data && (data.version ?? data.exported_at)) || null;
      const localVersion  = getLocalVersion();

      // 서버 데이터로 상태 갱신 (항상 서버 우선)
      if (Array.isArray(data.categories)) state.categories = data.categories;
      if (Array.isArray(data.manuals))    state.manuals    = data.manuals;

      // 로컬 저장 + 버전 갱신
      saveToLocal(remoteVersion ?? localVersion ?? null);

      // 최신 데이터로 재렌더
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
window.resetLocal      = resetLocal; // 선택 사용

window.showModal = showModal;
window.hideModal = hideModal;
window.closeModal= closeModal;

window.onSearch = onSearch;
window.navigate = navigate;
