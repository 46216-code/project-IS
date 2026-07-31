// ==========================================
// 1. CONFIGURATION & INITIALIZATION
// ==========================================
const SUPABASE_URL = "https://vznmzjoouyxwosyrshzb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jnBAcgvSsdX465MooaAEUw_nsOHFkqv";

let supabaseClient = null;

if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true
        }
    });
} else {
    console.error("🚨 Error: ไม่สามารถเรียกใช้งาน Supabase SDK ได้ กรุณาตรวจสอบลำดับ Script ในไฟล์ HTML");
}

let memoryPosts = [];
let favoritePostIds = new Set();
let appliedPostIds = new Set();
let currentFilterType = "All"; 
let activeViewTab = "all"; // 'all', 'my', 'favorite', 'applied'
let loggedInUser = null;
const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

const currentPage = window.location.pathname.split("/").pop().toLowerCase();

//--------------------------
// DECLARING TOASTS & HOLD BUTTON
//--------------------------

const btn = document.getElementById('hold-btn');
const fill = document.getElementById('progress-fill');
const toast = document.getElementById('toast');

let holdTimer = null;
let toastTimer = null;

function updateHoldButtonState(postId = selectedPostId) {
  const holdButton = document.getElementById('hold-btn');
  const holdLabel = document.getElementById('hold-btn-label');
  const post = memoryPosts.find(p => p.id === postId);
  const isAlreadyApplied = !!post && appliedPostIds.has(post.id);

  if (holdButton) {
    holdButton.disabled = isAlreadyApplied;
    holdButton.classList.toggle('opacity-70', isAlreadyApplied);
    holdButton.classList.toggle('cursor-not-allowed', isAlreadyApplied);
    holdButton.classList.toggle('hover:scale-105', !isAlreadyApplied);
    holdButton.classList.toggle('active:scale-95', !isAlreadyApplied);
    holdButton.classList.toggle('bg-gray-500', isAlreadyApplied);
    holdButton.classList.toggle('border-gray-400', isAlreadyApplied);
    holdButton.classList.toggle('bg-slate-800', !isAlreadyApplied);
    holdButton.classList.toggle('border-slate-700', !isAlreadyApplied);
  }

  if (holdLabel) {
    holdLabel.innerText = isAlreadyApplied ? 'คุณสมัครไปแล้ว' : 'กดค้างเพื่อสมัคร';
  }

  if (fill) {
    fill.classList.remove('scale-x-100');
    fill.classList.add('scale-x-0');
  }
}

function startHold() {
  if (!fill || (btn && btn.disabled)) return;

  fill.classList.remove('duration-0');
  fill.classList.add('duration-[2000ms]', 'scale-x-100');

  holdTimer = setTimeout(() => {
    handleHoldComplete();
    resetHold();
  }, 2000);
}

function resetHold() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }

  if (!fill) return;

  fill.classList.remove('duration-[2000ms]', 'scale-x-100');
  fill.classList.add('duration-0');
}

async function handleHoldComplete() {
  if (!selectedPostId) {
    showToast();
    return;
  }

  const post = memoryPosts.find(p => p.id === selectedPostId);
  if (post && appliedPostIds.has(post.id)) {
    updateHoldButtonState(selectedPostId);
    return;
  }

  if (post && loggedInUser && loggedInUser.id === post.user_id) {
    if (typeof openConfirmModal === 'function') {
      openConfirmModal();
    }
    return;
  }

  if (typeof submitApplication === 'function') {
    await submitApplication(true);
    return;
  }

  showToast();
}

function showToast(message = "การสมัครสำเร็จ! ติดตามการสมัครที่ปุ่ม Menu ทางด้านซ้ายบนของหน้าหลักได้เลย!", duration = 3000) {
  const toastMessage = document.getElementById('toastMessage');
  if (!toast) return;

  if (toastTimer) clearTimeout(toastTimer);

  if (toastMessage) {
    toastMessage.innerText = message;
  }

  toast.classList.remove('opacity-0', 'scale-90', 'pointer-events-none');
  toast.classList.add('opacity-100', 'scale-100');

  toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100', 'scale-100');
    toast.classList.add('opacity-0', 'scale-90', 'pointer-events-none');
  }, duration);
}

