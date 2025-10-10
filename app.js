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

function onSearch(){
  const val = byId('searchInput').value.trim().toLowerCase();
  state.search = val;

  if (state.search) {
    const {page} = parseHash();
    if (page === 'search') {
      // 이미 검색 페이지라면 다시 그리기
      render();
    } else {
      navigate('search');
    }
  } else {
    navigate('home');
  }
}

function filterBySearch(list){
  if(!state.search) return list;
  return list.filter(x => ((x.title||'')+(x.summary||'')+(x.tags||'')).toLowerCase().includes(state.search));
}

// ===== 하위 카테고리 포함 매뉴얼 개수 계산 =====
function getDescendantIds(catId){
  const ids = [catId];
  for (let i = 0; i < ids.length; i++){
    const cur = ids[i];
    state.categories.forEach(c=>{
      if (c.parent_id === cur) ids.push(c.id);
    });
  }
  return ids;
}

function countManualsInTree(catId){
  const ids = new Set(getDescendantIds(catId));
  return state.manuals.reduce((acc, m)=> acc + (ids.has(m.category_id) ? 1 : 0), 0);
}

// 여러 첨부 URL 지원: m.attachments (배열) 또는 m.attachment_url(콤마 구분)을 통합 파싱
function getAttachments(m){
  if (!m) return [];
  if (Array.isArray(m.attachments)) {
    return m.attachments
      .filter(x => x && x.url)
      .map((x, i) => ({
        title: (x.title && String(x.title).trim()) || `첨부${i+1}`,
        url: String(x.url).trim()
      }));
  }
  const raw = (m.attachment_url || '').trim();
  if (!raw) return [];
  const urls = raw.split(',').map(s => s.trim()).filter(Boolean);
  return urls.map((u, i) => ({ title: `첨부${i+1}`, url: u }));
}

// ===== 트리/카운트 유틸 =====

// 잘못된 parent_id 정리: '', '최상위', undefined, 자기 자신, 존재하지 않는 부모 -> null
function normalizeCategories() {
  const ids = new Set(state.categories.map(c => c.id));
  for (const c of state.categories) {
    let p = c.parent_id;
    if (p === '' || p === undefined || p === '최상위') p = null;
    if (p === c.id) p = null;                 // self parent 금지
    if (p != null && !ids.has(p)) p = null;   // 존재하지 않는 부모 금지
    c.parent_id = p;
  }
}

function buildChildrenMap() {
  const map = new Map();  // parent_id -> childIds
  map.set(null, []);
  for (const c of state.categories) {
    const p = (c.parent_id == null) ? null : c.parent_id;
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(c.id);
    if (!map.has(c.id)) map.set(c.id, []); // 자식 버킷도 미리
  }
  return map;
}

// 순환 방지: seen 사용 (for..of 사용)
function getDescendants(rootId, childrenMap) {
  const out = [];
  const stack = [rootId];
  const seen = new Set([rootId]);
  while (stack.length) {
    const cur = stack.pop();
    const kids = childrenMap.get(cur) || [];
    for (const k of kids) {
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
      stack.push(k);
    }
  }
  return out;
}

// 하위 포함 매뉴얼 개수
function countManualsInTree(catId) {
  const childrenMap = buildChildrenMap();
  const allIds = new Set([catId, ...getDescendants(catId, childrenMap)]);
  let n = 0;
  for (const m of state.manuals) {
    if (allIds.has(m.category_id)) n++;
  }
  return n;
}

// ===== 저장 =====
const LS_KEYS = {
  cats: 'exs_categories',
  mans: 'exs_manuals',
  ver : 'exs_data_version', // manuals.json에 version 필드가 들어오면 비교
  admin: 'exs_admin'        // ✅ 관리자 상태 저장용 키
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

function loadAdminFromLocal(){
  const a = localStorage.getItem(LS_KEYS.admin);
  state.admin = (a === '1');   // 값이 "1"이면 관리자 모드
  if (state.admin) {
    byId('adminBar')?.classList.remove('hidden');
  }
}

// ===== 관리자 =====
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
      localStorage.setItem(LS_KEYS.admin, '1');   // 로그인 상태 저장
      byId('adminBar')?.classList.remove('hidden');
      render();
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  });

  setTimeout(() => {
    const inp = byId('admin_pass');
    if (!inp) return;
    inp.focus();
    inp.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') byId('modalSubmit')?.click(); });
  }, 0);
}

