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
let currentFilterType = "All"; 
let loggedInUser = null;
const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

const currentPage = window.location.pathname.split("/").pop().toLowerCase();

// ==========================================
// 2. AUTHENTICATION & PROFILE FUNCTIONS
// ==========================================

function toggleAuthMode(mode) {
    const loginForm = document.getElementById('loginFormContainer');
    const signUpForm = document.getElementById('signUpFormContainer');
    const loginTab = document.getElementById('loginTab');
    const signUpTab = document.getElementById('signUpTab');

    if (!loginForm || !signUpForm) return;

    if (mode === 'login') {
        loginForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
        loginTab.className = "flex-1 text-center py-3.5 font-bold text-base border-b-4 border-[#ff7b23] text-[#ff7b23] cursor-pointer";
        signUpTab.className = "flex-1 text-center py-3.5 font-bold text-base border-b-4 border-transparent text-gray-400 hover:text-gray-600 cursor-pointer";
    } else {
        signUpForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        signUpTab.className = "flex-1 text-center py-3.5 font-bold text-base border-b-4 border-[#ff7b23] text-[#ff7b23] cursor-pointer";
        loginTab.className = "flex-1 text-center py-3.5 font-bold text-base border-b-4 border-transparent text-gray-400 hover:text-gray-600 cursor-pointer";
    }
}

async function handleSignUp(event) {
    event.preventDefault();
    if (!supabaseClient) return alert("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");

    const usernameInput = document.getElementById('signUpUsername');
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPass').value.trim();
    const avatarFile = document.getElementById('profileImageFile').files[0];
    const signUpBtn = document.getElementById('signUpBtn');

    if (!usernameInput || usernameInput.value.trim() === "") {
        return alert("กรุณากรอก Username ที่ต้องการใช้งาน");
    }
    const username = usernameInput.value.trim();

    if (password.length < 6) {
        return alert("รหัสผ่านสั้นเกินไป! กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
    }

    signUpBtn.innerText = "กำลังสร้างสิทธิ์เข้าถึง...";
    signUpBtn.disabled = true;

    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (authError) throw authError;

        if (!authData.user) {
            throw new Error("การสมัครเสร็จสิ้น แต่ไม่พบข้อมูลผู้ใช้กรุณาตรวจสอบ Email ยืนยัน");
        }

        let avatarUrl = defaultAvatar;
        if (avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${authData.user.id}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('avatars')
                .upload(fileName, avatarFile);

            if (uploadError) {
                console.error("อัปโหลดรูปไม่สำเร็จ ใช้รูปโปรไฟล์เริ่มต้นแทน:", uploadError.message);
            } else {
                const { data: publicUrlData } = supabaseClient.storage
                    .from('avatars')
                    .getPublicUrl(fileName);
                avatarUrl = publicUrlData.publicUrl;
            }
        }

        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert([{
                id: authData.user.id,
                username: username,
                avatar_url: avatarUrl
            }]);

        if (profileError) throw profileError;

        alert("สมัครสมาชิกเสร็จสิ้น! ระบบจะนำคุณเข้าสู่หน้าบอร์ดหลัก");
        window.location.href = "index.html";

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการสมัคร: " + err.message);
        signUpBtn.innerText = "Sign Up";
        signUpBtn.disabled = false;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    if (!supabaseClient) return alert("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value.trim();
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.innerText = "กำลังเข้าสู่ระบบ...";
    loginBtn.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        window.location.href = "index.html";

    } catch (err) {
        console.error(err);
        alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
        loginBtn.innerText = "Log In";
        loginBtn.disabled = false;
    }
}

function trackAuthSession() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
            loggedInUser = session.user;

            try {
                const { data: profile, error } = await supabaseClient
                    .from('profiles')
                    .select('username')
                    .eq('id', session.user.id)
                    .single();

                if (!error && profile && profile.username) {
                    const display = document.getElementById('userDisplay');
                    if (display) display.innerText = profile.username;
                } else {
                    const display = document.getElementById('userDisplay');
                    if (display) display.innerText = session.user.email.split('@')[0];
                }
            } catch (e) {
                const display = document.getElementById('userDisplay');
                if (display) display.innerText = session.user.email.split('@')[0];
            }

            if (currentPage === "signup-login.html" || currentPage === "signup-login") {
                window.location.href = "index.html";
            } else {
                fetchPosts();
            }
        } else {
            loggedInUser = null;
            if (currentPage === "index.html" || currentPage === "index" || currentPage === "") {
                window.location.href = "signup-login.html";
            }
        }
    });
}