if (btn) {
  btn.addEventListener('mousedown', startHold);
  btn.addEventListener('mouseup', resetHold);
  btn.addEventListener('mouseleave', resetHold);

  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startHold();
  });
  btn.addEventListener('touchend', resetHold);
  btn.addEventListener('touchcancel', resetHold);
}

// ==========================================
// 2. AUTHENTICATION & PROFILE FUNCTIONS
// ==========================================

function toggleAuthMode(mode) {
    const loginForm = document.getElementById('loginFormContainer');
    const signUpForm = document.getElementById('signUpFormContainer');
    const subTitle = document.getElementById('authSubtitle');

    if (!loginForm || !signUpForm) return;

    if(mode === 'signup') {
        loginForm.style.display = 'none';
        signUpForm.style.display = 'block';
        if (subTitle) subTitle.innerText = "ลงทะเบียนข้อมูลบัญชีของคุณ เพื่อเริ่มใช้งานระบบบอร์ดเมือง";
    } else {
        signUpForm.style.display = 'none';
        loginForm.style.display = 'block';
        if (subTitle) subTitle.innerText = "ยินดีต้อนรับ! เข้าสู่แพลตฟอร์มรวมตัวทำกิจกรรม";
    }
}

async function handleSignUp(event) {
    event.preventDefault();
    if (!supabaseClient) return showToast("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");

    const usernameInput = document.getElementById('Username');
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPass').value.trim();
    const avatarFile = document.getElementById('profileImageFile').files[0];
    const signUpBtn = document.getElementById('signUpBtn');

    const chosenUsername = usernameInput ? usernameInput.value.trim() : email.split('@')[0];

    if (password.length < 6) {
        return showToast("รหัสผ่านสั้นเกินไป! กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
    }

    signUpBtn.innerText = "กำลังสร้างสิทธิ์เข้าถึง...";
    signUpBtn.disabled = true;

    const { data: authData, error: authError } = await supabaseClient.auth.signUp({ 
        email, 
        password,
        options: {
            redirectTo: "https://project-is-mocha.vercel.app/"
        }
    });
    
    if (authError) {
        showToast("เกิดปัญหาในการลงทะเบียนสมัครสมาชิก: " + authError.message);
        signUpBtn.innerText = "ลงทะเบียนสร้างบัญชี (Confirm Sign Up)";
        signUpBtn.disabled = false;
        return;
    }

    let avatarUrl = defaultAvatar;
    if (avatarFile && authData.user) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `avatars/${authData.user.id}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('activity-images').upload(filePath, avatarFile);
        
        if (!uploadError) {
            const { data: urlData } = supabaseClient.storage.from('activity-images').getPublicUrl(filePath);
            avatarUrl = urlData.publicUrl;
        }
    }

    if(authData.user) {
        await supabaseClient.from('profiles').insert([{ id: authData.user.id, username: chosenUsername, avatar_url: avatarUrl }]);
    }
    
    showToast("สมัครสมาชิกสำเร็จ! คุณสามารถใช้บัญชีนี้ล็อกอินเข้าสู่ระบบได้ทันที");
    signUpBtn.innerText = "ลงทะเบียนสร้างบัญชี (Confirm Sign Up)";
    signUpBtn.disabled = false;
    toggleAuthMode('login');
}

async function handleLogin(event) {
    if (event) event.preventDefault();
    if (!supabaseClient) return showToast("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");

    const emailEl = document.getElementById('authEmail');
    const passwordEl = document.getElementById('authPassword');
    const loginBtn = document.getElementById('loginBtn');

    if (!emailEl || !passwordEl) return;

    const email = emailEl.value.trim();
    const password = passwordEl.value.trim();

    if (!email || !password) {
        return showToast("กรุณากรอกข้อมูลอีเมลและรหัสผ่านให้ครบถ้วน");
    }

    if (loginBtn) {
        loginBtn.innerText = "กำลังตรวจสอบสิทธิ์...";
        loginBtn.disabled = true;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (loginBtn) {
        loginBtn.innerText = "เข้าสู่ระบบ (Log In)";
        loginBtn.disabled = false;
    }

    if (error) {
        showToast("ล็อกอินไม่สำเร็จ: " + error.message);
    } else {
        window.location.href = "index.html";
    }
}

function trackAuthSession() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
            loggedInUser = session.user;
            
            if (currentPage === "signup-login.html" || currentPage === "signup-login" || currentPage === "") {
                window.location.href = "index.html";
                return;
            }

            try {
                const { data: profileData, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('username')
                    .eq('id', loggedInUser.id)
                    .maybeSingle();

                if (profileError) throw profileError;

                if (document.getElementById('userDisplay')) {
                    document.getElementById('userDisplay').innerText = profileData && profileData.username 
                        ? profileData.username 
                        : loggedInUser.email.split('@')[0];
                }
            } catch (err) {
                console.error("Error fetching custom profile data:", err.message);
                if (document.getElementById('userDisplay')) {
                    document.getElementById('userDisplay').innerText = loggedInUser.email.split('@')[0];
                }
            }

            await fetchUserUserData();
            fetchPosts();
        } else {
            loggedInUser = null;
            if (currentPage === "index.html" || currentPage === "index" || currentPage === "/" || currentPage === "") {
                window.location.href = "signup-login.html";
            }
        }
    });
}

async function handleLogout() {
    if (!supabaseClient) return;
    if(confirm("ต้องการออกจากระบบหรือไม่?")) {
        await supabaseClient.auth.signOut();
        window.location.href = "signup-login.html";
    }
}

// ==========================================
// 3. FAVORITE & USER DATA MANAGEMENT
// ==========================================

async function fetchUserUserData() {
    if (!loggedInUser || !supabaseClient) return;

    const { data: favs } = await supabaseClient
        .from('favorites')
        .select('post_id')
        .eq('user_id', loggedInUser.id);
    
    if (favs) {
        favoritePostIds = new Set(favs.map(f => f.post_id));
    }

    const { data: apps } = await supabaseClient
        .from('applications')
        .select('post_id')
        .eq('user_id', loggedInUser.id);

    if (apps) {
        appliedPostIds = new Set(apps.map(a => a.post_id));
    }
}

async function toggleFavorite(postId, event) {
    if (event) event.stopPropagation();
    if (!loggedInUser) return showToast("กรุณาเข้าสู่ระบบก่อนทำรายการ");

    const isFav = favoritePostIds.has(postId);

    if (isFav) {
        favoritePostIds.delete(postId);
        await supabaseClient
            .from('favorites')
            .delete()
            .eq('user_id', loggedInUser.id)
            .eq('post_id', postId);
    } else {
        favoritePostIds.add(postId);
        await supabaseClient
            .from('favorites')
            .insert([{ user_id: loggedInUser.id, post_id: postId }]);
    }

    renderFilteredPosts();
}

// ==========================================
// 4. TAB & POSTS MANAGEMENT
// ==========================================

function switchTab(tab) {
    activeViewTab = tab;
    
    const label = document.getElementById('currentTabLabel');
    if (label) {
        if (tab === 'all') {
            label.classList.add('hidden');
        } else {
            label.classList.remove('hidden');
            label.innerText = tab === 'my' ? 'My Posts' : tab === 'favorite' ? 'Favorite Posts' : 'Applied Posts';
        }
    }

    closeSidebar();
    renderFilteredPosts();
}

async function handleCreatePost(event) {
    event.preventDefault();
    if (!supabaseClient || !loggedInUser) {
        showToast("กรุณาเข้าสู่ระบบก่อนสร้างโพสต์");
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const title = document.getElementById('postTitle').value.trim();
    const description = document.getElementById('postDesc').value.trim();
    const type = document.getElementById('postType').value;
    const peopleLimit = parseInt(document.getElementById('postLimit').value) || 3;
    const budget = document.getElementById('postBudget').value.trim();
    const location = document.getElementById('postLocation').value.trim();
    const imageFile = document.getElementById('postImageFile').files[0];

    submitBtn.innerText = "กำลังประกาศ...";
    submitBtn.disabled = true;

    let imageUrl = null;

    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('activity-images')
            .upload(filePath, imageFile);

        if (!uploadError) {
            const { data: urlData } = supabaseClient.storage
                .from('activity-images')
                .getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }
    }

    const { error: insertError } = await supabaseClient
        .from('posts')
        .insert([
            {
                title: title,
                description: description,
                type: type,
                people_limit: peopleLimit,
                joined_count: 0,
                budget: type === 'Commission' ? budget : null,
                location: type === 'Meet-up' ? location : null,
                image_url: imageUrl,
                user_id: loggedInUser.id,
                author_email: loggedInUser.email
            }
        ]);

    submitBtn.innerText = "ประกาศลงบอร์ด";
    submitBtn.disabled = false;

    if (insertError) {
        showToast("เกิดข้อผิดพลาดในการสร้างโพสต์: " + insertError.message);
    } else {
        showToast("สร้างโพสต์ภารกิจสำเร็จ!");
        document.getElementById('createPostForm').reset();
        closeModal('createModal');
        toggleTypeFields();
        fetchPosts(); 
    }
}

async function handleEditPost(event) {
    event.preventDefault();
    if (!supabaseClient || !loggedInUser) return;

    const postId = parseInt(document.getElementById('editPostId').value, 10);
    const title = document.getElementById('editPostTitle').value.trim();
    const description = document.getElementById('editPostDesc').value.trim();
    const type = document.getElementById('editPostType').value;
    const peopleLimit = parseInt(document.getElementById('editPostLimit').value) || 3;
    const budget = document.getElementById('editPostBudget').value.trim();
    const location = document.getElementById('editPostLocation').value.trim();

    const { error } = await supabaseClient
        .from('posts')
        .update({
            title,
            description,
            type,
            people_limit: peopleLimit,
            budget: type === 'Commission' ? budget : null,
            location: type === 'Meet-up' ? location : null
        })
        .eq('id', postId)
        .eq('user_id', loggedInUser.id);

    if (error) {
        showToast("แก้ไขโพสต์ไม่สำเร็จ: " + error.message);
    } else {
        showToast("บันทึกการแก้ไขโพสต์เรียบร้อย!");
        closeModal('editModal');
        fetchPosts();
    }
}

async function deletePost(postId) {
    if (!confirm("คุณต้องการลบโพสต์นี้ใช่หรือไม่?")) return;

    const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', loggedInUser.id);

    if (error) {
        showToast("ลบโพสต์ไม่สำเร็จ: " + error.message);
    } else {
        showToast("ลบโพสต์สำเร็จ");
        fetchPosts();
    }
}

function openEditModal(postId) {
    const post = memoryPosts.find(p => p.id === postId);
    if (!post) return;

    document.getElementById('editPostId').value = post.id;
    document.getElementById('editPostTitle').value = post.title;
    document.getElementById('editPostDesc').value = post.description;
    document.getElementById('editPostType').value = post.type;
    document.getElementById('editPostLimit').value = post.people_limit;
    document.getElementById('editPostBudget').value = post.budget || '';
    document.getElementById('editPostLocation').value = post.location || '';

    toggleEditTypeFields();
    document.getElementById('editModal').classList.remove('hidden');
}

async function fetchPosts() {
    const grid = document.getElementById('boardGrid');
    if (!grid || !supabaseClient) return;

    const { data, error } = await supabaseClient.from('posts').select('*').order('id', { ascending: false });
    
    if (error) {
        console.error("Error fetching posts:", error.message);
        return;
    }

    if (data) {
        memoryPosts = data.map(post => ({
            ...post,
            joined_count: Math.min(post.people_limit || 999999, Math.max(0, Number(post.joined_count || 0)))
        }));
        renderFilteredPosts();
    }
}

function renderFilteredPosts() {
    const grid = document.getElementById('boardGrid');
    const emptyState = document.getElementById('emptyState');
    const emptyStateText = document.getElementById('emptyStateText');
    if (!grid) return;

    grid.querySelectorAll('.post-card').forEach(card => card.remove());

    let displayedPosts = [...memoryPosts];

    if (activeViewTab === "my" && loggedInUser) {
        displayedPosts = displayedPosts.filter(post => post.user_id === loggedInUser.id);
    } else if (activeViewTab === "favorite") {
        displayedPosts = displayedPosts.filter(post => favoritePostIds.has(post.id));
    } else if (activeViewTab === "applied") {
        displayedPosts = displayedPosts.filter(post => appliedPostIds.has(post.id));
    }

    if (currentFilterType !== "All") {
        displayedPosts = displayedPosts.filter(post => post.type === currentFilterType);
    }

    if (displayedPosts.length === 0) { 
        if (emptyState) {
            emptyState.classList.remove('hidden'); 
            if (emptyStateText) {
                if (activeViewTab === 'favorite') emptyStateText.innerText = "ยังไม่มีรายการที่คุณถูกใจไว้";
                else if (activeViewTab === 'my') emptyStateText.innerText = "คุณยังไม่ได้สร้างโพสต์ใดๆ";
                else if (activeViewTab === 'applied') emptyStateText.innerText = "คุณยังไม่ได้สมัครเข้าร่วมกิจกรรมใดๆ";
                else emptyStateText.innerText = "ยังไม่มีประกาศบนบอร์ดในขณะนี้";
            }
        }
    } else { 
        if (emptyState) emptyState.classList.add('hidden');
        
        displayedPosts.forEach(post => {
            const card = document.createElement('div');
            card.className = "post-card bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200 flex flex-col h-[420px]";
            
            const cardImage = post.image_url ? post.image_url : "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";
            const isFull = post.joined_count >= post.people_limit;
            const isFav = favoritePostIds.has(post.id);
            const isOwner = loggedInUser && loggedInUser.id === post.user_id;
            let btnHtml = "";

            if (isOwner) {
                btnHtml = `
                    <div class="flex flex-col gap-1.5">
                        <button onclick="openRosterModal(${post.id})" class="w-full bg-indigo-500 text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-600 transition cursor-pointer">
                            <i class="fa-solid fa-users text-xs"></i> ดูผู้สมัคร / Roster
                        </button>
                        <div class="flex gap-2">
                            <button onclick="openEditModal(${post.id})" class="flex-1 bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-amber-600 transition cursor-pointer">
                                <i class="fa-solid fa-pen-to-square text-xs"></i> แก้ไข
                            </button>
                            <button onclick="deletePost(${post.id})" class="flex-1 bg-rose-500 text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-rose-600 transition cursor-pointer">
                                <i class="fa-solid fa-trash text-xs"></i> ลบ
                            </button>
                        </div>
                    </div>
                `;
            } else if (isFull) {
                btnHtml = `
                    <button disabled class="w-full bg-gray-400 text-white px-4 py-2.5 rounded-full text-sm font-bold cursor-not-allowed">
                        <i class="fa-solid fa-user-xmark"></i> เต็มแล้ว / Full
                    </button>
                `;
            } else {
                btnHtml = `
                    <button onclick="openDetailsModal(${post.id})"
                        class="w-full bg-green-500 text-white px-4 py-2.5 rounded-full text-sm font-bold hover:bg-green-600 transition cursor-pointer">
                        Apply / ดูรายละเอียด
                    </button>
                `;
            }

            card.innerHTML = `
                <div class="h-44 w-full bg-gray-200 overflow-hidden relative flex-shrink-0">
                    <img src="${cardImage}" class="w-full h-full object-cover">
                    <span class="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full border border-white shadow-sm">
                        ${post.type}
                    </span>
                    <button onclick="toggleFavorite(${post.id}, event)" class="absolute top-3 left-3 bg-white/80 hover:bg-white text-rose-500 rounded-full w-9 h-9 flex items-center justify-center shadow-md transition-transform active:scale-90 cursor-pointer">
                        <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart text-lg"></i>
                    </button>
                </div>
                <div class="p-5 flex-1 flex flex-col justify-between overflow-hidden">
                    <div class="overflow-hidden flex flex-col flex-1">
                        <h3 class="text-xl font-black text-gray-800 mb-1.5 truncate">${post.title}</h3>
                        <p class="text-gray-600 text-sm mb-3 line-clamp-2 flex-1">${post.description}</p>
                        
                        <div class="space-y-1 mb-2 flex-shrink-0">
                            ${post.budget ? `<p class="text-green-600 font-bold text-xs truncate"><i class="fa-solid fa-money-bill-wave"></i> ค่าตอบแทน: ${post.budget}</p>` : ''}
                            ${post.location ? `<p class="text-blue-600 font-bold text-xs truncate"><i class="fa-solid fa-location-dot"></i> สถานที่: ${post.location}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="flex flex-col pt-3 border-t border-gray-100 flex-shrink-0">
                        <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
                            <span><i class="fa-solid fa-user-group text-orange-400"></i> เข้าร่วมแล้ว: <strong class="text-gray-800">${post.joined_count}/${post.people_limit}</strong> คน</span>
                            <span class="truncate max-w-[120px]">โดย: ${post.author_email ? post.author_email.split('@')[0] : 'ไม่ระบุ'}</span>
                        </div>
                        ${btnHtml}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

// ==========================================
// 5. APPLICANT ROSTER MANAGEMENT FUNCTIONS
// ==========================================

async function openRosterModal(postId) {
    if (!supabaseClient) return;

    const rosterList = document.getElementById('rosterList');
    if (!rosterList) return;

    rosterList.innerHTML = `<p class="text-center text-gray-400 text-sm py-4">กำลังโหลดข้อมูลผู้สมัคร...</p>`;
    document.getElementById('rosterModal').classList.remove('hidden');

    // 1. Fetch applications
    const { data: apps, error } = await supabaseClient
        .from('applications')
        .select('id, status, user_id')
        .eq('post_id', postId);

    if (error) {
        rosterList.innerHTML = `<p class="text-center text-red-500 text-sm py-4">เกิดข้อผิดพลาด: ${error.message}</p>`;
        return;
    }

    if (!apps || apps.length === 0) {
        rosterList.innerHTML = `<p class="text-center text-gray-400 text-sm py-4">ยังไม่มีผู้สมัครสำหรับโพสต์นี้</p>`;
        return;
    }

    // 2. Safely fetch profiles for user IDs
    const userIds = apps.map(app => app.user_id);
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // 3. Render roster cards
    rosterList.innerHTML = '';
    apps.forEach(app => {
        const profile = profileMap.get(app.user_id);
        const username = profile?.username || 'ผู้ใช้งาน';
        const avatar = profile?.avatar_url || defaultAvatar;

        const card = document.createElement('div');
        card.className = "flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100";
        
        let actionsHtml = '';
        if (app.status === 'accepted') {
            actionsHtml = `
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full"><i class="fa-solid fa-check"></i> ยอมรับแล้ว</span>
                    <button onclick="updateApplicationStatus('${app.id}', 'declined', ${postId})" class="text-xs text-rose-500 hover:underline font-semibold cursor-pointer">ยกเลิก</button>
                </div>`;
        } else if (app.status === 'declined') {
            actionsHtml = `
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-rose-600 bg-rose-100 px-3 py-1 rounded-full"><i class="fa-solid fa-xmark"></i> ปฏิเสธแล้ว</span>
                    <button onclick="updateApplicationStatus('${app.id}', 'accepted', ${postId})" class="text-xs text-emerald-600 hover:underline font-semibold cursor-pointer">เปลี่ยนเป็นยอมรับ</button>
                </div>`;
        } else {
            actionsHtml = `
                <div class="flex items-center gap-2">
                    <button onclick="updateApplicationStatus('${app.id}', 'accepted', ${postId})" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer">
                        <i class="fa-solid fa-check"></i> Accept
                    </button>
                    <button onclick="updateApplicationStatus('${app.id}', 'declined', ${postId})" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i> Decline
                    </button>
                </div>`;
        }

        card.innerHTML = `
            <div class="flex items-center gap-3">
                <img src="${avatar}" class="w-10 h-10 rounded-full object-cover border border-gray-200">
                <div>
                    <h4 class="text-sm font-bold text-gray-800">${username}</h4>
                    <p class="text-xs text-gray-400">สถานะ: ${app.status}</p>
                </div>
            </div>
            ${actionsHtml}
        `;
        rosterList.appendChild(card);
    });
}

async function updateApplicationStatus(applicationId, newStatus, postId) {
    if (!supabaseClient) return;

    const { error } = await supabaseClient
        .from('applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

    if (error) {
        showToast("ไม่สามารถอัปเดตสถานะได้: " + error.message);
    } else {
        showToast(`อัปเดตสถานะผู้สมัครเรียบร้อยแล้ว (${newStatus})`);
        fetchPosts();
        openRosterModal(postId);
    }
}

// ==========================================
// 6. MODAL & FLOW INTERACTIONS
// ==========================================

function openCreateModal() { 
    const modal = document.getElementById('createModal');
    if(modal) modal.classList.remove('hidden'); 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.classList.add('hidden'); 
}

function toggleTypeFields() {
    const typeEl = document.getElementById('postType');
    const commField = document.getElementById('commissionField');
    const locField = document.getElementById('locationField');
    
    if(!typeEl) return;
    const type = typeEl.value;

    if(commField) commField.classList.toggle('hidden', type !== 'Commission');
    if(locField) locField.classList.toggle('hidden', type !== 'Meet-up');
}

function toggleEditTypeFields() {
    const typeEl = document.getElementById('editPostType');
    const commField = document.getElementById('editCommissionField');
    const locField = document.getElementById('editLocationField');
    
    if(!typeEl) return;
    const type = typeEl.value;

    if(commField) commField.classList.toggle('hidden', type !== 'Commission');
    if(locField) locField.classList.toggle('hidden', type !== 'Meet-up');
}

function toggleFilterMenu() {
    let menu = document.getElementById('filterDropdownMenu');
    
    if (!menu) {
        const filterBtn = document.getElementById('filterBtn');
        if (!filterBtn) return;

        menu = document.createElement('div');
        menu.id = 'filterDropdownMenu';
        menu.className = "absolute left-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex flex-col gap-1.5 z-50 w-52 transition-all duration-200";
        
        const categories = [
            { label: "✨ ทั้งหมด / All", value: "All" },
            { label: "🤝 Cooperation", value: "Cooperation" },
            { label: "💰 Commission", value: "Commission" },
            { label: "🌱 Volunteer", value: "Volunteer" },
            { label: "📍 Meet-up", value: "Meet-up" }
        ];

        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-all text-gray-700 hover:bg-orange-50 hover:text-orange-600 cursor-pointer ${currentFilterType === cat.value ? 'bg-orange-50 text-orange-600' : ''}`;
            btn.innerText = cat.label;
            btn.onclick = function() {
                currentFilterType = cat.value;
                filterBtn.innerHTML = `<i class="fa-solid fa-filter text-white/90 text-xs"></i> Filter: ${cat.value}`;
                renderFilteredPosts();
                menu.classList.add('hidden');
            };
            menu.appendChild(btn);
        });

        filterBtn.parentNode.appendChild(menu);
    } else {
        menu.classList.toggle('hidden');
        
        const buttons = menu.querySelectorAll('button');
        const categories = ["All", "Cooperation", "Commission", "Volunteer", "Meet-up"];
        buttons.forEach((b, i) => {
            if (currentFilterType === categories[i]) {
                b.classList.add('bg-orange-50', 'text-orange-600');
            } else {
                b.classList.remove('bg-orange-50', 'text-orange-600');
            }
        });
    }
}

