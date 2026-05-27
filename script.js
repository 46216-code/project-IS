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
let loggedInUser = null;
const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

// ตรวจสอบชื่อไฟล์หน้าเว็บปัจจุบัน เพื่อใช้ในการเปลี่ยนหน้า (Routing)
const currentPage = window.location.pathname.split("/").pop();

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
        subTitle.innerText = "ลงทะเบียนข้อมูลบัญชีของคุณ เพื่อเริ่มใช้งานระบบบอร์ดเมือง";
    } else {
        signUpForm.style.display = 'none';
        loginForm.style.display = 'block';
        subTitle.innerText = "ยินดีต้อนรับ! เข้าสู่แพลตฟอร์มรวมตัวทำกิจกรรม";
    }
}

// ฟังก์ชันสมัครสมาชิก (Sign Up) พร้อมอัปโหลดรูปโปรไฟล์
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
    if (avatarFile && authData.user) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `avatars/${authData.user.id}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('activity-images').upload(filePath, avatarFile);
        
        if (!uploadError) {
            const { data: urlData } = supabaseClient.storage.from('activity-images').getPublicUrl(filePath);
            avatarUrl = urlData.publicUrl;
        }
    }

    // บันทึกข้อมูลลงตาราง public.profiles (สัมพันธ์กับ SQL)
    if(authData.user) {
        await supabaseClient.from('profiles').insert([{ id: authData.user.id, username: email.split('@')[0], avatar_url: avatarUrl }]);
    }
    
    alert("สมัครสมาชิกสำเร็จ! คุณสามารถใช้บัญชีนี้ล็อกอินเข้าสู่ระบบได้ทันที");
    signUpBtn.innerText = "ลงทะเบียนสร้างบัญชี (Confirm Sign Up)";
    signUpBtn.disabled = false;
    toggleAuthMode('login');
}

// ฟังก์ชันเข้าสู่ระบบ (Log In)
async function handleLogin(event) {
    event.preventDefault();
    if (!supabaseClient) return alert("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.innerText = "กำลังตรวจสอบสิทธิ์...";
    loginBtn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    loginBtn.innerText = "เข้าสู่ระบบ (Log In)";
    loginBtn.disabled = false;

    if (error) {
        alert("ล็อกอินไม่สำเร็จ: " + error.message + " (กรุณาตรวจสอบข้อมูล หรือปิดการยืนยันอีเมลใน Supabase)");
    } else {
        window.location.href = "index.html";
    }
}

// ตรวจสอบสถานะการเข้าสู่ระบบตลอดเวลา และควบคุมการเข้าถึงหน้าเว็บ (Guard)
function trackAuthSession() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
            loggedInUser = session.user;
            
            if (currentPage === "signup-login.html" || currentPage === "") {
                window.location.href = "index.html";
            }

            if (document.getElementById('userDisplay')) {
                document.getElementById('userDisplay').innerText = loggedInUser.email.split('@')[0];
            }
            fetchPosts();
        } else {
            loggedInUser = null;
            if (currentPage === "index.html") {
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
// 3. POSTS MANAGEMENT FUNCTIONS
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

// ฟังก์ชันดึงข้อมูลโพสต์และสร้างการ์ดกิจกรรมบนบอร์ด (FIXED: Added Apply Button & Logic)
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
        const emptyState = document.getElementById('emptyState');
        
        grid.querySelectorAll('.post-card').forEach(card => card.remove());
        
        if (memoryPosts.length === 0) { 
            if (emptyState) emptyState.classList.remove('hidden'); 
        } else { 
            if (emptyState) emptyState.classList.add('hidden');
            
            memoryPosts.forEach(post => {
                const card = document.createElement('div');
                card.className = "post-card bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition flex flex-col";
                
                // แก้ไขจุดเสี่ยงที่ 2: ใช้ภาพ placeholder สำรองกันภาพแตกตั้งแต่หน้าแรก
                const cardImage = post.image_url ? post.image_url : "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500";
                
                // เช็คจำนวนคนเพื่อควบคุมปุ่มสมัคร
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

    const form = document.getElementById("createPostForm");
    if (form) {
        form.addEventListener("submit", handleCreatePost);
    }
};