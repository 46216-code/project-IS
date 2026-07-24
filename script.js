// ==========================================
// 1. CONFIGURATION & INITIALIZATION (FIXED DEPENDENCY)
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
let currentFilterType = "All"; 
let loggedInUser = null;
const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

// ตรวจสอบชื่อไฟล์หน้าเว็บปัจจุบัน เพื่อใช้ในการเปลี่ยนหน้าอย่างปลอดภัย
const currentPage = window.location.pathname.split("/").pop().toLowerCase();

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
    if (!supabaseClient) return alert("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");

    const usernameInput = document.getElementById('Username');
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPass').value.trim();
    const avatarFile = document.getElementById('profileImageFile').files[0];
    const signUpBtn = document.getElementById('signUpBtn');

    const chosenUsername = usernameInput ? usernameInput.value.trim() : email.split('@')[0];

    if (password.length < 6) {
        return alert("รหัสผ่านสั้นเกินไป! กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
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
        alert("เกิดปัญหาในการลงทะเบียนสมัครสมาชิก: " + authError.message);
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
    
    alert("สมัครสมาชิกสำเร็จ! คุณสามารถใช้บัญชีนี้ล็อกอินเข้าสู่ระบบได้ทันที");
    signUpBtn.innerText = "ลงทะเบียนสร้างบัญชี (Confirm Sign Up)";
    signUpBtn.disabled = false;
    toggleAuthMode('login');
}

async function handleLogin(event) {
    if (event) event.preventDefault();
    if (!supabaseClient) return alert("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");

    const emailEl = document.getElementById('authEmail');
    const passwordEl = document.getElementById('authPassword');
    const loginBtn = document.getElementById('loginBtn');

    if (!emailEl || !passwordEl) {
        console.error("🚨 ไม่พบฟิลด์กรอกข้อมูลอีเมลหรือรหัสผ่านในหน้านี้");
        return;
    }

    const email = emailEl.value.trim();
    const password = passwordEl.value.trim();

    if (!email || !password) {
        return alert("กรุณากรอกข้อมูลอีเมลและรหัสผ่านให้ครบถ้วน");
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
        alert("ล็อกอินไม่สำเร็จ: " + error.message + " (กรุณาตรวจสอบข้อมูล หรือปิดการยืนยันอีเมลใน Supabase)");
    } else {
        window.location.href = "index.html";
    }
}

function trackAuthSession() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
            loggedInUser = session.user;
            
            // ถ้าล็อกอินแล้ว แต่เผลอเปิดหน้าล็อกอินอยู่ ให้เด้งกลับไปหน้าหลัก (index.html)
            if (currentPage === "signup-login.html" || currentPage === "signup-login" || currentPage === "") {
                window.location.href = "index.html";
                return;
            }

            // ค้นหาข้อมูล username จริงจากตาราง profiles ด้วยรหัส UID ผู้ใช้งาน
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

            fetchPosts();
        } else {
            loggedInUser = null;
            
            // 🔒 สั่งงานตรงนี้: ถ้าไม่มี Session (ไม่ได้ล็อกอิน) และพยายามเข้าหน้าหลัก ให้เด้งไปหน้า signup-login.html ทันที
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
// 3. POSTS MANAGEMENT & FILTERING FUNCTIONS
// ==========================================

async function handleCreatePost(event) {
    event.preventDefault();
    if (!supabaseClient || !loggedInUser) {
        alert("กรุณาเข้าสู่ระบบก่อนสร้างโพสต์");
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
        } else {
            console.error("Upload image error:", uploadError.message);
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
        alert("เกิดข้อผิดพลาดในการสร้างโพสต์: " + insertError.message);
    } else {
        alert("สร้างโพสต์ภารกิจสำเร็จ!");
        document.getElementById('createPostForm').reset();
        closeModal('createModal');
        toggleTypeFields();
        fetchPosts(); 
    }
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
        memoryPosts = data;
        renderFilteredPosts();
    }
}