async function handleLogout() {
    if (!supabaseClient) return;
    if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
        await supabaseClient.auth.signOut();
        window.location.href = "signup-login.html";
    }
}

// ==========================================
// 3. POSTS & BOARD CRUD FUNCTIONS
// ==========================================

async function fetchPosts() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        memoryPosts = data || [];
        renderFilteredPosts();
    } catch (err) {
        console.error("โหลดข้อมูลบอร์ดไม่สำเร็จ:", err.message);
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
            // 🎨 ดีไซน์ตัดเส้นขอบ 3px รอบตัวการ์ดเพื่อสไตล์สปอร์ตตรงตามแบบดีไซน์ใหม่ที่คุณส่งมา
            card.className = "post-card w-full rounded-[20px] black-border-bold overflow-hidden hover:shadow-2xl transition-all duration-300 flex flex-col relative mb-1";
            
            card.style.backgroundImage = post.image_url 
                ? `linear-gradient(to bottom, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.85) 100%), url('${post.image_url}')` 
                : "linear-gradient(to right, #4b5563 0%, #111827 100%)";
            card.style.backgroundSize = "cover";
            card.style.backgroundPosition = "center";
            card.style.minHeight = "230px";

            const isFull = post.joined_count >= post.people_limit;
            
            // ดึง Username หรือดึงชื่อส่วนหน้าของอีเมลมาประกอบข้อความ
            const authorName = post.author_email ? post.author_email.split('@')[0] : 'User';
            const displayBudget = post.budget ? post.budget : "0 THB";
            const displayLocation = post.location ? post.location : "Online";

            let actionButtonHtml = "";
            if (isFull) {
                // 🔴 ปุ่มสเตตัสเต็ม (Full) รูปวงรีแคปซูลใหญ่ สีแดงขอบดำสลักเงาตามภาพต้นฉบับ
                actionButtonHtml = `
                    <button disabled class="bg-[#bd1e3c] hover:bg-red-800 text-white font-extrabold px-7 py-3.5 rounded-full text-xl md:text-2xl border-2 border-black shadow-[2px_2px_0px_#000000] cursor-not-allowed tracking-tight">
                        เต็ม (${post.joined_count}/${post.people_limit})
                    </button>
                `;
            } else {
                // 🟢 ปุ่มสเตตัสเปิดรับ (Apply) รูปวงรีแคปซูลใหญ่ สีเขียวขอบดำสลักเงาตามภาพต้นฉบับ
                actionButtonHtml = `
                    <button onclick="openDetailsModal(${post.id})"
                        class="bg-[#41be5c] hover:bg-green-600 text-white font-extrabold px-7 py-3.5 rounded-full text-xl md:text-2xl border-2 border-black shadow-[2px_2px_0px_#000000] transition transform active:scale-95 cursor-pointer tracking-tight">
                        สมัคร (${post.joined_count}/${post.people_limit})
                    </button>
                `;
            }

            card.innerHTML = `
                <div class="p-6 md:p-7 flex-1 flex flex-col justify-between text-white z-10 min-h-[230px]">
                    
                    <div class="flex justify-between items-start gap-4 w-full">
                        <div class="flex flex-col">
                            <h3 class="cyber-text-stroke text-2xl md:text-3xl font-black tracking-tight leading-tight mb-1">${post.title}</h3>
                            <p class="text-zinc-300 text-xs md:text-sm font-bold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">By ${authorName}</p>
                        </div>
                        
                        <span class="bg-[#f07433] text-white border-2 border-black text-xs md:text-sm font-black px-4 py-1.5 rounded-full shadow-[1px_1px_0px_#000000] flex-shrink-0">
                            ${post.type}
                        </span>
                    </div>

                    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-8 w-full">
                        
                        <div class="flex flex-col gap-2 flex-shrink-0">
                            <div class="flex items-center bg-[#fed7aa] border-2 border-[#ea580c] px-3 py-1 rounded-full w-fit shadow-sm">
                                <span class="bg-[#ea580c] text-white text-[10px] md:text-xs font-extrabold px-2 py-0.5 rounded-md mr-2">ค่าตอบแทน</span>
                                <span class="text-[#9a3412] text-xs md:text-sm font-black">${displayBudget}</span>
                            </div>
                            <div class="flex items-center bg-[#fed7aa] border-2 border-[#ea580c] px-3 py-1 rounded-full w-fit shadow-sm">
                                <span class="bg-[#ea580c] text-white text-[10px] md:text-xs font-extrabold px-2 py-0.5 rounded-md mr-2">สถานที่นัดพบ</span>
                                <span class="text-[#9a3412] text-xs md:text-sm font-black truncate max-w-[170px] md:max-w-[220px]">${displayLocation}</span>
                            </div>
                        </div>

                        <div class="flex-shrink-0 text-right">
                            ${actionButtonHtml}
                        </div>
                    </div>

                </div>
            `;
            grid.appendChild(card);
        });
    }
}