function exitAdmin(){
  state.admin = false;
  localStorage.removeItem(LS_KEYS.admin);   // 로그인 상태 해제
  byId('adminBar')?.classList.add('hidden');
  render();
}

function showAddCategory(){
  const parentOptions = ['<option value="">(최상위)</option>']
    .concat(state.categories.map(c => `<option value="${c.id}">${c.name}</option>`))
    .join('');

  showModal('카테고리 추가', `
    <div class="form-row">
      <div><label>카테고리 ID</label><input id="cat_id" placeholder="CAT_OPS"></div>
      <div><label>정렬순서</label><input id="cat_order" type="number" placeholder="1"></div>
    </div>
    <div class="form-row full"><div><label>이름</label><input id="cat_name" placeholder="영업운영"></div></div>
    <div class="form-row full"><div><label>아이콘(이모지)</label><input id="cat_icon" placeholder="🧭"></div></div>
    <div class="form-row full"><div><label>부모 카테고리</label><select id="cat_parent">${parentOptions}</select></div></div>
    <div class="info">ID는 manuals의 category_id와 연결됩니다.</div>
  `, () => {
    const id = byId('cat_id').value.trim();
    const order = Number(byId('cat_order').value||0);
    const name = byId('cat_name').value.trim();
    const icon = (byId('cat_icon')?.value.trim()) || '📄';
    let parent_id = byId('cat_parent').value.trim() || null;   // ← let 로 받기

    if(!id || !name) return alert('ID와 이름은 필수입니다.');

    // ✅ 자기 자신을 부모로 저장하려고 하면 막기
    if (parent_id === id) {
      alert('부모 카테고리에 자기 자신은 선택할 수 없습니다. (최상위로 저장됩니다)');
      parent_id = null;
    }

    state.categories.push({id, name, order, icon, parent_id});
    saveToLocal(getLocalVersion());
    render();
  });
}


function showAddManual(){
  const catOptions = state.categories
    .map(c => `<option value="${c.id}">${c.name}</option>`)
    .join('');

  showModal('매뉴얼 추가', `
    <div class="form-row">
      <div>
        <label>문서 ID</label>
        <input id="m_id" placeholder="MNL_OPS_003">
      </div>
      <div>
        <label>카테고리</label>
        <select id="m_cat">${catOptions}</select>
      </div>
    </div>

    <div class="form-row full">
      <div>
        <label>제목</label>
        <input id="m_title" placeholder="통행권 분실 처리 절차">
      </div>
    </div>

    <div class="form-row full">
      <div>
        <label>요약</label>
        <input id="m_summary" placeholder="차량번호 확인 및 임시통행권">
      </div>
    </div>

    <div class="form-row full">
      <div>
        <label>내용</label>
        <textarea id="m_content" rows="6" placeholder="1) 확인 ... 2) 발급 ..."></textarea>
      </div>
    </div>

    <div class="form-row">
      <div>
        <label>태그(콤마)</label>
        <input id="m_tags" placeholder="분실, 임시통행권, 민원">
      </div>
      <div>
        <label>첨부 URL (여러 개면 , 로 구분)</label>
        <input id="m_attach" placeholder="https://a.pdf, https://b.pdf">
      </div>
    </div>
  `, () => {
    const id = byId('m_id').value.trim();
    const category_id = byId('m_cat').value;
    const title = byId('m_title').value.trim();
    const summary = byId('m_summary').value.trim();
    const content = byId('m_content').value.trim();
    const tags = byId('m_tags').value.trim();
    const attachment_url = byId('m_attach').value.trim();

    if(!id || !category_id || !title){
      alert('ID, 카테고리, 제목은 필수입니다.');
      return;
    }

    state.manuals.push({ id, category_id, title, summary, content, tags, attachment_url });
    saveToLocal(getLocalVersion());
    render();
  });
}

