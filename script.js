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
async function handleCreatePost(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('submitBtn');

    try {
        // ✅ 1. Check login properly
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            alert("กรุณาเข้าสู่ระบบก่อนสร้างโพสต์");
            return;
        }

        // ✅ 2. Get values
        const title = document.getElementById('postTitle').value.trim();
        const description = document.getElementById('postDesc').value.trim();
        const type = document.getElementById('postType').value;
        const peopleLimit = parseInt(document.getElementById('postLimit').value) || 3;
        const budget = document.getElementById('postBudget').value.trim();
        const location = document.getElementById('postLocation').value.trim();
        const imageFile = document.getElementById('postImageFile').files[0];

        // ✅ 3. Basic validation
        if (!title || !description) {
            alert("กรุณากรอกหัวข้อและรายละเอียด");
            return;
        }

        submitBtn.innerText = "กำลังประกาศ...";
        submitBtn.disabled = true;

        let imageUrl = null;

        // ✅ 4. Upload image safely
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
            const filePath = `posts/${fileName}`;

            const { error: uploadError } = await supabaseClient
                .storage
                .from('activity-images')
                .upload(filePath, imageFile);

            if (uploadError) {
                console.error(uploadError);
                alert("อัปโหลดรูปไม่สำเร็จ");
            } else {
                const { data } = supabaseClient
                    .storage
                    .from('activity-images')
                    .getPublicUrl(filePath);

                imageUrl = data.publicUrl;
            }
        }

        // ✅ 5. Insert post
        const { error: insertError } = await supabaseClient
            .from('posts')
            .insert([{
                title,
                description,
                type,
                people_limit: peopleLimit,
                joined_count: 0,
                budget: type === 'Commission' ? budget : null,
                location: type === 'Meet-up' ? location : null,
                image_url: imageUrl,
                user_id: user.id,
                author_email: user.email
            }]);

        if (insertError) {
            console.error(insertError);
            throw insertError;
        }

        alert("สร้างโพสต์สำเร็จ!");

        // reset UI
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
// 5. APPLICATION INITIALIZER ON WINDOW LOAD
// ==========================================
window.onload = function () {
    trackAuthSession();

    const form = document.getElementById("createPostForm");

    if (form) {
        form.addEventListener("submit", handleCreatePost);
    }
};