function toggleFilterMenu() {
    const existingMenu = document.getElementById('filterDropdownMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const filterBtn = document.getElementById('filterBtn');
    if (!filterBtn) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'filterDropdownMenu';
    dropdown.className = "absolute left-0 top-full mt-2 bg-white text-gray-800 font-medium rounded-2xl shadow-xl border border-gray-100 p-2 flex flex-col min-w-[180px] z-50 animate-in fade-in slide-in-from-top-2 duration-150";

    const types = ["All", "Cooperation", "Commission", "Volunteer", "Meet-up"];
    types.forEach(type => {
        const btn = document.createElement('button');
        btn.innerText = type === "All" ? "🏷️ Show All" : type;
        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${currentFilterType === type ? 'bg-orange-50 text-[#ff7b23]' : 'hover:bg-gray-50 text-gray-700'}`;
        btn.onclick = () => {
            currentFilterType = type;
            filterBtn.innerHTML = `<i class="fa-solid fa-filter text-white/90 text-xs"></i> Filter: ${type}`;
            renderFilteredPosts();
            dropdown.remove();
        };
        dropdown.appendChild(btn);
    });

    filterBtn.parentElement.appendChild(dropdown);
}

function toggleTypeFields() {
    const type = document.getElementById("postType").value;
    const commField = document.getElementById("commissionField");
    const locField = document.getElementById("locationField");

    if (type === "Commission") {
        commField.classList.remove("hidden");
    } else {
        commField.classList.add("hidden");
    }

    if (type === "Meet-up" || type === "Cooperation" || type === "Volunteer") {
        locField.classList.remove("hidden");
    } else {
        locField.classList.add("hidden");
    }
}

function openCreateModal() {
    const modal = document.getElementById("createModal");
    if (modal) {
        modal.classList.remove("hidden");
        toggleTypeFields(); 
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("hidden");
}

async function handleCreatePost(event) {
    event.preventDefault();
    if (!supabaseClient || !loggedInUser) return alert("กรุณาเข้าสู่ระบบก่อนทำรายการ");

    const title = document.getElementById("postTitle").value.trim();
    const desc = document.getElementById("postDesc").value.trim();
    const type = document.getElementById("postType").value;
    const limit = parseInt(document.getElementById("postLimit").value) || 3;
    const budget = document.getElementById("postBudget").value.trim();
    const location = document.getElementById("postLocation").value.trim();
    const imageFile = document.getElementById("postImageFile").files[0];
    const submitBtn = document.getElementById("submitBtn");

    submitBtn.innerText = "กำลังโพสต์...";
    submitBtn.disabled = true;

    try {
        let imageUrl = "";

        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `post-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('posts-banners')
                .upload(fileName, imageFile);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage
                .from('posts-banners')
                .getPublicUrl(fileName);
            imageUrl = publicUrlData.publicUrl;
        }

        // ค้นหา Username จริงจากตาราง Profiles มาใส่ในช่องบันทึก
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('id', loggedInUser.id)
            .single();

        const authorDisplay = (profile && profile.username) ? profile.username : loggedInUser.email;

        const { error } = await supabaseClient
            .from("posts")
            .insert([{
                title: title,
                description: desc,
                type: type,
                people_limit: limit,
                budget: type === "Commission" ? budget : "",
                location: location,
                image_url: imageUrl,
                user_id: loggedInUser.id,
                author_email: authorDisplay
            }]);

        if (error) throw error;

        alert("ประกาศกิจกรรมลงบอร์ดเรียบร้อย!");
        document.getElementById("createPostForm").reset();
        closeModal("createModal");
        fetchPosts();

    } catch (err) {
        console.error(err);
        alert("สร้างโพสต์ไม่สำเร็จ: " + err.message);
    } finally {
        submitBtn.innerText = "ประกาศลงบอร์ด";
        submitBtn.disabled = false;
    }
}

// ==========================================
// 4. APPLICATION SYSTEM & CONFIRM MODALS
// ==========================================
let selectedPostId = null;

function openDetailsModal(id) {
    const post = memoryPosts.find(p => p.id === id);
    if (!post) return;

    selectedPostId = id;
    
    document.getElementById("modalTitle").innerText = post.title;
    document.getElementById("modalDesc").innerText = post.description;
    
    const img = document.getElementById("modalImage");
    if (post.image_url) {
        img.src = post.image_url;
        img.classList.remove("hidden");
    } else {
        img.src = "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600";
    }

    const detailsModal = document.getElementById("detailsModal");
    if (detailsModal) detailsModal.classList.remove("hidden");
}

function openConfirmModal() {
    const post = memoryPosts.find(p => p.id === selectedPostId);
    if (!post) return;

    document.getElementById("confirmTitle").innerText = post.title;
    const confirmImg = document.getElementById("confirmImage");
    if (post.image_url) {
        confirmImg.src = post.image_url;
    } else {
        confirmImg.src = "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150";
    }

    const confirmModal = document.getElementById("confirmModal");
    if (confirmModal) confirmModal.classList.remove("hidden");
}

async function submitApplication() {
    if (!supabaseClient || !loggedInUser || !selectedPostId) return;

    try {
        const post = memoryPosts.find(p => p.id === selectedPostId);
        if (!post) return;

        if (post.joined_count >= post.people_limit) {
            return alert("ขออภัย! กิจกรรมนี้มีผู้สมัครเข้าร่วมเต็มจำนวนแล้ว");
        }

        const { error: applyError } = await supabaseClient
            .from("applications")
            .insert([{
                post_id: selectedPostId,
                user_id: loggedInUser.id
            }]);

        if (applyError) {
            if (applyError.code === "23505") { 
                return alert("คุณเคยสมัครเข้าร่วมกิจกรรมนี้ไปแล้ว!");
            }
            throw applyError;
        }

        const { error: updateError } = await supabaseClient
            .from("posts")
            .update({ joined_count: post.joined_count + 1 })
            .eq("id", selectedPostId);

        if (updateError) throw updateError;

        alert("สมัครเข้าร่วมกิจกรรมสำเร็จ!");

        closeModal("confirmModal");
        closeModal("detailsModal");
        fetchPosts();

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาด: " + err.message);
    }
}

function openHowToStart() {
    alert("💡 ยินดีต้อนรับสู่ City Board!\n\n1. คุณสามารถเลือกดูภารกิจหรือกิจกรรมต่าง ๆ บนบอร์ดสาธารณะได้ทันที\n2. กดปุ่ม 'สมัคร' เพื่อลงชื่อร่วมกิจกรรมที่สนใจ\n3. หากต้องการจัดกิจกรรมของตนเอง ให้กดปุ่ม 'Create' มุมบนขวาเพื่อเพิ่มข้อมูลลงบอร์ด");
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
            menu.remove();
        }
    });
};