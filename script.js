// ==========================================
// 1. CONFIGURATION & INITIALIZATION
// ==========================================
const SUPABASE_URL = "https://vznmzjoouyxwosyrshzb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jnBAcgvSsdX465MooaAEUw_nsOHFkqv";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});

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
        // ล็อกอินสำเร็จ เปลี่ยนเส้นทางไปหน้าบอร์ดหลัก
        window.location.href = "index.html";
    }
}

// ตรวจสอบสถานะการเข้าสู่ระบบตลอดเวลา และควบคุมการเข้าถึงหน้าเว็บ (Guard)
function trackAuthSession() {
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
            loggedInUser = session.user;
            
            // ถ้าล็อกอินค้างไว้ แล้วเผลอเข้าหน้าล็อกอิน ให้เด้งไปหน้าบอร์ดหลักอัตโนมัติ
            if (currentPage === "signup-login.html" || currentPage === "") {
                window.location.href = "index.html";
            }

            // แสดงชื่อผู้ใช้บนหน้าบอร์ดหลัก (ดึงส่วนหน้าของอีเมลมาแสดงผล)
            if (document.getElementById('userDisplay')) {
                document.getElementById('userDisplay').innerText = loggedInUser.email.split('@')[0];
            }
            fetchPosts();
        } else {
            loggedInUser = null;
            // ถ้ายังไม่ได้ล็อกอิน แต่พยายามเข้าหน้าบอร์ดหลัก ให้เด้งกลับไปล็อกอินก่อน
            if (currentPage === "index.html") {
                window.location.href = "signup-login.html";
            }
        }
    });
}

// ฟังก์ชันออกจากระบบ (Log Out)
async function handleLogout() {
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

    if (!loggedInUser) {
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

    try {
        submitBtn.innerText = "กำลังประกาศ...";
        submitBtn.disabled = true;

        let imageUrl = null;

        // Upload image if exists
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `posts/${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('activity-images')
                .upload(filePath, imageFile);

            if (uploadError) throw uploadError;

            const { data } = supabaseClient.storage
                .from('activity-images')
                .getPublicUrl(filePath);

            imageUrl = data.publicUrl;
        }

        // Insert post
        const { error: insertError } = await supabaseClient
            .from('posts')
            .insert([
                {
                    title,
                    description,
                    type,
                    people_limit: peopleLimit,
                    joined_count: 0,
                    budget: type === 'Commission' ? budget : null,
                    location: type === 'Meet-up' ? location : null,
                    image_url: imageUrl,
                    user_id: loggedInUser.id,
                    author_email: loggedInUser.email
                }
            ]);

        if (insertError) throw insertError;

        alert("สร้างโพสต์สำเร็จ!");

        document.getElementById('createPostForm').reset();
        closeModal('createModal');
        toggleTypeFields();
        fetchPosts();

    } catch (error) {
        console.error("Create post error:", error);
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        submitBtn.innerText = "ประกาศลงบอร์ด";
        submitBtn.disabled = false;
    }
}

// ==========================================
// 4. MODAL & DYNAMIC FORM FIELDS INTERACTION
// ==========================================

// เปิดหน้าต่าง Modal (Create Post)
function openCreateModal() { 
    const modal = document.getElementById('createModal');
    if(modal) modal.classList.remove('hidden'); 
}

// ปิดหน้าต่าง Modal
function closeModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.classList.add('hidden'); 
}

// เปิด-ปิดฟิลด์กรอกข้อมูลเพิ่มเติม (ค่าตอบแทน/สถานที่) ตามประเภทกิจกรรมที่เลือก
function toggleTypeFields() {
    const typeEl = document.getElementById('postType');
    const commField = document.getElementById('commissionField');
    const locField = document.getElementById('locationField');
    
    if(!typeEl) return;
    const type = typeEl.value;

    if(commField) commField.classList.toggle('hidden', type !== 'Commission');
    if(locField) locField.classList.toggle('hidden', type !== 'Meet-up');
}

// ==========================================
// 5. APPLICATION INITIALIZER ON WINDOW LOAD
// ==========================================
window.onload = function () {
    trackAuthSession();

    const form = document.getElementById("createPostForm");

    if (form) {
        form.addEventListener("submit", handleCreatePost);
    }
};