// ===== 관리자: 수정 =====
function showEditCategory(catId){
  const cat = state.categories.find(c=>c.id===catId);
  if(!cat) return alert('카테고리를 찾을 수 없습니다.');

  const parentOptions = ['<option value="">(최상위)</option>']
    .concat(state.categories
      .filter(c => c.id !== cat.id) // 자기 자신 제외
      .map(c => `<option value="${c.id}" ${c.id === (cat.parent_id||'') ? 'selected' : ''}>${c.name}</option>`))
    .join('');

  showModal('카테고리 수정', `
    <div class="form-row">
      <div><label>카테고리 ID</label><input id="cat_id" value="${cat.id}"></div>
      <div><label>정렬순서</label><input id="cat_order" type="number" value="${cat.order||0}"></div>
    </div>
    <div class="form-row full"><div><label>이름</label><input id="cat_name" value="${cat.name}"></div></div>
    <div class="form-row full"><div><label>아이콘(이모지)</label><input id="cat_icon" value="${cat.icon||'📄'}"></div></div>
    <div class="form-row full"><div><label>부모 카테고리</label><select id="cat_parent">${parentOptions}</select></div></div>
    <div class="info">ID 변경 시 연결된 매뉴얼의 category_id도 함께 변경됩니다.</div>
  `, () => {
    const newId   = byId('cat_id').value.trim();
    const newName = byId('cat_name').value.trim();
    const newOrd  = Number(byId('cat_order').value||0);
    const newIcon = byId('cat_icon').value.trim() || '📄';
    let parent_id = byId('cat_parent').value.trim() || null;

    if(!newId || !newName) return alert('ID와 이름은 필수입니다.');

    // ✅ 자기 자신을 부모로 지정하는 경우 방지
    if (parent_id === newId) {
      alert('부모 카테고리에 자기 자신은 선택할 수 없습니다. (최상위로 저장됩니다)');
      parent_id = null;
    }

    // (선택) 순환 방지: 자식(후손)을 부모로 지정 못하게
    if (parent_id && isDescendant(state.categories, parent_id, cat.id)) {
      alert('자신의 하위 카테고리를 부모로 지정할 수 없습니다.');
      parent_id = cat.parent_id || null;
    }

    const oldId = cat.id;
    cat.id        = newId;
    cat.name      = newName;
    cat.order     = newOrd;
    cat.icon      = newIcon;
    cat.parent_id = parent_id;

    // ID가 바뀌면 관련 참조 업데이트
    if (oldId !== newId) {
      state.categories.forEach(x => { if (x.parent_id === oldId) x.parent_id = newId; });
      state.manuals.forEach(m => { if (m.category_id === oldId) m.category_id = newId; });
    }

    saveToLocal(getLocalVersion());
    render();
  });
}

// 하위(후손) 여부 검사 유틸 (간단한 위로 타고가는 방식)
function isDescendant(categories, possibleParentId, targetId){
  // possibleParentId 가 targetId의 후손이면 true
  let cur = categories.find(c => c.id === possibleParentId);
  while (cur && cur.parent_id) {
    if (cur.parent_id === targetId) return true;
    cur = categories.find(c => c.id === cur.parent_id);
  }
  return false;
}


