// ==========================================
// 1. CONFIGURATION & INITIALIZATION (FIXED DEPENDENCY)
// ==========================================
const SUPABASE_URL = "https://vznmzjoouyxwosyrshzb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jnBAcgvSsdX465MooaAEUw_nsOHFkqv";

let supabaseClient = null;

// ป้องกันปัญหา Race Condition: เช็คให้ชัวร์ว่า Supabase SDK โหลดมาจาก CDN เสร็จก่อนรัน
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
let currentFilterType = "All"; // บันทึกประเภทตัวกรองปัจจุบันที่เลือกไว้
let loggedInUser = null;
const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

// ตรวจสอบชื่อไฟล์หน้าเว็บปัจจุบัน เพื่อใช้ในการเปลี่ยนหน้า (Routing ปลอดภัยขึ้น)
const currentPage = window.location.pathname.split("/").pop().toLowerCase();

// ==========================================
// 2. AUTHENTICATION & PROFILE FUNCTIONS
// ==========================================

// สลับหน้าจอระหว่าง เข้าสู่ระบบ และ สมัครสมาชิก (หน้า signup-login.html)
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

// ฟังก์ชันสมัครสมาชิก (Sign Up) พร้อมอัปโหลดรูปโปรไฟล์ [เวอร์ชันแก้ไขสมบูรณ์]
async function handleSignUp(event) {
    event.preventDefault();
    if (!supabaseClient) return alert("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");

    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPass').value.trim();
    const avatarFile = document.getElementById('profileImageFile').files[0];
    const signUpBtn = document.getElementById('signUpBtn');

    if (password.length < 6) {
        return alert("รหัสผ่านสั้นเกินไป! กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
    }

    signUpBtn.innerText = "กำลังสร้างสิทธิ์เข้าถึง...";
    signUpBtn.disabled = true;

    // สมัครสมาชิกในระบบ Auth ของ Supabase
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
    
    // อัปโหลดรูปโปรไฟล์ไปยัง Storage bucket: activity-images (ถ้าผู้ใช้เลือกรูป)
    if (avatarFile && authData && authData.user) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `avatars/${authData.user.id}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('activity-images').upload(filePath, avatarFile);
        
        if (!uploadError) {
            const { data: urlData } = supabaseClient.storage.from('activity-images').getPublicUrl(filePath);
            avatarUrl = urlData.publicUrl;
        } else {
            console.error("🚨 Storage Upload Error:", uploadError.message);
        }
    }

    // บันทึกข้อมูลลงตาราง public.profiles (แยกโครงสร้างชัดเจน ลดโอกาสเกิด Bug)
    if (authData && authData.user) {
        const profileData = { 
            id: authData.user.id, 
            username: email.split('@')[0], 
            avatar_url: avatarUrl 
        };

        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert([profileData]);

        if (profileError) {
            console.error("🚨 ไม่สามารถสร้างตาราง Profile ได้:", profileError.message);
            alert("สมัครสมาชิกสำเร็จ แต่ไม่สามารถสร้างโปรไฟล์ได้: " + profileError.message);
        }
    }
    
    alert("สมัครสมาชิกสำเร็จ! คุณสามารถใช้บัญชีนี้ล็อกอินเข้าสู่ระบบได้ทันที");
    signUpBtn.innerText = "ลงทะเบียนสร้างบัญชี (Confirm Sign Up)";
    signUpBtn.disabled = false;
    toggleAuthMode('login');
}

// ฟังก์ชันเข้าสู่ระบบ (Log In) - แก้ไขเพิ่ม Event Prevent Default กันหน้าเว็บรีเฟรชเองเอ๋อ
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

// ตรวจสอบสถานะการเข้าสู่ระบบตลอดเวลา และควบคุมการเข้าถึงหน้าเว็บ (Guard ปรับปรุงใหม่แบบนิ่งเสถียร)
function trackAuthSession() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
            loggedInUser = session.user;
            
            // ป้องกันลูปเด้งหน้าสลับไปมาด้วยการเช็คสัญชาติหน้าเว็บปัจจุบันให้ละเอียดขึ้น
            if (currentPage === "signup-login.html" || currentPage === "signup-login" || currentPage === "") {
                window.location.href = "index.html";
                return;
            }

            if (document.getElementById('userDisplay')) {
                document.getElementById('userDisplay').innerText = loggedInUser.email.split('@')[0];
            }
            fetchPosts();
        } else {
            loggedInUser = null;
            // ถ้าหลุดเซสชันและไม่ได้อยู่หน้าล็อกอิน ให้พาไปหน้าล็อกอินทันที
            if (currentPage === "index.html" || currentPage === "index" || currentPage === "/") {
                window.location.href = "signup-login.html";
            }
        }
    });
}

// ฟังก์ชันออกจากระบบ (Log Out)
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

// ฟังก์ชันสร้างโพสต์ภารกิจใหม่และบันทึกลงตาราง public.posts
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

// ฟังก์ชันดึงข้อมูลโพสต์และสร้างการ์ดกิจกรรมบนบอร์ด พร้อมรองรับระบบ Filter
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

// ทำหน้าที่เรนเดอร์โพสต์ลง UI ตามประเภท Filter ที่เลือก
function renderFilteredPosts() {
    const grid = document.getElementById('boardGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid) return;

    // ลบการ์ดเดิมออกก่อนเพื่อจัดกลุ่มเรนเดอร์ใหม่
    grid.querySelectorAll('.post-card').forEach(card => card.remove());

    // กรองข้อมูลด้วยตัวแปรประเภท filter ตัวปัจจุบัน
    const displayedPosts = currentFilterType === "All" 
        ? memoryPosts 
        : memoryPosts.filter(post => post.type === currentFilterType);

    if (displayedPosts.length === 0) { 
        if (emptyState) emptyState.classList.remove('hidden'); 
    } else { 
        if (emptyState) emptyState.classList.add('hidden');
        
        displayedPosts.forEach(post => {
            const card = document.createElement('div');
            card.className = "post-card bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition flex flex-col";
            
            const cardImage = post.image_url ? post.image_url : "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";
            const isFull = post.joined_count >= post.people_limit;
            let btnHtml = "";

            if (isFull) {
                btnHtml = `
                    <button disabled class="mt-4 w-full bg-gray-400 text-white px-4 py-2 rounded-full text-sm font-bold cursor-not-allowed">
                        <i class="fa-solid fa-user-xmark"></i> เต็มแล้ว / Full
                    </button>
                `;
            } else {
                btnHtml = `
                    <button onclick="openDetailsModal(${post.id})"
                        class="mt-4 w-full bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-green-600 transition cursor-pointer">
                        Apply / ดูรายละเอียด
                    </button>
                `;
            }

            card.innerHTML = `
                <div class="h-48 w-full bg-gray-200 overflow-hidden relative">
                    <img src="${cardImage}" class="w-full h-full object-cover">
                    <span class="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full border border-white">
                        ${post.type}
                    </span>
                </div>
                <div class="p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <h3 class="text-xl font-black text-gray-800 mb-2">${post.title}</h3>
                        <p class="text-gray-600 text-sm mb-4 line-clamp-3">${post.description}</p>
                        
                        ${post.budget ? `<p class="text-green-600 font-bold text-sm mb-2"><i class="fa-solid fa-money-bill-wave"></i> ค่าตอบแทน: ${post.budget}</p>` : ''}
                        ${post.location ? `<p class="text-blue-600 font-bold text-sm mb-2"><i class="fa-solid fa-location-dot"></i> สถานที่: ${post.location}</p>` : ''}
                    </div>
                    
                    <div>
                        <div class="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-500 mt-4">
                            <span><i class="fa-solid fa-user-group text-orange-400"></i> เข้าร่วมแล้ว: <strong class="text-gray-800">${post.joined_count}/${post.people_limit}</strong> คน</span>
                            <span>โดย: ${post.author_email ? post.author_email.split('@')[0] : 'ไม่ระบุ'}</span>
                        </div>
                        <div class="mt-3">
                            ${btnHtml}
                        </div>
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

// ฟังก์ชันจัดการเปิด-ปิด และสลับตัวกรองกิจกรรม (Filter Menu Layout)
function toggleFilterMenu() {
    let menu = document.getElementById('filterDropdownMenu');
    
    // ถ้ายังไม่มีเมนูใน Element หน้าจอ ให้สร้างขึ้นมาแบบ Dynamic สไตล์พรีเมียมคุมโทนส้มสว่าง
    if (!menu) {
        const filterBtn = document.getElementById('filterBtn');
        if (!filterBtn) return;

        menu = document.createElement('div');
        menu.id = 'filterDropdownMenu';
        menu.className = "absolute mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex flex-col gap-1.5 z-40 w-52 transition-all duration-200";
        
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
                
                // แก้ไขไอคอนหรือสัญลักษณ์ป้ายชื่อ Filter หลักที่หัวปุ่มกด
                filterBtn.innerHTML = `<i class="fa-solid fa-filter text-white/90 text-xs"></i> Filter: ${cat.value}`;
                
                renderFilteredPosts();
                menu.classList.add('hidden');
            };
            menu.appendChild(btn);
        });

        // แปะกล่องเมนูลงไปใต้โครงสร้างของ Container ปุ่ม Filter
        filterBtn.parentNode.appendChild(menu);
    } else {
        // หากมีอยู่แล้ว ให้เปิด-ปิดซ่อนการแสดงผลสลับกัน
        menu.classList.toggle('hidden');
        
        // ไฮไลต์ปุ่มประเภทที่เลือกใช้งานให้ตรงสถานะปัจจุบันเสมอ
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

// ฟังก์ชันตัวช่วยหน้า Guide
function openHowToStart() {
    alert("💡 วิธีเริ่มต้นใช้งาน:\n1. เข้าสู่ระบบบัญชีผู้ใช้งานของคุณ\n2. กดปุ่ม 'Create' มุมบนขวาเพื่อสร้างประกาศกิจกรรมใหม่\n3. ค้นหากิจกรรมที่คุณสนใจบนหน้าบอร์ด แล้วกดสมัครเข้าร่วมกิจกรรมได้ทันที!");
}

let selectedPostId = null;

// ขั้นตอนที่ 1: กดปุ่มที่การ์ด -> เปิดหน้าต่างรายละเอียดภารกิจ (FIXED IMAGE FALLBACK)
function openDetailsModal(postId) {
    const post = memoryPosts.find(p => p.id === postId);
    if (!post) return;

    selectedPostId = postId;

    document.getElementById("modalTitle").innerText = post.title;
    document.getElementById("modalDesc").innerText = post.description;
    
    // แก้ไขจุดเสี่ยงที่ 2: ถ้ารูปเป็น Null ให้เปลี่ยนไปใช้รูป Default แทนเพื่อไม่ให้รูปแตก
    document.getElementById("modalImage").src = post.image_url || "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";

    document.getElementById("detailsModal").classList.remove("hidden");
}

// ขั้นตอนที่ 2: กดสมัครจากหน้าต่างรายละเอียด -> เปิดหน้าต่างยืนยัน (FIXED IMAGE FALLBACK)
function openConfirmModal() {
    const post = memoryPosts.find(p => p.id === selectedPostId);
    if (!post) return;

    document.getElementById("confirmTitle").innerText = post.title;
    
    // แก้ไขจุดเสี่ยงที่ 3: ป้องกันรูปพังบน Confirm Modal
    document.getElementById("confirmImage").src = post.image_url || "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";

    document.getElementById("confirmModal").classList.remove("hidden");
}

// ขั้นตอนที่ 3: กดยืนยันใบสมัคร -> บันทึกลงฐานข้อมูล (FIXED: DOUBLE APPLY & AUTOMATIC +1)
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

        // ดักเช็คสิทธิ์เต็มก่อนส่งข้อมูลเข้าเซิร์ฟเวอร์อีกชั้นหนึ่ง
        if (post.joined_count >= post.people_limit) {
            alert("ขออภัย กิจกรรมนี้เต็มแล้ว!");
            return;
        }

        // แก้ไขจุดเสี่ยงที่ 5: ป้องกันการกดเบิ้ลส่งข้อมูลซ้ำ (Prevent Double Apply)
        const { data: existing, error: checkError } = await supabaseClient
            .from("applications")
            .select("*")
            .eq("post_id", selectedPostId)
            .eq("user_id", user.id)
            .maybeSingle(); // ปลอดภัยกว่า .single() เพราะไม่โยน error เมื่อไม่พบแถวข้อมูล

        if (existing) {
            alert("คุณสมัครไปแล้ว");
            return;
        }

        // ส่งข้อมูลบันทึกใบสมัคร
        const { error: insertError } = await supabaseClient
            .from("applications")
            .insert([
                {
                    post_id: selectedPostId,
                    user_id: user.id
                }
            ]);

        if (insertError) throw insertError;

        // แก้ไขจุดเสี่ยงที่ 6: อัปเดตบวกเลขจำนวนผู้เข้าร่วมกิจกรรมเพิ่มขึ้น 1 คนบน DB อัตโนมัติ
        const { error: updateError } = await supabaseClient
            .from("posts")
            .update({ joined_count: post.joined_count + 1 })
            .eq("id", selectedPostId);

        if (updateError) throw updateError;

        alert("สมัครสำเร็จ!");

        // ทำความสะอาดหน้าจอ ปิด Modals ทั้งหมดตาม Flow
        closeModal("confirmModal");
        closeModal("detailsModal");

        // โหลดข้อมูลขึ้นบอร์ดใหม่ทันทีเพื่อให้ปุ่มและจำนวนคนเปลี่ยนตามจริง
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

    // เช็คก่อนผูกมัด Event Listener ป้องกันปัญหา Uncaught TypeError ฟอร์มพังข้ามหน้าจอ
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
    
    // ปิดเมนู Filter อัตโนมัติเมื่อผู้ใช้คลิกพื้นที่ว่างภายนอก
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('filterDropdownMenu');
        const filterBtn = document.getElementById('filterBtn');
        if (menu && filterBtn && !filterBtn.contains(event.target) && !menu.contains(event.target)) {
            menu.classList.add('hidden');
        }
    });
};