function openHowToStart() {
    const modal = document.getElementById('howToStartModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

let selectedPostId = null;

function openDetailsModal(postId) {
    const post = memoryPosts.find(p => p.id === postId);
    if (!post) return;

    selectedPostId = postId;

    document.getElementById("modalTitle").innerText = post.title;
    document.getElementById("modalDesc").innerText = post.description;
    document.getElementById("modalImage").src = post.image_url || "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";

    updateHoldButtonState(postId);
    document.getElementById("detailsModal").classList.remove("hidden");
}

function openConfirmModal() {
    const post = memoryPosts.find(p => p.id === selectedPostId);
    if (!post) return;

    if (loggedInUser && loggedInUser.id === post.user_id) {
        document.getElementById("ownerWarningModal").classList.remove("hidden");
        return;
    }

    document.getElementById("confirmTitle").innerText = post.title;
    document.getElementById("confirmImage").src = post.image_url || "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";

    document.getElementById("confirmModal").classList.remove("hidden");
}

async function submitApplication(showSuccessToast = false) {
    if (!supabaseClient) return false;
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            showToast("กรุณาเข้าสู่ระบบก่อนสมัคร");
            return false;
        }

        const post = memoryPosts.find(p => p.id === selectedPostId);
        if (!post) return false;

        if (post.joined_count >= post.people_limit) {
            showToast("ขออภัย กิจกรรมนี้เต็มแล้ว!");
            return false;
        }

        const { data: existing } = await supabaseClient
            .from("applications")
            .select("*")
            .eq("post_id", selectedPostId)
            .eq("user_id", user.id)
            .maybeSingle(); 

        if (existing) {
            appliedPostIds.add(selectedPostId);
            updateHoldButtonState(selectedPostId);
            closeModal("confirmModal");
            closeModal("detailsModal");
            fetchPosts();
            return true;
        }

        const { error: insertError } = await supabaseClient
            .from("applications")
            .insert([
                {
                    post_id: selectedPostId,
                    user_id: user.id,
                    status: 'pending'
                }
            ]);

        if (insertError) throw insertError;

        appliedPostIds.add(selectedPostId);

        closeModal("confirmModal");
        closeModal("detailsModal");
        fetchPosts();

        if (showSuccessToast) {
            showToast();
        } else {
            showToast("สมัครสำเร็จ! รอเจ้าของโพสต์อนุมัติ");
        }

        return true;

    } catch (err) {
        console.error(err);
        showToast("เกิดข้อผิดพลาด: " + err.message);
        return false;
    }
}

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('backdrop');
    if (sidebar) sidebar.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.remove('hidden');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('backdrop');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
}

// ==========================================
// 7. INITIALIZER ON WINDOW LOAD
// ==========================================
window.onload = function() {
    trackAuthSession();

    const createForm = document.getElementById("createPostForm");
    if (createForm) createForm.addEventListener("submit", handleCreatePost);

    const editForm = document.getElementById("editPostForm");
    if (editForm) editForm.addEventListener("submit", handleEditPost);

    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    const signUpForm = document.getElementById("signUpForm");
    if (signUpForm) signUpForm.addEventListener("submit", handleSignUp);

    document.addEventListener('click', function(event) {
        const menu = document.getElementById('filterDropdownMenu');
        const filterBtn = document.getElementById('filterBtn');
        if (menu && filterBtn && !filterBtn.contains(event.target) && !menu.contains(event.target)) {
            menu.classList.add('hidden');
        }
    });

    const backdrop = document.getElementById('backdrop');
    const openBtn = document.getElementById('open-btn');
    const closeBtn = document.getElementById('close-btn');

    if (openBtn) openBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);
};