function renderFilteredPosts() {
    const grid = document.getElementById('boardGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid) return;

    grid.querySelectorAll('.post-card').forEach(card => card.remove());

    const displayedPosts = currentFilterType === "All" 
        ? memoryPosts 
        : memoryPosts.filter(post => post.type === currentFilterType);

    if (displayedPosts.length === 0) { 
        if (emptyState) emptyState.classList.remove('hidden'); 
    } else { 
        if (emptyState) emptyState.classList.add('hidden');
        
        displayedPosts.forEach(post => {
            const card = document.createElement('div');
            card.className = "post-card bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200 flex flex-col h-[420px]";
            
            const cardImage = post.image_url ? post.image_url : "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";
            const isFull = post.joined_count >= post.people_limit;
            let btnHtml = "";

            if (isFull) {
                btnHtml = `
                    <button disabled class="w-full bg-gray-400 text-white px-4 py-2.5 rounded-full text-sm font-bold cursor-not-allowed">
                        <i class="fa-solid fa-user-xmark"></i> เต็มแล้ว / Full
                    </button>
                `;
            } else {
                // ปุ่มมีหน้าตาเหมือนกันทั้งหมดทุกกรณีตามโจทย์ต้องการ (Same UI style)
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
// 4. MODAL & FLOW INTERACTIONS (FIXED ALL BUGS)
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

    document.getElementById("detailsModal").classList.remove("hidden");
}

function openConfirmModal() {
    const post = memoryPosts.find(p => p.id === selectedPostId);
    if (!post) return;

    // 🌟 เปลี่ยนจากการสกัดด้วย alert() ให้แสดงกล่องแจ้งเตือนด้วย HTML (Modal บล็อก) แทนเมื่อเจ้าของโพสต์คลิกเข้ามา
    if (loggedInUser && loggedInUser.id === post.user_id) {
        document.getElementById("ownerWarningModal").classList.remove("hidden");
        return;
    }

    document.getElementById("confirmTitle").innerText = post.title;
    document.getElementById("confirmImage").src = post.image_url || "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";

    document.getElementById("confirmModal").classList.remove("hidden");
}

async function submitApplication() {
    if (!supabaseClient) return;
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            alert("กรุณาเข้าสู่ระบบก่อนสมัคร");
            return;
        }

        const post = memoryPosts.find(p => p.id === selectedPostId);
        if (!post) return;

        if (post.joined_count >= post.people_limit) {
            alert("ขออภัย กิจกรรมนี้เต็มแล้ว!");
            return;
        }

        const { data: existing, error: checkError } = await supabaseClient
            .from("applications")
            .select("*")
            .eq("post_id", selectedPostId)
            .eq("user_id", user.id)
            .maybeSingle(); 

        if (existing) {
            alert("คุณสมัครไปแล้ว");
            return;
        }

        const { error: insertError } = await supabaseClient
            .from("applications")
            .insert([
                {
                    post_id: selectedPostId,
                    user_id: user.id
                }
            ]);

        if (insertError) throw insertError;

        const { error: updateError } = await supabaseClient
            .from("posts")
            .update({ joined_count: post.joined_count + 1 })
            .eq("id", selectedPostId);

        if (updateError) throw updateError;

        alert("สมัครสำเร็จ!");

        closeModal("confirmModal");
        closeModal("detailsModal");
        fetchPosts();

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาด: " + err.message);
    }
}

// ==========================================
// 5. APPLICATION INITIALIZER ON WINDOW LOAD
// ==========================================
window.onload = function() {
    trackAuthSession();

    const createForm = document.getElementById("createPostForm");
    if (createForm) {
        createForm.addEventListener("submit", handleCreatePost);
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    const signUpForm = document.getElementById("signUpForm");
    if (signUpForm) {
        signUpForm.addEventListener("submit", handleSignUp);
    }
    
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('filterDropdownMenu');
        const filterBtn = document.getElementById('filterBtn');
        if (menu && filterBtn && !filterBtn.contains(event.target) && !menu.contains(event.target)) {
            menu.classList.add('hidden');
        }
    });

    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('backdrop');
    const openBtn = document.getElementById('open-btn');
    const closeBtn = document.getElementById('close-btn');

    // Function to slide the sidebar in
    function openSidebar() {
      // Remove the negative translation to slide it onto the screen
      sidebar.classList.remove('-translate-x-full');
      // Unhide the dark backdrop
      backdrop.classList.remove('hidden');
    }

    // Function to slide the sidebar out
    function closeSidebar() {
      // Add the negative translation back to push it off-screen
      sidebar.classList.add('-translate-x-full');
      // Hide the dark backdrop
      backdrop.classList.add('hidden');
    }

    // Attach click events
    openBtn.addEventListener('click', openSidebar);
    closeBtn.addEventListener('click', closeSidebar);
    
    // Clicking anywhere on the dark backdrop also closes the sidebar
    backdrop.addEventListener('click', closeSidebar);
};