function showEditManual(manualId){
  const m = state.manuals.find(x=>x.id===manualId);
  if(!m) return alert('매뉴얼을 찾을 수 없습니다.');
  const catOptions = state.categories.map(c => `<option value="${c.id}" ${c.id===m.category_id?'selected':''}>${c.name}</option>`).join('');
  const prefillAttach = Array.isArray(m.attachments)
  ? m.attachments.map(x=>x?.url||'').filter(Boolean).join(', ')
  : (m.attachment_url || '');
  showModal('매뉴얼 수정', `
    <div class="form-row"><div><label>문서 ID</label><input id="m_id" value="${m.id}"></div>
    <div><label>카테고리</label><select id="m_cat">${catOptions}</select></div></div>
    <div class="form-row full"><div><label>제목</label><input id="m_title" value="${m.title}"></div></div>
    <div class="form-row full"><div><label>요약</label><input id="m_summary" value="${m.summary||''}"></div></div>
    <div class="form-row full"><div><label>내용</label><textarea id="m_content" rows="6">${(m.content||'').replace(/</g,'&lt;')}</textarea></div></div>
    <div class="form-row"><div><label>태그(콤마)</label><input id="m_tags" value="${m.tags||''}"></div>
    <div>
     <label>첨부 URL (여러 개면 , 로 구분)</label>
     <input id="m_attach" value="${prefillAttach}" placeholder="https://a.pdf, https://b.pdf">
    </div>


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

// ===== 삭제 =====
function deleteCategory(catId){
  if (!confirm("이 카테고리를 삭제하시겠습니까? (하위 카테고리와 관련 매뉴얼도 함께 삭제됩니다)")) return;

  function deleteRecursive(id){
    // 하위 카테고리 목록 찾기
    const children = state.categories.filter(c => c.parent_id === id);
    children.forEach(ch => deleteRecursive(ch.id));

    // 해당 카테고리의 매뉴얼 제거
    state.manuals = state.manuals.filter(m => m.category_id !== id);

    // 카테고리 제거
    state.categories = state.categories.filter(c => c.id !== id);
  }

  deleteRecursive(catId);   // 루트부터 시작
  saveToLocal(getLocalVersion());
  navigate('home');
  render();
}

function deleteManual(manualId){
  if (!confirm("이 매뉴얼을 삭제하시겠습니까?")) return;
  const m = state.manuals.find(x=>x.id===manualId);
  state.manuals = state.manuals.filter(m => m.id !== manualId);
  saveToLocal(getLocalVersion());
  navigate('category', { id: m?.category_id || '' });
  render();
}

// ===== 데이터 내보내기 =====
function exportData(){
  const now = new Date();
  const version = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-' + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const data = { version: version, categories: state.categories, manuals: state.manuals, exported_at: now.toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'manuals.json'; a.click();
  URL.revokeObjectURL(url);
  alert('manuals.json 파일이 다운로드되었습니다. 이 파일을 저장소에 덮어쓰면 즉시 반영됩니다.');
}

function resetLocal(){
  localStorage.removeItem(LS_KEYS.cats);
  localStorage.removeItem(LS_KEYS.mans);
  alert('로컬 데이터 초기화 완료. 서버 데이터를 다시 불러옵니다.');
  boot();
}

// ===== 모달 =====
function showModal(title, bodyHTML, onSubmit){
  const modal = byId('modal'), body = byId('modalBody'), titleEl = byId('modalTitle'), submit = byId('modalSubmit');
  if(!modal||!body||!titleEl||!submit){ console.warn('Modal DOM not found'); return; }
  titleEl.textContent = title||'입력'; body.innerHTML = bodyHTML||'';
  submit.onclick = () => { try{onSubmit&&onSubmit();}finally{hideModal();} };
  modal.classList.remove('hidden'); modal.style.display='flex'; modal.removeAttribute('aria-hidden');
}
function hideModal(){ const m=byId('modal'); if(m){ m.classList.add('hidden'); m.style.display='none'; m.setAttribute('aria-hidden','true'); } }
function closeModal(e){ if(e.target&&e.target.id==='modal'){ hideModal(); } }

// ===== 렌더링 =====
function render(){
  const root = byId('app'); if(!root) return;
  root.innerHTML='';
  const {page, params}=parseHash();
  if(page==='home'){ renderHome(root); }
  else if(page==='category'){ renderCategory(root, params.id); }
  else if(page==='manual'){ renderManual(root, params.id); }
  else if(page==='search'){ renderSearch(root); }
  else if(page==='about'){ renderAbout(root); }
  else { renderHome(root); }
  const dbg=byId('dbgCounts');
  if(dbg) dbg.textContent=`카테고리 ${state.categories.length} · 매뉴얼 ${state.manuals.length}`;
}

function renderHome(root){
  // 홈으로 올 때 검색 상태 초기화
  state.search = '';
  const input = byId('searchInput');
  if (input) input.value = '';

  const c = el('<div class="container"></div>');
  c.appendChild(el('<div class="page-title">카테고리</div>'));

  const grid = el('<div class="grid"></div>');

  // ✅ 최상위(부모 없는) 카테고리만 노출
  [...state.categories]
    .filter(c => c.parent_id == null)
    .sort((a,b)=>(a.order||0)-(b.order||0))
    .forEach(cat=>{
      const count = countManualsInTree(cat.id);

      const card = el(`
        <div class="card">
          <div class="badge">${cat.icon||'📁'}</div>
          <div class="title">${cat.name}</div>
          <div class="sub">${count}개 문서</div>
        </div>`);

      card.onclick = ()=>navigate('category',{id:cat.id});

      // 관리자 버튼(수정/삭제)
      if (state.admin){
        const adminRow = el('<div class="admin-mini" style="margin-top:8px;display:flex;gap:6px;"></div>');
        const btnEdit   = el('<button class="mini ghost">수정</button>');
        const btnDelete = el('<button class="mini danger">삭제</button>');
        btnEdit.onclick   = (e)=>{ e.stopPropagation(); showEditCategory(cat.id); };
        btnDelete.onclick = (e)=>{ e.stopPropagation(); deleteCategory(cat.id); };
        adminRow.appendChild(btnEdit);
        adminRow.appendChild(btnDelete);
        card.appendChild(adminRow);
      }

      grid.appendChild(card);
    });

  c.appendChild(grid);
  root.appendChild(c);
}

function renderCategory(root,catId){
  const cat = state.categories.find(x=>x.id===catId);

  const c = el('<div class="container"></div>');

  // breadcrumbs
  const bc = el('<div class="breadcrumbs"></div>');
  const aHome = el('<a href="#">홈</a>');
  aHome.onclick = (e)=>{ e.preventDefault(); navigate('home'); };
  bc.appendChild(aHome);
  bc.appendChild(document.createTextNode(' · ' + (cat ? cat.name : '카테고리')));
  c.appendChild(bc);

  c.appendChild(el(`<div class="page-title">${cat?cat.name:'카테고리'}</div>`));

  // 상단 관리자 버튼
  if (state.admin && cat){
    const headerActions = el('<div class="action-row" style="margin-bottom:10px;"></div>');
    const btnEdit   = el('<button class="button ghost">카테고리 수정</button>');
    const btnDelete = el('<button class="button danger">카테고리 삭제</button>');
    btnEdit.onclick   = ()=>showEditCategory(cat.id);
    btnDelete.onclick = ()=>deleteCategory(cat.id);
    headerActions.appendChild(btnEdit);
    headerActions.appendChild(btnDelete);
    c.appendChild(headerActions);
  }

  // ✅ 하위 카테고리 먼저 표시
  const children = state.categories
    .filter(x => x.parent_id === catId)
    .sort((a,b)=>(a.order||0)-(b.order||0));

  if (children.length){
    c.appendChild(el('<div class="kicker" style="margin:6px 0 8px;">하위 카테고리</div>'));
    const childGrid = el('<div class="grid"></div>');
    children.forEach(ch=>{
      const count = state.manuals.filter(m=>m.category_id===ch.id).length;
      const card = el(`
        <div class="card">
          <div class="badge">${ch.icon||'📁'}</div>
          <div class="title">${ch.name}</div>
          <div class="sub">${count}개 문서</div>
        </div>`);
      card.onclick = ()=>navigate('category',{id:ch.id});

      if (state.admin){
        const adminRow = el('<div class="admin-mini" style="margin-top:8px;display:flex;gap:6px;"></div>');
        const btnEdit   = el('<button class="mini ghost">수정</button>');
        const btnDelete = el('<button class="mini danger">삭제</button>');
        btnEdit.onclick   = (e)=>{ e.stopPropagation(); showEditCategory(ch.id); };
        btnDelete.onclick = (e)=>{ e.stopPropagation(); deleteCategory(ch.id); };
        adminRow.appendChild(btnEdit);
        adminRow.appendChild(btnDelete);
        card.appendChild(adminRow);
      }

      childGrid.appendChild(card);
    });
    c.appendChild(childGrid);
  }

  // 📄 매뉴얼 목록(요약/태그 유지 + 첨부 1개 즉시 열기)
  const manuals = state.manuals.filter(m=>m.category_id===catId);
  const list = el('<div class="list" style="margin-top:12px;"></div>');

  if (manuals.length === 0){
    
  } else {
    manuals.forEach(m=>{
      const hasSummary = (m.summary || '').trim().length > 0;
      const tagsHTML = m.tags
        ? `<div class="chips">` + m.tags.split(',').map(t=>`<span class="chip">${t.trim()}</span>`).join('') + `</div>`
        : '';
      const subHTML = hasSummary ? `<div class="sub">${m.summary}</div>` : '';
      const item = el(`
        <div class="item">
          <div class="title">${m.title}</div>
          ${subHTML}
          ${tagsHTML}
        </div>
      `);

      item.onclick = () => {
        const atts = getAttachments(m);
        if (atts.length === 1) {
          window.open(atts[0].url, "_blank");       // 링크 1개면 바로 열기
        } else {
          navigate('manual', { id: m.id });         // 0개 또는 2개 이상이면 상세
        }
      };

      if (state.admin){
        const adminRow = el('<div class="admin-mini" style="margin-top:8px;display:flex;gap:6px;"></div>');
        const btnEdit   = el('<button class="mini ghost">수정</button>');
        const btnDelete = el('<button class="mini danger">삭제</button>');
        btnEdit.onclick   = (e)=>{ e.stopPropagation(); showEditManual(m.id); };
        btnDelete.onclick = (e)=>{ e.stopPropagation(); deleteManual(m.id); };
        adminRow.appendChild(btnEdit);
        adminRow.appendChild(btnDelete);
        item.appendChild(adminRow);
      }

      list.appendChild(item);
    });
  }

  c.appendChild(list);
  root.appendChild(c);
}

function renderManual(root,id){
  const m=state.manuals.find(x=>x.id===id); const cat=m?state.categories.find(c=>c.id===m.category_id):null;
  const c=el('<div class="container"></div>');
  c.appendChild(el(`<div class="breadcrumbs"><a href="#" onclick="navigate('home')">홈</a> · ${cat?`<a href="#" onclick="navigate('category',{id:'${cat.id}'})">${cat.name}</a>`:'카테고리'}</div>`));
  c.appendChild(el(`<div class="page-title">${m?m.title:'문서를 찾을 수 없습니다'}</div>`));
  if(m){
    const rt=el('<div></div>'); m.content.split('\n').forEach(line=>rt.appendChild(el('<p>'+line.replace(/\s/g,'&nbsp;')+'</p>'))); c.appendChild(rt);
    const actions=el('<div class="action-row"></div>');
    const atts = getAttachments(m);
   if (atts.length > 0) {
     atts.forEach((a, idx) => {
       const btn = el(`<a class="button" target="_blank">${a.title || `첨부${idx+1}`}</a>`);
       btn.href = a.url;
       actions.appendChild(btn);
     });
   }
    const share=el('<button class="button ghost">링크 복사</button>'); share.onclick=()=>{navigator.clipboard.writeText(location.href);alert('문서 링크가 복사되었습니다.');}; actions.appendChild(share); c.appendChild(actions);
    if(state.admin){ const adminRow=el(`<div class="action-row"><button class="button ghost">수정</button><button class="button danger">삭제</button></div>`); adminRow.children[0].onclick=()=>showEditManual(m.id); adminRow.children[1].onclick=()=>deleteManual(m.id); c.appendChild(adminRow); }
  }
  root.appendChild(c);
}

function renderAbout(root){
  const c=el('<div class="container"></div>');
  c.appendChild(el('<div class="page-title">앱 정보</div>'));
  c.appendChild(el('<p>EXS Guide — 영업운영 · 민원응대 · 긴급상황 매뉴얼 뷰어</p>'));
  c.appendChild(el('<p>오프라인 사용: 최근 본 화면은 캐시되어 네트워크 불안정 시에도 열람 가능합니다.</p>'));
  root.appendChild(c);
}

// ===== 새로 추가: 검색 전용 화면 =====
function renderSearch(root){
  const c=el('<div class="container"></div>');
  c.appendChild(el('<div class="page-title">검색 결과</div>'));
  if(state.search){ c.appendChild(el(`<div class="kicker">“${state.search}”로 전체 매뉴얼을 검색했습니다.</div>`)); }
  const results=filterBySearch(state.manuals).map(m=>({...m,emergency:(m.tags||'').includes('긴급')}));
  results.sort((a,b)=>(b.emergency?1:0)-(a.emergency?1:0)||(a.title||'').localeCompare(b.title||''));
  if(results.length===0){ c.appendChild(el('<div class="empty-box">None</div>')); root.appendChild(c); return; }
  const list=el('<div class="list"></div>');
  results.forEach(m=>{
    const cat=state.categories.find(ca=>ca.id===m.category_id);
    const catBadge=cat?`${cat.icon||'📁'} ${cat.name}`:(m.category_id||'');
    const hasSummary = (m.summary || '').trim().length > 0;
    const tagChips = (m.tags ? m.tags.split(',').map(t=>`<span class="chip">${t.trim()}</span>`).join('') : '');
    const chipsHTML = `<div class="chips" style="margin-top:6px;">
      <span class="chip">${catBadge}</span>${tagChips}
    </div>`;
    const subHTML = hasSummary ? `<div class="sub">${m.summary}</div>` : '';

    const item = el(`
      <div class="item">
        <div class="title">${m.title}</div>
        ${subHTML}
        ${chipsHTML}
      </div>
    `);

    item.onclick = () => {
     const atts = getAttachments(m);   // 첨부 여러 개 처리
     if (atts.length === 1) {
        window.open(atts[0].url, "_blank");   // 링크 1개면 바로 열기
      } else {
        navigate('manual', { id: m.id });     // 0개 또는 2개 이상이면 상세 페이지
      }
    };
    if(state.admin){
      const adminRow=el(`<div class="admin-mini" style="margin-top:8px;display:flex;gap:6px;"><button class="mini ghost">수정</button><button class="mini danger">삭제</button></div>`);
      adminRow.children[0].onclick=(e)=>{e.stopPropagation();showEditManual(m.id);};
      adminRow.children[1].onclick=(e)=>{e.stopPropagation();deleteManual(m.id);};
      item.appendChild(adminRow);
    }
    list.appendChild(item);
  });
  c.appendChild(list); root.appendChild(c);
}

// ===== 부팅 =====
async function boot(){
  loadFromLocal();
  loadAdminFromLocal();   // ✅ 관리자 모드 상태 복원
  normalizeCategories();
  render();
  try{
    const res=await fetch('manuals.json?ts='+Date.now(),{cache:'no-store'});
    if(res.ok){ 
      const data=await res.json(); 
      const remoteVersion=(data&&(data.version??data.exported_at))||null; 
      const localVersion=getLocalVersion();
      if(Array.isArray(data.categories)) state.categories=data.categories;
      if(Array.isArray(data.manuals)) state.manuals=data.manuals;
      normalizeCategories();
      saveToLocal(remoteVersion??localVersion??null); 
      render();
    }
  }catch(e){ console.warn('manuals.json fetch failed',e); }
}

// ===== 이벤트/시작 =====
window.addEventListener('click',(e)=>{ const m=byId('modal'); if(m&&!m.classList.contains('hidden')&&e.target===m){ hideModal(); } });
window.addEventListener('hashchange',render);
boot();

// ===== 전역 바인딩 =====
window.enterAdmin=enterAdmin; window.exitAdmin=exitAdmin;
window.showAddCategory=showAddCategory; window.showAddManual=showAddManual;
window.exportData=exportData; window.resetLocal=resetLocal;
window.showModal=showModal; window.hideModal=hideModal; window.closeModal=closeModal;
window.onSearch=onSearch; window.navigate=navigate;
window.showEditCategory=showEditCategory; window.showEditManual=showEditManual;
window.deleteCategory=deleteCategory; window.deleteManual=deleteManual;

// ===== 오프라인 감지 =====
function updateOnlineStatus() {
  const overlay = document.getElementById('offline-overlay');
  if (!overlay) return; // 혹시 없을 경우 방어

  if (navigator.onLine) {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.remove('hidden');
  }
}

// 최초 실행
updateOnlineStatus();

// 이벤트 등록
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
